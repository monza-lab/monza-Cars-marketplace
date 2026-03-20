// ---------------------------------------------------------------------------
// Market Stats — Regional price analysis for investment reports
// ---------------------------------------------------------------------------
// Segregates listings by source → region/tier, then computes per-region
// statistics (P25, median, P75, trend). Never mixes tiers.
// ---------------------------------------------------------------------------

import { toUsd } from "./exchangeRates"
import { extractSeries, getSeriesConfig } from "./brandConfig"
import type {
  PricedListingRecord,
  RegionalMarketStats,
  ModelMarketStats,
  SourceRegionInfo,
} from "./reports/types"

// ── Currency ISO → symbol bridge ──

export const ISO_TO_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CHF: "CHF",
}

// ── Source → Region/Tier mapping ──

export const SOURCE_REGION: Record<string, SourceRegionInfo> = {
  "Bring a Trailer": { region: "US", tier: 1, currency: "USD" },
  "ClassicCom":      { region: "US", tier: 1, currency: "USD" },
  "AutoScout24":     { region: "EU", tier: 2, currency: "EUR" },
  "AutoTrader":      { region: "UK", tier: 2, currency: "GBP" },
  "BeForward":       { region: "JP", tier: 2, currency: "JPY" },
}

const TIER_LABELS: Record<number, string> = {
  1: "Verified Sales",
  2: "Active Listings",
  3: "Recently Delisted",
}

// ── Segregation ──

export function segregateByRegion(
  listings: PricedListingRecord[],
): Map<string, { tier: number; currency: string; region: string; listings: PricedListingRecord[] }> {
  const groups = new Map<string, { tier: number; currency: string; region: string; listings: PricedListingRecord[] }>()

  for (const listing of listings) {
    const info = SOURCE_REGION[listing.source]
    if (!info) continue

    // AutoScout24 delisted → Tier 3
    let tier = info.tier
    if (listing.source === "AutoScout24" && listing.status === "delisted") {
      tier = 3
    }

    const key = `${info.region}-${tier}`
    if (!groups.has(key)) {
      groups.set(key, { tier, currency: info.currency, region: info.region, listings: [] })
    }
    groups.get(key)!.listings.push(listing)
  }

  return groups
}

// ── Per-region stats ──

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

export function computeRegionalStats(
  listings: PricedListingRecord[],
  region: string,
  tier: 1 | 2 | 3,
  currency: string,
  rates: Record<string, number> = {},
): RegionalMarketStats | null {
  if (listings.length < 3) return null

  // Prices in native currency
  const prices = listings.map(l => l.hammerPrice).sort((a, b) => a - b)

  const median = percentile(prices, 50)
  const p25 = percentile(prices, 25)
  const p75 = percentile(prices, 75)
  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
  const min = prices[0]
  const max = prices[prices.length - 1]

  // USD conversion for cross-region comparison
  const medianUsd = Math.round(toUsd(median, currency, rates))

  // Trend: recent 6 months vs prior 6 months
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const cutoff = sixMonthsAgo.toISOString().slice(0, 10)

  const recent: number[] = []
  const older: number[] = []
  for (const l of listings) {
    if (!l.saleDate) {
      recent.push(l.hammerPrice)
      continue
    }
    if (l.saleDate >= cutoff) recent.push(l.hammerPrice)
    else older.push(l.hammerPrice)
  }

  let trendPercent = 0
  let trendDirection: "up" | "down" | "stable" = "stable"
  if (recent.length > 0 && older.length > 0) {
    const avgRecent = recent.reduce((s, p) => s + p, 0) / recent.length
    const avgOlder = older.reduce((s, p) => s + p, 0) / older.length
    if (avgOlder > 0) {
      trendPercent = Math.round(((avgRecent - avgOlder) / avgOlder) * 1000) / 10
      trendDirection = trendPercent > 3 ? "up" : trendPercent < -3 ? "down" : "stable"
    }
  }

  // Date range
  const dates = listings
    .map(l => l.saleDate)
    .filter((d): d is string => d != null)
    .sort()

  // Sources
  const sourceSet = new Set(listings.map(l => l.source))

  return {
    region,
    tier,
    tierLabel: TIER_LABELS[tier] ?? "Unknown",
    currency,
    totalListings: listings.length,
    medianPrice: Math.round(median),
    avgPrice: avg,
    p25Price: Math.round(p25),
    p75Price: Math.round(p75),
    minPrice: min,
    maxPrice: max,
    medianPriceUsd: medianUsd,
    trendPercent,
    trendDirection,
    oldestDate: dates[0] ?? "",
    newestDate: dates[dates.length - 1] ?? "",
    sources: Array.from(sourceSet),
  }
}

