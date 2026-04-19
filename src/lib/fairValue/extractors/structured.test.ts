import { describe, it, expect } from "vitest"
import { extractStructuredSignals } from "./structured"

describe("extractStructuredSignals", () => {
  it("emits a transmission signal from listings.transmission field", () => {
    const signals = extractStructuredSignals({
      id: "x", year: 2022, make: "Porsche", model: "992 GT3",
      mileage: 12000, transmission: "Manual", country: "US",
    } as any)
    const tx = signals.find(s => s.key === "transmission")
    expect(tx).toBeTruthy()
    expect(tx!.value_display).toContain("Manual")
    expect(tx!.evidence.source_type).toBe("structured_field")
  })

  it("emits a mileage signal", () => {
    const signals = extractStructuredSignals({
      id: "x", year: 2022, make: "Porsche", model: "992", mileage: 12000,
    } as any)
    expect(signals.find(s => s.key === "mileage")).toBeTruthy()
  })

  it("emits a year signal", () => {
    const signals = extractStructuredSignals({
      id: "x", year: 2022, make: "Porsche", model: "992",
    } as any)
    expect(signals.find(s => s.key === "year")).toBeTruthy()
  })

  it("does not emit transmission signal when field is null", () => {
    const signals = extractStructuredSignals({
      id: "x", year: 2022, make: "Porsche", model: "992", transmission: null,
    } as any)
    expect(signals.find(s => s.key === "transmission")).toBeUndefined()
  })
})
