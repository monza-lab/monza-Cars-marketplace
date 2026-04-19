# Haus Report — Backend Handoff & Deploy Playbook

**Date:** 2026-04-19
**Branch:** `Front-monzaaa` (pushed to `origin`, 38 commits ahead of `main` at time of handoff)
**Owner of FE work:** completed
**Owner of this handoff:** Backend / DevOps

This document is the single source of truth for taking the Haus Report feature from "code on a branch" to "live in production." Read it top-to-bottom once before executing.

---

## 0. TL;DR (2 minutes)

The **Haus Report** is Monza Haus' paid, per-VIN investment report. It:

- Runs objective signal extraction (Gemini 2.5-flash + deterministic parsers) on one Porsche listing
- Adjusts a market baseline Fair Value using 12 curated modifiers with public citations
- Shows evidence per signal + questions for seller for missing signals
- Caches forever per VIN — one user pays to generate, all future paying users hit cache

It also **removes the entire AAA/AA/A investment-grade language** from the free browsing experience.

**To ship it, you need to do 3 things:**

1. Apply 2 Supabase migrations (SQL files are committed)
2. Set 2 env vars in Vercel (`GEMINI_API_KEY`, `GEMINI_MODEL`)
3. Review + merge PR from `Front-monzaaa`

Everything else is code + tests + docs already on the branch.

Design rationale: see `docs/superpowers/specs/2026-04-19-fair-value-signal-extraction-design.md`.
Implementation plan: see `docs/superpowers/plans/2026-04-19-haus-report-fair-value.md`.
Shipping audit: see `docs/superpowers/plans/2026-04-19-haus-report-fair-value-SHIPPING-CHECKLIST.md`.

---

## 1. Pre-deploy checklist

| # | Task | Who | Time | Status |
|---|---|---|---|---|
| 1 | Apply 2 Supabase migrations in dev | BE | 2 min | pending |
| 2 | Smoke-test `/api/analyze` in dev | BE | 5 min | pending |
| 3 | Apply migrations in production Supabase | BE | 2 min | pending |
| 4 | Set `GEMINI_API_KEY` + `GEMINI_MODEL` in Vercel Production & Preview | DevOps | 3 min | pending |
| 5 | Set same in any staging env | DevOps | 2 min | pending |
| 6 | Code review PR | Reviewer | 30–60 min | pending |
| 7 | Merge `Front-monzaaa` → `main` | Reviewer | 1 min | pending |
| 8 | Production smoke-test (see §5) | BE | 10 min | pending |

**Estimated total:** ~90 minutes end-to-end.

---

## 2. Supabase migrations (CRITICAL — apply both, in order)

Both migration files live at: `producto/supabase/migrations/`.

### 2.1 Migration file A — create `listing_signals` table

**File:** `20260419_create_listing_signals.sql`

**What it does:** creates a new append-only log table where one row = one extracted signal per listing. Grouped by `extraction_run_id` so you can trace exactly which run produced which signals.

**Schema:**
```
id                    uuid PK
listing_id            uuid FK → listings(id) ON DELETE CASCADE
extraction_run_id     uuid  — groups signals from same extraction call
signal_key            text  — e.g., "paint_to_sample"
signal_value_json     jsonb — { value_display, name_i18n_key }
evidence_source_type  text  — "listing_text" | "structured_field" | "seller_context" | "external"
evidence_source_ref   text  — e.g., "description_text" or "listings.transmission"
evidence_raw_excerpt  text
evidence_confidence   text  — "high" | "medium" | "low"
extracted_at          timestamptz DEFAULT now()
extraction_version    text  — e.g., "v1.0"
```

Plus: 2 indexes, RLS enabled, policies for read-anyone + service-role-insert.

### 2.2 Migration file B — extend `listing_reports`

**File:** `20260419_extend_listing_reports_haus_report.sql`

**What it does:** adds 9 new columns to the existing `listing_reports` table (idempotent — uses `ADD COLUMN IF NOT EXISTS`).

