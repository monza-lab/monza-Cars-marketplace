import { describe, expect, it } from "vitest";

import { derivePerSourceLimit } from "./limits";

describe("mock-auctions derivePerSourceLimit", () => {
  it("splits a global limit across all canonical sources", () => {
    expect(derivePerSourceLimit(2000)).toBe(334);
    expect(derivePerSourceLimit(24)).toBe(4);
    expect(derivePerSourceLimit(6)).toBe(1);
  });

  it("guards invalid values with a safe minimum", () => {
    expect(derivePerSourceLimit(0)).toBe(1);
    expect(derivePerSourceLimit(-10)).toBe(1);
    expect(derivePerSourceLimit(Number.NaN)).toBe(4);
    expect(derivePerSourceLimit(100, 0)).toBe(100);
  });
});
