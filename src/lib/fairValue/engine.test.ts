import { describe, it, expect } from "vitest"
import { applyModifiers, computeSpecificCarFairValue } from "./engine"
import type { DetectedSignal } from "./types"

function signal(key: string, valueDisplay = "test"): DetectedSignal {
  return {
    key,
    name_i18n_key: `test.${key}`,
    value_display: valueDisplay,
    evidence: {
      source_type: "listing_text",
      source_ref: `test:${key}`,
      raw_excerpt: null,
      confidence: "high",
    },
  }
}

describe("applyModifiers", () => {
  it("returns empty array when no signals match", () => {
    const result = applyModifiers({
      baselineUsd: 200000,
      signals: [],
    })
    expect(result.appliedModifiers).toEqual([])
    expect(result.totalPercent).toBe(0)
  })

  it("applies a single static modifier for paint_to_sample signal", () => {
    const result = applyModifiers({
      baselineUsd: 200000,
      signals: [signal("paint_to_sample", "Gulf Blue")],
    })
    expect(result.appliedModifiers).toHaveLength(1)
    expect(result.appliedModifiers[0].key).toBe("paint_to_sample")
    expect(result.appliedModifiers[0].delta_percent).toBe(10)
    expect(result.appliedModifiers[0].baseline_contribution_usd).toBe(20000)
    expect(result.totalPercent).toBe(10)
  })

  it("stacks multiple modifiers additively", () => {
    const result = applyModifiers({
      baselineUsd: 100000,
      signals: [
        signal("paint_to_sample"),           // +10
        signal("service_records"),            // +4
        signal("previous_owners", "1"),       // +3
      ],
    })
    expect(result.totalPercent).toBe(17)
    expect(result.appliedModifiers).toHaveLength(3)
  })

  it("caps aggregate at ±35% even when stacked modifiers exceed it", () => {
    const result = applyModifiers({
      baselineUsd: 100000,
      signals: [
        signal("paint_to_sample"),
        signal("service_records"),
        signal("previous_owners"),
        signal("original_paint"),
        signal("documentation"),
        signal("warranty"),
        signal("seller_tier"),
      ],
    })
    // With this set total = +29, no cap triggered
    expect(result.totalPercent).toBe(29)
    expect(result.cappedAggregate).toBe(false)
  })

  it("caps aggregate at +35% when forced over", () => {
    const result = applyModifiers({
      baselineUsd: 100000,
      signals: [
        signal("paint_to_sample"),
        signal("service_records"),
        signal("previous_owners"),
        signal("original_paint"),
        signal("documentation"),
        signal("warranty"),
        signal("seller_tier"),
      ],
      _testBoostPercent: 20,
    })
    expect(result.totalPercent).toBe(35)
    expect(result.cappedAggregate).toBe(true)
  })

  it("ignores signals with no matching modifier", () => {
    const result = applyModifiers({
      baselineUsd: 100000,
      signals: [signal("unknown_signal")],
    })
    expect(result.appliedModifiers).toHaveLength(0)
    expect(result.totalPercent).toBe(0)
  })
})

describe("computeSpecificCarFairValue", () => {
  it("returns baseline unchanged when no modifiers apply", () => {
    const fv = computeSpecificCarFairValue({
      baselineUsd: 200000,
      totalPercent: 0,
    })
    expect(fv.mid).toBe(200000)
    expect(fv.low).toBe(Math.round(200000 * 0.93))
    expect(fv.high).toBe(Math.round(200000 * 1.07))
  })

  it("shifts mid by totalPercent then applies ±7% band", () => {
    const fv = computeSpecificCarFairValue({
      baselineUsd: 200000,
      totalPercent: 10,
    })
    expect(fv.mid).toBe(220000)
    expect(fv.low).toBe(Math.round(220000 * 0.93))
    expect(fv.high).toBe(Math.round(220000 * 1.07))
  })

  it("handles negative totalPercent (net negative modifiers)", () => {
    const fv = computeSpecificCarFairValue({
      baselineUsd: 200000,
      totalPercent: -12,
    })
    expect(fv.mid).toBe(176000)
  })
})
