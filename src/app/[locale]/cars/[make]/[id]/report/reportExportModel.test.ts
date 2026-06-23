import { describe, expect, it } from "vitest"
import type { HausReportV3 } from "@/lib/reports/types-v3"
import { buildV3ReportExportModel } from "./reportExportModel"

const v3Report: HausReportV3 = {
  listingId: "live-997-gts",
  reportVersion: 3,
  listingScrape: null,
  vehicleIdentity: {
    year: 2011,
    make: "Porsche",
    model: "911",
    series: "911",
    family: "997",
    variant: "Carrera GTS",
    trim: "997.2 Carrera GTS",
    generationYears: "2009-2012",
    bodyStyle: "Coupe",
    engine: "3.8L flat-six",
    transmission: "PDK",
    drivetrain: "RWD",
    horsepower: 408,
    factoryOptions: ["Sport Chrono", "Center-lock wheels"],
    isSpecialEdition: false,
    listingType: "classified",
  },
  marketData: null,
  technicalAnalysis: {
    modelHistory: "The 997.2 GTS sits at the end of the analog-watercooled 911 arc.",
    whatMakesThisSpecSpecial: "Widebody rear-drive GTS coupes are tightly supplied.",
    productionData: {
      totalProduction: "Limited final-year production",
      thisConfigEstimate: "Few comparable cars",
      rarityAssessment: "rare",
      rarityNote: "Manual and PDK GTS coupes both trade on specification quality.",
    },
    keyStrengths: [
      { point: "Final 997 generation", detail: "Last hydraulic steering generation." },
    ],
    commonIssues: [
      {
        issue: "Center-lock inspection",
        severity: "moderate",
        typicalCost: "$500-$1,000",
        appliesTo: "Check service history before purchase.",
      },
    ],
    reliability: {
      rating: "above_average",
      maintenanceCostLevel: "moderate",
      commonProblems: ["Coil packs", "PDK service intervals"],
    },
    collectorOutlook: {
      investmentGrade: "high",
      demandLevel: "high",
      futureOutlook: "Demand should remain durable for clean GTS examples.",
    },
  },
  investmentAnalysis: {
    strategy: {
      type: "classified",
      maxBidRecommendation: null,
      bidTiming: null,
      reserveStrategy: null,
      openingOffer: 112000,
      walkAwayPrice: 124000,
      negotiationLeverage: ["Ask for center-lock service documentation."],
      strategyInsight: "Negotiate from service evidence, not headline mileage.",
      potentialRepairs: { low: 1500, high: 3500, description: "Baseline service and inspection buffer." },
    },
    ownershipCosts: {
      year1: { totalCost: 4500, breakdown: { valueChange: 1000, maintenance: 3500, majorWork: null }, notes: "Front-loaded service.", confidence: "medium" },
      year3: { totalCost: 9000, breakdown: { valueChange: 2500, maintenance: 6500, majorWork: null }, notes: "Routine ownership.", confidence: "medium" },
      year5: { totalCost: 14000, breakdown: { valueChange: 4000, maintenance: 10000, majorWork: null }, notes: "Longer hold.", confidence: "low" },
    },
    resaleTimeline: {
      year1: { estimatedRange: { low: 116000, high: 128000 }, percentChange: 3, confidence: "medium", keyFactors: ["Mileage discipline"] },
      year3: { estimatedRange: { low: 122000, high: 138000 }, percentChange: 8, confidence: "medium", keyFactors: ["997 GTS scarcity"] },
      year5: { estimatedRange: { low: 130000, high: 150000 }, percentChange: 14, confidence: "low", keyFactors: ["Collector demand"] },
      year10: { estimatedRange: { low: 150000, high: 185000 }, percentChange: 28, confidence: "low", keyFactors: ["Analog premium"] },
    },
    investmentNarrative: "This is a quality-led acquisition candidate, not a bargain hunt.",
  },
  dueDiligence: {
    questions: [
      { category: "essential", question: "Can you provide center-lock service records?", whyItMatters: "Incorrect service creates expensive risk." },
    ],
    riskScore: {
      overall: 32,
      breakdown: [{ category: "Service", score: 40, note: "Records matter more than mileage." }],
    },
    ppiChecklist: [
      { item: "Inspect center-lock wear", priority: "critical", specificTo: "997 GTS center-lock wheels", estimatedCost: "$300-$500" },
    ],
  },
  marketResearch: {
    expertConsensus: {
      compiledAnalysis: [
        { category: "997 GTS", sentiment: "positive", summary: "Specialists continue to treat the GTS as a modern collectible." },
      ],
    },
    ownerSentiment: {
      commonPraise: ["Steering feel"],
      commonComplaints: ["Center-lock upkeep"],
      ownerTips: ["Buy the best documented car."],
    },
    heritage: "The GTS badge marks the driver-focused end of the 997 era.",
    relevantEvents: [],
    ownerClubs: ["Porsche Club of America"],
  },
  buyerServices: {
    partsAvailability: {
      overallRating: "available",
      oemNote: "Core service parts remain available.",
      aftermarketNote: "Specialist support is strong.",
      commonParts: [{ name: "Center-lock hardware", availability: "Dealer order", priceRange: "$800-$1,400" }],
    },
    regionalVariations: {
      strongMarkets: [{ region: "US", premiumPercent: "8%", reason: "Strong GTS demand." }],
      weakerMarkets: [],
    },
    originalMsrp: {
      basePrice: 103100,
      adjustedForInflation: 145000,
      note: "Estimate before options.",
    },
  },
  finalSynthesis: {
    executiveSummary: {
      headline: "Documented 997.2 GTS with durable collector appeal",
      keyMetrics: {
        fairValueRange: "$115,000-$130,000",
        signalsCoverage: "8/10",
        riskScore: 32,
        verdict: "BUY",
        marketPosition: "Below midpoint",
      },
      investmentThesis: "The GTS combines late-997 analog character with broad market recognition.",
    },
    finalRecommendation: {
      score: 82,
      conditionEstimate: "well documented",
      verdict: "BUY",
    },
  },
  generatedAt: "2026-06-23T12:00:00.000Z",
  totalDurationMs: 123000,
  stepsCompleted: 10,
  stepsFailed: 0,
}

describe("buildV3ReportExportModel", () => {
  it("uses the same V3 report data that the page renders", () => {
    const model = buildV3ReportExportModel(v3Report)

    expect(model.title).toBe("Documented 997.2 GTS with durable collector appeal")
    expect(model.metrics).toEqual([
      ["Fair Value", "$115,000-$130,000"],
      ["Signals", "8/10"],
      ["Risk Score", "32/100"],
      ["Verdict", "BUY"],
      ["Market Position", "Below midpoint"],
    ])
    expect(model.sections.map((section) => section.title)).toEqual([
      "Investment Thesis",
      "Acquisition Strategy",
      "Technical Analysis",
      "Due Diligence",
      "Market Research",
      "Buyer Services",
    ])
    expect(model.sections.flatMap((section) => section.rows)).toContainEqual([
      "Strategy Insight",
      "Negotiate from service evidence, not headline mileage.",
    ])
    expect(model.sections.flatMap((section) => section.rows)).toContainEqual([
      "Seller Question",
      "Can you provide center-lock service records? Why it matters: Incorrect service creates expensive risk.",
    ])
    expect(model.searchText).toContain("The GTS combines late-997 analog character")
    expect(model.searchText).toContain("Center-lock inspection")
    expect(model.searchText).toContain("Porsche Club of America")
    expect(model.searchText).toContain("Center-lock hardware")
  })
})
