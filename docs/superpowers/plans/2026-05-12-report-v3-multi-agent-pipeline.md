# Report V3: Multi-Agent Intelligence Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-pass `/api/analyze` report generation into a 10-step multi-agent pipeline producing 30 rich sections (vs current 5), with a cinematic photo-slideshow loading experience and clear data-trust badges.

**Architecture:** A pipeline orchestrator dispatches 10 steps (3 tiers of parallelism) — 4 data-gathering steps, 5 AI agent steps, 1 synthesis step. Each step persists its output as a JSONB row in a new `report_sections` table. The client receives Server-Sent Events for real-time progress. New V3 section components render the expanded report with data-trust badges.

**Tech Stack:** Next.js 16 (App Router), Gemini 2.5 Flash (AI agents), Supabase (DB + SSE), Framer Motion (animations), react-pdf (PDF export), ExcelJS (Excel export), Scrapling/Playwright (listing scrape).

**Spec:** `docs/superpowers/specs/2026-05-12-report-v3-multi-agent-pipeline-design.md`

---

## Chunk 1: Types, DB Schema & Pipeline Orchestrator

This chunk establishes the foundation — all V3 TypeScript interfaces, the `report_sections` database table, and the pipeline orchestrator that coordinates the 10 steps with parallelization.

---

### Task 1: V3 Report Types

**Files:**
- Create: `src/lib/reports/types-v3.ts`
- Test: `src/lib/reports/__tests__/types-v3.test.ts`

- [ ] **Step 1: Write the type definitions file**

Create all V3 interfaces as specified in the design doc. These are pure types — no runtime logic.

```typescript
// src/lib/reports/types-v3.ts

// ─── Step 1 output: Full listing scrape ───
export interface ScrapedListingFull {
  // Identity
  title: string
  year: number | null
  make: string
  model: string
  trim: string | null
  vin: string | null

  // Specs
  engine: string | null
  transmission: string | null
  drivetrain: string | null
  horsepower: number | null
  torque: string | null
  weight: string | null
  bodyStyle: string | null
  seats: number | null

  // Condition & history
  mileage: number | null
  mileageUnit: "mi" | "km"
  exteriorColor: string | null
  interiorColor: string | null
  location: string | null

  // Full text content
  descriptionFull: string
  sellerNotes: string | null
  auctionComments: string | null
  lotEssay: string | null

  // Equipment & options
  equipmentList: string[]
  modifications: string[]

  // Media
  photoUrls: string[]
  photoCount: number

  // Auction-specific
  currentBid: number | null
  bidCount: number | null
  reserveStatus: "met" | "not_met" | "no_reserve" | "unknown"
  auctionEndTime: string | null

  // Classified-specific
  askingPrice: number | null
  daysOnMarket: number | null
  priceDrops: { date: string; from: number; to: number }[] | null

  // Seller
  sellerName: string | null
  sellerType: "dealer" | "private" | "auction_house" | null
  sellerLocation: string | null

  // Meta
  scrapedAt: string
  scrapeSuccessful: boolean
  scrapePartial: boolean
  sourceUrl: string
  platform: string
}

// ─── Step 2 output: Vehicle identity ───
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

// ─── Step 3 output: Market data bundle ───
// Re-exports existing types from the pricing/reports pipeline
import type { ModelMarketStats } from "@/lib/reports/types"
import type { DbComparableRow } from "@/lib/db/queries"
import type { MarketIntelD2 } from "@/lib/fairValue/types"

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

// ─── Step 5 output: Technical analysis ───
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

// ─── Step 6 output: Investment analysis ───
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

// ─── Step 7 output: Due diligence ───
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

// ─── Step 8 output: Market research ───
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

// ─── Step 9 output: Buyer services ───
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

// ─── Step 10 output: Final synthesis ───
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

// ─── Pipeline types ───
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

// ─── Data trust badges ───
export type DataTrustLevel =
  | "verified_from_data"
  | "ai_analysis"
  | "ai_estimated"
  | "from_listing"

// ─── Assembled V3 report ───
export interface HausReportV3 {
  listingId: string
  reportVersion: 3

  // Step outputs (all nullable — pipeline continues on step failure)
  listingScrape: ScrapedListingFull | null
  vehicleIdentity: VehicleIdentity | null
  marketData: MarketDataBundle | null
  // fair_value stays in existing HausReport (backward compat)
  technicalAnalysis: TechnicalAnalysis | null
  investmentAnalysis: InvestmentAnalysis | null
  dueDiligence: DueDiligenceReport | null
  marketResearch: MarketResearch | null
  buyerServices: BuyerServices | null
  finalSynthesis: FinalSynthesis | null

  // Meta
  generatedAt: string
  totalDurationMs: number
  stepsCompleted: number
  stepsFailed: number
}
```

- [ ] **Step 2: Write basic type validation tests**

```typescript
// src/lib/reports/__tests__/types-v3.test.ts
import type {
  ScrapedListingFull,
  VehicleIdentity,
  TechnicalAnalysis,
  InvestmentAnalysis,
  DueDiligenceReport,
  MarketResearch,
  BuyerServices,
  FinalSynthesis,
  HausReportV3,
  ReportSectionKey,
  ListingType,
} from "../types-v3"

// Type-level compile tests — if this file compiles, types are correct
describe("V3 Report Types", () => {
  it("ReportSectionKey covers all 10 steps", () => {
    const keys: ReportSectionKey[] = [
      "listing_scrape",
      "vehicle_identity",
      "market_data_bundle",
      "fair_value",
      "technical_analysis",
      "investment_analysis",
      "due_diligence",
      "market_research",
      "buyer_services",
      "final_synthesis",
    ]
    expect(keys).toHaveLength(10)
  })

  it("ListingType is auction or classified", () => {
    const types: ListingType[] = ["auction", "classified"]
    expect(types).toHaveLength(2)
  })

  it("HausReportV3 shape is valid", () => {
    const report: HausReportV3 = {
      listingId: "test-123",
      reportVersion: 3,
      listingScrape: null,
      vehicleIdentity: {
        year: 2024,
        make: "Porsche",
        model: "911 GT3 RS",
        series: "992",
        family: "911",
        variant: "GT3 RS",
        trim: null,
        generationYears: "2019-2025",
        engine: "4.0L flat-six",
        transmission: "7-speed PDK",
        drivetrain: "RWD",
        bodyStyle: "Coupe",
        horsepower: 518,
        factoryOptions: ["PCCB", "Weissach Package"],
        isSpecialEdition: true,
        listingType: "classified",
      },
      marketData: {
        marketStats: {} as any,
        regions: [],
        dbComparables: [],
        comparablesCount: 0,
        arbitrage: null,
        similarCars: [],
        trendPercent12m: null,
        trendDirection: "insufficient_data",
        totalDataPoints: 0,
        oldestDataPoint: null,
        newestDataPoint: null,
        regionsWithData: [],
      },
      technicalAnalysis: null,
      investmentAnalysis: null,
      dueDiligence: null,
      marketResearch: null,
      buyerServices: null,
      finalSynthesis: null,
      generatedAt: new Date().toISOString(),
      totalDurationMs: 0,
      stepsCompleted: 0,
      stepsFailed: 0,
    }
    expect(report.reportVersion).toBe(3)
  })
})
```

- [ ] **Step 3: Run test to verify it compiles and passes**

Run: `npx jest src/lib/reports/__tests__/types-v3.test.ts --no-cache`
Expected: PASS — 3 tests pass (type-level compile check)

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/types-v3.ts src/lib/reports/__tests__/types-v3.test.ts
git commit -m "feat(reports): add V3 multi-agent pipeline type definitions"
```

---

### Task 2: Database — `report_sections` Table

**Files:**
- Create: `src/lib/reports/reportSections.ts`
- Test: `src/lib/reports/__tests__/reportSections.test.ts`

- [ ] **Step 1: Create the migration via Supabase MCP**

Apply SQL migration to create the `report_sections` table:

```sql
-- V3 Report Sections: stores each pipeline agent's output as a separate JSONB row
CREATE TABLE IF NOT EXISTS report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id TEXT NOT NULL,
  report_version INTEGER NOT NULL DEFAULT 1,
  section_key TEXT NOT NULL,
  section_data JSONB NOT NULL,
  agent_model TEXT,
  generation_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(listing_id, report_version, section_key)
);

-- Index for fast lookup by listing
CREATE INDEX IF NOT EXISTS idx_report_sections_listing
  ON report_sections(listing_id, report_version);

-- RLS: allow authenticated users to read their own reports
ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read report sections"
  ON report_sections FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert report sections"
  ON report_sections FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update report sections"
  ON report_sections FOR UPDATE
  USING (true);
```

- [ ] **Step 2: Write the CRUD module**

```typescript
// src/lib/reports/reportSections.ts
import { createClient } from "@/lib/supabase/server"
import type { ReportSectionKey, PipelineStepResult } from "./types-v3"

export interface ReportSectionRow {
  id: string
  listing_id: string
  report_version: number
  section_key: ReportSectionKey
  section_data: unknown
  agent_model: string | null
  generation_duration_ms: number | null
  created_at: string
}

/**
 * Upsert a single pipeline step result into report_sections.
 * Uses ON CONFLICT (listing_id, report_version, section_key) to allow re-generation.
 */
export async function saveReportSection(
  listingId: string,
  reportVersion: number,
  result: PipelineStepResult
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("report_sections").upsert(
    {
      listing_id: listingId,
      report_version: reportVersion,
      section_key: result.sectionKey,
      section_data: result.data,
      agent_model: result.agentModel,
      generation_duration_ms: result.durationMs,
    },
    { onConflict: "listing_id,report_version,section_key" }
  )
  if (error) {
    console.error(`[reportSections] Failed to save ${result.sectionKey}:`, error)
    throw error
  }
}

/**
 * Fetch all sections for a listing+version. Returns empty array if none exist.
 */
export async function fetchReportSections(
  listingId: string,
  reportVersion: number
): Promise<ReportSectionRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("report_sections")
    .select("*")
    .eq("listing_id", listingId)
    .eq("report_version", reportVersion)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[reportSections] Failed to fetch sections:", error)
    return []
  }
  return (data ?? []) as ReportSectionRow[]
}

/**
 * Check if a V3 report has already been generated (cache hit).
 * Returns true if at least the final_synthesis section exists.
 */
export async function hasV3Report(
  listingId: string,
  reportVersion: number = 1
): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("report_sections")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .eq("report_version", reportVersion)
    .eq("section_key", "final_synthesis")

  if (error) return false
  return (count ?? 0) > 0
}

/**
 * Delete all sections for a listing (for regeneration).
 */
export async function deleteReportSections(
  listingId: string,
  reportVersion: number
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("report_sections")
    .delete()
    .eq("listing_id", listingId)
    .eq("report_version", reportVersion)

  if (error) {
    console.error("[reportSections] Failed to delete sections:", error)
    throw error
  }
}
```

- [ ] **Step 3: Write tests for CRUD module**

```typescript
// src/lib/reports/__tests__/reportSections.test.ts
import {
  saveReportSection,
  fetchReportSections,
  hasV3Report,
  deleteReportSections,
} from "../reportSections"
import type { PipelineStepResult } from "../types-v3"

// These tests require a Supabase connection (integration tests)
// Skip in CI if SUPABASE_URL is not set
const skipIfNoSupabase = process.env.SUPABASE_URL ? describe : describe.skip

skipIfNoSupabase("reportSections CRUD", () => {
  const testListingId = `test-v3-${Date.now()}`
  const testVersion = 999 // high version to avoid collisions

  afterAll(async () => {
    // Clean up test data
    await deleteReportSections(testListingId, testVersion)
  })

  it("saves a section", async () => {
    const result: PipelineStepResult = {
      sectionKey: "vehicle_identity",
      data: { year: 2024, make: "Porsche", model: "911 GT3 RS", series: "992" },
      durationMs: 150,
      agentModel: null,
    }
    await expect(
      saveReportSection(testListingId, testVersion, result)
    ).resolves.not.toThrow()
  })

  it("fetches saved sections", async () => {
    const rows = await fetchReportSections(testListingId, testVersion)
    expect(rows).toHaveLength(1)
    expect(rows[0].section_key).toBe("vehicle_identity")
    expect((rows[0].section_data as any).series).toBe("992")
  })

  it("hasV3Report returns false when no final_synthesis", async () => {
    const has = await hasV3Report(testListingId, testVersion)
    expect(has).toBe(false)
  })

  it("hasV3Report returns true after saving final_synthesis", async () => {
    await saveReportSection(testListingId, testVersion, {
      sectionKey: "final_synthesis",
      data: { executiveSummary: { headline: "Test" } },
      durationMs: 500,
      agentModel: "gemini-2.5-flash",
    })
    const has = await hasV3Report(testListingId, testVersion)
    expect(has).toBe(true)
  })

  it("upsert overwrites existing section", async () => {
    await saveReportSection(testListingId, testVersion, {
      sectionKey: "vehicle_identity",
      data: { year: 2025, make: "Porsche", model: "911 GT3", series: "992" },
      durationMs: 200,
      agentModel: null,
    })
    const rows = await fetchReportSections(testListingId, testVersion)
    const vi = rows.find((r) => r.section_key === "vehicle_identity")
    expect((vi?.section_data as any).year).toBe(2025)
  })
})
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/lib/reports/__tests__/reportSections.test.ts --no-cache`
Expected: PASS (or SKIP if no Supabase env vars)

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/reportSections.ts src/lib/reports/__tests__/reportSections.test.ts
git commit -m "feat(reports): add report_sections CRUD for V3 pipeline persistence"
```

---

### Task 3: Pipeline Orchestrator

**Files:**
- Create: `src/lib/reports/pipeline.ts`
- Test: `src/lib/reports/__tests__/pipeline.test.ts`

The orchestrator coordinates all 10 steps with proper parallelization (Steps 2/3/4 in parallel, Steps 5/6/7 in parallel, Steps 8/9 in parallel, Step 10 last). It emits progress callbacks for the UI stepper.

- [ ] **Step 1: Write the failing test — orchestrator runs steps in correct order**

```typescript
// src/lib/reports/__tests__/pipeline.test.ts
import { runV3Pipeline, type PipelineContext, type StepExecutor } from "../pipeline"

// Mock step executors that record call order
function createMockExecutors() {
  const callOrder: string[] = []
  const executors: Record<string, StepExecutor> = {}

  const stepNames = [
    "listing_scrape",
    "vehicle_identity",
    "market_data_bundle",
    "fair_value",
    "technical_analysis",
    "investment_analysis",
    "due_diligence",
    "market_research",
    "buyer_services",
    "final_synthesis",
  ]

  for (const name of stepNames) {
    executors[name] = async (ctx: PipelineContext) => {
      callOrder.push(name)
      // Simulate 10ms of work
      await new Promise((r) => setTimeout(r, 10))
      return { data: { mock: name }, durationMs: 10, agentModel: null }
    }
  }

  return { callOrder, executors }
}

describe("V3 Pipeline Orchestrator", () => {
  it("runs Step 1 first", async () => {
    const { callOrder, executors } = createMockExecutors()
    const progress: string[] = []

    await runV3Pipeline({
      listingId: "test-123",
      car: {} as any,
      executors,
      onProgress: (p) => progress.push(p.sectionKey),
    })

    // Step 1 must be first
    expect(callOrder[0]).toBe("listing_scrape")
  })

  it("runs Steps 2/3/4 in parallel after Step 1", async () => {
    const { callOrder, executors } = createMockExecutors()

    await runV3Pipeline({
      listingId: "test-123",
      car: {} as any,
      executors,
      onProgress: () => {},
    })

    // Steps 2, 3, 4 should all start after step 1 finishes
    const step1Idx = callOrder.indexOf("listing_scrape")
    const step2Idx = callOrder.indexOf("vehicle_identity")
    const step3Idx = callOrder.indexOf("market_data_bundle")
    const step4Idx = callOrder.indexOf("fair_value")

    expect(step2Idx).toBeGreaterThan(step1Idx)
    expect(step3Idx).toBeGreaterThan(step1Idx)
    expect(step4Idx).toBeGreaterThan(step1Idx)
  })

  it("runs Step 10 last", async () => {
    const { callOrder, executors } = createMockExecutors()

    await runV3Pipeline({
      listingId: "test-123",
      car: {} as any,
      executors,
      onProgress: () => {},
    })

    expect(callOrder[callOrder.length - 1]).toBe("final_synthesis")
  })

  it("continues on step failure (graceful degradation)", async () => {
    const { callOrder, executors } = createMockExecutors()

    // Make technical_analysis fail
    executors["technical_analysis"] = async () => {
      throw new Error("Gemini timeout")
    }

    const result = await runV3Pipeline({
      listingId: "test-123",
      car: {} as any,
      executors,
      onProgress: () => {},
    })

    // Pipeline should still complete (final_synthesis runs)
    expect(callOrder).toContain("final_synthesis")
    expect(result.stepsFailed).toBeGreaterThanOrEqual(1)
  })

  it("emits progress for all 10 steps", async () => {
    const { executors } = createMockExecutors()
    const progress: string[] = []

    await runV3Pipeline({
      listingId: "test-123",
      car: {} as any,
      executors,
      onProgress: (p) => progress.push(`${p.sectionKey}:${p.status}`),
    })

    // Should have in_progress + completed for each step (or failed)
    expect(progress.length).toBeGreaterThanOrEqual(20) // 10 starts + 10 completions
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/reports/__tests__/pipeline.test.ts --no-cache`
Expected: FAIL with "Cannot find module '../pipeline'"

