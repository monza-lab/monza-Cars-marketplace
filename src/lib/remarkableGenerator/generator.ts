import type { RemarkableClaim, ReportTier } from "@/lib/fairValue/types"
import type {
  RemarkableGeneratorInput,
  RemarkableGeneratorOutput,
} from "./types"

const TIER_CAPS: Record<ReportTier, number> = {
  tier_1: 3,
  tier_2: 5,
  tier_3: 7,
}

export function generateRemarkable(
  input: RemarkableGeneratorInput
): RemarkableGeneratorOutput {
  const claims: RemarkableClaim[] = []

  // Layer 1: signals (available at all tiers)
  for (const signal of input.signals) {
    claims.push({
      id: `sig_${signal.key}`,
      claim_text: composeSignalClaim(signal),
      source_type: "signal",
      source_ref: signal.key,
      source_url: null,
      capture_date: null,
      confidence: signal.evidence.confidence,
      tier_required: "tier_1",
    })
  }

  // Layer 2: reference pack + KB (Tier 2+)
  if (input.tier === "tier_2" || input.tier === "tier_3") {
    if (input.reference_pack) {
      for (const entry of input.reference_pack.entries) {
        claims.push({
          id: `rp_${entry.id}`,
          claim_text: entry.claim_text,
          source_type: "reference_pack",
          source_ref: entry.id,
          source_url: entry.source_url,
          capture_date: entry.source_capture_date,
          confidence: entry.confidence,
          tier_required: "tier_2",
        })
      }
    }
    for (const kb of input.kb_entries) {
      claims.push({
        id: `kb_${kb.id}`,
        claim_text: kb.claim_text,
        source_type: "kb_entry",
        source_ref: kb.id,
        source_url: kb.source_ref.startsWith("http") ? kb.source_ref : null,
        capture_date: kb.source_capture_date,
        confidence: kb.confidence,
        tier_required: "tier_2",
      })
    }
  }

  // Layer 3: specialist agent findings (Tier 3)
  if (input.tier === "tier_3") {
    for (const claim of input.specialist_claims) {
      claims.push(claim)
    }
  }

  // Apply tier cap, keeping highest-confidence first
  const sorted = claims.sort((a, b) => {
    const confRank = { high: 3, medium: 2, low: 1 }
    return confRank[b.confidence] - confRank[a.confidence]
  })
  const capped = sorted.slice(0, TIER_CAPS[input.tier])

  return { claims: capped }
}

function composeSignalClaim(signal: {
  key: string
  value_display: string
  evidence: { raw_excerpt: string | null; source_type: string }
}): string {
  const prettyKey = signal.key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
  return `${prettyKey}: ${signal.value_display}`
}
