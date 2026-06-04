import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCreateClient = vi.fn()
const mockFetchLiveListingById = vi.fn()
const mockRunV3Pipeline = vi.fn()
const mockCreateV3Executors = vi.fn()
const mockSaveReportSection = vi.fn()
const mockHasV3Report = vi.fn()
const mockFetchReportSections = vi.fn()
const mockGetOrCreateUser = vi.fn()
const mockCheckAndResetFreeCredits = vi.fn()
const mockHasAlreadyGenerated = vi.fn()
const mockDeductCredit = vi.fn()
const mockHasUnlimitedReportAccess = vi.fn()
const mockSaveHausReport = vi.fn()
const mockSaveSignals = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}))

vi.mock("@/lib/supabaseLiveListings", () => ({
  fetchLiveListingById: mockFetchLiveListingById,
}))

vi.mock("@/lib/reports/pipeline", () => ({
  runV3Pipeline: mockRunV3Pipeline,
}))

vi.mock("@/lib/reports/agents", () => ({
  createV3Executors: mockCreateV3Executors,
}))

vi.mock("@/lib/reports/reportSections", () => ({
  saveReportSection: mockSaveReportSection,
  hasV3Report: mockHasV3Report,
  fetchReportSections: mockFetchReportSections,
}))

vi.mock("@/lib/reports/queries", () => ({
  getOrCreateUser: mockGetOrCreateUser,
  checkAndResetFreeCredits: mockCheckAndResetFreeCredits,
  hasAlreadyGenerated: mockHasAlreadyGenerated,
  deductCredit: mockDeductCredit,
  REPORT_PISTON_COST: 1000,
  hasUnlimitedReportAccess: mockHasUnlimitedReportAccess,
  saveHausReport: mockSaveHausReport,
  saveSignals: mockSaveSignals,
}))

describe("api/analyze/v3 route", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "auth-user-id",
              email: "driver@example.com",
              user_metadata: { full_name: "Driver" },
            },
          },
        }),
      },
    })
    mockGetOrCreateUser.mockResolvedValue({ id: "credits-user-id" })
    mockCheckAndResetFreeCredits.mockResolvedValue({
      id: "credits-user-id",
      credits_balance: 0,
      pack_credits_balance: 0,
      unlimited_reports: true,
      tier: "PRO",
      email: "driver@example.com",
    })
    mockHasAlreadyGenerated.mockResolvedValue(true)
    mockHasUnlimitedReportAccess.mockReturnValue(true)
    mockHasV3Report.mockResolvedValue(false)
    mockFetchReportSections.mockResolvedValue([])
    mockFetchLiveListingById.mockResolvedValue({ id: "live-5fb98398-2dd1-46e2-84dd-a92c40017ee4" })
    mockCreateV3Executors.mockReturnValue({})
    mockSaveReportSection.mockResolvedValue(undefined)
    mockSaveHausReport.mockResolvedValue(undefined)
    mockSaveSignals.mockResolvedValue(undefined)
    mockDeductCredit.mockResolvedValue({ success: true, creditUsed: 0 })
  })

  it("uses a UUID extraction run id when persisting V2 compatibility signals", async () => {
    mockRunV3Pipeline.mockResolvedValue({
      report: {
        stepsCompleted: 10,
        stepsFailed: 0,
        totalDurationMs: 10,
        finalSynthesis: {
          executiveSummary: {
            headline: "Strong collector car",
            keyMetrics: {
              fairValueRange: "$100-$200",
              signalsCoverage: "high",
              riskScore: 20,
              verdict: "BUY",
              marketPosition: "fair",
            },
            investmentThesis: "Test thesis",
          },
          finalRecommendation: {
            score: 80,
            conditionEstimate: "excellent",
            verdict: "BUY",
          },
        },
      },
      results: [
        {
          sectionKey: "fair_value",
          data: {
            fair_value_low: 100,
            fair_value_high: 200,
            median_price: 150,
            signals_detected: [
              {
                key: "paint_to_sample",
                name_i18n_key: "report.signals.paint_to_sample",
                value_display: "PTS",
                evidence: {
                  source_type: "listing_text",
                  source_ref: "description",
                  raw_excerpt: "Paint to Sample",
                  confidence: "high",
                },
              },
            ],
          },
        },
      ],
    })

    const { POST } = await import("./route")
    const res = await POST(
      new Request("https://example.test/api/analyze/v3", {
        method: "POST",
        body: JSON.stringify({
          listingId: "live-5fb98398-2dd1-46e2-84dd-a92c40017ee4",
          force: true,
        }),
      }) as never,
    )

    await res.text()

    expect(mockSaveSignals).toHaveBeenCalledTimes(1)
    const runId = mockSaveSignals.mock.calls[0][1]
    expect(runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it("emits an error and does not deduct credit when the V3 report is incomplete", async () => {
    mockHasAlreadyGenerated.mockResolvedValue(false)
    mockRunV3Pipeline.mockResolvedValue({
      report: {
        listingId: "live-5fb98398-2dd1-46e2-84dd-a92c40017ee4",
        reportVersion: 3,
        stepsCompleted: 9,
        stepsFailed: 1,
        totalDurationMs: 10,
        finalSynthesis: null,
      },
      results: [],
    })

    const { POST } = await import("./route")
    const res = await POST(
      new Request("https://example.test/api/analyze/v3", {
        method: "POST",
        body: JSON.stringify({
          listingId: "live-5fb98398-2dd1-46e2-84dd-a92c40017ee4",
          force: true,
        }),
      }) as never,
    )

    const body = await res.text()

    expect(body).toContain("event: error")
    expect(body).toContain("V3 report incomplete")
    expect(body).not.toContain("event: complete")
    expect(mockDeductCredit).not.toHaveBeenCalled()
  })
})
