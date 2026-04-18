import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("includes homepage for all 4 locales", () => {
    const entries = sitemap();
    const homeUrls = entries
      .filter((e) => /\/(en|es|de|ja)$/.test(e.url))
      .map((e) => e.url);
    expect(homeUrls).toHaveLength(4);
  });

  it("every entry with alternates includes x-default", () => {
    const entries = sitemap();
    for (const entry of entries) {
      if (entry.alternates?.languages) {
        expect(entry.alternates.languages).toHaveProperty("x-default");
      }
    }
  });

  it("Porsche series URLs are present for all locales", () => {
    const entries = sitemap();
    const porsche992 = entries.filter((e) => e.url.includes("series=992"));
    expect(porsche992.length).toBe(4);
  });

  it("priorities are valid (0.0-1.0)", () => {
    const entries = sitemap();
    for (const entry of entries) {
      if (entry.priority !== undefined) {
        expect(entry.priority).toBeGreaterThanOrEqual(0);
        expect(entry.priority).toBeLessThanOrEqual(1);
      }
    }
  });

  it("homepage has highest priority", () => {
    const entries = sitemap();
    const home = entries.find((e) => e.url.endsWith("/en"));
    expect(home?.priority).toBe(1.0);
  });
});
