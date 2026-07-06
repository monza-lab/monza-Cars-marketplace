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

  it("uses a caller-provided event ID for browser/server deduplication", async () => {
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
    expect(fetch).toHaveBeenCalledWith(
      "/api/meta/conversions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"eventId":"purchase_cs_test_123"'),
      }),
    )
  })
})
