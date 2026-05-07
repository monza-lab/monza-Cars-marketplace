import { extractVinIntelligence } from "./vinDeep"

describe("extractVinIntelligence", () => {
  it("decodes a 911 VIN with body hint and Stuttgart plant", () => {
    // WP0ZZZ99Z7S721047: WP0 = Porsche, pos10='7' → 2007, pos11='S' → Stuttgart
    const result = extractVinIntelligence({
      vin: "WP0ZZZ99Z7S721047",
      year: 2007,
      model: "911 Carrera 4S",
      seriesId: "997",
    })
    expect(result.decoded).toBe(true)
    expect(result.plant).toContain("Stuttgart")
    expect(result.bodyHint).toBeTruthy()
    expect(result.modelYearFromVin).toBe(2007)
    expect(result.yearMatch).toBe(true)
    expect(result.warnings).toHaveLength(0)
    // At minimum we get a vin_verified signal
    expect(result.signals.length).toBeGreaterThanOrEqual(1)
    expect(result.signals.some((s) => s.key === "vin_verified")).toBe(true)
  })

  it("returns not-decoded for null VIN", () => {
    const result = extractVinIntelligence({
      vin: null,
      year: 2022,
      model: "911 GT3",
      seriesId: "992",
    })
    expect(result.decoded).toBe(false)
    expect(result.rawDecode).toBeNull()
    expect(result.signals).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it("detects year mismatch between VIN and listing", () => {
    // VIN pos10='7' decodes to 2007, but listing says 2015
    const result = extractVinIntelligence({
      vin: "WP0ZZZ99Z7S721047",
      year: 2015,
      model: "911 Carrera",
      seriesId: "991",
    })
    expect(result.yearMatch).toBe(false)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain("year mismatch")
    // Should have both vin_year_mismatch and vin_verified signals
    expect(result.signals.some((s) => s.key === "vin_year_mismatch")).toBe(true)
    expect(result.signals.some((s) => s.key === "vin_verified")).toBe(true)
  })

  it("identifies Leipzig vs Stuttgart production via plant code", () => {
    // pos11='L' → Leipzig. pos10='7' → 2007
    const result = extractVinIntelligence({
      vin: "WP0ZZZ99Z7L000001",
      year: 2007,
      model: "Cayenne",
      seriesId: "cayenne",
    })
    expect(result.decoded).toBe(true)
    expect(result.plant).toContain("Leipzig")
  })

  it("handles invalid VIN gracefully", () => {
    const result = extractVinIntelligence({
      vin: "INVALID",
      year: 2020,
      model: "911",
      seriesId: "992",
    })
    expect(result.decoded).toBe(false)
    expect(result.rawDecode).not.toBeNull()
    expect(result.rawDecode!.valid).toBe(false)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.signals).toHaveLength(0)
  })
})
