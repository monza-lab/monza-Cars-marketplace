import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setTimeout as sleep } from "node:timers/promises";

import type { NormalizedListing, ScrapeMeta } from "./types";
import { validateListing } from "@/features/scrapers/common/listingValidator";
import { computeSeries } from "@/features/scrapers/common/seriesEnrichment";
import { classifyVehicleIdentifier } from "@/features/scrapers/common/vehicleIdentifier";
import { fetchHtml } from "./net";
import { parseDetailHtml } from "./detail";
import { mapStatus } from "./normalize";
import { RARITY_SCORE_VERSION, scoreListingRarity } from "@/lib/listingRarity";

export interface SupabaseWriteResult {
  listingId: string;
  wrote: boolean;
  previousStatus?: string | null;
  currentStatus?: string | null;
}

export interface SupabaseWriter {
  upsertAll(listing: NormalizedListing, meta: ScrapeMeta, dryRun: boolean): Promise<SupabaseWriteResult>;
  healthCheck(): Promise<void>;
}

export interface BeForwardCoverageState {
  nextPage: number;
  sourceTotalPages: number | null;
  completedAt: string | null;
}

const DEFAULT_COVERAGE_STATE: BeForwardCoverageState = {
  nextPage: 1,
  sourceTotalPages: null,
  completedAt: null,
};

const COVERAGE_STATE_KEY = "beforward_coverage";

export function createDryRunWriter(): SupabaseWriter {
  return {
    upsertAll: async () => ({ listingId: "dry_run", wrote: false }),
    healthCheck: async () => {},
  };
}

export function createSupabaseWriter(): SupabaseWriter {
  const client = createServiceClient();

  return {
    healthCheck: async () => {
      const { error } = await Promise.race([
        client.from("listings").select("id").limit(1),
        sleep(15_000).then(() => ({ error: { message: "DB health check timed out after 15s — is the Supabase project paused?" } })),
      ]);
      if (error) throw new Error(`Supabase health check failed: ${error.message}`);
    },
    upsertAll: async (listing, meta, dryRun) => {
      if (dryRun) return { listingId: "dry_run", wrote: false };

      const validation = validateListing({
        make: listing.make,
        model: listing.model,
        title: listing.title,
        year: listing.year,
      });

      if (!validation.valid && !isAcceptedBeForwardOtherBucket(listing, validation.reason)) {
        console.log(`[beforward] Skipped invalid listing: ${validation.reason} — ${listing.title}`);
        return { listingId: "skipped_invalid", wrote: false };
      }

      if (!validation.valid) {
        listing.model = "OTHER";
      }

      if (validation.fixedModel) {
        listing.model = validation.fixedModel;
      }

      const writeResult = await upsertListing(client, listing, meta);
      await insertPriceHistorySnapshot(client, writeResult.listingId, listing, meta);
      return { ...writeResult, wrote: true };
    },
  };
}

function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = serviceRoleKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env vars.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function upsertListing(
  client: SupabaseClient,
  listing: NormalizedListing,
  meta: ScrapeMeta,
): Promise<{ listingId: string; previousStatus: string | null; currentStatus: string }> {
  const row = mapNormalizedListingToListingsRow(listing, meta);
  return retryOnTimeout(async () => {
    const previous = await client
      .from("listings")
      .select("status")
      .eq("source", listing.source)
      .eq("source_id", listing.sourceId)
      .limit(1);
    if (previous.error) throw new Error(`Supabase listings previous status select failed: ${previous.error.message}`);
    const previousStatus = ((previous.data as Array<{ status: string | null }> | null)?.[0]?.status) ?? null;

    const { data, error } = await client
      .from("listings")
      .upsert(row, { onConflict: "source,source_id" })
      .select("id")
      .limit(1);

    if (error) throw new Error(`Supabase listings upsert failed: ${error.message}`);
    const id = (data as Array<{ id: string }> | null)?.[0]?.id;
    if (id) return { listingId: id, previousStatus, currentStatus: listing.status };

    const sel = await client
      .from("listings")
      .select("id")
      .eq("source", listing.source)
      .eq("source_id", listing.sourceId)
      .limit(1);
    if (sel.error) throw new Error(`Supabase listings select failed: ${sel.error.message}`);
    const fallback = (sel.data as Array<{ id: string }> | null)?.[0]?.id;
    if (!fallback) throw new Error("Supabase listings upsert returned no id");
    return { listingId: fallback, previousStatus, currentStatus: listing.status };
  });
}

