import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { createSupabaseWriter } from "../supabase_writer";
import type { CurrencyCode, NormalizedListing, ScrapeMeta } from "../types";
import { loadHistoricalCheckpoint, saveHistoricalCheckpoint } from "./checkpoint";
import { vehicleFilter } from "./filter_vehicle";
import type { BatCompletedItem } from "./parse_embedded_data";
import { fetchCompletedPage, mapCompletedItem, type HistoricalBatListing } from "./scraper";

export type HistoricalBatScope = "all" | "vehicle" | "sold_vehicle";

export type HistoricalBatRunConfig = {
  dryRun: boolean;
  timeFrame: string;
  scope: HistoricalBatScope;
  maxPages: number;
  startPage: number;
  checkpointPath: string;
  allowCheckpointMismatch: boolean;
};

type PageCoverage = {
  page: number;
  fetched: number;
  first_id: string | null;
  last_id: string | null;
  checksum: string;
};

type RunManifest = {
  run_id: string;
  started_at: string;
  finished_at: string;
  time_frame: string;
  scope: HistoricalBatScope;
  expected_items_total: number;
  expected_pages_total: number;
  pages_scanned: number;
  fetched: number;
  kept: number;
  inserted: number;
  updated: number;
  rejected: number;
  errors: number;
  duplicates: number;
  duplicate_ids_sample: string[];
  page_coverage: PageCoverage[];
  reconciliation: {
    observed_unique_ids: number;
    expected_items_total: number;
    expected_pages_total: number;
    progress_ratio: number;
    pages_progress_ratio: number;
    complete: boolean;
  };
  rejection_reasons: Record<string, number>;
};

