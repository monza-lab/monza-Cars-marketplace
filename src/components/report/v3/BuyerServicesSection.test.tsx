// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { BuyerServices } from "@/lib/reports/types-v3"
import { BuyerServicesSection } from "./BuyerServicesSection"

const buyerServices: BuyerServices = {
  partsAvailability: {
    overallRating: "available",
    oemNote: "Most Porsche service parts remain available.",
    aftermarketNote: "Specialist aftermarket support is broad.",
    commonParts: [
      { name: "Front brake discs", availability: "OEM and specialist", priceRange: "$1,200-$1,800" },
    ],
  },
  regionalVariations: {
    strongMarkets: [],
    weakerMarkets: [],
  },
  originalMsrp: {
    basePrice: 110000,
    adjustedForInflation: 165000,
    note: "Estimate based on period MSRP guides.",
  },
}

describe("BuyerServicesSection", () => {
  it("tells buyers to cross-check prices with their regional Porsche dealer and advisor", () => {
    render(<BuyerServicesSection data={buyerServices} />)

    expect(screen.getByText(/cross-check these prices with your Porsche dealer in your region/i)).toBeInTheDocument()
    expect(screen.getByText(/advisor in the chat/i)).toBeInTheDocument()
  })
})
