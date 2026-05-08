/**
 * CLI: Enrich AutoTrader listings via Scrapling.
 * Designed for GitHub Actions (20-minute budget).
 *
 * Finds active AutoTrader listings missing key fields (engine IS NULL),
 * fetches detail pages with Scrapling, and updates only null fields.
 *
 * Usage:
 *   npx tsx scripts/autotrader-enrich-scrapling.ts
 *   npx tsx scripts/autotrader-enrich-scrapling.ts --limit=300 --dryRun
 *   npx tsx scripts/autotrader-enrich-scrapling.ts --preflight
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

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

import { fetchATDetailWithScrapling } from "../src/features/scrapers/autotrader_collector/scrapling";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "../src/features/scrapers/common/monitoring/record";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: 300,
    timeBudgetMs: 20 * 60 * 1000,
    delayMs: 3000,
    dryRun: false,
    preflight: false,
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
      if (key === "preflight") opts.preflight = true;
    }
  }
  return opts;
}

function truncate(v: string | null | undefined, max: number): string | null {
  if (v == null) return null;
  return v.length <= max ? v : v.slice(0, max);
}

async function main() {
  const opts = parseArgs();
  const startTime = Date.now();
  const runId = crypto.randomUUID();

  console.log(`\n=== AutoTrader Scrapling Enrichment ===`);
  console.log(`Limit: ${opts.limit}, Budget: ${Math.round(opts.timeBudgetMs / 1000)}s, Delay: ${opts.delayMs}ms`);
  console.log(`Dry run: ${opts.dryRun}, Pre-flight: ${opts.preflight}\n`);

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
  await markScraperRunStarted({ scraperName: "at-enrich", runId, startedAt: new Date(startTime).toISOString(), runtime });

  // Query AutoTrader active listings missing key enrichment fields
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, source_url, title, engine, transmission, mileage, vin, color_exterior, description_text, images")
    .eq("source", "AutoTrader")
    .eq("status", "active")
    .or("engine.is.null,transmission.is.null,mileage.is.null,description_text.is.null")
    .order("updated_at", { ascending: true })
    .limit(opts.limit);

  if (error) { console.error("Query error:", error.message); process.exit(1); }
  console.log(`Found ${listings.length} AutoTrader listings needing enrichment\n`);

  if (listings.length === 0) {
    console.log("Nothing to enrich.");
    await clearScraperRunActive("at-enrich");
    return;
  }

  // Pre-flight: test 5 MOST RECENTLY updated listings (likely still live on AT)
  if (opts.preflight) {
    console.log("=== PRE-FLIGHT CHECK ===\n");
    const { data: recentListings } = await supabase
      .from("listings")
      .select("id, source_url")
      .eq("source", "AutoTrader")
      .eq("status", "active")
      .not("source_url", "is", null)
      .order("updated_at", { ascending: false })
      .limit(5);

    const preflightListings = recentListings?.length ? recentListings : listings.slice(0, 5);
    let passed = 0;
    for (const listing of preflightListings) {
      const detail = await fetchATDetailWithScrapling(listing.source_url);
      const ok = !!(detail?.price || detail?.mileage || detail?.engine || detail?.images?.length);
      console.log(`  ${ok ? "OK" : "SKIP"}: ${listing.source_url} — price=${detail?.price}, mileage=${detail?.mileage}, images=${detail?.images?.length ?? 0}`);
      if (ok) passed++;
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }
    console.log(`\nPre-flight: ${passed}/${preflightListings.length}`);
    if (passed < 2) { console.error("Pre-flight FAILED."); process.exit(1); }
    console.log("Pre-flight PASSED.");
    await clearScraperRunActive("at-enrich");
    return;
  }

  // Batch
  let written = 0, skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < listings.length; i++) {
    if (Date.now() - startTime > opts.timeBudgetMs) {
      console.log(`\nTime budget reached after ${i} listings.`);
      break;
    }

    const listing = listings[i];
    try {
      const detail = await fetchATDetailWithScrapling(listing.source_url);
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (detail) {
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
        if (detail.images.length > 0 && (!listing.images || listing.images.length <= 1)) {
          updates.images = detail.images;
          updates.photos_count = detail.images.length;
        }
      } else {
        skipped++;
      }

      if (!opts.dryRun) {
        const { error: updateErr } = await supabase.from("listings").update(updates).eq("id", listing.id);
        if (updateErr) errors.push(`${listing.id}: ${updateErr.message}`);
        else written++;
      } else {
        console.log(`  [DRY] ${listing.source_url}: engine=${detail?.engine || "null"}, mileage=${detail?.mileage || "null"}`);
        written++;
      }

      if (written > 0 && written % 25 === 0) console.log(`  Progress: ${written}/${i + 1}`);
      if (i < listings.length - 1) await new Promise((r) => setTimeout(r, opts.delayMs));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${listing.source_url}: ${msg}`);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`\n=== Summary ===`);
  console.log(`Written: ${written}, Skipped: ${skipped}, Errors: ${errors.length}, Duration: ${Math.round(elapsed / 1000)}s`);

  await recordScraperRun({
    scraper_name: "at-enrich",
    run_id: runId,
    started_at: new Date(startTime).toISOString(),
    finished_at: new Date().toISOString(),
    success: errors.length === 0,
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
