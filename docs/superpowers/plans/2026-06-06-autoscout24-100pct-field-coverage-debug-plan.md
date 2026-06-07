# AutoScout24 100% Field Coverage Debug Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:systematic-debugging` before implementing fixes. Use `superpowers:test-driven-development` for each code change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make active AutoScout24 listings reach and retain 100% usable coverage for `color_exterior`, `engine`, and `transmission`, where unresolved rows are counted as covered only when they have explicit AutoScout24 exception metadata.

**Architecture:** Treat AutoScout24 as a high-volume discovery plus bounded detail-enrichment pipeline. Summary discovery must never erase known detail fields. Both enrichment entry points must select the same target-field backlog before secondary detail gaps. Monitoring must fail when scraper runs are operationally OK but field coverage regresses.

**Tech Stack:** Next.js API cron routes, TypeScript scraper feature slice, Supabase/Postgres, Scrapling AS24 detail fetcher, Vitest.

**Plan Envelope:** `{files: 14 modify/create, LOC/file: audit script <=240, enrichment policy <=120, route <=340, CLI enricher <=360, writer <=320, shards <=240, tests <=320 each, deps: 0}`

---

## Phase Zero: Current Evidence

Manual run `logs/scraper-runs/run-2026-06-06T10-53-14-627Z.json`:

- `as24` collector: OK, `24m 46s`, `discovered=2151`, `detailsFetched=0`, `normalized=1853`, `written=1853`, `errors=0`.
- Collector ended on time budget with `shardsCompleted=49/60`.
- Collector warned that these shards saturated the 20-page limit:
  - `macan-all`
  - `panamera-low`
  - `panamera-mid`
  - `panamera-high`
  - `taycan-mid`
  - `taycan-high`
- `as24-enrich` Scrapling enrichment: OK, `20m 04s`, queried `800`, fetched `554`, updated `554`, stopped on time budget.
- `cron-enrich-details`: OK, `discovered=100`, `enriched=99`, one dead URL.
- Health audit marks `autoscout24` collector as `WORKING`, but `enrich-details` as `DEGRADED`.

Database snapshot taken after the manual runs:

- Recent active AutoScout24 target coverage: `63.2%`.
- Recent missing counts: `color=4049`, `engine=3706`, `transmission=0` out of `7021`.
- Older active AutoScout24 average target coverage: `96.6%`.

Current code reality to preserve while debugging:

- `src/features/scrapers/common/enrichmentLoopPolicy.ts` already selects missing `engine` and `transmission`, not only `trim`.
- The actual selector gap is `color_exterior`; it is not included in `CRITICAL_SPEC_FIELDS`.
- `scripts/as24-enrich-scrapling.ts` and `src/app/api/cron/enrich-details/route.ts` still use `trim=""` as an attempted sentinel.
- `scripts/as24-enrich-scrapling.ts` can write `engine="Not specified"`, which must not count as usable coverage.
- `enrichment_meta` already exists and Elferspot has a reusable status pattern.

Working hypotheses:

1. The collector intentionally runs `scrapeDetails=false`, so new rows are summary-only.
2. `src/features/scrapers/autoscout24_collector/supabase_writer.ts` includes nullable detail fields in summary-only upserts, which can erase previously enriched values.
3. The shared enrichment policy omits `color_exterior`, so rows missing color can fall out of the AS24 backlog once `trim` is marked attempted.
4. `trim=""` is doing two jobs: a real data field and a retry sentinel. This hides rows that still miss target fields.
5. Discovery volume is higher than one enrichment run can clear; validation must drain the backlog over repeated bounded runs.
6. Current Panamera/Taycan price splits are insufficient because saturated split shards were still observed.

## Pass-Fail Criteria

- PASS: Active AutoScout24 listings have `100.0%` usable coverage for `color_exterior`, `engine`, and `transmission`, excluding only rows with `enrichment_meta.autoscout24.targetFieldStatus` in an explicit covered exception status.
- PASS: Usable coverage treats `NULL`, empty string, and placeholders such as `Not specified`, `Unknown`, `N/A`, and `-` as missing.
- PASS: Running summary-only AS24 discovery cannot null out existing `trim`, `body_style`, `color_exterior`, `color_interior`, `engine`, `vin`, or `description_text`.
- PASS: AS24 enrichment selects rows missing target fields before rows missing only `trim`, description, VIN, body style, or images.
- PASS: AS24 enrichment no longer uses `trim=""` as a global attempted sentinel.
- PASS: Health audit reports AutoScout24 as degraded whenever target-field coverage falls below 100% or any shard saturation warning is present.

## File Map

