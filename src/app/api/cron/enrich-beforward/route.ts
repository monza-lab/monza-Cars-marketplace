import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseDetailHtml } from "@/features/scrapers/beforward_porsche_collector/detail";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function fitText(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { success: false, error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  await markScraperRunStarted({
    scraperName: "enrich-beforward",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error: fetchErr } = await client
      .from("listings")
      .select("id,source_url")
      .eq("source", "BeForward")
      .eq("status", "active")
      .is("trim", null)
      .order("updated_at", { ascending: true })
      .limit(50);

    if (fetchErr || !rows) {
      throw new Error(fetchErr?.message ?? "No rows returned");
    }

    const discovered = rows.length;
    let enriched = 0;
    let delisted = 0;
    const errors: string[] = [];
    const warnings: string[] = [];
    const DELAY_MS = 2_000;
    const TIME_BUDGET_MS = 270_000;
    const RATE_LIMIT_BACKOFF_MS = 6_000;
    const MAX_RATE_LIMITS = 3;
    let consecutiveRateLimits = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (Date.now() - startTime > TIME_BUDGET_MS) {
        errors.push(`Time budget reached after ${enriched} enrichments`);
        break;
      }

      if (i > 0) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      try {
        const response = await fetch(row.source_url, {
          headers: FETCH_HEADERS,
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 410) {
            await client
              .from("listings")
              .update({ status: "delisted", updated_at: new Date().toISOString() })
              .eq("id", row.id);
            delisted++;
            warnings.push(`Dead URL (${row.id}): HTTP ${response.status}`);
            continue;
          }
          throw new Error(`HTTP ${response.status} for ${row.source_url}`);
        }

        const html = await response.text();
        const detail = parseDetailHtml(html);

        const update: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
        };

        if (detail.trim) update.trim = fitText(detail.trim, 17);
        if (detail.engine) update.engine = fitText(detail.engine, 32);
        if (detail.transmission) update.transmission = fitText(detail.transmission, 32);
        if (detail.exteriorColor) update.color_exterior = fitText(detail.exteriorColor, 64);
        if (detail.vin) update.vin = fitText(detail.vin, 17);
        const newFieldCount = Object.keys(update).length - 2; // minus updated_at, last_verified_at
        if (newFieldCount > 0) {
          const { error: updateErr } = await client
            .from("listings")
            .update(update)
            .eq("id", row.id);

          if (updateErr) {
            errors.push(`Update failed (${row.id}): ${updateErr.message}`);
          } else {
            enriched++;
            consecutiveRateLimits = 0;
          }
        } else {
          // Mark as attempted
          await client
            .from("listings")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", row.id);
          consecutiveRateLimits = 0;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
          consecutiveRateLimits++;
          warnings.push(`Rate limited (${consecutiveRateLimits}/${MAX_RATE_LIMITS}): ${msg}`);
          if (consecutiveRateLimits >= MAX_RATE_LIMITS) {
            errors.push(`Circuit-break: ${msg}`);
            break;
          }
          await new Promise((r) => setTimeout(r, RATE_LIMIT_BACKOFF_MS));
          continue;
        }

        errors.push(`Failed ${row.source_url}: ${msg}`);
      }
    }

    const touched = enriched + delisted;
    const success = discovered === 0 ? errors.length === 0 : touched > 0;

    await recordScraperRun({
      scraper_name: "enrich-beforward",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written: touched,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : warnings.length > 0 ? warnings : undefined,
    });

    await clearScraperRunActive("enrich-beforward");

    return NextResponse.json(
      {
        success,
        runId,
        discovered,
        enriched,
        delisted,
        warnings,
        errors,
        duration: `${Date.now() - startTime}ms`,
      },
      { status: success ? 200 : 500 }
    );
  } catch (error) {
    console.error("[cron/enrich-beforward] Error:", error);

    await recordScraperRun({
      scraper_name: "enrich-beforward",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Enrichment failed"],
    });

    await clearScraperRunActive("enrich-beforward");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Enrichment failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
