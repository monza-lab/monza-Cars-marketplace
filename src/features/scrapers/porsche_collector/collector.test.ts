import { describe, expect, it } from "vitest";

import { createCollectorTimeBudget, isCollectorTimeBudgetExhausted } from "./collector";

describe("porsche collector time budget", () => {
  it("uses one deadline across all sources", () => {
    const budget = createCollectorTimeBudget(1_000, 25_000);

    expect(isCollectorTimeBudgetExhausted(budget, 10_000, 15_000)).toBe(false);
    expect(isCollectorTimeBudgetExhausted(budget, 11_001, 15_000)).toBe(true);
  });

  it("does not expire when no budget is configured", () => {
    const budget = createCollectorTimeBudget(1_000, undefined);

    expect(isCollectorTimeBudgetExhausted(budget, 1_000_000, 15_000)).toBe(false);
  });
});
