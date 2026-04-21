import { describe, it, expect } from "vitest";
import { fromUsd } from "../exchangeRates";

describe("fromUsd", () => {
  const rates = { EUR: 0.92, GBP: 0.78, JPY: 155, USD: 1 };

  it("converts 1000 USD → 920 EUR at rate 0.92", () => {
    expect(fromUsd(1000, "EUR", rates)).toBe(920);
  });

  it("converts 1000 USD → 780 GBP at rate 0.78", () => {
    expect(fromUsd(1000, "GBP", rates)).toBe(780);
  });

  it("returns amount unchanged for USD target", () => {
    expect(fromUsd(1234, "USD", rates)).toBe(1234);
  });

  it("returns amount unchanged when currency missing from rates", () => {
    expect(fromUsd(1000, "XYZ", rates)).toBe(1000);
  });

  it("returns amount unchanged when currency is null", () => {
    expect(fromUsd(1000, null, rates)).toBe(1000);
  });

  it("handles lowercase currency codes", () => {
    expect(fromUsd(1000, "eur", rates)).toBe(920);
  });
});
