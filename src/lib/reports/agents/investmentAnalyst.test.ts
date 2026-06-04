import { describe, expect, it } from "vitest"
import { buildInvestmentPrompt } from "./investmentAnalyst"

describe("buildInvestmentPrompt", () => {
  it("does not request insurance estimates in v3 ownership cost projections", () => {
    const prompt = buildInvestmentPrompt("classified", null, null, null, null)

    expect(prompt).not.toMatch(/\binsurance\b/i)
    expect(prompt).toMatch(/ownershipCosts/)
    expect(prompt).toMatch(/maintenance/)
    expect(prompt).toMatch(/majorWork/)
  })
})
