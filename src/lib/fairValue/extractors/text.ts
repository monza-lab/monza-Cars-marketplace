import { generateJson } from "@/lib/ai/gemini"
import { buildSignalExtractionPrompt, SIGNAL_EXTRACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts"
import type { DetectedSignal } from "../types"

interface ExtractedPayload {
  options: {
    sport_chrono: boolean | null
    pccb: boolean | null
    burmester: boolean | null
    lwb_seats: boolean | null
    carbon_roof: boolean | null
    paint_to_sample: { present: boolean; color_name: string | null; pts_code: string | null } | null
    factory_rear_spoiler_delete: boolean | null
    rear_axle_steering: boolean | null
    pdcc: boolean | null
    sport_exhaust: boolean | null
    front_axle_lift: boolean | null
    ventilated_seats: boolean | null
    sunroof_moonroof: boolean | null
    alcantara_interior: boolean | null
    full_leather_interior: boolean | null
    led_matrix_headlights: boolean | null
    adaptive_cruise_control: boolean | null
  }
  service: {
    records_mentioned: boolean
    stamps_count: number | null
    last_major_service_year: number | null
    intervals_respected: boolean | null
    dealer_serviced: boolean | null
  }
  ownership: {
    previous_owners_count: number | null
    one_owner_claim: boolean
    years_current_owner: number | null
    collector_owned_claim: boolean
    garage_kept_claim: boolean
  }
  originality: {
    matching_numbers_claim: boolean
    original_paint_claim: boolean
    repaint_disclosed: { repainted: boolean; panels_mentioned: string[] } | null
    accident_disclosure: "none_mentioned" | "no_accidents_claim" | "prior_accident_disclosed"
    modifications_disclosed: string[]
  }
  documentation: {
    ppi_available: boolean
    carfax_linked: boolean
    window_sticker_shown: boolean
    build_sheet_shown: boolean
  }
  warranty: {
    remaining_factory_warranty: boolean | null
    cpo_status: boolean
  }
  listing_completeness: "high" | "medium" | "low"
  extraction_confidence: "high" | "medium" | "low"
}

export interface TextExtractionInput {
  description: string
  /**
   * Optional cap on Gemini output tokens. Defaults to the generateJson default
   * (2048). Long descriptions with many modifications/panels may need more
   * headroom — validation fixtures (Task 28) pass 4096.
   */
  maxOutputTokens?: number
}

export interface TextExtractionResult {
  ok: boolean
  signals: DetectedSignal[]
  error?: string
  rawPayload?: ExtractedPayload
}

export async function extractTextSignals(input: TextExtractionInput): Promise<TextExtractionResult> {
  const response = await generateJson<ExtractedPayload>({
    systemPrompt: SIGNAL_EXTRACTION_SYSTEM_PROMPT,
    userPrompt: buildSignalExtractionPrompt(input.description),
    temperature: 0,
    maxOutputTokens: input.maxOutputTokens,
  })

  if (!response.ok) {
    return { ok: false, signals: [], error: response.error }
  }

  const payload = response.data
  const signals: DetectedSignal[] = []

  // Paint-to-sample
  if (payload.options.paint_to_sample?.present) {
    const pts = payload.options.paint_to_sample
    const color = pts.color_name ?? "unspecified color"
    const code = pts.pts_code ? ` (PTS code ${pts.pts_code})` : ""
    signals.push({
      key: "paint_to_sample",
      name_i18n_key: "report.signals.paint_to_sample",
      value_display: `${color}${code}`,
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Service records
  if (payload.service.records_mentioned) {
    const stamps = payload.service.stamps_count != null ? `${payload.service.stamps_count} service stamps` : "service records mentioned"
    const year = payload.service.last_major_service_year ? `, last major service ${payload.service.last_major_service_year}` : ""
    signals.push({
      key: "service_records",
      name_i18n_key: "report.signals.service_records",
      value_display: `${stamps}${year}`,
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Previous owners (low = modifier eligible)
  if (payload.ownership.previous_owners_count != null && payload.ownership.previous_owners_count <= 2) {
    signals.push({
      key: "previous_owners",
      name_i18n_key: "report.signals.previous_owners",
      value_display: `${payload.ownership.previous_owners_count} previous owner${payload.ownership.previous_owners_count === 1 ? "" : "s"}`,
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Original paint (claim AND no repaint disclosed)
  if (payload.originality.original_paint_claim && !payload.originality.repaint_disclosed?.repainted) {
    signals.push({
      key: "original_paint",
      name_i18n_key: "report.signals.original_paint",
      value_display: "Original paint, no repaint disclosed",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Accident disclosed (negative)
  if (payload.originality.accident_disclosure === "prior_accident_disclosed") {
    signals.push({
      key: "accident_history",
      name_i18n_key: "report.signals.accident_history",
      value_display: "Prior accident disclosed",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Modifications
  if (payload.originality.modifications_disclosed.length > 0) {
    signals.push({
      key: "modifications",
      name_i18n_key: "report.signals.modifications",
      value_display: `Modifications: ${payload.originality.modifications_disclosed.join(", ")}`,
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Documentation
  const docParts = [
    payload.documentation.ppi_available && "PPI",
    payload.documentation.window_sticker_shown && "window sticker",
    payload.documentation.carfax_linked && "Carfax",
    payload.documentation.build_sheet_shown && "build sheet",
  ].filter(Boolean)
  if (docParts.length > 0) {
    signals.push({
      key: "documentation",
      name_i18n_key: "report.signals.documentation",
      value_display: docParts.join(", ") + " available",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Warranty
  if (payload.warranty.remaining_factory_warranty || payload.warranty.cpo_status) {
    signals.push({
      key: "warranty",
      name_i18n_key: "report.signals.warranty",
      value_display: payload.warranty.cpo_status ? "CPO certified" : "Factory warranty remaining",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Option signals (spec §3.1 — close the signal-mapping gap so What's
  // Remarkable has material to synthesize beyond the 8 originals above).
  if (payload.options.sport_chrono === true) {
    signals.push({
      key: "sport_chrono",
      name_i18n_key: "report.signals.sport_chrono",
      value_display: "Sport Chrono Package",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.pccb === true) {
    signals.push({
      key: "pccb",
      name_i18n_key: "report.signals.pccb",
      value_display: "PCCB ceramic composite brakes",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.burmester === true) {
    signals.push({
      key: "burmester",
      name_i18n_key: "report.signals.burmester",
      value_display: "Burmester audio",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.lwb_seats === true) {
    signals.push({
      key: "lwb_seats",
      name_i18n_key: "report.signals.lwb_seats",
      value_display: "Lightweight bucket seats",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.carbon_roof === true) {
    signals.push({
      key: "carbon_roof",
      name_i18n_key: "report.signals.carbon_roof",
      value_display: "Carbon fiber roof",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.factory_rear_spoiler_delete === true) {
    signals.push({
      key: "factory_rear_spoiler_delete",
      name_i18n_key: "report.signals.factory_rear_spoiler_delete",
      value_display: "Factory rear spoiler delete",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.rear_axle_steering === true) {
    signals.push({
      key: "rear_axle_steering",
      name_i18n_key: "report.signals.rear_axle_steering",
      value_display: "Rear-axle steering",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.pdcc === true) {
    signals.push({
      key: "pdcc",
      name_i18n_key: "report.signals.pdcc",
      value_display: "PDCC active suspension",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.sport_exhaust === true) {
    signals.push({
      key: "sport_exhaust",
      name_i18n_key: "report.signals.sport_exhaust",
      value_display: "Sport exhaust system",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.front_axle_lift === true) {
    signals.push({
      key: "front_axle_lift",
      name_i18n_key: "report.signals.front_axle_lift",
      value_display: "Front axle lift system",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.ventilated_seats === true) {
    signals.push({
      key: "ventilated_seats",
      name_i18n_key: "report.signals.ventilated_seats",
      value_display: "Ventilated seats",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.sunroof_moonroof === true) {
    signals.push({
      key: "sunroof",
      name_i18n_key: "report.signals.sunroof",
      value_display: "Sunroof/moonroof",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.alcantara_interior === true) {
    signals.push({
      key: "alcantara_interior",
      name_i18n_key: "report.signals.alcantara_interior",
      value_display: "Alcantara interior",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.full_leather_interior === true) {
    signals.push({
      key: "full_leather_interior",
      name_i18n_key: "report.signals.full_leather_interior",
      value_display: "Full leather interior",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.led_matrix_headlights === true) {
    signals.push({
      key: "led_matrix_headlights",
      name_i18n_key: "report.signals.led_matrix_headlights",
      value_display: "LED matrix headlights",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.options.adaptive_cruise_control === true) {
    signals.push({
      key: "adaptive_cruise",
      name_i18n_key: "report.signals.adaptive_cruise",
      value_display: "Adaptive cruise control",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Service: dealer-only maintenance — indicator of proper upkeep.
  if (payload.service.dealer_serviced === true) {
    signals.push({
      key: "dealer_serviced",
      name_i18n_key: "report.signals.dealer_serviced",
      value_display: "Dealer-serviced history",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Ownership qualifiers
  if (payload.ownership.one_owner_claim === true) {
    signals.push({
      key: "single_owner",
      name_i18n_key: "report.signals.single_owner",
      value_display: "Single owner",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.ownership.years_current_owner != null && payload.ownership.years_current_owner >= 5) {
    signals.push({
      key: "long_term_ownership",
      name_i18n_key: "report.signals.long_term_ownership",
      value_display: `${payload.ownership.years_current_owner} years with current owner`,
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.ownership.collector_owned_claim === true) {
    signals.push({
      key: "collector_owned",
      name_i18n_key: "report.signals.collector_owned",
      value_display: "Collector-owned",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  if (payload.ownership.garage_kept_claim === true) {
    signals.push({
      key: "garage_kept",
      name_i18n_key: "report.signals.garage_kept",
      value_display: "Garage kept",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  // Originality
  if (payload.originality.matching_numbers_claim === true) {
    signals.push({
      key: "matching_numbers",
      name_i18n_key: "report.signals.matching_numbers",
      value_display: "Matching numbers",
      evidence: { source_type: "listing_text", source_ref: "description_text", raw_excerpt: null, confidence: "high" },
    })
  }

  return { ok: true, signals, rawPayload: payload }
}
