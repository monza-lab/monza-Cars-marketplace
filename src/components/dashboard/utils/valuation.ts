import type { Auction } from "../types"
import { toUsd } from "@/lib/exchangeRates"

// ─── REGIONAL VALUATION ───
export type RegionalValuation = { symbol: string; usdCurrent: number }

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
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

  // Compute overall median as fallback for regions with no listings
  const allPricesUsd = auctionList
    .map(a => listingPriceUsd(a, rates))
    .filter(p => p > 0)
  const overallMedianUsd = computeMedian(allPricesUsd)

  for (const region of regions) {
    const regionAuctions = auctionList.filter(a => a.region === region)

    // Use listing/sold price converted to USD
    const soldPricesUsd = regionAuctions
      .filter(a => a.status === "ENDED")
      .map(a => listingPriceUsd(a, rates))
      .filter(p => p > 0)
    const listingPricesUsd = regionAuctions
      .map(a => listingPriceUsd(a, rates))
      .filter(p => p > 0)

    // Prefer median of sold prices; fall back to median of all listing prices
    let medianUsd = soldPricesUsd.length > 0
      ? computeMedian(soldPricesUsd)
      : computeMedian(listingPricesUsd)

    // Fallback to overall median if no listings in this region
    if (medianUsd === 0 && overallMedianUsd > 0) {
      medianUsd = overallMedianUsd
    }

    result[region] = {
      symbol: symbolMap[region],
      usdCurrent: medianUsd / 1_000_000,
    }
  }
  return result
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
