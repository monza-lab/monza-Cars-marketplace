import { describe, it, expect, beforeEach } from "vitest";
import { getFamilyFactor, _setTableForTest } from "../familyFactor";

describe("getFamilyFactor", () => {
  beforeEach(() => {
    _setTableForTest({
      porscheWide: { factor: 0.9, soldN: 1000, askingN: 5000 },
      byFamily: {
        "992": { family: "992", factor: 0.92, soldN: 150, askingN: 2800 },
        "rare": { family: "rare", factor: 0.7, soldN: 5, askingN: 20 },
      },
      generatedAt: "2026-04-18T00:00:00Z",
    });
  });

  it("returns family factor when soldN >= 30", () => {
    const r = getFamilyFactor("992");
    expect(r.factor).toBe(0.92);
    expect(r.source).toBe("family");
  });

  it("falls back to porsche-wide when soldN < 30", () => {
    const r = getFamilyFactor("rare");
    expect(r.factor).toBe(0.9);
    expect(r.source).toBe("porsche_wide");
  });

  it("falls back to porsche-wide when family unknown", () => {
    const r = getFamilyFactor("unknown-family");
    expect(r.factor).toBe(0.9);
    expect(r.source).toBe("porsche_wide");
  });

  it("returns none source when porsche-wide also lacks data", () => {
    _setTableForTest({
      porscheWide: { factor: 0.9, soldN: 0, askingN: 0 },
      byFamily: {},
      generatedAt: "1970-01-01T00:00:00Z",
    });
    const r = getFamilyFactor("992");
    expect(r.source).toBe("none");
  });
});
