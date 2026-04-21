import { describe, it, expect } from "vitest";
import { FEES } from "../fees";

describe("FEES", () => {
  it("has entries for all 4 supported countries", () => {
    expect(Object.keys(FEES).sort()).toEqual(["DE", "JP", "UK", "US"]);
  });

  it("every country's fees use its own currency", () => {
    const expected: Record<string, string> = {
      US: "USD",
      DE: "EUR",
      UK: "GBP",
      JP: "JPY",
    };
    for (const [country, fees] of Object.entries(FEES)) {
      expect(fees.currency).toBe(expected[country]);
      expect(fees.portAndBroker.currency).toBe(expected[country]);
      expect(fees.registration.currency).toBe(expected[country]);
    }
  });

  it("insurance pct range is 1.5–2.5 for all countries", () => {
    for (const fees of Object.values(FEES)) {
      expect(fees.marineInsurancePctRange.minPct).toBe(1.5);
      expect(fees.marineInsurancePctRange.maxPct).toBe(2.5);
    }
  });

  it("min values are always ≤ max values", () => {
    for (const fees of Object.values(FEES)) {
      expect(fees.portAndBroker.min).toBeLessThanOrEqual(fees.portAndBroker.max);
      expect(fees.registration.min).toBeLessThanOrEqual(fees.registration.max);
    }
  });
});
