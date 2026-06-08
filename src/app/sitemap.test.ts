import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("includes homepage for the published English locale", () => {
    const entries = sitemap();
    const homeUrls = entries
      .filter((e) => /\/(en|es|de|ja)$/.test(e.url))
      .map((e) => e.url);
    expect(homeUrls).toEqual(["https://monzalab.com/en"]);
  });

  it("every entry with alternates includes x-default", () => {
    const entries = sitemap();
    for (const entry of entries) {
      if (entry.alternates?.languages) {
        expect(entry.alternates.languages).toHaveProperty("x-default");
      }
    }
  });

  it("Porsche series URLs are present for the published English locale", () => {
    const entries = sitemap();
    const porsche992 = entries.filter((e) => e.url.includes("series=992"));
    expect(porsche992).toHaveLength(1);
    expect(porsche992[0]?.url).toBe("https://monzalab.com/en/cars/porsche?series=992");
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

  it("publishes index hub URLs under /indices", () => {
    const entries = sitemap();
    const hub = entries.find((e) => e.url.endsWith("/en/indices"));
    expect(hub).toBeDefined();
    expect(entries.some((e) => e.url.includes("/en/index"))).toBe(false);
  });
});
