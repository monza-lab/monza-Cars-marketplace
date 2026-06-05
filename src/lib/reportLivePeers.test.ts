import { beforeEach, describe, expect, it, vi } from "vitest"

const dbQueryMock = vi.fn()

vi.mock("./db/sql", () => ({
  dbQuery: (...args: unknown[]) => dbQueryMock(...args),
}))

vi.mock("./exchangeRates", () => ({
  getExchangeRates: vi.fn().mockResolvedValue({}),
  toUsd: (amount: number) => amount,
}))

describe("fetchStrictLiveReportPeerCandidates", () => {
  beforeEach(() => {
    vi.resetModules()
    dbQueryMock.mockReset()
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
})
