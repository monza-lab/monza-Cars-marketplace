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
    vehicleIdentity, listingScrape, fairValue,
    technicalAnalysis, investmentAnalysis, dueDiligence,
    marketResearch, marketData,
  } = ctx

  const carContext = buildCarContext(vehicleIdentity, listingScrape)
  const pricingContext = buildPricingContext(
    fairValue, listingScrape, vehicleIdentity?.listingType ?? "classified"
  )

  const sections: string[] = []
  if (technicalAnalysis) {
    sections.push(`Technical: Reliability ${technicalAnalysis.reliability?.rating ?? "unknown"}, Rarity ${technicalAnalysis.productionData?.rarityAssessment ?? "unknown"}, Investment Grade ${technicalAnalysis.collectorOutlook?.investmentGrade ?? "unknown"}`)
  }
  if (investmentAnalysis) {
    sections.push(`Investment: ${investmentAnalysis.strategy?.type ?? "unknown"} strategy, Narrative available`)
  }
  if (dueDiligence) {
    sections.push(`Risk Score: ${dueDiligence.riskScore?.overall ?? "N/A"}/100, ${dueDiligence.questions?.length ?? 0} questions generated`)
  }
  if (marketResearch) {
    sections.push(`Market: Heritage analyzed, ${marketResearch.expertConsensus?.compiledAnalysis?.length ?? 0} expert categories`)
  }
  if (marketData) {
    sections.push(`Data: ${marketData.totalDataPoints ?? 0} data points, ${marketData.regionsWithData?.length ?? 0} regions`)
  }

  const signalsCoverage = fairValue
    ? `${fairValue.signals_detected.length}/${fairValue.signals_detected.length + (fairValue.signals_missing?.length ?? 0)}`
    : "0/0"

  const riskScore = dueDiligence?.riskScore?.overall ?? 50

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
- riskScore: ${riskScore}

## Required Output (JSON)
- executiveSummary: { headline: string (one powerful sentence), keyMetrics: { fairValueRange: string, signalsCoverage: "${signalsCoverage} signals verified", riskScore: ${riskScore}, verdict: "BUY"|"WATCH"|"WALK", marketPosition: string (e.g. "12% below fair value") }, investmentThesis: string (100-200 words, substantive) }
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

  return { data: result.data, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
}
