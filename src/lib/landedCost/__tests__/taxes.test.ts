import { describe, it, expect } from "vitest";
import { TAX_RULES } from "../taxes";

describe("TAX_RULES", () => {
  it("has entries for all 4 supported countries", () => {
    expect(Object.keys(TAX_RULES).sort()).toEqual(["DE", "JP", "UK", "US"]);
  });

  it("DE has 19% VAT with historic reduction to 7%", () => {
    expect(TAX_RULES.DE.ratePct).toBe(19);
    expect(TAX_RULES.DE.ageReductionPct).toEqual({
      yearsOld: 30,
      ratePct: 7,
      note: expect.stringContaining("Historic"),
    });
  });

  it("UK has 20% VAT with historic reduction to 5%", () => {
    expect(TAX_RULES.UK.ratePct).toBe(20);
    expect(TAX_RULES.UK.ageReductionPct?.ratePct).toBe(5);
  });

  it("US has no age reduction", () => {
    expect(TAX_RULES.US.ageReductionPct).toBeUndefined();
  });

  it("every rule has a label and source", () => {
    for (const rule of Object.values(TAX_RULES)) {
      expect(rule.label).toBeTruthy();
      expect(rule.source.name).toBeTruthy();
    }
  });
});
