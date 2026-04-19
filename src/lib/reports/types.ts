// ---------------------------------------------------------------------------
// Shared types for investment reports and credits
// ---------------------------------------------------------------------------

/** Stats for a single region/tier combination */
export interface RegionalMarketStats {
  region: string             // "US" | "EU" | "UK" | "JP"
  tier: 1 | 2 | 3
  tierLabel: string          // "Verified Sales" | "Active Listings" | "Recently Delisted"
  currency: string           // native: "USD" | "EUR" | "GBP" | "JPY"
  totalListings: number
  medianPrice: number        // native currency
  avgPrice: number           // native currency
  p25Price: number           // native currency
  p75Price: number           // native currency
  minPrice: number
  maxPrice: number
  medianPriceUsd: number     // converted to USD
  trendPercent: number       // e.g., +5.2 or -3.1
  trendDirection: "up" | "down" | "stable"
  oldestDate: string
  newestDate: string
  sources: string[]          // e.g., ["Bring a Trailer", "ClassicCom"]
}

/** Aggregated market stats across all regions */
export interface ModelMarketStats {
  scope: "model" | "series" | "family"
  regions: RegionalMarketStats[]
  primaryFairValueLow: number    // USD, P25 from best tier
  primaryFairValueHigh: number   // USD, P75 from best tier
  primaryTier: 1 | 2 | 3
  primaryRegion: string
  totalDataPoints: number
}

/** A row from listing_reports table */
export interface ListingReport {
  id: string
  listing_id: string
  fair_value_low: number | null
  fair_value_high: number | null
  median_price: number | null
  avg_price: number | null
  min_price: number | null
  max_price: number | null
  total_comparable_sales: number | null
  trend_percent: number | null
  trend_direction: string | null
  stats_scope: string | null
  primary_tier: number | null
  primary_region: string | null
  regional_stats: RegionalMarketStats[] | null
  confidence: string | null
  red_flags: string[] | null
  key_strengths: string[] | null
  critical_questions: string[] | null
  yearly_maintenance: number | null
  insurance_estimate: number | null
  major_service_cost: number | null
  appreciation_potential: string | null
  bid_target_low: number | null
  bid_target_high: number | null
  raw_llm_response: Record<string, unknown> | null
  llm_model: string | null
  created_at: string
  updated_at: string
}

/** A row from user_credits table */
export interface UserCreditsRow {
  id: string
  supabase_user_id: string
  email: string | null
  display_name: string | null
  credits_balance: number
  tier: "FREE" | "PRO"
  credit_reset_date: string
  created_at: string
  updated_at: string
}

/** A row from credit_transactions table */
export interface CreditTransactionRow {
  id: string
  user_id: string
  amount: number
  type: "FREE_MONTHLY" | "REPORT_USED" | "PURCHASE"
  description: string | null
  listing_id: string | null
  stripe_payment_id: string | null
  created_at: string
}

/** Result of deducting a credit */
export type DeductResult =
  | { success: true; creditUsed: number; cached: boolean }
  | { success: false; error: string }

/** A priced listing record fetched from Supabase */
export interface PricedListingRecord {
  id: string
  year: number
  make: string
  model: string
  trim: string | null
  hammerPrice: number
  originalCurrency: string | null
  saleDate: string | null
  status: string
  mileage: number | null
  source: string
  country: string | null
}

/** Source-to-region mapping entry */
export interface SourceRegionInfo {
  region: string
  tier: 1 | 2 | 3
  currency: string
}
