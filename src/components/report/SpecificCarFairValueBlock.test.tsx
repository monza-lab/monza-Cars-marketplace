// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SpecificCarFairValueBlock } from "./SpecificCarFairValueBlock"

describe("SpecificCarFairValueBlock", () => {
  it("renders range, mid, layer, and comparables count", () => {
    render(
      <SpecificCarFairValueBlock
        fairValueLowUsd={228000}
        fairValueMidUsd={240000}
        fairValueHighUsd={252000}
        askingUsd={225000}
        comparablesCount={14}
        comparableLayer="strict"
      />
    )
    expect(screen.getByText(/\$228K – \$252K/)).toBeInTheDocument()
    expect(screen.getByText(/Mid \$240K/)).toBeInTheDocument()
    expect(screen.getByText(/Layer: strict/)).toBeInTheDocument()
    expect(screen.getByText(/14 comparables/)).toBeInTheDocument()
  })

  it("clamps marker to 0% when asking is below range", () => {
    const { container } = render(
      <SpecificCarFairValueBlock
        fairValueLowUsd={240000}
        fairValueMidUsd={250000}
        fairValueHighUsd={260000}
        askingUsd={200000}
        comparablesCount={5}
        comparableLayer="series"
      />
    )
    const marker = container.querySelector('[style*="left"]') as HTMLElement
    expect(marker.style.left).toBe("0%")
  })

  it("clamps marker to 100% when asking is above range", () => {
    const { container } = render(
      <SpecificCarFairValueBlock
        fairValueLowUsd={240000}
        fairValueMidUsd={250000}
        fairValueHighUsd={260000}
        askingUsd={300000}
        comparablesCount={5}
        comparableLayer="series"
      />
    )
    const marker = container.querySelector('[style*="left"]') as HTMLElement
    expect(marker.style.left).toBe("100%")
  })

  it("fires explain callback on click", () => {
    const onExplain = vi.fn()
    render(
      <SpecificCarFairValueBlock
        fairValueLowUsd={228000}
        fairValueMidUsd={240000}
        fairValueHighUsd={252000}
        askingUsd={225000}
        comparablesCount={14}
        comparableLayer="strict"
        onExplainClick={onExplain}
      />
    )
    fireEvent.click(screen.getByText(/See how this was computed/))
    expect(onExplain).toHaveBeenCalledTimes(1)
  })
})
