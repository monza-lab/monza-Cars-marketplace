// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { VerdictBlock } from "./VerdictBlock"

describe("VerdictBlock", () => {
  it("renders verdict chip and all three metrics", () => {
    render(
      <VerdictBlock
        verdict="BUY"
        oneLiner="Priced below fair value"
        askingUsd={225000}
        fairValueMidUsd={238000}
        deltaPercent={-5.5}
      />
    )
    expect(screen.getByText("BUY")).toBeInTheDocument()
    expect(screen.getByText(/Priced below fair value/)).toBeInTheDocument()
    expect(screen.getByText("$225K")).toBeInTheDocument()
    expect(screen.getByText("$238K")).toBeInTheDocument()
    expect(screen.getByText("-5.5%")).toBeInTheDocument()
  })

  it('shows "at fair" when delta is within ±0.5%', () => {
    render(
      <VerdictBlock
        verdict="WATCH"
        oneLiner="Priced within fair range"
        askingUsd={238000}
        fairValueMidUsd={238000}
        deltaPercent={0.2}
      />
    )
    expect(screen.getByText(/at fair/)).toBeInTheDocument()
  })

  it("formats positive delta with plus sign", () => {
    render(
      <VerdictBlock
        verdict="WALK"
        oneLiner="Premium pricing"
        askingUsd={280000}
        fairValueMidUsd={240000}
        deltaPercent={16.7}
      />
    )
    expect(screen.getByText("+16.7%")).toBeInTheDocument()
  })

  it("renders millions with M suffix", () => {
    render(
      <VerdictBlock
        verdict="WATCH"
        oneLiner="test"
        askingUsd={1_500_000}
        fairValueMidUsd={1_400_000}
        deltaPercent={7.1}
      />
    )
    expect(screen.getByText("$1.5M")).toBeInTheDocument()
    expect(screen.getByText("$1.4M")).toBeInTheDocument()
  })
})
