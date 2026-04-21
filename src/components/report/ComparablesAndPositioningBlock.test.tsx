// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ComparablesAndPositioningBlock } from "./ComparablesAndPositioningBlock"
import type { MarketIntelD3 } from "@/lib/fairValue/types"
import type { DbComparableRow } from "@/lib/db/queries"

// recharts renders via ResponsiveContainer which needs a size. jsdom doesn't
// provide one, so charts render blank — we assert on the surrounding markup.

const d3: MarketIntelD3 = {
  vin_percentile_within_variant: 62,
  variant_distribution_bins: [
    { price_bucket_usd_low: 180000, price_bucket_usd_high: 200000, count: 3 },
    { price_bucket_usd_low: 200000, price_bucket_usd_high: 220000, count: 5 },
    { price_bucket_usd_low: 220000, price_bucket_usd_high: 240000, count: 4 },
  ],
  adjacent_variants: [],
}

const comparables: DbComparableRow[] = [
  { title: "2023 Porsche 992 GT3", platform: "BaT", soldDate: "2026-03-15", soldPrice: 225000, mileage: 5000, condition: null },
  { title: "2023 Porsche 992 GT3 Touring", platform: "BaT", soldDate: "2026-02-28", soldPrice: 218000, mileage: 3000, condition: null },
  { title: "2022 Porsche 992 GT3", platform: "BaT", soldDate: "2026-02-10", soldPrice: 210000, mileage: 8000, condition: null },
  { title: "2022 Porsche 992 GT3", platform: "BaT", soldDate: "2026-01-28", soldPrice: 205000, mileage: 10000, condition: null },
  { title: "2023 Porsche 992 GT3", platform: "BaT", soldDate: "2026-01-15", soldPrice: 230000, mileage: 4000, condition: null },
  { title: "2022 Porsche 992 GT3", platform: "BaT", soldDate: "2025-12-20", soldPrice: 198000, mileage: 12000, condition: null },
]

describe("ComparablesAndPositioningBlock", () => {
  it("renders percentile narrative by default (distribution tab)", () => {
    render(
      <ComparablesAndPositioningBlock
        d3={d3}
        thisVinPriceUsd={225000}
        comparables={comparables}
      />
    )
    expect(screen.getByText(/62th percentile/)).toBeInTheDocument()
    expect(screen.getByText(/Comparables \(6\)/)).toBeInTheDocument()
  })

  it("switches to table tab and shows first 5 rows", () => {
    render(
      <ComparablesAndPositioningBlock
        d3={d3}
        thisVinPriceUsd={225000}
        comparables={comparables}
      />
    )
    fireEvent.click(screen.getByText(/Comparables \(6\)/))
    expect(screen.getByText(/\$225K/)).toBeInTheDocument()
    expect(screen.getByText(/\$218K/)).toBeInTheDocument()
    // 6th row not yet visible
    expect(screen.queryByText(/\$198K/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/Show all 6/))
    expect(screen.getByText(/\$198K/)).toBeInTheDocument()
  })

  it("shows empty state in table when no comparables", () => {
    render(
      <ComparablesAndPositioningBlock
        d3={d3}
        thisVinPriceUsd={225000}
        comparables={[]}
        initialTab="table"
      />
    )
    expect(screen.getByText(/No comparables available/)).toBeInTheDocument()
  })

  it("shows empty state in distribution when no bins", () => {
    render(
      <ComparablesAndPositioningBlock
        d3={{ ...d3, variant_distribution_bins: [] }}
        thisVinPriceUsd={225000}
        comparables={[]}
      />
    )
    expect(screen.getByText(/Not enough sold comparables/)).toBeInTheDocument()
  })
})
