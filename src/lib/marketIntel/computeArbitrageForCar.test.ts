import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  computeArbitrageForCar,
  inferTargetRegion,
} from "./computeArbitrageForCar"
import type { PricedListingRow } from "@/lib/supabaseLiveListings"

vi.mock("@/lib/landedCost", async () => {
  const actual = await vi.importActual<object>("@/lib/landedCost")
  return {
    ...actual,
    calculateLandedCost: vi.fn(),
  }
})

import { calculateLandedCost } from "@/lib/landedCost"
const calculateLandedCostMock = calculateLandedCost as unknown as ReturnType<typeof vi.fn>

const row = (
  id: string,
  country: string | null,
  price: number,
): PricedListingRow => ({
  id,
  year: 2023,
  make: "Porsche",
  model: "992 GT3",
  trim: null,
  hammer_price: price,
  original_currency: "USD",
  sale_date: null,
  status: "LISTED",
  mileage: null,
  source: "BRING_A_TRAILER",
  country,
})

beforeEach(() => {
  calculateLandedCostMock.mockReset()
})

describe("inferTargetRegion", () => {
  it("maps common countries to regions", () => {
    expect(inferTargetRegion("US")).toBe("US")
    expect(inferTargetRegion("DE")).toBe("EU")
    expect(inferTargetRegion("IT")).toBe("EU")
    expect(inferTargetRegion("GB")).toBe("UK")
    expect(inferTargetRegion("UK")).toBe("UK")
    expect(inferTargetRegion("JP")).toBe("JP")
  })

  it("falls back to US for unknown / null", () => {
    expect(inferTargetRegion("AR")).toBe("US")
    expect(inferTargetRegion(null)).toBe("US")
    expect(inferTargetRegion(undefined)).toBe("US")
  })
})

describe("computeArbitrageForCar", () => {
  it("groups listings by region and picks cheapest per region", async () => {
    calculateLandedCostMock.mockResolvedValue({
      landedCost: { min: 200_000, max: 210_000 },
    })

    const result = await computeArbitrageForCar({
      pricedListings: [
        row("us-1", "US", 230_000),
        row("us-2", "US", 225_000),
        row("eu-1", "DE", 190_000),
        row("eu-2", "IT", 195_000),
        row("uk-1", "UK", 210_000),
        row("jp-1", "JP", 180_000),
      ],
      thisVinPriceUsd: 225_000,
      targetRegion: "US",
      carYear: 2023,
    })

    expect(result.target_region).toBe("US")
    expect(result.by_region.map((r) => r.region).sort()).toEqual([
      "EU",
      "JP",
      "UK",
      "US",
    ])

    // Target region's cheapest should reflect the car being valued, not
    // the cheapest third-party US listing.
    const us = result.by_region.find((r) => r.region === "US")
    expect(us?.cheapest_comparable_usd).toBe(225_000)
    expect(us?.total_landed_to_target_usd).toBe(225_000)

    // EU cheapest should be the $190K DE listing
    const eu = result.by_region.find((r) => r.region === "EU")
    expect(eu?.cheapest_comparable_usd).toBe(190_000)
    expect(eu?.landed_cost_to_target_usd).toBe(15_000) // 205 mid - 190 base
    expect(eu?.total_landed_to_target_usd).toBe(205_000)
  })

  it("skips listings with invalid countries", async () => {
    calculateLandedCostMock.mockResolvedValue({ landedCost: { min: 0, max: 0 } })

    const result = await computeArbitrageForCar({
      pricedListings: [
        row("us-1", "US", 225_000),
        row("unknown-1", "AR", 100_000), // Argentina — not in our 4 regions
        row("null-1", null, 90_000),
      ],
      thisVinPriceUsd: 225_000,
      targetRegion: "US",
      carYear: 2023,
    })

    // Only US should have a comparable; EU/UK/JP are empty
    expect(
      result.by_region.filter((r) => r.cheapest_comparable_usd !== null).map((r) => r.region),
    ).toEqual(["US"])
  })

  it("emits a narrative when EU is cheaper after landed cost", async () => {
    calculateLandedCostMock.mockResolvedValue({
      landedCost: { min: 208_000, max: 212_000 },
    })

    const result = await computeArbitrageForCar({
      pricedListings: [
        row("us-1", "US", 225_000),
        row("eu-1", "DE", 195_000),
      ],
      thisVinPriceUsd: 225_000,
      targetRegion: "US",
      carYear: 2023,
    })

    expect(result.narrative_insight).toMatch(/EU-sourced example costs ~\$15K less/)
  })

  it("returns an empty D2 on unexpected failure, never throws", async () => {
    calculateLandedCostMock.mockRejectedValue(new Error("exchange rates down"))

    const result = await computeArbitrageForCar({
      pricedListings: [
        row("us-1", "US", 225_000),
        row("eu-1", "DE", 195_000),
      ],
      thisVinPriceUsd: 225_000,
      targetRegion: "US",
      carYear: 2023,
    })

    expect(result.by_region).toEqual([])
    expect(result.target_region).toBe("US")
  })
})
