// src/lib/reports/types-v3.ts
// V3 multi-agent pipeline type definitions

// ─── Step 1 output: Full listing scrape ───────────────────────────────────────

export interface ScrapedListingFull {
  title: string
  year: number | null
  make: string
  model: string
  trim: string | null
  vin: string | null
  engine: string | null
  transmission: string | null
  drivetrain: string | null
  horsepower: number | null
  torque: string | null
  weight: string | null
  bodyStyle: string | null
  seats: number | null
  mileage: number | null
  mileageUnit: "mi" | "km"
  exteriorColor: string | null
  interiorColor: string | null
  location: string | null
  descriptionFull: string
  sellerNotes: string | null
  auctionComments: string | null
  lotEssay: string | null
  equipmentList: string[]
  modifications: string[]
  photoUrls: string[]
  photoCount: number
  currentBid: number | null
  bidCount: number | null
  reserveStatus: "met" | "not_met" | "no_reserve" | "unknown"
  auctionEndTime: string | null
  askingPrice: number | null
  daysOnMarket: number | null
  priceDrops: { date: string; from: number; to: number }[] | null
  sellerName: string | null
  sellerType: "dealer" | "private" | "auction_house" | null
  sellerLocation: string | null
  scrapedAt: string
  scrapeSuccessful: boolean
  scrapePartial: boolean
  sourceUrl: string
  platform: string
}

// ─── Step 2 output: Vehicle identity ──────────────────────────────────────────

export type ListingType = "auction" | "classified"

export interface VehicleIdentity {
  year: number
  make: string
  model: string
  series: string
  family: string
  variant: string | null
  trim: string | null
  generationYears: string
  engine: string | null
  transmission: string | null
  drivetrain: string | null
  bodyStyle: string | null
  horsepower: number | null
  factoryOptions: string[]
  isSpecialEdition: boolean
  listingType: ListingType
}

// ─── Step 3 output: Market data bundle ────────────────────────────────────────

import type { ModelMarketStats } from "@/lib/reports/types"
import type { MarketIntelD2 } from "@/lib/fairValue/types"

export interface DbComparableRow {
  title: string
  platform: string
  soldDate: string | null
  soldPrice: number
  mileage: number | null
  condition: string | null
}

export interface SimilarCarResult {
  id: string
  title: string
  price: number | null
  platform: string
  sourceUrl: string | null
  images: string[]
}

export interface MarketDataBundle {
  marketStats: ModelMarketStats
  regions: { region: string; median: number; count: number; currency: string }[]
  dbComparables: DbComparableRow[]
  comparablesCount: number
  arbitrage: MarketIntelD2 | null
  similarCars: SimilarCarResult[]
  trendPercent12m: number | null
  trendDirection: "up" | "down" | "flat" | "insufficient_data"
  totalDataPoints: number
  oldestDataPoint: string | null
  newestDataPoint: string | null
  regionsWithData: string[]
}

// ─── Step 5 output: Technical analysis ────────────────────────────────────────

export interface TechnicalAnalysis {
  modelHistory: string
  whatMakesThisSpecSpecial: string
  productionData: {
    totalProduction: string | null
    thisConfigEstimate: string | null
    rarityAssessment: "common" | "uncommon" | "rare" | "very_rare" | "unique"
    rarityNote: string
  }
  keyStrengths: { point: string; detail: string }[]
  commonIssues: {
    issue: string
    severity: "critical" | "moderate" | "minor"
    typicalCost: string | null
    appliesTo: string
  }[]
  reliability: {
    rating: "excellent" | "above_average" | "average" | "below_average" | "poor"
    maintenanceCostLevel: "low" | "moderate" | "high" | "very_high"
    commonProblems: string[]
  }
  collectorOutlook: {
    investmentGrade: "high" | "moderate" | "low" | "speculative"
    demandLevel: "high" | "moderate" | "low"
    futureOutlook: string
  }
}

// ─── Step 6 output: Investment analysis ───────────────────────────────────────

export interface CostProjection {
  totalCost: number
  breakdown: {
    valueChange: number
    insurance: number
    maintenance: number
    majorWork: number | null
  }
  notes: string
  confidence: "high" | "medium" | "low"
}

export interface ResaleProjection {
  estimatedRange: { low: number; high: number }
  percentChange: number
  confidence: "high" | "medium" | "low"
  keyFactors: string[]
}

export interface InvestmentAnalysis {
  strategy: {
    type: ListingType
    maxBidRecommendation: number | null
    bidTiming: string | null
    reserveStrategy: string | null
    openingOffer: number | null
    walkAwayPrice: number | null
    negotiationLeverage: string[]
    strategyInsight: string
    potentialRepairs: { low: number; high: number; description: string }
  }
  ownershipCosts: {
    year1: CostProjection
    year3: CostProjection
    year5: CostProjection
  }
  resaleTimeline: {
    year1: ResaleProjection
    year3: ResaleProjection
    year5: ResaleProjection
    year10: ResaleProjection
  }
  investmentNarrative: string
}

