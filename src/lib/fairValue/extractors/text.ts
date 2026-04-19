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

  return { ok: true, signals, rawPayload: payload }
}
