import { beforeEach, describe, expect, it, vi } from "vitest"

const dbQueryMock = vi.fn()
const createClientMock = vi.fn()

vi.mock("./db/sql", () => ({
  dbQuery: (...args: unknown[]) => dbQueryMock(...args),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}))

vi.mock("./exchangeRates", () => ({
  getExchangeRates: vi.fn().mockResolvedValue({}),
  toUsd: (amount: number) => amount,
}))

describe("fetchStrictLiveReportPeerCandidates", () => {
  beforeEach(() => {
    vi.resetModules()
    dbQueryMock.mockReset()
    createClientMock.mockReset()
    vi.stubEnv("VERCEL", "")
  })

  it("queries active priced listings by exact normalized make/model identity", async () => {
    dbQueryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "peer-1",
          year: 2021,
          make: "Porsche",
          model: "718 Cayman",
          trim: null,
          source: "AutoTrader",
          source_url: "https://example.com/peer-1",
          status: "active",
          sale_date: null,
          country: "UK",
          region: null,
          city: "London",
          hammer_price: null,
          original_currency: "GBP",
          mileage: 10000,
          mileage_unit: "mi",
          vin: null,
          color_exterior: null,
          color_interior: null,
          description_text: null,
          body_style: null,
          title: "Porsche 718 Cayman",
          platform: "AUTO_TRADER",
          current_bid: 56960,
          bid_count: 0,
          rarity_score: 72,
          rarity_tier: "rare",
          rarity_signals_json: ["limited_variant"],
          rarity_scored_at: "2026-06-04T12:00:00Z",
          rarity_score_version: "listing-rarity-v3",
          reserve_status: null,
          seller_notes: null,
          images: [],
          engine: null,
          transmission: null,
          end_time: null,
          start_time: null,
          final_price: null,
          location: "London, UK",
        },
      ],
    })

    const { fetchStrictLiveReportPeerCandidates } = await import("./reportLivePeers")
    const rows = await fetchStrictLiveReportPeerCandidates({
      id: "live-target",
      make: " Porsche ",
      model: "718 Cayman",
      currentBid: 41718,
      price: 41718,
    }, 12)

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe("live-peer-1")
    expect(dbQueryMock).toHaveBeenCalledTimes(1)
    const [sql, values] = dbQueryMock.mock.calls[0]
    expect(String(sql)).toContain("FROM listings")
    expect(String(sql)).toContain("status::text = 'active'")
    expect(String(sql)).toContain('"peerPrice" > 0')
    expect(String(sql)).toContain("rarity_score")
    expect(String(sql)).toContain("regexp_replace")
    expect(String(sql)).toContain("ABS")
    expect(values).toEqual(["porsche", "718 cayman", "target", 41718, 12])
    expect(values).not.toContain("%718 Cayman%")
  })

  it("returns empty when target identity cannot be built", async () => {
    const { fetchStrictLiveReportPeerCandidates } = await import("./reportLivePeers")
    const rows = await fetchStrictLiveReportPeerCandidates({
      id: "live-target",
      make: "Porsche",
      model: "",
      currentBid: 41718,
      price: 41718,
    }, 12)

    expect(rows).toEqual([])
    expect(dbQueryMock).not.toHaveBeenCalled()
  })

  it("uses Supabase HTTP directly on Vercel and keeps exact normalized peers", async () => {
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    const abortSignal = vi.fn().mockResolvedValue({
      data: [
        {
          id: "peer-http",
          year: 2022,
          make: "Porsche",
          model: "718 Cayman",
          trim: null,
          source: "AutoTrader",
          source_url: "https://example.com/peer-http",
          status: "active",
          sale_date: null,
          country: "DE",
          region: null,
          city: null,
          hammer_price: null,
          original_currency: "EUR",
          mileage: 12000,
          mileage_unit: "km",
          vin: null,
          color_exterior: null,
          color_interior: null,
          description_text: null,
          body_style: null,
          title: "Porsche 718 Cayman",
          platform: "AUTO_TRADER",
          current_bid: 58000,
          bid_count: 0,
          rarity_score: null,
          rarity_tier: null,
          rarity_signals_json: null,
          rarity_scored_at: null,
          rarity_score_version: null,
          reserve_status: null,
          seller_notes: null,
          images: [],
          engine: null,
          transmission: null,
          end_time: null,
          start_time: null,
          final_price: null,
          price_usd: null,
          listing_price: null,
          location: "Berlin, DE",
        },
        {
          id: "wrong-model",
          year: 2022,
          make: "Porsche",
          model: "718 Cayman GT4",
          status: "active",
          current_bid: 90000,
        },
      ],
      error: null,
    })
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      ilike: vi.fn(),
      limit: vi.fn(),
      abortSignal,
    }
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    chain.ilike.mockReturnValue(chain)
    chain.limit.mockReturnValue(chain)
    createClientMock.mockReturnValue({ from: vi.fn().mockReturnValue(chain) })

    const { fetchStrictLiveReportPeerCandidates } = await import("./reportLivePeers")
    const rows = await fetchStrictLiveReportPeerCandidates({
      id: "live-target",
      make: "Porsche",
      model: "718 Cayman",
      currentBid: 57000,
      price: 57000,
    }, 12)

    expect(rows.map((row) => row.id)).toEqual(["live-peer-http"])
    expect(dbQueryMock).not.toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith("status", "active")
  })
})
