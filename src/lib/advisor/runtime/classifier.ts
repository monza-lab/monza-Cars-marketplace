import { generateJson } from "@/lib/ai/gemini"

export type Tier = "instant" | "marketplace" | "deep_research"

export interface ClassifyInput {
  userText: string
  hasCarContext: boolean
  userTier: "FREE" | "PRO"
}

export interface ClassifyResult {
  tier: Tier
  estimatedPistons: number
  reason: string
  downgradedFromDeepResearch: boolean
}

const PISTONS_BY_TIER: Record<Tier, number> = {
  instant: 1,
  marketplace: 5,
  deep_research: 25,
}

const CLASSIFIER_SYSTEM = `You classify a user message to a MonzaHaus collector-car advisor into one of three tiers. Return the highest tier that matches — when in doubt between two tiers, pick the higher one.

TIER DEFINITIONS

- instant: pure knowledge lookup / definition / concept question with NO reference to prices, listings, comps, values, or specific cars on sale. Answer is the same regardless of today's market.
- marketplace: anything involving ONE car's price, valuation, listing, comps, spec-versus-value check, or a single-model search. The answer requires live inventory or valuation data.
- deep_research: multi-car synthesis, shortlist/ranking, side-by-side comparison of 2+ listings, or any request needing 3+ distinct tool calls.

ROUTING RULES

1. Words/phrases that REQUIRE marketplace (not instant): "price", "fair value", "fairly priced", "worth", "cost", "comps", "listings", "for sale", "on the market", "available", "find me", "show me", specific dollar/euro amounts, "at $X", "under $X", "below market", "percentile".
2. Words/phrases that REQUIRE deep_research: "shortlist", "rank", "compare X and Y", "top N", "best value across", "which of these", "side by side", "vs", explicit multi-car lists.
3. "How rare is X" / "what was produced" / "option code M471" → instant (knowledge, not market data).
4. If the message says the user is viewing a specific car AND asks anything evaluative ("good buy?", "is this deal right?", "should I buy this?") → marketplace.

EXAMPLES

- "What is an IMS bearing?" → instant
- "Explain the difference between 997.1 and 997.2 GT3" → instant
- "How many 993 Turbo S were made?" → instant
- "Is this 996 GT3 fairly priced at $95k?" → marketplace
- "Show me 996 GT3 listings under $100,000" → marketplace
- "Find comps for a 997.2 GT3 RS" → marketplace
- "What's the fair value of a 2011 GT3 with 25k miles?" → marketplace
- "Build me a shortlist of clean 997.2 GT3s in Europe under 180k" → deep_research
- "Compare this 996 GT3 to the top 3 comparable sales" → deep_research
- "Rank the best 992 variants by market depth" → deep_research

Return JSON: { "tier": "instant" | "marketplace" | "deep_research", "reason": "<one short sentence>" }. No other text.`

export async function classifyRequest(input: ClassifyInput): Promise<ClassifyResult> {
  const ctx = input.hasCarContext ? "(user is viewing a specific car)" : "(no car context)"
  const res = await generateJson<{ tier: Tier; reason: string }>({
    systemPrompt: CLASSIFIER_SYSTEM,
    userPrompt: `User message: """${input.userText}"""\n${ctx}`,
    temperature: 0,
    maxOutputTokens: 100,
  })

  let tier: Tier = "marketplace"
  let reason = "fallback: classifier unavailable — defaulting to marketplace"
  if (res.ok && (res.data.tier === "instant" || res.data.tier === "marketplace" || res.data.tier === "deep_research")) {
    tier = res.data.tier
    reason = res.data.reason
  } else {
    console.warn(JSON.stringify({ advisor: { kind: "classifier_fallback", ts: new Date().toISOString() } }))
  }

  let downgradedFromDeepResearch = false
  if (tier === "deep_research" && input.userTier === "FREE") {
    tier = "marketplace"
    downgradedFromDeepResearch = true
  }

  return {
    tier,
    estimatedPistons: PISTONS_BY_TIER[tier],
    reason,
    downgradedFromDeepResearch,
  }
}