- [ ] **Step 3: Write the pipeline orchestrator**

```typescript
// src/lib/reports/pipeline.ts
import type { CollectorCar } from "@/lib/curatedCars"
import type {
  ReportSectionKey,
  PipelineStepResult,
  PipelineProgress,
  StepStatus,
  HausReportV3,
  ScrapedListingFull,
  VehicleIdentity,
  MarketDataBundle,
  TechnicalAnalysis,
  InvestmentAnalysis,
  DueDiligenceReport,
  MarketResearch,
  BuyerServices,
  FinalSynthesis,
} from "./types-v3"
import type { HausReport } from "@/lib/fairValue/types"

/**
 * Context passed to each step executor — accumulates outputs from prior steps.
 */
export interface PipelineContext {
  listingId: string
  car: CollectorCar

  // Accumulated outputs (null until their step completes)
  listingScrape: ScrapedListingFull | null
  vehicleIdentity: VehicleIdentity | null
  marketData: MarketDataBundle | null
  fairValue: HausReport | null
  technicalAnalysis: TechnicalAnalysis | null
  investmentAnalysis: InvestmentAnalysis | null
  dueDiligence: DueDiligenceReport | null
  marketResearch: MarketResearch | null
  buyerServices: BuyerServices | null
  finalSynthesis: FinalSynthesis | null
}

/**
 * A step executor receives the pipeline context and returns its output.
 */
export type StepExecutor = (
  ctx: PipelineContext
) => Promise<{ data: unknown; durationMs: number; agentModel: string | null }>

export interface PipelineInput {
  listingId: string
  car: CollectorCar
  executors: Record<string, StepExecutor>
  onProgress: (progress: PipelineProgress) => void
}

interface StepDef {
  stepId: number
  sectionKey: ReportSectionKey
  label: string
}

const STEP_DEFS: StepDef[] = [
  { stepId: 1, sectionKey: "listing_scrape", label: "Reading Listing" },
  { stepId: 2, sectionKey: "vehicle_identity", label: "Identifying Vehicle" },
  { stepId: 3, sectionKey: "market_data_bundle", label: "Analyzing Market Data" },
  { stepId: 4, sectionKey: "fair_value", label: "Computing Fair Value" },
  { stepId: 5, sectionKey: "technical_analysis", label: "Technical Deep-Dive" },
  { stepId: 6, sectionKey: "investment_analysis", label: "Investment Analysis" },
  { stepId: 7, sectionKey: "due_diligence", label: "Due Diligence" },
  { stepId: 8, sectionKey: "market_research", label: "Market Research" },
  { stepId: 9, sectionKey: "buyer_services", label: "Buyer Services" },
  { stepId: 10, sectionKey: "final_synthesis", label: "Final Report" },
]

function emitProgress(
  onProgress: (p: PipelineProgress) => void,
  step: StepDef,
  status: StepStatus,
  completionNote?: string,
  durationMs?: number
) {
  onProgress({
    stepId: step.stepId,
    sectionKey: step.sectionKey,
    label: step.label,
    status,
    completionNote,
    durationMs,
  })
}

async function runStep(
  step: StepDef,
  ctx: PipelineContext,
  executors: Record<string, StepExecutor>,
  onProgress: (p: PipelineProgress) => void
): Promise<PipelineStepResult | null> {
  const executor = executors[step.sectionKey]
  if (!executor) {
    console.warn(`[pipeline] No executor for ${step.sectionKey}, skipping`)
    emitProgress(onProgress, step, "failed", "No executor")
    return null
  }

  emitProgress(onProgress, step, "in_progress")
  const t0 = Date.now()

  try {
    const result = await executor(ctx)
    const duration = Date.now() - t0
    const stepResult: PipelineStepResult = {
      sectionKey: step.sectionKey,
      data: result.data,
      durationMs: result.durationMs || duration,
      agentModel: result.agentModel,
    }

    emitProgress(onProgress, step, "completed", undefined, duration)
    return stepResult
  } catch (err) {
    const duration = Date.now() - t0
    console.error(`[pipeline] Step ${step.sectionKey} failed:`, err)
    emitProgress(
      onProgress,
      step,
      "failed",
      err instanceof Error ? err.message : "Unknown error",
      duration
    )
    return null
  }
}

async function runParallel(
  steps: StepDef[],
  ctx: PipelineContext,
  executors: Record<string, StepExecutor>,
  onProgress: (p: PipelineProgress) => void
): Promise<(PipelineStepResult | null)[]> {
  return Promise.all(
    steps.map((step) => runStep(step, ctx, executors, onProgress))
  )
}

function assignResult(ctx: PipelineContext, result: PipelineStepResult | null) {
  if (!result) return
  switch (result.sectionKey) {
    case "listing_scrape":
      ctx.listingScrape = result.data as ScrapedListingFull
      break
    case "vehicle_identity":
      ctx.vehicleIdentity = result.data as VehicleIdentity
      break
    case "market_data_bundle":
      ctx.marketData = result.data as MarketDataBundle
      break
    case "fair_value":
      ctx.fairValue = result.data as HausReport
      break
    case "technical_analysis":
      ctx.technicalAnalysis = result.data as TechnicalAnalysis
      break
    case "investment_analysis":
      ctx.investmentAnalysis = result.data as InvestmentAnalysis
      break
    case "due_diligence":
      ctx.dueDiligence = result.data as DueDiligenceReport
      break
    case "market_research":
      ctx.marketResearch = result.data as MarketResearch
      break
    case "buyer_services":
      ctx.buyerServices = result.data as BuyerServices
      break
    case "final_synthesis":
      ctx.finalSynthesis = result.data as FinalSynthesis
      break
  }
}

/**
 * Run the full V3 report generation pipeline.
 *
 * Parallelization tiers:
 *   Tier 0: Step 1 (listing scrape) — must run first
 *   Tier 1: Steps 2, 3, 4 (identity, market data, fair value) — parallel
 *   Tier 2: Steps 5, 6, 7 (technical, investment, due diligence) — parallel
 *   Tier 3: Steps 8, 9 (market research, buyer services) — parallel
 *   Tier 4: Step 10 (final synthesis) — must run last
 */
export async function runV3Pipeline(
  input: PipelineInput
): Promise<{ report: HausReportV3; results: PipelineStepResult[] }> {
  const { listingId, car, executors, onProgress } = input
  const allResults: PipelineStepResult[] = []
  const pipelineStart = Date.now()

  const ctx: PipelineContext = {
    listingId,
    car,
    listingScrape: null,
    vehicleIdentity: null,
    marketData: null,
    fairValue: null,
    technicalAnalysis: null,
    investmentAnalysis: null,
    dueDiligence: null,
    marketResearch: null,
    buyerServices: null,
    finalSynthesis: null,
  }

  // Mark all steps as pending initially
  for (const step of STEP_DEFS) {
    emitProgress(onProgress, step, "pending")
  }

  // ─── Tier 0: Step 1 (listing scrape) ───
  const step1Result = await runStep(STEP_DEFS[0], ctx, executors, onProgress)
  if (step1Result) {
    assignResult(ctx, step1Result)
    allResults.push(step1Result)
  }

  // ─── Tier 1: Steps 2, 3, 4 (parallel) ───
  const tier1Results = await runParallel(
    [STEP_DEFS[1], STEP_DEFS[2], STEP_DEFS[3]],
    ctx,
    executors,
    onProgress
  )
  for (const r of tier1Results) {
    if (r) {
      assignResult(ctx, r)
      allResults.push(r)
    }
  }

  // ─── Tier 2: Steps 5, 6, 7 (parallel) ───
  const tier2Results = await runParallel(
    [STEP_DEFS[4], STEP_DEFS[5], STEP_DEFS[6]],
    ctx,
    executors,
    onProgress
  )
  for (const r of tier2Results) {
    if (r) {
      assignResult(ctx, r)
      allResults.push(r)
    }
  }

  // ─── Tier 3: Steps 8, 9 (parallel) ───
  const tier3Results = await runParallel(
    [STEP_DEFS[7], STEP_DEFS[8]],
    ctx,
    executors,
    onProgress
  )
  for (const r of tier3Results) {
    if (r) {
      assignResult(ctx, r)
      allResults.push(r)
    }
  }

  // ─── Tier 4: Step 10 (final synthesis) ───
  const step10Result = await runStep(STEP_DEFS[9], ctx, executors, onProgress)
  if (step10Result) {
    assignResult(ctx, step10Result)
    allResults.push(step10Result)
  }

  // ─── Assemble V3 report ───
  const totalDurationMs = Date.now() - pipelineStart
  const stepsCompleted = allResults.length
  const stepsFailed = 10 - stepsCompleted

  const report: HausReportV3 = {
    listingId,
    reportVersion: 3,
    listingScrape: ctx.listingScrape,
    vehicleIdentity: ctx.vehicleIdentity,
    marketData: ctx.marketData,
    technicalAnalysis: ctx.technicalAnalysis,
    investmentAnalysis: ctx.investmentAnalysis,
    dueDiligence: ctx.dueDiligence,
    marketResearch: ctx.marketResearch,
    buyerServices: ctx.buyerServices,
    finalSynthesis: ctx.finalSynthesis,
    generatedAt: new Date().toISOString(),
    totalDurationMs,
    stepsCompleted,
    stepsFailed,
  }

  return { report, results: allResults }
}

export { STEP_DEFS }
export type { StepDef }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/reports/__tests__/pipeline.test.ts --no-cache`
Expected: PASS — all 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/pipeline.ts src/lib/reports/__tests__/pipeline.test.ts
git commit -m "feat(reports): add V3 pipeline orchestrator with parallelized step execution"
```

---

### Task 4: Listing Type Detection Utility

**Files:**
- Modify: `src/lib/listingMode.ts`
- Test: `src/lib/reports/__tests__/listingType.test.ts`

The spec requires a `listingType` ("auction" | "classified") for each listing. The existing `getListingMode()` returns 4 modes — we need a simpler mapping for V3.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/reports/__tests__/listingType.test.ts
import { getListingType } from "@/lib/listingMode"

describe("getListingType", () => {
  it('returns "auction" for BaT', () => {
    expect(getListingType("BRING_A_TRAILER")).toBe("auction")
  })
  it('returns "auction" for Cars & Bids', () => {
    expect(getListingType("CARS_AND_BIDS")).toBe("auction")
  })
  it('returns "auction" for Collecting Cars', () => {
    expect(getListingType("COLLECTING_CARS")).toBe("auction")
  })
  it('returns "auction" for RM Sothebys', () => {
    expect(getListingType("RM_SOTHEBYS")).toBe("auction")
  })
  it('returns "classified" for Elferspot', () => {
    expect(getListingType("ELFERSPOT")).toBe("classified")
  })
  it('returns "classified" for AutoScout24', () => {
    expect(getListingType("AUTO_SCOUT_24")).toBe("classified")
  })
  it('returns "classified" for AutoTrader UK', () => {
    expect(getListingType("AUTO_TRADER")).toBe("classified")
  })
  it('returns "classified" for unknown platform', () => {
    expect(getListingType("UNKNOWN_PLATFORM")).toBe("classified")
  })
  it('returns "classified" for null/undefined', () => {
    expect(getListingType(null)).toBe("classified")
    expect(getListingType(undefined)).toBe("classified")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/reports/__tests__/listingType.test.ts --no-cache`
Expected: FAIL — "getListingType is not exported"

- [ ] **Step 3: Add `getListingType` to `listingMode.ts`**

Add at the bottom of `src/lib/listingMode.ts`:

```typescript
import type { ListingType } from "@/lib/reports/types-v3"
import { isAuctionPlatform } from "@/lib/makePageConstants"

/**
 * Classify a platform as auction or classified for V3 report content branching.
 * Delegates to the existing isAuctionPlatform() to avoid duplicating the platform set.
 */
export function getListingType(platform: string | null | undefined): ListingType {
  return isAuctionPlatform(platform) ? "auction" : "classified"
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/reports/__tests__/listingType.test.ts --no-cache`
Expected: PASS — all 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/listingMode.ts src/lib/reports/__tests__/listingType.test.ts
git commit -m "feat(reports): add getListingType() for auction/classified branching"
```

---

## Chunk 2: Data Gathering Agents (Steps 1–4)

These are the foundation data steps that feed the AI agents. Steps 2, 3, and 4 mostly wrap existing functionality; Step 1 (listing scraper) is new.

---

### Task 5: Step 2 — Vehicle Identifier Agent

**Files:**
- Create: `src/lib/reports/agents/vehicleIdentifier.ts`
- Test: `src/lib/reports/agents/__tests__/vehicleIdentifier.test.ts`

This step uses `brandConfig.ts` functions + scrape data to establish vehicle identity. AI call only if ambiguous.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/reports/agents/__tests__/vehicleIdentifier.test.ts
import { executeVehicleIdentifier } from "../vehicleIdentifier"
import type { PipelineContext } from "../../pipeline"

describe("vehicleIdentifier", () => {
  it("identifies a 992 GT3 RS from car data", async () => {
    const ctx: PipelineContext = {
      listingId: "test",
      car: {
        id: "test",
        year: 2024,
        make: "Porsche",
        model: "911 GT3 RS",
        trim: "Weissach Package",
        platform: "BRING_A_TRAILER",
      } as any,
      listingScrape: null,
      vehicleIdentity: null,
      marketData: null,
      fairValue: null,
      technicalAnalysis: null,
      investmentAnalysis: null,
      dueDiligence: null,
      marketResearch: null,
      buyerServices: null,
      finalSynthesis: null,
    }

    const result = await executeVehicleIdentifier(ctx)
    const identity = result.data

    expect(identity.series).toBe("992")
    expect(identity.family).toBe("911")
    expect(identity.listingType).toBe("auction")
    expect(identity.year).toBe(2024)
    expect(identity.make).toBe("Porsche")
  })

  it("falls back to car data when scrape is null", async () => {
    const ctx: PipelineContext = {
      listingId: "test",
      car: {
        id: "test",
        year: 1995,
        make: "Porsche",
        model: "993 Carrera",
        platform: "ELFERSPOT",
      } as any,
      listingScrape: null,
      vehicleIdentity: null,
      marketData: null,
      fairValue: null,
      technicalAnalysis: null,
      investmentAnalysis: null,
      dueDiligence: null,
      marketResearch: null,
      buyerServices: null,
      finalSynthesis: null,
    }

    const result = await executeVehicleIdentifier(ctx)
    expect(result.data.series).toBe("993")
    expect(result.data.listingType).toBe("classified")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/reports/agents/__tests__/vehicleIdentifier.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the vehicle identifier**

```typescript
// src/lib/reports/agents/vehicleIdentifier.ts
import { extractSeries, getSeriesConfig, matchVariant, deriveBodyType } from "@/lib/brandConfig"
import { getListingType } from "@/lib/listingMode"
import type { PipelineContext } from "../pipeline"
import type { VehicleIdentity } from "../types-v3"