function loadEnv(relPath: string): void {
  if (!existsSync(relPath)) return;
  for (const line of readFileSync(relPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function checksumIds(ids: string[]): string {
  return createHash("sha256").update(ids.join("|")).digest("hex").slice(0, 16);
}

function toCurrencyCode(value: string | null): CurrencyCode | null {
  if (!value) return null;
  if (value === "USD" || value === "EUR" || value === "GBP" || value === "JPY" || value === "CHF") return value;
  return null;
}

export function keepByScope(scope: HistoricalBatScope, mapped: HistoricalBatListing, raw: BatCompletedItem): { keep: true } | { keep: false; reason: string } {
  if (scope === "all") return { keep: true };

  const vehicle = vehicleFilter(raw);
  if (!vehicle.keep) return vehicle;

  if (scope === "sold_vehicle" && mapped.status !== "sold") {
    return { keep: false, reason: "not_sold" };
  }

  return { keep: true };
}

function mapToNormalizedListing(item: HistoricalBatListing, runMeta: ScrapeMeta): NormalizedListing {
  const raw = item.raw_payload;
  const countryRaw = String(raw.country ?? raw.country_name ?? raw.country_code_alpha3 ?? raw.country_code ?? "").trim();
  const country = countryRaw || "Unknown";

  return {
    source: "BaT",
    sourceId: item.source_id,
    sourceUrl: item.source_url,
    title: item.title,
    platform: "BRING_A_TRAILER",
    sellerNotes: null,
    endTime: null,
    startTime: null,
    reserveStatus: null,
    finalPrice: item.status === "sold" ? item.current_bid : null,
    locationString: null,
    year: item.year ?? 0,
    make: "Porsche",
    model: item.model,
    trim: null,
    bodyStyle: null,
    engine: null,
    transmission: null,
    exteriorColor: null,
    interiorColor: null,
    vin: null,
    mileageKm: null,
    mileageUnitStored: "km",
    status: item.status,
    reserveMet: null,
    listDate: null,
    saleDate: item.sale_date ?? "",
    auctionDate: item.sale_date,
    auctionHouse: "Bring a Trailer",
    descriptionText: null,
    photos: [],
    photosCount: 0,
    location: {
      locationRaw: null,
      country,
      region: null,
      city: null,
      postalCode: null,
    },
    pricing: {
      hammerPrice: item.status === "sold" ? item.current_bid : null,
      currentBid: item.current_bid,
      bidCount: null,
      originalCurrency: toCurrencyCode(item.currency),
      rawPriceText: null,
    },
    dataQualityScore: item.year ? 80 : 60,
  };
}

async function listingExists(sourceId: string): Promise<boolean> {
  const db = createDbClient();
  const existing = await db
    .from("listings")
    .select("id")
    .eq("source", "BaT")
    .eq("source_id", sourceId)
    .limit(1);
  if (existing.error) throw new Error(existing.error.message);
  return Boolean(existing.data?.[0]?.id);
}

export function assertCheckpointIdentity(input: {
  live: boolean;
  checkpoint: { scope: HistoricalBatScope; time_frame: string; items_total: number; pages_total: number; last_page: number };
  config: HistoricalBatRunConfig;
}): void {
  if (!input.live) return;
  if (input.checkpoint.last_page <= 0) return;

  const sameScope = input.checkpoint.scope === input.config.scope;
  const sameTimeFrame = input.checkpoint.time_frame === input.config.timeFrame;
  const hasTotals = input.checkpoint.items_total > 0 && input.checkpoint.pages_total > 0;

  if (sameScope && sameTimeFrame && hasTotals) return;
  if (input.config.allowCheckpointMismatch) return;

  throw new Error(
    `Checkpoint identity mismatch. checkpoint={scope:${input.checkpoint.scope},timeFrame:${input.checkpoint.time_frame},items_total:${input.checkpoint.items_total},pages_total:${input.checkpoint.pages_total}} config={scope:${input.config.scope},timeFrame:${input.config.timeFrame}}. Use --allowCheckpointMismatch to override once.`,
  );
}

export async function runHistoricalBat(config: HistoricalBatRunConfig): Promise<{ manifestPath: string; rejectsPath: string; manifest: RunManifest }> {
  loadEnv(".env.local");
  loadEnv(".env");

  const runId = `histbat_${new Date().toISOString().replace(/[-:.TZ]/g, "")}_${config.scope}_${randomUUID().slice(0, 8)}`;
  const runTimestamp = new Date().toISOString();
  const manifest: RunManifest = {
    run_id: runId,
    started_at: runTimestamp,
    finished_at: runTimestamp,
    time_frame: config.timeFrame,
    scope: config.scope,
    expected_items_total: 0,
    expected_pages_total: 0,
    pages_scanned: 0,
    fetched: 0,
    kept: 0,
    inserted: 0,
    updated: 0,
    rejected: 0,
    errors: 0,
    duplicates: 0,
    duplicate_ids_sample: [],
    page_coverage: [],
    reconciliation: {
      observed_unique_ids: 0,
      expected_items_total: 0,
      expected_pages_total: 0,
      progress_ratio: 0,
      pages_progress_ratio: 0,
      complete: false,
    },
    rejection_reasons: {},
  };

  const rejects: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  const writer = createSupabaseWriter();
  const meta: ScrapeMeta = { runId: randomUUID(), scrapeTimestamp: runTimestamp };

  const checkpoint = await loadHistoricalCheckpoint(config.checkpointPath);
  assertCheckpointIdentity({
    live: !config.dryRun,
    checkpoint,
    config,
  });

  const startPage = config.dryRun
    ? Math.max(1, config.startPage || 1)
    : (config.startPage > 0 ? config.startPage : Math.max(1, checkpoint.last_page + 1));

  let pagesTotal = Number.POSITIVE_INFINITY;
  let itemsTotal = 0;
  let boundItemsTotal = checkpoint.items_total > 0 ? checkpoint.items_total : 0;
  let boundPagesTotal = checkpoint.pages_total > 0 ? checkpoint.pages_total : 0;

  for (let page = startPage; page < startPage + config.maxPages && page <= pagesTotal; page += 1) {
    const { payload } = await fetchCompletedPage({ timeFrame: config.timeFrame, page });
    pagesTotal = payload.pages_total;
    itemsTotal = payload.items_total;

    if (boundItemsTotal === 0) boundItemsTotal = itemsTotal;
    if (boundPagesTotal === 0) boundPagesTotal = pagesTotal;

    const runTotalsMatch = boundItemsTotal === itemsTotal && boundPagesTotal === pagesTotal;
    if (!runTotalsMatch && !config.allowCheckpointMismatch) {
      throw new Error(
        `Run totals drift detected. bound={items_total:${boundItemsTotal},pages_total:${boundPagesTotal}} page=${page} endpoint={items_total:${itemsTotal},pages_total:${pagesTotal}}.`,
      );
    }

    if (!config.dryRun && checkpoint.last_page > 0 && checkpoint.items_total > 0 && checkpoint.pages_total > 0) {
      const totalsMatch = checkpoint.items_total === itemsTotal && checkpoint.pages_total === pagesTotal;
      if (!totalsMatch && !config.allowCheckpointMismatch) {
        throw new Error(
          `Checkpoint totals mismatch. checkpoint={items_total:${checkpoint.items_total},pages_total:${checkpoint.pages_total}} endpoint={items_total:${itemsTotal},pages_total:${pagesTotal}}. Use --allowCheckpointMismatch to override once.`,
        );
      }
    }

    manifest.expected_items_total = boundItemsTotal;
    manifest.expected_pages_total = boundPagesTotal;
    manifest.pages_scanned += 1;
    manifest.fetched += payload.items.length;

    const pageIds: string[] = [];

    for (const rawItem of payload.items) {
      const raw = rawItem as BatCompletedItem;
      const mapped = mapCompletedItem(rawItem);
      if (!mapped.source_id || !mapped.source_url || !mapped.title) {
        manifest.rejected += 1;
        manifest.rejection_reasons.missing_required = (manifest.rejection_reasons.missing_required ?? 0) + 1;
        rejects.push({ reason: "missing_required", page, raw });
        continue;
      }

      pageIds.push(mapped.source_id);

      if (seen.has(mapped.source_id)) {
        manifest.duplicates += 1;
        duplicateIds.add(mapped.source_id);
        continue;
      }
      seen.add(mapped.source_id);

      const scopeDecision = keepByScope(config.scope, mapped, raw);
      if (!scopeDecision.keep) {
        manifest.rejected += 1;
        manifest.rejection_reasons[scopeDecision.reason] = (manifest.rejection_reasons[scopeDecision.reason] ?? 0) + 1;
        rejects.push({ reason: scopeDecision.reason, page, raw });
        continue;
      }

      if (config.scope !== "all" && !mapped.sale_date) {
        manifest.rejected += 1;
        manifest.rejection_reasons.missing_sale_date = (manifest.rejection_reasons.missing_sale_date ?? 0) + 1;
        rejects.push({ reason: "missing_sale_date", page, raw });
        continue;
      }

      if (config.scope !== "all" && !mapped.year) {
        manifest.rejected += 1;
        manifest.rejection_reasons.missing_year = (manifest.rejection_reasons.missing_year ?? 0) + 1;
        rejects.push({ reason: "missing_year", page, raw });
        continue;
      }

      manifest.kept += 1;

      if (!config.dryRun && config.scope !== "all") {
        try {
          const existed = await listingExists(mapped.source_id);
          const normalized = mapToNormalizedListing(mapped, meta);
          await writer.upsertAll(normalized, meta, false);
          if (existed) manifest.updated += 1;
          else manifest.inserted += 1;
        } catch (error) {
          manifest.errors += 1;
          rejects.push({ reason: "write_error", page, message: error instanceof Error ? error.message : String(error), raw });
        }
      }
    }

    manifest.page_coverage.push({
      page,
      fetched: payload.items.length,
      first_id: pageIds[0] ?? null,
      last_id: pageIds[pageIds.length - 1] ?? null,
      checksum: checksumIds(pageIds),
    });

    if (!config.dryRun) {
      await saveHistoricalCheckpoint(config.checkpointPath, {
        version: 1,
        updated_at: new Date().toISOString(),
        scope: config.scope,
        time_frame: config.timeFrame,
        last_page: page,
        seen_ids_count: seen.size,
        items_total: boundItemsTotal,
        pages_total: boundPagesTotal,
      });
    }
  }

  manifest.duplicate_ids_sample = Array.from(duplicateIds).slice(0, 20);
  manifest.reconciliation = {
    observed_unique_ids: seen.size,
    expected_items_total: boundItemsTotal,
    expected_pages_total: boundPagesTotal,
    progress_ratio: boundItemsTotal > 0 ? Number((seen.size / boundItemsTotal).toFixed(6)) : 0,
    pages_progress_ratio: boundPagesTotal > 0 ? Number((manifest.page_coverage.length / boundPagesTotal).toFixed(6)) : 0,
    complete: boundItemsTotal > 0 && seen.size >= boundItemsTotal,
  };

  manifest.finished_at = new Date().toISOString();

  const root = path.resolve(process.cwd(), "var/runs/porsche_collector/historical_bat");
  const rejectRoot = path.join(root, "rejects");
  mkdirSync(rejectRoot, { recursive: true });
  const manifestPath = path.join(root, `${runId}.json`);
  const rejectsPath = path.join(rejectRoot, `${runId}.jsonl`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  writeFileSync(rejectsPath, rejects.map((entry) => JSON.stringify(entry)).join("\n") + (rejects.length ? "\n" : ""), "utf8");

  return { manifestPath, rejectsPath, manifest };
}
