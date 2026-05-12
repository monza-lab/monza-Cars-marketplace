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
