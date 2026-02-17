import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { NormalizedListing, ScrapeMeta } from "./types";

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
      "[porsche_collector] SUPABASE_SERVICE_ROLE_KEY not set; falling back to NEXT_PUBLIC_SUPABASE_ANON_KEY. Writes may fail if RLS is enabled.",
    );
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    upsertAll: async (listing, meta, dryRun) => {
      if (dryRun) return { listingId: "dry_run", wrote: false };
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
    // New Auction-model aligned columns
    title: listing.title,
    platform: listing.platform,
    current_bid: listing.pricing.currentBid,
    bid_count: listing.pricing.bidCount ?? 0,
    reserve_status: listing.reserveStatus,
    seller_notes: listing.sellerNotes,
    images: listing.photos,
    engine: listing.engine,
    transmission: listing.transmission,
    end_time: listing.endTime?.toISOString() ?? null,
    start_time: listing.startTime?.toISOString() ?? null,
    final_price: listing.finalPrice,
    location: listing.locationString,
  };
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

// ─── Active listing status refresh ───

export interface RefreshResult {
  checked: number;
  updated: number;
  errors: string[];
}

/**
 * Re-scrapes every listing with `status = 'active'` and updates the DB
 * when the auction has ended (sold / unsold / delisted).
 */
export async function refreshActiveListings(): Promise<RefreshResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { checked: 0, updated: 0, errors: ["Missing Supabase env vars"] };

  const { fetchAuctionData } = await import("@/lib/scraper");
  const { mapAuctionStatus } = await import("./normalize");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: activeRows, error: fetchErr } = await client
    .from("listings")
    .select("id,source_url,hammer_price,sale_date")
    .eq("status", "active");

  if (fetchErr || !activeRows) {
    return { checked: 0, updated: 0, errors: [fetchErr?.message ?? "No active rows"] };
  }

  const result: RefreshResult = { checked: activeRows.length, updated: 0, errors: [] };

  for (const row of activeRows) {
    try {
      const scraped = await fetchAuctionData(row.source_url, true);

      const newStatus = mapAuctionStatus({
        sourceStatus: scraped.status,
        rawPriceText: scraped.rawPriceText,
        currentBid: scraped.currentBid,
        endTime: scraped.endTime,
        now: new Date(),
      });

      // Still active — nothing to update
      if (newStatus === "active") continue;

      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "sold" && scraped.currentBid != null && scraped.currentBid > 0) {
        updates.hammer_price = scraped.currentBid;
        updates.final_price = scraped.currentBid;
        updates.current_bid = scraped.currentBid;
      }

      if (scraped.endTime && !isNaN(scraped.endTime.getTime())) {
        const d = scraped.endTime;
        updates.sale_date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        updates.end_time = scraped.endTime.toISOString();
      }

      const { error: updateErr } = await client
        .from("listings")
        .update(updates)
        .eq("id", row.id);

      if (updateErr) {
        result.errors.push(`Update failed for ${row.id}: ${updateErr.message}`);
      } else {
        result.updated++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Refresh failed for ${row.source_url}: ${msg}`);
    }
  }

  return result;
}

function truncateIsoToHour(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:00:00.000Z`;
}
