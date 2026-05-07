import {
  resolveColorFamily,
  matchNotableColor,
  type PorscheColor,
  type ColorFamily,
} from "@/lib/knowledge/porscheColors"
import type { DetectedSignal } from "../types"

export interface ColorIntelInput {
  exteriorColor: string | null
  interiorColor: string | null
  seriesId: string | null
  description: string | null
}

export interface ColorMatch {
  inputColor: string | null
  matchedColor: PorscheColor | null
  colorFamily: ColorFamily | null
  rarity: "common" | "uncommon" | "rare" | "very_rare" | "unique" | "unknown"
  valuePremiumPercent: number
  isPTS: boolean
}

export interface ColorIntelligenceResult {
  exterior: ColorMatch
  interior: ColorMatch
  combinationNote: string | null
  signals: DetectedSignal[]
}

function buildColorMatch(
  color: string | null,
  seriesId: string | null,
  description: string | null,
): ColorMatch {
  const family = resolveColorFamily(color)
  const matched = matchNotableColor(color, seriesId)

  // Check for PTS in description
  const descLower = (description ?? "").toLowerCase()
  const isPTSFromDesc =
    /paint[- ]to[- ]sample|pts\b/i.test(descLower) &&
    (family !== null) // only flag PTS if we can at least identify the color family

  const isPTS = matched?.isPTS || isPTSFromDesc

  return {
    inputColor: color,
    matchedColor: matched,
    colorFamily: family,
    rarity: matched?.rarity ?? (isPTS ? "rare" : "unknown"),
    valuePremiumPercent: isPTS && !matched ? 15 : (matched?.valuePremiumPercent ?? 0),
    isPTS,
  }
}

// Classic desirable interior/exterior combos
const CLASSIC_COMBOS: Array<{ ext: ColorFamily; int: string; note: string }> = [
  { ext: "white", int: "red", note: "Classic white-over-red combination — highly sought in air-cooled era" },
  { ext: "blue", int: "brown", note: "Blue over brown/tan — period-correct combination appreciated by collectors" },
  { ext: "silver", int: "brown", note: "Silver over brown — understated combination favored by long-term collectors" },
  { ext: "black", int: "red", note: "Black over red — bold combination with strong collector appeal" },
  { ext: "green", int: "brown", note: "Green over brown — classic British-style combination, increasingly sought" },
]

export function extractColorIntelligence(input: ColorIntelInput): ColorIntelligenceResult {
  const exterior = buildColorMatch(input.exteriorColor, input.seriesId, input.description)
  const interior = buildColorMatch(input.interiorColor, input.seriesId, null)

  // Combination analysis
  let combinationNote: string | null = null
  if (exterior.colorFamily && interior.inputColor) {
    const intLower = interior.inputColor.toLowerCase()
    const intFamily = resolveColorFamily(intLower) ?? intLower
    const combo = CLASSIC_COMBOS.find(
      (c) => c.ext === exterior.colorFamily && (typeof intFamily === "string" && intFamily.includes(c.int)),
    )
    if (combo) combinationNote = combo.note
  }

  // Generate signals
  const signals: DetectedSignal[] = []

  // Color rarity signal — only for uncommon+
  if (exterior.rarity !== "common" && exterior.rarity !== "unknown") {
    const label = exterior.matchedColor?.name ?? exterior.inputColor ?? "Unknown"
    signals.push({
      key: "color_rarity",
      name_i18n_key: "report.signals.color_rarity",
      value_display: `${label} (${exterior.rarity}${exterior.isPTS ? ", PTS" : ""}) — est. +${exterior.valuePremiumPercent}% premium`,
      evidence: {
        source_type: exterior.matchedColor ? "structured_field" : "listing_text",
        source_ref: exterior.matchedColor ? "listings.color_exterior" : "description_text",
        raw_excerpt: null,
        confidence: exterior.matchedColor ? "high" : "medium",
      },
    })
  }

  return { exterior, interior, combinationNote, signals }
}
