import { describe, expect, it, vi } from "vitest"
import type { PipelineContext } from "../pipeline"
import type { FinalSynthesis } from "../types-v3"
import { executeFinalSynthesis } from "./finalSynthesis"
import { generateJson } from "@/lib/ai/gemini"

vi.mock("@/lib/ai/gemini", () => ({
  generateJson: vi.fn(),
}))

const finalSynthesis: FinalSynthesis = {
  executiveSummary: {
    headline: "Well bought if inspection confirms the records.",
    keyMetrics: {
      fairValueRange: "$140,000-$160,000",
      signalsCoverage: "2/3 signals verified",
      riskScore: 24,
      verdict: "BUY",
      marketPosition: "8% below fair value",
    },
    investmentThesis: "The car has the right specification and market support.",
  },
  finalRecommendation: {
    score: 92,
    conditionEstimate: "excellent",
    verdict: "Recommended subject to PPI.",
  },
}

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
    factoryOptions: ["Clubsport"],
    isSpecialEdition: false,
    listingType: "classified",
  },
  marketData: null,
  fairValue: {
    fair_value_low: 140000,
    fair_value_high: 160000,
    median_price: 150000,
    signals_detected: [{ key: "manual" }, { key: "clubsport" }],
    signals_missing: [{ key: "service_records" }],
  } as PipelineContext["fairValue"],
  technicalAnalysis: null,
  investmentAnalysis: null,
  dueDiligence: {
    questions: [],
    riskScore: { overall: 24, breakdown: [] },
    ppiChecklist: [],
  },
  marketResearch: null,
  buyerServices: null,
  finalSynthesis: null,
}

describe("executeFinalSynthesis", () => {
  it("requests and preserves a 0-100 final recommendation score", async () => {
    vi.mocked(generateJson).mockResolvedValueOnce({ ok: true, data: finalSynthesis, raw: "{}" })

    const result = await executeFinalSynthesis(ctx)

    const prompt = vi.mocked(generateJson).mock.calls[0]?.[0]?.userPrompt ?? ""
    expect(prompt).toMatch(/score: number \(0-100\)/)
    expect(prompt).not.toMatch(/score: number \(1-10\)/)
    expect(result.data?.finalRecommendation.score).toBe(92)
  })

  it("converts legacy 1-10 scores to the displayed 0-100 scale", async () => {
    vi.mocked(generateJson).mockResolvedValueOnce({
      ok: true,
      data: {
        ...finalSynthesis,
        finalRecommendation: { ...finalSynthesis.finalRecommendation, score: 9 },
      },
      raw: "{}",
    })

    const result = await executeFinalSynthesis(ctx)

    expect(result.data?.finalRecommendation.score).toBe(90)
  })
})
