import { generateText } from "@/lib/ai/gemini"
import {
  NARRATIVE_SYSTEM_PROMPT,
  buildNarrativePrompt,
} from "@/lib/ai/prompts"
import type { InvestmentNarrative } from "./types"

export interface NarrativeInput {
  title: string
  year: number
  make: string
  model: string
  seriesId: string | null
  mileage: number | null
  transmission: string | null
  exteriorColor: string | null
  interiorColor: string | null
  price: number
  fairValueMid: number
  signals: string[]
  redFlags: string[]
  colorRarity: string | null
  colorPremium: number
}

export async function generateInvestmentNarrative(
  input: NarrativeInput,
): Promise<InvestmentNarrative | null> {
  try {
    const prompt = buildNarrativePrompt(input)
    const result = await generateText({
      systemPrompt: NARRATIVE_SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature: 0.3,
      maxOutputTokens: 8192,
    })

    if (!result.ok || !result.text) return null

    return {
      story: result.text.trim(),
      generatedBy: "gemini-2.5-flash",
      generatedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error("[narrative] generation failed:", err)
    return null
  }
}
