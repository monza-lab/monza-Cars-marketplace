import { describe, it, expect } from "vitest"
import { computeReportHash } from "./hash"

describe("computeReportHash", () => {
  it("produces deterministic SHA256 for identical input", () => {
    const input = { listing_id: "abc", median_price: 150000, tier: "tier_2" }
    const h1 = computeReportHash(input)
    const h2 = computeReportHash(input)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[a-f0-9]{64}$/)
  })

  it("is stable under key reordering", () => {
    const a = { listing_id: "abc", median_price: 150000, tier: "tier_2" }
    const b = { tier: "tier_2", median_price: 150000, listing_id: "abc" }
    expect(computeReportHash(a)).toBe(computeReportHash(b))
  })

  it("differs when data changes", () => {
    const a = { listing_id: "abc", median_price: 150000 }
    const b = { listing_id: "abc", median_price: 150001 }
    expect(computeReportHash(a)).not.toBe(computeReportHash(b))
  })

  it("ignores specified volatile fields (e.g., generated_at)", () => {
    const a = { listing_id: "abc", median_price: 150000, generated_at: "2026-04-21T10:00:00Z" }
    const b = { listing_id: "abc", median_price: 150000, generated_at: "2026-04-21T11:00:00Z" }
    expect(computeReportHash(a, { ignoreKeys: ["generated_at"] })).toBe(
      computeReportHash(b, { ignoreKeys: ["generated_at"] })
    )
  })
})
