import { describe, expect, it } from "vitest"
import { shouldShowCampaignContext } from "./CampaignContextStrip"

describe("campaign context strip", () => {
  it("appears only for attributed traffic", () => {
    expect(shouldShowCampaignContext(new URLSearchParams("utm_source=instagram"))).toBe(true)
    expect(shouldShowCampaignContext(new URLSearchParams("fbclid=x"))).toBe(true)
    expect(shouldShowCampaignContext(new URLSearchParams("gclid=x"))).toBe(true)
    expect(shouldShowCampaignContext(new URLSearchParams("series=997"))).toBe(false)
  })
})
