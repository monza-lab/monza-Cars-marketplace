import { decodePorscheVin, type PorscheVinDecode } from "@/lib/vin/porscheVin"
import type { DetectedSignal } from "../types"

export interface VinDeepInput {
  vin: string | null
  year: number
  model: string
  seriesId: string | null
}

export interface VinIntelligenceResult {
  decoded: boolean
  rawDecode: PorscheVinDecode | null
  plant: string | null
  bodyHint: string | null
  modelYearFromVin: number | null
  yearMatch: boolean
  warnings: string[]
  signals: DetectedSignal[]
}

export function extractVinIntelligence(input: VinDeepInput): VinIntelligenceResult {
  if (!input.vin) {
    return {
      decoded: false,
      rawDecode: null,
      plant: null,
      bodyHint: null,
      modelYearFromVin: null,
      yearMatch: true,
      warnings: [],
      signals: [],
    }
  }

  const decode = decodePorscheVin(input.vin)
  const signals: DetectedSignal[] = []
  const warnings: string[] = []

  if (!decode.valid) {
    return {
      decoded: false,
      rawDecode: decode,
      plant: null,
      bodyHint: null,
      modelYearFromVin: null,
      yearMatch: true,
      warnings: decode.errors,
      signals: [],
    }
  }

  // Year cross-check
  const yearMatch =
    !decode.modelYear ||
    decode.modelYear === input.year ||
    !!(decode.modelYearAmbiguous &&
      decode.modelYearAlternatives?.includes(input.year))

  if (!yearMatch) {
    warnings.push(
      `VIN year mismatch: VIN decodes to ${decode.modelYear}, listing says ${input.year}`,
    )
    signals.push({
      key: "vin_year_mismatch",
      name_i18n_key: "report.signals.vin_year_mismatch",
      value_display: `VIN decodes to ${decode.modelYear}, listing says ${input.year}`,
      evidence: {
        source_type: "structured_field",
        source_ref: "vin_decode",
        raw_excerpt: null,
        confidence: "high",
      },
    })
  }

  // Plant signal
  const plantDesc = decode.plantDescription ?? null

  // VIN verified signal — adds confidence to the report
  signals.push({
    key: "vin_verified",
    name_i18n_key: "report.signals.vin_verified",
    value_display: `VIN ${input.vin} — ${plantDesc ?? "plant unknown"}${decode.bodyHint ? `, ${decode.bodyHint}` : ""}`,
    evidence: {
      source_type: "structured_field",
      source_ref: "vin_decode",
      raw_excerpt: null,
      confidence: "high",
    },
  })

  return {
    decoded: true,
    rawDecode: decode,
    plant: plantDesc,
    bodyHint: decode.bodyHint ?? null,
    modelYearFromVin: decode.modelYear ?? null,
    yearMatch,
    warnings,
    signals,
  }
}
