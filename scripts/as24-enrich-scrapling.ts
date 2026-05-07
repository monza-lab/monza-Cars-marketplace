/**
 * CLI: Enrich AutoScout24 listings via Scrapling.
 * Designed for GitHub Actions (20-minute budget).
 *
 * Finds listings where trim IS NULL (proxy for unenriched),
 * fetches detail pages with Scrapling, and updates only null fields.
 * Always sets trim="" after attempting (sentinel to prevent re-processing).
 *
 * Usage:
 *   npx tsx scripts/as24-enrich-scrapling.ts
 *   npx tsx scripts/as24-enrich-scrapling.ts --limit=100 --dryRun
 *   npx tsx scripts/as24-enrich-scrapling.ts --preflight
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

import { fetchAS24DetailWithScrapling } from "../src/features/scrapers/autoscout24_collector/scrapling";
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
  if (value == null) return null;
  return value.length <= max ? value : value.slice(0, max);
}

async function main() {
  const opts = parseArgs();
  const startTime = Date.now();
  const runId = crypto.randomUUID();

  console.log(`\n=== AutoScout24 Scrapling Enrichment ===`);
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
    scraperName: "as24-enrich",
    runId,
    startedAt: new Date(startTime).toISOString(),
    runtime,
  });

  // Query AS24 listings needing enrichment: trim IS NULL = never attempted
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, source_url, title, trim, transmission, body_style, engine, color_exterior, color_interior, vin, description_text, images")
    .eq("source", "AutoScout24")
    .eq("status", "active")
    .is("trim", null)
    .order("updated_at", { ascending: true })
    .limit(opts.limit);

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${listings.length} AS24 listings needing enrichment\n`);

  if (listings.length === 0) {
    console.log("Nothing to enrich. Done!");
    await clearScraperRunActive("as24-enrich");
    return;
  }

  // ── Pre-flight check ──
  if (opts.preflight) {
    console.log("=== PRE-FLIGHT CHECK ===\n");
    const sample = listings.slice(0, 5);
    let passed = 0;
    for (const listing of sample) {
      try {
        const detail = await fetchAS24DetailWithScrapling(listing.source_url);
        if (detail) {
          const hasData = !!(detail.trim || detail.vin || detail.engine || detail.description);
          console.log(`  ${listing.source_url}`);
          console.log(`    trim: ${detail.trim || "null"}, vin: ${detail.vin || "null"}, engine: ${detail.engine || "null"}, images: ${detail.images.length}`);
          if (hasData) passed++;
        } else {
          console.log(`  SKIP: ${listing.source_url} — Scrapling returned null`);
        }
        await new Promise((r) => setTimeout(r, opts.delayMs));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  ERROR: ${listing.source_url} — ${msg}`);
      }
    }
    console.log(`\nPre-flight: ${passed}/${sample.length} returned enriched data`);
    if (passed < 2) {
      console.error("WARNING: Pre-flight check failed (<2 enriched). Investigate before batch run.");
      process.exit(1);
    }
    console.log("Pre-flight PASSED.\n");
    await clearScraperRunActive("as24-enrich");
    return;
  }

  // ── Batch execution ──
  let detailsFetched = 0;
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
      const detail = await fetchAS24DetailWithScrapling(listing.source_url);

      // Always set trim to mark as attempted (sentinel — prevents infinite re-processing)
      const updates: Record<string, unknown> = {
        trim: "",
        updated_at: new Date().toISOString(),
      };

      if (detail) {
        detailsFetched++;
        // Only update null/empty fields
        if (detail.trim) updates.trim = truncate(detail.trim, 100);
        if (!listing.vin && detail.vin) updates.vin = truncate(detail.vin, 17);
        if (!listing.transmission && detail.transmission) updates.transmission = truncate(detail.transmission, 100);
        if (!listing.body_style && detail.bodyStyle) updates.body_style = truncate(detail.bodyStyle, 100);
        if (!listing.engine && detail.engine) updates.engine = truncate(detail.engine, 100);
        if (!listing.color_exterior && detail.colorExterior) updates.color_exterior = truncate(detail.colorExterior, 100);
        if (!listing.color_interior && detail.colorInterior) updates.color_interior = truncate(detail.colorInterior, 100);
        if (!listing.description_text && detail.description) updates.description_text = detail.description;
        if (detail.images.length > 0 && (!listing.images || listing.images.length <= 1)) {
          updates.images = detail.images;
          updates.photos_count = detail.images.length;
        }
      } else {
        skipped++;
      }

      if (!opts.dryRun) {
        const { error: updateErr } = await supabase
          .from("listings")
          .update(updates)
          .eq("id", listing.id);

        if (updateErr) {
          errors.push(`${listing.id}: ${updateErr.message}`);
        } else {
          written++;
        }
      } else {
        console.log(`  [DRY] ${listing.source_url}: trim=${detail?.trim || "null"}, vin=${detail?.vin || "null"}`);
        written++;
      }

      if (written > 0 && written % 25 === 0) {
        console.log(`  Progress: ${written} updated, ${i + 1}/${listings.length} processed`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${listing.source_url}: ${msg}`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, opts.delayMs));
  }

  // Record run
  await recordScraperRun({
    scraper_name: "as24-enrich",
    run_id: runId,
    started_at: new Date(startTime).toISOString(),
    finished_at: new Date().toISOString(),
    success: errors.length < listings.length / 2,
    runtime,
    duration_ms: Date.now() - startTime,
    discovered: listings.length,
    written,
    errors_count: errors.length,
    details_fetched: detailsFetched,
    error_messages: errors.length > 0 ? errors.slice(0, 50) : undefined,
  });
  await clearScraperRunActive("as24-enrich");

  console.log(`\n=== SUMMARY ===`);
  console.log(`Listings queried: ${listings.length}`);
  console.log(`Detail pages fetched: ${detailsFetched}`);
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
