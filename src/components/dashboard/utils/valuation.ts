import type { Auction } from "../types"

// ─── REGIONAL VALUATION ───
export type RegionalValuation = { symbol: string; usdCurrent: number }

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function computeRegionalValFromAuctions(
  auctionList: Auction[],
): Record<string, RegionalValuation> {
  const regions = ["US", "UK", "EU", "JP"] as const
  const symbolMap: Record<string, string> = { US: "$", UK: "£", EU: "€", JP: "¥" }
  const result: Record<string, RegionalValuation> = {}

  for (const region of regions) {
    const regionAuctions = auctionList.filter(a => a.region === region)

    // Prices are already normalized to USD
    const soldPricesUsd = regionAuctions
      .filter(a => a.currentBid > 0 && a.status === "ENDED")
      .map(a => a.currentBid)
    const activeBidsUsd = regionAuctions
      .filter(a => a.currentBid > 0 && (a.status === "ACTIVE" || a.status === "ENDING_SOON"))
      .map(a => a.currentBid)

    const medianUsd = soldPricesUsd.length > 0
      ? computeMedian(soldPricesUsd)
      : computeMedian(activeBidsUsd)

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
