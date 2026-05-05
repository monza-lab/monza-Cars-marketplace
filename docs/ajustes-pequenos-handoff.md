# Ajustes Pequeños — Report FE & Exports Handoff

> Branch: `ajustes-pequenos` · parent: `main` (merge commit `ba056c6` pulled `reporte` into this line)
> Audience: BE reviewer / merger. Frontend is green. BE touchpoints are explicit below.

## TL;DR

The Haus Report UI, PDF and Excel exports all got a brand-consistency pass + three honesty fixes (hardcoded UI costs, tier defaulting, D4 date window). **No DB schema changes, no new API contracts, no env vars.** Exports now use the Cormorant/Karla brand fonts via `public/fonts/monzahaus/`.

## What shipped

### 1. Excel rebrand (brand manual v2.0)

All 4 sheets repainted against the brand rules: Warm Cream bg (`#FDFBF9`), Dark Espresso text (`#2A2320`), Salon Burgundy accent (`#7A2E4A`), Salon Rose highlights (`#D4738A`), Burnt Orange for negatives (`#FB923C` — **never red**). No more blue "input" cells, no more pure-white backgrounds.

- `src/lib/exports/excel/styles.ts` — new palette constants + `applyWarmBackground()` + `dataCell()` + `sectionLabelCell()` helpers.
- `src/lib/exports/excel/sheets/summary.ts` — wordmark, tagline, verdict colored per brand rules (WALK = burnt orange, never red), Verify URL as Salon Burgundy underlined link.
- `src/lib/exports/excel/sheets/assumptions.ts` — copy rewritten: "rose cells are your inputs · beige cells are formulas" (was "blue / black"). Tab color = Salon Rose.
- `src/lib/exports/excel/sheets/liveModel.ts` — copy rewritten. Layout rows preserved so hardcoded `B8` / `B${row-N}` formula refs still resolve. Tab = Soft Beige.
- `src/lib/exports/excel/sheets/dataAndSources.ts` — section banners paint the full 5-column width instead of a single merged cell; every data row gets `dataCell()` treatment; hyperlinks in Salon Burgundy + underline.

### 2. PDF rebrand + brand fonts

- `public/fonts/monzahaus/{Cormorant,Karla,Karla-Italic}.ttf` — brand fonts committed (~760 KB total) and registered at render time via `src/lib/exports/pdf/fonts.ts`.
- `src/lib/exports/pdf/styles.ts` — dark editorial palette (Obsidian bg, Bone text, Salon Rose accent). Negative = Burnt Orange, never red.
- Every template under `src/lib/exports/pdf/templates/` got repainted against the new palette.

### 3. Three honesty fixes (previously flagged to edgar@)

- **#1 DownloadSheet no longer fakes Pistons cost.** Endpoints `/api/reports/[id]/pdf` and `/api/reports/[id]/excel` don't charge any credits. The UI used to display "· 2 Pistons / · 3 Pistons" from hardcoded defaults. Now: no cost line, footer reads "Downloads are included with your Haus Report." When real billing is wired, re-add `tokenCost` props fed from the server.
- **#2 Tier no longer defaults to `tier_1`.** `page.tsx` now calls `getReportMetadataV2(car.id)` and passes real `tier`, `report_hash`, `version` through to `ReportClientV2` → `adaptV1ReportToV2`. A Tier 2 user no longer sees the "Upgrade" upsell incorrectly. **Caveat**: `reference_pack` + `kb_entries` are still passed as `null/[]` to `generateRemarkable` — those light up when server-side v2 emission lands. Today Tier 2 users see the correct badge/subtitle but the same claims set as Tier 1 because the extra source layers aren't loaded yet. This is honest (nothing fake added) but visible.
- **#3 D4 confidence aggregation now uses the full date window.** Was reading only `regions[0].oldestDate/newestDate`; now `aggregateCaptureWindow()` takes min/max across every region **and** every comparable `soldDate`.

### 4. New user-facing components

- `src/components/report/DownloadSheet.tsx` (replaces the inline stub in ReportClientV2): real modal with keyboard handling (Esc), accessible (`aria-modal`, `aria-labelledby`), hash-aware filenames.
- `src/components/report/SeeSampleModal.tsx`: Tier 2 preview modal from the `WhatsRemarkableBlock` upsell CTA. The SAMPLE_CLAIMS inside are **explicitly labeled** "Tier 2 sample · different listing" — this is intentional marketing content, not claims about the car being viewed.

