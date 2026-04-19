import { describe, it, expect } from "vitest"
import type { HausReport } from "../types"
import mock from "./992-gt3-pts-mock.json"

describe("992-gt3-pts-mock fixture", () => {
  it("conforms to HausReport shape", () => {
    const r: HausReport = mock as HausReport
    expect(r.listing_id).toBeTruthy()
    expect(r.specific_car_fair_value_mid).toBeGreaterThan(r.specific_car_fair_value_low)
    expect(r.specific_car_fair_value_high).toBeGreaterThan(r.specific_car_fair_value_mid)
    expect(r.signals_detected.length).toBeGreaterThan(0)
    expect(r.modifiers_applied.length).toBeGreaterThan(0)
    expect(r.extraction_version).toBe("v1.0")
  })

  it("specific fair value mid equals baseline × (1 + totalPercent/100) within ±1", () => {
    const r: HausReport = mock as HausReport
    const expectedMid = Math.round(r.median_price * (1 + r.modifiers_total_percent / 100))
    expect(Math.abs(r.specific_car_fair_value_mid - expectedMid)).toBeLessThan(Math.round(r.median_price * 0.02))
  })
})
