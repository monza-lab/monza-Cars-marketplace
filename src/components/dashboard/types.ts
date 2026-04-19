// ─── BRAND TYPE ───
export type Brand = {
  name: string
  slug: string
  carCount: number
  priceMin: number
  priceMax: number
  avgTrend: string
  representativeImage: string
  representativeCar: string
  categories: string[]
}

export type RegionalPricing = {
  currency: "$" | "€" | "£" | "¥"
  low: number
  high: number
}

export type FairValueByRegion = {
  US: RegionalPricing
  EU: RegionalPricing
  UK: RegionalPricing
  JP: RegionalPricing
}

export type Auction = {
  id: string
  title: string
  make: string
  model: string
  year: number
  trim: string | null
  price: number
  currentBid: number
  bidCount: number
  viewCount: number
  watchCount: number
  status: string
  endTime: string
  platform: string
  engine: string | null
  transmission: string | null
  exteriorColor: string | null
  mileage: number | null
  mileageUnit: string | null
  location: string | null
  region?: string | null
  description: string | null
  images: string[]
  analysis: {
    bidTargetLow: number | null
    bidTargetHigh: number | null
    confidence: string | null
    appreciationPotential: string | null
    keyStrengths: string[]
    redFlags: string[]
  } | null
  priceHistory: { price: number; timestamp: string }[]
  fairValueByRegion?: FairValueByRegion
  category?: string
  originalCurrency?: string | null
  // ── Derived valuation fields (Rule 1–3 of golden standard) ──
  /** Transaction price in USD. Set only when status='sold' AND source is auction. */
  soldPriceUsd?: number | null;
  /** Asking price in USD. Set for active/unsold/delisted classifieds and live bids. */
  askingPriceUsd?: number | null;
  /** Which concept this row represents. */
  valuationBasis?: "sold" | "asking" | "unknown";
  /** Market derived from source, never from raw `region`. */
  canonicalMarket?: "US" | "EU" | "UK" | "JP" | null;
  /** Series id (e.g. "992"). */
  family?: string | null;
}

// ─── PORSCHE FAMILY TYPE (for family-based landing scroll) ───
export type PorscheFamily = {
  name: string
  slug: string
  carCount: number
  priceMin: number
  priceMax: number
  yearMin: number
  yearMax: number
  representativeImage: string
  fallbackImage: string
  representativeCar: string
}

export type LiveRegionTotals = {
  all: number
  US: number
  UK: number
  EU: number
  JP: number
}
