import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  checkReportAccess: vi.fn(),
  fetchLiveListingById: vi.fn(),
}))

vi.mock("@/lib/reports/access", () => ({
  checkReportAccess: mocks.checkReportAccess,
}))

vi.mock("@/lib/curatedCars", () => ({
  CURATED_CARS: [],
}))

vi.mock("@/lib/supabaseLiveListings", () => ({
  fetchLiveListingById: mocks.fetchLiveListingById,
  fetchPricedListingsForModel: vi.fn(async () => []),
}))

vi.mock("@/lib/reports/queries", () => ({
  getReportForListing: vi.fn(async () => null),
  fetchSignalsForListing: vi.fn(async () => []),
  assembleHausReportFromDB: vi.fn(),
}))

vi.mock("@/lib/db/queries", () => ({
  getStrictComparablesForModel: vi.fn(async () => []),
}))

vi.mock("@/lib/exchangeRates", () => ({
  getExchangeRates: vi.fn(async () => ({})),
}))

vi.mock("@/lib/marketStats", () => ({
  computeMarketStatsForCar: vi.fn(() => ({ marketStats: { regions: [] } })),
}))

vi.mock("@/lib/marketIntel/computeArbitrageForCar", () => ({
  computeArbitrageForCar: vi.fn(),
  inferTargetRegion: vi.fn(() => "US"),
}))

vi.mock("@/lib/fairValue/adaptV1ToV2", () => ({
  adaptV1ReportToV2: vi.fn(() => ({ specific_car_fair_value_mid: null })),
}))

vi.mock("@/lib/reports/hash", () => ({
  computeReportHash: vi.fn(() => "hash-1"),
}))

vi.mock("@/lib/exports/excel/renderReport", () => ({
  renderReportToExcelBuffer: vi.fn(async () => Buffer.from("xlsx")),
}))

vi.mock("@/lib/exports/storage", () => ({
  exportExists: vi.fn(async () => false),
  getSignedExportUrl: vi.fn(async () => null),
  uploadExport: vi.fn(async () => undefined),
}))

import { GET } from "./route"

describe("Excel report export route access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchLiveListingById.mockResolvedValue(null)
  })

  it("returns 401 before export work when the user is unauthenticated", async () => {
    mocks.checkReportAccess.mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
    })

    const response = await GET(new Request("https://test.local/api/reports/live-1/excel"), {
      params: Promise.resolve({ id: "live-1" }),
    })

    await expect(response.json()).resolves.toEqual({ error: "auth_required" })
    expect(response.status).toBe(401)
    expect(mocks.checkReportAccess).toHaveBeenCalledWith("live-1")
    expect(mocks.fetchLiveListingById).not.toHaveBeenCalled()
  })

  it("returns 403 before export work when the user lacks report entitlement", async () => {
    mocks.checkReportAccess.mockResolvedValue({
      ok: false,
      reason: "forbidden",
    })

    const response = await GET(new Request("https://test.local/api/reports/live-1/excel"), {
      params: Promise.resolve({ id: "live-1" }),
    })

    await expect(response.json()).resolves.toEqual({ error: "forbidden" })
    expect(response.status).toBe(403)
    expect(mocks.fetchLiveListingById).not.toHaveBeenCalled()
  })
})
