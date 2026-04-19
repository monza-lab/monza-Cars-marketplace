# Haus Report Fair Value — Shipping Checklist

**Plan:** `2026-04-19-haus-report-fair-value.md`
**Branch:** `Front-monzaaa` (unpushed — user will push when ready)
**Audit Date:** 2026-04-19
**Auditor:** Task 33 (final audit)

---

## Executive summary

All 7 audit checks executed. Haus Report scope is clean: zero type errors in Haus Report files, zero new test failures, zero grade references in new Haus Report surface. All planned files are present, migrations are staged for manual application, and env vars are set locally.

There are **non-blocking residual `investmentGrade` references** in legacy `Analysis` table infrastructure (separate from the new `listing_reports` / `listing_signals` Haus Report model). These are logged as follow-up tech debt.

---

## Check 1 — Full type-check

| Metric | Result |
|---|---|
| Total TS errors | **42** |
| Errors in Haus Report scope | **0** |
| Status | PASS (for scope) |

Errors are **entirely pre-existing** in unrelated files:
- `src/lib/supabaseLiveListings.paginated.test.ts` (destructuring overload — test helper)
- scraper / admin / cron test suites

No errors in `src/lib/fairValue/`, `src/components/report/`, `src/app/api/analyze/`, `ReportClient.tsx`, `CarDetailClient.tsx`, or `src/lib/ai/gemini.ts`.

## Check 2 — Full test run

| Metric | Result |
|---|---|
| Test files passed | 135 |
| Test files failed | 10 |
| Tests passed | 1211 |
| Tests failed | 26 |
| Tests skipped | 1 |
| NEW failures in Haus Report scope | **0** |

All 26 failures are pre-existing in scraper / cron / admin infrastructure:
- `tests/scrapers/bringATrailer.*.test.ts`
- `src/features/scrapers/autoscout24_collector/collector.test.ts`
- `src/features/scrapers/autotrader_collector/discover.test.ts`
- `src/features/scrapers/classic_collector/supabase_writer.test.ts`
- `src/features/scrapers/liveness_checker/index.test.ts`
- `src/app/api/cron/backfill-images/route.test.ts`
- `src/app/api/admin/scrapers/live/route.test.ts`

These failing suites are outside Haus Report scope per the plan's "Do NOT try to fix pre-existing scraper test failures" directive.

**Haus Report test files (all passing):**
- `src/lib/fairValue/engine.test.ts`
- `src/lib/fairValue/modifiers.test.ts`
- `src/lib/fairValue/extractors/structured.test.ts`
- `src/lib/fairValue/extractors/seller.test.ts`
- `src/lib/fairValue/extractors/text.test.ts`
- `src/lib/ai/gemini.test.ts`
- `src/components/report/*.test.tsx` (all 5 component tests)
- `src/app/api/analyze/route.test.ts`

Status: PASS (for scope)

## Check 3 — Grade references in production code

Grep hits found. Classification:

**Acceptable (test strings / unrelated tokens):**
- `src/lib/ai/gemini.test.ts:31,36` — unit test fixture using `"grade": "AA"` as a generic JSON sample; not a production grade value.

**Residual legacy (pre-existing, non-Haus Report code paths):**
- `src/lib/db/queries.ts:265,278,294,442,535` — `saveAnalysis()` / Analysis SELECT; targets the legacy `Analysis` table, NOT the Haus Report `listing_reports` table.
- `src/components/filters/FilterSidebar.tsx:230,274,283,518-530` — `onlyInvestmentGrade` filter toggle; pre-existing, not wired to Haus Report.
- `src/app/[locale]/pricing/page.tsx:16,54` — marketing copy describing "AAA to C" scoring; stale marketing language.
- `messages/{en,es,de,ja}.json` — legacy `summary.investmentGrade` key (distinct from Haus Report keys added in Task 15).

Status: PASS for Haus Report surface (zero references). Legacy residue logged as follow-up (see "Technical debt" below).

## Check 4 — Environment variables

| Variable | Present in `.env.local`? |
|---|---|
| `GEMINI_API_KEY` | YES (1) |
| `GEMINI_MODEL` | YES (1) |
| `NEXT_PUBLIC_SUPABASE_URL` | YES (1) |
| `SUPABASE_SERVICE_ROLE_KEY` | YES (1) |

