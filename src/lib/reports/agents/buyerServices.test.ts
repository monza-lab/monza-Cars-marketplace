import { describe, expect, it, vi } from "vitest"
import type { PipelineContext } from "../pipeline"
import type { BuyerServices } from "../types-v3"
import { executeBuyerServices } from "./buyerServices"
import { generateJson } from "@/lib/ai/gemini"

vi.mock("@/lib/ai/gemini", () => ({
  generateJson: vi.fn(),
}))

const buyerServices: BuyerServices = {
  partsAvailability: {
    overallRating: "available",
    oemNote: "Most Porsche service parts remain available.",
    aftermarketNote: "Specialist aftermarket support is broad.",
    commonParts: [],
  },
  regionalVariations: {
    strongMarkets: [],
    weakerMarkets: [],
  },
  originalMsrp: null,
} as BuyerServices

const ctx: PipelineContext = {
  listingId: "listing-1",
  car: {
    id: "listing-1",
    title: "2007 Porsche 911 GT3",
    make: "Porsche",
    model: "911 GT3",
    year: 2007,
  } as PipelineContext["car"],
  listingScrape: null,
  vehicleIdentity: {
    year: 2007,
    make: "Porsche",
    model: "911",
    series: "997",
    family: "997",
    variant: "GT3",
    trim: "GT3",
    generationYears: "2006-2009",
    engine: "3.6L flat-six",
    transmission: "manual",
    drivetrain: "RWD",
    bodyStyle: "coupe",
    horsepower: 415,
    factoryOptions: [],
    isSpecialEdition: false,
    listingType: "classified",
  },
  marketData: {
    regions: [{ region: "US", median: 145000, count: 12, currency: "USD" }],
  } as PipelineContext["marketData"],
  fairValue: null,
  technicalAnalysis: null,
  investmentAnalysis: null,
  dueDiligence: null,
  marketResearch: null,
  buyerServices: null,
  finalSynthesis: null,
}

describe("executeBuyerServices", () => {
  it("does not request insurance or transport estimates for generated v3 reports", async () => {
    vi.mocked(generateJson).mockResolvedValueOnce({ ok: true, data: buyerServices, raw: "{}" })

    await executeBuyerServices(ctx)

    const prompt = vi.mocked(generateJson).mock.calls[0]?.[0]?.userPrompt ?? ""
    expect(prompt).not.toMatch(/insuranceEstimates|transportEstimates|insurance estimate|transport estimate/i)
    expect(prompt).toMatch(/partsAvailability/)
    expect(prompt).toMatch(/regionalVariations/)
    expect(prompt).toMatch(/originalMsrp/)
  })
})
