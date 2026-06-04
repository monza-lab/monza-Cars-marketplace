// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { DueDiligenceReport } from "@/lib/reports/types-v3"
import { DueDiligenceSection } from "./DueDiligenceSection"

const dueDiligence: DueDiligenceReport = {
  questions: [],
  riskScore: {
    overall: 24,
    breakdown: [
      { category: "Pricing", score: 20, note: "Fair value support is strong." },
      { category: "Condition", score: 35, note: "PPI still required." },
    ],
  },
  ppiChecklist: [],
}

describe("DueDiligenceSection", () => {
  it("explains the risk score methodology in detail", () => {
    render(<DueDiligenceSection data={dueDiligence} />)

    expect(screen.getByRole("button", { name: /risk score methodology/i })).toBeInTheDocument()
    expect(screen.getByText(/0 means lower uncertainty/i)).toBeInTheDocument()
    expect(screen.getByText(/pricing, provenance, condition, and market/i)).toBeInTheDocument()
  })
})
