import { describe, expect, it } from "vitest";

import { nextConvergence, shouldStop } from "./convergence";

describe("convergence stop rule", () => {
  it("stops after configured zero-new streak", () => {
    let state = { consecutiveZeroNew: 0, totalNew: 0 };
    state = nextConvergence(state, 4);
    expect(shouldStop(state, 2)).toBe(false);
    state = nextConvergence(state, 0);
    expect(shouldStop(state, 2)).toBe(false);
    state = nextConvergence(state, 0);
    expect(shouldStop(state, 2)).toBe(true);
  });
});
