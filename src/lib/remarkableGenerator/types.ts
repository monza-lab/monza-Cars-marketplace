import type { DetectedSignal, ReportTier, RemarkableClaim } from "@/lib/fairValue/types"
import type { KBEntry } from "@/lib/variantKB/types"
import type { ReferencePack } from "@/lib/referencePack/types"

export interface RemarkableGeneratorInput {
  tier: ReportTier
  variant_key: string
  signals: DetectedSignal[]
  reference_pack: ReferencePack | null
  kb_entries: KBEntry[]
  specialist_claims: RemarkableClaim[]
}

export interface RemarkableGeneratorOutput {
  claims: RemarkableClaim[]
}
