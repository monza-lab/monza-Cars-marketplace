import { describe, it, expect } from "vitest"
import { extractStructuredSignals } from "./structured"

describe("extractStructuredSignals", () => {
  it("emits a transmission signal from listings.transmission field", () => {
    const signals = extractStructuredSignals({
      year: 2022,
      mileage: 12000,
      transmission: "Manual",
    })
    const tx = signals.find((s) => s.key === "transmission")
    expect(tx).toBeTruthy()
    expect(tx!.value_display).toContain("Manual")
    expect(tx!.evidence.source_type).toBe("structured_field")
  })

  it("emits a mileage signal", () => {
    const signals = extractStructuredSignals({ year: 2022, mileage: 12000 })
    expect(signals.find((s) => s.key === "mileage")).toBeTruthy()
  })

  it("emits a year signal", () => {
    const signals = extractStructuredSignals({ year: 2022 })
    expect(signals.find((s) => s.key === "year")).toBeTruthy()
  })

  it("does not emit transmission signal when field is null", () => {
    const signals = extractStructuredSignals({ year: 2022, transmission: null })
    expect(signals.find((s) => s.key === "transmission")).toBeUndefined()
  })
})
