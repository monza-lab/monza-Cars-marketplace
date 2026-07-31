// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

import { fireMetaEvent } from "./metaPixel"

describe("fireMetaEvent", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}"))))
    window.fbq = vi.fn()
  })

  it("does not send browser or CAPI events when advertising consent is rejected", async () => {
    fireMetaEvent("InitiateCheckout", {
      consent: "rejected",
      pixelParams: { value: 59, currency: "USD" },
      customData: { value: 59, currency: "USD" },
    })

    await Promise.resolve()

    expect(window.fbq).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("keeps unverified browser events Pixel-only", async () => {
    fireMetaEvent("Purchase", {
      consent: "accepted",
      eventId: "purchase_cs_test_123",
      pixelParams: { value: 59, currency: "USD" },
      customData: { value: 59, currency: "USD" },
    })

    await Promise.resolve()

    expect(window.fbq).toHaveBeenCalledWith(
      "track",
      "Purchase",
      { value: 59, currency: "USD" },
      { eventID: "purchase_cs_test_123" },
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it("sends ReportViewed to CAPI with its report-scoped access token", async () => {
    window.history.replaceState({}, "", "/en/cars/porsche/live-1/report?access=access-token")
    fireMetaEvent("ReportViewed", {
      consent: "accepted",
      eventId: "report-1",
      reportAccessToken: "access-token",
      customData: { listing_id: "live-1" },
    })
    await Promise.resolve()
    expect(fetch).toHaveBeenCalledWith(
      "/api/meta/conversions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-report-access-token": "access-token" }),
        body: expect.stringContaining('"listing_id":"live-1"'),
      }),
    )
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.body).not.toContain("access-token")
  })
})
