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

  const knownIssues = technicalAnalysis?.commonIssues
    ?.map((i) => `- ${i.issue} (${i.severity})`)
    .join("\n") ?? "Not yet analyzed."

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

  return { data: result.data, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
}
