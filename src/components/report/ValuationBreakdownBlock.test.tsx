// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ValuationBreakdownBlock } from "./ValuationBreakdownBlock"
import type { AppliedModifier } from "@/lib/fairValue/types"

function mkMod(key: string, delta: number, contrib: number, cite: string | null = null): AppliedModifier {
  return {
    key,
    signal_key: key,
    delta_percent: delta,
    baseline_contribution_usd: contrib,
    citation_url: cite,
    version: "v1.0",
  }
}

describe("ValuationBreakdownBlock", () => {
  it("renders headline with fair value and baseline→modifiers→fair chain", () => {
    render(
      <ValuationBreakdownBlock
        baselineMedianUsd={225000}
        aggregateModifierPercent={6.1}
        specificCarFairValueMidUsd={238000}
        modifiers={[mkMod("paint_to_sample", 10, 22500)]}
      />
    )
    expect(screen.getByText(/How we arrived at \$238K/)).toBeInTheDocument()
    expect(screen.getByText("$225K")).toBeInTheDocument()
    expect(screen.getByText("+6.1%")).toBeInTheDocument()
  })

  it("shows only top 3 modifiers by impact and expands on click", () => {
    const mods = [
      mkMod("low_impact_a", 1, 2000),
      mkMod("paint_to_sample", 10, 22500),
      mkMod("low_impact_b", 1, 2500),
      mkMod("manual_transmission", 4, 9000),
      mkMod("single_owner", 3, 6800),
    ]
    render(
      <ValuationBreakdownBlock
        baselineMedianUsd={225000}
        aggregateModifierPercent={6.1}
        specificCarFairValueMidUsd={238000}
        modifiers={mods}
      />
    )
    // Top 3 visible: paint_to_sample, manual_transmission, single_owner
    expect(screen.getByText("Paint To Sample")).toBeInTheDocument()
    expect(screen.getByText("Manual Transmission")).toBeInTheDocument()
    expect(screen.getByText("Single Owner")).toBeInTheDocument()
    // Low-impact ones hidden by default
    expect(screen.queryByText("Low Impact A")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/Show all 5/))
    expect(screen.getByText("Low Impact A")).toBeInTheDocument()
  })

  it("fires onSourceClick with citation url", () => {
    const onSource = vi.fn()
    render(
      <ValuationBreakdownBlock
        baselineMedianUsd={200000}
        aggregateModifierPercent={10}
        specificCarFairValueMidUsd={220000}
        modifiers={[mkMod("paint_to_sample", 10, 20000, "https://hagerty.com/pts")]}
        onSourceClick={onSource}
      />
    )
    fireEvent.click(screen.getByText("Source"))
    expect(onSource).toHaveBeenCalledWith("paint_to_sample", "https://hagerty.com/pts")
  })

  it("omits modifiers section when empty", () => {
    render(
      <ValuationBreakdownBlock
        baselineMedianUsd={200000}
        aggregateModifierPercent={0}
        specificCarFairValueMidUsd={200000}
        modifiers={[]}
      />
    )
    expect(screen.queryByText(/Top modifiers applied/)).not.toBeInTheDocument()
  })
})
