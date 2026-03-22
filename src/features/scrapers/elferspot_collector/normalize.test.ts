import { describe, it, expect } from "vitest"
import { normalizeListing, mapTransmission, mapBodyStyle } from "./normalize"
import type { ElferspotListingSummary, ElferspotDetail } from "./types"

describe("mapTransmission", () => {
  it("maps PDK to Automatic", () => expect(mapTransmission("PDK")).toBe("Automatic"))
  it("maps Manual to Manual", () => expect(mapTransmission("Manual")).toBe("Manual"))
  it("maps Schaltgetriebe to Manual", () => expect(mapTransmission("Schaltgetriebe")).toBe("Manual"))
  it("returns null for null input", () => expect(mapTransmission(null)).toBeNull())
})

describe("mapBodyStyle", () => {
  it("maps Coup\u00e9 to Coupe", () => expect(mapBodyStyle("Coup\u00e9")).toBe("Coupe"))
  it("maps Cabriolet to Convertible", () => expect(mapBodyStyle("Cabriolet")).toBe("Convertible"))
  it("maps Targa to Targa", () => expect(mapBodyStyle("Targa")).toBe("Targa"))
})

describe("normalizeListing", () => {
  const summary: ElferspotListingSummary = {
    sourceUrl: "https://www.elferspot.com/en/car/porsche-992-gt3-2023-5856995/",
    sourceId: "5856995",
    title: "Porsche 992 GT3",
    year: 2023,
    country: "DE",
    thumbnailUrl: "https://cdn.elferspot.com/thumb.jpg",
  }

  const detail: ElferspotDetail = {
    price: 224990, currency: "EUR", year: 2023, mileageKm: 12500,
    transmission: "PDK", bodyType: "Coup\u00e9", driveType: "Rear drive",
    colorExterior: "Green", model: "992 GT3", firstRegistration: "2023-06-15",
    fuel: "Gasoline", engine: "4.0L 510 HP", colorInterior: "Black",
    vin: "WP0ZZZ99ZPS123456", sellerName: "Auto M\u00fcller", sellerType: "dealer",
    location: "Munich", locationCountry: "Germany", descriptionText: "Perfect condition",
    images: ["https://cdn.elferspot.com/img1.jpeg"], condition: "Accident-free",
  }

  it("produces a valid normalized listing", () => {
    const result = normalizeListing(summary, detail)
    expect(result).not.toBeNull()
    expect(result!.source).toBe("Elferspot")
    expect(result!.source_id).toBe("5856995")
    expect(result!.make).toBe("Porsche")
    expect(result!.price).toBe(224990)
    expect(result!.original_currency).toBe("EUR")
    expect(result!.transmission).toBe("Automatic") // PDK -> Automatic
    expect(result!.body_style).toBe("Coupe") // Coup\u00e9 -> Coupe
    expect(result!.vin).toBe("WP0ZZZ99ZPS123456")
  })

  it("handles null price (Price on request)", () => {
    const result = normalizeListing(summary, { ...detail, price: null })
    expect(result!.price).toBeNull()
  })
})
