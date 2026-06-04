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

export function buildInvestmentPrompt(
  listingType: ListingType,
  identity: VehicleIdentity | null,
  scrape: ScrapedListingFull | null,
  fairValue: HausReport | null,
  marketData: MarketDataBundle | null = null
): string {
  const carContext = buildCarContext(identity, scrape)
  const pricingContext = buildPricingContext(fairValue, scrape, listingType)

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
- ownershipCosts: { year1, year3, year5 } each: { totalCost: number, breakdown: { valueChange: number, maintenance: number, majorWork: number|null }, notes: string, confidence: "high"|"medium"|"low" }
- resaleTimeline: { year1, year3, year5, year10 } each: { estimatedRange: { low: number, high: number }, percentChange: number, confidence: "high"|"medium"|"low", keyFactors: string[] (2-3 factors) }
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

  return { data: result.data, durationMs: Date.now() - t0, agentModel: "gemini-2.5-flash" }
}
