import { describe, expect, it } from "vitest"
import { createListingFingerprint } from "./fingerprint"

describe("createListingFingerprint", () => {
  const listing = {
    id: "live-1",
    title: "1997 Porsche 911 Carrera",
    price: 82500,
    mileage: 74000,
    transmission: "Manual",
    vin: "WP0AA2999VS123456",
    description: "Documented service history",
    sourceUrl: "https://example.com/listing/1",
  }

  it("is stable for the same material listing inputs", () => {
    expect(createListingFingerprint(listing)).toBe(createListingFingerprint({ ...listing }))
  })

  it("changes when a material listing input changes", () => {
    expect(createListingFingerprint(listing)).not.toBe(
      createListingFingerprint({ ...listing, price: 79000 }),
    )
  })

  it("ignores unrelated presentation fields", () => {
    expect(createListingFingerprint(listing)).toBe(
      createListingFingerprint({ ...listing, imageUrl: "https://example.com/new.jpg" }),
    )
  })
})
