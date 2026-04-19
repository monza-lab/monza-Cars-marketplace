// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MarketDeltaPill } from "./MarketDeltaPill"

describe("MarketDeltaPill", () => {
  it("renders null when median is missing", () => {
    const { container } = render(<MarketDeltaPill priceUsd={100000} medianUsd={null} />)
    expect(container.firstChild).toBeNull()
  })

  it("shows 'at median' when within ±2%", () => {
    render(<MarketDeltaPill priceUsd={101000} medianUsd={100000} />)
    expect(screen.getByText(/at median/i)).toBeInTheDocument()
  })

  it("shows negative percentage when below median", () => {
    render(<MarketDeltaPill priceUsd={92000} medianUsd={100000} />)
    expect(screen.getByText(/-8%/)).toBeInTheDocument()
  })

  it("shows positive percentage when above median", () => {
    render(<MarketDeltaPill priceUsd={110000} medianUsd={100000} />)
    expect(screen.getByText(/\+10%/)).toBeInTheDocument()
  })
})
