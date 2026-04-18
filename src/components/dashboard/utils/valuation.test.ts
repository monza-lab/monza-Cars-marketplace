import { describe, expect, it } from "vitest"

import { getSeriesConfig, extractSeries } from "@/lib/brandConfig"
import { computeRegionalValFromAuctions, getValuationConfidence } from "./valuation"
import type { Auction } from "../types"

function makeAuction(overrides: Partial<Auction>): Auction {
  return {
    id: "a1",
    title: "2023 Porsche 992 GT3",
    make: "Porsche",
    model: "992 GT3",
    year: 2023,
    trim: null,
    price: 300000,
    currentBid: 0,
    bidCount: 0,
    viewCount: 0,
    watchCount: 0,
    status: "ACTIVE",
    endTime: "2026-04-18T00:00:00.000Z",
    platform: "AUTO_SCOUT_24",
    engine: null,
    transmission: null,
    exteriorColor: null,
    mileage: null,
    mileageUnit: null,
    location: null,
    region: "US",
    description: null,
    images: [],
    analysis: null,
    priceHistory: [],
    originalCurrency: "USD",
    ...overrides,
  }
}

describe("dashboard valuation helpers", () => {
  it("computes median, average, and sample count per market", () => {
    const listings = [
      makeAuction({
        id: "us-1",
        title: "2023 Porsche 992 GT3",
        model: "992 GT3",
        price: 300000,
        region: "US",
        status: "SOLD",
        platform: "BRING_A_TRAILER",
      }),
      makeAuction({
        id: "us-2",
        title: "2017 Porsche 991 Turbo S",
        model: "991 Turbo S",
        year: 2017,
        price: 280000,
        region: "US",
        status: "ACTIVE",
        platform: "CARS_AND_BIDS",
      }),
      makeAuction({
        id: "eu-1",
        title: "2023 Porsche 992 GT3",
        model: "992 GT3",
        price: 250000,
        currentBid: 0,
        originalCurrency: "EUR",
        region: "EU",
        status: "ACTIVE",
        platform: "AUTO_SCOUT_24",
      }),
    ]

    const all = computeRegionalValFromAuctions(listings, { EUR: 1.1 })

    expect(extractSeries("992 GT3", 2023, "Porsche", "2023 Porsche 992 GT3")).toBe("992")
    expect(getSeriesConfig("992", "Porsche")?.family).toBe("911 Family")

    expect(all.US.sampleCount).toBe(2)
    expect(all.US.usdCurrent).toBeCloseTo(0.29, 2)
    expect(all.US.usdAverage).toBeCloseTo(0.29, 2)

    expect(all.EU.sampleCount).toBe(1)
    expect(all.EU.usdCurrent).toBeCloseTo(0.227, 3)
    expect(all.EU.usdAverage).toBeCloseTo(0.227, 3)

    expect(all.JP.sampleCount).toBe(0)
  })

  it("does not invent a regional value when no local listings exist", () => {
    const listings = [
      makeAuction({
        id: "uk-1",
        title: "2010 Porsche 997 Carrera S",
        model: "997 Carrera S",
        year: 2010,
        price: 160000,
        region: "UK",
        status: "SOLD",
        platform: "AUTO_TRADER",
      }),
    ]

    const all = computeRegionalValFromAuctions(listings, {})

    expect(all.UK.sampleCount).toBe(1)
    expect(all.UK.usdCurrent).toBeCloseTo(0.16, 3)
    expect(all.UK.usdAverage).toBeCloseTo(0.16, 3)
    expect(all.US.sampleCount).toBe(0)
    expect(all.US.usdCurrent).toBe(0)
    expect(getValuationConfidence(all.US.sampleCount, all.US.minUsd, all.US.maxUsd).label).toBe("NO LOCAL DATA")
  })

  it("uses a median-first view that is resistant to trophy-car outliers", () => {
    const listings = [
      makeAuction({ id: "us-1", title: "2008 Porsche 997 Carrera S", model: "997 Carrera S", year: 2008, price: 90000, region: "US", status: "SOLD" }),
      makeAuction({ id: "us-2", title: "2008 Porsche 997 Carrera S", model: "997 Carrera S", year: 2008, price: 94000, region: "US", status: "SOLD" }),
      makeAuction({ id: "us-3", title: "2008 Porsche 997 Carrera S", model: "997 Carrera S", year: 2008, price: 98000, region: "US", status: "SOLD" }),
      makeAuction({ id: "us-4", title: "2008 Porsche 997 Carrera S", model: "997 Carrera S", year: 2008, price: 101000, region: "US", status: "SOLD" }),
      makeAuction({ id: "us-5", title: "2008 Porsche 997 Carrera S", model: "997 Carrera S", year: 2008, price: 104000, region: "US", status: "SOLD" }),
      makeAuction({ id: "us-6", title: "2008 Porsche 997 Carrera S", model: "997 Carrera S", year: 2008, price: 108000, region: "US", status: "SOLD" }),
      makeAuction({ id: "us-7", title: "2008 Porsche 997 Carrera S", model: "997 Carrera S", year: 2008, price: 111000, region: "US", status: "SOLD" }),
      makeAuction({ id: "us-8", title: "2008 Porsche 997 Carrera S", model: "997 Carrera S", year: 2008, price: 115000, region: "US", status: "SOLD" }),
      makeAuction({
        id: "us-outlier",
        title: "2008 Porsche 997 Carrera S Sonderwunsch",
        model: "997 Carrera S",
        year: 2008,
        price: 2500000,
        region: "US",
        status: "SOLD",
      }),
    ]

    const all = computeRegionalValFromAuctions(listings, {})

    expect(all.US.sampleCount).toBe(8)
    expect(all.US.usdCurrent).toBeCloseTo(0.1025, 3)
    expect(all.US.usdAverage).toBeCloseTo(0.102625, 3)
    expect(all.US.minUsd).toBeCloseTo(0.09, 3)
    expect(all.US.maxUsd).toBeCloseTo(0.115, 3)
  })
})
