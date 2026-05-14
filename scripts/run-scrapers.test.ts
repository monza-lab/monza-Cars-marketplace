import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("scraper runner Porsche manual profile", () => {
  it("runs the same partial Porsche collection shape as the healthy cron path", () => {
    const source = readFileSync("scripts/run-scrapers.ts", "utf8");
    const porscheBlock = source.match(/id: "porsche",[\s\S]*?timeoutMs: [^\n]+,\n  \}/)?.[0] ?? "";

    expect(porscheBlock).toContain('"--sources=BaT"');
    expect(porscheBlock).toContain('"--maxActivePages=2"');
    expect(porscheBlock).toContain('"--maxEndedPages=0"');
    expect(porscheBlock).toContain('"--noDetails"');
    expect(porscheBlock).toContain('"--timeBudgetMs=240000"');
  });
});
