import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { CanonicalListing } from "../contracts/listing";

export type WriteResult = { inserted: number; updated: number; warnings: string[] };

function createSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env. Expected NEXT_PUBLIC_SUPABASE_URL and service/anon key.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function listingIdAfterUpsert(client: SupabaseClient, listing: CanonicalListing): Promise<{ id: string; inserted: boolean }> {
  const row = {
    source: listing.source,
    source_id: listing.source_id,
    source_url: listing.source_url,
    title: listing.title,
    make: listing.make,
    model: listing.model,
    year: listing.year,
    status: listing.status,
    sale_date: listing.sale_date ?? new Date().toISOString().slice(0, 10),
    hammer_price: listing.hammer_price ?? null,
    current_bid: listing.current_bid ?? null,
    bid_count: listing.bid_count ?? 0,
    final_price: listing.final_price ?? listing.hammer_price ?? null,
    original_currency: listing.currency ?? null,
    mileage: listing.mileage ?? null,
    mileage_unit: listing.mileage_unit,
    vin: listing.vin ?? null,
    country: listing.country,
    region: listing.region ?? null,
    city: listing.city ?? null,
    auction_house: listing.auction_house,
    description_text: listing.description_text ?? null,
    images: listing.images,
    photos_count: listing.images.length,
    updated_at: new Date().toISOString(),
    scrape_timestamp: new Date().toISOString(),
  };

  const exists = await client
    .from("listings")
    .select("id")
    .eq("source", listing.source)
    .eq("source_id", listing.source_id)
    .limit(1);
  if (exists.error) throw new Error(`listings exists check failed: ${exists.error.message}`);
  const existed = Boolean(exists.data?.[0]?.id);

  if (!existed) {
    const byUrl = await client
      .from("listings")
      .select("id")
      .eq("source_url", listing.source_url)
      .limit(1);
    if (byUrl.error) throw new Error(`listings source_url check failed: ${byUrl.error.message}`);
    const byUrlId = byUrl.data?.[0]?.id;
    if (byUrlId) {
      const updated = await client
        .from("listings")
        .update(row)
        .eq("id", byUrlId)
        .select("id")
        .limit(1);
      if (updated.error) throw new Error(`listings update by source_url failed: ${updated.error.message}`);
      const id = (updated.data as Array<{ id: string }> | null)?.[0]?.id ?? byUrlId;
      return { id, inserted: false };
    }
  }

  const upsert = await client
    .from("listings")
    .upsert(row, { onConflict: "source,source_id" })
    .select("id")
    .limit(1);
  if (upsert.error) throw new Error(`listings upsert failed: ${upsert.error.message}`);

  const id = (upsert.data as Array<{ id: string }> | null)?.[0]?.id ?? exists.data?.[0]?.id;
  if (!id) throw new Error("listings upsert returned no id");

  return { id, inserted: !existed };
}

async function safeUpsert(
  client: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
  warnings: string[],
  onConflict = "listing_id",
): Promise<void> {
  const result = await client.from(table).upsert(row, { onConflict });
  if (result.error) warnings.push(`${table}: ${result.error.message}`);
}

async function upsertChildTables(client: SupabaseClient, listingId: string, listing: CanonicalListing, warnings: string[]): Promise<void> {
  await safeUpsert(client, "pricing", {
    listing_id: listingId,
    original_currency: listing.currency ?? null,
    amount_original: listing.final_price ?? listing.hammer_price ?? listing.current_bid ?? null,
    amount_usd: listing.currency === "USD" ? (listing.final_price ?? listing.hammer_price ?? listing.current_bid ?? null) : null,
  }, warnings);

  await safeUpsert(client, "vehicle_specs", {
    listing_id: listingId,
    make: listing.make,
    model: listing.model,
    year: listing.year,
    vin: listing.vin ?? null,
    mileage: listing.mileage ?? null,
    mileage_unit: listing.mileage_unit,
  }, warnings);

  await safeUpsert(client, "auction_info", {
    listing_id: listingId,
    auction_house: listing.auction_house,
    status: listing.status,
    number_of_bids: listing.bid_count ?? 0,
    final_price: listing.final_price ?? listing.hammer_price ?? null,
    sale_date: listing.sale_date,
  }, warnings);

  await safeUpsert(client, "location_data", {
    listing_id: listingId,
    country: listing.country,
    region: listing.region ?? null,
    city: listing.city ?? null,
  }, warnings);

  await safeUpsert(client, "provenance_data", {
    listing_id: listingId,
    seller_name: null,
    ownership_count: null,
  }, warnings);

  for (let i = 0; i < listing.images.length; i += 1) {
    await safeUpsert(client, "photos_media", {
      listing_id: listingId,
      photo_url: listing.images[i],
      photo_order: i,
    }, warnings, "listing_id,photo_url");
  }

  const point = {
    listing_id: listingId,
    time: new Date().toISOString().slice(0, 13) + ":00:00.000Z",
    status: listing.status,
    price_usd: listing.currency === "USD" ? (listing.current_bid ?? listing.hammer_price ?? listing.final_price ?? null) : null,
    price_eur: listing.currency === "EUR" ? (listing.current_bid ?? listing.hammer_price ?? listing.final_price ?? null) : null,
    price_gbp: listing.currency === "GBP" ? (listing.current_bid ?? listing.hammer_price ?? listing.final_price ?? null) : null,
  };
  await safeUpsert(client, "price_history", point, warnings, "listing_id,time");
}

export async function upsertCanonicalListing(listing: CanonicalListing, dryRun: boolean): Promise<WriteResult> {
  if (dryRun) return { inserted: 0, updated: 0, warnings: [] };
  const client = createSupabase();
  const warnings: string[] = [];

  const upserted = await listingIdAfterUpsert(client, listing);
  await upsertChildTables(client, upserted.id, listing, warnings);

  return {
    inserted: upserted.inserted ? 1 : 0,
    updated: upserted.inserted ? 0 : 1,
    warnings,
  };
}
