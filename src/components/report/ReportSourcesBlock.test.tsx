// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ReportSourcesBlock } from "./ReportSourcesBlock"
import type { RemarkableClaim } from "@/lib/fairValue/types"
import type { RegionalMarketStats } from "@/lib/reports/types"

function mkRegion(region: string, source: string, listings: number): RegionalMarketStats {
  return {
    region,
    tier: 1,
    tierLabel: "Verified Sales",
    currency: "USD",
    totalListings: listings,
    medianPrice: 100000,
    avgPrice: 100000,
    p25Price: 90000,
    p75Price: 110000,
    minPrice: 80000,
    maxPrice: 120000,
    medianPriceUsd: 100000,
    trendPercent: 0,
    trendDirection: "stable",
    oldestDate: "2025-10-01",
    newestDate: "2026-04-18",
    sources: [source],
  }
}

function mkClaim(type: RemarkableClaim["source_type"], url: string | null): RemarkableClaim {
  return {
    id: `c-${type}`,
    claim_text: "test",
    source_type: type,
    source_ref: "ref",
    source_url: url,
    capture_date: "2026-04-01",
    confidence: "high",
    tier_required: type === "specialist_agent" ? "tier_3" : "tier_2",
  }
}

describe("ReportSourcesBlock", () => {
  it("renders market data + modifier + reference + KB + agent categories", () => {
    render(
      <ReportSourcesBlock
        regions={[mkRegion("US", "BaT", 14)]}
        remarkableClaims={[
          mkClaim("reference_pack", "https://rennlist.example/a"),
          mkClaim("kb_entry", "https://press.porsche.com/b"),
          mkClaim("specialist_agent", "https://press.porsche.com/c"),
        ]}
        modifierCitationUrls={[{ key: "paint_to_sample", url: "https://hagerty.com/pts" }]}
      />
    )
    expect(screen.getByText("Market data")).toBeInTheDocument()
    expect(screen.getByText("Modifier citations")).toBeInTheDocument()
    expect(screen.getByText("Reference pack")).toBeInTheDocument()
    expect(screen.getByText("Knowledge base")).toBeInTheDocument()
    expect(screen.getByText("Specialist agent")).toBeInTheDocument()
    expect(screen.getByText("BaT")).toBeInTheDocument()
    expect(screen.getByText("hagerty.com")).toBeInTheDocument()
  })

  it("omits a category when it has no rows", () => {
    render(
      <ReportSourcesBlock
        regions={[mkRegion("US", "BaT", 14)]}
        remarkableClaims={[]}
        modifierCitationUrls={[]}
      />
    )
    expect(screen.getByText("Market data")).toBeInTheDocument()
    expect(screen.queryByText("Reference pack")).not.toBeInTheDocument()
    expect(screen.queryByText("Knowledge base")).not.toBeInTheDocument()
  })

  it("returns null when there are no sources at all", () => {
    const { container } = render(<ReportSourcesBlock />)
    expect(container.firstChild).toBeNull()
  })

  it("dedupes identical sources", () => {
    render(
      <ReportSourcesBlock
        regions={[mkRegion("US", "BaT", 14), mkRegion("EU", "BaT", 8)]}
      />
    )
    // Two different regional rows (US/BaT and EU/BaT) should both appear
    expect(screen.getAllByText("BaT")).toHaveLength(2)
  })
})
