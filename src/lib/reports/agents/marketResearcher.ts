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

  return { data: result.data, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
}