**New columns:**
```
specific_car_fair_value_low   numeric
specific_car_fair_value_mid   numeric
specific_car_fair_value_high  numeric
comparable_layer_used         text  CHECK IN ('strict','series','family')
comparables_count             integer
modifiers_applied_json        jsonb
modifiers_total_percent       numeric
signals_extracted_at          timestamptz
extraction_version            text
```

**Leave `investment_grade` alone.** Column stays nullable; app code stops writing. A future migration drops it once legacy reports are purged.

### 2.3 How to apply (2 options)

**Option A — Supabase CLI (recommended):**
```bash
cd producto
npx supabase db push
```
This applies any pending migrations in `supabase/migrations/` to the currently-linked project.

**Option B — Supabase Dashboard:**
1. Open dashboard → SQL editor
2. Paste contents of `20260419_create_listing_signals.sql` → Run
3. Paste contents of `20260419_extend_listing_reports_haus_report.sql` → Run

### 2.4 Verification after applying

Run this in the SQL editor:

```sql
-- Verify new table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'listing_signals'
ORDER BY ordinal_position;

-- Expect 11 columns: id, listing_id, extraction_run_id, signal_key, signal_value_json,
--   evidence_source_type, evidence_source_ref, evidence_raw_excerpt,
--   evidence_confidence, extracted_at, extraction_version

-- Verify listing_reports has new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'listing_reports'
  AND column_name IN (
    'specific_car_fair_value_low','specific_car_fair_value_mid','specific_car_fair_value_high',
    'comparable_layer_used','comparables_count','modifiers_applied_json',
    'modifiers_total_percent','signals_extracted_at','extraction_version'
  )
ORDER BY column_name;

-- Expect 9 rows back
```

If either returns fewer rows than expected, **do NOT proceed** — re-run the migration file that's missing.

Do this **in dev first** before production.

---

## 3. Environment variables

### 3.1 Required variables

| Variable | Value | Where |
|---|---|---|
| `GEMINI_API_KEY` | Production key from https://aistudio.google.com/apikey (Monza Haus Google account) | Vercel → Settings → Environment Variables → Production + Preview |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Same — Production + Preview |
| `NEXT_PUBLIC_SUPABASE_URL` | already present | (already set) |
| `SUPABASE_SERVICE_ROLE_KEY` | already present | (already set) |

**CRITICAL:**
- `gemini-2.0-flash` is **deprecated for new accounts** — we validated that `gemini-2.5-flash` works in local. Do NOT use 2.0-flash in prod.
- Set the key for BOTH Production AND Preview environments. Preview is used for PR preview deployments.
- Do NOT commit the key anywhere. `.env.local` is gitignored; never echo the value to logs.

### 3.2 Cost/quota notes

- `gemini-2.5-flash` is very cheap — roughly $0.075 per 1M input tokens. A typical listing extraction is ~3–5K tokens ≈ $0.0004 per Haus Report. Even 10,000 reports/month ≈ $4.
- Reports are **cached per listing**: once generated, future views hit cache. No re-runs unless the cache is invalidated.
- Google AI Studio has free tier — verify we're on a billable project for production, not the free tier, to avoid rate-limit surprises.

### 3.3 After setting vars

Redeploy Preview to pick up the new vars. In Vercel: Deployments → latest Preview → Redeploy. Wait ~2 minutes.

---

## 4. What's on the branch (architecture for review)

### 4.1 Frontend changes (done)

- **Grade removal:** every AAA/AA/A/B+/B/C reference removed from browse cards, feed cards, context panels, mobile rows, landing page, filters, advisor, SEO copy, and the report itself. Replaced with factual metrics (`MarketDeltaPill` = price vs median delta, `Median Sold` price, etc.).
- **New report UI components** at `src/components/report/`:
  - `MarketDeltaPill.tsx` — subtle "−8% vs median" pill (replaces grade badges in free view)
  - `SignalsDetectedSection.tsx` — list of extracted signals with evidence excerpts + source icons
  - `SignalsMissingSection.tsx` — "Data we couldn't verify" list, phrased as questions to ask the seller
  - `ModifiersAppliedList.tsx` — line items with ±% + citation links
  - `HausReportTeaser.tsx` — CTA card on free car detail page inviting to generate the paid report
