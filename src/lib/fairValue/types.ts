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

// ─── v2 additions (2026-04-21 spec) ───────────────────────────────

export type ReportTier = "tier_1" | "tier_2" | "tier_3"

export interface MarketIntelD1 {
  // Trajectory & velocity (12m sold trajectory)
  sold_trajectory: Array<{ month: string; median_usd: number; sample: number }>
  sold_12m_count: number
  sold_6m_count: number
  trend_12m_direction: "up" | "down" | "stable"
  trend_12m_percent: number
}

export interface MarketIntelD2 {
  // Cross-border arbitrage
  by_region: Array<{
    region: "US" | "EU" | "UK" | "JP"
    cheapest_comparable_usd: number | null
    cheapest_comparable_listing_id: string | null
    cheapest_comparable_url: string | null
    landed_cost_to_target_usd: number | null
    total_landed_to_target_usd: number | null
  }>
  target_region: "US" | "EU" | "UK" | "JP"
  narrative_insight: string | null
}

export interface MarketIntelD3 {
  // Peer positioning within variant + adjacent variants
  vin_percentile_within_variant: number
  variant_distribution_bins: Array<{
    price_bucket_usd_low: number
    price_bucket_usd_high: number
    count: number
  }>
  adjacent_variants: Array<{
    variant_key: string
    variant_label: string
    median_usd: number
    sample_size: number
  }>
}

export interface MarketIntelD4 {
  // Freshness & confidence
  confidence_tier: "high" | "medium" | "low" | "insufficient"
  sample_size: number
  capture_date_start: string
  capture_date_end: string
  outlier_flags: Array<{ message: string; severity: "info" | "warning" }>
}

export interface MarketIntel {
  d1: MarketIntelD1
  d2: MarketIntelD2
  d3: MarketIntelD3
  d4: MarketIntelD4
}

export interface RemarkableClaim {
  id: string
  claim_text: string
  source_type: "signal" | "reference_pack" | "kb_entry" | "specialist_agent" | "model_spec"
  source_ref: string
  source_url: string | null
  capture_date: string | null
  confidence: Confidence
  tier_required: ReportTier
}

export interface HausReportV2 extends HausReport {
  report_id: string
  report_hash: string
  report_version: number
  tier: ReportTier

  market_intel: MarketIntel
  remarkable_claims: RemarkableClaim[]

  specialist_coverage_available: boolean
  generated_at: string
}