- Create `scripts/audit-as24-field-coverage.ts`: read-only coverage/backlog audit.
- Modify `src/features/scrapers/autoscout24_collector/supabase_writer.ts`: omit nullable detail fields from summary-only upsert rows.
- Modify `src/features/scrapers/autoscout24_collector/supabase_writer.test.ts`: regression tests for preserving existing detail fields.
- Modify `src/features/scrapers/common/enrichmentLoopPolicy.ts`: add AS24 target-field filter helpers and missing-value rules.
- Modify `src/features/scrapers/common/enrichmentLoopPolicy.test.ts`: regression tests for `color_exterior` and placeholders.
- Modify `scripts/as24-enrich-scrapling.ts`: use target-field backlog, merge `enrichment_meta.autoscout24`, stop writing `trim=""`.
- Modify `src/app/api/cron/enrich-details/route.ts`: same selection/metadata semantics as CLI enricher.
- Modify `src/app/api/cron/enrich-details/route.test.ts`: route selector, metadata, counters, and no-sentinel tests.
- Modify `scripts/run-scrapers.test.ts`: AS24 enrichment profile and target-backlog expectations.
- Modify `src/features/scrapers/autoscout24_collector/detail.test.ts`: parser proof for color, engine, transmission.
- Modify `src/features/scrapers/autoscout24_collector/shards.ts`: Macan split policy plus second-level splits for saturated Panamera/Taycan ranges.
- Modify `src/features/scrapers/autoscout24_collector/collector.test.ts`: saturated shard coverage tests.
- Modify `scripts/scraper-health-audit.ts` and `src/features/scrapers/common/monitoring/audit.test.ts`: AS24 target coverage gate and saturation degradation.

## Task 1: Build the Read-Only Reproducer Query

**Files:** `{files: 1 create, LOC/file: <=240, deps: 0}`

- Create: `scripts/audit-as24-field-coverage.ts`

- [ ] Add a read-only DB script that loads `.env.local`, queries active AutoScout24 rows, and prints JSON plus a compact console table.
- [ ] Count each target field as missing when it is `NULL`, `""`, `"Not specified"`, `"Unknown"`, `"N/A"`, or `"-"`.
- [ ] Count exception rows only when `enrichment_meta->autoscout24->>targetFieldStatus` is one of:
  - `covered_or_unavailable`
  - `detail_unavailable`
  - `blocked_unverified`
  - `dead_url`
- [ ] Print:
  - total active rows
  - usable coverage for `color_exterior`, `engine`, `transmission`
  - recent 72-hour coverage
  - rows with `trim IS NOT NULL` but target fields missing
  - rows with placeholder target values
  - 20 sample URLs where target fields are missing and `trim=""`
  - `remainingTargetFieldBacklog`

- [ ] Run:

```powershell
npx tsx scripts/audit-as24-field-coverage.ts
```

Expected before fixes: many rows have missing `color_exterior` and/or `engine`, and some are hidden by the current `trim` marker.

## Task 2: Prevent Summary-Only Upserts From Erasing Detail Fields

**Files:** `{files: 2 modify, LOC/file: writer <=320, test <=320, deps: 0}`

- Modify: `src/features/scrapers/autoscout24_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/autoscout24_collector/supabase_writer.test.ts`

- [ ] Add a failing unit test: `mapNormalizedListingToListingsRow` omits nullable detail-only fields when the normalized listing value is null.
- [ ] Update the mapping layer so null values are not included for:
  - `trim`
  - `body_style`
  - `color_exterior`
  - `color_interior`
  - `engine`
  - `vin`
  - `description_text`
- [ ] Preserve `transmission` from search summary when available, but omit it when null.
- [ ] Keep base discovery fields in the upsert row even when null where they are part of the listing identity or status contract.

- [ ] Run:

```powershell
npx vitest run src/features/scrapers/autoscout24_collector/supabase_writer.test.ts
```

Expected: summary-only discovery cannot reduce existing detail coverage.

## Task 3: Centralize Target-Field Backlog Policy

**Files:** `{files: 2 modify, LOC/file: policy <=120, test <=220, deps: 0}`

- Modify: `src/features/scrapers/common/enrichmentLoopPolicy.ts`
- Modify: `src/features/scrapers/common/enrichmentLoopPolicy.test.ts`

- [ ] Add `AS24_TARGET_FIELDS = ["color_exterior", "engine", "transmission"]`.
- [ ] Add `buildMissingAs24TargetFieldFilter()` returning:

```text
color_exterior.is.null,color_exterior.eq.,engine.is.null,engine.eq.,transmission.is.null,transmission.eq.
```

