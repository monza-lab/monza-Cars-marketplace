import { describe, it, expect } from "vitest"
import { adaptV1ReportToV2 } from "./adaptV1ToV2"
import type { HausReport } from "./types"
import type { DbComparableRow } from "@/lib/db/queries"

const v1Report: HausReport = {
  listing_id: "abc",
  fair_value_low: 200000,
  fair_value_high: 240000,
  median_price: 220000,
  specific_car_fair_value_low: 210000,
  specific_car_fair_value_mid: 225000,
  specific_car_fair_value_high: 240000,
  comparable_layer_used: "strict",
  comparables_count: 10,
  signals_detected: [
    {
      key: "paint_to_sample",
      name_i18n_key: "report.signals.paint_to_sample",
      value_display: "Gulf Blue",
      evidence: {
        source_type: "listing_text",
        source_ref: "desc:0-10",
        raw_excerpt: "PTS Gulf Blue",
        confidence: "high",
      },
    },
  ],
  signals_missing: [],
  modifiers_applied: [],
  modifiers_total_percent: 0,
  signals_extracted_at: "2026-04-20T00:00:00Z",
  extraction_version: "v1.0",
  landed_cost: null,
}

const comparables: DbComparableRow[] = [
  { title: "x", platform: "BaT", soldDate: "2026-03-01", soldPrice: 215000, mileage: 5000, condition: null },
  { title: "y", platform: "BaT", soldDate: "2026-02-01", soldPrice: 225000, mileage: 7000, condition: null },
]

describe("adaptV1ReportToV2", () => {
  it("copies v1 fields and fills v2 metadata with defaults", () => {
    const v2 = adaptV1ReportToV2({
      v1Report,
      marketStats: null,
      dbComparables: comparables,
      thisVinPriceUsd: 220000,
    })
    expect(v2.listing_id).toBe("abc")
    expect(v2.median_price).toBe(220000)
    expect(v2.signals_detected).toHaveLength(1)
    expect(v2.tier).toBe("tier_1")
    expect(v2.report_version).toBe(1)
    expect(v2.specialist_coverage_available).toBe(false)
  })

  it("computes D1 trajectory from dbComparables", () => {
    const v2 = adaptV1ReportToV2({
      v1Report,
      marketStats: null,
      dbComparables: comparables,
      thisVinPriceUsd: 220000,
    })
    expect(v2.market_intel.d1.sold_12m_count).toBe(2)
  })

  it("emits D2 stub (empty by_region) until Phase 3 orchestrator lands", () => {
    const v2 = adaptV1ReportToV2({
      v1Report,
      marketStats: null,
      dbComparables: comparables,
      thisVinPriceUsd: 220000,
    })
    expect(v2.market_intel.d2.by_region).toEqual([])
    expect(v2.market_intel.d2.narrative_insight).toBeNull()
  })

  it("generates Tier 1 remarkable claims from signals", () => {
    const v2 = adaptV1ReportToV2({
      v1Report,
      marketStats: null,
      dbComparables: comparables,
      thisVinPriceUsd: 220000,
    })
    expect(v2.remarkable_claims.length).toBeGreaterThan(0)
    expect(v2.remarkable_claims[0].source_type).toBe("signal")
  })

  it("honors tier override", () => {
    const v2 = adaptV1ReportToV2({
      v1Report,
      marketStats: null,
      dbComparables: comparables,
      thisVinPriceUsd: 220000,
      tier: "tier_2",
    })
    expect(v2.tier).toBe("tier_2")
  })

  it("passes through color_intelligence and vin_intelligence", () => {
    const withIntel = {
      ...v1Report,
      color_intelligence: {
        exteriorColorName: "Riviera Blue",
        exteriorColorCode: "1K1K",
        exteriorRarity: "rare" as const,
        exteriorDesirability: 10,
        exteriorValuePremiumPercent: 35,
        interiorColorName: "Black",
        combinationNote: null,
        isPTS: false,
      },
      vin_intelligence: {
        vinDecoded: true,
        plant: "Stuttgart-Zuffenhausen",
        bodyHint: "993",
        modelYearFromVin: 1995,
        yearMatchesListing: true,
        warnings: [],
      },
      investment_narrative: {
        story: "Test narrative",
        generatedBy: "gemini-2.5-flash",
        generatedAt: "2026-05-07T00:00:00Z",
      },
    }
    const v2 = adaptV1ReportToV2({
      v1Report: withIntel,
      marketStats: null,
      dbComparables: comparables,
      thisVinPriceUsd: 220000,
    })
    expect(v2.color_intelligence?.exteriorColorName).toBe("Riviera Blue")
    expect(v2.vin_intelligence?.plant).toBe("Stuttgart-Zuffenhausen")
    expect(v2.investment_narrative?.story).toBe("Test narrative")
  })
})
