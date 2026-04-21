export interface KBEntry {
  id: string
  variant_key: string
  claim_text: string
  source_type: "editorial_curation" | "specialist_agent" | "external_verified"
  source_ref: string
  source_capture_date: string
  verified_at: string
  verification_method: string | null
  confidence: "high" | "medium" | "low"
  tags: string[]
  supersedes: string | null
  created_by: string
  created_at: string
}
