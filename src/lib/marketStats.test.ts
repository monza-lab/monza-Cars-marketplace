import { describe, it, expect } from "vitest"
import {
  segregateByRegion,
  computeRegionalStats,
  computeMarketStats,
  ISO_TO_SYMBOL,
  SOURCE_REGION,
} from "./marketStats"
import type { PricedListingRecord } from "./reports/types"

// ── Test data factory ──
function makeListing(overrides: Partial<PricedListingRecord> = {}): PricedListingRecord {
  return {
    id: "test-1",
    year: 2020,
    make: "Porsche",
    model: "911 Carrera",
    trim: null,
    hammerPrice: 100000,
    originalCurrency: "USD",
    saleDate: "2025-06-15",
    status: "sold",
    mileage: 15000,
    source: "Bring a Trailer",
    country: "US",
    ...overrides,
  }
}

describe("ISO_TO_SYMBOL", () => {
  it("maps common ISO codes to symbols", () => {
    expect(ISO_TO_SYMBOL["USD"]).toBe("$")
    expect(ISO_TO_SYMBOL["EUR"]).toBe("€")
    expect(ISO_TO_SYMBOL["GBP"]).toBe("£")
    expect(ISO_TO_SYMBOL["CHF"]).toBe("CHF")
  })
})

describe("SOURCE_REGION", () => {
  it("maps known sources to region/tier", () => {
    expect(SOURCE_REGION["Bring a Trailer"]).toEqual({ region: "US", tier: 1, currency: "USD" })
    expect(SOURCE_REGION["AutoScout24"]).toEqual({ region: "EU", tier: 2, currency: "EUR" })
    expect(SOURCE_REGION["AutoTrader"]).toEqual({ region: "UK", tier: 2, currency: "GBP" })
  })
})

describe("segregateByRegion", () => {
  it("groups listings by region-tier key", () => {
    const listings = [
      makeListing({ id: "1", source: "Bring a Trailer", status: "sold" }),
      makeListing({ id: "2", source: "Bring a Trailer", status: "sold" }),
      makeListing({ id: "3", source: "AutoScout24", status: "active", originalCurrency: "EUR", hammerPrice: 90000 }),
      makeListing({ id: "4", source: "AutoScout24", status: "delisted", originalCurrency: "EUR", hammerPrice: 85000 }),
    ]
    const result = segregateByRegion(listings)
    expect(result.has("US-1")).toBe(true)
    expect(result.get("US-1")!.listings).toHaveLength(2)
    expect(result.has("EU-2")).toBe(true)
    expect(result.get("EU-2")!.listings).toHaveLength(1) // only active
    expect(result.has("EU-3")).toBe(true)
    expect(result.get("EU-3")!.listings).toHaveLength(1) // delisted
  })

  it("skips listings with unknown source", () => {
    const listings = [makeListing({ source: "UnknownPlatform" })]
    const result = segregateByRegion(listings)
    expect(result.size).toBe(0)
  })
})

