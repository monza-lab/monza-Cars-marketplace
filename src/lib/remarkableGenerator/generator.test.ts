import { describe, it, expect } from "vitest"
import { generateRemarkable } from "./generator"
import type { DetectedSignal } from "@/lib/fairValue/types"

const signalPts: DetectedSignal = {
  key: "paint_to_sample",
  name_i18n_key: "report.signals.paint_to_sample",
  value_display: "Gulf Blue (PTS code Y5C)",
  evidence: {
    source_type: "listing_text",
    source_ref: "description_text:char_244_311",
    raw_excerpt: "Paint-to-Sample Gulf Blue, code Y5C",
    confidence: "high",
  },
}

describe("generateRemarkable — Tier 1", () => {
  it("produces 1 claim per signal, tier_required tier_1", () => {
    const out = generateRemarkable({
      tier: "tier_1",
      variant_key: "992_gt3",
      signals: [signalPts],
      reference_pack: null,
      kb_entries: [],
      specialist_claims: [],
    })
    expect(out.claims).toHaveLength(1)
    expect(out.claims[0].tier_required).toBe("tier_1")
    expect(out.claims[0].source_type).toBe("signal")
    expect(out.claims[0].source_ref).toBe("paint_to_sample")
    expect(out.claims[0].claim_text).toContain("Gulf Blue")
  })

  it("caps at 3 claims for Tier 1", () => {
    const s1 = { ...signalPts, key: "paint_to_sample" }
    const s2 = { ...signalPts, key: "transmission_manual" }
    const s3 = { ...signalPts, key: "service_records" }
    const s4 = { ...signalPts, key: "low_previous_owners" }
    const out = generateRemarkable({
      tier: "tier_1",
      variant_key: "992_gt3",
      signals: [s1, s2, s3, s4],
      reference_pack: null,
      kb_entries: [],
      specialist_claims: [],
    })
    expect(out.claims).toHaveLength(3)
  })
})

describe("generateRemarkable — Tier 2", () => {
  it("includes reference pack entries", () => {
    const out = generateRemarkable({
      tier: "tier_2",
      variant_key: "992_gt3",
      signals: [signalPts],
      reference_pack: {
        variant_key: "992_gt3",
        entries: [
          {
            id: "rp1",
            variant_key: "992_gt3",
            category: "option_rarity",
            claim_text: "PTS Y5C represents ~12% of 992 GT3 order book in 2023",
            source_name: "Rennlist",
            source_url: "https://rennlist.example",
            source_capture_date: "2026-04-01",
            confidence: "medium",
          },
        ],
        last_updated: "2026-04-15",
      },
      kb_entries: [],
      specialist_claims: [],
    })
    expect(out.claims.length).toBeGreaterThanOrEqual(2)
    expect(out.claims.some((c) => c.source_type === "reference_pack")).toBe(true)
    const rpClaim = out.claims.find((c) => c.source_type === "reference_pack")!
    expect(rpClaim.source_url).toBe("https://rennlist.example")
    expect(rpClaim.tier_required).toBe("tier_2")
  })
})

describe("generateRemarkable — Tier 3", () => {
  it("appends specialist agent claims", () => {
    const out = generateRemarkable({
      tier: "tier_3",
      variant_key: "992_gt3",
      signals: [signalPts],
      reference_pack: null,
      kb_entries: [],
      specialist_claims: [
        {
          id: "sa1",
          claim_text: "This VIN is one of 8 PTS Gulf Blue 992 GT3 Touring US-spec Q3 2023",
          source_type: "specialist_agent",
          source_ref: "agent_992_gt3_v1",
          source_url: "https://press.porsche.com/example",
          capture_date: "2026-04-21",
          confidence: "high",
          tier_required: "tier_3",
        },
      ],
    })
    expect(out.claims.some((c) => c.source_type === "specialist_agent")).toBe(true)
  })
})