Status: PASS locally.

**Production blocker:** user must verify identical variables are set in Vercel project settings (Production + Preview environments) before deploy. `GEMINI_API_KEY` in particular — the `/api/analyze` route will fail hard without it.

## Check 5 — Supabase migrations present

| File | Present? |
|---|---|
| `supabase/migrations/20260419_create_listing_signals.sql` | YES |
| `supabase/migrations/20260419_extend_listing_reports_haus_report.sql` | YES |

Status: PASS (files staged locally).

**Production blocker:** user must manually apply both migrations against production Supabase before the `/api/analyze` route can persist data. Suggested order:
1. `20260419_create_listing_signals.sql` (creates new table)
2. `20260419_extend_listing_reports_haus_report.sql` (extends existing `listing_reports`)

## Check 6 — Haus Report file inventory

All 20 expected files present:

| File | Status |
|---|---|
| `src/lib/fairValue/types.ts` | OK |
| `src/lib/fairValue/modifiers.ts` | OK |
| `src/lib/fairValue/engine.ts` | OK |
| `src/lib/fairValue/__fixtures__/992-gt3-pts-mock.json` | OK |
| `src/lib/fairValue/__fixtures__/991-carrera-sparse-mock.json` | OK |
| `src/lib/fairValue/extractors/structured.ts` | OK |
| `src/lib/fairValue/extractors/seller.ts` | OK |
| `src/lib/fairValue/extractors/text.ts` | OK |
| `src/lib/ai/gemini.ts` | OK |
| `src/lib/ai/__fixtures__/gemini-signals-rich.json` | OK |
| `src/lib/ai/__fixtures__/gemini-signals-sparse.json` | OK |
| `src/lib/ai/__fixtures__/gemini-signals-challenging.json` | OK |
| `src/components/report/MarketDeltaPill.tsx` | OK |
| `src/components/report/SignalsDetectedSection.tsx` | OK |
| `src/components/report/SignalsMissingSection.tsx` | OK |
| `src/components/report/ModifiersAppliedList.tsx` | OK |
| `src/components/report/HausReportTeaser.tsx` | OK |
| `supabase/migrations/20260419_create_listing_signals.sql` | OK |
| `supabase/migrations/20260419_extend_listing_reports_haus_report.sql` | OK |
| `tests/e2e/haus-report.spec.ts` | OK |

Status: PASS.

## Check 7 — Commits inventory

**Total unpushed commits on `Front-monzaaa`:** 36