export async function loadCoverageState(): Promise<BeForwardCoverageState> {
  const client = createServiceClient();
  const { data, error } = await client
    .from("scraper_state")
    .select("state")
    .eq("scraper_name", COVERAGE_STATE_KEY)
    .maybeSingle();

  if (error) throw new Error(`Supabase scraper_state select failed: ${error.message}`);
  return coerceCoverageState((data as { state?: unknown } | null)?.state);
}

export async function saveCoverageState(state: BeForwardCoverageState): Promise<void> {
  const client = createServiceClient();
  const { error } = await client.from("scraper_state").upsert({
    scraper_name: COVERAGE_STATE_KEY,
    state,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Supabase scraper_state upsert failed: ${error.message}`);
}

function coerceCoverageState(raw: unknown): BeForwardCoverageState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_COVERAGE_STATE };
  const state = raw as Partial<BeForwardCoverageState>;
  return {
    nextPage: typeof state.nextPage === "number" && state.nextPage > 0 ? Math.floor(state.nextPage) : 1,
    sourceTotalPages: typeof state.sourceTotalPages === "number" && state.sourceTotalPages > 0
      ? Math.floor(state.sourceTotalPages)
      : null,
    completedAt: typeof state.completedAt === "string" ? state.completedAt : null,
  };
}

function isAcceptedBeForwardOtherBucket(listing: NormalizedListing, reason: string | undefined): boolean {
  return listing.source === "BeForward"
    && listing.model === "OTHER"
    && reason === "unresolvable-model:OTHER"
    && (/\/porsche-others(?:\/|$)/i.test(listing.sourceUrl) || /\bPORSCHE\s+(?:PORSCHE\s+)?OTHERS\b/i.test(listing.title));
}

export function mapNormalizedListingToListingsRow(listing: NormalizedListing, meta: ScrapeMeta): Record<string, unknown> {
  const rarity = scoreListingRarity({
    year: listing.year,
    model: listing.model,
    trim: listing.trim,
    title: listing.title,
    descriptionText: listing.descriptionText,
    sellerNotes: listing.sellerNotes,
    mileage: listing.mileageKm,
    mileageUnit: listing.mileageUnitStored,
  });
  const vinIdentifier = classifyVehicleIdentifier(listing.vin, "VIN");
  const row: Record<string, unknown> = {
    source: listing.source,
    source_id: listing.sourceId,
    source_url: listing.sourceUrl,
    year: listing.year,
    make: truncate(listing.make, 32),
    model: truncate(listing.model, 17),
    trim: truncate(listing.trim, 64),
    body_style: listing.bodyStyle,
    color_exterior: listing.exteriorColor,
    color_interior: listing.interiorColor,
    mileage: listing.mileageKm,
    mileage_unit: listing.mileageUnitStored,
    vin: vinIdentifier?.kind === "vin_17" ? vinIdentifier.normalized : null,
    hammer_price: listing.pricing.hammerPrice,
    original_currency: listing.pricing.originalCurrency,
    buyers_premium_percent: null,
    country: listing.location.country,
    region: listing.location.region,
    city: listing.location.city,
    auction_house: listing.auctionHouse,
    auction_date: listing.auctionDate,
    sale_date: listing.saleDate,
    list_date: listing.listDate,
    status: listing.status,
    reserve_met: listing.reserveMet,
    description_text: listing.descriptionText,
    scrape_timestamp: meta.scrapeTimestamp,
    updated_at: meta.scrapeTimestamp,
    last_verified_at: new Date().toISOString(),
    data_quality_score: listing.dataQualityScore,
    title: listing.title,
    platform: listing.platform,
    current_bid: listing.pricing.currentBid,
    bid_count: 0,
    rarity_score: rarity.score,
    rarity_tier: rarity.tier,
    rarity_signals_json: rarity.signals,
    rarity_scored_at: meta.scrapeTimestamp,
    rarity_score_version: RARITY_SCORE_VERSION,
    reserve_status: null,
    seller_notes: listing.sellerNotes,
    engine: truncate(listing.engine, 100),
    transmission: truncate(listing.transmission, 100),
    end_time: listing.endTime?.toISOString() ?? null,
    start_time: listing.startTime?.toISOString() ?? null,
    final_price: listing.finalPrice,
    location: listing.locationString,
    series: computeSeries({ make: listing.make, model: listing.model, year: listing.year, title: listing.title }),
  };

  // Only include images/photos_count when we actually have photos.
  // summary-only discovery produces photos=[] — including that in the upsert
  // would overwrite previously backfilled images on every cron run.
  if (listing.photos.length > 0) {
    row.images = listing.photos;
    row.photos_count = listing.photosCount;
  }
  if (listing.sourceVehicleIdentifier) {
    row.enrichment_meta = {
      beforward: {
        vehicleIdentifier: listing.sourceVehicleIdentifier,
      },
    };
  }

  return row;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (value.length <= max) return value;
  return value.slice(0, max);
}

const TIMEOUT_RE = /statement timeout|too many connections|connection terminated|502 Bad Gateway|503 Service|504 Gateway/i;

async function retryOnTimeout<T>(fn: () => Promise<T>, retries = 3, baseDelayMs = 2000): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= retries || !TIMEOUT_RE.test(msg)) throw err;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
}

async function insertPriceHistorySnapshot(
  client: SupabaseClient,
  listingId: string,
  listing: NormalizedListing,
  meta: ScrapeMeta,
): Promise<void> {
  const amount = listing.pricing.currentBid;
  if (!amount || amount <= 0) return;

  const time = truncateIsoToHour(meta.scrapeTimestamp);
  await retryOnTimeout(async () => {
    const { error } = await client.from("price_history").upsert({
      time,
      listing_id: listingId,
      status: listing.status,
      price_usd: amount,
      price_eur: null,
      price_gbp: null,
    }, {
      onConflict: "listing_id,time",
    });
    if (error) throw new Error(`Supabase price_history upsert failed: ${error.message}`);
  });
}

function truncateIsoToHour(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:00:00.000Z`;
}

// ─── Active listing status refresh ───

export interface RefreshResult {
  checked: number;
  updated: number;
  terminalized: number;
  errors: string[];
}

/**
 * Re-fetches each active BeForward listing URL and updates the DB
 * when the listing has been removed (404) or status changed.
 */
export async function refreshActiveListings(opts?: { timeBudgetMs?: number }): Promise<RefreshResult> {
  const timeBudgetMs = opts?.timeBudgetMs ?? 60_000;
  const startTime = Date.now();

  let client: SupabaseClient;
  try {
    client = createServiceClient();
  } catch {
    return { checked: 0, updated: 0, terminalized: 0, errors: ["Missing Supabase env vars"] };
  }

  const { data: activeRows, error: fetchErr } = await client
    .from("listings")
    .select("id,source_url")
    .eq("status", "active")
    .eq("source", "BeForward")
    .order("scrape_timestamp", { ascending: true })
    .limit(30);

  if (fetchErr || !activeRows) {
    return { checked: 0, updated: 0, terminalized: 0, errors: [fetchErr?.message ?? "No active rows"] };
  }

  const result: RefreshResult = { checked: activeRows.length, updated: 0, terminalized: 0, errors: [] };
  const CONCURRENCY = 5;

  for (let i = 0; i < activeRows.length; i += CONCURRENCY) {
    if (Date.now() - startTime > timeBudgetMs) {
      result.errors.push(`Time budget reached after ${i} listings`);
      break;
    }

    const batch = activeRows.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(async (row) => {
      let newStatus: "active" | "sold" | "unsold" | "delisted" | null = null;

      try {
        const html = await fetchHtml(row.source_url, 10_000);
        if (!isReliableBeForwardDetailHtml(html)) return;
        const detail = parseDetailHtml(html);
        if (!hasExplicitStatusEvidence(detail.sourceStatus, detail.schemaAvailability)) return;
        const detected = mapStatus(detail.sourceStatus, detail.schemaAvailability);
        newStatus = detected;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/\b(404|410)\b/.test(msg)) {
          newStatus = "delisted";
        } else if (/\b(403|429)\b/.test(msg)) {
          return; // Ambiguous — skip
        } else {
          throw err;
        }
      }

      if (newStatus) {
        const now = new Date().toISOString();
        const { error: updateErr } = await client
          .from("listings")
          .update({ status: newStatus, updated_at: now, last_verified_at: now })
          .eq("id", row.id);
        if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);
        result.updated++;
        if (newStatus !== "active") result.terminalized++;
      }
    }));

    for (let j = 0; j < settled.length; j++) {
      const s = settled[j];
      if (s.status === "rejected") {
        result.errors.push(`Refresh failed for ${batch[j].source_url}: ${s.reason}`);
      }
    }

    // Brief pause between batches to avoid rate limits
    await sleep(1_000);
  }

  return result;
}

export function isReliableBeForwardDetailHtml(html: string): boolean {
  return html.length > 50_000 && /beforward/i.test(html) && /schema\.org|ga_sale_status|vehicle/i.test(html);
}

export function hasExplicitStatusEvidence(sourceStatus: string | null, schemaAvailability: string | null): boolean {
  const src = (sourceStatus ?? "").trim().toLowerCase();
  const availability = (schemaAvailability ?? "").trim().toLowerCase();
  return src === "in-stock"
    || src === "sold"
    || src === "reserved"
    || src === "out-of-stock"
    || availability.includes("instock")
    || availability.includes("outofstock")
    || availability.includes("soldout");
}