- **ReportClient refactored** to consume the new `HausReport` TypeScript shape.
- **i18n:** grade keys removed; Haus Report keys added in `messages/{en,es,de,ja}.json` (teaser copy, signal questions, modifier names/descriptions).
- **Mock fixtures** at `src/lib/fairValue/__fixtures__/` for FE QA without backend:
  - `992-gt3-pts-mock.json` (rich, 7 signals, 6 modifiers → +26%)
  - `991-carrera-sparse-mock.json` (sparse, 1 signal, 0 modifiers)
  - Query params on the report page: `?mock=992gt3` or `?mock=sparse`

### 4.2 Backend pipeline (done, needs migrations + env to go live)

Located at `src/lib/fairValue/` + `src/lib/ai/`:

- **Types** (`types.ts`): `HausReport`, `DetectedSignal`, `AppliedModifier`, `MissingSignal`, `SignalEvidence`.
- **Modifier Library** (`modifiers.ts`): v1.0, 12 modifiers with public citations (Hagerty, PCA). Capped ±15% individually, ±35% aggregate.
- **Engine** (`engine.ts`): `applyModifiers` + `computeSpecificCarFairValue`. Pure functions. 9 unit tests passing.
- **Extractors** (`extractors/`):
  - `structured.ts` — deterministic parse of `listings.mileage`, `transmission`, `year`. 4 tests.
  - `seller.ts` — whitelist lookup for 7 specialist dealer domains. 3 tests.
  - `text.ts` — Gemini 2.5-flash call with strict JSON schema. 3 tests (mocked Gemini).
- **Gemini client** (`src/lib/ai/gemini.ts`): thin wrapper over `@google/generative-ai` with `generateJson<T>` method. Handles missing API key gracefully (returns `ok: false` instead of throwing).
- **API orchestrator** (`src/app/api/analyze/route.ts`):
  1. Preserves existing auth + credits gate
  2. Checks `listing_reports` cache (`signals_extracted_at` flag)
  3. Runs 3 extractors in parallel
  4. Applies modifiers → specific fair value
  5. Persists via `saveHausReport` + `saveSignals`
  6. Returns `{ ok, report: HausReport, cached }`
- **DB writers + readers** (`src/lib/reports/queries.ts`):
  - `saveHausReport(listingId, report)` — upserts into `listing_reports`
  - `saveSignals(listingId, runId, version, signals[])` — inserts into `listing_signals`
  - `fetchSignalsForListing(listingId)` — reads signals back
  - `assembleHausReportFromDB(row, signalRows)` — composes `HausReport` from DB rows

### 4.3 Tests

- **Unit tests:** 23 new Haus Report tests, all passing (fairValue engine, extractors, UI components with vitest+jsdom+testing-library).
- **Gemini validation:** 3 regression fixtures at `src/lib/ai/__fixtures__/gemini-signals-{rich,sparse,challenging}.json`, captured from real API calls against 3 production listings. Manually audited for zero hallucination.
- **E2E smoke test:** `tests/e2e/haus-report.spec.ts` — Playwright spec that verifies teaser + paid report rendering. Uses `test.skip` if `TEST_LISTING_ID` env var isn't set, so it commits cleanly without running.

### 4.4 Migrations

- `supabase/migrations/20260419_create_listing_signals.sql`
- `supabase/migrations/20260419_extend_listing_reports_haus_report.sql`

---

## 5. Post-deploy smoke test (run in prod after migrations + env applied)

### 5.1 Backend smoke test

Pick any real Porsche listing ID from production. Then:

```bash
curl -X POST https://monzahaus.com/api/analyze \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth cookie for a paying user>" \
  -d '{"listingId":"<real-uuid>"}'
```

