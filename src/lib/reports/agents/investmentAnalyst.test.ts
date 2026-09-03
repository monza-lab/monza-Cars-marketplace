import { describe, expect, it } from "vitest"
import { buildInvestmentPrompt } from "./investmentAnalyst"

describe("buildInvestmentPrompt", () => {
  it("forbids pressure language and unsupported return promises", () => {
    const prompt = buildInvestmentPrompt("classified", null, null, null)
    expect(prompt).toMatch(/Do not use urgency or pressure language/i)
    expect(prompt).toMatch(/do not promise appreciation or returns/i)
    expect(prompt).toMatch(/percentile.*verified distribution/i)
  })
  it("does not request insurance estimates in v3 ownership cost projections", () => {
    const prompt = buildInvestmentPrompt("classified", null, null, null, null)

    expect(prompt).not.toMatch(/\binsurance\b/i)
    expect(prompt).toMatch(/ownershipCosts/)
    expect(prompt).toMatch(/maintenance/)
    expect(prompt).toMatch(/majorWork/)
  })
})
