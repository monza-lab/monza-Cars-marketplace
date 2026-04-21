import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { calculateLandedCost, computeTeaserAmount } from "../calculator";
import * as exchangeRates from "@/lib/exchangeRates";

const FIXED_RATES: Record<string, number> = {
  EUR: 0.92,
  GBP: 0.78,
  JPY: 155,
  USD: 1,
};

beforeAll(() => {
  vi.spyOn(exchangeRates, "getExchangeRates").mockResolvedValue(FIXED_RATES);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T00:00:00Z"));
});

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("calculateLandedCost", () => {
  it("returns null for domestic (origin === destination)", async () => {
    const result = await calculateLandedCost({
      car: { priceUsd: 50000, year: 2015 },
      origin: "US",
      destination: "US",
    });
    expect(result).toBeNull();
  });

  it("1973 911 (DE → US): 0% duty via 25-year exemption", async () => {
    const result = await calculateLandedCost({
      car: { priceUsd: 300000, year: 1973 },
      origin: "DE",
      destination: "US",
    });
    expect(result).not.toBeNull();
    expect(result!.customsDuty.min).toBe(0);
    expect(result!.customsDuty.max).toBe(0);
    expect(result!.notes.some((n) => /25-year/i.test(n))).toBe(true);
    expect(result!.currency).toBe("USD");
  });

  it("2023 GT3 (US → DE): 10% duty + 19% VAT applied", async () => {
    const result = await calculateLandedCost({
      car: { priceUsd: 200000, year: 2023 },
      origin: "US",
      destination: "DE",
    });
    expect(result).not.toBeNull();
    expect(result!.currency).toBe("EUR");
    // Car price in EUR at rate 0.92 = 184,000.
    expect(result!.carPriceLocal.min).toBe(184000);
    expect(result!.customsDuty.min).toBeGreaterThan(0);
    expect(result!.vatOrSalesTax.min).toBeGreaterThan(0);
    expect(result!.notes.some((n) => /Historic/i.test(n))).toBe(false);
  });

  it("1995 Porsche (JP → UK, age 31): 5% duty + 5% historic VAT", async () => {
    const result = await calculateLandedCost({
      car: { priceUsd: 80000, year: 1995 },
      origin: "JP",
      destination: "UK",
    });
    expect(result).not.toBeNull();
    expect(result!.currency).toBe("GBP");
    expect(result!.notes.some((n) => /Historic/i.test(n))).toBe(true);
  });

  it("Italy origin (IT → US) proxies to DE and adds proxy note", async () => {
    const result = await calculateLandedCost({
      car: { priceUsd: 120000, year: 2019 },
      origin: "IT",
      destination: "US",
    });
    expect(result).not.toBeNull();
    expect(result!.origin).toBe("IT");
    expect(result!.usedProxyFor).toBe("IT");
    expect(result!.notes.some((n) => /proxy|Northern European/i.test(n))).toBe(true);
  });

  it("Missing year: uses standard rate and adds fallback note", async () => {
    const result = await calculateLandedCost({
      car: { priceUsd: 50000, year: 0 },
      origin: "DE",
      destination: "US",
    });
    expect(result).not.toBeNull();
    expect(result!.customsDuty.min).toBeGreaterThan(0);
    expect(result!.notes.some((n) => /year.*unknown/i.test(n))).toBe(true);
  });

  it("Zero price returns null", async () => {
    const result = await calculateLandedCost({
      car: { priceUsd: 0, year: 2020 },
      origin: "DE",
      destination: "US",
    });
    expect(result).toBeNull();
  });

  it("Unsupported origin (canonical=null) returns null", async () => {
    const result = await calculateLandedCost({
      car: { priceUsd: 50000, year: 2020 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      origin: "CA" as any,
      destination: "US",
    });
    expect(result).toBeNull();
  });
});

describe("computeTeaserAmount", () => {
  it("returns midpoint of landedCost rounded to nearest 100", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const breakdown = {
      landedCost: { min: 95362, max: 99868, currency: "USD" as const },
    } as any;
    expect(computeTeaserAmount(breakdown)).toBe(97600);
  });

  it("rounds 97,650 midpoint → 97,700", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const breakdown = {
      landedCost: { min: 95350, max: 99950, currency: "USD" as const },
    } as any;
    expect(computeTeaserAmount(breakdown)).toBe(97700);
  });
});
