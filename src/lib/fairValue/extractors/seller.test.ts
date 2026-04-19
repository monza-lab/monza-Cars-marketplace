import { describe, it, expect } from "vitest"
import { extractSellerSignal } from "./seller"

describe("extractSellerSignal", () => {
  it("flags a known specialist seller", () => {
    const s = extractSellerSignal({ sellerName: "Canepa", sellerDomain: "canepa.com" })
    expect(s).toBeTruthy()
    expect(s!.key).toBe("seller_tier")
    expect(s!.value_display).toMatch(/specialist/i)
  })

  it("returns null for unknown sellers", () => {
    const s = extractSellerSignal({ sellerName: "John Doe", sellerDomain: null })
    expect(s).toBeNull()
  })

  it("matches domain substring case-insensitively", () => {
    const s = extractSellerSignal({ sellerName: null, sellerDomain: "shop.SLOANCARSLTD.com" })
    expect(s).toBeTruthy()
  })
})