// ─── Step 7 output: Due diligence ─────────────────────────────────────────────

export interface DueDiligenceReport {
  questions: {
    category: "essential" | "vehicle_specific" | "history" | "financial"
    question: string
    whyItMatters: string
  }[]
  riskScore: {
    overall: number
    breakdown: {
      category: string
      score: number
      note: string
    }[]
  }
  ppiChecklist: {
    item: string
    priority: "critical" | "recommended" | "optional"
    specificTo: string
    estimatedCost: string | null
  }[]
}

// ─── Step 8 output: Market research ───────────────────────────────────────────

export interface MarketResearch {
  expertConsensus: {
    compiledAnalysis: {
      category: string
      sentiment: "positive" | "mixed" | "negative"
      summary: string
    }[]
  }
  ownerSentiment: {
    commonPraise: string[]
    commonComplaints: string[]
    ownerTips: string[]
  }
  heritage: string
  relevantEvents: {
    name: string
    frequency: string
    location: string
    description: string
  }[]
  ownerClubs: string[]
}

// ─── Step 9 output: Buyer services ────────────────────────────────────────────

export interface BuyerServices {
  partsAvailability: {
    overallRating: "readily_available" | "available" | "limited" | "scarce"
    oemNote: string
    aftermarketNote: string
    commonParts: { name: string; availability: string; priceRange: string }[]
  }
  insuranceEstimates: {
    collectorPolicy: {
      annualPremium: { low: number; high: number }
      mileageLimit: string
      providers: string[]
    }
    dailyDriver: { annualPremium: { low: number; high: number } } | null
    notes: string
    vehicleCategory: string
  }
  regionalVariations: {
    strongMarkets: { region: string; premiumPercent: string; reason: string }[]
    weakerMarkets: { region: string; discountPercent: string; reason: string }[]
  }
  transportEstimates: {
    recommendation: "enclosed" | "open" | "either"
    specialHandling: string[]
    routes: {
      type: "enclosed" | "open"
      shortHaul: { perMile: string; example: string }
      mediumHaul: { perMile: string; example: string }
      longHaul: { perMile: string; example: string }
    }[]
    seasonalNote: string
    insuranceNote: string
  }
  originalMsrp: {
    basePrice: number | null
    adjustedForInflation: number | null
    note: string
  } | null
}

// ─── Step 10 output: Final synthesis ──────────────────────────────────────────

export type Verdict = "BUY" | "WATCH" | "WALK"

export interface FinalSynthesis {
  executiveSummary: {
    headline: string
    keyMetrics: {
      fairValueRange: string
      signalsCoverage: string
      riskScore: number
      verdict: Verdict
      marketPosition: string
    }
    investmentThesis: string
  }
  finalRecommendation: {
    score: number
    conditionEstimate: string
    verdict: string
  }
}

// ─── Pipeline types ───────────────────────────────────────────────────────────

export type ReportSectionKey =
  | "listing_scrape"
  | "vehicle_identity"
  | "market_data_bundle"
  | "fair_value"
  | "technical_analysis"
  | "investment_analysis"
  | "due_diligence"
  | "market_research"
  | "buyer_services"
  | "final_synthesis"

export type StepStatus = "pending" | "in_progress" | "completed" | "failed"

export interface PipelineStepResult<T = unknown> {
  sectionKey: ReportSectionKey
  data: T
  durationMs: number
  agentModel: string | null
}

export interface PipelineProgress {
  stepId: number
  sectionKey: ReportSectionKey
  label: string
  status: StepStatus
  completionNote?: string
  durationMs?: number
}

// ─── Data trust badges ────────────────────────────────────────────────────────

export type DataTrustLevel =
  | "verified_from_data"
  | "ai_analysis"
  | "ai_estimated"
  | "from_listing"

// ─── Assembled V3 report ──────────────────────────────────────────────────────

export interface HausReportV3 {
  listingId: string
  reportVersion: 3
  listingScrape: ScrapedListingFull | null
  vehicleIdentity: VehicleIdentity | null
  marketData: MarketDataBundle | null
  technicalAnalysis: TechnicalAnalysis | null
  investmentAnalysis: InvestmentAnalysis | null
  dueDiligence: DueDiligenceReport | null
  marketResearch: MarketResearch | null
  buyerServices: BuyerServices | null
  finalSynthesis: FinalSynthesis | null
  generatedAt: string
  totalDurationMs: number
  stepsCompleted: number
  stepsFailed: number
}
