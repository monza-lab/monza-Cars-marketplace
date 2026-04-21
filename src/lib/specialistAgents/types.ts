import type { DetectedSignal, RemarkableClaim } from "@/lib/fairValue/types"
import type { KBEntry } from "@/lib/variantKB/types"
import type { ReferencePack } from "@/lib/referencePack/types"

export interface SpecialistAgentInput {
  variant_key: string
  listing_id: string
  signals: DetectedSignal[]
  kb_entries: KBEntry[]
  reference_pack: ReferencePack | null
}

export interface SpecialistAgentOutput {
  claims: RemarkableClaim[]
  new_kb_entries: KBEntry[]
}

export interface SpecialistAgent {
  variant_key: string
  version: string
  run(input: SpecialistAgentInput): Promise<SpecialistAgentOutput>
}
