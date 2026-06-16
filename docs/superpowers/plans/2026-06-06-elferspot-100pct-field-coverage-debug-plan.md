# Elferspot 100% Field Coverage Debug Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:systematic-debugging before implementing fixes. Use superpowers:test-driven-development for each code change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make active Elferspot listings reach and retain 100% usable coverage for `color_exterior`, `engine`, and `transmission`.

**Architecture:** Treat the current problem as a two-boundary failure: discovery writes summary-only rows, and enrichment does not prioritize the fields we are measuring. Fix the writer so summary-only data cannot erase existing detail fields, then make enrichment target field completeness directly.

**Tech Stack:** Next.js API cron routes, TypeScript scraper feature slice, Supabase/Postgres, Vitest, existing proxy/Scrapling fallback.

**Plan Envelope:** `{files: 6 modify/create, LOC/file: scripts/test <=220, route <=260, writer <=180, tests <=260 each, deps: 0}`

---

## Current Evidence

Manual run `logs/scraper-runs/run-2026-06-06T10-53-14-627Z.json`:

- `elferspot` collector: OK, `18m 21s`, `discovered=14`, `written=14`, `enriched=0`, `scrapeDetails=false`.
- `cron-elferspot-enrich`: OK, `4m 30s`, `discovered=250`, `enriched=184`, `timeBudgetReached=true`.
- `cron-backfill-photos-elferspot`: OK, `discovered=80`, `backfilled=69`.
- Health audit marks `elferspot` collector as `WORKING`, but `enrich-elferspot` as `DEGRADED` with 38 runs, 4,735 writes, 16 errors.

Database snapshot taken after the manual runs:

- Recent active Elferspot target coverage: `2.7%`.
- Recent active Elferspot missing counts: `color=933`, `engine=934`, `transmission=933` out of `959`.
- Older active Elferspot average target coverage: `99.4%`.

Working hypothesis:

1. `src/app/api/cron/elferspot/route.ts` and `src/features/scrapers/elferspot_collector/cli.ts` run discovery with `scrapeDetails=false`.
2. `src/features/scrapers/elferspot_collector/supabase_writer.ts` upserts detail fields even when they are null.
3. `src/app/api/cron/enrich-elferspot/route.ts` selects description/VIN/price rows, not rows missing `color_exterior`, `engine`, or `transmission`.
4. `enrich-elferspot` reaches the time budget before clearing the target-field backlog.

## Pass-Fail Criteria

- PASS: Active Elferspot listings have `100.0%` usable coverage for `color_exterior`, `engine`, and `transmission`, excluding only rows proven detail-unavailable and marked with an explicit coverage exception.
- PASS: Running Elferspot discovery with `scrapeDetails=false` does not reduce coverage for previously enriched rows.
- PASS: `enrich-elferspot` reports target-field backlog counts in its response and makes progress on the oldest missing target-field rows first.
- FAIL: Health audit says `WORKING` while target-field coverage is below threshold.

## Task 1: Build the Reproducer Query Script

**Files:** `{files: 1 create, LOC/file: <=220, deps: 0}`

- Create: `scripts/audit-elferspot-field-coverage.ts`

- [ ] Add a read-only DB script that loads `.env.local`, queries active Elferspot coverage, and prints:
  - total active rows
  - usable coverage for `color_exterior`, `engine`, `transmission`
  - rows updated in the last 72 hours
  - rows where `scrape_timestamp >= now() - interval '72 hours'` and any target field is missing
  - 20 sample URLs from the missing target-field backlog

- [ ] Run:

```powershell
npx tsx scripts/audit-elferspot-field-coverage.ts
```

Expected before fixes: recent coverage remains far below `100%` and sample rows show null target fields.

## Task 2: Prevent Summary-Only Upserts From Erasing Detail Fields

**Files:** `{files: 2 modify, LOC/file: writer <=180, test <=260, deps: 0}`

- Modify: `src/features/scrapers/elferspot_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/elferspot_collector/supabase_writer.test.ts`

- [ ] Add a failing unit test: when `NormalizedElferspot` has `engine=null`, `transmission=null`, and `color_exterior=null`, the mapped upsert payload must omit those fields rather than setting them to null.

- [ ] Update the writer mapping so fields from detail pages are included only when non-empty:
  - `engine`
  - `transmission`
  - `body_style`
  - `color_exterior`
  - `color_interior`
  - `vin`
  - `description_text`
  - `images`
  - `photos_count`

- [ ] Preserve core discovery fields in every upsert:
  - `source`
  - `source_id`
  - `source_url`
  - `title`
  - `make`
  - `model`
  - `trim`
  - `year`
  - price fields
  - status and timestamps

