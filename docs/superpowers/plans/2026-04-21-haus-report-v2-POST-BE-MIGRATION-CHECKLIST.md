# Haus Report v2 — Post BE-Migration Smoke Test Checklist

**For:** Backend engineer (and FE on-call)
**When:** After you've applied the 3 migrations + env var + bucket from
`2026-04-21-haus-report-v2-BACKEND-HANDOFF.md`.

The Haus Report v2 front-end was shipped **defensively** — everything works
before and after the BE migration. These checks confirm that after your
migrations, the features light up as expected.

**No front-end redeploy is required for any of these checks.** If something
doesn't flip, the front-end is not the source — investigate the migration.

---

## 1. `listing_reports` new columns are active

Generate a fresh Haus Report (online) for any listing, then query Supabase:

```sql
SELECT listing_id, report_hash, tier, version, updated_at
FROM listing_reports
WHERE report_hash IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;
```

Expected:
- `report_hash` is a 64-char lowercase hex string.
- `tier` is `'tier_1'` (v2 launches with Tier 1 only; Tier 2/3 roll out later).
- `version` is a positive integer. If the same listing is regenerated,
  version increments by 1 each time.

Also in the API response for a fresh generation, the JSON should include:
```json
{
  "report_hash": "…64 chars…",
  "tier": "tier_1",
  "report_version": 1,
  "v2_metadata_persisted": true
}
```

Before migration: `v2_metadata_persisted` is `false` and `report_hash` is
still returned (computed, just not persisted). After migration: `true`.

---

## 2. `/verify/[hash]` route flips from "coming soon" to real resolution

**Before migration** (known good behavior):
- `GET /verify/abc123` → "Verification is coming soon" page (HTTP 200).

**After migration:**

1. Take a real `report_hash` from a `listing_reports` row.
2. Hit `GET /verify/{that_hash}` — should show the verified banner + car
   identity + fair value range + hash.
3. Hit `GET /verify/abc123` (random hash) — should show "hash does not
   match any published Haus Report" page (HTTP 200, not 404).

---

## 3. Storage bucket `exports` is writable

Generate a PDF via `GET /api/reports/{listing_id}/pdf`.

The response now carries header `X-Report-Hash: {64-char-hash}`.

Check Supabase Storage → `exports` bucket:
```
exports/
  {hash}/
    report.pdf
```

Same for Excel: `GET /api/reports/{listing_id}/excel` → `exports/{hash}/report.xlsx`.

On second download for the same report, the route should redirect to a
signed URL (check with `curl -I` — expect HTTP 307 with a `Location:` header
pointing at `{supabase-storage-host}/...`). That confirms the cache path is
live. **Before bucket creation: the route streams the file directly each
time (HTTP 200 with the binary body), no redirect.**

---

## 4. `variant_knowledge` table is queryable

Editorial team should be able to INSERT rows manually (service role):

```sql
INSERT INTO variant_knowledge (
  variant_key, claim_text, source_type, source_ref,
  source_capture_date, confidence, tags, created_by
) VALUES (
  'porsche_992_gt3_touring',
  'PTS Y5C represents ~12% of 992 GT3 order book in 2023',
  'editorial_curation',
  'https://www.rennlist.com/example',
  '2026-04-01',
  'medium',
  ARRAY['pts_rarity','option_rarity'],
  'monza_editorial'
);
```

The FE `variantKB` query layer reads from this table. Today it uses an
in-memory test registry (no Supabase integration until the BE-read path
is wired). That wiring is post-v2 work, but the table should exist and
accept writes now so editorial can begin seeding.

---

## 5. End-to-end integration

With everything migrated:

1. Open a listing detail page, generate a Haus Report.
2. API response has `v2_metadata_persisted: true`.
3. Add `?v2=1` to the report URL → new mobile-first UI renders.
4. Click Download → get a real PDF with 6 pages and a footer hash.
5. Open the Excel → 4 sheets, blue cells editable, formulas live.
6. Copy the `report_hash` from the API response, visit `/verify/{hash}`.
   Should show "Verified authentic".
7. Copy any other random hash, visit `/verify/{random}` — should show
   "does not match" without 500-ing.

If all 7 pass, Haus Report v2 is production-live end to end.

---

## Known caveats

- **Tier detection is not wired to a real plan.** All reports today are
  `tier: "tier_1"`. When monthly subscription shipping lands, extend the
  orchestrator to detect subscriber status and pass the appropriate tier to
  `adaptV1ReportToV2` / `generateRemarkable`. This is a separate feature,
  not blocking v2 launch.
- **Specialist agents are scaffolded but empty.** Tier 3 render path exists
  (the UI handles specialist claims) but `src/lib/specialistAgents/registry.ts`
  has zero registered agents. Each variant agent is its own delivery.
- **Reference pack** is in-memory registry only. Editorial team can insert
  into `variant_knowledge` today, but loader.ts does not yet read from
  Supabase. Post-v2 wiring.
- **`?v2=1` query param** gates the new UI. Flip the default in
  `src/app/[locale]/cars/[make]/[id]/report/page.tsx` once you're confident
  in production — search for `resolvedSearch.v2 === "1"`.

---

## Escalation

If a check fails:
- Column/table error → BE migration didn't land. Re-run from
  `BACKEND-HANDOFF.md`.
- Storage 403 / permission error → bucket is public instead of private, or
  service-role key is missing in Vercel env.
- `/verify/` route 404 → `src/proxy.ts` hasn't shipped the bypass.
  Double-check the FE branch has commit adding `pathname.startsWith('/verify/')`
  to the bypass list.
