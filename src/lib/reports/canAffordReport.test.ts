import { describe, it, expect } from "vitest"
import { canAffordReport } from "./canAffordReport"

describe("canAffordReport", () => {
  it("returns true when balance equals cost", () => {
    expect(canAffordReport(100, 100)).toBe(true)
  })

  it("returns true when balance exceeds cost", () => {
    expect(canAffordReport(287, 100)).toBe(true)
  })

  it("returns false when balance is below cost", () => {
    expect(canAffordReport(99, 100)).toBe(false)
  })

  it("returns false when balance is zero", () => {
    expect(canAffordReport(0, 100)).toBe(false)
  })

  it("returns false for negative balances (defensive)", () => {
    expect(canAffordReport(-5, 100)).toBe(false)
  })

  it("returns true when cost is zero (free reports)", () => {
    expect(canAffordReport(0, 0)).toBe(true)
  })
})
