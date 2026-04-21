// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ArbitrageSignalBlock } from "./ArbitrageSignalBlock"
import type { MarketIntelD2 } from "@/lib/fairValue/types"

const d2: MarketIntelD2 = {
  target_region: "US",
  narrative_insight: "EU-sourced example costs ~$11K less after import. Worth exploring.",
  by_region: [
    {
      region: "US",
      cheapest_comparable_usd: 225000,
      cheapest_comparable_listing_id: "us-1",
      cheapest_comparable_url: "https://bat.example/us-1",
      landed_cost_to_target_usd: 0,
      total_landed_to_target_usd: 225000,
    },
    {
      region: "EU",
      cheapest_comparable_usd: 195000,
      cheapest_comparable_listing_id: "eu-1",
      cheapest_comparable_url: "https://as24.example/eu-1",
      landed_cost_to_target_usd: 19000,
      total_landed_to_target_usd: 214000,
    },
    {
      region: "UK",
      cheapest_comparable_usd: null,
      cheapest_comparable_listing_id: null,
      cheapest_comparable_url: null,
      landed_cost_to_target_usd: null,
      total_landed_to_target_usd: null,
    },
    {
      region: "JP",
      cheapest_comparable_usd: 186000,
      cheapest_comparable_listing_id: "jp-1",
      cheapest_comparable_url: null,
      landed_cost_to_target_usd: 28000,
      total_landed_to_target_usd: 214000,
    },
  ],
}

describe("ArbitrageSignalBlock", () => {
  it("renders 4 regional cards with flags", () => {
    render(<ArbitrageSignalBlock d2={d2} thisListingPriceUsd={225000} />)
    expect(screen.getByText(/🇺🇸 US/)).toBeInTheDocument()
    expect(screen.getByText(/🇪🇺 EU/)).toBeInTheDocument()
    expect(screen.getByText(/🇬🇧 UK/)).toBeInTheDocument()
    expect(screen.getByText(/🇯🇵 JP/)).toBeInTheDocument()
  })

  it("marks the target region with 'this listing' label", () => {
    render(<ArbitrageSignalBlock d2={d2} thisListingPriceUsd={225000} />)
    expect(screen.getByText(/\(this listing\)/)).toBeInTheDocument()
  })

  it("shows landed-cost breakdown for non-target regions", () => {
    render(<ArbitrageSignalBlock d2={d2} thisListingPriceUsd={225000} />)
    expect(screen.getByText(/\+ landed \$19K = \$214K/)).toBeInTheDocument()
  })

  it("shows 'No comparable available' when region has no data", () => {
    render(<ArbitrageSignalBlock d2={d2} thisListingPriceUsd={225000} />)
    expect(screen.getByText(/No comparable available/)).toBeInTheDocument()
  })

  it("renders narrative insight when provided", () => {
    render(<ArbitrageSignalBlock d2={d2} thisListingPriceUsd={225000} />)
    expect(screen.getByText(/EU-sourced example costs ~\$11K less/)).toBeInTheDocument()
  })

  it("omits narrative insight block when null", () => {
    render(
      <ArbitrageSignalBlock
        d2={{ ...d2, narrative_insight: null }}
        thisListingPriceUsd={225000}
      />
    )
    expect(screen.queryByText(/EU-sourced/)).not.toBeInTheDocument()
  })
})
