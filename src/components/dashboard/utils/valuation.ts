import type { Auction } from "../types"
import { toUsd } from "@/lib/exchangeRates"

// ─── REGIONAL VALUATION ───
export type RegionalValuation = {
  symbol: string
  usdCurrent: number
  usdAverage: number
  sampleCount: number
  minUsd: number
  maxUsd: number
}

export type ValuationConfidence = {
  label: string
  className: string
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function computeAverage(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function computeQuartile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0
  const position = (sorted.length - 1) * percentile
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  const weight = position - lower
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight
}

function filterOutliers(values: number[]): number[] {
  if (values.length < 8) return values

  const sorted = [...values].sort((a, b) => a - b)
  const q1 = computeQuartile(sorted, 0.25)
  const q3 = computeQuartile(sorted, 0.75)
  const iqr = q3 - q1

  if (iqr <= 0) return values

  const lowerFence = q1 - 1.5 * iqr
  const upperFence = q3 + 1.5 * iqr
  const filtered = values.filter(value => value >= lowerFence && value <= upperFence)
  return filtered.length > 0 ? filtered : values
}

// Convert listing price (in original currency) to USD using live rates
export function listingPriceUsd(a: Auction, rates: Record<string, number> = {}): number {
  const raw = a.price > 0 ? a.price : a.currentBid
  return toUsd(raw, a.originalCurrency, rates)
}

export function computeRegionalValFromAuctions(
  auctionList: Auction[],
  rates: Record<string, number> = {},
): Record<string, RegionalValuation> {
  const regions = ["US", "UK", "EU", "JP"] as const
  const symbolMap: Record<string, string> = { US: "$", UK: "£", EU: "€", JP: "¥" }
  const result: Record<string, RegionalValuation> = {}

  for (const region of regions) {
    const regionAuctions = auctionList.filter(a => a.region === region)

    const pricesUsd = regionAuctions
      .map(a => listingPriceUsd(a, rates))
      .filter(p => p > 0)
    const trimmedPrices = filterOutliers(pricesUsd)
    const sampleCount = trimmedPrices.length

    // Median is the primary fair value because it is resilient to trophy-car outliers.
    let medianUsd = sampleCount > 0 ? computeMedian(trimmedPrices) : 0
    const averageUsd = sampleCount > 0 ? computeAverage(trimmedPrices) : 0
    const minUsd = sampleCount > 0 ? Math.min(...trimmedPrices) : 0
    const maxUsd = sampleCount > 0 ? Math.max(...trimmedPrices) : 0

    result[region] = {
      symbol: symbolMap[region],
      usdCurrent: medianUsd / 1_000_000,
      usdAverage: averageUsd / 1_000_000,
      sampleCount,
      minUsd: minUsd / 1_000_000,
      maxUsd: maxUsd / 1_000_000,
    }
  }
  return result
}

export function getValuationConfidence(sampleCount: number, minUsd: number, maxUsd: number): ValuationConfidence {
  if (sampleCount <= 0) {
    return {
      label: "NO LOCAL DATA",
      className: "border border-border bg-foreground/4 text-muted-foreground",
    }
  }

  const spread = minUsd > 0 ? (maxUsd - minUsd) / minUsd : 0

  if (sampleCount < 5 || spread > 1.25) {
    return {
      label: "LOW CONFIDENCE",
      className: "border border-amber-500/20 bg-amber-500/10 text-amber-500",
    }
  }

  if (sampleCount < 12 || spread > 0.75) {
    return {
      label: "MEDIUM CONFIDENCE",
      className: "border border-sky-500/20 bg-sky-500/10 text-sky-500",
    }
  }

  return {
    label: "HIGH CONFIDENCE",
    className: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
  }
}

export function formatRegionalVal(v: number, symbol: string) {
  if (symbol === "¥") return `¥${Math.round(v)}M`
  if (v >= 1) {
    const s = v.toFixed(1)
    return s.endsWith(".0") ? `${symbol}${v.toFixed(0)}M` : `${symbol}${s}M`
  }
  const k = Math.round(v * 1000)
  return `${symbol}${k.toLocaleString()}K`
}

export function formatUsdEquiv(v: number) {
  if (v >= 1) {
    const s = v.toFixed(1)
    return s.endsWith(".0") ? `$${v.toFixed(0)}M` : `$${s}M`
  }
  return `$${Math.round(v * 1000).toLocaleString()}K`
}
