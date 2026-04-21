import { describe, it, expect } from "vitest"
import {
  computeD1Trajectory,
  computeD2Arbitrage,
  computeD3PeerPositioning,
  computeD4Confidence,
} from "./aggregator"
import type { DbComparableRow } from "@/lib/db/queries"
import type { LandedCostBreakdown } from "@/lib/landedCost"

describe("computeD4Confidence", () => {
  it("returns insufficient when sample below threshold", () => {
    const d4 = computeD4Confidence({
      sample_size: 0,
      capture_date_start: "2026-04-01",
      capture_date_end: "2026-04-21",
      outlier_flags: [],
    })
    expect(d4.confidence_tier).toBe("insufficient")
  })

  it("returns low for small samples", () => {
    const d4 = computeD4Confidence({
      sample_size: 3,
      capture_date_start: "2026-04-01",
      capture_date_end: "2026-04-21",
      outlier_flags: [],
    })
    expect(d4.confidence_tier).toBe("low")
  })

  it("returns medium for moderate samples", () => {
    const d4 = computeD4Confidence({
      sample_size: 12,
      capture_date_start: "2026-04-01",
      capture_date_end: "2026-04-21",
      outlier_flags: [],
    })
    expect(d4.confidence_tier).toBe("medium")
  })

  it("returns high for large samples", () => {
    const d4 = computeD4Confidence({
      sample_size: 50,
      capture_date_start: "2026-04-01",
      capture_date_end: "2026-04-21",
      outlier_flags: [],
    })
    expect(d4.confidence_tier).toBe("high")
  })
})

function mkSold(monthsAgo: number, priceUsd: number): DbComparableRow {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  return {
    id: `c${monthsAgo}-${priceUsd}`,
    year: 2022,
    make: "Porsche",
    model: "992 GT3 Touring",
    hammerPrice: priceUsd,
    originalCurrency: "USD",
    saleDate: d.toISOString().slice(0, 10),
    status: "sold",
    mileage: 5000,
    source: "BaT",
    country: "US",
  } as DbComparableRow
}

describe("computeD1Trajectory", () => {
  it("returns empty trajectory when no sold comparables", () => {
    const d1 = computeD1Trajectory([])
    expect(d1.sold_12m_count).toBe(0)
    expect(d1.sold_trajectory).toEqual([])
    expect(d1.trend_12m_direction).toBe("stable")
  })

  it("aggregates sold prices into monthly median buckets (last 12m)", () => {
    const comps = [mkSold(1, 200000), mkSold(1, 210000), mkSold(6, 195000), mkSold(6, 205000)]
    const d1 = computeD1Trajectory(comps)
    expect(d1.sold_12m_count).toBe(4)
    // Only the 1-month-ago ones are within 6m window (calendar months ≈ 183 days ≠ 180)
    expect(d1.sold_6m_count).toBe(2)
    expect(d1.sold_trajectory.length).toBeGreaterThanOrEqual(2)
    const firstBucket = d1.sold_trajectory[0]
    expect(firstBucket.sample).toBeGreaterThan(0)
    expect(firstBucket.median_usd).toBeGreaterThan(0)
  })
})

describe("computeD2Arbitrage", () => {
  it("returns null cheapest per region when no comparables", async () => {
    const d2 = await computeD2Arbitrage({
      targetRegion: "US",
      comparablesByRegion: { US: [], EU: [], UK: [], JP: [] },
      landedCostResolver: async () => null,
    })
    expect(d2.target_region).toBe("US")
    for (const row of d2.by_region) {
      expect(row.cheapest_comparable_usd).toBeNull()
    }
  })

  it("finds cheapest comparable per region and resolves landed cost", async () => {
    const d2 = await computeD2Arbitrage({
      targetRegion: "US",
      comparablesByRegion: {
        US: [{ id: "u1", priceUsd: 240000, url: "u1.url" }],
        EU: [
          { id: "e1", priceUsd: 195000, url: "e1.url" },
          { id: "e2", priceUsd: 205000, url: "e2.url" },
        ],
        UK: [],
        JP: [],
      },
      landedCostResolver: async (_origin, _destination, priceUsd) =>
        ({
          landedCost: { min: priceUsd + 14000, max: priceUsd + 14000, currency: "USD" },
        }) as unknown as LandedCostBreakdown,
    })
    const eu = d2.by_region.find((r) => r.region === "EU")!
    expect(eu.cheapest_comparable_usd).toBe(195000)
    expect(eu.total_landed_to_target_usd).toBe(209000)
  })
})

describe("computeD3PeerPositioning", () => {
  it("computes percentile within variant", () => {
    const d3 = computeD3PeerPositioning({
      thisVinPriceUsd: 225000,
      variantSoldPricesUsd: [180000, 200000, 210000, 215000, 225000, 240000, 260000, 280000],
      adjacentVariants: [],
    })
    expect(d3.vin_percentile_within_variant).toBeGreaterThanOrEqual(50)
    expect(d3.vin_percentile_within_variant).toBeLessThanOrEqual(75)
    expect(d3.variant_distribution_bins.length).toBeGreaterThan(0)
  })

  it("passes through adjacent variants", () => {
    const d3 = computeD3PeerPositioning({
      thisVinPriceUsd: 225000,
      variantSoldPricesUsd: [],
      adjacentVariants: [
        {
          variant_key: "992_carrera",
          variant_label: "992 Carrera",
          median_usd: 120000,
          sample_size: 40,
        },
      ],
    })
    expect(d3.adjacent_variants).toHaveLength(1)
    expect(d3.adjacent_variants[0].variant_key).toBe("992_carrera")
  })
})
