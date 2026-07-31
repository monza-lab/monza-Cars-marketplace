import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ requestLeadAccess: vi.fn() }))
vi.mock("@/lib/reportAccess/repository", () => ({ requestLeadAccess: mocks.requestLeadAccess }))

import { POST } from "./route"

function request(body: unknown) {
  return new NextRequest("https://monzahaus.com/api/report-access/request", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/report-access/request", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns a report-scoped token for a first report", async () => {
    mocks.requestLeadAccess.mockResolvedValue({ ok: true, token: "raw-token", leadId: "lead-1" })
    const response = await POST(request({ email: "buyer@example.com", listingId: "live-1", deviceId: "device-1" }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, token: "raw-token", leadId: "lead-1" })
  })

  it.each([
    ["AUTH_REQUIRED", 409],
    ["CLAIM_REQUIRED", 409],
    ["RATE_LIMITED", 429],
    ["DISPOSABLE_EMAIL", 422],
  ])("maps %s to a stable response", async (code, status) => {
    mocks.requestLeadAccess.mockResolvedValue({ ok: false, code })
    const response = await POST(request({ email: "buyer@example.com", listingId: "live-1", deviceId: "device-1" }))
    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual({ ok: false, code })
  })

  it("rejects malformed input before touching storage", async () => {
    const response = await POST(request({ email: "nope", listingId: "" }))
    expect(response.status).toBe(400)
    expect(mocks.requestLeadAccess).not.toHaveBeenCalled()
  })

  it("returns stable JSON when report access storage is unavailable", async () => {
    mocks.requestLeadAccess.mockRejectedValue(new Error("database schema cache failure"))
    const response = await POST(request({ email: "buyer@example.com", listingId: "live-1", deviceId: "device-1" }))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ ok: false, code: "REPORT_ACCESS_UNAVAILABLE" })
  })

  it("stops anonymous report issuance when the funnel kill switch is off", async () => {
    vi.stubEnv("REPORT_LEAD_FUNNEL_ENABLED", "false")
    const response = await POST(request({ email: "buyer@example.com", listingId: "live-1", deviceId: "device-1" }))
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ ok: false, code: "FUNNEL_DISABLED" })
    expect(mocks.requestLeadAccess).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })
})
