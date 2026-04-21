import { describe, expect, it } from "vitest"

import { selectBestDatabaseImage } from "./aggregation"

type MockAuction = {
  id: string
  platform: string
  currentBid: number
  price: number
  images: string[]
}

describe("selectBestDatabaseImage", () => {
  it("uses a historical database photo when live listings do not have one", () => {
    const liveCars: MockAuction[] = [
      {
        id: "live-1",
        platform: "BRING_A_TRAILER",
        currentBid: 240000,
        price: 240000,
        images: [],
      },
    ]

    const historicalCars: MockAuction[] = [
      {
        id: "hist-1",
        platform: "ELFERSPOT",
        currentBid: 0,
        price: 180000,
        images: ["https://images.unsplash.com/photo-1672717901304-5ef5480894ca?w=1200&h=800&fit=crop"],
      },
    ]

    expect(selectBestDatabaseImage(liveCars, historicalCars)).toBe(
      "https://images.unsplash.com/photo-1672717901304-5ef5480894ca?w=1200&h=800&fit=crop",
    )
  })
})