- [ ] Add `buildMissingAs24TargetOrDetailFilter(detailFields)` that orders target fields first, then secondary detail fields such as `trim`, `body_style`, `vin`, `description_text`, and image checks handled by callers.
- [ ] Add `isUsableTargetFieldValue(value)` and test that it rejects `null`, `""`, `"Not specified"`, `"Unknown"`, `"N/A"`, and `"-"`.
- [ ] Keep existing generic helpers intact for other scrapers.

- [ ] Run:

```powershell
npx vitest run src/features/scrapers/common/enrichmentLoopPolicy.test.ts
```

Expected: shared policy includes `color_exterior` without regressing existing filters.

## Task 4: Replace AS24 `trim` Sentinel With Metadata

**Files:** `{files: 4 modify, LOC/file: script <=360, route <=340, tests <=320 each, deps: 0}`

- Modify: `scripts/as24-enrich-scrapling.ts`
- Modify: `src/app/api/cron/enrich-details/route.ts`
- Modify: `src/app/api/cron/enrich-details/route.test.ts`
- Modify: `scripts/run-scrapers.test.ts`

- [ ] Update both enrichers to select:
  - `id`
  - `source_url`
  - `title`
  - `trim`
  - `transmission`
  - `body_style`
  - `engine`
  - `color_exterior`
  - `color_interior`
  - `vin`
  - `description_text`
  - `images`
  - `enrichment_meta`
- [ ] Use `buildMissingAs24TargetOrDetailFilter(["trim", "body_style", "vin", "description_text"])` so rows missing `color_exterior`, `engine`, or `transmission` are selected even when `trim=""`.
- [ ] Stop writing `trim=""` when no fields are extracted. Leave `trim` untouched unless the detail page provides a real trim value.
- [ ] Merge metadata without deleting existing keys:

```json
{
  "autoscout24": {
    "detailAttemptedAt": "2026-06-06T00:00:00.000Z",
    "targetFieldStatus": "complete | covered_or_unavailable | detail_unavailable | blocked_unverified | dead_url",
    "missingTargetFields": ["color_exterior", "engine"]
  }
}
```

- [ ] Set `targetFieldStatus` rules:
  - `complete`: all target fields have usable values after the update
  - `covered_or_unavailable`: fetched and parsed, but the source page does not expose one or more target fields
  - `blocked_unverified`: blocked/challenge response prevented verification
  - `detail_unavailable`: parser/fetch succeeded enough to identify the page but detail data is unavailable
  - `dead_url`: HTTP 404/410 and row is marked delisted
- [ ] Remove the `engine="Not specified"` write path. If no usable engine is found, leave `engine` unchanged and record metadata.
- [ ] Add response/run counters:
  - `targetFieldCandidates`
  - `targetFieldUpdates`
  - `detailsFetched`
  - `remainingTargetFieldBacklog`
  - `blocked`
  - `deadUrls`
- [ ] Keep the CLI and cron route behavior equivalent except for their batch size/time budget.

- [ ] Run:

```powershell
npx vitest run src/app/api/cron/enrich-details/route.test.ts scripts/run-scrapers.test.ts
```

Expected: both CLI and cron enrichers operate against the same target-field backlog and no longer hide target gaps behind `trim=""`.

## Task 5: Verify Detail Parser Field Extraction

**Files:** `{files: 1 modify, LOC/file: test <=260, deps: 0}`

- Modify: `src/features/scrapers/autoscout24_collector/detail.test.ts`

- [ ] Add fixture tests proving `parseDetailHtml` extracts:
  - `exteriorColor`
  - `engine`
  - `transmission`
- [ ] Include a fixture resembling current AS24 detail HTML where `transmission` exists, while `engine` and `exteriorColor` come from spec-table labels.
- [ ] Add at least one European spelling fixture for `Exterior colour`.
- [ ] Do not broaden parser selectors until the failing fixture proves the current parser misses real AS24 HTML.

- [ ] Run:

```powershell
npx vitest run src/features/scrapers/autoscout24_collector/detail.test.ts
```

Expected: if the source page exposes the target fields, parser tests prove extraction.

## Task 6: Discovery Shard Saturation Debugging

**Files:** `{files: 2 modify, LOC/file: shards <=240, tests <=320, deps: 0}`

- Modify: `src/features/scrapers/autoscout24_collector/shards.ts`
- Modify: `src/features/scrapers/autoscout24_collector/collector.test.ts`

- [ ] Add tests for saturated shard names observed in the manual run:
  - `macan-all`
  - `panamera-low`
  - `panamera-mid`
  - `panamera-high`
  - `taycan-mid`
  - `taycan-high`
