import { describe, expect, it, vi } from "vitest"
import {
  findBestPricedRegion,
  formatDetailMileage,
  hasMeaningfulTrend,
  hasRegionalPricing,
  navigateBackOrBrowse,
} from "./carDetailPresentation"

const emptyPricing = {
  US: { low: 0, high: 0, currency: "USD" },
  EU: { low: 0, high: 0, currency: "EUR" },
  UK: { low: 0, high: 0, currency: "GBP" },
  JP: { low: 0, high: 0, currency: "JPY" },
}

describe("car detail presentation", () => {
  it("hides zero or missing market trends", () => {
    expect(hasMeaningfulTrend("0% →", 0)).toBe(false)
    expect(hasMeaningfulTrend(null, 12)).toBe(false)
    expect(hasMeaningfulTrend("+12% ↑", 12)).toBe(true)
  })

  it("shows unknown mileage as an em dash", () => {
    expect(formatDetailMileage(0, "mi", "en-US")).toBe("—")
    expect(formatDetailMileage(12_500, "mi", "en-US")).toBe("12,500 mi")
  })

  it("never chooses a BEST region when every band is POA", () => {
    expect(hasRegionalPricing(emptyPricing)).toBe(false)
    expect(findBestPricedRegion(emptyPricing)).toBeNull()
  })

  it("uses browser history with a browse fallback", () => {
    const router = { back: vi.fn(), push: vi.fn() }
    navigateBackOrBrowse(router, 2)
    expect(router.back).toHaveBeenCalledOnce()

    router.back.mockClear()
    navigateBackOrBrowse(router, 1)
    expect(router.push).toHaveBeenCalledWith("/browse")
  })
})
