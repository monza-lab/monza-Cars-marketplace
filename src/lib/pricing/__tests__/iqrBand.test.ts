import { describe, it, expect } from "vitest";
import { iqrBand } from "../iqrBand";

describe("iqrBand", () => {
  it("returns null below n=8", () => {
    expect(iqrBand([])).toBeNull();
    expect(iqrBand([1, 2, 3, 4, 5, 6, 7])).toBeNull();
  });

  it("returns median p25 p75 for 8+ values", () => {
    const vs = [10, 20, 30, 40, 50, 60, 70, 80];
    const b = iqrBand(vs)!;
    expect(b.p50).toBe(45);
    expect(b.p25).toBeLessThan(b.p50);
    expect(b.p75).toBeGreaterThan(b.p50);
  });

  it("is resilient to outliers via Tukey fence", () => {
    const vs = [10, 20, 30, 40, 50, 60, 70, 80, 10_000_000];
    const b = iqrBand(vs)!;
    expect(b.p75).toBeLessThan(100);
  });
});
