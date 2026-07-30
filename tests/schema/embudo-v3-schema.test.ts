import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const path = join(process.cwd(), "supabase/migrations/20260716_embudo_v3_report_leads.sql")
const scraperStatePath = join(process.cwd(), "supabase/migrations/20260722_secure_scraper_state.sql")

describe("embudo v3 schema", () => {
  it("defines the lead, report access, abuse, and analytics contracts", () => {
    const sql = readFileSync(path, "utf8")
    for (const table of [
      "report_leads",
      "report_lead_reports",
      "report_access_tokens",
      "report_request_attempts",
      "analytics_events",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
    }
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS gclid text/)
    expect(sql).toMatch(/token_hash text NOT NULL UNIQUE/)
    expect(sql).toMatch(/revoked_at timestamptz/)
    expect(sql).toMatch(/claim_reminder_sent_at timestamptz/)
    expect(sql).toMatch(/UNIQUE \(lead_id, listing_id\)/)
    expect(sql).toMatch(/analytics_events_created_at_idx/)
    expect(sql).toMatch(/report_request_attempts_ip_created_idx/)
  })

  it("restricts scraper state to the service role", () => {
    const sql = readFileSync(scraperStatePath, "utf8")

    expect(sql).toMatch(/ALTER TABLE public\.scraper_state ENABLE ROW LEVEL SECURITY/i)
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.scraper_state FROM anon, authenticated/i)
    expect(sql).toMatch(/TO service_role/i)
    expect(sql).toMatch(/auth\.role\(\) = 'service_role'/i)
  })
})
