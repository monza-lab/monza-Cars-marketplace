import type { DetectedSignal } from "../types"

// Curated whitelist of Porsche specialist dealers. Expandable over time.
const SPECIALIST_DOMAINS = new Set([
  "canepa.com",
  "sloancarsltd.com",
  "dutchmanmotorcars.com",
  "rmsothebys.com",
  "gooding.com",
  "broadarrowauctions.com",
  "specialauto.com",
])

const SPECIALIST_NAMES = new Set([
  "canepa",
  "sloan cars",
  "dutchman motors",
  "rm sotheby's",
  "gooding & company",
])

export interface SellerInput {
  sellerName?: string | null
  sellerDomain?: string | null
}

export function extractSellerSignal(input: SellerInput): DetectedSignal | null {
  const domain = input.sellerDomain?.toLowerCase() ?? ""
  const name = input.sellerName?.toLowerCase() ?? ""

  const matchedDomain = [...SPECIALIST_DOMAINS].find((d) => domain.includes(d))
  const matchedName = [...SPECIALIST_NAMES].find((n) => name.includes(n))

  if (!matchedDomain && !matchedName) return null

  return {
    key: "seller_tier",
    name_i18n_key: "report.signals.seller_tier_specialist",
    value_display: `Porsche specialist (${input.sellerName ?? matchedDomain ?? "curated dealer"})`,
    evidence: {
      source_type: "seller_context",
      source_ref: "seller_whitelist",
      raw_excerpt: null,
      confidence: "high",
    },
  }
}
