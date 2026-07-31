import { beforeEach, describe, expect, it, vi } from "vitest"

const dbQueryMock = vi.fn()
const createClientMock = vi.fn()

vi.mock("./sql", () => ({
  dbQuery: (...args: unknown[]) => dbQueryMock(...args),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}))

describe("strict comparable queries", () => {
  beforeEach(() => {
    vi.resetModules()
    dbQueryMock.mockReset()
    createClientMock.mockReset()
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
  })

  it("queries old priced listings as exact normalized historical comparables without wildcard broadening", async () => {
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
        {
          title: "Wrong Porsche 911 GT3 RS",
          platform: "ELFERSPOT",
          soldDate: "2026-01-02T00:00:00.000Z",
          soldPrice: 175000,
          mileage: 500,
          condition: "excellent",
        },
        {
          title: "Wrong Porsche GT3 TYPE 996",
          platform: "ELFERSPOT",
          soldDate: "2026-01-03T00:00:00.000Z",
          soldPrice: 75_000,
          mileage: 500,
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
    expect(String(sql)).toContain("FROM listings")
    expect(String(sql)).toContain("interval '30 days'")
    expect(String(sql)).toContain("> 0")
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

  it("falls back to Supabase HTTP strict comparables when direct Postgres is unavailable", async () => {
    dbQueryMock.mockRejectedValueOnce(new Error("db down"))
    const abortSignal = vi.fn().mockResolvedValue({
      data: [
        {
          title: "2005 Porsche Carrera GT",
          platform: "BRING_A_TRAILER",
          source: "BaT",
          make: "Porsche",
          model: "Carrera GT",
          sale_date: "2026-01-01",
          end_time: null,
          updated_at: "2026-01-02T00:00:00Z",
          scrape_timestamp: null,
          created_at: "2026-01-01T00:00:00Z",
          listing_price: 1_500_000,
          mileage: 1200,
          condition_description: "excellent",
          status: "sold",
        },
        {
          title: "Wrong model",
          platform: "ELFERSPOT",
          source: "Elferspot",
          make: "Porsche",
          model: "911 Carrera GTS",
          sale_date: "2026-01-01",
          end_time: null,
          updated_at: "2026-01-02T00:00:00Z",
          scrape_timestamp: null,
          created_at: "2026-01-01T00:00:00Z",
          listing_price: 180_000,
          mileage: 500,
          condition_description: null,
          status: "sold",
        },
      ],
      error: null,
    })
    const chain = {
      select: vi.fn(),
      ilike: vi.fn(),
      gt: vi.fn(),
      limit: vi.fn(),
      abortSignal,
    }
    chain.select.mockReturnValue(chain)
    chain.ilike.mockReturnValue(chain)
    chain.gt.mockReturnValue(chain)
    chain.limit.mockReturnValue(chain)
    createClientMock.mockReturnValue({ from: vi.fn().mockReturnValue(chain) })

    const { getStrictComparablesForModel } = await import("./queries")
    const rows = await getStrictComparablesForModel("Porsche", "Carrera GT", 6)

    expect(rows).toEqual([
      expect.objectContaining({
        title: "2005 Porsche Carrera GT",
        soldPrice: 1_500_000,
        soldDate: "2026-01-01T00:00:00.000Z",
      }),
    ])
    expect(dbQueryMock).toHaveBeenCalledTimes(1)

    vi.resetModules()
    vi.stubEnv("VERCEL", "1")
    dbQueryMock.mockReset()
    const vercelQueries = await import("./queries")
    const vercelRows = await vercelQueries.getStrictComparablesForModel("Porsche", "Carrera GT", 6)

    expect(vercelRows).toEqual([
      expect.objectContaining({ title: "2005 Porsche Carrera GT", soldPrice: 1_500_000 }),
    ])
    expect(dbQueryMock).not.toHaveBeenCalled()
  })
})
