import type {
  MarketIntelD1,
  MarketIntelD2,
  MarketIntelD3,
  MarketIntelD4,
} from "@/lib/fairValue/types"
import type { DbComparableRow } from "@/lib/db/queries"
import type { LandedCostBreakdown, OriginCountry, Country } from "@/lib/landedCost"

// ─── D4: Confidence & freshness ────────────────────────────────────

export interface D4Input {
  sample_size: number
  capture_date_start: string
  capture_date_end: string
  outlier_flags: MarketIntelD4["outlier_flags"]
}

const CONFIDENCE_THRESHOLDS = {
  high: 20,
  medium: 8,
  low: 1,
} as const

export function computeD4Confidence(input: D4Input): MarketIntelD4 {
  let tier: MarketIntelD4["confidence_tier"]
  if (input.sample_size === 0) tier = "insufficient"
  else if (input.sample_size >= CONFIDENCE_THRESHOLDS.high) tier = "high"
  else if (input.sample_size >= CONFIDENCE_THRESHOLDS.medium) tier = "medium"
  else tier = "low"

  return {
    confidence_tier: tier,
    sample_size: input.sample_size,
    capture_date_start: input.capture_date_start,
    capture_date_end: input.capture_date_end,
    outlier_flags: input.outlier_flags,
  }
}

// ─── D1: Sold trajectory & velocity ────────────────────────────────

