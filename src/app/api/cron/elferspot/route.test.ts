import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "./route"

vi.mock("@/features/scrapers/elferspot_collector/collector", () => ({
  runElferspotCollector: vi.fn().mockResolvedValue({
    runId: "test-run",
    counts: { discovered: 10, written: 5, enriched: 0, errors: 0 },
    errors: [],
  }),
}))

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/dashboardCache", () => ({
  invalidateDashboardCache: vi.fn(),
}))

import { markScraperRunStarted, recordScraperRun, clearScraperRunActive } from "@/features/scrapers/common/monitoring"

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/elferspot", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe("GET /api/cron/elferspot", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = "test-secret"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key"
  })

  it("returns 401 without valid auth", async () => {
    const response = await GET(makeRequest("wrong"))
    expect(response.status).toBe(401)
  })

  it("returns 200 on success", async () => {
    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.discovered).toBe(10)
  })

  it("calls monitoring lifecycle", async () => {
    await GET(makeRequest())
    expect(markScraperRunStarted).toHaveBeenCalledWith(expect.objectContaining({ scraperName: "elferspot" }))
    expect(recordScraperRun).toHaveBeenCalledWith(expect.objectContaining({ scraper_name: "elferspot", success: true }))
    expect(clearScraperRunActive).toHaveBeenCalledWith("elferspot")
  })
})
