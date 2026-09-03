import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("pricing copy", () => {
  it("leads with reports and contains no unverified PPI/PPS price claims in any locale", () => {
    for (const locale of ["en", "de", "es", "ja"]) {
      const messages = JSON.parse(readFileSync(resolve(process.cwd(), `messages/${locale}.json`), "utf8"));
      expect(JSON.stringify(messages.pricing)).not.toMatch(/PPI|PPS|\$400|\$250/);
    }
    const english = JSON.parse(readFileSync(resolve(process.cwd(), "messages/en.json"), "utf8"));
    expect(english.pricing.heroTitle).toMatch(/Haus Reports/i);
    expect(english.pricing.heroSubtitle).toMatch(/report/i);
    expect(english.auth.buyCredits).toMatch(/reports/i);
  });
});
