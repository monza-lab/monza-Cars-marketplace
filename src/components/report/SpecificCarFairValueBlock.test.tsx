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

  it("renders source badge when comparablesSources provided", () => {
    render(
      <SpecificCarFairValueBlock
        fairValueLowUsd={228000}
        fairValueMidUsd={240000}
        fairValueHighUsd={252000}
        askingUsd={225000}
        comparablesCount={14}
        comparableLayer="strict"
        comparablesSources={{
          platforms: ["BaT", "Classic.com", "Elferspot"],
          captureDateRange: { start: "2026-03-15", end: "2026-04-18" },
        }}
      />
    )
    expect(screen.getByText(/BaT · Classic\.com · Elferspot/)).toBeInTheDocument()
    expect(screen.getByText(/captured Mar 15, 2026 – Apr 18, 2026/)).toBeInTheDocument()
  })

  it("does NOT render source badge when comparablesSources is omitted", () => {
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
    expect(screen.queryByText(/captured/i)).not.toBeInTheDocument()
  })

  it("truncates platform list with +N suffix when more than 3", () => {
    render(
      <SpecificCarFairValueBlock
        fairValueLowUsd={228000}
        fairValueMidUsd={240000}
        fairValueHighUsd={252000}
        askingUsd={225000}
        comparablesCount={30}
        comparableLayer="strict"
        comparablesSources={{
          platforms: ["BaT", "Classic.com", "Elferspot", "AutoScout24", "Collecting Cars"],
        }}
      />
    )
    expect(screen.getByText(/\+2$/)).toBeInTheDocument()
  })

  it("source badge fires onSourceClick when provided", () => {
    const onSource = vi.fn()
    render(
      <SpecificCarFairValueBlock
        fairValueLowUsd={228000}
        fairValueMidUsd={240000}
        fairValueHighUsd={252000}
        askingUsd={225000}
        comparablesCount={14}
        comparableLayer="strict"
        comparablesSources={{
          platforms: ["BaT"],
          onSourceClick: onSource,
        }}
      />
    )
    fireEvent.click(screen.getByText(/BaT/))
    expect(onSource).toHaveBeenCalledTimes(1)
  })
})