### 5. Cross-border arbitrage (D2) now precomputed server-side

- `src/lib/marketIntel/computeArbitrageForCar.ts` (new) + test — runs `calculateLandedCost` against real priced listings per region and resolves landed cost to the target region of the listing being viewed.
- `page.tsx` + `/api/reports/[id]/pdf` + `/api/reports/[id]/excel` all call it server-side and feed `d2Precomputed` into the adapter. Previously D2 was an empty block in the V2 FE.

### 6. Misc traceability wiring

- `SpecificCarFairValueBlock`, `ComparablesAndPositioningBlock`, `ArbitrageSignalBlock` each now render a `SourceBadge` showing the platforms + capture-date range derived from `marketStats.regions[*].sources` + `DbComparableRow.platform/soldDate`.
- `ReportHeader` — sticky top offset adjusted (56px mobile / 80px desktop) to avoid colliding with the main app nav.

## BE-visible surface area

**No migrations. No new env vars. No new API contracts.** What the BE should know:

| Surface | Change | BE action |
|---|---|---|
| `/api/reports/[id]/pdf` | Now calls `computeArbitrageForCar` server-side; fails gracefully if priced listings query fails | Monitor latency — renders take an extra landed-cost resolution pass. Currently sub-second in local testing. |
| `/api/reports/[id]/excel` | Same as above | Same |
| `listing_reports` table | **Not modified.** `getReportMetadataV2` already existed and reads `tier`, `report_hash`, `version` columns added in an earlier BE migration. | None — confirm those columns exist in prod (they were in the Haus Report v1 BE handoff). |
| `listing_signals` table | **Not modified.** | None. |
| `getComparablesForModel` | Wrapped in `.catch()` in `page.tsx` — if the query fails, the report still renders with empty comparables | None, but if failures start appearing in logs flagged `[report] getComparablesForModel failed`, that's this catch talking. |
| Exports Supabase Storage bucket | Behavior unchanged — best-effort upload, silent fallback if bucket missing | None. |

## Validation run before commit

| Check | Result |
|---|---|
| `npx tsc --noEmit` on changed files | ✅ Clean (3 pre-existing `landed_cost` missing errors in unrelated test fixtures, not new) |
| `npx eslint` on changed files | ✅ 0 errors, 0 warnings on changed files. (10 pre-existing warnings in V1 `ReportClient.tsx` not touched.) |
| `npx vitest run` full suite | ✅ **1559 pass / 1 failure** — the failure is `src/app/api/cron/beforward/route.test.ts` (BeForward scraper cron), pre-existing, unrelated. |
| `npx tsx scripts/render-mock-report.ts` | ✅ Generates `/tmp/haus-report-mock.pdf` (45 KB) + `/tmp/haus-report-mock.xlsx` (16.8 KB) end-to-end without errors. |

## Smoke test plan post-merge

1. **V2 Report page** — `/en/cars/porsche/<id>/report?v2=1` loads; `ReportHeader` sticky doesn't overlap the nav; `ArbitrageSignalBlock` renders with 4 regions; `SpecificCarFairValueBlock` shows the platforms + date source badge.
2. **Tier honesty** — pick a listing whose DB `listing_reports.tier` is `tier_2`. Report should show "findings with specialist context" subtitle and **no** Upgrade CTA. Claims list may still be short (Phase 3 will populate).
3. **DownloadSheet** — click the download icon in header. Modal opens. No "Pistons" text anywhere. Click PDF → should download server-rendered PDF with brand fonts + dark palette. Click Excel → warm cream Excel downloads.
4. **V1 Report page** — `/en/cars/porsche/<id>/report` (no `?v2=1`) should still work as before. Nothing in `ReportClient.tsx` was touched.
5. **Verify route** — `/verify/<hash>` if any listing has a persisted hash, should still resolve.

## Rollback

Single commit, so `git revert HEAD` on the merged branch is clean. No data migrations to undo, no storage state to clean.

## Known follow-ups (not in this PR)

- Phase 3 server-side v2 emission should load `reference_pack` + `kb_entries` so Tier 2 users actually see extra claims (see `adaptV1ToV2.ts` comment at line 26).
- Wire real billing into download endpoints when Pistons charging is ready — the UI has a clean place to show cost again (`DownloadOption.label` row).
- The hardcoded `B8` formula references in `liveModel.ts` are pre-existing and should be made dynamic in a follow-up so layout shifts don't silently break the model.
