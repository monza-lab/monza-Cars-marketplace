import { describe, expect, it } from "vitest";

import { resolvePreferredView } from "./viewPreference";

describe("resolvePreferredView", () => {
  it("defaults a visitor without a saved choice to Classic", () => {
    expect(resolvePreferredView(null)).toBe("classic");
  });

  it("preserves an explicit saved marketplace choice", () => {
    expect(resolvePreferredView("monza")).toBe("monza");
    expect(resolvePreferredView("classic")).toBe("classic");
  });
});
