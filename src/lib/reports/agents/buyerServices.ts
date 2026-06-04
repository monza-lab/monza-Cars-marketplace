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

  const regionalData = marketData?.regions
    ?.map((r) => `${r.region}: median $${r.median.toLocaleString()} (${r.count} listings)`)
    .join("\n") ?? "No regional data."

  const userPrompt = `Provide practical buyer services information for this vehicle.

## Vehicle
${carContext}

## Regional Market Data (REAL — from our database)
${regionalData}

## Required Output (JSON)
- partsAvailability: { overallRating: "readily_available"|"available"|"limited"|"scarce", oemNote: string, aftermarketNote: string, commonParts: array of { name: string, availability: string, priceRange: string } (5-8 items) }
- regionalVariations: { strongMarkets: array of { region: string, premiumPercent: string, reason: string }, weakerMarkets: array of { region: string, discountPercent: string, reason: string } }
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

  return { data: result.data, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
}
