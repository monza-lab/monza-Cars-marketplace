import { createClient } from "@supabase/supabase-js"
import type { NormalizedElferspot } from "./normalize"
import { computeSeries } from "@/features/scrapers/common/seriesEnrichment"

type ElferspotUpsertRow = Record<string, unknown>

function hasText(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function mapElferspotUpsertRow(listing: NormalizedElferspot): ElferspotUpsertRow {
  const row: ElferspotUpsertRow = {
    source: listing.source,
    source_id: listing.source_id,
    source_url: listing.source_url,
    title: listing.title,
    make: listing.make,
    model: listing.model,
    trim: listing.trim,
    year: listing.year,
    hammer_price: listing.price,
    current_bid: listing.price,
    original_currency: listing.original_currency,
    mileage: listing.mileage_km,
    mileage_unit: "km",
    country: listing.country,
    location: listing.location,
    status: listing.status,
    scrape_timestamp: listing.scrape_timestamp,
    updated_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
    enrichment_meta: listing.enrichment_meta,
    series: computeSeries({ make: listing.make, model: listing.model, year: listing.year, title: listing.title }),
  }

  if (hasText(listing.transmission)) row.transmission = listing.transmission
  if (hasText(listing.body_style)) row.body_style = listing.body_style
  if (hasText(listing.engine)) row.engine = listing.engine
  if (hasText(listing.color_exterior)) row.color_exterior = listing.color_exterior
  if (hasText(listing.color_interior)) row.color_interior = listing.color_interior
  if (hasText(listing.vin)) row.vin = listing.vin
  if (hasText(listing.description_text)) row.description_text = listing.description_text
  if (listing.images.length > 0) {
    row.images = listing.images
    row.photos_count = listing.photos_count
  }

  return row
}

export async function upsertListing(listing: NormalizedElferspot, dryRun: boolean): Promise<boolean> {
  if (dryRun) return false

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env vars")

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const row = mapElferspotUpsertRow(listing)

  const { error } = await client
    .from("listings")
    .upsert(row, { onConflict: "source,source_id" })

  if (error) throw new Error(`Upsert failed: ${error.message}`)
  return true
}
