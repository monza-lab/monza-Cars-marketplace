// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  captureAttributionFromLocation,
  readStoredAttribution,
} from "./attribution"

describe("first-party attribution capture", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    vi.setSystemTime(new Date("2026-07-06T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("stores first landing UTMs, fbclid, landing path, referrer, and timestamp", () => {
    captureAttributionFromLocation(
      new URL("https://www.monzahaus.com/en/get-started?utm_source=meta&utm_medium=paid_social&utm_campaign=mh-fase05&utm_content=video-a&fbclid=fb.123"),
      "https://facebook.com/",
    )

    expect(readStoredAttribution()).toEqual({
      utm_source: "meta",
      utm_medium: "paid_social",
      utm_campaign: "mh-fase05",
      utm_term: null,
      utm_content: "video-a",
      fbclid: "fb.123",
      landing_path: "/en/get-started?utm_source=meta&utm_medium=paid_social&utm_campaign=mh-fase05&utm_content=video-a&fbclid=fb.123",
      referrer: "https://facebook.com/",
      first_seen_at: "2026-07-06T12:00:00.000Z",
    })
  })

  it("keeps the original first-touch attribution for 90 days", () => {
    captureAttributionFromLocation(
      new URL("https://www.monzahaus.com/en/get-started?utm_campaign=first&fbclid=fb.first"),
      "https://facebook.com/",
    )
    vi.setSystemTime(new Date("2026-07-20T12:00:00.000Z"))
    captureAttributionFromLocation(
      new URL("https://www.monzahaus.com/en/get-started?utm_campaign=second&fbclid=fb.second"),
      "https://instagram.com/",
    )

    expect(readStoredAttribution()?.utm_campaign).toBe("first")
    expect(readStoredAttribution()?.fbclid).toBe("fb.first")
  })
})
