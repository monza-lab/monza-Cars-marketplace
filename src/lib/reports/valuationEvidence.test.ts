import { describe, expect, it } from "vitest"

import type { ModelMarketStats } from "@/lib/reports/types"
import { resolveValuationEvidence } from "./valuationEvidence"

describe("resolveValuationEvidence", () => {
  it("returns an explicit sparse state when no market statistics exist", () => {
    expect(resolveValuationEvidence(null)).toEqual({
      mode: "sparse",
      fairValueLow: null,
      fairValueHigh: null,
      baseline: 0,
      comparableLayer: null,
      comparablesCount: 0,
    })
  })

  it("preserves the primary market evidence for a valued report", () => {
    const marketStats: ModelMarketStats = {
      scope: "series",
      regions: [
        {
          region: "US",
          tier: 1,
          currency: "USD",
          medianPrice: 150_000,
          medianPriceUsd: 150_000,
          p25Price: 140_000,
          p75Price: 170_000,
          minPrice: 130_000,
          maxPrice: 180_000,
          totalListings: 6,
          trendDirection: "stable",
          trendPercent: 0,
          sources: ["test"],
        },
      ],
      primaryFairValueLow: 140_000,
      primaryFairValueHigh: 170_000,
      primaryTier: 1,
      primaryRegion: "US",
      totalDataPoints: 6,
    }

    expect(resolveValuationEvidence(marketStats)).toEqual({
      mode: "valued",
      fairValueLow: 140_000,
      fairValueHigh: 170_000,
      baseline: 150_000,
      comparableLayer: "strict",
      comparablesCount: 6,
    })
  })
})
