export type ReferencePackEntryCategory =
  | "production_numbers"
  | "option_rarity"
  | "market_position"
  | "variant_notes"
  | "known_issues"

export interface ReferencePackEntry {
  id: string
  variant_key: string
  category: ReferencePackEntryCategory
  claim_text: string
  source_name: string
  source_url: string | null
  source_capture_date: string
  confidence: "high" | "medium" | "low"
}

export interface ReferencePack {
  variant_key: string
  entries: ReferencePackEntry[]
  last_updated: string
}
