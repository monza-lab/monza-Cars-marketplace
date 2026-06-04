// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ResaleTimelineSection } from "./ResaleTimelineSection"

const projection = {
  estimatedRange: { low: 140000, high: 160000 },
  percentChange: 6,
  confidence: "medium" as const,
  keyFactors: ["Comparable sales trend", "Mileage sensitivity"],
}

describe("ResaleTimelineSection", () => {
  it("exposes the resale timeline methodology through an info button", () => {
    render(
      <ResaleTimelineSection
        data={{
          year1: projection,
          year3: projection,
          year5: projection,
          year10: projection,
        }}
      />,
    )

    expect(screen.getByRole("button", { name: /resale timeline methodology/i })).toBeInTheDocument()
    expect(screen.getByText(/recent comparable sales/i)).toBeInTheDocument()
    expect(screen.getByText(/confidence reflects data depth/i)).toBeInTheDocument()
  })
})
