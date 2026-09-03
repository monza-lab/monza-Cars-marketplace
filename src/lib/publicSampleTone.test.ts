import { describe, expect, it } from "vitest";
import { sanitizePublicSampleTone } from "./publicSampleTone";

describe("sanitizePublicSampleTone", () => {
  it("removes pressure, superlatives and false percentile claims recursively", () => {
    const clean = sanitizePublicSampleTone({
      verdict: "Act decisively to secure this exceptional asset — an unmissable acquisition.",
      facts: ["This VIN falls in the 0th percentile of variant sold prices in the last 12 months."],
    });
    const text = JSON.stringify(clean);
    expect(text).not.toMatch(/act decisively|secure this exceptional|unmissable|0th percentile/i);
    expect(text).toMatch(/verify condition/i);
    expect(text).toMatch(/verified percentile is unavailable/i);
  });
});