**Expected response shape:**
```json
{
  "ok": true,
  "cached": false,
  "report": {
    "listing_id": "<uuid>",
    "fair_value_low": 180000,
    "fair_value_high": 220000,
    "median_price": 200000,
    "specific_car_fair_value_low": 214000,
    "specific_car_fair_value_mid": 230000,
    "specific_car_fair_value_high": 246000,
    "comparable_layer_used": "strict",
    "comparables_count": 12,
    "signals_detected": [ ... ],
    "signals_missing": [ ... ],
    "modifiers_applied": [ ... ],
    "modifiers_total_percent": 15,
    "signals_extracted_at": "2026-04-19T...",
    "extraction_version": "v1.0"
  }
}
```

If response is `{ ok: false, error: "GEMINI_API_KEY is not configured" }` → env var not set.
If response is 500 with DB error mentioning a missing column → migration didn't apply.

### 5.2 Second-call cache test

Hit the same endpoint again with the same `listingId`:

```bash
curl -X POST ... (same payload) ...
```

**Expected:** `"cached": true`, much faster (<500 ms, no Gemini call). This proves the cache works and the DB write was correct.

### 5.3 UI smoke test

In a browser:

1. Visit any Porsche detail page (e.g., `/en/cars/porsche/<id>`)
   - ✅ Teaser card "Haus Report available" is visible
   - ✅ No AAA/AA/A letters anywhere
2. Click **Generate Haus Report** as a paying user
3. Wait ~5–10s for the extraction, page reloads
4. Verify:
   - ✅ "Specific-Car Fair Value" block shows numeric range
   - ✅ "Signals Detected" section lists 3–10 signals with evidence quotes
   - ✅ "Data we couldn't verify" section lists missing signals as seller questions
   - ✅ Modifiers list shows ±% with "source" links (external citations)
   - ✅ Verdict section shows factual synthesis (not AAA)

### 5.4 DB integrity test

```sql
-- Signals were persisted
SELECT count(*) FROM listing_signals WHERE listing_id = '<uuid>';
-- Expect: > 0 (one row per detected signal)

-- Report was upserted
SELECT
  specific_car_fair_value_mid,
  modifiers_total_percent,
  signals_extracted_at,
  extraction_version,
  jsonb_array_length(modifiers_applied_json) AS modifier_count
FROM listing_reports
WHERE listing_id = '<uuid>';
-- Expect: non-null values, extraction_version = 'v1.0'
```

---

## 6. Known issues / technical debt (non-blocking, ticket before next sprint)

### 6.1 Two modifiers have `citation_url: null`
File: `src/lib/fairValue/modifiers.ts`. `warranty_remaining` and `seller_tier_specialist` lack public citations.
**Action:** content team sources public URLs (Hagerty / PCA / specialist dealer article) OR set their `base_percent: 0` so they don't fire in production.
**Severity:** low — they won't trigger until signals `warranty` or `seller_tier` are extracted, and users only see the modifier if it fires. Worst case: a modifier displays without a "source" link.

### 6.2 Text extractor mapping gap (Task 28 finding)
File: `src/lib/fairValue/extractors/text.ts`. The Gemini prompt extracts more fields than the extractor emits as `DetectedSignal[]`:
- `sport_chrono`, `pccb`, `burmester`, `lwb_seats`, `carbon_roof`, `factory_rear_spoiler_delete`
- `dealer_serviced`, `intervals_respected`
- `matching_numbers_claim`, `garage_kept_claim`, `collector_owned_claim`

These are parsed but not turned into signals. To activate, add `signals.push(...)` blocks in `extractTextSignals` for each, plus corresponding entries in `MODIFIER_LIBRARY` (`modifiers.ts`) + i18n keys.

**Severity:** medium — leaving value on the floor. A 997 GT3 RS with matching numbers + LWB seats should trigger more adjustments than it does today.

### 6.3 `comparable_layer_used` is coarse
`src/app/api/analyze/route.ts` maps `computeMarketStats`'s `"family" → "family"` and `"series"/"model" → "strict"`. The real strict-vs-series distinction isn't surfaced yet.
**Action:** extend `computeMarketStats` to return the actual layer used; pass it through.
**Severity:** low — display-only; doesn't affect fair value math.

### 6.4 DashboardClient residual check
Task 14 did a deep sweep including `DashboardClient.tsx` (self-contained local types). No known issues but worth a visual QA pass on staging.

