// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MarketIntelPanel } from "./MarketIntelPanel"
import type { MarketIntelD1, MarketIntelD4 } from "@/lib/fairValue/types"

const d1: MarketIntelD1 = {
  sold_trajectory: [
    { month: "2026-01", median_usd: 220000, sample: 3 },
    { month: "2026-02", median_usd: 228000, sample: 5 },
    { month: "2026-03", median_usd: 232000, sample: 4 },
  ],
  sold_12m_count: 12,
  sold_6m_count: 8,
  trend_12m_direction: "up",
  trend_12m_percent: 5.5,
}

const d4: MarketIntelD4 = {
  confidence_tier: "high",
  sample_size: 47,
  capture_date_start: "2026-03-15",
  capture_date_end: "2026-04-18",
  outlier_flags: [],
}

describe("MarketIntelPanel", () => {
  it("renders trend, confidence and capture range", () => {
    render(<MarketIntelPanel d1={d1} d4={d4} />)
    expect(screen.getByText(/↑ 5.5%/)).toBeInTheDocument()
    expect(screen.getByText(/high · 47/)).toBeInTheDocument()
    expect(screen.getByText(/Mar 15/)).toBeInTheDocument()
  })

  it("renders 'Stable' label when direction is stable", () => {
    render(
      <MarketIntelPanel
        d1={{ ...d1, trend_12m_direction: "stable", trend_12m_percent: 0.3 }}
        d4={d4}
      />
    )
    expect(screen.getByText("Stable")).toBeInTheDocument()
  })

  it("fires expand callbacks when provided", () => {
    const onD1 = vi.fn()
    const onD4 = vi.fn()
    render(<MarketIntelPanel d1={d1} d4={d4} onExpandD1={onD1} onExpandD4={onD4} />)
    fireEvent.click(screen.getByText(/12m trend/))
    expect(onD1).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText(/Confidence/))
    expect(onD4).toHaveBeenCalledTimes(1)
  })

  it("renders no sparkline when trajectory has < 2 points", () => {
    const { container } = render(
      <MarketIntelPanel
        d1={{ ...d1, sold_trajectory: [{ month: "2026-01", median_usd: 200000, sample: 1 }] }}
        d4={d4}
      />
    )
    expect(container.querySelector("svg")).toBeNull()
  })
})
