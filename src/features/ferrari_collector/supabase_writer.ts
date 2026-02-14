import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { NormalizedListing, NormalizedListingStatus, ScrapeMeta } from "./types";
import { sha256Hex } from "./normalize";

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
    throw new Error(
      "Missing Supabase env. Expected NEXT_PUBLIC_SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  if (!serviceRoleKey) {
    // This is safe to log; it does not include any secret material.
    console.warn(
      "[ferrari_collector] SUPABASE_SERVICE_ROLE_KEY not set; falling back to NEXT_PUBLIC_SUPABASE_ANON_KEY. Writes may fail if RLS is enabled.",
    );
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    upsertAll: async (listing, meta, dryRun) => {
      if (dryRun) return { listingId: "dry_run", wrote: false };
      const listingId = await upsertListing(client, listing, meta);

      await Promise.allSettled([
        upsertPricing(client, listingId, listing, meta),
        upsertAuctionInfo(client, listingId, listing, meta),
        upsertLocationData(client, listingId, listing, meta),
        upsertVehicleSpecs(client, listingId, listing, meta),
        upsertProvenanceData(client, listingId, listing, meta),
      ]);

      await upsertPhotos(client, listingId, listing);
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
  if (!id) {
    // fallback select
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
  return id;
}

export function mapNormalizedListingToListingsRow(listing: NormalizedListing, meta: ScrapeMeta): Record<string, unknown> {
  return {
    source: listing.source,
    source_id: listing.sourceId,
    source_url: listing.sourceUrl,
    year: listing.year,
    make: listing.make,
    model: listing.model,
    trim: listing.trim,
    body_style: listing.bodyStyle,
    color_exterior: listing.exteriorColor,
    color_interior: listing.interiorColor,
    mileage: listing.mileageKm,
    mileage_unit: listing.mileageUnitStored,
    vin: listing.vin,
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
    data_quality_score: listing.dataQualityScore,
  };
}

async function upsertPricing(client: SupabaseClient, listingId: string, listing: NormalizedListing, meta: ScrapeMeta): Promise<void> {
  const hammer = listing.pricing.hammerPrice;
  const currency = listing.pricing.originalCurrency;
  if (hammer === null && currency === null) return;

  const row = {
    listing_id: listingId,
    hammer_price_original: hammer,
    original_currency: currency,
    buyers_premium_percent: null,
    updated_at: meta.scrapeTimestamp,
  };

  const { error } = await client.from("pricing").upsert(row, { onConflict: "listing_id" });
  if (error) throw new Error(`Supabase pricing upsert failed: ${error.message}`);
}

async function upsertAuctionInfo(client: SupabaseClient, listingId: string, listing: NormalizedListing, _meta: ScrapeMeta): Promise<void> {
  const row = {
    listing_id: listingId,
    auction_house: listing.auctionHouse,
    auction_date: listing.auctionDate,
    lot_number: listing.sourceId,
    reserve_met: listing.reserveMet,
    hammer_price: listing.pricing.hammerPrice,
    status: mapAuctionInfoStatus(listing.status),
    number_of_bids: listing.pricing.bidCount,
  };

  const { error } = await client.from("auction_info").upsert(row, { onConflict: "listing_id" });
  if (error) throw new Error(`Supabase auction_info upsert failed: ${error.message}`);
}

function mapAuctionInfoStatus(status: NormalizedListingStatus): string | null {
  if (status === "sold") return "sold";
  if (status === "unsold") return "unsold";
  if (status === "delisted") return "withdrawn";
  return null;
}

async function upsertLocationData(client: SupabaseClient, listingId: string, listing: NormalizedListing, meta: ScrapeMeta): Promise<void> {
  const row = {
    listing_id: listingId,
    country: listing.location.country,
    region: listing.location.region,
    city: listing.location.city,
    postal_code: listing.location.postalCode,
  };
  const { error } = await client.from("location_data").upsert(row, { onConflict: "listing_id" });
  if (error) throw new Error(`Supabase location_data upsert failed: ${error.message}`);
}

async function upsertVehicleSpecs(
  client: SupabaseClient,
  listingId: string,
  listing: NormalizedListing,
  _meta: ScrapeMeta,
): Promise<void> {
  const row: Record<string, unknown> = {
    listing_id: listingId,
    transmission: listing.transmission ?? null,
    engine: listing.engine ?? null,
    body_style: listing.bodyStyle ?? null,
  };

  const { error } = await client.from("vehicle_specs").upsert(row, { onConflict: "listing_id" });
  if (error) {
    console.warn(`[ferrari_collector] vehicle_specs upsert failed (non-fatal): ${error.message}`);
  }
}

async function upsertProvenanceData(
  client: SupabaseClient,
  listingId: string,
  _listing: NormalizedListing,
  _meta: ScrapeMeta,
): Promise<void> {
  // Minimal placeholder row to keep 1:1 table aligned; avoid guessing provenance.
  const row: Record<string, unknown> = {
    listing_id: listingId,
  };

  const { error } = await client.from("provenance_data").upsert(row, { onConflict: "listing_id" });
  if (error) throw new Error(`Supabase provenance_data upsert failed: ${error.message}`);
}

async function upsertPhotos(client: SupabaseClient, listingId: string, listing: NormalizedListing): Promise<void> {
  if (!listing.photos || listing.photos.length === 0) return;

  const existing = await client
    .from("photos_media")
    .select("photo_url")
    .eq("listing_id", listingId);
  if (existing.error) {
    throw new Error(`Supabase photos_media select failed: ${existing.error.message}`);
  }
  const existingSet = new Set((existing.data ?? []).map((r: { photo_url: string }) => r.photo_url));

  const toInsert = listing.photos
    .map((url, idx) => ({ url, idx }))
    .filter(({ url }) => url && !existingSet.has(url))
    .map(({ url, idx }) => ({
      listing_id: listingId,
      photo_url: url,
      photo_order: idx,
      photo_hash: sha256Hex(url),
    }));

  if (toInsert.length === 0) return;
  const { error } = await client.from("photos_media").insert(toInsert);
  if (error) throw new Error(`Supabase photos_media insert failed: ${error.message}`);
}

async function insertPriceHistorySnapshot(
  client: SupabaseClient,
  listingId: string,
  listing: NormalizedListing,
  meta: ScrapeMeta,
): Promise<void> {
  const amount =
    listing.status === "active" ? listing.pricing.currentBid : (listing.pricing.hammerPrice ?? listing.pricing.currentBid);
  const currency = listing.pricing.originalCurrency;
  if (amount === null || amount <= 0 || !currency) return;

  const time = truncateIsoToHour(meta.scrapeTimestamp);
  const exists = await client
    .from("price_history")
    .select("time")
    .eq("listing_id", listingId)
    .eq("time", time)
    .limit(1);
  if (exists.error) throw new Error(`Supabase price_history select failed: ${exists.error.message}`);
  if (exists.data && exists.data.length > 0) return;

  const row: Record<string, unknown> = {
    time,
    listing_id: listingId,
    status: listing.status,
    price_usd: currency === "USD" ? amount : null,
    price_eur: currency === "EUR" ? amount : null,
    price_gbp: currency === "GBP" ? amount : null,
  };
  const { error } = await client.from("price_history").insert(row);
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
