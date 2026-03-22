/**
 * Bulk AS24 enrichment script — runs under GitHub Actions with 30-minute budget.
 * Reuses parseDetailHtml from the AS24 collector.
 */
import { createClient } from "@supabase/supabase-js";
import { parseDetailHtml } from "../src/features/scrapers/autoscout24_collector/detail";
import { recordScraperRun } from "../src/features/scrapers/common/monitoring";

const args = process.argv.slice(2);
function getFlag(name: string, defaultVal: string): string {
  const flag = args.find((a) => a.startsWith(`--${name}=`));
  return flag ? flag.split("=")[1] : defaultVal;
}

const MAX_LISTINGS = parseInt(getFlag("maxListings", "500"), 10);
const DELAY_MS = parseInt(getFlag("delayMs", "1000"), 10);
const DRY_RUN = args.includes("--dryRun");
const TIME_BUDGET_MS = 25 * 60 * 1000; // 25 minutes (within 30-min GH Actions timeout)

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startTime = Date.now();
  const runId = crypto.randomUUID();
  const startedAtIso = new Date(startTime).toISOString();

  console.log(`[enrich-as24-bulk] Starting: max=${MAX_LISTINGS}, delay=${DELAY_MS}ms, dryRun=${DRY_RUN}`);

  const { data: rows, error: fetchErr } = await client
    .from("listings")
    .select("id,source_url")
    .eq("source", "AutoScout24")
    .eq("status", "active")
    .is("trim", null)
    .order("updated_at", { ascending: true })
    .limit(MAX_LISTINGS);

  if (fetchErr || !rows) {
    console.error("Query failed:", fetchErr?.message);
    process.exit(1);
  }

  console.log(`[enrich-as24-bulk] Found ${rows.length} listings to enrich`);

  let enriched = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (Date.now() - startTime > TIME_BUDGET_MS) {
      console.log(`Time budget reached after ${enriched} enrichments`);
      break;
    }

    if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));

    try {
      const response = await fetch(row.source_url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 410) {
          if (!DRY_RUN) {
            await client.from("listings")
              .update({ status: "delisted", updated_at: new Date().toISOString() })
              .eq("id", row.id);
          }
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const detail = parseDetailHtml(html);

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (detail.trim) update.trim = detail.trim;
      if (detail.transmission) update.transmission = detail.transmission;
      if (detail.bodyStyle) update.body_style = detail.bodyStyle;
      if (detail.engine) update.engine = detail.engine;
      if (detail.exteriorColor) update.color_exterior = detail.exteriorColor;
      if (detail.interiorColor) update.color_interior = detail.interiorColor;
      if (detail.vin) update.vin = detail.vin;
      if (detail.description) update.description_text = detail.description;
      if (detail.images && detail.images.length > 0) {
        update.images = detail.images;
        update.photos_count = detail.images.length;
      }

      const newFieldCount = Object.keys(update).length - 1;
      if (!DRY_RUN) {
        if (newFieldCount > 0) {
          const { error: updateErr } = await client.from("listings").update(update).eq("id", row.id);
          if (!updateErr) enriched++;
          else errors.push(`Update failed (${row.id}): ${updateErr.message}`);
        } else {
          await client.from("listings")
            .update({ trim: "", updated_at: new Date().toISOString() })
            .eq("id", row.id);
        }
      } else {
        if (newFieldCount > 0) enriched++;
      }

      if ((i + 1) % 50 === 0) {
        console.log(`[enrich-as24-bulk] Progress: ${i + 1}/${rows.length} processed, ${enriched} enriched`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
        errors.push(`Circuit-break: ${msg}`);
        break;
      }
      errors.push(`Failed ${row.source_url}: ${msg}`);
    }
  }

  if (!DRY_RUN) {
    await recordScraperRun({
      scraper_name: "enrich-details-bulk",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "github_actions",
      duration_ms: Date.now() - startTime,
      discovered: rows.length,
      written: enriched,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });
  }

  console.log(`[enrich-as24-bulk] Done: ${enriched}/${rows.length} enriched, ${errors.length} errors, ${Date.now() - startTime}ms`);
  if (errors.length > 0) console.log("Errors:", errors.slice(0, 10));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
