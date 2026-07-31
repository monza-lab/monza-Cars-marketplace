import { describe, expect, it } from "vitest"
import {
  evaluateLeadRequest,
  isDisposableEmail,
  isReportFresh,
  normalizeEmail,
  preserveFirstTouchAttribution,
} from "./policy"

describe("report lead policy", () => {
  it("normalizes emails and blocks disposable domains", () => {
    expect(normalizeEmail(" Cami@Example.COM ")).toBe("cami@example.com")
    expect(isDisposableEmail("lead@mailinator.com")).toBe(true)
    expect(isDisposableEmail("lead@monzahaus.com")).toBe(false)
  })

  it("allows only the first anonymous report and requires account ownership afterward", () => {
    expect(evaluateLeadRequest({ claimedUserExists: false, completedReports: 0, attemptsInLastHour: 0 })).toEqual({ ok: true })
    expect(evaluateLeadRequest({ claimedUserExists: false, completedReports: 1, attemptsInLastHour: 0 })).toEqual({ ok: false, code: "CLAIM_REQUIRED" })
    expect(evaluateLeadRequest({ claimedUserExists: true, completedReports: 0, attemptsInLastHour: 0 })).toEqual({ ok: false, code: "AUTH_REQUIRED" })
    expect(evaluateLeadRequest({ claimedUserExists: false, completedReports: 0, attemptsInLastHour: 3 })).toEqual({ ok: false, code: "RATE_LIMITED" })
  })

  it("reuses reports for seven days only when listing inputs match", () => {
    const now = new Date("2026-07-16T00:00:00Z")
    expect(isReportFresh({ updatedAt: "2026-07-10T00:00:00Z", storedFingerprint: "a", currentFingerprint: "a", now })).toBe(true)
    expect(isReportFresh({ updatedAt: "2026-07-08T23:59:59Z", storedFingerprint: "a", currentFingerprint: "a", now })).toBe(false)
    expect(isReportFresh({ updatedAt: "2026-07-15T00:00:00Z", storedFingerprint: "a", currentFingerprint: "b", now })).toBe(false)
  })

  it("never replaces the attribution captured on the lead's first touch", () => {
    expect(preserveFirstTouchAttribution(
      { utm_source: "instagram", gclid: null, first_seen_at: "2026-07-01T00:00:00.000Z" },
      { utm_source: "google", gclid: "later-click", first_seen_at: "2026-07-20T00:00:00.000Z" },
    )).toEqual({
      utm_source: "instagram",
      gclid: null,
      first_seen_at: "2026-07-01T00:00:00.000Z",
    })
  })
})
