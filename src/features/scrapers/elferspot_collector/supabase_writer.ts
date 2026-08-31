import { createClient } from "@supabase/supabase-js"
import type { NormalizedElferspot } from "./normalize"
import { computeSeries } from "@/features/scrapers/common/seriesEnrichment"
import { computeRankingVariant } from "@/features/scrapers/common/rankingEnrichment"

type ElferspotUpsertRow = Record<string, unknown>
const TERMINAL_STATUSES = new Set(["sold", "unsold", "delisted"])

function hasText(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function resolveElferspotStatus(incomingStatus: string, existingStatus: string | null): string {
  if (incomingStatus === "sold") return "sold"
  if (existingStatus && TERMINAL_STATUSES.has(existingStatus)) return existingStatus
  return incomingStatus
}

export function mapElferspotUpsertRow(
  listing: NormalizedElferspot,
  existingStatus: string | null = null,
): ElferspotUpsertRow {
  const status = resolveElferspotStatus(listing.status, existingStatus)
  const isSold = status === "sold"
  const preservesExistingTerminal = listing.status === "active" && existingStatus !== null && TERMINAL_STATUSES.has(existingStatus)
  const row: ElferspotUpsertRow = {
    source: listing.source,
    source_id: listing.source_id,
    source_url: listing.source_url,
    title: listing.title,
    make: listing.make,
    model: listing.model,
    trim: listing.trim,
    year: listing.year,
    original_currency: listing.original_currency,
    mileage: listing.mileage_km,
    mileage_unit: "km",
    country: listing.country,
    location: listing.location,
    status,
    scrape_timestamp: listing.scrape_timestamp,
    updated_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
    enrichment_meta: listing.enrichment_meta,
    series: computeSeries({ make: listing.make, model: listing.model, year: listing.year, title: listing.title }),
    ranking_variant: computeRankingVariant({ make: listing.make, model: listing.model, trim: listing.trim, year: listing.year, title: listing.title }),
  }

  if (!preservesExistingTerminal) {
    row.hammer_price = listing.price
    row.current_bid = isSold ? null : listing.price
    row.final_price = isSold ? listing.price : null
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

  const { data: existing, error: existingError } = await client
    .from("listings")
    .select("status")
    .eq("source", listing.source)
    .eq("source_id", listing.source_id)
    .maybeSingle()

  if (existingError) throw new Error(`Existing status lookup failed: ${existingError.message}`)

  const row = mapElferspotUpsertRow(
    listing,
    (existing as { status?: string } | null)?.status ?? null,
  )

  const { error } = await client
    .from("listings")
    .upsert(row, { onConflict: "source,source_id" })

  if (error) throw new Error(`Upsert failed: ${error.message}`)
  return true
}
