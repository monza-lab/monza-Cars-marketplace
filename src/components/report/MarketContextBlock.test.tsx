// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MarketContextBlock } from "./MarketContextBlock"
import type { RegionalMarketStats } from "@/lib/reports/types"

function mkRegion(region: string, medianUsd: number, trend: RegionalMarketStats["trendDirection"], listings: number): RegionalMarketStats {
  return {
    region,
    tier: 1,
    tierLabel: "Verified Sales",
    currency: "USD",
    totalListings: listings,
    medianPrice: medianUsd,
    avgPrice: medianUsd,
    p25Price: medianUsd * 0.9,
    p75Price: medianUsd * 1.1,
    minPrice: medianUsd * 0.8,
    maxPrice: medianUsd * 1.2,
    medianPriceUsd: medianUsd,
    trendPercent: 5,
    trendDirection: trend,
    oldestDate: "2025-10-01",
    newestDate: "2026-04-01",
    sources: ["BaT"],
  }
}

describe("MarketContextBlock", () => {
  it("renders 4 regional cards with flags and median prices", () => {
    render(
      <MarketContextBlock
        regions={[
          mkRegion("US", 225000, "up", 12),
          mkRegion("EU", 195000, "down", 8),
          mkRegion("UK", 210000, "stable", 5),
          mkRegion("JP", 186000, "up", 3),
        ]}
      />
    )
    expect(screen.getByText(/🇺🇸 US/)).toBeInTheDocument()
    expect(screen.getByText("$225K")).toBeInTheDocument()
    expect(screen.getByText(/12 sold/)).toBeInTheDocument()
    expect(screen.getAllByLabelText("trend up")).toHaveLength(2)
    expect(screen.getByLabelText("trend down")).toBeInTheDocument()
    expect(screen.getByLabelText("trend stable")).toBeInTheDocument()
  })

  it("returns null when regions empty (no empty-state heading to avoid noise)", () => {
    const { container } = render(<MarketContextBlock regions={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