export function computeD1Trajectory(comparables: DbComparableRow[]): MarketIntelD1 {
  const now = new Date()
  const msIn30Days = 30 * 24 * 60 * 60 * 1000

  const soldWithDates = comparables
    .filter((c) => c.status === "sold" && c.saleDate && c.hammerPrice > 0)
    .map((c) => ({
      price: c.hammerPrice,
      date: new Date(c.saleDate as string),
    }))
    .filter((c) => !isNaN(c.date.getTime()))

  const within12m = soldWithDates.filter(
    (c) => now.getTime() - c.date.getTime() <= 12 * msIn30Days
  )
  const within6m = within12m.filter(
    (c) => now.getTime() - c.date.getTime() <= 6 * msIn30Days
  )

  const buckets = new Map<string, number[]>()
  for (const c of within12m) {
    const key = c.date.toISOString().slice(0, 7)
    const arr = buckets.get(key) ?? []
    arr.push(c.price)
    buckets.set(key, arr)
  }

  const sortedKeys = [...buckets.keys()].sort()
  const trajectory = sortedKeys.map((key) => {
    const prices = buckets.get(key)!
    return {
      month: key,
      median_usd: median(prices),
      sample: prices.length,
    }
  })

  const direction: MarketIntelD1["trend_12m_direction"] =
    trajectory.length < 2 ? "stable" : computeTrendDirection(trajectory)
  const trendPercent =
    trajectory.length < 2 ? 0 : computeTrendPercent(trajectory)

  return {
    sold_trajectory: trajectory,
    sold_12m_count: within12m.length,
    sold_6m_count: within6m.length,
    trend_12m_direction: direction,
    trend_12m_percent: trendPercent,
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

function computeTrendDirection(
  trajectory: MarketIntelD1["sold_trajectory"]
): MarketIntelD1["trend_12m_direction"] {
  const first = trajectory[0].median_usd
  const last = trajectory[trajectory.length - 1].median_usd
  if (first === 0) return "stable"
  const deltaPct = ((last - first) / first) * 100
  if (Math.abs(deltaPct) < 2) return "stable"
  return deltaPct > 0 ? "up" : "down"
}

function computeTrendPercent(trajectory: MarketIntelD1["sold_trajectory"]): number {
  const first = trajectory[0].median_usd
  const last = trajectory[trajectory.length - 1].median_usd
  if (first === 0) return 0
  return Math.round(((last - first) / first) * 1000) / 10
}

// ─── D2: Cross-border arbitrage ────────────────────────────────────

export interface ArbitrageComparable {
  id: string
  priceUsd: number
  url: string | null
}

export interface D2Input {
  targetRegion: "US" | "EU" | "UK" | "JP"
  comparablesByRegion: Record<"US" | "EU" | "UK" | "JP", ArbitrageComparable[]>
  landedCostResolver: (
    origin: OriginCountry,
    destination: Country,
    priceUsd: number
  ) => Promise<LandedCostBreakdown | null>
}

const REGION_TO_ORIGIN: Record<"US" | "EU" | "UK" | "JP", OriginCountry> = {
  US: "US",
  EU: "DE",
  UK: "UK",
  JP: "JP",
}

const REGION_TO_DEST: Record<"US" | "EU" | "UK" | "JP", Country> = {
  US: "US",
  EU: "DE",
  UK: "UK",
  JP: "JP",
}

export async function computeD2Arbitrage(input: D2Input): Promise<MarketIntelD2> {
  const regions = ["US", "EU", "UK", "JP"] as const
  const byRegion: MarketIntelD2["by_region"] = []
  const destination = REGION_TO_DEST[input.targetRegion]

  for (const region of regions) {
    const list = input.comparablesByRegion[region] ?? []
    const cheapest = list.reduce<ArbitrageComparable | null>(
      (acc, c) => (acc === null || c.priceUsd < acc.priceUsd ? c : acc),
      null
    )

    let landedAdd: number | null = null
    let total: number | null = null
    if (cheapest && region !== input.targetRegion) {
      const origin = REGION_TO_ORIGIN[region]
      const lc = await input.landedCostResolver(origin, destination, cheapest.priceUsd)
      if (lc) {
        const landedMid = Math.round((lc.landedCost.min + lc.landedCost.max) / 2)
        landedAdd = landedMid - cheapest.priceUsd
        total = landedMid
      }
    } else if (cheapest && region === input.targetRegion) {
      landedAdd = 0
      total = cheapest.priceUsd
    }

    byRegion.push({
      region,
      cheapest_comparable_usd: cheapest?.priceUsd ?? null,
      cheapest_comparable_listing_id: cheapest?.id ?? null,
      cheapest_comparable_url: cheapest?.url ?? null,
      landed_cost_to_target_usd: landedAdd,
      total_landed_to_target_usd: total,
    })
  }

  return {
    by_region: byRegion,
    target_region: input.targetRegion,
    narrative_insight: composeArbitrageInsight(byRegion, input.targetRegion),
  }
}

function composeArbitrageInsight(
  byRegion: MarketIntelD2["by_region"],
  target: "US" | "EU" | "UK" | "JP"
): string | null {
  const targetRow = byRegion.find((r) => r.region === target)
  if (!targetRow || targetRow.total_landed_to_target_usd === null) return null

  const candidates = byRegion.filter(
    (r) => r.region !== target && r.total_landed_to_target_usd !== null
  )
  if (candidates.length === 0) return null

  const best = candidates.reduce<typeof byRegion[number]>(
    (acc, r) =>
      (r.total_landed_to_target_usd ?? Infinity) <
      (acc.total_landed_to_target_usd ?? Infinity)
        ? r
        : acc,
    candidates[0]
  )

  const delta =
    (best.total_landed_to_target_usd ?? 0) - (targetRow.total_landed_to_target_usd ?? 0)
  if (delta >= 0) return null

  const savingsK = Math.round(Math.abs(delta) / 1000)
  return `${best.region}-sourced example costs ~$${savingsK}K less than local listing after import. Worth exploring if timeline allows.`
}

// ─── D3: Peer positioning ──────────────────────────────────────────

export interface D3Input {
  thisVinPriceUsd: number
  variantSoldPricesUsd: number[]
  adjacentVariants: MarketIntelD3["adjacent_variants"]
}

export function computeD3PeerPositioning(input: D3Input): MarketIntelD3 {
  const sorted = [...input.variantSoldPricesUsd].sort((a, b) => a - b)
  const percentile =
    sorted.length === 0
      ? 50
      : Math.round(
          (sorted.filter((p) => p <= input.thisVinPriceUsd).length / sorted.length) * 100
        )

  const bins = computeDistributionBins(sorted)

  return {
    vin_percentile_within_variant: percentile,
    variant_distribution_bins: bins,
    adjacent_variants: input.adjacentVariants,
  }
}

function computeDistributionBins(
  sortedPrices: number[]
): MarketIntelD3["variant_distribution_bins"] {
  if (sortedPrices.length === 0) return []
  const min = sortedPrices[0]
  const max = sortedPrices[sortedPrices.length - 1]
  const range = max - min
  if (range === 0) {
    return [{ price_bucket_usd_low: min, price_bucket_usd_high: min, count: sortedPrices.length }]
  }
  const binCount = Math.min(10, Math.max(4, Math.floor(Math.sqrt(sortedPrices.length))))
  const binSize = range / binCount
  const bins: MarketIntelD3["variant_distribution_bins"] = []
  for (let i = 0; i < binCount; i++) {
    const lo = min + i * binSize
    const hi = i === binCount - 1 ? max : lo + binSize
    const count = sortedPrices.filter((p) => p >= lo && p <= hi).length
    bins.push({
      price_bucket_usd_low: Math.round(lo),
      price_bucket_usd_high: Math.round(hi),
      count,
    })
  }
  return bins
}
