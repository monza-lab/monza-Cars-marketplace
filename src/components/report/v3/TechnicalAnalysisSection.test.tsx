// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { TechnicalAnalysis } from "@/lib/reports/types-v3"
import { TechnicalAnalysisSection } from "./TechnicalAnalysisSection"

const technicalAnalysis: TechnicalAnalysis = {
  modelHistory: "The 997 GT3 refined the Mezger-era track formula.",
  whatMakesThisSpecSpecial: "This car combines desirable color, mileage, and documented history.",
  productionData: {
    totalProduction: "2,378",
    thisConfigEstimate: "Low-volume specification",
    rarityAssessment: "rare",
    rarityNote: "Configuration is uncommon in the observed market.",
  },
  keyStrengths: [{ point: "Documented history", detail: "Service records support provenance." }],
  commonIssues: [{
    issue: "Front radiator debris",
    severity: "minor",
    typicalCost: "$500-$1,200",
    appliesTo: "997-generation GT cars",
  }],
  reliability: {
    rating: "above_average",
    maintenanceCostLevel: "high",
    commonProblems: [],
  },
  collectorOutlook: {
    investmentGrade: "high",
    demandLevel: "high",
    futureOutlook: "Demand remains broad among analog GT buyers.",
  },
}

describe("TechnicalAnalysisSection", () => {
  it("uses the Section Three combined strengths and issues title", () => {
    render(<TechnicalAnalysisSection data={technicalAnalysis} />)

    expect(screen.getByText("Key Strengths of This specific car and common issues of this model generation")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Key Strengths" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Common Issues" })).not.toBeInTheDocument()
  })

  it("explains why the reliability rating was assigned", () => {
    render(<TechnicalAnalysisSection data={technicalAnalysis} />)

    expect(screen.getByRole("button", { name: /why this reliability rating/i })).toBeInTheDocument()
    expect(screen.getByText(/rating weighs model-generation reliability/i)).toBeInTheDocument()
    expect(screen.getByText(/common problems listed here/i)).toBeInTheDocument()
  })
})
