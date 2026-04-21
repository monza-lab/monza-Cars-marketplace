import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { calculateLandedCost } from "../calculator";
import * as exchangeRates from "@/lib/exchangeRates";
import type { Country, OriginCountry } from "../types";

beforeAll(() => {
  vi.spyOn(exchangeRates, "getExchangeRates").mockResolvedValue({
    EUR: 0.92,
    GBP: 0.78,
    JPY: 155,
    USD: 1,
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T00:00:00Z"));
});

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const scenarios: Array<{
  origin: OriginCountry;
  dest: Country;
  price: number;
  year: number;
}> = [
  { origin: "DE", dest: "US", price: 300000, year: 1973 },
  { origin: "US", dest: "DE", price: 200000, year: 2023 },
  { origin: "JP", dest: "UK", price: 80000, year: 1995 },
  { origin: "IT", dest: "US", price: 120000, year: 2019 },
  { origin: "UK", dest: "JP", price: 150000, year: 2010 },
];

describe("integration invariants", () => {
  it.each(scenarios)(
    "$origin → $dest ($year): sum of 6 components = importCosts",
    async ({ origin, dest, price, year }) => {
      const r = await calculateLandedCost({
        car: { priceUsd: price, year },
        origin,
        destination: dest,
      });
      expect(r).not.toBeNull();
      const sumMin =
        r!.shipping.min +
        r!.marineInsurance.min +
        r!.customsDuty.min +
        r!.vatOrSalesTax.min +
        r!.portAndBroker.min +
        r!.registration.min;
      const sumMax =
        r!.shipping.max +
        r!.marineInsurance.max +
        r!.customsDuty.max +
        r!.vatOrSalesTax.max +
        r!.portAndBroker.max +
        r!.registration.max;
      expect(r!.importCosts.min).toBeCloseTo(sumMin, 0);
      expect(r!.importCosts.max).toBeCloseTo(sumMax, 0);
    },
  );

  it.each(scenarios)(
    "$origin → $dest: landedCost = carPriceLocal + importCosts",
    async ({ origin, dest, price, year }) => {
      const r = await calculateLandedCost({
        car: { priceUsd: price, year },
        origin,
        destination: dest,
      });
      expect(r).not.toBeNull();
      expect(r!.landedCost.min).toBeCloseTo(r!.carPriceLocal.min + r!.importCosts.min, 0);
      expect(r!.landedCost.max).toBeCloseTo(r!.carPriceLocal.max + r!.importCosts.max, 0);
    },
  );

  it.each(scenarios)(
    "$origin → $dest: every component uses the destination currency",
    async ({ origin, dest, price, year }) => {
      const r = await calculateLandedCost({
        car: { priceUsd: price, year },
        origin,
        destination: dest,
      });
      expect(r).not.toBeNull();
      const cur = r!.currency;
      expect(r!.shipping.currency).toBe(cur);
      expect(r!.marineInsurance.currency).toBe(cur);
      expect(r!.customsDuty.currency).toBe(cur);
      expect(r!.vatOrSalesTax.currency).toBe(cur);
      expect(r!.portAndBroker.currency).toBe(cur);
      expect(r!.registration.currency).toBe(cur);
      expect(r!.importCosts.currency).toBe(cur);
      expect(r!.landedCost.currency).toBe(cur);
    },
  );
});
