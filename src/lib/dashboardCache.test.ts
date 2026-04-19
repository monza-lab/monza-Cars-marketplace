import { beforeEach, describe, expect, it, vi } from "vitest"

const unstableCache = vi.fn((fn: () => unknown) => fn)
const revalidateTag = vi.fn()

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

const fetchPaginatedListings = vi.fn(() =>
  Promise.resolve({
    cars: [activeCar],
    hasMore: false,
    nextCursor: null,
    totalCount: 1,
    totalLiveCount: 1,
  })
)

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

vi.mock("next/cache", () => ({
  unstable_cache: unstableCache,
  revalidateTag,
}))

vi.mock("./makeProfiles", () => ({
  resolveRequestedMake: vi.fn(() => "Porsche"),
}))

describe("dashboard cache", () => {
  beforeEach(() => {
    vi.resetModules()
    fetchPaginatedListings.mockClear()
    fetchValuationCorpusForMake.mockClear()
    fetchLiveListingAggregateCounts.mockClear()
    fetchSeriesCounts.mockClear()
    unstableCache.mockClear()
    revalidateTag.mockClear()
    vi.useRealTimers()
  })

  it("fetches dashboard listings from the bounded direct paginated query path", async () => {
    const { fetchDashboardDataUncached } = await import("./dashboardCache")
    const data = await fetchDashboardDataUncached()

    expect(fetchPaginatedListings).toHaveBeenCalledTimes(1)
    expect(fetchPaginatedListings).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        make: "Porsche",
        pageSize: 25,
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

  it("caps dashboard auctions at the dashboard page size even if the loader over-returns", async () => {
    fetchPaginatedListings.mockResolvedValueOnce({
      cars: Array.from({ length: 30 }, (_, index) => ({
        ...activeCar,
        id: `active-${index + 1}`,
        title: `2023 Porsche 992 GT3 #${index + 1}`,
      })),
      hasMore: true,
      nextCursor: { endTime: "2026-04-18T00:00:00.000Z", id: "active-30" },
      totalCount: 30,
      totalLiveCount: 30,
    })

    const { fetchDashboardDataUncached } = await import("./dashboardCache")
    const data = await fetchDashboardDataUncached()

    expect(data.auctions).toHaveLength(24)
    expect(data.auctions[0]?.id).toBe("active-1")
    expect(data.auctions[23]?.id).toBe("active-24")
  })

  it("falls back to source-scoped queries when the primary live query returns no cars", async () => {
    fetchPaginatedListings
      .mockResolvedValueOnce({
        cars: [],
        hasMore: false,
        nextCursor: null,
        totalCount: 0,
        totalLiveCount: 0,
      })
      .mockResolvedValueOnce({
        cars: [{ ...activeCar, id: "collecting-1", platform: "COLLECTING_CARS" }],
        hasMore: false,
        nextCursor: null,
        totalCount: 1,
        totalLiveCount: 1,
      })
      .mockResolvedValueOnce({
        cars: [{ ...activeCar, id: "carsandbids-1", platform: "CARS_AND_BIDS" }],
        hasMore: false,
        nextCursor: null,
        totalCount: 1,
        totalLiveCount: 1,
      })
      .mockResolvedValueOnce({
        cars: [{ ...activeCar, id: "elferspot-1", platform: "ELFERSPOT" }],
        hasMore: false,
        nextCursor: null,
        totalCount: 1,
        totalLiveCount: 1,
      })

    const { fetchDashboardDataUncached } = await import("./dashboardCache")
    const data = await fetchDashboardDataUncached()

    expect(fetchPaginatedListings).toHaveBeenCalledTimes(4)
    expect(fetchPaginatedListings).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        make: "Porsche",
        pageSize: 8,
        platform: "CollectingCars",
        status: "active",
      }),
    )
    expect(fetchPaginatedListings).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        make: "Porsche",
        pageSize: 8,
        platform: "CarsAndBids",
        status: "active",
      }),
    )
    expect(fetchPaginatedListings).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        make: "Porsche",
        pageSize: 8,
        platform: "Elferspot",
        status: "active",
      }),
    )
    expect(data.auctions.map((auction) => auction.id)).toEqual([
      "elferspot-1",
      "collecting-1",
      "carsandbids-1",
    ])
  })

  it("does not fan out into source fallbacks when the primary live query fails transiently", async () => {
    fetchPaginatedListings.mockResolvedValueOnce({
      cars: [],
      hasMore: false,
      nextCursor: null,
      totalCount: null,
      totalLiveCount: null,
      transientError: true,
    })

    const { fetchDashboardDataUncached } = await import("./dashboardCache")

    await expect(fetchDashboardDataUncached()).rejects.toThrow(
      /inconsistent empty live snapshot/,
    )
    expect(fetchPaginatedListings).toHaveBeenCalledTimes(1)
  })

  it("bumps the cached dashboard key after recovery", async () => {
    await import("./dashboardCache")

    expect(unstableCache).toHaveBeenCalledTimes(1)
    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["dashboard-data-v2"],
      expect.objectContaining({
        tags: ["listings"],
      }),
    )
  })

  it("keeps listings when ancillary dashboard queries fail", async () => {
    fetchPaginatedListings.mockResolvedValueOnce({
      cars: [activeCar],
      hasMore: false,
      nextCursor: null,
      totalCount: 1,
      totalLiveCount: 1,
    })
    fetchValuationCorpusForMake.mockRejectedValueOnce(new Error("timeout"))

    const { fetchDashboardDataUncached } = await import("./dashboardCache")
    const data = await fetchDashboardDataUncached()

    expect(data.auctions).toHaveLength(1)
    expect(data.regionalValByFamily).toEqual({})
  })

  it("keeps listings when ancillary dashboard queries hang past the soft timeout", async () => {
    vi.useFakeTimers()
    fetchPaginatedListings.mockResolvedValueOnce({
      cars: [activeCar],
      hasMore: false,
      nextCursor: null,
      totalCount: 1,
      totalLiveCount: 1,
    })
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

  it("reuses the last successful dashboard snapshot when a later live query returns empty with non-zero liveNow", async () => {
    const { fetchDashboardDataUncached } = await import("./dashboardCache")

    await expect(fetchDashboardDataUncached()).resolves.toMatchObject({
      auctions: [expect.objectContaining({ id: "active-1" })],
      liveNow: 7,
    })

    fetchPaginatedListings
      .mockResolvedValueOnce({
        cars: [],
        hasMore: false,
        nextCursor: null,
        totalCount: 0,
        totalLiveCount: 0,
      })
      .mockResolvedValueOnce({
        cars: [],
        hasMore: false,
        nextCursor: null,
        totalCount: 0,
        totalLiveCount: 0,
      })
      .mockResolvedValueOnce({
        cars: [],
        hasMore: false,
        nextCursor: null,
        totalCount: 0,
        totalLiveCount: 0,
      })
      .mockResolvedValueOnce({
        cars: [],
        hasMore: false,
        nextCursor: null,
        totalCount: 0,
        totalLiveCount: 0,
      })

    await expect(fetchDashboardDataUncached()).resolves.toMatchObject({
      auctions: [expect.objectContaining({ id: "active-1" })],
      liveNow: 7,
    })
  })

  it("reuses the last successful dashboard snapshot when later live and aggregate queries both fail empty", async () => {
    const { fetchDashboardDataUncached } = await import("./dashboardCache")

    await expect(fetchDashboardDataUncached()).resolves.toMatchObject({
      auctions: [expect.objectContaining({ id: "active-1" })],
      liveNow: 7,
    })

    fetchPaginatedListings
      .mockResolvedValueOnce({
        cars: [],
        hasMore: false,
        nextCursor: null,
        totalCount: 0,
        totalLiveCount: 0,
      })
      .mockResolvedValueOnce({
        cars: [],
        hasMore: false,
        nextCursor: null,
        totalCount: 0,
        totalLiveCount: 0,
      })
      .mockResolvedValueOnce({
        cars: [],
        hasMore: false,
        nextCursor: null,
        totalCount: 0,
        totalLiveCount: 0,
      })
      .mockResolvedValueOnce({
        cars: [],
        hasMore: false,
        nextCursor: null,
        totalCount: 0,
        totalLiveCount: 0,
      })
    fetchLiveListingAggregateCounts.mockRejectedValueOnce(new Error("timeout"))

    await expect(fetchDashboardDataUncached()).resolves.toMatchObject({
      auctions: [expect.objectContaining({ id: "active-1" })],
      liveNow: 7,
    })
  })
})
