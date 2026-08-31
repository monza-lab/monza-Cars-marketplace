import { describe, expect, it } from "vitest";
import {
  formatMileageForMarket,
  getMileageForMarket,
  toCanonicalMiles,
} from "./mileage";

describe("market-aware mileage", () => {
  it("converts miles to kilometres for EU and JP cards", () => {
    expect(getMileageForMarket(10_000, "mi", "EU")).toEqual({ value: 16_093, unit: "km" });
    expect(getMileageForMarket(10_000, "mi", "JP")).toEqual({ value: 16_093, unit: "km" });
  });

  it("converts kilometres to miles for US and UK cards", () => {
    expect(getMileageForMarket(20_000, "km", "US")).toEqual({ value: 12_427, unit: "mi" });
    expect(getMileageForMarket(20_000, "km", "UK")).toEqual({ value: 12_427, unit: "mi" });
  });

  it("preserves the source unit in mixed or unknown market context", () => {
    expect(getMileageForMarket(1_234, "km", null)).toEqual({ value: 1_234, unit: "km" });
  });

  it("keeps unknown units explicit instead of inventing miles", () => {
    expect(formatMileageForMarket(1_234, null, "US", "en-US")).toBe("1,234 · unit unknown");
  });

  it("normalizes filtering and sorting to canonical miles", () => {
    expect(toCanonicalMiles(10_000, "mi")).toBe(10_000);
    expect(toCanonicalMiles(16_093.44, "km")).toBeCloseTo(10_000);
    expect(toCanonicalMiles(10_000, null)).toBeNull();
  });
});
