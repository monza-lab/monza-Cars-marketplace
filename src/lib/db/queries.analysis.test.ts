import { beforeEach, describe, expect, it, vi } from "vitest"

const dbQueryMock = vi.fn()

vi.mock("./sql", () => ({
  dbQuery: (...args: unknown[]) => dbQueryMock(...args),
}))

import { __resetAnalysisTableAvailabilityForTests, getAnalysisForCar } from "./queries"

describe("getAnalysisForCar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetAnalysisTableAvailabilityForTests()
  })

  it("returns null without querying Analysis when the table is absent", async () => {
    dbQueryMock.mockResolvedValueOnce({
      rows: [{ regclass: null }],
      rowCount: 1,
    })

    const result = await getAnalysisForCar("Porsche", "911", 1995)

    expect(result).toBeNull()
    expect(dbQueryMock).toHaveBeenCalledTimes(1)
    expect(String(dbQueryMock.mock.calls[0]?.[0])).toContain('to_regclass')
  })

  it("queries the analysis row when the table exists", async () => {
    dbQueryMock.mockResolvedValueOnce({
      rows: [{ regclass: '"Analysis"' }],
      rowCount: 1,
    })
    dbQueryMock.mockResolvedValueOnce({
      rows: [
        {
          bidTargetLow: 100000,
          bidTargetHigh: 120000,
          confidence: "HIGH",
          redFlags: [],
          keyStrengths: [],
          criticalQuestions: [],
          yearlyMaintenance: null,
          insuranceEstimate: null,
          majorServiceCost: null,
          investmentGrade: "A",
          appreciationPotential: "STABLE",
          rawAnalysis: null,
        },
      ],
      rowCount: 1,
    })

    const result = await getAnalysisForCar("Porsche", "911", 1995)

    expect(result?.bidTargetLow).toBe(100000)
    expect(dbQueryMock).toHaveBeenCalledTimes(2)
  })
})
