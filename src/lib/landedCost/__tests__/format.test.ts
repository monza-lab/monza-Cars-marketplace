import { describe, it, expect } from "vitest";
import { formatLandedCost, formatPoint } from "../format";

describe("formatLandedCost", () => {
  it("formats a USD range", () => {
    expect(
      formatLandedCost({ min: 95000, max: 99900, currency: "USD" }, "en-US"),
    ).toBe("$95,000 – $99,900");
  });
  it("formats an EUR range with EUR locale", () => {
    const out = formatLandedCost(
      { min: 82400, max: 91200, currency: "EUR" },
      "de-DE",
    );
    expect(out).toMatch(/82[.,]400/);
    expect(out).toMatch(/91[.,]200/);
  });
  it("formats JPY with no decimals", () => {
    const out = formatLandedCost(
      { min: 12000000, max: 15000000, currency: "JPY" },
      "ja-JP",
    );
    expect(out).toContain("12,000,000");
  });
});

describe("formatPoint", () => {
  it("formats a point value with tilde prefix", () => {
    expect(formatPoint(97600, "USD", "en-US")).toBe("~$97,600");
  });
  it("formats EUR point", () => {
    const out = formatPoint(86800, "EUR", "de-DE");
    expect(out.startsWith("~")).toBe(true);
    expect(out).toMatch(/86[.,]800/);
  });
});
