import { beforeEach, describe, expect, it, vi } from "vitest"

const dbQueryMock = vi.fn()

vi.mock("./sql", () => ({
  dbQuery: (...args: unknown[]) => dbQueryMock(...args),
}))

describe("strict comparable queries", () => {
  beforeEach(() => {
    vi.resetModules()
    dbQueryMock.mockReset()
  })

  it("queries exact normalized make and model identity without wildcard broadening", async () => {
    dbQueryMock.mockResolvedValueOnce({
      rows: [
        {
          title: "2022 Porsche 911 GT3",
          platform: "BRING_A_TRAILER",
          soldDate: "2026-01-01T00:00:00.000Z",
          soldPrice: 225000,
          mileage: 1200,
          condition: "excellent",
        },
      ],
    })

    const { getStrictComparablesForModel } = await import("./queries")
    const rows = await getStrictComparablesForModel(" Porsche ", "911 GT3", 6)

    expect(rows).toHaveLength(1)
    expect(rows[0].soldDate).toBe("2026-01-01T00:00:00.000Z")
    expect(dbQueryMock).toHaveBeenCalledTimes(1)
    const [sql, values] = dbQueryMock.mock.calls[0]
    expect(String(sql)).toContain("regexp_replace")
    expect(String(sql)).toContain("lower")
    expect(String(sql)).toContain("btrim")
    expect(String(sql)).toContain("\\s+")
    expect(values).toEqual(["porsche", "911 gt3", 6])
    expect(values).not.toContain("%911 GT3%")
  })

  it("returns empty when strict identity cannot be built", async () => {
    const { getStrictComparablesForModel } = await import("./queries")
    const rows = await getStrictComparablesForModel("Porsche", "", 6)

    expect(rows).toEqual([])
    expect(dbQueryMock).not.toHaveBeenCalled()
  })

  it("returns empty on DB failure", async () => {
    dbQueryMock.mockRejectedValueOnce(new Error("db down"))

    const { getStrictComparablesForModel } = await import("./queries")
    const rows = await getStrictComparablesForModel("Porsche", "911 GT3", 6)

    expect(rows).toEqual([])
  })
})