// ── Aggregated market stats ──

export function computeMarketStats(
  listings: PricedListingRecord[],
  scope: "model" | "series" | "family",
  rates: Record<string, number> = {},
): ModelMarketStats | null {
  const groups = segregateByRegion(listings)

  const regions: RegionalMarketStats[] = []
  for (const [, group] of groups) {
    const stats = computeRegionalStats(
      group.listings,
      group.region,
      group.tier as 1 | 2 | 3,
      group.currency,
      rates,
    )
    if (stats) regions.push(stats)
  }

  if (regions.length === 0) return null

  // Pick primary: lowest tier number (1 > 2 > 3), then most data
  regions.sort((a, b) => a.tier - b.tier || b.totalListings - a.totalListings)
  const primary = regions[0]

  // Convert primary P25/P75 to USD
  const fairLow = Math.round(toUsd(primary.p25Price, primary.currency, rates))
  const fairHigh = Math.round(toUsd(primary.p75Price, primary.currency, rates))

  return {
    scope,
    regions,
    primaryFairValueLow: fairLow,
    primaryFairValueHigh: fairHigh,
    primaryTier: primary.tier,
    primaryRegion: primary.region,
    totalDataPoints: regions.reduce((sum, r) => sum + r.totalListings, 0),
  }
}

// ── Shared helper: series filtering + stats (used by page.tsx and route.ts) ──

export interface PricedListingRow {
  id: string
  year: number
  make: string
  model: string
  trim: string | null
  hammer_price: number
  original_currency: string | null
  sale_date: string | null
  status: string
  mileage: number | null
  source: string
  country: string | null
}

/**
 * Filter priced listings by series, expand to family if needed,
 * map to PricedListingRecord, and compute regional market stats.
 */
export function computeMarketStatsForCar(
  car: { make: string; model: string; year: number },
  allPriced: PricedListingRow[],
  rates: Record<string, number> = {},
): { marketStats: ModelMarketStats | null; pricedRecords: PricedListingRecord[] } {
  const series = extractSeries(car.model, car.year, car.make)

  let filtered = allPriced.filter(l => {
    const lSeries = extractSeries(l.model, l.year, l.make)
    return lSeries === series
  })

  let scope: "model" | "series" | "family" = "series"
  if (filtered.length < 3) {
    const config = getSeriesConfig(series, car.make)
    if (config) {
      filtered = allPriced.filter(l => {
        const lSeries = extractSeries(l.model, l.year, l.make)
        const lConfig = getSeriesConfig(lSeries, l.make)
        return lConfig?.family === config.family
      })
      scope = "family"
    }
  }

  const pricedRecords: PricedListingRecord[] = filtered.map(l => ({
    id: l.id,
    year: l.year,
    make: l.make,
    model: l.model,
    trim: l.trim ?? null,
    hammerPrice: Number(l.hammer_price),
    originalCurrency: l.original_currency ?? null,
    saleDate: l.sale_date ?? null,
    status: l.status,
    mileage: l.mileage ? Number(l.mileage) : null,
    source: l.source,
    country: l.country ?? null,
  }))

  const marketStats = computeMarketStats(pricedRecords, scope, rates)
  return { marketStats, pricedRecords }
}
