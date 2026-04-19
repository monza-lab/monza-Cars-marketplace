import {
  MODIFIER_LIBRARY,
  MODIFIER_LIBRARY_VERSION,
  MODIFIER_AGGREGATE_CAP_PERCENT,
  type ModifierKey,
} from "./modifiers"
import type { AppliedModifier, DetectedSignal } from "./types"

// Map of signal_key → ModifierKey. If a signal's key appears here, the
// corresponding modifier fires with its base_percent.
const SIGNAL_TO_MODIFIER: Record<string, ModifierKey> = {
  mileage: "mileage_delta",
  transmission: "transmission_manual",
  year: "year_within_generation",
  paint_to_sample: "paint_to_sample",
  service_records: "service_records_complete",
  previous_owners: "low_previous_owners",
  original_paint: "original_paint",
  accident_history: "accident_disclosed",
  modifications: "modifications_disclosed",
  documentation: "documentation_provided",
  warranty: "warranty_remaining",
  seller_tier: "seller_tier_specialist",
}

export interface ApplyModifiersInput {
  baselineUsd: number
  signals: DetectedSignal[]
  /** test-only: pretend an extra modifier adds N% so we can exercise the cap */
  _testBoostPercent?: number
}

export interface ApplyModifiersResult {
  appliedModifiers: AppliedModifier[]
  totalPercent: number
  cappedAggregate: boolean
}

export function applyModifiers(input: ApplyModifiersInput): ApplyModifiersResult {
  const { baselineUsd, signals, _testBoostPercent = 0 } = input
  const applied: AppliedModifier[] = []
  let runningPercent = 0

  for (const signal of signals) {
    const modKey = SIGNAL_TO_MODIFIER[signal.key]
    if (!modKey) continue
    const mod = MODIFIER_LIBRARY[modKey]
    const delta = mod.base_percent
    if (delta === 0) continue
    applied.push({
      key: mod.key,
      signal_key: signal.key,
      delta_percent: delta,
      baseline_contribution_usd: Math.round(baselineUsd * (delta / 100)),
      citation_url: mod.citation_url,
      version: MODIFIER_LIBRARY_VERSION,
    })
    runningPercent += delta
  }

  runningPercent += _testBoostPercent

  const cap = MODIFIER_AGGREGATE_CAP_PERCENT
  const capped = Math.abs(runningPercent) > cap
  const totalPercent = capped ? Math.sign(runningPercent) * cap : runningPercent

  return { appliedModifiers: applied, totalPercent, cappedAggregate: capped }
}

export interface SpecificCarFairValue {
  low: number
  mid: number
  high: number
}

export function computeSpecificCarFairValue(input: {
  baselineUsd: number
  totalPercent: number
}): SpecificCarFairValue {
  const mid = Math.round(input.baselineUsd * (1 + input.totalPercent / 100))
  return {
    mid,
    low: Math.round(mid * 0.93),
    high: Math.round(mid * 1.07),
  }
}
