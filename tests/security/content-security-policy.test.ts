import { describe, expect, it } from "vitest"

import nextConfig from "../../next.config"

describe("Content Security Policy", () => {
  it("allows the non-advertising GA4 endpoints required after consent", async () => {
    expect(typeof nextConfig).toBe("object")

    const headers = await nextConfig.headers?.()
    const csp = headers
      ?.flatMap((entry) => entry.headers)
      .find((header) => header.key === "Content-Security-Policy")
      ?.value

    expect(csp).toContain("script-src")
    expect(csp).toContain("https://www.googletagmanager.com")
    expect(csp).toContain("img-src")
    expect(csp).toContain("https://*.google-analytics.com")
    expect(csp).toContain("connect-src")
    expect(csp).toContain("https://*.analytics.google.com")
  })
})