describe("computeRegionalStats", () => {
  it("returns null for fewer than 3 listings", () => {
    const listings = [makeListing({ id: "1" }), makeListing({ id: "2" })]
    expect(computeRegionalStats(listings, "US", 1, "USD")).toBeNull()
  })

  it("computes correct P25/P50/P75 for 5 listings", () => {
    const prices = [80000, 90000, 100000, 110000, 120000]
    const listings = prices.map((p, i) =>
      makeListing({ id: `${i}`, hammerPrice: p, originalCurrency: "USD" })
    )
    const stats = computeRegionalStats(listings, "US", 1, "USD")!
    expect(stats).not.toBeNull()
    expect(stats.totalListings).toBe(5)
    expect(stats.medianPrice).toBe(100000)
    expect(stats.minPrice).toBe(80000)
    expect(stats.maxPrice).toBe(120000)
    expect(stats.p25Price).toBe(90000)
    expect(stats.p75Price).toBe(110000)
    expect(stats.avgPrice).toBe(100000)
    expect(stats.region).toBe("US")
    expect(stats.tier).toBe(1)
    expect(stats.tierLabel).toBe("Verified Sales")
  })

  it("converts EUR listings to USD for medianPriceUsd", () => {
    const listings = [
      makeListing({ id: "1", hammerPrice: 90000, originalCurrency: "EUR" }),
      makeListing({ id: "2", hammerPrice: 100000, originalCurrency: "EUR" }),
      makeListing({ id: "3", hammerPrice: 110000, originalCurrency: "EUR" }),
    ]
    const stats = computeRegionalStats(listings, "EU", 2, "EUR", { EUR: 0.92 })!
    expect(stats.medianPrice).toBe(100000) // native EUR
    expect(stats.medianPriceUsd).toBeGreaterThan(100000) // 100000 / 0.92 ≈ 108696
  })

  it("computes trend direction from date splits", () => {
    const now = new Date()
    const recentDate = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
    const oldDate = new Date(now.getTime() - 300 * 86400000).toISOString().slice(0, 10)
    const listings = [
      makeListing({ id: "1", hammerPrice: 80000, saleDate: oldDate }),
      makeListing({ id: "2", hammerPrice: 85000, saleDate: oldDate }),
      makeListing({ id: "3", hammerPrice: 100000, saleDate: recentDate }),
      makeListing({ id: "4", hammerPrice: 105000, saleDate: recentDate }),
    ]
    const stats = computeRegionalStats(listings, "US", 1, "USD")!
    expect(stats.trendDirection).toBe("up")
    expect(stats.trendPercent).toBeGreaterThan(3)
  })
})

describe("computeMarketStats", () => {
  it("returns null when no region has 3+ listings", () => {
    const listings = [makeListing({ id: "1" }), makeListing({ id: "2" })]
    expect(computeMarketStats(listings, "series")).toBeNull()
  })

  it("selects Tier 1 as primary over Tier 2", () => {
    const batListings = Array.from({ length: 3 }, (_, i) =>
      makeListing({ id: `bat-${i}`, source: "Bring a Trailer", hammerPrice: 100000 + i * 10000 })
    )
    const asListings = Array.from({ length: 5 }, (_, i) =>
      makeListing({ id: `as-${i}`, source: "AutoScout24", status: "active", hammerPrice: 90000 + i * 10000, originalCurrency: "EUR" })
    )
    const stats = computeMarketStats([...batListings, ...asListings], "series")!
    expect(stats).not.toBeNull()
    expect(stats.primaryTier).toBe(1)
    expect(stats.primaryRegion).toBe("US")
    expect(stats.regions.length).toBe(2) // US-1 and EU-2
    expect(stats.totalDataPoints).toBe(8)
  })

  it("falls back to Tier 2 when no Tier 1 data", () => {
    const listings = Array.from({ length: 5 }, (_, i) =>
      makeListing({ id: `as-${i}`, source: "AutoScout24", status: "active", hammerPrice: 90000 + i * 10000, originalCurrency: "EUR" })
    )
    const stats = computeMarketStats(listings, "series")!
    expect(stats.primaryTier).toBe(2)
    expect(stats.primaryRegion).toBe("EU")
  })

  it("accepts rates parameter for USD conversion", () => {
    const listings = Array.from({ length: 3 }, (_, i) =>
      makeListing({
        id: `eur-${i}`,
        source: "AutoScout24",
        status: "active",
        hammerPrice: 90000 + i * 10000,
        originalCurrency: "EUR",
      })
    )
    // Pass custom rates where 1 USD = 0.50 EUR (i.e. EUR is very strong)
    const stats = computeMarketStats(listings, "series", { EUR: 0.5 })!
    expect(stats).not.toBeNull()
    // median EUR price = 100000, with rate 0.5: 100000 / 0.5 = 200000 USD
    expect(stats.primaryFairValueLow).toBeGreaterThan(150000)
  })
})
