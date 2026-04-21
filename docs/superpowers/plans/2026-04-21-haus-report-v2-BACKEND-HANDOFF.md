# Haus Report v2 — Backend Handoff

**Date:** 2026-04-21
**For:** Backend engineer
**Source of truth spec:** `docs/superpowers/specs/2026-04-21-haus-report-v2-design.md`
**Front-end plan (FYI, not your concern):** `docs/superpowers/plans/2026-04-21-haus-report-v2.md`

Your work is **3 migrations + 1 env var + 1 storage bucket + smoke test**. Can run fully in parallel with front-end work on branch `reporte`. Do NOT commit to `reporte` — use your own branch (e.g., `reporte-backend`) and merge on your own schedule.

---

## What you're NOT doing

- Front-end rewrites (UI, components, layout) → lives on `reporte`
- PDF/Excel generation code → lives on `reporte` (Next.js API routes)
- Orchestrator `/api/analyze` rewrite → lives on `reporte`
- Specialist agent implementations → post-v2, separate scope

**Your job is infrastructure.** Provide the schema shape and storage the front-end expects, then the front-end (and later specialist agents) plug into it.

---

## Scope checklist

- [ ] Set 1 env var in Vercel (Production + Preview)
- [ ] Migration 1: create `variant_knowledge` table
- [ ] Migration 2: extend `listing_reports` with `report_hash`, `tier`, `version`
- [ ] Storage bucket `exports` created (private, signed URLs)
- [ ] Smoke test passes
- [ ] Ping front-end dev when done

---

## Environment variables

### Existing (confirm still set from v1 handoff)

- `GEMINI_API_KEY` — Gemini 2.5-flash API key
- `GEMINI_MODEL=gemini-2.5-flash`

**Important:** All product LLM calls go through Gemini. Never Claude/Anthropic in product paths. If you see `@anthropic-ai/sdk` imports in product code (not scripts/internal tools), flag them.

### New for v2

- `SUPABASE_STORAGE_EXPORTS_BUCKET=exports`

Add this in Vercel → Project Settings → Environment Variables. Set for both **Production** and **Preview** environments.

---

## Migration 1 — `variant_knowledge` table

**Purpose:** Accumulative knowledge base per Porsche variant. Populated by editorial curation (Monza Haus team writes entries manually) and specialist agents (post-v2). Consumed by the "What's Remarkable" block of Tier 2+ reports.

**File:** `supabase/migrations/20260421_create_variant_knowledge.sql`

```sql
CREATE TABLE variant_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_key TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('editorial_curation', 'specialist_agent', 'external_verified')),
  source_ref TEXT NOT NULL,
  source_capture_date DATE NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verification_method TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  tags TEXT[] DEFAULT '{}',
  supersedes UUID REFERENCES variant_knowledge(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variant_knowledge_variant_key ON variant_knowledge(variant_key);
CREATE INDEX idx_variant_knowledge_tags ON variant_knowledge USING GIN(tags);
CREATE INDEX idx_variant_knowledge_supersedes ON variant_knowledge(supersedes) WHERE supersedes IS NOT NULL;

-- RLS: read-only public, writes via service role only
ALTER TABLE variant_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "variant_knowledge_read_all" ON variant_knowledge
  FOR SELECT
  USING (true);
-- No INSERT/UPDATE/DELETE policies = implicit deny for anon/authenticated roles.
-- Writes happen via service_role key from backend jobs and editorial admin tools.
```

**Schema notes:**
- `variant_key` convention: `{make}_{model}_{variant}`, lowercase, underscores. E.g., `porsche_992_gt3_touring`, `porsche_993_turbo`. Match the slug the front-end computes from `CollectorCar` in `deriveVariantKey()`.
- `source_type` values are enum — do not add new values without updating the front-end types in `src/lib/variantKB/types.ts`.
- `supersedes` chain: when a new entry supersedes an old one, set `supersedes = old_id`. The front-end query filters out superseded entries so only the latest claim per topic surfaces.
- RLS is minimal on purpose for v1 — adjust if your org has stricter standards. Front-end only reads; no write path from client.

---

## Migration 2 — Extend `listing_reports`

**Purpose:** Each report snapshot gets a deterministic SHA256 hash (for the `/verify/{hash}` public anti-forge route), a tier (tier_1/tier_2/tier_3 — what content depth was generated), and a version (per-VIN version history as users regenerate).

**File:** `supabase/migrations/20260421_extend_listing_reports_v2.sql`

