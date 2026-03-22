import { describe, it, expect } from "vitest"
import { matchVariant, extractSeries } from "./brandConfig"

describe("matchVariant regression tests", () => {
  // Existing behavior must be preserved
  it("matches 992 GT3 RS", () => {
    expect(matchVariant("992 GT3 RS", null, "992", "Porsche")).toBe("gt3-rs")
  })
  it("matches 991 911 R", () => {
    expect(matchVariant("991 911 R", null, "991", "Porsche")).toBe("911-r")
  })
  it("matches generic 993 Carrera", () => {
    expect(matchVariant("993 Carrera", null, "993", "Porsche")).toBe("carrera")
  })
  it("matches 964 RS America (most specific wins)", () => {
    expect(matchVariant("964 RS America", null, "964", "Porsche")).toBe("rs-america")
  })

  // New Elferspot variants
  it("matches 964 Carrera RS 3.8", () => {
    expect(matchVariant("964 Carrera RS 3.8", null, "964", "Porsche")).toBe("carrera-rs-3.8")
  })
  it("matches 964 Turbo Flachbau", () => {
    expect(matchVariant("964 Turbo Flachbau", null, "964", "Porsche")).toBe("turbo-flachbau")
  })
  it("matches 930 Turbo 3.3 WLS", () => {
    expect(matchVariant("930 Turbo 3.3 WLS", null, "930", "Porsche")).toBe("turbo-3.3-wls")
  })
  it("matches G-Model Carrera 3.2 Clubsport", () => {
    expect(matchVariant("911 Carrera 3.2 Clubsport", null, "g-model", "Porsche")).toBe("carrera-3.2-clubsport")
  })
  it("matches F-Model 911 T", () => {
    expect(matchVariant("911 T", null, "f-model", "Porsche")).toBe("911-t")
  })
  it("matches 992.2 GT3 Touring → base gt3-touring variant", () => {
    expect(matchVariant("992.2 GT3 Touring", null, "992", "Porsche")).toBe("gt3-touring")
  })

  // Cross-scraper titles (BaT, AS24, etc.)
  it("BaT-style title: '1996 Porsche 993 Turbo' matches turbo", () => {
    expect(matchVariant("993 Turbo", null, "993", "Porsche")).toBe("turbo")
  })
  it("AS24-style title: '911 Carrera' with no variant detail still matches", () => {
    expect(matchVariant("911 Carrera", null, "997", "Porsche")).toBe("carrera")
  })
})

describe("extractSeries still works", () => {
  it("extracts 992 from model", () => {
    expect(extractSeries("992 GT3", 2023, "Porsche")).toBe("992")
  })
  it("extracts 964 from model", () => {
    expect(extractSeries("964 Carrera RS 3.8", 1993, "Porsche")).toBe("964")
  })
  it("year fallback: 911 Carrera → 997 for year 2010", () => {
    expect(extractSeries("911 Carrera", 2010, "Porsche")).toBe("997")
  })
})
