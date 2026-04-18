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

const valuationCar = {
  ...activeCar,
  id: "valuation-1",
  status: "SOLD",
  currentBid: 0,
  price: 280000,
  platform: "AUTO_SCOUT_24",
  region: "EU",
  originalCurrency: "EUR",
} as const

const fetchLiveListingsAsCollectorCars = vi.fn((options?: { status?: string }) => {
  return Promise.resolve([activeCar])
})

const fetchValuationListingsForMake = vi.fn(() => Promise.resolve([valuationCar]))

vi.mock("./supabaseLiveListings", () => ({
  fetchLiveListingsAsCollectorCars,
  fetchValuationListingsForMake,
  fetchLiveListingAggregateCounts: vi.fn(async () => ({
    liveNow: 7,
    regionTotalsByPlatform: { all: 7, US: 3, UK: 1, EU: 2, JP: 1 },
    regionTotalsByLocation: { all: 7, US: 3, UK: 1, EU: 2, JP: 1 },
  })),
  fetchSeriesCounts: vi.fn(async () => ({ "992": 1 })),
}))

vi.mock("./makeProfiles", () => ({
  resolveRequestedMake: vi.fn(() => "Porsche"),
}))

describe("dashboard cache", () => {
  beforeEach(() => {
    fetchLiveListingsAsCollectorCars.mockClear()
    fetchValuationListingsForMake.mockClear()
  })

  it("fetches the dashboard listing universe once", async () => {
    const { fetchDashboardDataUncached } = await import("./dashboardCache")
    const data = await fetchDashboardDataUncached()

    expect(fetchLiveListingsAsCollectorCars).toHaveBeenCalledTimes(1)
    expect(fetchLiveListingsAsCollectorCars).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        make: "Porsche",
        includeAllSources: true,
        includePriceHistory: false,
      })
    )
    expect(fetchValuationListingsForMake).toHaveBeenCalledWith("Porsche")
    expect(data.auctions).toHaveLength(1)
    expect(data.valuationListings).toHaveLength(1)
    expect(data.liveNow).toBe(7)
    expect(data.seriesCounts).toEqual({ "992": 1 })
  })
})
