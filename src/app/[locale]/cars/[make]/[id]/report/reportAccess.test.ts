import { describe, expect, it } from "vitest"

import {
  resolveReportAccess,
  resolveVisibleV3Report,
  shouldRequestReportGenerationOnUnlock,
  shouldRefreshProfileAfterGenerationAttempt,
} from "./reportAccess"

describe("resolveReportAccess", () => {
  it("keeps server-confirmed report access when legacy local token state has not recorded the car", () => {
    expect(resolveReportAccess({ serverHasAccess: true, localHasAnalyzed: false })).toBe(true)
  })

  it("allows legacy local access when the server has not confirmed access yet", () => {
    expect(resolveReportAccess({ serverHasAccess: false, localHasAnalyzed: true })).toBe(true)
  })

  it("keeps the report locked when neither access source confirms it", () => {
    expect(resolveReportAccess({ serverHasAccess: false, localHasAnalyzed: false })).toBe(false)
  })
})

describe("resolveVisibleV3Report", () => {
  it("uses the streamed report immediately while waiting for server props to refresh", () => {
    const streamedReport = { listingId: "listing-1" }

    expect(resolveVisibleV3Report({
      serverReport: null,
      streamedReport,
    })).toBe(streamedReport)
  })

  it("prefers the server report after refresh catches up", () => {
    const serverReport = { listingId: "listing-1", source: "server" }
    const streamedReport = { listingId: "listing-1", source: "stream" }

    expect(resolveVisibleV3Report({
      serverReport,
      streamedReport,
    })).toBe(serverReport)
  })
})

describe("shouldRefreshProfileAfterGenerationAttempt", () => {
  it("refreshes the auth profile after a server-side report generation attempt", () => {
    expect(shouldRefreshProfileAfterGenerationAttempt({
      needsPaywall: false,
      userAborted: false,
    })).toBe(true)
  })

  it("does not refresh when generation is blocked by the paywall", () => {
    expect(shouldRefreshProfileAfterGenerationAttempt({
      needsPaywall: true,
      userAborted: false,
    })).toBe(false)
  })

  it("does not refresh when the user aborts before completion", () => {
    expect(shouldRefreshProfileAfterGenerationAttempt({
      needsPaywall: false,
      userAborted: true,
    })).toBe(false)
  })
})

describe("shouldRequestReportGenerationOnUnlock", () => {
  it("requests the server endpoint for authenticated cached reports so the unlock can debit Pistons", () => {
    expect(shouldRequestReportGenerationOnUnlock({
      hasAuthenticatedProfile: true,
      reportAlreadyGenerated: true,
    })).toBe(true)
  })

  it("requests the server endpoint for reports that still need generation", () => {
    expect(shouldRequestReportGenerationOnUnlock({
      hasAuthenticatedProfile: false,
      reportAlreadyGenerated: false,
    })).toBe(true)
  })

  it("keeps legacy anonymous cached unlocks local when the report already exists", () => {
    expect(shouldRequestReportGenerationOnUnlock({
      hasAuthenticatedProfile: false,
      reportAlreadyGenerated: true,
    })).toBe(false)
  })
})
