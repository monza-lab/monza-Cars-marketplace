import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("scraper runner Porsche manual profile", () => {
  it("runs the same partial Porsche collection shape as the healthy cron path", () => {
    const source = readFileSync("scripts/run-scrapers.ts", "utf8");
    const porscheBlock = source.match(/id: "porsche",[\s\S]*?timeoutMs: [^\n]+,\r?\n\s+\}/)?.[0] ?? "";

    expect(porscheBlock).toContain('"--sources=BaT"');
    expect(porscheBlock).toContain('"--maxActivePages=2"');
    expect(porscheBlock).toContain('"--maxEndedPages=0"');
    expect(porscheBlock).toContain('"--noDetails"');
    expect(porscheBlock).toContain('"--timeBudgetMs=240000"');
  });
});

describe("scraper runner enrichment profile", () => {
  it("gives AS24 a larger batch with a shorter delay without changing the script budget", () => {
    const source = readFileSync("scripts/run-scrapers.ts", "utf8");
    const as24Block = source.match(/id: "as24-enrich",[\s\S]*?timeoutMs: [^\n]+,\r?\n\s+\}/)?.[0] ?? "";

    expect(as24Block).toContain('"--limit=800"');
    expect(as24Block).toContain('"--delayMs=1000"');
    expect(as24Block).toContain("timeoutMs: 25 * 60_000");
  });
});
