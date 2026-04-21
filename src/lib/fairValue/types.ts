// Public types for the Haus Report (paid) + Fair Value signal extraction pipeline.
// See docs/superpowers/specs/2026-04-19-fair-value-signal-extraction-design.md §8.1

import type { LandedCostBreakdown } from "@/lib/landedCost"

export type SignalSourceType =
  | "listing_text"      // extracted by Gemini from description_text
  | "structured_field"  // deterministic parse of a listings.* column
  | "seller_context"    // derived from seller whitelist/rating
  | "external"          // cross-listing lookups (e.g., prior BaT sale of same VIN)

export type Confidence = "high" | "medium" | "low"

export interface SignalEvidence {
  source_type: SignalSourceType
  source_ref: string                // e.g., "description_text:char_244-311" or "listings.transmission"
  raw_excerpt: string | null        // exact text excerpt that produced the signal (null for structured_field)
  confidence: Confidence
}

export interface DetectedSignal {
  key: string                       // stable id, e.g., "paint_to_sample"
  name_i18n_key: string             // e.g., "report.signals.paint_to_sample"
  value_display: string             // human-readable, e.g., "Gulf Blue (PTS code Y5C)"
  evidence: SignalEvidence
}

export interface AppliedModifier {
  key: string                       // matches MODIFIER_LIBRARY key
  signal_key: string                // links to DetectedSignal.key
  delta_percent: number             // e.g., +10 or -3
  baseline_contribution_usd: number // absolute USD impact on baseline
  citation_url: string | null
  version: string                   // modifier library version, e.g., "v1.0"
}

export interface MissingSignal {
  key: string
  name_i18n_key: string                  // e.g., "report.signals.service_records"
  question_for_seller_i18n_key: string   // e.g., "report.questions.ask_for_service_records"
}

export type ComparableLayer = "strict" | "series" | "family"

export interface HausReport {
  // Existing market stats fields (from 2026-03-17 spec — unchanged)
  listing_id: string
  fair_value_low: number
  fair_value_high: number
  median_price: number

  // NEW (this spec): specific-car fair value after modifiers
  specific_car_fair_value_low: number
  specific_car_fair_value_mid: number
  specific_car_fair_value_high: number
  comparable_layer_used: ComparableLayer
  comparables_count: number

  // NEW: signal extraction results
  signals_detected: DetectedSignal[]
  signals_missing: MissingSignal[]
  modifiers_applied: AppliedModifier[]
  modifiers_total_percent: number   // sum of all deltas

  // NEW: meta
  signals_extracted_at: string | null  // ISO timestamp; null = signal extraction not yet run
  extraction_version: string           // e.g., "v1.0"

  // Landed cost estimate (destination inferred from locale at generation time).
  // Null when origin is outside the supported matrix, for domestic transactions,
  // or when exchange rates failed at generation time.
  landed_cost: LandedCostBreakdown | null
}
