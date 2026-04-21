import { describe, it, expect } from "vitest";
import { DUTY_RULES } from "../duties";

describe("DUTY_RULES", () => {
  it("has entries for all 4 supported countries", () => {
    expect(Object.keys(DUTY_RULES).sort()).toEqual(["DE", "JP", "UK", "US"]);
  });

  it("US has 25-year exemption with 0% rate", () => {
    expect(DUTY_RULES.US.ageExemption).toEqual({
      yearsOld: 25,
      ratePct: 0,
      note: expect.stringContaining("25-year"),
    });
  });

  it("UK has 30-year historic exemption with 5% rate", () => {
    expect(DUTY_RULES.UK.ageExemption).toEqual({
      yearsOld: 30,
      ratePct: 5,
      note: expect.stringContaining("Historic"),
    });
  });

  it("JP has 0% standard rate and no exemption", () => {
    expect(DUTY_RULES.JP.standardRatePct).toBe(0);
    expect(DUTY_RULES.JP.ageExemption).toBeUndefined();
  });

  it("every rule has a source with lastReviewed date", () => {
    for (const rule of Object.values(DUTY_RULES)) {
      expect(rule.source.name).toBeTruthy();
      expect(rule.source.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
