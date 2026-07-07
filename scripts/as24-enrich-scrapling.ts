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

import {
  fetchAS24DetailBatchWithScrapling,
  fetchAS24DetailWithScrapling,
} from "../src/features/scrapers/autoscout24_collector/scrapling";
import type { AS24ScraplingDetailResult } from "../src/features/scrapers/autoscout24_collector/types";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "../src/features/scrapers/common/monitoring/record";
import {
  AS24_TARGET_FIELDS,
  buildUnusableAs24TargetFieldFilter,
  isUsableTargetFieldValue,
} from "../src/features/scrapers/common/enrichmentLoopPolicy";
import { parseEngineFromText } from "../src/features/scrapers/common/titleEnrichment";

type TargetFieldStatus =
  | "complete"
  | "covered_or_unavailable"
  | "detail_unavailable"
  | "blocked_unverified"
  | "dead_url";

type EnrichmentMeta = Record<string, unknown> & {
  autoscout24?: Record<string, unknown>;
};

type EnrichmentRow = {
  id: string;
  source_url: string;
  title: string | null;
  trim: string | null;
  transmission: string | null;
  body_style: string | null;
  engine: string | null;
  color_exterior: string | null;
  color_interior: string | null;
  vin: string | null;
  description_text: string | null;
  images: string[] | null;
  enrichment_meta: EnrichmentMeta | null;
};

const COVERED_EXCEPTION_STATUSES = new Set([
  "covered_or_unavailable",
  "detail_unavailable",
  "blocked_unverified",
  "dead_url",
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: 500,
    timeBudgetMs: 20 * 60 * 1000, // 20 minutes
    delayMs: 2000,
    batchSize: 12,
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
      if (key === "batchSize") opts.batchSize = parseInt(val, 10);
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

function mergeAutoscout24Meta(
  existing: EnrichmentMeta | null,
  patch: {
    detailAttemptedAt: string;
    targetFieldStatus: TargetFieldStatus;
    missingTargetFields: string[];
  },
): EnrichmentMeta {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  const existingAs24 =
    base.autoscout24 && typeof base.autoscout24 === "object" && !Array.isArray(base.autoscout24)
      ? base.autoscout24
      : {};
  return {
    ...base,
    autoscout24: {
      ...existingAs24,
      detailAttemptedAt: patch.detailAttemptedAt,
      targetFieldStatus: patch.targetFieldStatus,
      missingTargetFields: patch.missingTargetFields,
    },
  };
}

function valueAfterUpdate(row: EnrichmentRow, updates: Record<string, unknown>, field: (typeof AS24_TARGET_FIELDS)[number]): unknown {
  return Object.prototype.hasOwnProperty.call(updates, field) ? updates[field] : row[field];
}

function missingTargetFieldsAfterUpdate(row: EnrichmentRow, updates: Record<string, unknown>): string[] {
  return AS24_TARGET_FIELDS.filter((field) => !isUsableTargetFieldValue(valueAfterUpdate(row, updates, field)));
}

function hasUsableTargetUpdate(updates: Record<string, unknown>): boolean {
  return AS24_TARGET_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(updates, field) && isUsableTargetFieldValue(updates[field]));
}

function hasCoveredTargetException(row: EnrichmentRow): boolean {
  const autoscout24 = row.enrichment_meta?.autoscout24;
  if (!autoscout24 || typeof autoscout24 !== "object" || Array.isArray(autoscout24)) return false;
  const status = autoscout24.targetFieldStatus;
  return typeof status === "string" && COVERED_EXCEPTION_STATUSES.has(status);
}

async function fetchActionableTargetRows(
  supabase: ReturnType<typeof createClient>,
  limit: number,
): Promise<EnrichmentRow[]> {
  const rows: EnrichmentRow[] = [];
  const pageSize = 1000;

  for (let from = 0; rows.length < limit; from += pageSize) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, source_url, title, trim, transmission, body_style, engine, color_exterior, color_interior, vin, description_text, images, enrichment_meta")
      .eq("source", "AutoScout24")
      .eq("status", "active")
      .or(buildUnusableAs24TargetFieldFilter())
      .order("updated_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Query error: ${error.message}`);
    }

    const pageRows = (data ?? []) as EnrichmentRow[];
    rows.push(...pageRows.filter((listing) => !hasCoveredTargetException(listing)));
    if (pageRows.length < pageSize) break;
  }

  return rows.slice(0, limit);
}