export async function executeVehicleIdentifier(
  ctx: PipelineContext
): Promise<{ data: VehicleIdentity; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { car, listingScrape } = ctx

  // Prefer scrape data, fall back to DB record
  const year = listingScrape?.year ?? car.year ?? 0
  const make = listingScrape?.make ?? car.make ?? "Porsche"
  const model = listingScrape?.model ?? car.model ?? ""
  const trim = listingScrape?.trim ?? car.trim ?? null
  const title = car.title ?? `${year} ${make} ${model}`

  // Series extraction via brandConfig
  const series = extractSeries(model, year, make, title) ?? "unknown"
  const seriesConfig = getSeriesConfig(series, make)

  // Variant matching
  const variant = matchVariant(model, trim ?? "", series, make, title) ?? null

  // Body style
  const bodyStyle = listingScrape?.bodyStyle
    ?? deriveBodyType(model, trim ?? "", "", make, year) ?? null

  // Generation years from config
  const generationYears = seriesConfig
    ? `${seriesConfig.yearRange[0]}-${seriesConfig.yearRange[1]}`
    : "unknown"

  // Family from config
  const family = seriesConfig?.family?.replace(" Family", "") ?? "unknown"

  // Special edition check
  const specialEditionVariants = ["GT3 RS", "GT2 RS", "Sport Classic", "Speedster", "R", "GT"]
  const isSpecialEdition = variant
    ? specialEditionVariants.some((se) => variant.toUpperCase().includes(se.toUpperCase()))
    : false

  // Factory options from scrape
  const factoryOptions = listingScrape?.equipmentList ?? []

  // Listing type
  const listingType = getListingType(car.platform)

  const identity: VehicleIdentity = {
    year,
    make,
    model,
    series,
    family,
    variant,
    trim,
    generationYears,
    engine: listingScrape?.engine ?? null,
    transmission: listingScrape?.transmission ?? car.transmission ?? null,
    drivetrain: listingScrape?.drivetrain ?? null,
    bodyStyle,
    horsepower: listingScrape?.horsepower ?? null,
    factoryOptions,
    isSpecialEdition,
    listingType,
  }

  return {
    data: identity,
    durationMs: Date.now() - t0,
    agentModel: null, // No AI call needed for basic identification
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/reports/agents/__tests__/vehicleIdentifier.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/agents/vehicleIdentifier.ts src/lib/reports/agents/__tests__/vehicleIdentifier.test.ts
git commit -m "feat(reports): add Step 2 vehicle identifier agent using brandConfig"
```

---

### Task 6: Step 3 — Market Data Bundle Agent

**Files:**
- Create: `src/lib/reports/agents/marketDataBundle.ts`
- Test: `src/lib/reports/agents/__tests__/marketDataBundle.test.ts`

Wraps existing DB queries (`computeMarketStatsForCar`, comparables, arbitrage, similar cars) into the `MarketDataBundle` shape.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/reports/agents/__tests__/marketDataBundle.test.ts
import { executeMarketDataBundle } from "../marketDataBundle"
import type { PipelineContext } from "../../pipeline"

// Integration test — requires Supabase
const skipIfNoSupabase = process.env.SUPABASE_URL ? describe : describe.skip

skipIfNoSupabase("marketDataBundle", () => {
  it("returns MarketDataBundle with required fields", async () => {
    const ctx: PipelineContext = {
      listingId: "test",
      car: { id: "test", make: "Porsche", model: "911 GT3", year: 2022 } as any,
      listingScrape: null,
      vehicleIdentity: null,
      marketData: null,
      fairValue: null,
      technicalAnalysis: null,
      investmentAnalysis: null,
      dueDiligence: null,
      marketResearch: null,
      buyerServices: null,
      finalSynthesis: null,
    }

    const result = await executeMarketDataBundle(ctx)
    const bundle = result.data

    expect(bundle).toHaveProperty("marketStats")
    expect(bundle).toHaveProperty("dbComparables")
    expect(bundle).toHaveProperty("totalDataPoints")
    expect(bundle).toHaveProperty("regionsWithData")
    expect(bundle).toHaveProperty("trendDirection")
    expect(typeof bundle.totalDataPoints).toBe("number")
  })
})

describe("marketDataBundle (unit)", () => {
  it("module exports executeMarketDataBundle", () => {
    expect(typeof executeMarketDataBundle).toBe("function")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/reports/agents/__tests__/marketDataBundle.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the market data bundle agent**

```typescript
// src/lib/reports/agents/marketDataBundle.ts
//
// IMPORTANT: Verify these imports against the actual codebase before implementation.
// The function signatures below are based on the codebase review (2026-05-12).
//
import { computeMarketStatsForCar } from "@/lib/marketStats"
import { fetchPricedListingsForModel } from "@/lib/supabaseLiveListings"
import { getExchangeRates } from "@/lib/exchangeRates"
import { computeArbitrageForCar } from "@/lib/marketIntel/computeArbitrageForCar"
import { getComparablesForModel } from "@/lib/db/queries"
import type { PipelineContext } from "../pipeline"
import type { MarketDataBundle } from "../types-v3"

export async function executeMarketDataBundle(
  ctx: PipelineContext
): Promise<{ data: MarketDataBundle; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { car } = ctx
  const make = car.make ?? "Porsche"

  // Fetch priced listings and exchange rates in parallel
  const [pricedListings, exchangeRates] = await Promise.all([
    fetchPricedListingsForModel(make),
    getExchangeRates(),
  ])

  // computeMarketStatsForCar returns { marketStats, pricedRecords }
  const { marketStats, pricedRecords } = computeMarketStatsForCar(
    car, pricedListings, exchangeRates
  )

  // Fetch DB comparables — signature: (make, model, limit?)
  let dbComparables: any[] = []
  try {
    dbComparables = await getComparablesForModel(make, car.model ?? "")
  } catch {
    // Non-fatal — comparables may not exist
  }

  // Compute arbitrage (D2) — signature: ({ pricedListings, thisVinPriceUsd, targetRegion, carYear })
  let arbitrage = null
  if (marketStats) {
    try {
      const thisPrice = car.askingPriceUsd ?? car.soldPriceUsd ?? car.price ?? 0
      arbitrage = await computeArbitrageForCar({
        pricedListings: pricedRecords,
        thisVinPriceUsd: thisPrice,
        targetRegion: "US", // default target
        carYear: car.year ?? 0,
      })
    } catch {
      // Non-fatal
    }
  }

  // Extract region summary from market stats (field names may vary — verify at impl time)
  const regions = marketStats?.regions
    ? Object.entries(marketStats.regions).map(([region, stats]: [string, any]) => ({
        region,
        median: stats.median ?? 0,
        count: stats.count ?? 0,
        currency: stats.currency ?? "USD",
      }))
    : []

  // Trend data (verify actual field names on ModelMarketStats at implementation time)
  const trendPercent12m = marketStats?.trendPercent ?? null
  const trendDirection = marketStats?.trendDirection ?? "insufficient_data"

  // Data quality metrics
  const totalDataPoints = (pricedRecords?.length ?? 0) + dbComparables.length
  const regionsWithData = regions.filter((r) => r.count > 0).map((r) => r.region)

  const bundle: MarketDataBundle = {
    marketStats: marketStats ?? ({} as any),
    regions,
    dbComparables,
    comparablesCount: dbComparables.length,
    arbitrage,
    similarCars: [], // TODO: add fetchSimilarListings call
    trendPercent12m,
    trendDirection: trendDirection as MarketDataBundle["trendDirection"],
    totalDataPoints,
    oldestDataPoint: null,  // derive from pricedRecords dates at impl time
    newestDataPoint: null,
    regionsWithData,
  }

  return {
    data: bundle,
    durationMs: Date.now() - t0,
    agentModel: null,
  }
}
```

**IMPORTANT NOTE for implementing engineer:** The exact field names on `ModelMarketStats` (regions, trendPercent, trendDirection) must be verified against `src/lib/reports/types.ts` at implementation time. The `computeArbitrageForCar` input shape must be verified against `src/lib/marketIntel/computeArbitrageForCar.ts`. All import paths were verified during plan review but could shift if code is refactored before implementation.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/reports/agents/__tests__/marketDataBundle.test.ts --no-cache`
Expected: PASS (unit test passes; integration test may skip)

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/agents/marketDataBundle.ts src/lib/reports/agents/__tests__/marketDataBundle.test.ts
git commit -m "feat(reports): add Step 3 market data bundle agent wrapping DB queries"
```

---

### Task 7: Step 4 — Fair Value Engine (Enhanced Wrapper)

**Files:**
- Create: `src/lib/reports/agents/fairValueEngine.ts`
- Test: `src/lib/reports/agents/__tests__/fairValueEngine.test.ts`

Wraps the existing signal extraction + modifier pipeline from `/api/analyze`. Enhanced to use richer data from Step 1 scrape.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/reports/agents/__tests__/fairValueEngine.test.ts
import { executeFairValueEngine } from "../fairValueEngine"

describe("fairValueEngine", () => {
  it("module exports executeFairValueEngine", () => {
    expect(typeof executeFairValueEngine).toBe("function")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/reports/agents/__tests__/fairValueEngine.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the fair value engine wrapper**

This extracts the signal extraction + fair value computation logic from `/api/analyze/route.ts` into a reusable function. The existing route.ts code (lines ~258-419) becomes a thin wrapper around this.

```typescript
// src/lib/reports/agents/fairValueEngine.ts
//
// CRITICAL: All extractors take INPUT OBJECTS, not positional arguments.
// Verify exact input types at: src/lib/fairValue/extractors/*.ts
//
import { extractStructuredSignals } from "@/lib/fairValue/extractors/structured"
import { extractSellerSignal } from "@/lib/fairValue/extractors/seller"
import { extractTextSignals } from "@/lib/fairValue/extractors/text"
import { extractColorIntelligence } from "@/lib/fairValue/extractors/color"
import { extractVinIntelligence } from "@/lib/fairValue/extractors/vin"
import { applyModifiers, computeSpecificCarFairValue } from "@/lib/fairValue/engine"
import { generateInvestmentNarrative } from "@/lib/fairValue/narrative"
import { extractSeries } from "@/lib/brandConfig"
import type { HausReport } from "@/lib/fairValue/types"
import type { PipelineContext } from "../pipeline"

export async function executeFairValueEngine(
  ctx: PipelineContext
): Promise<{ data: HausReport; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { car, listingScrape, marketData } = ctx

  // Use scrape description if available (richer than DB description)
  const description = listingScrape?.descriptionFull ?? car.description ?? ""
  const cleanDescription = description.replace(/<[^>]*>/g, "").trim()
  const seriesId = extractSeries(car.model ?? "", car.year ?? 0, car.make ?? "Porsche")

  // Parallel signal extraction — ALL take input objects, not positional args
  const [structuredSignals, sellerSignal, textResult, colorResult, vinResult] =
    await Promise.all([
      // extractStructuredSignals({ year?, mileage?, transmission? })
      extractStructuredSignals({
        year: car.year ?? undefined,
        mileage: listingScrape?.mileage ?? car.mileage ?? undefined,
        transmission: listingScrape?.transmission ?? car.transmission ?? undefined,
      }),
      // extractSellerSignal({ sellerName?, sellerDomain?, make? })
      extractSellerSignal({
        sellerName: listingScrape?.sellerName ?? undefined,
        sellerDomain: car.sourceUrl ? new URL(car.sourceUrl).hostname : undefined,
        make: car.make ?? undefined,
      }),
      // extractTextSignals({ description, make?, maxOutputTokens? })
      cleanDescription
        ? extractTextSignals({ description: cleanDescription, make: car.make ?? undefined })
        : Promise.resolve(null),
      // extractColorIntelligence({ exteriorColor, interiorColor, seriesId, description, make? })
      extractColorIntelligence({
        exteriorColor: listingScrape?.exteriorColor ?? car.exteriorColor ?? null,
        interiorColor: listingScrape?.interiorColor ?? car.interiorColor ?? null,
        seriesId,
        description: cleanDescription,
        make: car.make ?? undefined,
      }),
      // extractVinIntelligence({ vin, year, model, seriesId, make? })
      extractVinIntelligence({
        vin: listingScrape?.vin ?? car.vin ?? null,
        year: car.year ?? 0,
        model: car.model ?? "",
        seriesId,
        make: car.make ?? undefined,
      }),
    ])

  // Combine all detected signals
  const detected = [
    ...structuredSignals,
    ...(sellerSignal ? [sellerSignal] : []),
    ...(textResult?.signals ?? []),
  ]

  // Get baseline from market stats (verify field name at impl time)
  const baselineUsd = marketData?.marketStats?.primaryMedianUsd ?? 0

  // applyModifiers takes { baselineUsd, signals } — returns { appliedModifiers, totalPercent, cappedAggregate }
  const { appliedModifiers, totalPercent } = applyModifiers({
    baselineUsd,
    signals: detected,
  })

  // computeSpecificCarFairValue takes { baselineUsd, totalPercent }
  const specificFV = computeSpecificCarFairValue({ baselineUsd, totalPercent })

  // Investment narrative (optional, non-blocking)
  // generateInvestmentNarrative takes NarrativeInput object — verify at src/lib/fairValue/narrative.ts
  let narrative = null
  try {
    narrative = await generateInvestmentNarrative({
      title: car.title ?? `${car.year} ${car.make} ${car.model}`,
      year: car.year ?? 0,
      make: car.make ?? "Porsche",
      model: car.model ?? "",
      seriesId,
      mileage: car.mileage ?? undefined,
      transmission: car.transmission ?? undefined,
      exteriorColor: car.exteriorColor ?? undefined,
      interiorColor: car.interiorColor ?? undefined,
      price: car.price ?? 0,
      fairValueMid: specificFV.mid,
      signals: detected,
      redFlags: [],
      colorRarity: colorResult?.exteriorRarity ?? undefined,
      colorPremium: colorResult?.exteriorValuePremiumPercent ?? undefined,
    })
  } catch {
    // Non-fatal
  }

  const report: HausReport = {
    listing_id: ctx.listingId,
    fair_value_low: specificFV.low,
    fair_value_high: specificFV.high,
    median_price: baselineUsd,
    specific_car_fair_value_low: specificFV.low,
    specific_car_fair_value_mid: specificFV.mid,
    specific_car_fair_value_high: specificFV.high,
    comparable_layer_used: null, // not returned by computeSpecificCarFairValue
    comparables_count: marketData?.comparablesCount ?? 0,
    signals_detected: detected,
    signals_missing: [], // Will be derived at assembly time
    modifiers_applied: appliedModifiers,
    modifiers_total_percent: totalPercent,
    signals_extracted_at: new Date().toISOString(),
    extraction_version: "v2.0",
    landed_cost: null,
    color_intelligence: colorResult ?? undefined,
    vin_intelligence: vinResult ?? undefined,
    investment_narrative: narrative ?? undefined,
  }

  return {
    data: report,
    durationMs: Date.now() - t0,
    agentModel: textResult ? "gemini-2.5-flash" : null,
  }
}
```

**CRITICAL NOTE for implementing engineer:** Every extractor function takes a **typed input object**, not positional arguments. Before implementing, read the actual input type from each extractor file:
- `src/lib/fairValue/extractors/structured.ts` → `StructuredListingInput`
- `src/lib/fairValue/extractors/seller.ts` → `SellerInput`
- `src/lib/fairValue/extractors/text.ts` → `TextExtractionInput`
- `src/lib/fairValue/extractors/color.ts` → `ColorIntelInput`
- `src/lib/fairValue/extractors/vin.ts` → `VinDeepInput`
- `src/lib/fairValue/engine.ts` → `ApplyModifiersInput` (returns `appliedModifiers`, not `modifiers`)
- `src/lib/fairValue/narrative.ts` → `NarrativeInput`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/reports/agents/__tests__/fairValueEngine.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/agents/fairValueEngine.ts src/lib/reports/agents/__tests__/fairValueEngine.test.ts
git commit -m "feat(reports): add Step 4 fair value engine agent wrapping existing extractors"
```

---

### Task 8: Step 1 — Listing Scraper Agent

**Files:**
- Create: `src/lib/reports/agents/listingScraper.ts`
- Test: `src/lib/reports/agents/__tests__/listingScraper.test.ts`

Fetches the original listing URL at report generation time and extracts all available data into `ScrapedListingFull`. Falls back to existing DB data if scrape fails.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/reports/agents/__tests__/listingScraper.test.ts
import { executeListingScraper, buildFallbackFromCar } from "../listingScraper"
import type { PipelineContext } from "../../pipeline"

describe("listingScraper", () => {
  describe("buildFallbackFromCar", () => {
    it("creates ScrapedListingFull from CollectorCar fields", () => {
      const car = {
        id: "test",
        title: "2024 Porsche 911 GT3 RS",
        year: 2024,
        make: "Porsche",
        model: "911 GT3 RS",
        trim: "Weissach",
        vin: "WP0AF2A90RS123456",
        mileage: 1200,
        exteriorColor: "White",
        interiorColor: "Black",
        description: "Beautiful GT3 RS with Weissach Package",
        sourceUrl: "https://example.com/listing",
        platform: "BRING_A_TRAILER",
        transmission: "PDK",
        images: ["img1.jpg", "img2.jpg"],
        currentBid: 250000,
        price: 250000,
      } as any

      const result = buildFallbackFromCar(car)

      expect(result.year).toBe(2024)
      expect(result.make).toBe("Porsche")
      expect(result.vin).toBe("WP0AF2A90RS123456")
      expect(result.scrapeSuccessful).toBe(false)
      expect(result.scrapePartial).toBe(true)
      expect(result.photoCount).toBe(2)
      expect(result.descriptionFull).toBe("Beautiful GT3 RS with Weissach Package")
    })

    it("handles minimal car data without crashing", () => {
      const car = { id: "test", make: "Porsche" } as any
      const result = buildFallbackFromCar(car)

      expect(result.year).toBeNull()
      expect(result.descriptionFull).toBe("")
      expect(result.photoUrls).toEqual([])
      expect(result.scrapeSuccessful).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/reports/agents/__tests__/listingScraper.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the listing scraper agent**

```typescript
// src/lib/reports/agents/listingScraper.ts
import type { CollectorCar } from "@/lib/curatedCars"
import type { PipelineContext } from "../pipeline"
import type { ScrapedListingFull } from "../types-v3"
import { getListingType } from "@/lib/listingMode"

/**
 * Build a fallback ScrapedListingFull from existing CollectorCar DB data.
 * Used when the live scrape fails or sourceUrl is missing.
 */
export function buildFallbackFromCar(car: CollectorCar): ScrapedListingFull {
  const listingType = getListingType(car.platform)
  const images = car.images ?? []

  return {
    title: car.title ?? `${car.year ?? ""} ${car.make ?? ""} ${car.model ?? ""}`.trim(),
    year: car.year ?? null,
    make: car.make ?? "Unknown",
    model: car.model ?? "",
    trim: car.trim ?? null,
    vin: car.vin ?? null,

    engine: null,
    transmission: car.transmission ?? null,
    drivetrain: null,
    horsepower: null,
    torque: null,
    weight: null,
    bodyStyle: null,
    seats: null,

    mileage: car.mileage ?? null,
    mileageUnit: "mi",
    exteriorColor: car.exteriorColor ?? null,
    interiorColor: car.interiorColor ?? null,
    location: null,

    descriptionFull: car.description ?? "",
    sellerNotes: null,
    auctionComments: null,
    lotEssay: null,

    equipmentList: [],
    modifications: [],

    photoUrls: images,
    photoCount: images.length,

    currentBid: listingType === "auction" ? (car.currentBid ?? car.price ?? null) : null,
    bidCount: null,
    reserveStatus: "unknown",
    auctionEndTime: null,

    askingPrice: listingType === "classified" ? (car.askingPriceUsd ?? car.price ?? null) : null,
    daysOnMarket: null,
    priceDrops: null,

    sellerName: null,
    sellerType: null,
    sellerLocation: null,

    scrapedAt: new Date().toISOString(),
    scrapeSuccessful: false,
    scrapePartial: true,
    sourceUrl: car.sourceUrl ?? "",
    platform: car.platform ?? "UNKNOWN",
  }
}

/**
 * Step 1: Attempt to scrape the full listing from sourceUrl.
 * Falls back to buildFallbackFromCar() on any failure.
 *
 * NOTE: The actual scraping logic (Scrapling/Playwright per-platform parsers)
 * will be implemented in a follow-up task. For now, this always falls back
 * to DB data. The pipeline still functions — just with less depth.
 */
export async function executeListingScraper(
  ctx: PipelineContext
): Promise<{ data: ScrapedListingFull; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { car } = ctx

  // TODO: Implement per-platform scraping using existing scraper infrastructure
  // For now, use fallback from DB data
  const fallback = buildFallbackFromCar(car)

  console.log(
    `[listingScraper] Using DB fallback for ${car.id} (live scrape not yet implemented)`
  )

  return {
    data: fallback,
    durationMs: Date.now() - t0,
    agentModel: null,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/reports/agents/__tests__/listingScraper.test.ts --no-cache`
Expected: PASS — both tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/agents/listingScraper.ts src/lib/reports/agents/__tests__/listingScraper.test.ts
git commit -m "feat(reports): add Step 1 listing scraper agent with DB fallback"
```

---

### Task 9: Wire Data Agents into Pipeline

**Files:**
- Create: `src/lib/reports/agents/index.ts`
- Modify: `src/lib/reports/__tests__/pipeline.test.ts`

Create the agent registry that maps section keys to executor functions, and verify the full data pipeline works end-to-end.

- [ ] **Step 1: Create agent registry**

```typescript
// src/lib/reports/agents/index.ts
import type { StepExecutor } from "../pipeline"
import { executeListingScraper } from "./listingScraper"
import { executeVehicleIdentifier } from "./vehicleIdentifier"
import { executeMarketDataBundle } from "./marketDataBundle"
import { executeFairValueEngine } from "./fairValueEngine"

/**
 * Registry of all V3 pipeline step executors.
 * AI agents (Steps 5-10) will be added in subsequent tasks.
 */
export function createV3Executors(): Record<string, StepExecutor> {
  return {
    listing_scrape: executeListingScraper,
    vehicle_identity: executeVehicleIdentifier,
    market_data_bundle: executeMarketDataBundle,
    fair_value: executeFairValueEngine,
    // Steps 5-10: AI agents (to be implemented)
    technical_analysis: async () => ({ data: null, durationMs: 0, agentModel: null }),
    investment_analysis: async () => ({ data: null, durationMs: 0, agentModel: null }),
    due_diligence: async () => ({ data: null, durationMs: 0, agentModel: null }),
    market_research: async () => ({ data: null, durationMs: 0, agentModel: null }),
    buyer_services: async () => ({ data: null, durationMs: 0, agentModel: null }),
    final_synthesis: async () => ({ data: null, durationMs: 0, agentModel: null }),
  }
}
```

- [ ] **Step 2: Add integration test for data pipeline**

Add to `src/lib/reports/__tests__/pipeline.test.ts`:

```typescript
import { createV3Executors } from "../agents"

describe("V3 Pipeline — Agent Registry", () => {
  it("createV3Executors returns all 10 step executors", () => {
    const executors = createV3Executors()
    const keys = Object.keys(executors)

    expect(keys).toContain("listing_scrape")
    expect(keys).toContain("vehicle_identity")
    expect(keys).toContain("market_data_bundle")
    expect(keys).toContain("fair_value")
    expect(keys).toContain("technical_analysis")
    expect(keys).toContain("investment_analysis")
    expect(keys).toContain("due_diligence")
    expect(keys).toContain("market_research")
    expect(keys).toContain("buyer_services")
    expect(keys).toContain("final_synthesis")
    expect(keys).toHaveLength(10)
  })
})
```

- [ ] **Step 3: Run all pipeline tests**

Run: `npx jest src/lib/reports/__tests__/pipeline.test.ts --no-cache`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/agents/index.ts src/lib/reports/__tests__/pipeline.test.ts
git commit -m "feat(reports): wire data agents into pipeline executor registry"
```

---

## Chunk 3: AI Intelligence Agents (Steps 5–10)

These steps use Gemini 2.5 Flash to generate the AI-powered content sections. Each agent follows the same pattern: system prompt + structured user prompt → `generateJson<T>()` → typed output.

---

### Task 10: AI Agent Prompt Infrastructure

**Files:**
- Create: `src/lib/reports/agents/prompts/system.ts`
- Create: `src/lib/reports/agents/prompts/helpers.ts`

Shared system prompts and prompt-building utilities used by all AI agents.

- [ ] **Step 1: Create shared system prompts**

```typescript
// src/lib/reports/agents/prompts/system.ts

export const TECHNICAL_ANALYST_SYSTEM = `You are a specialist automotive journalist and technical analyst with deep knowledge of Porsche vehicles. You have extensive expertise in:
- Model lineages, generations, and production history
- Technical specifications and engineering details
- Known issues, reliability patterns, and maintenance costs
- Production numbers and rarity assessment
- Collector market dynamics and investment potential

Respond with precise, factual analysis. When you are uncertain about specific numbers (production counts, costs), say "estimated" or provide ranges. Never fabricate specific statistics — use qualitative assessments when data is uncertain.

Output valid JSON matching the requested schema exactly.`

export const INVESTMENT_ANALYST_SYSTEM = `You are a financial analyst specializing in collector car investments. You combine market data with forward-looking analysis to help buyers make informed decisions.

When provided with real market data (comparables, medians, trends), anchor your analysis to those numbers. Clearly distinguish between data-backed insights and AI projections.

For auction listings, focus on bidding strategy, max bid recommendations, and timing.
For classified listings, focus on negotiation strategy, opening offers, and leverage points.

Output valid JSON matching the requested schema exactly.`

export const DUE_DILIGENCE_SYSTEM = `You are a pre-purchase inspection specialist and buyer's advisor for collector cars. You generate vehicle-specific questions, risk assessments, and inspection checklists.

Questions should be SPECIFIC to the car being analyzed — not generic. Reference the car's specific model, options, and known issues. For example, instead of "Has it been in an accident?" ask "Given the Weissach Package delete, has the front-axle lift system been retrofitted, and if so, by which shop?"

Output valid JSON matching the requested schema exactly.`

export const MARKET_RESEARCHER_SYSTEM = `You are an automotive market researcher who compiles expert opinions, owner community sentiment, and model heritage information.

Draw on your knowledge of automotive journalism, enthusiast forums, and owner communities. Provide balanced analysis — both praise and criticism.

Output valid JSON matching the requested schema exactly.`

export const BUYER_SERVICES_SYSTEM = `You are a practical buyer services advisor for collector cars. You provide estimates for parts availability, insurance costs, transportation, and related buyer needs.

Be specific about cost ranges and availability. When estimating, clearly label as estimates. Use your knowledge of the Porsche parts ecosystem, collector car insurance market, and enclosed transport industry.

Output valid JSON matching the requested schema exactly.`

export const FINAL_SYNTHESIS_SYSTEM = `You are the lead analyst composing the executive summary and final recommendation for a comprehensive car investment report. You have access to all prior analysis from your team.

Synthesize all inputs into a compelling, actionable verdict. The headline should be memorable and specific. The investment thesis should be substantive (100-200 words), not generic.

Output valid JSON matching the requested schema exactly.`
```

- [ ] **Step 2: Create prompt helper utilities**

```typescript
// src/lib/reports/agents/prompts/helpers.ts
import type { VehicleIdentity, ScrapedListingFull, ListingType } from "../../types-v3"
import type { HausReport } from "@/lib/fairValue/types"

/**
 * Build a car context summary string for use in AI prompts.
 * Provides the key facts about the vehicle being analyzed.
 */
export function buildCarContext(
  identity: VehicleIdentity | null,
  scrape: ScrapedListingFull | null
): string {
  if (!identity) return "No vehicle identity available."

  const lines: string[] = [
    `Vehicle: ${identity.year} ${identity.make} ${identity.model}`,
    `Series: ${identity.series} (${identity.generationYears})`,
    `Family: ${identity.family}`,
  ]

  if (identity.variant) lines.push(`Variant: ${identity.variant}`)
  if (identity.engine) lines.push(`Engine: ${identity.engine}`)
  if (identity.transmission) lines.push(`Transmission: ${identity.transmission}`)
  if (identity.drivetrain) lines.push(`Drivetrain: ${identity.drivetrain}`)
  if (identity.horsepower) lines.push(`Horsepower: ${identity.horsepower}`)
  if (identity.bodyStyle) lines.push(`Body: ${identity.bodyStyle}`)
  if (identity.isSpecialEdition) lines.push(`Special Edition: Yes`)
  lines.push(`Listing Type: ${identity.listingType}`)

  if (identity.factoryOptions.length > 0) {
    lines.push(`Factory Options: ${identity.factoryOptions.join(", ")}`)
  }

  if (scrape) {
    if (scrape.mileage) lines.push(`Mileage: ${scrape.mileage} ${scrape.mileageUnit}`)
    if (scrape.exteriorColor) lines.push(`Exterior: ${scrape.exteriorColor}`)
    if (scrape.interiorColor) lines.push(`Interior: ${scrape.interiorColor}`)
    if (scrape.vin) lines.push(`VIN: ${scrape.vin}`)
    if (scrape.modifications.length > 0) {
      lines.push(`Modifications: ${scrape.modifications.join(", ")}`)
    }
  }

  return lines.join("\n")
}

/**
 * Build pricing context for investment analysis prompts.
 */
export function buildPricingContext(
  fairValue: HausReport | null,
  scrape: ScrapedListingFull | null,
  listingType: ListingType
): string {
  const lines: string[] = []

  if (fairValue) {
    if (fairValue.specific_car_fair_value_mid) {
      lines.push(`Fair Value (mid): $${fairValue.specific_car_fair_value_mid.toLocaleString()}`)
    }
    if (fairValue.specific_car_fair_value_low && fairValue.specific_car_fair_value_high) {
      lines.push(
        `Fair Value Range: $${fairValue.specific_car_fair_value_low.toLocaleString()} - $${fairValue.specific_car_fair_value_high.toLocaleString()}`
      )
    }
    lines.push(`Comparables Count: ${fairValue.comparables_count}`)
    lines.push(`Signals Detected: ${fairValue.signals_detected.length}`)
    lines.push(`Total Modifier: ${fairValue.modifiers_total_percent > 0 ? "+" : ""}${fairValue.modifiers_total_percent}%`)
  }

  if (listingType === "auction" && scrape?.currentBid) {
    lines.push(`Current Bid: $${scrape.currentBid.toLocaleString()}`)
    if (scrape.bidCount) lines.push(`Bid Count: ${scrape.bidCount}`)
    lines.push(`Reserve: ${scrape.reserveStatus}`)
  } else if (listingType === "classified" && scrape?.askingPrice) {
    lines.push(`Asking Price: $${scrape.askingPrice.toLocaleString()}`)
    if (scrape.daysOnMarket) lines.push(`Days on Market: ${scrape.daysOnMarket}`)
  }

  return lines.join("\n") || "No pricing data available."
}

/**
 * Truncate description to fit within token budget.
 */
export function truncateDescription(text: string, maxChars: number = 3000): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + "\n... [truncated]"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/agents/prompts/system.ts src/lib/reports/agents/prompts/helpers.ts
git commit -m "feat(reports): add AI agent system prompts and prompt helpers"
```

---

### Task 11: Step 5 — Technical Analyst Agent

**Files:**
- Create: `src/lib/reports/agents/technicalAnalyst.ts`
- Test: `src/lib/reports/agents/__tests__/technicalAnalyst.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/reports/agents/__tests__/technicalAnalyst.test.ts
import { executeTechnicalAnalyst, buildTechnicalAnalystPrompt } from "../technicalAnalyst"

describe("technicalAnalyst", () => {
  it("exports executeTechnicalAnalyst function", () => {
    expect(typeof executeTechnicalAnalyst).toBe("function")
  })

  it("builds a prompt with car context", () => {
    const prompt = buildTechnicalAnalystPrompt({
      year: 2024,
      make: "Porsche",
      model: "911 GT3 RS",
      series: "992",
      family: "911",
      variant: "GT3 RS",
      trim: null,
      generationYears: "2019-2025",
      engine: "4.0L flat-six",
      transmission: "7-speed PDK",
      drivetrain: "RWD",
      bodyStyle: "Coupe",
      horsepower: 518,
      factoryOptions: ["PCCB", "Weissach Package"],
      isSpecialEdition: true,
      listingType: "auction",
    }, null)

    expect(prompt).toContain("992")
    expect(prompt).toContain("GT3 RS")
    expect(prompt).toContain("Weissach Package")
    expect(prompt).toContain("modelHistory")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/reports/agents/__tests__/technicalAnalyst.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the technical analyst agent**

```typescript
// src/lib/reports/agents/technicalAnalyst.ts
import { generateJson } from "@/lib/ai/gemini"
import { TECHNICAL_ANALYST_SYSTEM } from "./prompts/system"
import { buildCarContext, truncateDescription } from "./prompts/helpers"
import type { HausReport } from "@/lib/fairValue/types"
import type { PipelineContext } from "../pipeline"
import type { TechnicalAnalysis, VehicleIdentity, ScrapedListingFull } from "../types-v3"

export function buildTechnicalAnalystPrompt(
  identity: VehicleIdentity,
  scrape: ScrapedListingFull | null,
  fairValue: HausReport | null = null
): string {
  const carContext = buildCarContext(identity, scrape)
  const description = scrape?.descriptionFull
    ? truncateDescription(scrape.descriptionFull)
    : "No description available."

  // Include detected signals from Step 4 so AI can tailor analysis to actual config
  const signalsInfo = fairValue?.signals_detected
    ?.map((s) => `- ${s.key}: ${s.value_display}`)
    .join("\n") ?? "No signals detected yet."

  return `Analyze the following vehicle and provide a comprehensive technical assessment.

## Vehicle Data
${carContext}

## Listing Description
${description}

## Detected Value Signals (from our data analysis)
${signalsInfo}

${scrape?.equipmentList?.length ? `## Equipment List\n${scrape.equipmentList.join(", ")}` : ""}

## Required Output (JSON)
Provide a JSON object with these exact fields:
- modelHistory: string (300-500 words on model lineage and generation significance)
- whatMakesThisSpecSpecial: string (150-300 words specific to THIS configuration)
- productionData: { totalProduction: string|null, thisConfigEstimate: string|null, rarityAssessment: "common"|"uncommon"|"rare"|"very_rare"|"unique", rarityNote: string }
- keyStrengths: array of { point: string, detail: string } (4-6 items)
- commonIssues: array of { issue: string, severity: "critical"|"moderate"|"minor", typicalCost: string|null, appliesTo: string } (4-8 items)
- reliability: { rating: "excellent"|"above_average"|"average"|"below_average"|"poor", maintenanceCostLevel: "low"|"moderate"|"high"|"very_high", commonProblems: string[] (3-5) }
- collectorOutlook: { investmentGrade: "high"|"moderate"|"low"|"speculative", demandLevel: "high"|"moderate"|"low", futureOutlook: string (150-200 words) }`
}

export async function executeTechnicalAnalyst(
  ctx: PipelineContext
): Promise<{ data: TechnicalAnalysis | null; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { vehicleIdentity, listingScrape, fairValue } = ctx

  if (!vehicleIdentity) {
    console.warn("[technicalAnalyst] No vehicle identity available, skipping")
    return { data: null, durationMs: Date.now() - t0, agentModel: null }
  }

  const userPrompt = buildTechnicalAnalystPrompt(vehicleIdentity, listingScrape, fairValue)

  const result = await generateJson<TechnicalAnalysis>({
    systemPrompt: TECHNICAL_ANALYST_SYSTEM,
    userPrompt,
    temperature: 0.3,
    maxOutputTokens: 8192,
  })

  if (!result.ok) {
    console.error("[technicalAnalyst] Gemini failed:", result.error)
    return { data: null, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
  }

  return {
    data: result.data,
    durationMs: Date.now() - t0,
    agentModel: "gemini-2.5-flash",
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/reports/agents/__tests__/technicalAnalyst.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/agents/technicalAnalyst.ts src/lib/reports/agents/__tests__/technicalAnalyst.test.ts
git commit -m "feat(reports): add Step 5 technical analyst AI agent"
```

---

### Task 12: Step 6 — Investment Analyst Agent

**Files:**
- Create: `src/lib/reports/agents/investmentAnalyst.ts`
- Test: `src/lib/reports/agents/__tests__/investmentAnalyst.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/reports/agents/__tests__/investmentAnalyst.test.ts
import { executeInvestmentAnalyst, buildInvestmentPrompt } from "../investmentAnalyst"

describe("investmentAnalyst", () => {
  it("exports executeInvestmentAnalyst function", () => {
    expect(typeof executeInvestmentAnalyst).toBe("function")
  })

  it("builds auction-specific prompt", () => {
    const prompt = buildInvestmentPrompt("auction", null, null, null)
    expect(prompt).toContain("auction")
    expect(prompt).toContain("maxBidRecommendation")
    expect(prompt).toContain("bidTiming")
  })

  it("builds classified-specific prompt", () => {
    const prompt = buildInvestmentPrompt("classified", null, null, null)
    expect(prompt).toContain("classified")
    expect(prompt).toContain("openingOffer")
    expect(prompt).toContain("walkAwayPrice")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/reports/agents/__tests__/investmentAnalyst.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the investment analyst agent**

```typescript
// src/lib/reports/agents/investmentAnalyst.ts
import { generateJson } from "@/lib/ai/gemini"
import { INVESTMENT_ANALYST_SYSTEM } from "./prompts/system"
import { buildCarContext, buildPricingContext } from "./prompts/helpers"
import type { PipelineContext } from "../pipeline"
import type {
  InvestmentAnalysis,
  ListingType,
  VehicleIdentity,
  ScrapedListingFull,
  MarketDataBundle,
} from "../types-v3"
import type { HausReport } from "@/lib/fairValue/types"
import type { PipelineContext } from "../pipeline"

export function buildInvestmentPrompt(
  listingType: ListingType,
  identity: VehicleIdentity | null,
  scrape: ScrapedListingFull | null,
  fairValue: HausReport | null,
  marketData: MarketDataBundle | null = null
): string {
  const carContext = buildCarContext(identity, scrape)
  const pricingContext = buildPricingContext(fairValue, scrape, listingType)

  // Real market data context — spec requires anchoring to real data
  const marketContext = marketData ? [
    `Trend (12m): ${marketData.trendPercent12m ?? "unknown"}%`,
    `Trend Direction: ${marketData.trendDirection}`,
    `Comparables: ${marketData.comparablesCount}`,
    `Total Data Points: ${marketData.totalDataPoints}`,
    `Regions: ${marketData.regionsWithData.join(", ") || "none"}`,
  ].join("\n") : "No market data available."

  const strategyGuidance = listingType === "auction"
    ? `This is an AUCTION listing. Focus on:
- maxBidRecommendation (dollar amount anchored to fair value)
- bidTiming (when to place bids)
- reserveStrategy (how to handle reserve/no-reserve)
- Set openingOffer and walkAwayPrice to null
- Set negotiationLeverage to empty array`
    : `This is a CLASSIFIED listing. Focus on:
- openingOffer (dollar amount, typically 10-15% below asking)
- walkAwayPrice (maximum you'd pay)
- negotiationLeverage (list of leverage points: days on market, price drops, etc.)
- Set maxBidRecommendation, bidTiming, reserveStrategy to null`

  return `Analyze this vehicle as an investment and provide financial guidance.

## Vehicle
${carContext}

## Pricing Data (REAL — use these numbers to anchor your analysis)
${pricingContext}

## Market Data (REAL — from our database of actual transactions)
${marketContext}

## Strategy Type
${strategyGuidance}

## Required Output (JSON)
Provide a JSON object with:
- strategy: { type: "${listingType}", maxBidRecommendation: number|null, bidTiming: string|null, reserveStrategy: string|null, openingOffer: number|null, walkAwayPrice: number|null, negotiationLeverage: string[], strategyInsight: string (200-400 words), potentialRepairs: { low: number, high: number, description: string } }
- ownershipCosts: { year1, year3, year5 } each: { totalCost: number, breakdown: { valueChange, insurance, maintenance, majorWork: number|null }, notes: string, confidence: "high"|"medium"|"low" }
- resaleTimeline: { year1, year3, year5, year10 } each: { estimatedRange: { low, high }, percentChange: number, confidence: "high"|"medium"|"low", keyFactors: string[] }
- investmentNarrative: string (500-800 words, substantive investment analysis)`
}

export async function executeInvestmentAnalyst(
  ctx: PipelineContext
): Promise<{ data: InvestmentAnalysis | null; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { vehicleIdentity, listingScrape, fairValue, marketData } = ctx
  const listingType = vehicleIdentity?.listingType ?? "classified"

  const userPrompt = buildInvestmentPrompt(listingType, vehicleIdentity, listingScrape, fairValue, marketData)

  const result = await generateJson<InvestmentAnalysis>({
    systemPrompt: INVESTMENT_ANALYST_SYSTEM,
    userPrompt,
    temperature: 0.3,
    maxOutputTokens: 8192,
  })

  if (!result.ok) {
    console.error("[investmentAnalyst] Gemini failed:", result.error)
    return { data: null, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
  }

  return {
    data: result.data,
    durationMs: Date.now() - t0,
    agentModel: "gemini-2.5-flash",
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/reports/agents/__tests__/investmentAnalyst.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/agents/investmentAnalyst.ts src/lib/reports/agents/__tests__/investmentAnalyst.test.ts
git commit -m "feat(reports): add Step 6 investment analyst AI agent with auction/classified branching"
```

---

### Task 13: Step 7 — Due Diligence Agent

**Files:**
- Create: `src/lib/reports/agents/dueDiligence.ts`
- Test: `src/lib/reports/agents/__tests__/dueDiligence.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/reports/agents/__tests__/dueDiligence.test.ts
import { executeDueDiligence } from "../dueDiligence"

describe("dueDiligence", () => {
  it("exports executeDueDiligence function", () => {
    expect(typeof executeDueDiligence).toBe("function")
  })
})
```

- [ ] **Step 2: Implement the due diligence agent**

```typescript
// src/lib/reports/agents/dueDiligence.ts
import { generateJson } from "@/lib/ai/gemini"
import { DUE_DILIGENCE_SYSTEM } from "./prompts/system"
import { buildCarContext, truncateDescription } from "./prompts/helpers"
import type { PipelineContext } from "../pipeline"
import type { DueDiligenceReport } from "../types-v3"

export async function executeDueDiligence(
  ctx: PipelineContext
): Promise<{ data: DueDiligenceReport | null; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { vehicleIdentity, listingScrape, fairValue, technicalAnalysis } = ctx

  const carContext = buildCarContext(vehicleIdentity, listingScrape)
  const description = listingScrape?.descriptionFull
    ? truncateDescription(listingScrape.descriptionFull, 2000)
    : ""

  // Include known issues from technical analysis if available
  const knownIssues = technicalAnalysis?.commonIssues
    ?.map((i) => `- ${i.issue} (${i.severity})`)
    .join("\n") ?? "Not yet analyzed."

  // Include missing signals from fair value
  const missingSignals = fairValue?.signals_missing
    ?.map((s) => s.key)
    .join(", ") ?? "None identified."

  const userPrompt = `Generate a comprehensive due diligence report for this vehicle.

## Vehicle
${carContext}

## Listing Description
${description}

## Known Issues for This Model
${knownIssues}

## Missing Information (signals not found in listing)
${missingSignals}

## Required Output (JSON)
- questions: array of { category: "essential"|"vehicle_specific"|"history"|"financial", question: string, whyItMatters: string } (10-15 questions, SPECIFIC to this car)
- riskScore: { overall: number 0-100, breakdown: array of { category: string, score: number 0-100, note: string } for categories: "Pricing", "Provenance", "Condition", "Market" }
- ppiChecklist: array of { item: string, priority: "critical"|"recommended"|"optional", specificTo: string (e.g. "992 GT3 RS"), estimatedCost: string|null } (8-12 items)`

  const result = await generateJson<DueDiligenceReport>({
    systemPrompt: DUE_DILIGENCE_SYSTEM,
    userPrompt,
    temperature: 0.3,
    maxOutputTokens: 8192,
  })

  if (!result.ok) {
    console.error("[dueDiligence] Gemini failed:", result.error)
    return { data: null, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
  }

  return {
    data: result.data,
    durationMs: Date.now() - t0,
    agentModel: "gemini-2.5-flash",
  }
}
```

- [ ] **Step 3: Run tests and commit**

Run: `npx jest src/lib/reports/agents/__tests__/dueDiligence.test.ts --no-cache`

```bash
git add src/lib/reports/agents/dueDiligence.ts src/lib/reports/agents/__tests__/dueDiligence.test.ts
git commit -m "feat(reports): add Step 7 due diligence AI agent"
```

---

### Task 14: Step 8 — Market Researcher Agent

**Files:**
- Create: `src/lib/reports/agents/marketResearcher.ts`
- Test: `src/lib/reports/agents/__tests__/marketResearcher.test.ts`

- [ ] **Step 1: Write test and implement**

```typescript
// src/lib/reports/agents/__tests__/marketResearcher.test.ts
import { executeMarketResearcher } from "../marketResearcher"

describe("marketResearcher", () => {
  it("exports executeMarketResearcher function", () => {
    expect(typeof executeMarketResearcher).toBe("function")
  })
})
```

- [ ] **Step 2: Implement the market researcher agent**

```typescript
// src/lib/reports/agents/marketResearcher.ts
import { generateJson } from "@/lib/ai/gemini"
import { MARKET_RESEARCHER_SYSTEM } from "./prompts/system"
import { buildCarContext } from "./prompts/helpers"
import type { PipelineContext } from "../pipeline"
import type { MarketResearch } from "../types-v3"

export async function executeMarketResearcher(
  ctx: PipelineContext
): Promise<{ data: MarketResearch | null; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { vehicleIdentity, listingScrape } = ctx
  const carContext = buildCarContext(vehicleIdentity, listingScrape)

  const userPrompt = `Research the market reputation, expert opinions, and community sentiment for this vehicle.

## Vehicle
${carContext}

## Required Output (JSON)
- expertConsensus: { compiledAnalysis: array of { category: string (e.g. "Driving Experience", "Performance", "Value", "Build Quality", "Daily Usability"), sentiment: "positive"|"mixed"|"negative", summary: string (50-100 words) } (4-6 categories) }
- ownerSentiment: { commonPraise: string[] (3-5), commonComplaints: string[] (3-5), ownerTips: string[] (3-5 practical tips) }
- heritage: string (200-400 words on brand/model history and significance)
- relevantEvents: array of { name: string, frequency: string, location: string, description: string } (2-4 events)
- ownerClubs: string[] (3-5 relevant clubs/communities)`

  const result = await generateJson<MarketResearch>({
    systemPrompt: MARKET_RESEARCHER_SYSTEM,
    userPrompt,
    temperature: 0.3,
    maxOutputTokens: 8192,
  })

  if (!result.ok) {
    console.error("[marketResearcher] Gemini failed:", result.error)
    return { data: null, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
  }

  return {
    data: result.data,
    durationMs: Date.now() - t0,
    agentModel: "gemini-2.5-flash",
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx jest src/lib/reports/agents/__tests__/marketResearcher.test.ts --no-cache
git add src/lib/reports/agents/marketResearcher.ts src/lib/reports/agents/__tests__/marketResearcher.test.ts
git commit -m "feat(reports): add Step 8 market researcher AI agent"
```

---

### Task 15: Step 9 — Buyer Services Agent

**Files:**
- Create: `src/lib/reports/agents/buyerServices.ts`
- Test: `src/lib/reports/agents/__tests__/buyerServices.test.ts`

- [ ] **Step 1: Write test and implement**

```typescript
// src/lib/reports/agents/__tests__/buyerServices.test.ts
import { executeBuyerServices } from "../buyerServices"

describe("buyerServices", () => {
  it("exports executeBuyerServices function", () => {
    expect(typeof executeBuyerServices).toBe("function")
  })
})
```

- [ ] **Step 2: Implement the buyer services agent**

```typescript
// src/lib/reports/agents/buyerServices.ts
import { generateJson } from "@/lib/ai/gemini"
import { BUYER_SERVICES_SYSTEM } from "./prompts/system"
import { buildCarContext } from "./prompts/helpers"
import type { PipelineContext } from "../pipeline"
import type { BuyerServices } from "../types-v3"

export async function executeBuyerServices(
  ctx: PipelineContext
): Promise<{ data: BuyerServices | null; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { vehicleIdentity, listingScrape, marketData } = ctx
  const carContext = buildCarContext(vehicleIdentity, listingScrape)

  // Regional price data for regional variations section
  const regionalData = marketData?.regions
    ?.map((r) => `${r.region}: median $${r.median.toLocaleString()} (${r.count} listings)`)
    .join("\n") ?? "No regional data."

  const userPrompt = `Provide practical buyer services information for this vehicle.

## Vehicle
${carContext}

## Regional Market Data (REAL — from our database)
${regionalData}

## Required Output (JSON)
- partsAvailability: { overallRating: "readily_available"|"available"|"limited"|"scarce", oemNote: string, aftermarketNote: string, commonParts: array of { name, availability, priceRange } (5-8 items) }
- insuranceEstimates: { collectorPolicy: { annualPremium: { low, high }, mileageLimit: string, providers: string[] }, dailyDriver: { annualPremium: { low, high } } | null, notes: string, vehicleCategory: string }
- regionalVariations: { strongMarkets: array of { region, premiumPercent, reason }, weakerMarkets: array of { region, discountPercent, reason } } (use real regional data above to inform this)
- transportEstimates: { recommendation: "enclosed"|"open"|"either", specialHandling: string[], routes: array of { type, shortHaul: { perMile, example }, mediumHaul: { perMile, example }, longHaul: { perMile, example } }, seasonalNote: string, insuranceNote: string }
- originalMsrp: { basePrice: number|null, adjustedForInflation: number|null, note: string } | null`

  const result = await generateJson<BuyerServices>({
    systemPrompt: BUYER_SERVICES_SYSTEM,
    userPrompt,
    temperature: 0.3,
    maxOutputTokens: 8192,
  })

  if (!result.ok) {
    console.error("[buyerServices] Gemini failed:", result.error)
    return { data: null, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
  }

  return {
    data: result.data,
    durationMs: Date.now() - t0,
    agentModel: "gemini-2.5-flash",
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx jest src/lib/reports/agents/__tests__/buyerServices.test.ts --no-cache
git add src/lib/reports/agents/buyerServices.ts src/lib/reports/agents/__tests__/buyerServices.test.ts
git commit -m "feat(reports): add Step 9 buyer services AI agent"
```

---

### Task 16: Step 10 — Final Synthesis Agent

**Files:**
- Create: `src/lib/reports/agents/finalSynthesis.ts`
- Test: `src/lib/reports/agents/__tests__/finalSynthesis.test.ts`

- [ ] **Step 1: Write test**

```typescript
// src/lib/reports/agents/__tests__/finalSynthesis.test.ts
import { executeFinalSynthesis } from "../finalSynthesis"

describe("finalSynthesis", () => {
  it("exports executeFinalSynthesis function", () => {
    expect(typeof executeFinalSynthesis).toBe("function")
  })
})
```

- [ ] **Step 2: Implement the final synthesis agent**

```typescript
// src/lib/reports/agents/finalSynthesis.ts
import { generateJson } from "@/lib/ai/gemini"
import { FINAL_SYNTHESIS_SYSTEM } from "./prompts/system"
import { buildCarContext, buildPricingContext } from "./prompts/helpers"
import type { PipelineContext } from "../pipeline"
import type { FinalSynthesis } from "../types-v3"

export async function executeFinalSynthesis(
  ctx: PipelineContext
): Promise<{ data: FinalSynthesis | null; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const {
    vehicleIdentity,
    listingScrape,
    fairValue,
    technicalAnalysis,
    investmentAnalysis,
    dueDiligence,
    marketResearch,
    marketData,
  } = ctx

  const carContext = buildCarContext(vehicleIdentity, listingScrape)
  const pricingContext = buildPricingContext(
    fairValue,
    listingScrape,
    vehicleIdentity?.listingType ?? "classified"
  )

  // Summarize available intelligence for synthesis
  const sections: string[] = []

  if (technicalAnalysis) {
    sections.push(`Technical: Reliability ${technicalAnalysis.reliability.rating}, Rarity ${technicalAnalysis.productionData.rarityAssessment}, Investment Grade ${technicalAnalysis.collectorOutlook.investmentGrade}`)
  }
  if (investmentAnalysis) {
    sections.push(`Investment: ${investmentAnalysis.strategy.type} strategy, Narrative available`)
  }
  if (dueDiligence) {
    sections.push(`Risk Score: ${dueDiligence.riskScore.overall}/100, ${dueDiligence.questions.length} questions generated`)
  }
  if (marketResearch) {
    sections.push(`Market: Heritage analyzed, ${marketResearch.expertConsensus.compiledAnalysis.length} expert categories`)
  }
  if (marketData) {
    sections.push(`Data: ${marketData.totalDataPoints} data points, ${marketData.regionsWithData.length} regions`)
  }

  const signalsCoverage = fairValue
    ? `${fairValue.signals_detected.length}/${fairValue.signals_detected.length + (fairValue.signals_missing?.length ?? 0)}`
    : "0/0"

  const userPrompt = `Synthesize all analysis into a final executive summary and recommendation.

## Vehicle
${carContext}

## Pricing
${pricingContext}

## Intelligence Summary
${sections.join("\n") || "Limited intelligence available."}

## Signals Coverage
${signalsCoverage} signals verified

## Pre-computed Values (use these EXACT values in your output)
- signalsCoverage: "${signalsCoverage} signals verified"
- riskScore: ${dueDiligence?.riskScore?.overall ?? 50} (from Due Diligence analysis above)

## Required Output (JSON)
- executiveSummary: { headline: string (one powerful sentence), keyMetrics: { fairValueRange: string, signalsCoverage: "${signalsCoverage}", riskScore: ${dueDiligence?.riskScore?.overall ?? 50}, verdict: "BUY"|"WATCH"|"WALK", marketPosition: string (e.g. "12% below fair value") }, investmentThesis: string (100-200 words, substantive) }
- finalRecommendation: { score: number (1-10), conditionEstimate: string, verdict: string (200-300 words wrapping everything up) }`

  const result = await generateJson<FinalSynthesis>({
    systemPrompt: FINAL_SYNTHESIS_SYSTEM,
    userPrompt,
    temperature: 0.3,
    maxOutputTokens: 4096,
  })

  if (!result.ok) {
    console.error("[finalSynthesis] Gemini failed:", result.error)
    return { data: null, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
  }

  return {
    data: result.data,
    durationMs: Date.now() - t0,
    agentModel: "gemini-2.5-flash",
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx jest src/lib/reports/agents/__tests__/finalSynthesis.test.ts --no-cache
git add src/lib/reports/agents/finalSynthesis.ts src/lib/reports/agents/__tests__/finalSynthesis.test.ts
git commit -m "feat(reports): add Step 10 final synthesis AI agent"
```

---

### Task 17: Update Agent Registry with All AI Agents

**Files:**
- Modify: `src/lib/reports/agents/index.ts`

- [ ] **Step 1: Update the registry with all agents**

Replace the placeholder stubs in `src/lib/reports/agents/index.ts`:

```typescript
// src/lib/reports/agents/index.ts
import type { StepExecutor } from "../pipeline"
import { executeListingScraper } from "./listingScraper"
import { executeVehicleIdentifier } from "./vehicleIdentifier"
import { executeMarketDataBundle } from "./marketDataBundle"
import { executeFairValueEngine } from "./fairValueEngine"
import { executeTechnicalAnalyst } from "./technicalAnalyst"
import { executeInvestmentAnalyst } from "./investmentAnalyst"
import { executeDueDiligence } from "./dueDiligence"
import { executeMarketResearcher } from "./marketResearcher"
import { executeBuyerServices } from "./buyerServices"
import { executeFinalSynthesis } from "./finalSynthesis"

/**
 * Registry of all V3 pipeline step executors.
 */
export function createV3Executors(): Record<string, StepExecutor> {
  return {
    listing_scrape: executeListingScraper,
    vehicle_identity: executeVehicleIdentifier,
    market_data_bundle: executeMarketDataBundle,
    fair_value: executeFairValueEngine,
    technical_analysis: executeTechnicalAnalyst,
    investment_analysis: executeInvestmentAnalyst,
    due_diligence: executeDueDiligence,
    market_research: executeMarketResearcher,
    buyer_services: executeBuyerServices,
    final_synthesis: executeFinalSynthesis,
  }
}
```

- [ ] **Step 2: Run all agent tests**

Run: `npx jest src/lib/reports/agents/ --no-cache`
Expected: PASS — all agent tests

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/agents/index.ts
git commit -m "feat(reports): wire all 10 AI agents into pipeline executor registry"
```

---

## Chunk 4: Generation UI, Report Display, API Integration & Exports

This chunk covers the user-facing pieces: the generation loading experience (photo slideshow + progress stepper), the API route refactor, the new V3 section components, data trust badges, and export updates.

---

### Task 18: Generation Stepper Component

**Files:**
- Create: `src/components/report/GenerationStepper.tsx`

This is the cinematic full-screen loading experience with photo slideshow and progress steps.

- [ ] **Step 1: Create the GenerationStepper component**

```tsx
// src/components/report/GenerationStepper.tsx
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { PipelineProgress, StepStatus } from "@/lib/reports/types-v3"

interface GenerationStepperProps {
  carImages: string[]
  carTitle: string
  series: string
  listingType: "auction" | "classified"
  steps: PipelineProgress[]
  currentStep: number
  totalDataPoints?: number
  onComplete?: () => void
}

// ─── Rotating messages per step ───
const ROTATING_MESSAGES: Record<string, string[]> = {
  listing_scrape: [
    "Extracting every detail from the source listing...",
    "Reading seller notes, specs, and equipment list...",
    "Analyzing {photoCount} photos for condition clues...",
  ],
  vehicle_identity: [
    "Matching series, variant, and factory options...",
    "Cross-referencing VIN with production records...",
    "Identifying {make} {series} specifications...",
  ],
  market_data_bundle: [
    "Querying {totalDataPoints} listings across 4 regional markets...",
    "Analyzing sold prices from BaT, Cars & Bids, RM Sotheby's...",
    "Computing cross-border arbitrage opportunities...",
    "Real transaction data — not estimates...",
  ],
  fair_value: [
    "Applying detected signals as value modifiers...",
    "Computing specific-car fair value bands...",
    "Analyzing color rarity and option premiums...",
  ],
  technical_analysis: [
    "Researching reliability and known issues...",
    "Analyzing production numbers for this specification...",
    "Evaluating key strengths and concerns...",
  ],
  investment_analysis: [
    "Building your strategy...",
    "Projecting ownership costs over 1, 3, and 5 years...",
    "Modeling resale value trajectories...",
  ],
  due_diligence: [
    "Generating vehicle-specific questions for the seller...",
    "Computing risk assessment score...",
    "Building pre-purchase inspection checklist...",
  ],
  market_research: [
    "Compiling expert opinions from automotive journalists...",
    "Analyzing owner community sentiment...",
    "Researching model heritage and significance...",
  ],
  buyer_services: [
    "Estimating parts availability and pricing...",
    "Computing insurance cost projections...",
    "Calculating transportation and shipping options...",
  ],
  final_synthesis: [
    "Composing executive summary and investment thesis...",
    "Synthesizing 10 research dimensions into your verdict...",
    "Your Investment Dossier is almost ready...",
  ],
}

const PERSONALITY_MESSAGES = [
  "Thinking about what makes this one special...",
  "Cross-referencing auction results from three continents...",
  `This ${"{series}"} has an interesting story...`, // {series} interpolated at render
  "Checking what specialists say about this generation...",
  "Almost there — synthesizing everything we found...",
  "Your dossier is going to be thorough...",
  "We take this more seriously than the seller does...",
]

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return <span className="text-green-500">&#10003;</span>
    case "in_progress":
      return (
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-amber-400"
        >
          &#9673;
        </motion.span>
      )
    case "failed":
      return <span className="text-red-500">&#10007;</span>
    default:
      return <span className="text-gray-500">&#9675;</span>
  }
}

export function GenerationStepper({
  carImages,
  carTitle,
  series,
  listingType,
  steps,
  currentStep,
  totalDataPoints,
  onComplete,
}: GenerationStepperProps) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const [rotatingMsgIndex, setRotatingMsgIndex] = useState(0)
  const [personalityIndex, setPersonalityIndex] = useState(0)

  const photos = useMemo(
    () => (carImages.length > 0 ? carImages : []),
    [carImages]
  )

  // Photo rotation every 4s
  useEffect(() => {
    if (photos.length <= 1) return
    const interval = setInterval(() => {
      setPhotoIndex((i) => (i + 1) % photos.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [photos.length])

  // Rotating message every 3s
  useEffect(() => {
    const interval = setInterval(() => {
      setRotatingMsgIndex((i) => i + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Personality message every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      setPersonalityIndex((i) => (i + 1) % PERSONALITY_MESSAGES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Detect completion
  const allDone = steps.every(
    (s) => s.status === "completed" || s.status === "failed"
  )

  useEffect(() => {
    if (allDone && onComplete) {
      const timer = setTimeout(onComplete, 2000) // Hold for 2s before transitioning
      return () => clearTimeout(timer)
    }
  }, [allDone, onComplete])

  // Current step's rotating messages — interpolate dynamic values
  const activeStep = steps.find((s) => s.status === "in_progress")
  const activeMessages = activeStep
    ? ROTATING_MESSAGES[activeStep.sectionKey] ?? []
    : []
  const rawMessage =
    activeMessages.length > 0
      ? activeMessages[rotatingMsgIndex % activeMessages.length]
      : ""
  const currentMessage = rawMessage
    .replace("{totalDataPoints}", String(totalDataPoints ?? "64,000+"))
    .replace("{make}", carTitle.split(" ").slice(1, 2).join(" ") || "Porsche")
    .replace("{series}", series)
    .replace("{photoCount}", String(carImages.length))

  const completedCount = steps.filter((s) => s.status === "completed").length

  return (
    <div className="fixed inset-0 z-50 flex flex-col lg:flex-row bg-black">
      {/* Photo section */}
      <div className="relative h-[50vh] lg:h-full lg:w-[60%] overflow-hidden">
        <AnimatePresence mode="wait">
          {photos.length > 0 ? (
            <motion.img
              key={photoIndex}
              src={photos[photoIndex]}
              alt={carTitle}
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ opacity: 0, scale: 1.0 }}
              animate={{ opacity: 1, scale: 1.05 }} // Ken Burns: slow zoom IN over 4s
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 1, ease: "easeInOut" },
                scale: { duration: 4, ease: "linear" },  // Continuous zoom during display
              }}
            />
          ) : (
            // 0-photo fallback: MonzaHaus branded gradient
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-amber-950/20 to-gray-900 flex items-center justify-center">
              <span className="text-4xl font-bold text-white/10 tracking-widest">MONZA</span>
            </div>
          )}
        </AnimatePresence>

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Photo dots */}
        {photos.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.slice(0, 12).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i === photoIndex % Math.min(photos.length, 12)
                    ? "bg-white"
                    : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        {/* Completion overlay with golden glow */}
        {allDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-amber-900/30 via-black/50 to-amber-900/10"
          >
            <h2 className="text-2xl font-bold text-white mb-2">
              Your Investment Dossier is ready
            </h2>
            <p className="text-white/70 mb-6">{carTitle}</p>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={onComplete}
              className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-lg transition-colors"
            >
              View Report
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Stepper section */}
      <div className="flex-1 lg:w-[40%] p-6 lg:p-10 overflow-y-auto flex flex-col justify-center">
        {/* Status line */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-1">
            {activeStep?.label ?? "Preparing..."}
          </h3>
          <p className="text-sm text-white/60 h-5">{currentMessage}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-amber-500 rounded-full"
              animate={{ width: `${(completedCount / steps.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-xs text-white/40 mt-1">
            Step {Math.min(completedCount + 1, steps.length)} of {steps.length}
          </p>
        </div>

        {/* Step list */}
        <div className="space-y-3 mb-8">
          {steps.map((step) => (
            <div
              key={step.sectionKey}
              className="flex items-start gap-3 text-sm"
            >
              <div className="w-5 text-center mt-0.5">
                <StepIcon status={step.status} />
              </div>
              <div>
                <span
                  className={
                    step.status === "completed"
                      ? "text-white/80"
                      : step.status === "in_progress"
                        ? "text-white font-medium"
                        : step.status === "failed"
                          ? "text-red-400"
                          : "text-white/40"
                  }
                >
                  {step.label}
                </span>
                {step.completionNote && (
                  <span className="text-white/40 ml-2 text-xs">
                    — {step.completionNote}
                  </span>
                )}
                {step.status === "failed" && (
                  <span className="text-red-400/60 ml-2 text-xs">
                    (using cached data)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Personality line */}
        <p className="text-xs italic text-white/30">
          {PERSONALITY_MESSAGES[personalityIndex].replace("{series}", series)}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/GenerationStepper.tsx
git commit -m "feat(reports): add GenerationStepper loading experience with photo slideshow"
```

---

### Task 19: Data Trust Badge Component

**Files:**
- Create: `src/components/report/DataTrustBadge.tsx`

- [ ] **Step 1: Create the badge component**

```tsx
// src/components/report/DataTrustBadge.tsx
import type { DataTrustLevel } from "@/lib/reports/types-v3"

const BADGE_CONFIG: Record<DataTrustLevel, { label: string; color: string; bg: string }> = {
  verified_from_data: {
    label: "Verified from Data",
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/30",
  },
  ai_analysis: {
    label: "AI Analysis",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  ai_estimated: {
    label: "AI Estimated",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
  },
  from_listing: {
    label: "From Listing",
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800/50",
  },
}

interface DataTrustBadgeProps {
  level: DataTrustLevel
  dataPoints?: number
  className?: string
}

export function DataTrustBadge({ level, dataPoints, className = "" }: DataTrustBadgeProps) {
  const config = BADGE_CONFIG[level]

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color} ${className}`}
    >
      {config.label}
      {dataPoints != null && dataPoints > 0 && (
        <span className="opacity-70">({dataPoints} data points)</span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/DataTrustBadge.tsx
git commit -m "feat(reports): add DataTrustBadge component for section data source indicators"
```

---

### Task 20: API Route Refactor — V3 Pipeline Integration

**Files:**
- Modify: `src/app/api/analyze/route.ts`

Refactor the existing `/api/analyze` endpoint to use the V3 pipeline when requested, while maintaining backward compatibility with the existing V2 flow.

- [ ] **Step 1: Read the current route.ts to plan the refactor**

Read `src/app/api/analyze/route.ts` in full.

- [ ] **Step 2: Add V3 pipeline branch to the analyze route**

Add a `version` parameter to the request body. When `version: 3` is specified, use the V3 pipeline. Otherwise, run the existing V2 flow unchanged.

At the top of the POST handler, after cache check and credit validation:

```typescript
// After line ~233 (credit check), add V3 branch:
const requestedVersion = body.version ?? 2

if (requestedVersion === 3) {
  // V3 multi-agent pipeline
  const { runV3Pipeline } = await import("@/lib/reports/pipeline")
  const { createV3Executors } = await import("@/lib/reports/agents")
  const { saveReportSection, hasV3Report } = await import("@/lib/reports/reportSections")

  // V3 cache check
  const cachedV3 = await hasV3Report(listingId)
  if (cachedV3 && !body.force) {
    // Return cached V3 sections
    const { fetchReportSections } = await import("@/lib/reports/reportSections")
    const sections = await fetchReportSections(listingId, 1)
    return NextResponse.json({
      success: true,
      ok: true,
      cached: true,
      version: 3,
      sections: sections.map((s) => ({
        key: s.section_key,
        data: s.section_data,
      })),
    })
  }

  const executors = createV3Executors()
  const progressUpdates: PipelineProgress[] = []

  const { report, results } = await runV3Pipeline({
    listingId,
    car,
    executors,
    onProgress: (p) => progressUpdates.push(p),
  })

  // Persist each section
  for (const result of results) {
    await saveReportSection(listingId, 1, result)
  }

  // Also persist fair value to existing tables (backward compat)
  if (report.fairValue) {
    // ... existing saveHausReport + saveSignals calls
  }

  // Deduct credit
  if (!alreadyGenerated) {
    await deductCredit(userId, listingId, listingId)
  }

  return NextResponse.json({
    success: true,
    ok: true,
    cached: false,
    version: 3,
    report,
    sections: results.map((r) => ({ key: r.sectionKey, data: r.data })),
    creditUsed: alreadyGenerated ? 0 : REPORT_PISTON_COST,
    creditsRemaining: userCredits - (alreadyGenerated ? 0 : REPORT_PISTON_COST),
    totalDurationMs: report.totalDurationMs,
    stepsCompleted: report.stepsCompleted,
    stepsFailed: report.stepsFailed,
  })
}

// ... existing V2 flow continues unchanged below
```

**Note:** The exact integration requires careful placement within the existing route.ts control flow. The implementing engineer should read the full route and insert the V3 branch at the appropriate point after auth, credit check, and listing fetch — but before the existing signal extraction begins.

- [ ] **Step 3: Test manually with a real listing**

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth_cookie>" \
  -d '{"listingId": "<real_listing_id>", "version": 3}'
```

Expected: JSON response with `version: 3`, `sections` array with 10 entries, `stepsCompleted >= 4` (data steps succeed; AI steps depend on Gemini API key).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat(reports): integrate V3 multi-agent pipeline into /api/analyze route"
```

---

### Task 21: V3 Report Section Components

**Files:**
- Create: `src/components/report/v3/TechnicalAnalysisSection.tsx`
- Create: `src/components/report/v3/InvestmentStrategySection.tsx`
- Create: `src/components/report/v3/DueDiligenceSection.tsx`
- Create: `src/components/report/v3/MarketResearchSection.tsx`
- Create: `src/components/report/v3/BuyerServicesSection.tsx`
- Create: `src/components/report/v3/ExecutiveSummarySection.tsx`
- Create: `src/components/report/v3/OwnershipCostSection.tsx`
- Create: `src/components/report/v3/ResaleTimelineSection.tsx`
- Create: `src/components/report/v3/index.ts`

Each section component receives typed props from the pipeline output and renders the content with a DataTrustBadge.

- [ ] **Step 1: Create the section component pattern**

All V3 section components follow the same pattern:

```tsx
// src/components/report/v3/TechnicalAnalysisSection.tsx
import type { TechnicalAnalysis } from "@/lib/reports/types-v3"
import { DataTrustBadge } from "../DataTrustBadge"

interface Props {
  data: TechnicalAnalysis
}

export function TechnicalAnalysisSection({ data }: Props) {
  return (
    <section className="space-y-6">
      {/* Model History & Heritage */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-semibold">Vehicle Heritage</h3>
          <DataTrustBadge level="ai_analysis" />
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {data.modelHistory}
        </p>
      </div>

      {/* What Makes This Spec Special */}
      <div>
        <h3 className="text-lg font-semibold mb-2">
          What Makes This Specification Special
        </h3>
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {data.whatMakesThisSpecSpecial}
        </p>
      </div>

      {/* Production Numbers & Rarity */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Production & Rarity</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {data.productionData.totalProduction && (
            <div>
              <span className="text-muted-foreground">Total Production:</span>{" "}
              {data.productionData.totalProduction}
            </div>
          )}
          {data.productionData.thisConfigEstimate && (
            <div>
              <span className="text-muted-foreground">This Config:</span>{" "}
              {data.productionData.thisConfigEstimate}
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Rarity:</span>{" "}
            <span className="capitalize">
              {data.productionData.rarityAssessment.replace("_", " ")}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {data.productionData.rarityNote}
        </p>
      </div>

      {/* Key Strengths */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Key Strengths</h3>
        <div className="space-y-2">
          {data.keyStrengths.map((s, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">{s.point}:</span>{" "}
              <span className="text-muted-foreground">{s.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Common Issues */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Common Issues & Concerns</h3>
        <div className="space-y-2">
          {data.commonIssues.map((issue, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-sm border-l-2 pl-3"
              style={{
                borderColor:
                  issue.severity === "critical"
                    ? "#ef4444"
                    : issue.severity === "moderate"
                      ? "#f59e0b"
                      : "#6b7280",
              }}
            >
              <div>
                <span className="font-medium">{issue.issue}</span>
                {issue.typicalCost && (
                  <span className="text-muted-foreground ml-2">
                    ({issue.typicalCost})
                  </span>
                )}
                <p className="text-xs text-muted-foreground">
                  Applies to: {issue.appliesTo}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reliability */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Reliability Assessment</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Rating:</span>{" "}
            <span className="capitalize">
              {data.reliability.rating.replace("_", " ")}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Maintenance Cost:</span>{" "}
            <span className="capitalize">
              {data.reliability.maintenanceCostLevel.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Collector Outlook */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Collector Outlook</h3>
        <div className="grid grid-cols-2 gap-4 text-sm mb-2">
          <div>
            <span className="text-muted-foreground">Investment Grade:</span>{" "}
            <span className="capitalize">{data.collectorOutlook.investmentGrade}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Demand:</span>{" "}
            <span className="capitalize">{data.collectorOutlook.demandLevel}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {data.collectorOutlook.futureOutlook}
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create remaining section components**

Create the other section components following the same pattern. Each renders its typed props with appropriate DataTrustBadges:

- `InvestmentStrategySection.tsx` — strategy (auction/classified branching), DataTrustBadge = "verified_from_data" for data-anchored fields, "ai_analysis" for strategy text
- `DueDiligenceSection.tsx` — questions, risk score, PPI checklist, DataTrustBadge = "ai_analysis"
- `MarketResearchSection.tsx` — expert consensus, owner sentiment, heritage, DataTrustBadge = "ai_analysis"
- `BuyerServicesSection.tsx` — parts, insurance, transport, MSRP, DataTrustBadge = "ai_estimated"
- `ExecutiveSummarySection.tsx` — headline, key metrics, thesis, DataTrustBadge = "verified_from_data" for metrics
- `OwnershipCostSection.tsx` — year 1/3/5 cost projections, DataTrustBadge = "ai_estimated"
- `ResaleTimelineSection.tsx` — year 1/3/5/10 resale projections, DataTrustBadge = "ai_estimated"

The implementing engineer should follow the `TechnicalAnalysisSection.tsx` pattern for each. All accept their respective typed props from `types-v3.ts`.

- [ ] **Step 3: Create barrel export**

```typescript
// src/components/report/v3/index.ts
export { TechnicalAnalysisSection } from "./TechnicalAnalysisSection"
export { InvestmentStrategySection } from "./InvestmentStrategySection"
export { DueDiligenceSection } from "./DueDiligenceSection"
export { MarketResearchSection } from "./MarketResearchSection"
export { BuyerServicesSection } from "./BuyerServicesSection"
export { ExecutiveSummarySection } from "./ExecutiveSummarySection"
export { OwnershipCostSection } from "./OwnershipCostSection"
export { ResaleTimelineSection } from "./ResaleTimelineSection"
```

- [ ] **Step 4: Commit**

```bash
git add src/components/report/v3/
git commit -m "feat(reports): add V3 report section components with DataTrustBadges"
```

---

### Task 22: Update ReportClientV2 for V3 Sections

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx`
- Modify: `src/app/[locale]/cars/[make]/[id]/report/page.tsx`

- [ ] **Step 1: Add V3 section props to ReportClientV2**

Add optional V3 props to the existing component. When present, render the new sections alongside existing ones:

```typescript
// Add to ReportClientV2Props:
import type { HausReportV3 } from "@/lib/reports/types-v3"

interface ReportClientV2Props {
  // ... existing props
  v3Report?: HausReportV3 | null
}
```

- [ ] **Step 2: Render V3 sections when available**

Reorganize the component body to match the spec's section ordering (5.2). The V3 sections are **interleaved** with existing V2 blocks — NOT appended at the end.

**Section order per spec:**

```tsx
{/* ─── Group 1: Overview (V3 Executive Summary FIRST) ─── */}
{v3Report?.finalSynthesis && (
  <ExecutiveSummarySection data={v3Report.finalSynthesis} />
)}
{/* Existing: ReportHeader */}

{/* ─── Group 2: Valuation & Strategy ─── */}
{/* Existing: VerdictBlock (add DataTrustBadge level="verified_from_data") */}
{v3Report?.investmentAnalysis && (
  <InvestmentStrategySection
    data={v3Report.investmentAnalysis}
    listingType={v3Report.vehicleIdentity?.listingType ?? "classified"}
  />
)}
{/* Existing: SpecificCarFairValueBlock (add DataTrustBadge level="verified_from_data") */}
{/* Existing: ValuationBreakdownBlock */}
{/* Existing: ArbitrageSignalBlock (add DataTrustBadge level="verified_from_data") */}

{/* ─── Group 3: Intelligence ─── */}
{v3Report?.technicalAnalysis && (
  <TechnicalAnalysisSection data={v3Report.technicalAnalysis} />
)}
{/* Existing: ColorIntelBlock, VinIntelBlock */}

{/* ─── Group 4: Market & Research ─── */}
{/* Existing: MarketContextBlock, ComparablesAndPositioningBlock */}
{v3Report?.marketResearch && (
  <MarketResearchSection data={v3Report.marketResearch} />
)}

{/* ─── Group 5: Buyer's Toolkit ─── */}
{v3Report?.investmentAnalysis?.ownershipCosts && (
  <OwnershipCostSection data={v3Report.investmentAnalysis.ownershipCosts} />
)}
{v3Report?.investmentAnalysis?.resaleTimeline && (
  <ResaleTimelineSection data={v3Report.investmentAnalysis.resaleTimeline} />
)}
{v3Report?.dueDiligence && (
  <DueDiligenceSection data={v3Report.dueDiligence} />
)}
{v3Report?.buyerServices && (
  <BuyerServicesSection data={v3Report.buyerServices} />
)}
```

- [ ] **Step 3: Update page.tsx to fetch V3 sections**

In `page.tsx`, after fetching the existing report, also check for V3 sections:

```typescript
// After assembling HausReport, try to load V3 data
let v3Report: HausReportV3 | null = null
try {
  const { fetchReportSections } = await import("@/lib/reports/reportSections")
  const sections = await fetchReportSections(resolvedId, 1)
  if (sections.length > 0) {
    v3Report = assembleV3ReportFromSections(sections, resolvedId)
  }
} catch {
  // V3 not available — render V2 only
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx src/app/[locale]/cars/[make]/[id]/report/page.tsx
git commit -m "feat(reports): integrate V3 sections into ReportClientV2 display"
```

---

### Task 23: V3 Report Assembly from DB Sections

**Files:**
- Create: `src/lib/reports/assembleV3Report.ts`
- Test: `src/lib/reports/__tests__/assembleV3Report.test.ts`

- [ ] **Step 1: Write test**

```typescript
// src/lib/reports/__tests__/assembleV3Report.test.ts
import { assembleV3ReportFromSections } from "../assembleV3Report"
import type { ReportSectionRow } from "../reportSections"

describe("assembleV3ReportFromSections", () => {
  it("assembles a V3 report from section rows", () => {
    const rows: ReportSectionRow[] = [
      {
        id: "1",
        listing_id: "test-123",
        report_version: 1,
        section_key: "vehicle_identity" as any,
        section_data: { year: 2024, make: "Porsche", series: "992" },
        agent_model: null,
        generation_duration_ms: 100,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "2",
        listing_id: "test-123",
        report_version: 1,
        section_key: "technical_analysis" as any,
        section_data: { modelHistory: "The 992..." },
        agent_model: "gemini-2.5-flash",
        generation_duration_ms: 3000,
        created_at: "2026-01-01T00:00:05Z",
      },
    ]

    const report = assembleV3ReportFromSections(rows, "test-123")

    expect(report.listingId).toBe("test-123")
    expect(report.reportVersion).toBe(3)
    expect(report.vehicleIdentity).toBeDefined()
    expect((report.vehicleIdentity as any).series).toBe("992")
    expect(report.technicalAnalysis).toBeDefined()
    expect(report.stepsCompleted).toBe(2)
  })

  it("returns null fields for missing sections", () => {
    const report = assembleV3ReportFromSections([], "test-123")
    expect(report.technicalAnalysis).toBeNull()
    expect(report.investmentAnalysis).toBeNull()
    expect(report.stepsCompleted).toBe(0)
  })
})
```

- [ ] **Step 2: Implement assembly function**

```typescript
// src/lib/reports/assembleV3Report.ts
import type { ReportSectionRow } from "./reportSections"
import type {
  HausReportV3,
  ScrapedListingFull,
  VehicleIdentity,
  MarketDataBundle,
  TechnicalAnalysis,
  InvestmentAnalysis,
  DueDiligenceReport,
  MarketResearch,
  BuyerServices,
  FinalSynthesis,
  ReportSectionKey,
} from "./types-v3"

export function assembleV3ReportFromSections(
  rows: ReportSectionRow[],
  listingId: string
): HausReportV3 {
  const sectionMap = new Map<ReportSectionKey, unknown>()
  let totalDuration = 0

  for (const row of rows) {
    sectionMap.set(row.section_key, row.section_data)
    totalDuration += row.generation_duration_ms ?? 0
  }

  return {
    listingId,
    reportVersion: 3,
    listingScrape: (sectionMap.get("listing_scrape") as ScrapedListingFull) ?? null,
    vehicleIdentity: (sectionMap.get("vehicle_identity") as VehicleIdentity) ??
      ({ year: 0, make: "Unknown", model: "", series: "unknown", family: "unknown", variant: null, trim: null, generationYears: "unknown", engine: null, transmission: null, drivetrain: null, bodyStyle: null, horsepower: null, factoryOptions: [], isSpecialEdition: false, listingType: "classified" } as VehicleIdentity),
    marketData: (sectionMap.get("market_data_bundle") as MarketDataBundle) ??
      ({ marketStats: {} as any, regions: [], dbComparables: [], comparablesCount: 0, arbitrage: null, similarCars: [], trendPercent12m: null, trendDirection: "insufficient_data", totalDataPoints: 0, oldestDataPoint: null, newestDataPoint: null, regionsWithData: [] } as MarketDataBundle),
    technicalAnalysis: (sectionMap.get("technical_analysis") as TechnicalAnalysis) ?? null,
    investmentAnalysis: (sectionMap.get("investment_analysis") as InvestmentAnalysis) ?? null,
    dueDiligence: (sectionMap.get("due_diligence") as DueDiligenceReport) ?? null,
    marketResearch: (sectionMap.get("market_research") as MarketResearch) ?? null,
    buyerServices: (sectionMap.get("buyer_services") as BuyerServices) ?? null,
    finalSynthesis: (sectionMap.get("final_synthesis") as FinalSynthesis) ?? null,
    generatedAt: rows[rows.length - 1]?.created_at ?? new Date().toISOString(),
    totalDurationMs: totalDuration,
    stepsCompleted: rows.length,
    stepsFailed: 10 - rows.length,
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx jest src/lib/reports/__tests__/assembleV3Report.test.ts --no-cache
git add src/lib/reports/assembleV3Report.ts src/lib/reports/__tests__/assembleV3Report.test.ts
git commit -m "feat(reports): add V3 report assembly from DB section rows"
```

---

### Task 24: Update PDF Export for V3 Sections

**Files:**
- Modify: `src/lib/exports/pdf/renderReport.tsx`

- [ ] **Step 1: Add V3 data to PDF input type**

Add optional V3 fields to `RenderReportInput`:

```typescript
import type { HausReportV3 } from "@/lib/reports/types-v3"

// In the input type:
v3Report?: HausReportV3 | null
```

- [ ] **Step 2: Add new PDF pages for V3 sections**

After the existing pages, conditionally render V3 content:

```tsx
{/* V3: Technical Analysis Page */}
{input.v3Report?.technicalAnalysis && (
  <Page size="A4" style={styles.page}>
    {/* Heritage, Production, Key Strengths, Common Issues, Reliability */}
  </Page>
)}

{/* V3: Investment Strategy Page */}
{input.v3Report?.investmentAnalysis && (
  <Page size="A4" style={styles.page}>
    {/* Strategy, Ownership Costs, Resale Timeline */}
  </Page>
)}

{/* V3: Due Diligence & Buyer Services Page */}
{input.v3Report?.dueDiligence && (
  <Page size="A4" style={styles.page}>
    {/* Questions, Risk Score, PPI Checklist, Parts, Insurance, Transport */}
  </Page>
)}
```

The implementing engineer should follow the existing PDF page patterns (styles, fonts, layout) from the current `renderReport.tsx`. Each V3 section maps to styled react-pdf components.

- [ ] **Step 3: Commit**

```bash
git add src/lib/exports/pdf/renderReport.tsx
git commit -m "feat(reports): add V3 sections to PDF export"
```

---

### Task 25: Update Excel Export for V3 Sections

**Files:**
- Modify: `src/lib/exports/excel/renderReport.ts`

- [ ] **Step 1: Add V3 sheets**

After the existing 4 sheets, add new sheets for V3 data:

```typescript
// In renderReportToExcelBuffer, after existing sheets:
if (input.v3Report?.technicalAnalysis) {
  buildTechnicalSheet(wb, input.v3Report.technicalAnalysis)
}
if (input.v3Report?.investmentAnalysis) {
  buildInvestmentSheet(wb, input.v3Report.investmentAnalysis)
}
if (input.v3Report?.dueDiligence) {
  buildDueDiligenceSheet(wb, input.v3Report.dueDiligence)
}
if (input.v3Report?.buyerServices) {
  buildBuyerServicesSheet(wb, input.v3Report.buyerServices)
}
```

Each `buildXxxSheet` function creates a new worksheet with rows for each data point, following the existing ExcelJS patterns in the codebase.

- [ ] **Step 2: Commit**

```bash
git add src/lib/exports/excel/renderReport.ts
git commit -m "feat(reports): add V3 sections to Excel export"
```

---

### Task 26: Client-Side Report Generation Flow with SSE

> **Note:** Tasks 26 and 27 from the original plan were merged. The client uses SSE from the start so that steps progress one-by-one (the core UX innovation). A non-SSE fallback would show all steps completing simultaneously, which defeats the purpose of the GenerationStepper.

**Files:**
**Files:**
- Create: `src/app/api/analyze/v3/route.ts`
- Modify: `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx`

- [ ] **Step 1: Create SSE route with auth + credit checks**

```typescript
// src/app/api/analyze/v3/route.ts
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchLiveListingById } from "@/lib/supabaseLiveListings"
import { runV3Pipeline } from "@/lib/reports/pipeline"
import { createV3Executors } from "@/lib/reports/agents"
import { saveReportSection, hasV3Report } from "@/lib/reports/reportSections"
import {
  getOrCreateUser,
  checkAndResetFreeCredits,
  hasAlreadyGenerated,
  deductCredit,
  REPORT_PISTON_COST,
} from "@/lib/reports/queries"
import type { PipelineProgress } from "@/lib/reports/types-v3"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { listingId } = body

  // ─── Auth check ───
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  // ─── User + credit initialization (mirrors /api/analyze) ───
  const dbUser = await getOrCreateUser(user.id, user.email ?? "", user.user_metadata?.name)
  await checkAndResetFreeCredits(dbUser.id)
  const alreadyGenerated = await hasAlreadyGenerated(dbUser.id, listingId)

  // ─── Cache check: return early if V3 already exists ───
  if (!body.force && await hasV3Report(listingId)) {
    return new Response(JSON.stringify({ cached: true, message: "V3 report already exists" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  // ─── Credit check (skip if already generated = free re-access) ───
  if (!alreadyGenerated && !dbUser.unlimited_reports) {
    const balance = (dbUser.credits_balance ?? 0) + (dbUser.pack_credits_balance ?? 0)
    if (balance < REPORT_PISTON_COST) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      })
    }
  }

  // ─── Fetch listing ───
  const car = await fetchLiveListingById(listingId)
  if (!car) {
    return new Response("Listing not found", { status: 404 })
  }

  // ─── SSE stream with real-time progress ───
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      const executors = createV3Executors()

      try {
        const { report, results } = await runV3Pipeline({
          listingId,
          car,
          executors,
          onProgress: (p: PipelineProgress) => {
            send("progress", p)
          },
        })

        // Persist sections (parallel for speed)
        await Promise.all(
          results.map((result) => saveReportSection(listingId, 1, result))
        )

        // Deduct credit AFTER successful generation
        if (!alreadyGenerated) {
          await deductCredit(dbUser.id, listingId, listingId)
        }

        send("complete", { report })
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Pipeline failed",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Prevent nginx/proxy buffering
    },
  })
}
```

- [ ] **Step 2: Add client-side SSE handler + GenerationStepper rendering**

In ReportClientV2, add state and SSE-based generation handler:

```tsx
// State for V3 generation
const [isGenerating, setIsGenerating] = useState(false)
const [generationSteps, setGenerationSteps] = useState<PipelineProgress[]>([])
const [v3Data, setV3Data] = useState<HausReportV3 | null>(v3Report ?? null)

async function handleGenerateV3() {
  setIsGenerating(true)

  // Initialize all 10 steps as pending
  const initialSteps = STEP_DEFS.map((s) => ({
    ...s,
    status: "pending" as const,
  }))
  setGenerationSteps(initialSteps)

  try {
    const res = await fetch("/api/analyze/v3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: car.id }),
    })

    // Handle non-streaming responses (cached, error)
    const contentType = res.headers.get("Content-Type") ?? ""
    if (contentType.includes("application/json")) {
      const data = await res.json()
      if (data.cached) {
        // Reload page to show cached report
        window.location.reload()
        return
      }
      if (data.error) {
        console.error("V3 generation failed:", data.error)
        setIsGenerating(false)
        return
      }
    }

    // Parse SSE stream for real-time progress
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) return

    let buffer = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split("\n\n")
      buffer = events.pop() ?? "" // Keep incomplete event in buffer

      for (const eventStr of events) {
        if (!eventStr.trim()) continue
        const eventMatch = eventStr.match(/event: (\w+)/)
        const dataMatch = eventStr.match(/data: (.+)/)
        if (!eventMatch || !dataMatch) continue

        const event = eventMatch[1]
        const data = JSON.parse(dataMatch[1])

        if (event === "progress") {
          setGenerationSteps((prev) =>
            prev.map((s) =>
              s.sectionKey === data.sectionKey ? { ...s, ...data } : s
            )
          )
        } else if (event === "complete") {
          setV3Data(data.report)
        }
      }
    }
  } catch (err) {
    console.error("V3 generation failed:", err)
  }

  // Hold completion animation for 2.5s, then dismiss stepper
  setTimeout(() => setIsGenerating(false), 2500)
}
```

And the stepper rendering:

```tsx
{isGenerating && (
  <GenerationStepper
    carImages={car.images ?? []}
    carTitle={composeCarTitle(car)}
    series={extractSeries(car.model ?? "", car.year ?? 0, car.make ?? "") ?? ""}
    listingType={getListingType(car.platform)}
    steps={generationSteps}
    currentStep={generationSteps.filter((s) => s.status === "completed").length}
    onComplete={() => setIsGenerating(false)}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyze/v3/route.ts src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx
git commit -m "feat(reports): add SSE endpoint + client generation flow with real-time progress"
```

---

### Task 28: End-to-End Verification

- [ ] **Step 1: Run all tests**

```bash
npx jest src/lib/reports/ --no-cache --verbose
```

Expected: All tests pass.

- [ ] **Step 2: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: No type errors in new files.

- [ ] **Step 3: Manual E2E test**

1. Start dev server: `npm run dev`
2. Navigate to any listing's report page
3. Click "Generate Report"
4. Verify GenerationStepper appears with photo slideshow
5. Verify steps progress in real-time
6. Verify report renders with V3 sections after completion
7. Verify DataTrustBadges appear on each section
8. Verify PDF download includes V3 sections
9. Verify Excel download includes V3 sheets

- [ ] **Step 4: Final commit**

```bash
git add src/lib/reports/ src/components/report/ src/app/api/analyze/ src/lib/listingMode.ts src/lib/exports/
git commit -m "feat(reports): V3 multi-agent pipeline — complete integration"
```

---

## File Map Summary

### New Files (22)
| File | Purpose |
|------|---------|
| `src/lib/reports/types-v3.ts` | All V3 type definitions |
| `src/lib/reports/pipeline.ts` | Pipeline orchestrator with parallelization |
| `src/lib/reports/reportSections.ts` | `report_sections` table CRUD |
| `src/lib/reports/assembleV3Report.ts` | Assemble HausReportV3 from DB rows |
| `src/lib/reports/agents/index.ts` | Agent registry |
| `src/lib/reports/agents/listingScraper.ts` | Step 1: Listing scrape |
| `src/lib/reports/agents/vehicleIdentifier.ts` | Step 2: Vehicle ID |
| `src/lib/reports/agents/marketDataBundle.ts` | Step 3: Market data |
| `src/lib/reports/agents/fairValueEngine.ts` | Step 4: Fair value |
| `src/lib/reports/agents/technicalAnalyst.ts` | Step 5: Technical AI |
| `src/lib/reports/agents/investmentAnalyst.ts` | Step 6: Investment AI |
| `src/lib/reports/agents/dueDiligence.ts` | Step 7: Due diligence AI |
| `src/lib/reports/agents/marketResearcher.ts` | Step 8: Market research AI |
| `src/lib/reports/agents/buyerServices.ts` | Step 9: Buyer services AI |
| `src/lib/reports/agents/finalSynthesis.ts` | Step 10: Synthesis AI |
| `src/lib/reports/agents/prompts/system.ts` | AI system prompts |
| `src/lib/reports/agents/prompts/helpers.ts` | Prompt building utilities |
| `src/components/report/GenerationStepper.tsx` | Loading experience UI |
| `src/components/report/DataTrustBadge.tsx` | Data source badges |
| `src/components/report/v3/*.tsx` | 8 new section components |
| `src/app/api/analyze/v3/route.ts` | SSE endpoint for real-time progress |

### Modified Files (5)
| File | Change |
|------|--------|
| `src/lib/listingMode.ts` | Add `getListingType()` |
| `src/app/api/analyze/route.ts` | Add V3 pipeline branch |
| `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx` | Add V3 sections + generation flow |
| `src/app/[locale]/cars/[make]/[id]/report/page.tsx` | Fetch V3 sections from DB |
| `src/lib/exports/pdf/renderReport.tsx` | Add V3 pages |
| `src/lib/exports/excel/renderReport.ts` | Add V3 sheets |

### Test Files (10)
| File | Tests |
|------|-------|
| `src/lib/reports/__tests__/types-v3.test.ts` | Type compile checks |
| `src/lib/reports/__tests__/reportSections.test.ts` | CRUD integration |
| `src/lib/reports/__tests__/pipeline.test.ts` | Orchestrator + registry |
| `src/lib/reports/__tests__/assembleV3Report.test.ts` | Assembly from DB |
| `src/lib/reports/__tests__/listingType.test.ts` | Listing type detection |
| `src/lib/reports/agents/__tests__/listingScraper.test.ts` | Fallback building |
| `src/lib/reports/agents/__tests__/vehicleIdentifier.test.ts` | Series extraction |
| `src/lib/reports/agents/__tests__/marketDataBundle.test.ts` | Bundle assembly |
| `src/lib/reports/agents/__tests__/fairValueEngine.test.ts` | Module export |
| `src/lib/reports/agents/__tests__/technicalAnalyst.test.ts` | Prompt building |
