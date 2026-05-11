/**
 * CLI: Enrich AutoTrader listings via product-page API + HTML + GraphQL.
 *
 * Uses the multi-strategy fetchAutoTraderDetail() which tries:
 *   1. Product-page REST API  (/product-page/v1/advert/{id})
 *   2. HTML scrape + Cheerio
 *   3. GraphQL at-gateway fallback (for missing mileage/images)
 *
 * Usage:
 *   npx tsx scripts/autotrader-enrich.ts
 *   npx tsx scripts/autotrader-enrich.ts --limit=500 --delayMs=2000
 *   npx tsx scripts/autotrader-enrich.ts --limit=100 --dryRun
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ──────────────────────────────────────────────────
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

import { fetchAutoTraderDetail } from "../src/features/scrapers/autotrader_collector/detail";
import { proxyFetch } from "../src/features/scrapers/common/proxy-fetch";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "../src/features/scrapers/common/monitoring/record";

// ── CLI args ─────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: 300,
    timeBudgetMs: 20 * 60 * 1000,
    delayMs: 2000,
    dryRun: false,
  };
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      const key = arg.slice(2, eqIdx);
      const val = arg.slice(eqIdx + 1);
      if (key === "limit") opts.limit = parseInt(val, 10);
      if (key === "timeBudgetMs") opts.timeBudgetMs = parseInt(val, 10);
      if (key === "delayMs") opts.delayMs = parseInt(val, 10);
    } else {
      const key = arg.slice(2);
      if (key === "dryRun") opts.dryRun = true;
    }
  }
  return opts;
}

function truncate(v: string | null | undefined, max: number): string | null {
  if (v == null) return null;
  return v.length <= max ? v : v.slice(0, max);
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  console.log(`\n=== AutoTrader Enrichment (API + HTML + GraphQL) ===`);
  console.log(`Limit: ${opts.limit}, Budget: ${Math.round(opts.timeBudgetMs / 1000)}s, Delay: ${opts.delayMs}ms`);
  console.log(`Dry run: ${opts.dryRun}\n`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runtime = process.env.GITHUB_ACTIONS ? "github_actions" as const : "cli" as const;
  await markScraperRunStarted({
    scraperName: "at-enrich",
    runId,
    startedAt: startedAtIso,
    runtime,
  });

  // Query active AutoTrader listings needing enrichment
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, source_url, title, engine, transmission, mileage, vin, color_exterior, description_text, images, photos_count, current_bid")
    .eq("source", "AutoTrader")
    .eq("status", "active")
    .or("current_bid.is.null,current_bid.lte.0,engine.is.null,transmission.is.null,mileage.is.null,description_text.is.null,photos_count.lt.5")
    .order("updated_at", { ascending: true })
    .limit(opts.limit);

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }
  console.log(`Found ${listings.length} AutoTrader listings needing enrichment\n`);

  if (listings.length === 0) {
    console.log("Nothing to enrich.");
    await clearScraperRunActive("at-enrich");
    return;
  }

  // ── Batch enrichment ───────────────────────────────────────────────
  let enriched = 0;
  let demoted = 0;
  let skipped = 0;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 10;
  const errors: string[] = [];

  for (let i = 0; i < listings.length; i++) {
    if (Date.now() - startTime > opts.timeBudgetMs) {
      console.log(`\nTime budget reached after ${i} listings.`);
      break;
    }

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.log(`\nCircuit-break: ${consecutiveFailures} consecutive failures. Stopping.`);
      break;
    }

    const listing = listings[i];
    try {
      const detail = await fetchAutoTraderDetail(listing.source_url);

      const hasData =
        detail.price != null ||
        detail.mileage != null ||
        detail.images.length > 0 ||
        detail.engine != null ||
        detail.transmission != null ||
        detail.vin != null ||
        detail.exteriorColor != null ||
        detail.description != null;

      if (hasData) {
        consecutiveFailures = 0;
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (detail.price != null && detail.price > 0) {
          updates.current_bid = detail.price;
          updates.hammer_price = detail.price;
        }
        if (!listing.engine && detail.engine) updates.engine = truncate(detail.engine, 100);
        if (!listing.transmission && detail.transmission) updates.transmission = truncate(detail.transmission, 100);
        if (!listing.mileage && detail.mileage != null) {
          const km = detail.mileageUnit === "km" ? detail.mileage : Math.round(detail.mileage * 1.609344);
          updates.mileage = km;
          updates.mileage_unit = "km";
        }
        if (!listing.color_exterior && detail.exteriorColor) updates.color_exterior = truncate(detail.exteriorColor, 100);
        if (!listing.vin && detail.vin) updates.vin = truncate(detail.vin, 17);
        if (!listing.description_text && detail.description) updates.description_text = truncate(detail.description, 2000);

        const hasStaleImages = listing.images?.some((img: string) => img.includes("{resize}")) ?? false;
        if (detail.images.length > 0 && (!listing.images || listing.images.length <= 1 || hasStaleImages)) {
          updates.images = detail.images;
          updates.photos_count = detail.images.length;
        }

        if (!opts.dryRun) {
          const { error: updateErr } = await supabase.from("listings").update(updates).eq("id", listing.id);
          if (updateErr) {
            errors.push(`${listing.id}: ${updateErr.message}`);
            consecutiveFailures++;
          } else {
            enriched++;
          }
        } else {
          console.log(`  [DRY] ${listing.source_url}: price=${detail.price}, engine=${detail.engine}, mileage=${detail.mileage}, images=${detail.images.length}`);
          enriched++;
        }
      } else {
        // No data recovered — check if listing was removed from AutoTrader
        const advertMatch = listing.source_url.match(/\/car-details\/(\d+)(?:[/?#]|$)/i);
        const advertId = advertMatch?.[1];
        let wasDelisted = false;

        if (advertId) {
          try {
            const apiUrl = `https://www.autotrader.co.uk/product-page/v1/advert/${advertId}?channel=cars&postcode=SW1A%201AA`;
            const apiResp = await proxyFetch(apiUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                Accept: "application/json",
                Referer: listing.source_url,
              },
              signal: AbortSignal.timeout(10_000),
            });
            if (apiResp.status === 404) {
              if (!opts.dryRun) {
                const { error: delistErr } = await supabase
                  .from("listings")
                  .update({ status: "delisted", updated_at: new Date().toISOString() })
                  .eq("id", listing.id);
                if (!delistErr) {
                  demoted++;
                  wasDelisted = true;
                }
              } else {
                console.log(`  [DRY] DELIST: ${listing.source_url} (404)`);
                demoted++;
                wasDelisted = true;
              }
              consecutiveFailures = 0;
            }
          } catch {
            // API check failed — treat as transient
          }
        }

        if (!wasDelisted) {
          // CF-blocked or transient — touch updated_at to avoid retrying immediately
          if (!opts.dryRun) {
            await supabase
              .from("listings")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", listing.id);
          }
          skipped++;
          consecutiveFailures++;
        }
      }

      if ((enriched + demoted) > 0 && (enriched + demoted) % 25 === 0) {
        console.log(`  Progress: enriched=${enriched}, demoted=${demoted}, skipped=${skipped} (${i + 1}/${listings.length})`);
      }
      if (i < listings.length - 1) await new Promise((r) => setTimeout(r, opts.delayMs));
    } catch (err: unknown) {
      consecutiveFailures++;
      const msg = err instanceof Error ? err.message : String(err);

      if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
        errors.push(`Circuit-break: ${msg}`);
        console.log(`\nCloudflare/rate-limit detected. Stopping.`);
        break;
      }

      errors.push(`${listing.source_url}: ${msg}`);
    }
  }

  const elapsed = Date.now() - startTime;
  const written = enriched + demoted;
  console.log(`\n=== Summary ===`);
  console.log(`Enriched: ${enriched}, Delisted: ${demoted}, Skipped: ${skipped}, Errors: ${errors.length}, Duration: ${Math.round(elapsed / 1000)}s`);
  if (errors.length > 0) {
    console.log(`First errors:`);
    for (const e of errors.slice(0, 5)) console.log(`  - ${e}`);
  }

  await recordScraperRun({
    scraper_name: "at-enrich",
    run_id: runId,
    started_at: startedAtIso,
    finished_at: new Date().toISOString(),
    success: errors.length === 0 || written > 0,
    runtime,
    duration_ms: elapsed,
    discovered: listings.length,
    written,
    errors_count: errors.length,
    error_messages: errors.length > 0 ? errors.slice(0, 10) : undefined,
  });
  await clearScraperRunActive("at-enrich");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
