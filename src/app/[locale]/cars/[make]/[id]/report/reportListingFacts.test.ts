import { describe, expect, it } from "vitest"
import { resolveCurrentPriceUsd } from "./reportListingFacts"

describe("resolveCurrentPriceUsd", () => {
  it("uses the current bid when the listing has an active auction price", () => {
    expect(resolveCurrentPriceUsd({
      currentBid: 278000,
      askingPriceUsd: 300000,
      price: 300000,
    })).toBe(278000)
  })

  it("falls back to the listing price when there is no current bid", () => {
    expect(resolveCurrentPriceUsd({
      currentBid: 0,
      askingPriceUsd: 235000,
      price: 240000,
    })).toBe(235000)
  })
})