async function countActionableTargetBacklog(supabase: ReturnType<typeof createClient>): Promise<number> {
  let count = 0;
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, source_url, title, trim, transmission, body_style, engine, color_exterior, color_interior, vin, description_text, images, enrichment_meta")
      .eq("source", "AutoScout24")
      .eq("status", "active")
      .or(buildUnusableAs24TargetFieldFilter())
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Backlog count query failed: ${error.message}`);
    }

    const pageRows = (data ?? []) as EnrichmentRow[];
    count += pageRows.filter((listing) => !hasCoveredTargetException(listing)).length;
    if (pageRows.length < pageSize) break;
  }

  return count;
}

async function main() {
  const opts = parseArgs();
  const startTime = Date.now();
  const runId = crypto.randomUUID();

  console.log(`\n=== AutoScout24 Scrapling Enrichment ===`);
  console.log(`Limit: ${opts.limit}`);
  console.log(`Time budget: ${Math.round(opts.timeBudgetMs / 1000)}s`);
  console.log(`Delay: ${opts.delayMs}ms`);
  console.log(`Batch size: ${opts.batchSize}`);
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

  // Query AS24 listings needing enrichment: drain target-field gaps before secondary detail gaps.
  const typedListings = await fetchActionableTargetRows(supabase, opts.limit);
  const targetFieldCandidates = typedListings.filter((listing) =>
    AS24_TARGET_FIELDS.some((field) => !isUsableTargetFieldValue(listing[field])),
  ).length;
  console.log(`Found ${typedListings.length} AS24 listings needing enrichment (${targetFieldCandidates} target-field candidates)\n`);

  if (typedListings.length === 0) {
    console.log("Nothing to enrich. Done!");
    await clearScraperRunActive("as24-enrich");
    return;
  }

  // ── Pre-flight check ──
  if (opts.preflight) {
    console.log("=== PRE-FLIGHT CHECK ===\n");
    const sample = typedListings.slice(0, 5);
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
  let targetFieldUpdates = 0;
  let written = 0;
  let skipped = 0;
  let blocked = 0;
  let deadUrls = 0;
  const errors: string[] = [];

  const batchSize = Math.max(1, Math.min(opts.batchSize, 24));

  for (let i = 0; i < typedListings.length;) {
    if (Date.now() - startTime > opts.timeBudgetMs) {
      console.log(`\nTime budget reached after ${i} listings.`);
      break;
    }

    const batch = typedListings.slice(i, i + batchSize);
    let batchDetails: Array<(AS24ScraplingDetailResult & { url?: string }) | null> | null = null;

    if (batchSize > 1) {
      batchDetails = await fetchAS24DetailBatchWithScrapling(batch.map((listing) => listing.source_url));
    }

    for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
      const listing = batch[batchIndex];

      try {
        const detail = batchDetails
          ? batchDetails[batchIndex]
          : await fetchAS24DetailWithScrapling(listing.source_url);

        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (detail) {
          detailsFetched++;
          // Only update null/empty fields
          if (detail.trim) updates.trim = truncate(detail.trim, 100);
          if (!listing.vin && detail.vin) updates.vin = truncate(detail.vin, 17);
          if (!isUsableTargetFieldValue(listing.transmission) && detail.transmission && isUsableTargetFieldValue(detail.transmission)) updates.transmission = truncate(detail.transmission, 100);
          if (!listing.body_style && detail.bodyStyle) updates.body_style = truncate(detail.bodyStyle, 100);
          if (!isUsableTargetFieldValue(listing.engine)) {
            const engineFromText = parseEngineFromText(
              [detail.trim, detail.description, listing.title].filter(Boolean).join(" "),
            );
            const engine = detail.engine ?? engineFromText;
            if (engine && isUsableTargetFieldValue(engine)) updates.engine = truncate(engine, 100);
          }
          if (!isUsableTargetFieldValue(listing.color_exterior) && detail.colorExterior && isUsableTargetFieldValue(detail.colorExterior)) updates.color_exterior = truncate(detail.colorExterior, 100);
          if (!listing.color_interior && detail.colorInterior) updates.color_interior = truncate(detail.colorInterior, 100);
          if (!listing.description_text && detail.description) updates.description_text = detail.description;
          if (detail.images.length > 0 && (!listing.images || listing.images.length <= 1)) {
            updates.images = detail.images;
            updates.photos_count = detail.images.length;
          }
        } else {
          skipped++;
        }

        const missingTargetFields = missingTargetFieldsAfterUpdate(listing, updates);
        const newFieldCount = Object.keys(updates).length - 1;
        const targetFieldStatus: TargetFieldStatus =
          missingTargetFields.length === 0
            ? "complete"
            : detail
              ? (newFieldCount > 0 ? "covered_or_unavailable" : "detail_unavailable")
              : "blocked_unverified";
        if (!detail) blocked++;
        updates.enrichment_meta = mergeAutoscout24Meta(listing.enrichment_meta, {
          detailAttemptedAt: updates.updated_at as string,
          targetFieldStatus,
          missingTargetFields,
        });

        if (!opts.dryRun) {
          const { error: updateErr } = await supabase
            .from("listings")
            .update(updates)
            .eq("id", listing.id);

          if (updateErr) {
            errors.push(`${listing.id}: ${updateErr.message}`);
          } else {
            written++;
            if (hasUsableTargetUpdate(updates)) targetFieldUpdates++;
          }
        } else {
          console.log(`  [DRY] ${listing.source_url}: trim=${detail?.trim || "null"}, vin=${detail?.vin || "null"}`);
          written++;
        }

        if (written > 0 && written % 25 === 0) {
          console.log(`  Progress: ${written} updated, ${i + batchIndex + 1}/${typedListings.length} processed`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${listing.source_url}: ${msg}`);
      }
    }

    i += batch.length;

    // Rate limit
    await new Promise((r) => setTimeout(r, opts.delayMs));
  }

  const remainingTargetFieldBacklog = await countActionableTargetBacklog(supabase);

  // Record run
  await recordScraperRun({
    scraper_name: "as24-enrich",
    run_id: runId,
    started_at: new Date(startTime).toISOString(),
    finished_at: new Date().toISOString(),
    success: errors.length < typedListings.length / 2,
    runtime,
    duration_ms: Date.now() - startTime,
    discovered: typedListings.length,
    written,
    errors_count: errors.length,
    details_fetched: detailsFetched,
    error_messages: errors.length > 0 ? errors.slice(0, 50) : undefined,
  });
  await clearScraperRunActive("as24-enrich");

  console.log(`\n=== SUMMARY ===`);
  console.log(`Listings queried: ${typedListings.length}`);
  console.log(`Target-field candidates: ${targetFieldCandidates}`);
  console.log(`Target-field updates: ${targetFieldUpdates}`);
  console.log(`Detail pages fetched: ${detailsFetched}`);
  console.log(`Remaining target-field backlog: ${remainingTargetFieldBacklog ?? "unknown"}`);
  console.log(`DB updates: ${written}`);
  console.log(`Blocked/unverified: ${blocked}`);
  console.log(`Dead URLs: ${deadUrls}`);
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