### 6.5 Playwright testDir
`playwright.config.ts` has `testDir: './agents/testscripts'`; new spec is under `tests/e2e/`. Either adjust `testDir` or invoke explicitly: `npx playwright test tests/e2e/haus-report.spec.ts`.

### 6.6 Legacy `Analysis` table and related routes
The old `Analysis` PostgreSQL table + the legacy grade API mapping still exist (`src/lib/db/queries.ts`, `FilterSidebar.onlyInvestmentGrade` dead toggle, `pricing/page.tsx` marketing copy, `messages/*.json summary.investmentGrade` key). These are out-of-scope for this PR but logged in the shipping checklist.

### 6.7 Dev server vs legacy scraper tests
26 pre-existing test failures in scraper/admin suites (BaT, AutoScout24, AutoTrader, classic collector, liveness-checker, cron/backfill-images, admin/scrapers/live). **These are NOT caused by this work.** Pre-existing baseline. Don't block the PR on them.

---

## 7. Rollback plan

If something goes wrong in production:

### 7.1 Code rollback (fast, seconds)

Revert the merge on Vercel: Dashboard → Deployments → previous green deploy → "Promote to Production." The Vercel UI makes this a one-click action.

### 7.2 DB rollback

**`listing_reports` extensions:** the new columns are nullable and do not break old code. No rollback needed — just stop writing them.

**`listing_signals` table:** dropping it is safe if needed. Any paid report already generated will gracefully degrade (the UI's `SignalsDetectedSection` renders an empty state when `signals_detected: []`).

```sql
-- Emergency only — drops the signal log entirely (cannot be recovered)
DROP TABLE IF EXISTS listing_signals CASCADE;
```

**Do NOT** drop the new columns on `listing_reports` without coordinating — other sessions may still be writing them after a partial rollback. Safer: leave them nullable and stop writing.

### 7.3 Gemini kill switch

If Gemini goes down or starts hallucinating, set `GEMINI_API_KEY` to empty string in Vercel env. The `gemini.ts` client will short-circuit with `{ ok: false }`, the orchestrator will save a `listing_reports` row with `signals_extracted_at: null`, and the UI will render market stats only (teaser says "Signal extraction unavailable — showing market data only").

---

## 8. Expected performance

- **Cache hit (repeat viewer):** <500ms end-to-end
- **Cache miss (first generator):** 5–10s (Gemini call dominates: 3–8s per extraction)
- **Memory footprint:** negligible — pipeline is stateless, runs per-request
- **Unit economics:** one Gemini extraction (~$0.0004) amortized across all paying viewers of that listing. A listing viewed by 10 users = $0.00004 per user.

---

## 9. Escalation / questions

- **Design rationale questions** → read `docs/superpowers/specs/2026-04-19-fair-value-signal-extraction-design.md` (6K-word spec, has Why/How/Tradeoffs for every choice)
- **Implementation step-by-step** → `docs/superpowers/plans/2026-04-19-haus-report-fair-value.md`
- **Shipping audit** → `docs/superpowers/plans/2026-04-19-haus-report-fair-value-SHIPPING-CHECKLIST.md`
- **Live Gemini outputs** (for prompt debugging) → `src/lib/ai/__fixtures__/gemini-signals-*.json`
- **Product decisions** → Edgar

---

## 10. Done criteria (you can mark this PR shipped when…)

- [ ] Migrations applied in prod — verified via §2.4 queries
- [ ] `GEMINI_API_KEY` + `GEMINI_MODEL=gemini-2.5-flash` set in Vercel Production & Preview
- [ ] PR reviewed and approved
- [ ] Merged to `main`
- [ ] Vercel auto-deploy succeeds
- [ ] `/api/analyze` smoke test returns `ok: true` with populated `report` shape
- [ ] Second call returns `cached: true`
- [ ] UI smoke test passes on one real listing — teaser visible, generation works, signals + modifiers + missing all render
- [ ] `listing_signals` has rows; `listing_reports` new columns are populated

Once all 8 are ✅, post in #engineering with the test listing ID used and a screenshot of the rendered report.
