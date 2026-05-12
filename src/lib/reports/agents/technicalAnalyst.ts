import { generateJson } from "@/lib/ai/gemini"
import { TECHNICAL_ANALYST_SYSTEM } from "./prompts/system"
import { buildCarContext, truncateDescription } from "./prompts/helpers"
import type { PipelineContext } from "../pipeline"
import type { TechnicalAnalysis, VehicleIdentity, ScrapedListingFull } from "../types-v3"
import type { HausReport } from "@/lib/fairValue/types"

export function buildTechnicalAnalystPrompt(
  identity: VehicleIdentity,
  scrape: ScrapedListingFull | null,
  fairValue: HausReport | null = null
): string {
  const carContext = buildCarContext(identity, scrape)
  const description = scrape?.descriptionFull
    ? truncateDescription(scrape.descriptionFull)
    : "No description available."

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

  return { data: result.data, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
}
