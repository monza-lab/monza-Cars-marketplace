/**
 * CLI: Enrich Classic.com summary-only listings via Scrapling.
 * Designed for GitHub Actions (20-minute budget).
 *
 * Finds listings where description_text IS NULL (proxy for unenriched),
 * fetches detail pages with Scrapling (no browser, no proxy needed),
 * and updates only null fields in the DB.
 *
 * Usage:
 *   npx tsx scripts/classic-enrich-scrapling.ts
 *   npx tsx scripts/classic-enrich-scrapling.ts --limit=100 --dryRun
 *   npx tsx scripts/classic-enrich-scrapling.ts --preflight
 *   npx tsx scripts/classic-enrich-scrapling.ts --timeBudgetMs=1200000
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local for local runs
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

import { fetchClassicDetailWithScrapling } from "../src/features/scrapers/classic_collector/scrapling";
import { parseClassicDetailContent } from "../src/features/scrapers/classic_collector/detail";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "../src/features/scrapers/common/monitoring/record";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: 500,
    timeBudgetMs: 20 * 60 * 1000, // 20 minutes
    delayMs: 2000,
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

function truncate(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  return value.length <= max ? value : value.slice(0, max);
}

async function main() {
  const opts = parseArgs();
  const startTime = Date.now();
  const runId = crypto.randomUUID();

  console.log(`\n=== Classic.com Scrapling Enrichment ===`);
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

  const runtime = process.env.GITHUB_ACTIONS ? "github_actions" as const : "cli" as const;
  await markScraperRunStarted({
    scraperName: "classic-enrich",
    runId,
    startedAt: new Date(startTime).toISOString(),
    runtime,
  });

  // Query Classic.com listings needing enrichment:
  // description_text IS NULL = summary-only (never detail-fetched)
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, source_url, title, images, description_text, engine, mileage, vin, transmission, color_exterior, color_interior, body_style, photos_count, hammer_price, location, seller_notes")
    .eq("source", "ClassicCom")
    .eq("status", "active")
    .is("description_text", null)
    .order("updated_at", { ascending: true })
    .limit(opts.limit);

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${listings.length} Classic.com listings needing enrichment\n`);

  if (listings.length === 0) {
    console.log("Nothing to enrich. Done!");
    await clearScraperRunActive("classic-enrich");
    return;
  }

  if (opts.preflight) {
    console.log("=== PRE-FLIGHT CHECK ===\n");
    const sample = listings.slice(0, 5);
    let passed = 0;
    for (const listing of sample) {
      try {
        const content = await fetchClassicDetailWithScrapling(listing.source_url);
        if (content) {
          const detail = parseClassicDetailContent(content, listing.source_url);
          const hasEngine = !!detail.raw.engine;
          const hasImages = detail.raw.images.length > 0;
          const hasDesc = !!detail.raw.description;
          console.log(`  ${listing.source_url}`);
          console.log(`    images: ${detail.raw.images.length}, engine: ${detail.raw.engine || "null"}, vin: ${detail.raw.vin || "null"}, desc: ${hasDesc}`);
          if (hasImages || hasEngine || hasDesc) passed++;
        } else {
          console.log(`  SKIP: ${listing.source_url} — Scrapling returned null`);
        }
        await new Promise((r) => setTimeout(r, opts.delayMs));
      } catch (err: any) {
        console.log(`  ERROR: ${listing.source_url} — ${err.message}`);
      }
    }
    console.log(`\nPre-flight: ${passed}/${sample.length} returned enriched data`);
    if (passed < 2) {
      console.error("WARNING: Pre-flight check failed (<2 enriched). Investigate before batch run.");
      process.exit(1);
    }
    console.log("Pre-flight PASSED. Run without --preflight for batch execution.\n");
    await clearScraperRunActive("classic-enrich");
    return;
  }

  // Batch execution
  let enriched = 0;
  let written = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < listings.length; i++) {
    if (Date.now() - startTime > opts.timeBudgetMs) {
      console.log(`\nTime budget reached after ${i} listings.`);
      break;
    }

    const listing = listings[i];

    try {
      const content = await fetchClassicDetailWithScrapling(listing.source_url);
      if (!content) {
        // Mark as attempted so we don't re-query it
        if (!opts.dryRun) {
          await supabase
            .from("listings")
            .update({ description_text: "", updated_at: new Date().toISOString() })
            .eq("id", listing.id);
        }
        skipped++;
        continue;
      }

      const detail = parseClassicDetailContent(content, listing.source_url);
      enriched++;

      if (opts.dryRun) {
        console.log(`  [DRY] ${listing.source_url}: images=${detail.raw.images.length}, engine=${detail.raw.engine}, vin=${detail.raw.vin}`);
        written++;
        continue;
      }

      // Build update: only fill null/empty fields
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
      };

      if (detail.raw.description) {
        updates.description_text = detail.raw.description;
      }
      if (!listing.engine && detail.raw.engine) {
        updates.engine = truncate(detail.raw.engine, 17);
      }
      if (!listing.transmission && detail.raw.transmission) {
        updates.transmission = truncate(detail.raw.transmission, 17);
      }
      if (!listing.vin && detail.raw.vin) {
        updates.vin = truncate(detail.raw.vin, 17);
      }
      if (!listing.mileage && detail.raw.mileage != null) {
        const MILES_TO_KM = 1.609344;
        const unit = (detail.raw.mileageUnit ?? "miles").toLowerCase();
        const km = unit === "km" || unit === "kilometers"
          ? Math.round(detail.raw.mileage)
          : Math.round(detail.raw.mileage * MILES_TO_KM);
        updates.mileage = km;
        updates.mileage_unit = "km";
      }
      if (!listing.color_exterior && detail.raw.exteriorColor) {
        updates.color_exterior = detail.raw.exteriorColor;
      }
      if (!listing.color_interior && detail.raw.interiorColor) {
        updates.color_interior = detail.raw.interiorColor;
      }
      if (!listing.body_style && detail.raw.bodyStyle) {
        updates.body_style = detail.raw.bodyStyle;
      }
      if (!listing.seller_notes && detail.raw.description) {
        updates.seller_notes = detail.raw.description;
      }
      if (detail.raw.images.length > 0 && (!listing.images || listing.images.length <= 1)) {
        updates.images = detail.raw.images;
        updates.photos_count = detail.raw.images.length;
      }
      if (!listing.hammer_price && detail.raw.hammerPrice) {
        updates.hammer_price = detail.raw.hammerPrice;
        updates.final_price = detail.raw.hammerPrice;
        updates.original_currency = "USD";
      }
      if (!listing.hammer_price && detail.raw.price) {
        updates.hammer_price = detail.raw.price;
        updates.current_bid = detail.raw.price;
        updates.original_currency = "USD";
      }
      if (!listing.location && detail.raw.location) {
        updates.location = detail.raw.location;
      }

      // If no description extracted, mark as attempted
      if (!updates.description_text) {
        updates.description_text = "";
      }

      const newFieldCount = Object.keys(updates).length - 2; // minus updated_at, last_verified_at
      if (newFieldCount === 0) {
        skipped++;
        continue;
      }

      const { error: updateErr } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", listing.id);

      if (updateErr) {
        errors.push(`${listing.id}: ${updateErr.message}`);
        continue;
      }
      written++;

      if (written % 25 === 0) {
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
    scraper_name: "classic-enrich",
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
  await clearScraperRunActive("classic-enrich");

  console.log(`\n=== SUMMARY ===`);
  console.log(`Listings queried: ${listings.length}`);
  console.log(`Detail pages fetched: ${enriched}`);
  console.log(`DB updates: ${written}`);
  console.log(`Skipped (no data): ${skipped}`);
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
