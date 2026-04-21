import { describe, it, expect } from "vitest";
import { SHIPPING_RATES, SHIPPING_SOURCES } from "../shipping";
import type { Country } from "../types";

const COUNTRIES: Country[] = ["US", "DE", "UK", "JP"];

describe("SHIPPING_RATES", () => {
  it("has 16 cells covering every ordered pair", () => {
    for (const origin of COUNTRIES) {
      for (const dest of COUNTRIES) {
        expect(SHIPPING_RATES[origin]).toHaveProperty(dest);
      }
    }
  });

  it("same-country pairs are null (domestic)", () => {
    for (const country of COUNTRIES) {
      expect(SHIPPING_RATES[country][country]).toBeNull();
    }
  });

  it("cross-border cells have min ≤ max and correct destination currency", () => {
    const expected: Record<Country, string> = {
      US: "USD",
      DE: "EUR",
      UK: "GBP",
      JP: "JPY",
    };
    for (const origin of COUNTRIES) {
      for (const dest of COUNTRIES) {
        if (origin === dest) continue;
        const r = SHIPPING_RATES[origin][dest];
        expect(r).not.toBeNull();
        expect(r!.min).toBeLessThanOrEqual(r!.max);
        expect(r!.currency).toBe(expected[dest]);
      }
    }
  });
});

describe("SHIPPING_SOURCES", () => {
  it("has at least 3 aggregated carrier sources", () => {
    expect(SHIPPING_SOURCES.length).toBeGreaterThanOrEqual(3);
  });

  it("every source has a name and lastReviewed date", () => {
    for (const s of SHIPPING_SOURCES) {
      expect(s.name).toBeTruthy();
      expect(s.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
