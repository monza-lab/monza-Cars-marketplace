// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ClaimCard } from "./ClaimCard"

describe("ClaimCard", () => {
  it("renders claim text and source type badge when no URL", () => {
    render(
      <ClaimCard
        claim={{
          id: "c1",
          claim_text: "Paint to Sample: Gulf Blue Y5C",
          source_type: "signal",
          source_ref: "paint_to_sample",
          source_url: null,
          capture_date: null,
          confidence: "high",
          tier_required: "tier_1",
        }}
      />
    )
    expect(screen.getByText(/Paint to Sample: Gulf Blue Y5C/)).toBeInTheDocument()
    expect(screen.getByText(/signal/)).toBeInTheDocument()
  })

  it("shows hostname from source_url when provided", () => {
    render(
      <ClaimCard
        claim={{
          id: "c2",
          claim_text: "PTS represents ~12% of 992 GT3 order book",
          source_type: "reference_pack",
          source_ref: "rp1",
          source_url: "https://www.rennlist.com/example",
          capture_date: "2026-04-01",
          confidence: "medium",
          tier_required: "tier_2",
        }}
      />
    )
    expect(screen.getByText(/rennlist.com/)).toBeInTheDocument()
    expect(screen.getByText(/2026-04-01/)).toBeInTheDocument()
  })
})
