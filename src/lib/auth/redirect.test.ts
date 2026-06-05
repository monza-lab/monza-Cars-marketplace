import { describe, expect, it } from "vitest"

import { buildAuthRedirectUrl } from "./redirect"

describe("buildAuthRedirectUrl", () => {
  it("preserves the current report URL as the post-login destination", () => {
    expect(buildAuthRedirectUrl({
      origin: "https://monza.test",
      callbackPath: "/auth/callback",
      returnPath: "/en/cars/porsche/live-123/report",
    })).toBe("https://monza.test/auth/callback?next=%2Fen%2Fcars%2Fporsche%2Flive-123%2Freport")
  })

  it("keeps query strings when preserving the return path", () => {
    expect(buildAuthRedirectUrl({
      origin: "https://monza.test",
      callbackPath: "/auth/confirm",
      returnPath: "/en/cars/porsche/live-123/report?region=EU",
    })).toBe("https://monza.test/auth/confirm?next=%2Fen%2Fcars%2Fporsche%2Flive-123%2Freport%3Fregion%3DEU")
  })
})