- [ ] Run:

```powershell
npx vitest run src/features/scrapers/elferspot_collector/supabase_writer.test.ts
```

Expected: test passes and no existing non-null detail field can be nulled by summary-only discovery.

## Task 3: Prioritize Target-Field Enrichment

**Files:** `{files: 2 modify, LOC/file: route <=260, test <=260, deps: 0}`

- Modify: `src/app/api/cron/enrich-elferspot/route.ts`
- Modify: `src/app/api/cron/enrich-elferspot/route.test.ts`

- [ ] Add a failing route test showing that rows missing `color_exterior`, `engine`, or `transmission` are fetched before description/VIN/price-only rows.

- [ ] Add a `targetFields` fetch bucket using this condition:

```text
color_exterior.is.null,color_exterior.eq.,engine.is.null,engine.eq.,transmission.is.null,transmission.eq.
```

- [ ] Merge buckets in this priority order:
  1. missing target fields
  2. missing description
  3. missing VIN
  4. missing price

- [ ] Include response counters:
  - `targetFieldCandidates`
  - `targetFieldUpdates`
  - `remainingTargetFieldBacklog`
  - `timeBudgetReached`

- [ ] Run:

```powershell
npx vitest run src/app/api/cron/enrich-elferspot/route.test.ts
```

Expected: route selection prioritizes the coverage fields used by the quality metric.

## Task 4: Add Detail-Parser Coverage Assertions

**Files:** `{files: 1 modify, LOC/file: test <=260, deps: 0}`

- Modify: `src/features/scrapers/elferspot_collector/detail.test.ts`

- [ ] Add fixture assertions that `parseDetailPage` extracts:
  - `colorExterior`
  - `engine`
  - `transmission`

- [ ] Include at least one fixture where values come from JSON-LD and one where `engine` comes from `table.fahrzeugdaten`.

- [ ] Run:

```powershell
npx vitest run src/features/scrapers/elferspot_collector/detail.test.ts
```

Expected: parser extraction is proven before relying on batch enrichment.

## Task 5: Add a Coverage Gate to Health Audit

**Files:** `{files: 2 modify, LOC/file: audit <=260, test <=260, deps: 0}`

- Modify: `scripts/scraper-health-audit.ts`
- Modify: `src/features/scrapers/common/monitoring/audit.test.ts`

- [ ] Add Elferspot target-field coverage to audit payload:
  - source: `Elferspot`
  - fields: `color_exterior`, `engine`, `transmission`
  - scope: active rows and recent 72-hour rows

- [ ] Mark Elferspot `DEGRADED` when active or recent target coverage is below `100%`, even if the collector wrote rows with zero run errors.

- [ ] Run:

```powershell
npx vitest run src/features/scrapers/common/monitoring/audit.test.ts
npm run scrapers:audit -- --days=3
```

Expected: the audit cannot report `elferspot | WORKING` while target-field coverage is below threshold.

## Task 6: Execute One-Shot Validation

**Files:** `{files: 0 code changes, LOC/file: n/a, deps: 0}`

- [ ] Run the read-only audit:

```powershell
npx tsx scripts/audit-elferspot-field-coverage.ts
```

- [ ] Run enrichment until no target-field backlog remains:

```powershell
npx tsx scripts/run-scrapers.ts --enrichment
```

or directly:

```powershell
curl -H "Authorization: Bearer $env:CRON_SECRET" "http://127.0.0.1:3000/api/cron/enrich-elferspot?limit=300&delayMs=500"
```

- [ ] Re-run:

```powershell
npx tsx scripts/audit-elferspot-field-coverage.ts
npm run scrapers:audit -- --days=3
```

Expected final observation: `Elferspot` target-field coverage is `100.0%`, or every exception row has an explicit `enrichment_meta.elferspot.targetFieldStatus` proving the detail page does not expose the field.

## Defect Report Template

Use this if coverage remains below target after two fix attempts:

```text
title: Elferspot target-field coverage remains below 100%
severity: high
frequency: reproducible
phase: Elferspot enrichment
script_identifier: audit-elferspot-field-coverage
environment_matrix: Windows, Node 24.5.0, Next dev server, Supabase production DB
build_commit: <git sha>
reproduction_steps: <commands run>
observed_behavior: <coverage table>
expected_behavior: 100% color_exterior/engine/transmission or explicit exception markers
artifact_references: <audit JSON/log paths>
suspected_boundary: writer | parser | enrichment selector | source unavailable
initial_hypothesis: <single hypothesis>
workaround_if_available: run detail-mode collector with --scrapeDetails for affected rows
regression_test_status: <test names>
ownership: scraper data quality
```