```sql
ALTER TABLE listing_reports
  ADD COLUMN IF NOT EXISTS report_hash TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('tier_1', 'tier_2', 'tier_3')),
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_reports_hash
  ON listing_reports(report_hash)
  WHERE report_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listing_reports_tier ON listing_reports(tier);
```

**Why UNIQUE on `report_hash` (partial):**
- The hash is deterministic over the normalized report JSON. Two regenerations with identical inputs produce the same hash.
- `UNIQUE` prevents duplicate storage for identical snapshots.
- Partial (`WHERE report_hash IS NOT NULL`) tolerates legacy v1 rows that pre-date the column.

**Backfill:** Not required. v1 rows keep `report_hash = NULL` and `tier = NULL` — those are legacy. New rows written by the v2 orchestrator always set all three columns.

---

## Migration 3 — Storage bucket `exports`

**Purpose:** Persist server-generated PDFs and Excel files by `report_hash`. Structure:
```
exports/
  {report_hash}/
    report.pdf
    report.xlsx
```

The front-end's `src/lib/exports/storage.ts` writes to this path and returns signed URLs for download.

**Recommended: create via Supabase Dashboard**

1. Dashboard → Storage → New bucket
2. **Name:** `exports`
3. **Public bucket:** NO (private)
4. **File size limit:** 10 MB (per file)
5. **Allowed MIME types:** `application/pdf`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
6. Save

**Access policy:**
- Service role: full access (front-end server routes use this)
- Anon/authenticated: no direct access — downloads happen via signed URLs generated server-side

If you prefer SQL for bucket creation:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;
```

---

## Order of application

Recommended sequence (non-blocking between steps 2–4):

1. **Set env var** (Vercel dashboard) — instant
2. **Apply Migration 2** (extend `listing_reports`) — non-breaking, just adds nullable columns
3. **Apply Migration 1** (create `variant_knowledge`) — new table, zero impact on existing flows
4. **Create storage bucket** (Dashboard or SQL)
5. **Run smoke test** (below)

No deploy of application code needed from your side — the front-end dev handles the `reporte` branch merge.

---

## Smoke test

After all 5 items are in place, run:

```sql
-- 1. variant_knowledge exists and is queryable
SELECT COUNT(*) FROM variant_knowledge;
-- Expected: 0 (empty table)

-- 2. variant_knowledge indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'variant_knowledge';
-- Expected: at least idx_variant_knowledge_variant_key, idx_variant_knowledge_tags, idx_variant_knowledge_supersedes

-- 3. listing_reports has new columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'listing_reports'
  AND column_name IN ('report_hash', 'tier', 'version');
-- Expected: 3 rows

-- 4. Storage bucket exists
SELECT id, name, public FROM storage.buckets WHERE id = 'exports';
-- Expected: 1 row with public = false
```

Env var check:
```bash
# From your Vercel CLI, or via dashboard
vercel env ls | grep SUPABASE_STORAGE_EXPORTS_BUCKET
# Expected: both production and preview environments show the var
```

---

## When you're done

Reply on the PR thread (or ping on Slack) with:

- ✅ Env var set in Production + Preview
- ✅ Migration 1 applied
- ✅ Migration 2 applied
- ✅ Bucket `exports` created
- ✅ Smoke test green

Front-end is completing Phases 4–6 of the implementation plan. PDF/Excel download routes hit Supabase Storage; if the `exports` bucket is missing, those routes will return 500. So please prioritize the bucket.

---

## Questions / edge cases

- **Why not make `variant_knowledge` writable by authenticated users?** Editorial quality control. Writes come from Monza Haus editorial (via admin tool later) and specialist agents (via service role). No user-facing write path.
- **Why `UNIQUE` on hash instead of composite key with listing_id?** The hash IS the identity — two different listings can never produce the same hash (listing_id is part of the hashed payload), so uniqueness is sufficient.
- **What if a report_hash collision happens?** SHA256 collisions are cryptographically infeasible. If it ever happens, the UNIQUE constraint protects data integrity; the API returns an error and the user retries. Zero practical risk.
- **Retention policy on `exports` bucket?** Not set in v1. Files persist indefinitely. If storage cost becomes an issue, revisit after 6 months of data.
- **Need Gemini API quota increase?** Monitor usage as Tier 2+ adoption grows. Gemini 2.5-flash is cheap but bulk extraction can add up. Alert at 80% of current quota.

Anything unclear — raise before applying to production. The spec `docs/superpowers/specs/2026-04-21-haus-report-v2-design.md` §4, §7, §13 has deeper context.
