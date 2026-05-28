// src/features/scrapers/elferspot_collector/types.ts

export interface CollectorRunConfig {
  maxPages: number
  maxListings: number
  scrapeDetails: boolean
  delayMs: number
  checkpointPath: string
  outputPath: string
  dryRun: boolean
  language: "en" | "de" | "nl" | "fr"
  /** Force start from page 1, keeping processedIds for dedup */
  fresh?: boolean
  /** Max time in ms before stopping early (0 = no limit) */
  timeBudgetMs?: number
}

export interface ElferspotListingSummary {
  sourceUrl: string
  sourceId: string
  title: string
  year: number | null
  country: string | null
  thumbnailUrl: string | null
}

export interface ElferspotDetail {
  // JSON-LD fields
  price: number | null
  priceStatus: "numeric" | "sold" | "price_on_request" | "hidden" | "not_listed" | "unknown"
  currency: string
  year: number | null
  mileageKm: number | null
  transmission: string | null
  bodyType: string | null
  driveType: string | null
  colorExterior: string | null
  model: string | null
  firstRegistration: string | null
  // Cheerio fallback fields
  fuel: string | null
  engine: string | null
  colorInterior: string | null
  vin: string | null
  sellerName: string | null
  sellerType: "dealer" | "private" | null
  location: string | null
  locationCountry: string | null
  descriptionText: string | null
  descriptionStatus: "present" | "missing"
  images: string[]
  condition: string | null
}

export interface CollectorCounts {
  discovered: number
  written: number
  enriched: number
  errors: number
}

export interface CollectorResult {
  runId: string
  counts: CollectorCounts
  errors: string[]
}