- [ ] Add Macan to split policy.
- [ ] Add second-level splits for Panamera and Taycan because their existing price bands still saturated. Prefer year-range splits inside the existing price bands before adding many price buckets.
- [ ] Ensure generated shard IDs remain predictable and audit-readable.
- [ ] Ensure collector result or recorded run metadata exposes saturation warnings in a field the health audit can consume, not only as transient console logs.

- [ ] Run:

```powershell
npx vitest run src/features/scrapers/autoscout24_collector/collector.test.ts
```

Expected: saturated shard coverage is testable, and the audit can flag saturation regressions.

## Task 7: Add AutoScout24 Coverage Gate to Health Audit

**Files:** `{files: 2 modify, LOC/file: audit <=300, test <=260, deps: 0}`

- Modify: `scripts/scraper-health-audit.ts`
- Modify: `src/features/scrapers/common/monitoring/audit.test.ts`

- [ ] Generalize the existing Elferspot target-field coverage query so it can also fetch AutoScout24 coverage.
- [ ] For AutoScout24, use fields:
  - `color_exterior`
  - `engine`
  - `transmission`
- [ ] For AutoScout24, count exception rows with `enrichment_meta->autoscout24->>targetFieldStatus` in:
  - `covered_or_unavailable`
  - `detail_unavailable`
  - `blocked_unverified`
  - `dead_url`
- [ ] Mark `autoscout24` as `DEGRADED` when any target field coverage is below `100%`, even if the collector had `errors=0`.
- [ ] Mark `autoscout24` as `DEGRADED` when any shard saturation warning is present in recent run metadata.
- [ ] Keep Elferspot behavior unchanged.

- [ ] Run:

```powershell
npx vitest run src/features/scrapers/common/monitoring/audit.test.ts
npm run scrapers:audit -- --days=3
```

Expected: health audit stops reporting `autoscout24 | WORKING` while target-field coverage is below 100%.

## Task 8: Execute Backlog-Drain Validation

**Files:** `{files: 0 code changes, LOC/file: n/a, deps: 0}`

- [ ] Run the read-only coverage audit:

```powershell
npx tsx scripts/audit-as24-field-coverage.ts
```

- [ ] Run AS24 enrichment repeatedly until the audit reports `remainingTargetFieldBacklog=0`, every remaining row has exception metadata, or two consecutive runs make no progress:

```powershell
npx tsx scripts/as24-enrich-scrapling.ts --limit=800 --delayMs=1000
```

- [ ] If the local Next.js server is running and `CRON_SECRET` is available, run the cron route once as an integration check:

```powershell
curl -H "Authorization: Bearer $env:CRON_SECRET" "http://127.0.0.1:3000/api/cron/enrich-details"
```

- [ ] Re-run:

```powershell
npx tsx scripts/audit-as24-field-coverage.ts
npm run scrapers:audit -- --days=3
```

Expected final observation: AutoScout24 target-field coverage is `100.0%`, or every exception row has explicit `enrichment_meta.autoscout24.targetFieldStatus` proving unavailable, blocked, or dead URL. If two consecutive enrichment runs make no progress while backlog remains, stop and file the defect report below.

## Regression Command Set

Run after implementation:

```powershell
npx vitest run src/features/scrapers/autoscout24_collector/supabase_writer.test.ts src/features/scrapers/common/enrichmentLoopPolicy.test.ts src/app/api/cron/enrich-details/route.test.ts scripts/run-scrapers.test.ts src/features/scrapers/autoscout24_collector/detail.test.ts src/features/scrapers/autoscout24_collector/collector.test.ts src/features/scrapers/common/monitoring/audit.test.ts
npx tsx scripts/audit-as24-field-coverage.ts
npm run scrapers:audit -- --days=3
```

## Defect Report Template

Use this if coverage remains below target after two no-progress enrichment runs:

```text
title: AutoScout24 target-field coverage remains below 100%
severity: high
frequency: reproducible
phase: AS24 discovery/enrichment
script_identifier: audit-as24-field-coverage
environment_matrix: Windows, Node version from `node -v`, package manager version from `npm -v`, Supabase target, runtime flags
build_commit: <git sha>
reproduction_steps: <commands run>
observed_behavior: <coverage table and backlog samples>
expected_behavior: 100% color_exterior/engine/transmission or explicit exception markers
artifact_references: logs/scraper-runs/run-2026-06-06T10-53-14-627Z.json and latest audit artifact
suspected_boundary: writer | enrichment selector | parser | shard saturation | source unavailable | anti-bot blocking
initial_hypothesis: <single hypothesis>
workaround_if_available: repeat as24-enrich-scrapling with target-field selector until no-progress threshold
regression_test_status: <test names and pass/fail>
ownership: scraper data quality
```
