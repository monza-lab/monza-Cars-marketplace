import { describe, expect, it } from "vitest";
import { FerrariHistoryInputSchema } from "@/features/ferrari_history/contracts";
import {
  mapToComparableSales,
  mapToPriceHistoryEntries,
  normalizeModel,
  normalizeSoldRows,
} from "@/features/ferrari_history/adapters";
import { fetchFerrariHistoricalByModel } from "@/features/ferrari_history/service";

function monthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString();
}

describe("ferrari history boundary", () => {
  it("contracts: rejects invalid model input", () => {
    const parsed = FerrariHistoryInputSchema.safeParse({
      make: "ferrari",
      model: "",
      months: 12,
      limit: 120,
    });

    expect(parsed.success).toBe(false);
  });

  it("filters sold rows, enforces 12-month window, and sorts stably", () => {
    const rows = [
      {
        id: "a-1",
        make: "Ferrari",
        model: "F40",
        status: "sold",
        final_price: 1500000,
        hammer_price: null,
        end_time: monthsAgo(1),
        sale_date: null,
        original_currency: "USD",
        source: "BaT",
        year: 1991,
        mileage: 12000,
        location: "Miami",
        source_url: "https://example.com/a-1",
      },
      {
        id: "a-2",
        make: "Ferrari",
        model: "F40",
        status: "active",
        final_price: 1600000,
        hammer_price: null,
        end_time: monthsAgo(1),
        sale_date: null,
        original_currency: "USD",
        source: "BaT",
        year: 1990,
        mileage: 13000,
        location: "Miami",
        source_url: "https://example.com/a-2",
      },
      {
        id: "a-3",
        make: "Ferrari",
        model: "F40",
        status: "sold",
        final_price: null,
        hammer_price: "0",
        end_time: monthsAgo(1),
        sale_date: null,
        original_currency: "USD",
        source: "BaT",
        year: 1992,
        mileage: 10000,
        location: "London",
        source_url: "https://example.com/a-3",
      },
      {
        id: "a-4",
        make: "Ferrari",
        model: "F40",
        status: "sold",
        final_price: 1700000,
        hammer_price: null,
        end_time: monthsAgo(14),
        sale_date: null,
        original_currency: "EUR",
        source: "Cars & Bids",
        year: 1990,
        mileage: 14000,
        location: "Rome",
        source_url: "https://example.com/a-4",
      },
      {
        id: "a-5",
        make: "Ferrari",
        model: "F50",
        status: "sold",
        final_price: 3000000,
        hammer_price: null,
        end_time: monthsAgo(1),
        sale_date: null,
        original_currency: null,
        source: "BaT",
        year: 1997,
        mileage: 9000,
        location: "LA",
        source_url: "https://example.com/a-5",
      },
      {
        id: "a-1",
        make: "Ferrari",
        model: "F40",
        status: "sold",
        final_price: 1800000,
        hammer_price: null,
        end_time: monthsAgo(2),
        sale_date: null,
        original_currency: "USD",
        source: "BaT",
        year: 1991,
        mileage: 12050,
        location: "Miami",
        source_url: "https://example.com/a-1-dup",
      },
    ];

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);

    const soldSeries = normalizeSoldRows(rows, normalizeModel("F40"), cutoff);

    expect(soldSeries).toHaveLength(1);
    expect(soldSeries[0].id).toBe("a-1");
    expect(soldSeries[0].sold_price).toBe(1800000);
    expect(soldSeries[0].currency).toBe("USD");

    const priceHistory = mapToPriceHistoryEntries(soldSeries);
    expect(priceHistory).toHaveLength(1);
    expect(priceHistory[0].bid).toBe(1800000);

    const comparables = mapToComparableSales(soldSeries);
    expect(comparables).toHaveLength(1);
    expect(comparables[0].soldPrice).toBe(1800000);
  });

  it("keeps non-ferrari path invariant in service", async () => {
    const result = await fetchFerrariHistoricalByModel({
      make: "Porsche",
      model: "911",
    });

    expect(result.isFerrariContext).toBe(false);
    expect(result.priceHistory).toEqual([]);
    expect(result.comparables).toEqual([]);
  });
});
