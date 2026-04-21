import { describe, it, expect } from "vitest"
import { computeSourceHash, type RewriterSource } from "./sourceHash"

const base: RewriterSource = {
  description_text: "Two owners. Service history complete.",
  year: 2011,
  make: "Porsche",
  model: "911 GT3",
  trim: null,
  mileage: 9321,
  mileage_unit: "mi",
  vin: "WP0AC29911S693111",
  color_exterior: "Carrara White",
  color_interior: "Black",
  engine: "3.8L flat-six",
  transmission: "6-speed manual",
  body_style: "Coupe",
  location: "Japan",
  platform: "BEFORWARD",
}

describe("computeSourceHash", () => {
  it("returns a 64-char hex sha256", () => {
    const h = computeSourceHash(base)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is stable across calls with the same input", () => {
    expect(computeSourceHash(base)).toBe(computeSourceHash(base))
  })

  it("is stable across field insertion order", () => {
    const shuffled: RewriterSource = {
      platform: base.platform,
      description_text: base.description_text,
      year: base.year,
      vin: base.vin,
      make: base.make,
      model: base.model,
      trim: base.trim,
      mileage: base.mileage,
      mileage_unit: base.mileage_unit,
      color_exterior: base.color_exterior,
      color_interior: base.color_interior,
      engine: base.engine,
      transmission: base.transmission,
      body_style: base.body_style,
      location: base.location,
    }
    expect(computeSourceHash(shuffled)).toBe(computeSourceHash(base))
  })

  it("changes when any field changes", () => {
    const original = computeSourceHash(base)
    expect(computeSourceHash({ ...base, mileage: 9322 })).not.toBe(original)
    expect(computeSourceHash({ ...base, description_text: "changed" })).not.toBe(original)
    expect(computeSourceHash({ ...base, color_interior: null })).not.toBe(original)
  })
})
