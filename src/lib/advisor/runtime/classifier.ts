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

const CLASSIFIER_SYSTEM = `You classify a user message to a MonzaHaus collector-car advisor into one of three tiers:

- instant: pure knowledge lookup, definition, general question. No live data needed. (e.g., "what is an IMS bearing")
- marketplace: needs 1-2 tool calls against live inventory / valuations / comps for one car or family. (e.g., "is this fairly priced", "show comps for a 997.2 GT3")
- deep_research: multi-car synthesis, shortlist building, cross-comparison, or anything needing 3+ tool calls. (e.g., "build me a shortlist of 996 GT3s under 150k in the EU")

Return JSON: { "tier": "instant" | "marketplace" | "deep_research", "reason": "<one short sentence>" }. No other text.`

export async function classifyRequest(input: ClassifyInput): Promise<ClassifyResult> {
  const ctx = input.hasCarContext ? "(user is viewing a specific car)" : "(no car context)"
  const res = await generateJson<{ tier: Tier; reason: string }>({
    systemPrompt: CLASSIFIER_SYSTEM,
    userPrompt: `User message: """${input.userText}"""\n${ctx}`,
    temperature: 0,
    maxOutputTokens: 100,
  })

  let tier: Tier = "instant"
  let reason = "fallback: classifier error"
  if (res.ok && (res.data.tier === "instant" || res.data.tier === "marketplace" || res.data.tier === "deep_research")) {
    tier = res.data.tier
    reason = res.data.reason
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
