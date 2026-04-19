import { describe, it, expect } from "vitest";
import { derivePrice } from "../pricing/derivePrice";

describe("supabaseLiveListings derivation smoke", () => {
  it("derivePrice produces sold basis for BaT sold row", () => {
    const d = derivePrice(
      {
        source: "BaT",
        status: "sold",
        year: 2005,
        make: "Porsche",
        model: "911 Carrera",
        hammer_price: 120000,
        final_price: 120000,
        current_bid: 120000,
        original_currency: "USD",
      },
      { rates: { USD: 1 } },
    );
    expect(d.basis).toBe("sold");
    expect(d.soldPriceUsd).toBe(120000);
    expect(d.canonicalMarket).toBe("US");
  });

  it("AutoScout24 row gets asking basis with family", () => {
    const d = derivePrice(
      {
        source: "AutoScout24",
        status: "active",
        year: 2018,
        make: "Porsche",
        model: "911 Carrera",
        hammer_price: 95000,
        final_price: 95000,
        current_bid: 95000,
        original_currency: "EUR",
      },
      { rates: { EUR: 0.92 } },
    );
    expect(d.basis).toBe("asking");
    expect(d.canonicalMarket).toBe("EU");
    expect(d.family).toBe("991");
  });
});
