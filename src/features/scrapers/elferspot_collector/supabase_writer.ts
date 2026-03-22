import { createClient } from "@supabase/supabase-js"
import type { NormalizedElferspot } from "./normalize"

export async function upsertListing(listing: NormalizedElferspot, dryRun: boolean): Promise<boolean> {
  if (dryRun) return false

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env vars")

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const row = {
    source: listing.source,
    source_id: listing.source_id,
    source_url: listing.source_url,
    title: listing.title,
    make: listing.make,
    model: listing.model,
    trim: listing.trim,
    year: listing.year,
    price: listing.price,
    original_currency: listing.original_currency,
    mileage_km: listing.mileage_km,
    transmission: listing.transmission,
    body_style: listing.body_style,
    engine: listing.engine,
    color_exterior: listing.color_exterior,
    color_interior: listing.color_interior,
    vin: listing.vin,
    description_text: listing.description_text,
    images: listing.images,
    photos_count: listing.photos_count,
    country: listing.country,
    location: listing.location,
    seller_type: listing.seller_type,
    seller_name: listing.seller_name,
    status: listing.status,
    fuel: listing.fuel,
    scrape_timestamp: listing.scrape_timestamp,
    updated_at: new Date().toISOString(),
  }

  const { error } = await client
    .from("listings")
    .upsert(row, { onConflict: "source,source_id" })

  if (error) throw new Error(`Upsert failed: ${error.message}`)
  return true
}
