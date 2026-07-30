import { describe, expect, it } from "vitest"

import { resolveReportValuationBaseline } from "./fairValueEngine"

describe("resolveReportValuationBaseline", () => {
  it("prefers a sufficient exact-model comparable set over broad series statistics", () => {
    const baseline = resolveReportValuationBaseline({
      marketStats: {
        primaryFairValueLow: 1_900_000,
        primaryFairValueHigh: 2_100_000,
      },
      dbComparables: [
        { soldPrice: 2_700_000 },
        { soldPrice: 3_000_000 },
        { soldPrice: 3_300_000 },
      ],
    } as never)

    expect(baseline).toBe(3_000_000)
  })

  it("uses broad market statistics when fewer than three exact comparables exist", () => {
    const baseline = resolveReportValuationBaseline({
      marketStats: {
        primaryFairValueLow: 1_900_000,
        primaryFairValueHigh: 2_100_000,
      },
      dbComparables: [
        { soldPrice: 2_700_000 },
        { soldPrice: 3_300_000 },
      ],
    } as never)

    expect(baseline).toBe(2_000_000)
  })

  it("uses the median strict comparable price when live market stats are sparse", () => {
    const baseline = resolveReportValuationBaseline({
      marketStats: {},
      dbComparables: [
        { soldPrice: 1_800_000 },
        { soldPrice: 2_000_000 },
        { soldPrice: 2_200_000 },
        { soldPrice: 4_500_000 },
      ],
    } as never)

    expect(baseline).toBe(2_100_000)
  })

  it("returns zero only when neither evidence source has usable prices", () => {
    expect(resolveReportValuationBaseline(null)).toBe(0)
  })
})
