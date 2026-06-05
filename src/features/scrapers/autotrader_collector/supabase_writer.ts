import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setTimeout as sleep } from "node:timers/promises";

import type { NormalizedListing, ScrapeMeta } from "./types";
import { validateListing } from "@/features/scrapers/common/listingValidator";
import { computeSeries } from "@/features/scrapers/common/seriesEnrichment";
import { normalizeAutoTraderImageUrl } from "./imageUrls";
import { proxyFetch } from "../common/proxy-fetch";
import { logEvent } from "./logging";
import { RARITY_SCORE_VERSION, scoreListingRarity } from "@/lib/listingRarity";

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
      "[autotrader_collector] SUPABASE_SERVICE_ROLE_KEY not set; falling back to NEXT_PUBLIC_SUPABASE_ANON_KEY. Writes may fail if RLS is enabled.",
    );
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
        console.log(`[autotrader] Skipped invalid listing: ${validation.reason} — ${listing.title}`);
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
    // For AutoTrader (classifieds), use askingPrice instead of hammerPrice
    hammer_price: listing.pricing.askingPrice,
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
    // Auction-model aligned columns
    title: listing.title,
    platform: listing.platform,
    // AutoTrader doesn't have current bid, but we use askingPrice
    current_bid: listing.pricing.askingPrice,
    bid_count: 0, // No bid count for classifieds
    rarity_score: rarity.score,
    rarity_tier: rarity.tier,
    rarity_signals_json: rarity.signals,
    rarity_scored_at: meta.scrapeTimestamp,
    rarity_score_version: RARITY_SCORE_VERSION,
    reserve_status: listing.reserveStatus,
    seller_notes: listing.sellerNotes,
    images: listing.photos,
    engine: listing.engine,
    transmission: listing.transmission,
    end_time: listing.endTime?.toISOString() ?? null,
    start_time: listing.startTime?.toISOString() ?? null,
    final_price: listing.finalPrice,
    location: listing.locationString,
    series: computeSeries({ make: listing.make, model: listing.model, year: listing.year, title: listing.title }),
  };
}

async function insertPriceHistorySnapshot(
  client: SupabaseClient,
  listingId: string,
  listing: NormalizedListing,
  meta: ScrapeMeta,
): Promise<void> {
  // For AutoTrader (classifieds), use askingPrice as the price
  const amount = listing.pricing.askingPrice;
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
 * Extract the numeric advert ID from an AutoTrader URL.
 * e.g. "https://www.autotrader.co.uk/car-details/202507194625233" → "202507194625233"
 */
function extractAdvertId(url: string): string | null {
  const match = url.match(/\/car-details\/(\d+)(?:[/?#]|$)/i);
  return match?.[1] ?? null;
}

/**
 * Fetch the AutoTrader product-page API for a given advert ID.
 * Returns the JSON payload if the listing is live, null if not found (404),
 * or throws on unexpected errors.
 */
async function fetchProductPageApi(
  advertId: string,
  sourceUrl: string,
  timeoutMs = 10_000,
): Promise<Record<string, unknown> | null> {
  const endpoint = new URL(`https://www.autotrader.co.uk/product-page/v1/advert/${advertId}`);
  endpoint.searchParams.set("channel", "cars");
  endpoint.searchParams.set("postcode", "SW1A 1AA");

  const response = await proxyFetch(endpoint.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: sourceUrl,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (response.status === 404) return null;
  if (response.status === 403 || response.status === 429) {
    throw new Error(`Rate-limited (${response.status})`);
  }
  if (!response.ok) {
    throw new Error(`Unexpected status ${response.status}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

/**
 * Extract image URLs from a product-page API payload.
 */
function extractImagesFromPayload(payload: Record<string, unknown>): string[] {
  const gallery = payload.gallery as { images?: Array<{ url?: string }> } | undefined;
  if (!gallery?.images) return [];
  return gallery.images
    .map((img) => (typeof img?.url === "string" ? normalizeAutoTraderImageUrl(img.url) : null))
    .filter((url): url is string => url !== null);
}

/**
 * Re-checks each active AutoTrader listing against the product-page API.
 * - 404 → mark as "delisted" (listing removed from AutoTrader)
 * - 200 → refresh images if the API returns fresh ones
 *
 * The old approach fetched the SPA HTML page (always 200, empty body)
 * and couldn't detect removed listings. The product-page API gives a
 * clear 404 for removed adverts.
 */
export async function refreshActiveListings(): Promise<RefreshResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { checked: 0, updated: 0, errors: ["Missing Supabase env vars"] };

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Prioritise stale listings (oldest scrape_timestamp first) and those
  // with few photos (likely never enriched / images expired).
  const { data: activeRows, error: fetchErr } = await client
    .from("listings")
    .select("id,source_url,photos_count")
    .eq("status", "active")
    .eq("source", "AutoTrader")
    .order("photos_count", { ascending: true, nullsFirst: true })
    .order("scrape_timestamp", { ascending: true })
    .limit(200);

  if (fetchErr || !activeRows) {
    return { checked: 0, updated: 0, errors: [fetchErr?.message ?? "No active rows"] };
  }

  const result: RefreshResult = { checked: activeRows.length, updated: 0, errors: [] };
  let consecutiveBlocks = 0;
  const MAX_CONSECUTIVE_BLOCKS = 5;

  for (const row of activeRows) {
    if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) {
      result.errors.push(`Circuit-break: ${consecutiveBlocks} consecutive rate-limit blocks`);
      break;
    }

    const advertId = extractAdvertId(row.source_url);
    if (!advertId) {
      result.errors.push(`Cannot extract advert ID from ${row.source_url}`);
      continue;
    }

    try {
      const payload = await fetchProductPageApi(advertId, row.source_url);

      if (payload === null) {
        // API returned 404 — listing is definitively removed
        const { error: updateErr } = await client
          .from("listings")
          .update({ status: "delisted", updated_at: new Date().toISOString() })
          .eq("id", row.id);
        if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);
        result.updated++;
        logEvent({ level: "info", event: "collector.refresh_delisted", runId: "", source: "AutoTrader", url: row.source_url });
        consecutiveBlocks = 0;
      } else {
        // Listing is still live — refresh images if the API has them
        consecutiveBlocks = 0;
        const freshImages = extractImagesFromPayload(payload);
        if (freshImages.length > 0 && freshImages.length > (row.photos_count ?? 0)) {
          const { error: updateErr } = await client
            .from("listings")
            .update({
              images: freshImages,
              photos_count: freshImages.length,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          if (updateErr) throw new Error(`Image update failed: ${updateErr.message}`);
          result.updated++;
          logEvent({ level: "info", event: "collector.refresh_images", runId: "", source: "AutoTrader", url: row.source_url, imageCount: freshImages.length });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/rate.?limit|403|429/i.test(msg)) {
        consecutiveBlocks++;
        logEvent({ level: "debug", event: "collector.refresh_rate_limited", runId: "", source: "AutoTrader", url: row.source_url });
        continue;
      }
      result.errors.push(`Refresh failed for ${row.source_url}: ${msg}`);
    }

    // Gentle pacing to avoid AT rate limits
    await sleep(500);
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
