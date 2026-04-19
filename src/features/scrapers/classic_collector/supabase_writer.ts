import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { NormalizedListing, ScrapeMeta } from "./types";
import { validateListing } from "@/features/scrapers/common/listingValidator";
import { computeSeries } from "@/features/scrapers/common/seriesEnrichment";

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
    throw new Error("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
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
        console.log(`[classic] Skipped invalid listing: ${validation.reason} — ${listing.title}`);
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

  const message = error?.message ?? "";
  const isSourceUrlConflict = /listings_source_url_key|duplicate key value violates unique constraint/i.test(message);
  if (isSourceUrlConflict) {
    const byUrl = await client
      .from("listings")
      .select("id,images")
      .eq("source_url", listing.sourceUrl)
      .limit(1);
    if (byUrl.error) throw new Error(`Supabase listings source_url lookup failed: ${byUrl.error.message}`);
    const existing = (byUrl.data as Array<{ id: string; images: string[] | null }> | null)?.[0];
    if (!existing?.id) throw new Error(`Supabase listings upsert failed: ${message}`);

    const patchedRow = {
      ...row,
      images: mergeImages(existing.images, listing.photos),
      photos_count: mergeImages(existing.images, listing.photos).length,
    };

    const patched = await client
      .from("listings")
      .update(patchedRow)
      .eq("id", existing.id)
      .select("id")
      .limit(1);
    if (patched.error) throw new Error(`Supabase listings update by source_url failed: ${patched.error.message}`);
    const patchedId = (patched.data as Array<{ id: string }> | null)?.[0]?.id ?? existing.id;
    return patchedId;
  }

  if (error) {
    throw new Error(`Supabase listings upsert failed: ${message}`);
  }
  const id = (data as Array<{ id: string }> | null)?.[0]?.id;
  if (id) return id;

  // Fallback: select the row we just upserted
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

function mergeImages(existingImages: string[] | null, nextImages: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const image of [...(existingImages ?? []), ...nextImages]) {
    if (!image || seen.has(image)) continue;
    seen.add(image);
    merged.push(image);
  }

  return merged;
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
    bid_count: listing.pricing.bidCount ?? 0,
    reserve_status: listing.reserveStatus,
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

// ─── Staleness-based listing refresh ───

export interface RefreshResult {
  checked: number;
  updated: number;
  errors: string[];
}

/**
 * Marks active Classic.com listings as "delisted" when they haven't been
 * re-seen by the discover step within `staleDays`.
 *
 * Runs AFTER discover so that re-seen listings get a fresh scrape_timestamp
 * and won't be falsely flagged.
 */
export async function refreshStaleListings(opts?: {
  staleDays?: number;
  maxUpdates?: number;
}): Promise<RefreshResult> {
  const staleDays = opts?.staleDays ?? 7;
  const maxUpdates = opts?.maxUpdates ?? 200;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { checked: 0, updated: 0, errors: ["Missing Supabase env vars"] };

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleRows, error: fetchErr } = await client
    .from("listings")
    .select("id")
    .eq("status", "active")
    .eq("source", "ClassicCom")
    .lt("scrape_timestamp", cutoff)
    .order("scrape_timestamp", { ascending: true })
    .limit(maxUpdates);

  if (fetchErr || !staleRows) {
    return { checked: 0, updated: 0, errors: [fetchErr?.message ?? "No stale rows"] };
  }

  if (staleRows.length === 0) {
    return { checked: 0, updated: 0, errors: [] };
  }

  const staleIds = staleRows.map((r) => r.id);

  const { error: updateErr, count } = await client
    .from("listings")
    .update({ status: "delisted", updated_at: new Date().toISOString() })
    .in("id", staleIds);

  if (updateErr) {
    return { checked: staleRows.length, updated: 0, errors: [updateErr.message] };
  }

  return { checked: staleRows.length, updated: count ?? staleIds.length, errors: [] };
}
