import { describe, expect, it } from "vitest"
import { mapElferspotUpsertRow } from "./supabase_writer"
import type { NormalizedElferspot } from "./normalize"

function listing(overrides: Partial<NormalizedElferspot> = {}): NormalizedElferspot {
  return {
    source: "Elferspot",
    source_id: "elfer-1",
    source_url: "https://www.elferspot.com/en/car/porsche-911-1/",
    title: "Porsche 911 Carrera",
    make: "Porsche",
    model: "911 Carrera",
    trim: "Carrera",
    year: 1987,
    price: null,
    original_currency: "EUR",
    mileage_km: null,
    transmission: null,
    body_style: null,
    engine: null,
    color_exterior: null,
    color_interior: null,
    vin: null,
    description_text: null,
    images: [],
    photos_count: 0,
    country: "Germany",
    location: null,
    seller_type: null,
    seller_name: null,
    status: "active",
    fuel: null,
    scrape_timestamp: "2026-06-06T00:00:00.000Z",
    enrichment_meta: {
      elferspot: {
        priceStatus: "unknown",
        descriptionStatus: "missing",
        checkedAt: "2026-06-06T00:00:00.000Z",
      },
    },
    ...overrides,
  }
}

describe("mapElferspotUpsertRow", () => {
  it("omits nullable detail fields when discovery did not scrape details", () => {
    const row = mapElferspotUpsertRow(listing())

    expect(row).not.toHaveProperty("transmission")
    expect(row).not.toHaveProperty("body_style")
    expect(row).not.toHaveProperty("engine")
    expect(row).not.toHaveProperty("color_exterior")
    expect(row).not.toHaveProperty("color_interior")
    expect(row).not.toHaveProperty("vin")
    expect(row).not.toHaveProperty("description_text")
    expect(row).not.toHaveProperty("images")
    expect(row).not.toHaveProperty("photos_count")
  })

  it("includes non-empty detail fields in the upsert payload", () => {
    const row = mapElferspotUpsertRow(listing({
      transmission: "Manual",
      engine: "3.2L",
      color_exterior: "Guards Red",
      images: ["https://cdn.elferspot.com/car.jpg"],
      photos_count: 1,
    }))

    expect(row.transmission).toBe("Manual")
    expect(row.engine).toBe("3.2L")
    expect(row.color_exterior).toBe("Guards Red")
    expect(row.images).toEqual(["https://cdn.elferspot.com/car.jpg"])
    expect(row.photos_count).toBe(1)
  })
})
