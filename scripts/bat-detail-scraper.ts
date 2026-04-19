/**
 * CLI: Scrape BaT detail pages for listings missing key fields.
 * Designed for GitHub Actions (30-minute budget).
 *
 * Usage:
 *   npx tsx scripts/bat-detail-scraper.ts
 *   npx tsx scripts/bat-detail-scraper.ts --limit=10 --dryRun
 *   npx tsx scripts/bat-detail-scraper.ts --preflight
 *   npx tsx scripts/bat-detail-scraper.ts --timeBudgetMs=1800000
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

import { scrapeDetail, type BaTAuction } from "../src/features/scrapers/auctions/bringATrailer";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "../src/features/scrapers/common/monitoring/record";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: 700,
    timeBudgetMs: 20 * 60 * 1000, // 20 minutes (safe margin for 30-min workflow)
    delayMs: 2500,
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

function buildStub(listing: any): BaTAuction {
  return {
    externalId: listing.id,
    platform: "BRING_A_TRAILER",
    title: listing.title || "",
    make: "",
    model: "",
    year: 0,
    mileage: null,
    mileageUnit: "miles",
    transmission: null,
    engine: null,
    exteriorColor: null,
    interiorColor: null,
    location: null,
    currentBid: null,
    bidCount: 0,
    endTime: null,
    url: listing.source_url,
    imageUrl: null,
    description: null,
    sellerNotes: null,
    status: "active",
    vin: null,
    images: [],
    reserveStatus: null,
    bodyStyle: null,
  };
}

async function main() {
  const opts = parseArgs();
  const startTime = Date.now();
  const runId = crypto.randomUUID();

  console.log(`\n=== BaT Detail Scraper ===`);
  console.log(`Limit: ${opts.limit}`);
  console.log(`Time budget: ${Math.round(opts.timeBudgetMs / 1000)}s`);
  console.log(`Delay: ${opts.delayMs}ms`);
  console.log(`Dry run: ${opts.dryRun}`);
  console.log(`Pre-flight: ${opts.preflight}\n`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Record run start
  const runtime = process.env.GITHUB_ACTIONS ? "github_actions" as const : "cli" as const;
  await markScraperRunStarted({
    scraperName: "bat-detail",
    runId,
    startedAt: new Date(startTime).toISOString(),
    runtime,
  });

  // Query BaT listings needing enrichment
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, source_url, title, images, description_text, seller_notes, engine, mileage, vin, transmission, color_exterior, color_interior, body_style")
    .eq("source", "BaT")
    .eq("status", "active")
    .or("engine.is.null,mileage.is.null,vin.is.null,transmission.is.null,color_exterior.is.null,color_interior.is.null,body_style.is.null,description_text.is.null,seller_notes.is.null,images.eq.{}")
    .order("scrape_timestamp", { ascending: true })
    .limit(opts.limit);

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${listings.length} BaT listings needing enrichment\n`);

  if (opts.preflight) {
    // Pre-flight: test first 5 to verify scrapeDetail works
    console.log("=== PRE-FLIGHT CHECK ===\n");
    const sample = listings.slice(0, 5);
    let passed = 0;
    for (const listing of sample) {
      const stub = buildStub(listing);
      try {
        const enriched = await scrapeDetail(stub);
        const hasImages = enriched.images.length > 0;
        const hasEngine = !!enriched.engine;
        const hasMileage = enriched.mileage != null;
        console.log(`  ${listing.source_url}`);
        console.log(`    images: ${enriched.images.length}, engine: ${enriched.engine || "null"}, mileage: ${enriched.mileage ?? "null"}, vin: ${enriched.vin || "null"}`);
        if (hasImages || hasEngine || hasMileage) passed++;
        await new Promise((r) => setTimeout(r, opts.delayMs));
      } catch (err: any) {
        console.log(`  ERROR: ${listing.source_url} — ${err.message}`);
      }
    }
    console.log(`\nPre-flight: ${passed}/${sample.length} returned enriched data`);
    if (passed < 3) {
      console.error("WARNING: Pre-flight check failed (<3 enriched). Investigate before batch run.");
      process.exit(1);
    }
    console.log("Pre-flight PASSED. Run without --preflight for batch execution.\n");
    await clearScraperRunActive("bat-detail");
    return;
  }

  // Batch execution
  let enriched = 0;
  let written = 0;
  const errors: string[] = [];

  for (let i = 0; i < listings.length; i++) {
    // Time budget check
    if (Date.now() - startTime > opts.timeBudgetMs) {
      console.log(`\nTime budget reached after ${i} listings.`);
      break;
    }

    const listing = listings[i];
    const stub = buildStub(listing);

    try {
      const detail = await scrapeDetail(stub);
      enriched++;

      if (opts.dryRun) {
        console.log(`  [DRY] ${listing.source_url}: images=${detail.images.length}, engine=${detail.engine}, mileage=${detail.mileage}`);
        written++;
        continue;
      }

      // Build update: only fill null fields
      const updates: Record<string, any> = {};
      if (detail.images.length > 0 && (!listing.images || listing.images.length === 0 || (listing.images.length === 1 && listing.images[0] === ""))) {
        updates.images = detail.images;
        updates.photos_count = detail.images.length;
      }
      if (!listing.engine && detail.engine) updates.engine = detail.engine;
      if (!listing.mileage && detail.mileage != null) {
        updates.mileage = detail.mileage;
        updates.mileage_unit = detail.mileageUnit || "miles";
      }
      if (!listing.vin && detail.vin) updates.vin = detail.vin;
      if (!listing.transmission && detail.transmission) updates.transmission = detail.transmission;
      if (detail.exteriorColor && !listing.color_exterior) updates.color_exterior = detail.exteriorColor;
      if (detail.interiorColor && !listing.color_interior) updates.color_interior = detail.interiorColor;
      if (!listing.body_style && detail.bodyStyle) updates.body_style = detail.bodyStyle;
      if (!listing.description_text && detail.description) updates.description_text = detail.description;
      if (!listing.seller_notes && detail.sellerNotes) updates.seller_notes = detail.sellerNotes;

      if (Object.keys(updates).length === 0) continue;

      const { error: updateErr } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", listing.id);

      if (updateErr) {
        errors.push(`${listing.id}: ${updateErr.message}`);
        continue;
      }
      written++;

      if (written % 50 === 0) {
        console.log(`  Progress: ${written} updated, ${i + 1}/${listings.length} processed`);
      }
    } catch (err: any) {
      errors.push(`${listing.source_url}: ${err.message}`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, opts.delayMs));
  }

  // Record run
  await recordScraperRun({
    scraper_name: "bat-detail",
    run_id: runId,
    started_at: new Date(startTime).toISOString(),
    finished_at: new Date().toISOString(),
    success: errors.length < listings.length / 2,
    runtime,
    duration_ms: Date.now() - startTime,
    discovered: listings.length,
    written,
    errors_count: errors.length,
    details_fetched: enriched,
    error_messages: errors.length > 0 ? errors.slice(0, 50) : undefined,
  });
  await clearScraperRunActive("bat-detail");

  console.log(`\n=== SUMMARY ===`);
  console.log(`Listings queried: ${listings.length}`);
  console.log(`Detail pages fetched: ${enriched}`);
  console.log(`DB updates: ${written}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
  if (errors.length > 0) {
    console.log(`\nFirst 10 errors:`);
    for (const err of errors.slice(0, 10)) console.log(`  - ${err}`);
  }
  console.log(`\nDone!`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
