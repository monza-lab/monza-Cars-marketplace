import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("listing ranking variant migration", () => {
  it("deduplicates missing-VIN listings with a stable vehicle fingerprint", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260713_add_listing_ranking_variant.sql"),
      "utf8",
    );

    expect(sql).toContain("'fingerprint:'");
    expect(sql).toMatch(/coalesce\(year::text/);
    expect(sql).toMatch(/coalesce\(model/);
    expect(sql).toMatch(/coalesce\(mileage::text/);
    expect(sql).toMatch(/coalesce\(color_exterior/);
  });
});
