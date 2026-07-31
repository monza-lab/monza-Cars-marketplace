import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("listing report intelligence migration", () => {
  it("persists every intelligence payload written by saveHausReport", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20260731_listing_report_intelligence.sql"),
      "utf8",
    )

    expect(sql).toContain("color_intelligence_json jsonb")
    expect(sql).toContain("vin_intelligence_json jsonb")
    expect(sql).toContain("investment_narrative_json jsonb")
  })
})
