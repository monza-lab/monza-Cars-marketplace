import { afterEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ resolveReportToken: vi.fn() }))
vi.mock("@/lib/reportAccess/repository", () => ({ resolveReportToken: mocks.resolveReportToken }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function loadPost() {
  vi.stubEnv("META_CAPI_ENABLED", "true")
  vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "pixel")
  vi.stubEnv("META_CAPI_ACCESS_TOKEN", "token")
  return (await import("./route")).POST
}

it("rejects cross-origin conversion relay requests", async () => {
  const POST = await loadPost()
  const response = await POST(new NextRequest("https://monzahaus.com/api/meta/conversions", {
    method: "POST",
    headers: { origin: "https://attacker.example", "content-type": "application/json" },
    body: JSON.stringify({ eventName: "Lead", eventId: "event-1" }),
  }))
  expect(response.status).toBe(403)
})

it("rejects event poisoning before calling Meta", async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  const POST = await loadPost()
  const response = await POST(new NextRequest("https://monzahaus.com/api/meta/conversions", {
    method: "POST",
    headers: { origin: "https://monzahaus.com", "content-type": "application/json" },
    body: JSON.stringify({ eventName: "Purchase", eventId: "event-1", customData: { listing_id: "live-1" } }),
  }))
  expect(response.status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
})

it("rejects ReportViewed without valid report-scoped access", async () => {
  mocks.resolveReportToken.mockResolvedValue(null)
  const fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  const POST = await loadPost()
  const response = await POST(new NextRequest("https://monzahaus.com/api/meta/conversions", {
    method: "POST",
    headers: { origin: "https://monzahaus.com", "content-type": "application/json", "x-report-access-token": "bad" },
    body: JSON.stringify({ eventName: "ReportViewed", eventId: "event-1", customData: { listing_id: "live-1" } }),
  }))
  expect(response.status).toBe(401)
  expect(fetchMock).not.toHaveBeenCalled()
})

it("relays ReportViewed with valid report-scoped access", async () => {
  mocks.resolveReportToken.mockResolvedValue({ id: "access-1", status: "ready" })
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
  vi.stubGlobal("fetch", fetchMock)
  const POST = await loadPost()
  const response = await POST(new NextRequest("https://monzahaus.com/api/meta/conversions", {
    method: "POST",
    headers: {
      origin: "https://monzahaus.com",
      referer: "https://monzahaus.com/en/cars/porsche/live-1/report?access=access-token",
      "content-type": "application/json",
      "x-report-access-token": "access-token",
    },
    body: JSON.stringify({ eventName: "ReportViewed", eventId: "event-1", customData: { listing_id: "live-1" } }),
  }))
  expect(response.status).toBe(200)
  expect(fetchMock).toHaveBeenCalledOnce()
  expect(mocks.resolveReportToken).toHaveBeenCalledWith("access-token", "live-1")
  const outbound = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
  expect(outbound.data[0].event_source_url).toBe("https://monzahaus.com/en/cars/porsche/live-1/report")
  expect(JSON.stringify(outbound)).not.toContain("access-token")
})
