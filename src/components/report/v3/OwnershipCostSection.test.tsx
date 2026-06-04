// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { OwnershipCostSection } from "./OwnershipCostSection"

const ownershipCosts = {
  year1: {
    totalCost: 15000,
    breakdown: { valueChange: 5000, insurance: 1234, maintenance: 4000, majorWork: 3000 },
    notes: "Year one includes catch-up maintenance.",
    confidence: "medium",
  },
  year3: {
    totalCost: 24000,
    breakdown: { valueChange: 9000, insurance: 6000, maintenance: 9000, majorWork: null },
    notes: "Three-year costs normalize.",
    confidence: "medium",
  },
  year5: {
    totalCost: 50000,
    breakdown: { valueChange: 20000, insurance: 10000, maintenance: 12000, majorWork: 8000 },
    notes: "Five-year view includes major service risk.",
    confidence: "low",
  },
} as const

describe("OwnershipCostSection", () => {
  it("does not render insurance estimates in v3 ownership costs", () => {
    render(<OwnershipCostSection data={ownershipCosts} />)

    expect(screen.queryByRole("columnheader", { name: "Insurance" })).not.toBeInTheDocument()
    expect(screen.queryByText("$1,234")).not.toBeInTheDocument()
  })
})
