import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCreateClient = vi.fn()
const mockFetchLiveListingById = vi.fn()
const mockFetchPricedListingsForModel = vi.fn()
const mockComputeMarketStatsForCar = vi.fn()
const mockGetExchangeRates = vi.fn()
const mockGetReportForListing = vi.fn()
const mockSaveReport = vi.fn()
const mockSaveHausReport = vi.fn()
const mockSaveSignals = vi.fn()
const mockGetOrCreateUser = vi.fn()
const mockHasAlreadyGenerated = vi.fn()
const mockDeductCredit = vi.fn()
const mockCheckAndResetFreeCredits = vi.fn()
const mockSaveReportMetadataV2 = vi.fn()
const mockGetReportMetadataV2 = vi.fn()
const mockHasUnlimitedReportAccess = vi.fn()

vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }))
vi.mock("@/lib/supabaseLiveListings", () => ({
  fetchLiveListingById: mockFetchLiveListingById,
  fetchPricedListingsForModel: mockFetchPricedListingsForModel,
}))
vi.mock("@/lib/marketStats", () => ({ computeMarketStatsForCar: mockComputeMarketStatsForCar }))
vi.mock("@/lib/exchangeRates", () => ({ getExchangeRates: mockGetExchangeRates }))
vi.mock("@/lib/reports/queries", () => ({
  getReportForListing: mockGetReportForListing,
  saveReport: mockSaveReport,
  saveHausReport: mockSaveHausReport,
  saveSignals: mockSaveSignals,
  getOrCreateUser: mockGetOrCreateUser,
  hasAlreadyGenerated: mockHasAlreadyGenerated,
  deductCredit: mockDeductCredit,
  checkAndResetFreeCredits: mockCheckAndResetFreeCredits,
  saveReportMetadataV2: mockSaveReportMetadataV2,
  getReportMetadataV2: mockGetReportMetadataV2,
  hasUnlimitedReportAccess: mockHasUnlimitedReportAccess,
  REPORT_PISTON_COST: 1000,
}))
vi.mock("@/lib/reports/hash", () => ({ computeReportHash: () => "report-hash" }))
vi.mock("@/lib/fairValue/extractors/structured", () => ({ extractStructuredSignals: () => [] }))
vi.mock("@/lib/fairValue/extractors/seller", () => ({ extractSellerSignal: () => null }))
vi.mock("@/lib/fairValue/extractors/text", () => ({ extractTextSignals: vi.fn(async () => ({ ok: true, signals: [] })) }))
vi.mock("@/lib/fairValue/extractors/descriptionCleaner", () => ({ cleanDescription: (value: string) => value }))
vi.mock("@/lib/fairValue/extractors/color", () => ({
  extractColorIntelligence: () => ({
    signals: [],
    exterior: { matchedColor: null, rarity: "common", valuePremiumPercent: 0, isPTS: false },
    combinationNote: null,
  }),
}))
vi.mock("@/lib/fairValue/extractors/vinDeep", () => ({
  extractVinIntelligence: () => ({
    decoded: null,
    plant: null,
    bodyHint: null,
    modelYearFromVin: null,
    yearMatch: null,
    signals: [],
    warnings: [],
  }),
}))
vi.mock("@/lib/fairValue/narrative", () => ({ generateInvestmentNarrative: vi.fn(async () => null) }))
vi.mock("@/lib/brandConfig", () => ({ extractSeries: () => "997" }))
vi.mock("@/lib/fairValue/engine", () => ({
  applyModifiers: () => ({ appliedModifiers: [], totalPercent: 0 }),
  computeSpecificCarFairValue: () => ({ low: 100, mid: 150, high: 200 }),
}))
vi.mock("@/lib/fairValue/modifiers", () => ({ MODIFIER_LIBRARY_VERSION: "v-test" }))
vi.mock("@/lib/landedCost", () => ({
  calculateLandedCost: vi.fn(async () => null),
  localeToDestination: () => null,
  sourceToOriginCountry: () => null,
}))

describe("api/analyze route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "auth-user-id", email: "driver@example.com", user_metadata: { full_name: "Driver" } } },
          error: null,
        })),
      },
    })
    mockGetOrCreateUser.mockResolvedValue({ id: "credits-user-id" })
    mockCheckAndResetFreeCredits.mockResolvedValue({
      id: "credits-user-id",
      credits_balance: 300,
      pack_credits_balance: 0,
      unlimited_reports: false,
      tier: "FREE",
    })
    mockHasAlreadyGenerated.mockResolvedValue(false)
    mockHasUnlimitedReportAccess.mockReturnValue(false)
    mockGetReportForListing.mockResolvedValue(null)
    mockFetchLiveListingById.mockResolvedValue({
      title: "2010 Porsche 911 GT3",
      make: "Porsche",
      model: "911 GT3",
      year: 2010,
      mileage: 25000,
      transmission: "Manual",
      description: "Clean car",
      exteriorColor: "White",
      interiorColor: "Black",
      price: 150000,
      platform: "test",
      sourceUrl: "https://example.test/listing",
      vin: null,
    })
    mockFetchPricedListingsForModel.mockResolvedValue([])
    mockGetExchangeRates.mockResolvedValue({})
    mockComputeMarketStatsForCar.mockReturnValue({
      marketStats: {
        primaryRegion: "US",
        primaryTier: "overall",
        regions: [{ region: "US", tier: "overall", medianPriceUsd: 150000 }],
        scope: "model",
        primaryFairValueLow: 140000,
        primaryFairValueHigh: 170000,
        totalDataPoints: 6,
      },
    })
    mockSaveReport.mockResolvedValue(undefined)
    mockSaveHausReport.mockResolvedValue(undefined)
    mockSaveSignals.mockResolvedValue(undefined)
    mockSaveReportMetadataV2.mockResolvedValue(true)
    mockGetReportMetadataV2.mockResolvedValue({ report_hash: null, tier: null, version: 0 })
  })

  it("fails report generation when the mandatory debit fails after persistence", async () => {
    mockCheckAndResetFreeCredits.mockResolvedValue({
      id: "credits-user-id",
      credits_balance: 1200,
      pack_credits_balance: 0,
      unlimited_reports: false,
      tier: "FREE",
    })
    mockDeductCredit.mockResolvedValue({ success: false, error: "DEBIT_FAILED" })

    const { POST } = await import("./route")
    const res = await POST(new Request("https://example.test/api/analyze", {
      method: "POST",
      body: JSON.stringify({ listingId: "listing-1" }),
    }))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe("DEBIT_FAILED")
  })

  it("blocks report generation when the user has fewer than 1000 Pistons", async () => {
    mockDeductCredit.mockResolvedValue({ success: true, creditUsed: 1000 })

    const { POST } = await import("./route")
    const res = await POST(new Request("https://example.test/api/analyze", {
      method: "POST",
      body: JSON.stringify({ listingId: "listing-1" }),
    }))
    const body = await res.json()

    expect(res.status).toBe(402)
    expect(body.success).toBe(false)
    expect(body.error).toBe("INSUFFICIENT_CREDITS")
    expect(mockFetchLiveListingById).not.toHaveBeenCalled()
    expect(mockDeductCredit).not.toHaveBeenCalled()
  })
})
