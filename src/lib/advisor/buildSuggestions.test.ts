import { describe, it, expect } from "vitest"
import { buildSuggestions } from "./buildSuggestions"
import type { ChatContext } from "./types"
import type { CollectorCar } from "@/lib/curatedCars"

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_CAR: CollectorCar = {
  id: "test-car-1",
  title: "2004 Porsche 911 GT3",
  year: 2004,
  make: "Porsche",
  model: "911 GT3",
  trim: null,
  price: 120000,
  trend: "up",
  trendValue: 5.2,
  thesis: "Classic GT3 with strong appreciation.",
  image: "/images/test.jpg",
  images: [],
  engine: "3.6L Flat-6",
  transmission: "6-speed manual",
  mileage: 42000,
  mileageUnit: "mi",
  location: "Los Angeles, CA",
  region: "US",
  fairValueByRegion: {
    US: { currency: "$", low: 110000, high: 130000 },
    EU: { currency: "€", low: 100000, high: 120000 },
    UK: { currency: "£", low: 95000, high: 115000 },
    JP: { currency: "¥", low: 15000000, high: 18000000 },
  },
  history: "Single owner, full service history.",
  platform: "BRING_A_TRAILER",
  status: "ACTIVE",
  currentBid: 115000,
  bidCount: 12,
  endTime: new Date("2026-06-01"),
  category: "sports",
  vin: "WP0ZZZ99ZTS392124",
  exteriorColor: "Guards Red",
  interiorColor: "Black",
}

const BASE_CONTEXT: ChatContext = {
  surface: "other",
  locale: "en",
  car: null,
  activeSection: null,
  seriesId: null,
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("buildSuggestions", () => {
  it("surface=dashboard returns exactly 4 suggestions with no raw token or undefined", () => {
    const result = buildSuggestions({ ...BASE_CONTEXT, surface: "dashboard" })

    expect(result).toHaveLength(4)

    for (const s of result) {
      expect(s.label).toBeDefined()
      expect(s.prompt).toBeDefined()
      expect(s.label).not.toContain("{car}")
      expect(s.prompt).not.toContain("{car}")
      expect(s.label).not.toContain("undefined")
      expect(s.prompt).not.toContain("undefined")
    }
  })

  it("surface=report with activeSection=risk and a car returns 4 suggestions; at least one prompt contains the car year", () => {
    const result = buildSuggestions({
      ...BASE_CONTEXT,
      surface: "report",
      activeSection: "risk",
      car: MOCK_CAR,
    })

    expect(result).toHaveLength(4)

    const yearString = String(MOCK_CAR.year)
    const hasYear = result.some(s => s.prompt.includes(yearString))
    expect(hasYear).toBe(true)
  })

  it("surface=report with activeSection=risk and car=null uses generic fallback — no undefined or {car} literal", () => {
    const result = buildSuggestions({
      ...BASE_CONTEXT,
      surface: "report",
      activeSection: "risk",
      car: null,
    })

    expect(result).toHaveLength(4)

    for (const s of result) {
      expect(s.label).not.toContain("{car}")
      expect(s.prompt).not.toContain("{car}")
      expect(s.label).not.toContain("undefined")
      expect(s.prompt).not.toContain("undefined")
    }

    // At least one prompt should use the generic fallback phrase
    const usesGenericFallback = result.some(s => s.prompt.includes("este Porsche"))
    expect(usesGenericFallback).toBe(true)
  })
})
