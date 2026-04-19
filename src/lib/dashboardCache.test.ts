import { beforeEach, describe, expect, it, vi } from "vitest"

const activeCar = {
  id: "active-1",
  title: "2023 Porsche 992 GT3",
  year: 2023,
  make: "Porsche",
  model: "992 GT3",
  trim: null,
  engine: null,
  transmission: null,
  mileage: 1000,
  mileageUnit: "km",
  location: "US",
  platform: "BRING_A_TRAILER",
  status: "ACTIVE",
  price: 300000,
  currentBid: 300000,
  bidCount: 12,
  endTime: new Date("2026-04-18T00:00:00.000Z"),
  images: ["https://example.com/active.jpg"],
  region: "US",
  category: "911",
  originalCurrency: "USD",
  investmentGrade: "AA",
  trend: "Stable",
} as const

const fetchPaginatedListings = vi.fn(() => {
  return Promise.resolve({
    cars: [activeCar],
    hasMore: false,
    nextCursor: null,
  })
})

const fetchValuationCorpusForMake = vi.fn(() =>
  Promise.resolve([
    {
      soldPriceUsd: null,
      askingPriceUsd: 280000,
      basis: "asking" as const,
      canonicalMarket: "EU" as const,
      family: "992",
    },
  ])
)

const fetchLiveListingAggregateCounts = vi.fn(async () => ({
  liveNow: 7,
  regionTotalsByPlatform: { all: 7, US: 3, UK: 1, EU: 2, JP: 1 },
  regionTotalsByLocation: { all: 7, US: 3, UK: 1, EU: 2, JP: 1 },
}))

const fetchSeriesCounts = vi.fn(async () => ({ "992": 1 }))

vi.mock("./supabaseLiveListings", () => ({
  fetchPaginatedListings,
  fetchValuationCorpusForMake,
  fetchLiveListingAggregateCounts,
  fetchSeriesCounts,
}))

vi.mock("./makeProfiles", () => ({
  resolveRequestedMake: vi.fn(() => "Porsche"),
}))

describe("dashboard cache", () => {
  beforeEach(() => {
    fetchPaginatedListings.mockClear()
    fetchValuationCorpusForMake.mockClear()
    fetchLiveListingAggregateCounts.mockClear()
    fetchSeriesCounts.mockClear()
    vi.useRealTimers()
  })

  it("fetches dashboard listings from the direct paginated query path", async () => {
    const { fetchDashboardDataUncached } = await import("./dashboardCache")
    const data = await fetchDashboardDataUncached()

    expect(fetchPaginatedListings).toHaveBeenCalledTimes(1)
    expect(fetchPaginatedListings).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        make: "Porsche",
        pageSize: 200,
        status: "active",
      }),
    )
    expect(fetchValuationCorpusForMake).toHaveBeenCalledWith("Porsche")
    expect(data.auctions).toHaveLength(1)
    expect(data.regionalValByFamily).toBeDefined()
    expect(data.regionalValByFamily["992"]).toBeDefined()
    expect(data.regionalValByFamily["992"].EU).toBeDefined()
    expect(data.liveNow).toBe(7)
    expect(data.seriesCounts).toEqual({ "992": 1 })
  })

  it("keeps listings when ancillary dashboard queries fail", async () => {
    fetchPaginatedListings.mockResolvedValueOnce({
      cars: [activeCar],
      hasMore: false,
      nextCursor: null,
    })
    fetchValuationCorpusForMake.mockRejectedValueOnce(new Error("timeout"))

    const { fetchDashboardDataUncached } = await import("./dashboardCache")
    const data = await fetchDashboardDataUncached()

    expect(data.auctions).toHaveLength(1)
    expect(data.regionalValByFamily).toEqual({})
  })

  it("keeps listings when ancillary dashboard queries hang past the soft timeout", async () => {
    vi.useFakeTimers()
    fetchValuationCorpusForMake.mockImplementationOnce(
      () => new Promise(() => {}),
    )
    fetchLiveListingAggregateCounts.mockImplementationOnce(
      () => new Promise(() => {}),
    )
    fetchSeriesCounts.mockImplementationOnce(
      () => new Promise(() => {}),
    )

    const { fetchDashboardDataUncached } = await import("./dashboardCache")
    const pending = fetchDashboardDataUncached()

    await vi.advanceTimersByTimeAsync(5_000)

    await expect(pending).resolves.toMatchObject({
      auctions: [expect.objectContaining({ id: "active-1" })],
      liveNow: 1,
      seriesCounts: {},
      regionalValByFamily: {},
    })
  })
})
