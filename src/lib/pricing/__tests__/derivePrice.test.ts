import { describe, it, expect } from "vitest";
import { derivePrice, type RawListing } from "../derivePrice";

const base: RawListing = {
  source: "BaT",
  status: "sold",
  year: 2005,
  make: "Porsche",
  model: "911 Carrera",
  hammer_price: 120000,
  final_price: 120000,
  current_bid: 120000,
  original_currency: "USD",
};

describe("derivePrice", () => {
  it("BaT sold → soldPrice from hammer", () => {
    const d = derivePrice(base, { rates: {} });
    expect(d.soldPriceUsd).toBe(120000);
    expect(d.askingPriceUsd).toBeNull();
    expect(d.basis).toBe("sold");
    expect(d.canonicalMarket).toBe("US");
  });

  it("BaT active → askingPrice from current_bid, NOT sold", () => {
    const d = derivePrice(
      { ...base, status: "active", hammer_price: null, final_price: null, current_bid: 55000 },
      { rates: {} },
    );
    expect(d.soldPriceUsd).toBeNull();
    expect(d.askingPriceUsd).toBe(55000);
    expect(d.basis).toBe("asking");
  });

  it("AutoScout24 active → asking (never sold) regardless of hammer_price value", () => {
    const d = derivePrice(
      {
        ...base,
        source: "AutoScout24",
        status: "active",
        hammer_price: 89000,
        final_price: 89000,
        current_bid: 89000,
        original_currency: "EUR",
      },
      { rates: { EUR: 0.92 } },
    );
    expect(d.soldPriceUsd).toBeNull();
    expect(d.askingPriceUsd).toBeCloseTo(89000 / 0.92, 0);
    expect(d.basis).toBe("asking");
    expect(d.canonicalMarket).toBe("EU");
  });

  it("AutoScout24 delisted → still asking (never sold)", () => {
    const d = derivePrice(
      { ...base, source: "AutoScout24", status: "delisted", hammer_price: 50000, original_currency: "EUR" },
      { rates: { EUR: 0.92 } },
    );
    expect(d.basis).toBe("asking");
    expect(d.soldPriceUsd).toBeNull();
  });

  it("ClassicCom sold → soldPrice", () => {
    const d = derivePrice({ ...base, source: "ClassicCom", hammer_price: 75000 }, { rates: {} });
    expect(d.basis).toBe("sold");
    expect(d.soldPriceUsd).toBe(75000);
    expect(d.canonicalMarket).toBe("US");
  });

  it("BeForward status=sold → soldPrice (rare but exists)", () => {
    const d = derivePrice(
      { ...base, source: "BeForward", status: "sold", hammer_price: null, final_price: null, current_bid: 40000, original_currency: "JPY" },
      { rates: { JPY: 1 / 0.0067 } },
    );
    expect(d.basis).toBe("sold");
    expect(d.soldPriceUsd).toBeCloseTo(40000 * 0.0067, 0);
    expect(d.canonicalMarket).toBe("JP");
  });

  it("BeForward status=active → asking", () => {
    const d = derivePrice(
      { ...base, source: "BeForward", status: "active", hammer_price: null, current_bid: 40000, original_currency: "JPY" },
      { rates: { JPY: 1 / 0.0067 } },
    );
    expect(d.basis).toBe("asking");
  });

  it("no usable price → unknown basis, nulls", () => {
    const d = derivePrice(
      { ...base, hammer_price: null, final_price: null, current_bid: null },
      { rates: {} },
    );
    expect(d.basis).toBe("unknown");
    expect(d.soldPriceUsd).toBeNull();
    expect(d.askingPriceUsd).toBeNull();
  });

  it("unknown source → canonicalMarket null, basis unknown", () => {
    const d = derivePrice({ ...base, source: "Weirdo" }, { rates: {} });
    expect(d.canonicalMarket).toBeNull();
    expect(d.basis).toBe("unknown");
  });

  it("extracts family via extractSeries", () => {
    const d = derivePrice({ ...base, year: 2015, model: "911 Carrera" }, { rates: {} });
    expect(d.family).toBe("991");
  });
});
