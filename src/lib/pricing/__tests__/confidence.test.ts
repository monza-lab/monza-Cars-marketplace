import { describe, it, expect } from "vitest";
import { classifySoldTier, classifyAskingTier } from "../confidence";

describe("classifySoldTier", () => {
  it("high at 20+", () => {
    expect(classifySoldTier(20)).toBe("high");
    expect(classifySoldTier(500)).toBe("high");
  });
  it("medium 8-19", () => {
    expect(classifySoldTier(8)).toBe("medium");
    expect(classifySoldTier(19)).toBe("medium");
  });
  it("low 1-7", () => {
    expect(classifySoldTier(1)).toBe("low");
    expect(classifySoldTier(7)).toBe("low");
  });
  it("insufficient at 0", () => {
    expect(classifySoldTier(0)).toBe("insufficient");
  });
});

describe("classifyAskingTier", () => {
  it("high requires 200+ AND factor measured", () => {
    expect(classifyAskingTier(200, "family")).toBe("high");
    expect(classifyAskingTier(200, "porsche_wide")).toBe("medium");
  });
  it("medium 50-199 OR porsche-wide factor", () => {
    expect(classifyAskingTier(50, "family")).toBe("medium");
    expect(classifyAskingTier(199, "family")).toBe("medium");
    expect(classifyAskingTier(500, "porsche_wide")).toBe("medium");
  });
  it("low below 50", () => {
    expect(classifyAskingTier(49, "family")).toBe("low");
    expect(classifyAskingTier(1, "none")).toBe("low");
  });
  it("insufficient at 0", () => {
    expect(classifyAskingTier(0, "family")).toBe("insufficient");
    expect(classifyAskingTier(0, "none")).toBe("insufficient");
  });
});
