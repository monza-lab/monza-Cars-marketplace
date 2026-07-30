import type { ComparableLayer } from "@/lib/fairValue/types"
import type { ModelMarketStats } from "@/lib/reports/types"

export type ValuationEvidence =
  | {
      mode: "valued"
      fairValueLow: number
      fairValueHigh: number
      baseline: number
      comparableLayer: ComparableLayer
      comparablesCount: number
    }
  | {
      mode: "sparse"
      fairValueLow: null
      fairValueHigh: null
      baseline: 0
      comparableLayer: null
      comparablesCount: 0
    }

export function resolveValuationEvidence(
  marketStats: ModelMarketStats | null,
): ValuationEvidence {
  if (!marketStats) {
    return {
      mode: "sparse",
      fairValueLow: null,
      fairValueHigh: null,
      baseline: 0,
      comparableLayer: null,
      comparablesCount: 0,
    }
  }

  const primary = marketStats.regions.find(
    (region) =>
      region.region === marketStats.primaryRegion &&
      region.tier === marketStats.primaryTier,
  )

  return {
    mode: "valued",
    fairValueLow: marketStats.primaryFairValueLow,
    fairValueHigh: marketStats.primaryFairValueHigh,
    baseline: primary ? Math.round(primary.medianPriceUsd) : 0,
    comparableLayer: marketStats.scope === "family" ? "family" : "strict",
    comparablesCount: marketStats.totalDataPoints,
  }
}
