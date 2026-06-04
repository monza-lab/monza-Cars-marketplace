import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260423_pistons_economy.sql"),
  "utf8",
)

describe("pistons economy migration", () => {
  it("does not special-case advisor usage into zero-amount ledger rows", () => {
    expect(migration).not.toMatch(/p_type\s*=\s*'ADVISOR_INSTANT'[\s\S]*?v_signed_amount\s*:=\s*0/)
    expect(migration).toMatch(/v_signed_amount\s*:=\s*-p_amount/)
  })
})