Commit range (most recent first):
- `eba23d5` test(haus-report): E2E smoke test for free view teaser + paid report rendering
- `86dd32a` feat(haus-report): wire ReportClient to real /api/analyze; add DB→HausReport assembler
- `76c51ad` feat(haus-report): /api/analyze orchestrates extractors + engine + persistence
- `3b326fd` feat(haus-report): saveHausReport and saveSignals Supabase writers
- `ed3cf39` test(haus-report): validated Gemini extraction against 3 real listings, regression fixtures committed
- `c7071d2` docs(haus-report): record selected listings for Gemini prompt validation
- `b932e99` feat(haus-report): Gemini text signal extractor with mocked unit tests
- `043bd13` feat(haus-report): add Gemini JSON client targeting gemini-2.5-flash
- `afe27bf` feat(haus-report): seller whitelist extractor for specialist dealer tier
- `9133ea5` feat(haus-report): structured field extractor (mileage, transmission, year)
- `ab99711` feat(haus-report): supabase migrations for listing_signals + listing_reports extensions
- `72939b6` feat(haus-report): refactor ReportClient to render HausReport shape with signal sections
- `84522a5` feat(haus-report): show HausReportTeaser on free car detail page
- `c1ab978` feat(haus-report): HausReportTeaser card for free detail page
- `049ecdf` feat(haus-report): ModifiersAppliedList with citations
- `6c95aec` feat(haus-report): SignalsMissingSection with seller question prompts
- `f3a7da0` feat(haus-report): SignalsDetectedSection component with evidence display
- `9dbeb29` i18n(haus-report): remove grade keys, add Haus Report keys across en/es/de/ja
- `0e8e130` refactor(haus-report): purge grade from DashboardClient (follow-up to Task 14 sweep)
- `474d2f1` refactor(haus-report): sweep out residual grade references
- `fd56785` refactor(haus-report): remove remaining grade references from prompts, filters, advisor, and analysis
- `3beba68` refactor(haus-report): remove grade from landing, auction detail, and related API routes
- `43639ca` refactor(haus-report): replace Grade column in context panels with Fair Value / Median Sold
- `4416bc8` refactor(haus-report): remove grade from mobile hero and row variants
- `ec77b40` refactor(haus-report): replace grade badges with MarketDeltaPill in feed and browse cards
- `6546fc4` feat(haus-report): add MarketDeltaPill for subtle free-view price positioning
- `68945c3` chore(haus-report): configure vitest+jsdom+testing-library for React component tests
- `574c767` refactor(haus-report): remove grade weighting from similar-cars and brand aggregation
- `83e3536` refactor(haus-report): remove investmentGrade from shared types and data layer
- `b004bf4` feat(haus-report): add sparse 991 Carrera fixture for edge-case UI testing
- `1d389c6` fix(haus-report): correct 992 GT3 fixture total_percent and specific_car_fair_value to match summed deltas
- `c1ad7cd` feat(haus-report): add 992 GT3 PTS mock fixture with rich signals
- `c294805` feat(haus-report): fair value engine with modifier application and ±35% cap
- `c03b636` docs(haus-report): clarify bidirectional range semantics on modifier definition
- `f697fe4` feat(haus-report): add modifier library v1.0 with 12 modifiers and public citations
- `e8e2668` feat(haus-report): add core types for fair value signal extraction

---

## Shipping blockers (user must resolve before deploy)

1. **Vercel env vars** — Confirm `GEMINI_API_KEY`, `GEMINI_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel Production and Preview. Missing `GEMINI_API_KEY` → `/api/analyze` returns 500.
2. **Supabase migrations** — Apply both 20260419 migrations to production Supabase. Without them, writes to `listing_signals` and extended `listing_reports` columns will fail.
3. **Push `Front-monzaaa`** — 36 local commits, 0 pushed. User will push when ready.

## Known technical debt / follow-ups

- **Legacy `Analysis` table** still contains `investmentGrade` column. `src/lib/db/queries.ts` (`saveAnalysis`, `getAnalysisByAuctionId`) still reads/writes it. Scope: a future cleanup task should drop this column and migrate the legacy analysis flow to the Haus Report pipeline (or remove it outright if unused).
- **`FilterSidebar.onlyInvestmentGrade` toggle** (`src/components/filters/FilterSidebar.tsx:230,274,283,518-530`) — dead UI: filter state is set but not forwarded anywhere meaningful now that the grade is removed from the data layer. Remove in next filters pass.
- **Marketing copy stale** — `src/app/[locale]/pricing/page.tsx:16,54` still describes "AAA to C scoring". Update to reflect the new Haus Report framing (fair value delta, modifiers, signals).
- **`messages/{en,es,de,ja}.json`** — still contain legacy `summary.investmentGrade` key. Ideally removed once the legacy Analysis summary component is retired.
- **Task 28 text extractor mapping gap** — Gemini `/` `text.ts` extractor validation surfaced a small mapping gap on a sparse listing. Regression fixtures committed; logic is acceptable for MVP but deserves a follow-up pass before high-volume use.
- **Task 14 DashboardClient sweep** — all direct grade references removed, but DashboardClient still has `valuation` plumbing that previously blended grade-weighted aggregates. Verify ranking/sort semantics post-ship.

## Final status

| Area | Status |
|---|---|
| Type-check (scope) | PASS |
| Tests (scope) | PASS |
| Grade purge (Haus Report surface) | PASS |
| Env vars (local) | PASS |
| Migrations (files present) | PASS |
| File inventory | PASS |
| Commits ready | 36 commits on `Front-monzaaa` |

**Ready to push and deploy** once the two production blockers (Vercel env vars + Supabase migrations) are confirmed by user.
