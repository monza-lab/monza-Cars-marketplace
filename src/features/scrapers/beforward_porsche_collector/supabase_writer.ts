import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setTimeout as sleep } from "node:timers/promises";

import type { NormalizedListing, ScrapeMeta } from "./types";
import { validateListing } from "@/features/scrapers/common/listingValidator";
import { computeSeries } from "@/features/scrapers/common/seriesEnrichment";
import { fetchHtml } from "./net";
import { parseDetailHtml } from "./detail";
import { mapStatus } from "./normalize";

export interface SupabaseWriter {
  upsertAll(listing: NormalizedListing, meta: ScrapeMeta, dryRun: boolean): Promise<{ listingId: string; wrote: boolean }>;
}

export function createDryRunWriter(): SupabaseWriter {
  return {
    upsertAll: async () => ({ listingId: "dry_run", wrote: false }),
  };
}

export function createSupabaseWriter(): SupabaseWriter {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = serviceRoleKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env vars.");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    upsertAll: async (listing, meta, dryRun) => {
      if (dryRun) return { listingId: "dry_run", wrote: false };

      const validation = validateListing({
        make: listing.make,
        model: listing.model,
        title: listing.title,
        year: listing.year,
      });

      if (!validation.valid) {
        console.log(`[beforward] Skipped invalid listing: ${validation.reason} — ${listing.title}`);
        return { listingId: "skipped_invalid", wrote: false };
      }

      if (validation.fixedModel) {
        listing.model = validation.fixedModel;
      }

      const listingId = await upsertListing(client, listing, meta);
      await insertPriceHistorySnapshot(client, listingId, listing, meta);
      return { listingId, wrote: true };
    },
  };
}

async function upsertListing(client: SupabaseClient, listing: NormalizedListing, meta: ScrapeMeta): Promise<string> {
  const row = mapNormalizedListingToListingsRow(listing, meta);
  const { data, error } = await client
    .from("listings")
    .upsert(row, { onConflict: "source,source_id" })
    .select("id")
    .limit(1);

  if (error) throw new Error(`Supabase listings upsert failed: ${error.message}`);
  const id = (data as Array<{ id: string }> | null)?.[0]?.id;
  if (id) return id;

  const sel = await client
    .from("listings")
    .select("id")
    .eq("source", listing.source)
    .eq("source_id", listing.sourceId)
    .limit(1);
  if (sel.error) throw new Error(`Supabase listings select failed: ${sel.error.message}`);
  const fallback = (sel.data as Array<{ id: string }> | null)?.[0]?.id;
  if (!fallback) throw new Error("Supabase listings upsert returned no id");
  return fallback;
}

export function mapNormalizedListingToListingsRow(listing: NormalizedListing, meta: ScrapeMeta): Record<string, unknown> {
  return {
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
    vin: truncate(listing.vin, 17),
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
    photos_count: listing.photosCount,
    description_text: listing.descriptionText,
    scrape_timestamp: meta.scrapeTimestamp,
    updated_at: meta.scrapeTimestamp,
    last_verified_at: new Date().toISOString(),
    data_quality_score: listing.dataQualityScore,
    title: listing.title,
    platform: listing.platform,
    current_bid: listing.pricing.currentBid,
    bid_count: 0,
    reserve_status: null,
    seller_notes: listing.sellerNotes,
    images: listing.photos,
    engine: truncate(listing.engine, 17),
    transmission: truncate(listing.transmission, 17),
    end_time: listing.endTime?.toISOString() ?? null,
    start_time: listing.startTime?.toISOString() ?? null,
    final_price: listing.finalPrice,
    location: listing.locationString,
    series: computeSeries({ make: listing.make, model: listing.model, year: listing.year, title: listing.title }),
  };
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (value.length <= max) return value;
  return value.slice(0, max);
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
  const exists = await client
    .from("price_history")
    .select("time")
    .eq("listing_id", listingId)
    .eq("time", time)
    .limit(1);
  if (exists.error) throw new Error(`Supabase price_history select failed: ${exists.error.message}`);
  if ((exists.data ?? []).length > 0) return;

  const { error } = await client.from("price_history").insert({
    time,
    listing_id: listingId,
    status: listing.status,
    price_usd: amount,
    price_eur: null,
    price_gbp: null,
  });
  if (error) throw new Error(`Supabase price_history insert failed: ${error.message}`);
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
  errors: string[];
}

/**
 * Re-fetches each active BeForward listing URL and updates the DB
 * when the listing has been removed (404) or status changed.
 */
export async function refreshActiveListings(opts?: { timeBudgetMs?: number }): Promise<RefreshResult> {
  const timeBudgetMs = opts?.timeBudgetMs ?? 60_000;
  const startTime = Date.now();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { checked: 0, updated: 0, errors: ["Missing Supabase env vars"] };

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: activeRows, error: fetchErr } = await client
    .from("listings")
    .select("id,source_url")
    .eq("status", "active")
    .eq("source", "BeForward")
    .order("scrape_timestamp", { ascending: true })
    .limit(30);

  if (fetchErr || !activeRows) {
    return { checked: 0, updated: 0, errors: [fetchErr?.message ?? "No active rows"] };
  }

  const result: RefreshResult = { checked: activeRows.length, updated: 0, errors: [] };
  const CONCURRENCY = 5;

  for (let i = 0; i < activeRows.length; i += CONCURRENCY) {
    if (Date.now() - startTime > timeBudgetMs) {
      result.errors.push(`Time budget reached after ${i} listings`);
      break;
    }

    const batch = activeRows.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(async (row) => {
      let newStatus: string | null = null;

      try {
        const html = await fetchHtml(row.source_url, 10_000);
        const detail = parseDetailHtml(html);
        const detected = mapStatus(detail.sourceStatus, detail.schemaAvailability);
        if (detected !== "active") {
          newStatus = detected;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/\b404\b/.test(msg)) {
          newStatus = "delisted";
        } else if (/\b(403|429)\b/.test(msg)) {
          return; // Ambiguous — skip
        } else {
          throw err;
        }
      }

      if (newStatus) {
        const { error: updateErr } = await client
          .from("listings")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);
        result.updated++;
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
