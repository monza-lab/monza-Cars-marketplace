import type { DetectedSignal } from "../types"

// Accept any listing-shaped object with the fields we use.
// Aligns with the relevant subset of PricedListingRecord plus an optional
// `transmission` column (the DB has it; the type does not yet).
export interface StructuredListingInput {
  year?: number | null
  mileage?: number | null
  transmission?: string | null
}

/**
 * Deterministic extractor that reads structured listing fields (mileage,
 * transmission, year) and emits DetectedSignal objects with
 * source_type: "structured_field".
 *
 * Missing / null fields produce no signal. No parsing of free text here —
 * that belongs to the Gemini text extractor (Task 26).
 */
export function extractStructuredSignals(listing: StructuredListingInput): DetectedSignal[] {
  const signals: DetectedSignal[] = []

  if (listing.mileage != null) {
    signals.push({
      key: "mileage",
      name_i18n_key: "report.signals.mileage",
      value_display: `${listing.mileage.toLocaleString()} mi`,
      evidence: {
        source_type: "structured_field",
        source_ref: "listings.mileage",
        raw_excerpt: null,
        confidence: "high",
      },
    })
  }

  if (listing.transmission) {
    const isManual = /manual|\bm\/?t\b|stick/i.test(listing.transmission)
    signals.push({
      key: "transmission",
      name_i18n_key: isManual ? "report.signals.transmission_manual" : "report.signals.transmission_pdk",
      value_display: listing.transmission,
      evidence: {
        source_type: "structured_field",
        source_ref: "listings.transmission",
        raw_excerpt: null,
        confidence: "high",
      },
    })
  }

  if (listing.year) {
    signals.push({
      key: "year",
      name_i18n_key: "report.signals.year",
      value_display: String(listing.year),
      evidence: {
        source_type: "structured_field",
        source_ref: "listings.year",
        raw_excerpt: null,
        confidence: "high",
      },
    })
  }

  return signals
}
