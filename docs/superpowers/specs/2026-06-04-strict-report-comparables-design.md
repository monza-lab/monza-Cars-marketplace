# Strict Report Comparables Design

Date: 2026-06-04
Worktree: `.worktrees/report-comparables-logic`

## Phase-Zero Context

- OS: Windows 11 Home 10.0.26200
- Shell: PowerShell 5.1
- Runtime: Node v24.5.0, npm 11.5.2
- App: Next.js 16.1.6, React 19.2.3, Vitest 4.0.18
- Baseline: `npm install` completed. `npm test` fails on pre-existing unrelated failures in scraper timeout tests, next-intl mocks, SEO alternate assertions, liveness counts, cron route mocks, and report page module resolution.
- Non-functional requirements: no new dependency, strict data honesty, no fabricated comparable fallback, no user-visible empty comparable placeholders when strict data is absent.

## Problem

The report currently uses two different concepts that both read as "comparables":

- The report section uses historical sold rows from the `"Comparable"` table via `getComparablesForModel(make, model)`.
- The right summary rail uses `findSimilarCars`, which can surface same-generation, same-lineage, or price-nearby vehicles without requiring the same model or variant.

For a report on a `911 GT3`, both historical sold comparables and right-rail peers must be `911 GT3`. Broader `911`, same-generation, same-family, or price-only fallback matches are not acceptable.

## Desired Behavior

For a report target such as `Porsche 911 GT3`:

1. Historical comparables must match the strict report peer identity: same make and same model/variant identity.
2. Live right-rail peers must match the same strict identity.
3. If zero strict historical sold comparables exist, remove the online report `Comparables & Positioning` section.
4. If zero strict live peers exist, remove the peer list area from the right rail while keeping verdict/fair value/asking summary intact.
5. PDF and Excel exports must not include a comparables page/table when strict historical comparables are empty.
6. No fallback to base model, series, family, lineage, adjacent variants, or price band.

## Scope

Files expected:

- `src/lib/reportPeerIdentity.ts` or equivalent feature-local helper
- `src/lib/db/queries.ts`
- `src/lib/reports/agents/marketDataBundle.ts`
- `src/lib/reports/agents/fairValueEngine.ts`
- `src/lib/similarCars.ts`
- `src/app/[locale]/cars/[make]/[id]/report/page.tsx`
- `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`
- `src/components/report/ReportSummaryRail.tsx`
- `src/app/api/reports/[id]/pdf/route.ts`
- `src/app/api/reports/[id]/excel/route.ts`
- export templates/sheets that currently render comparables
- focused tests adjacent to the touched code

LOC/file target: less than 150 changed LOC per touched file. No file should approach 1000 LOC from this change.

Dependencies: 0.

## Data Model And Matching Rule

Introduce one strict peer-identity helper used by report generation, report SSR, export paths, and right-rail peer selection.

The helper should normalize:

- make: trim, lowercase, collapse whitespace
- model/variant identity: trim, lowercase, collapse whitespace, remove harmless punctuation

The first implementation should be conservative:

- `911 GT3` matches `911 GT3`
- `911 Turbo` matches `911 Turbo`
- `Carrera S` matches `Carrera S`
- `911` does not match `911 GT3`
- `911 GT3 RS` does not match `911 GT3` unless the stored normalized identity is exactly the same

If source data lacks a reliable model/variant identity, the item should not match.

## Report Generation Flow

`market_data_bundle` is the canonical generation step for strict comparable fetches.

It should:

- derive the strict peer identity from the target car
- fetch only strict sold comparables
- set `comparablesCount` from that strict set only
- avoid fallback broadening when the strict set is empty

`fair_value` should:

- consume the strict count from `marketData`
- avoid claiming a comparable-backed baseline when strict count is zero
- preserve report generation even when strict comparables are absent

## Online Report Rendering

The report page should pass strict historical comparables to `ReportClient`.

`ReportClient` should:

- compute D3 peer positioning only from strict historical comparables
- render `ComparablesAndPositioningBlock` only when strict historical comparables length is greater than zero
- omit the section entirely when strict historical comparables are empty

No empty "No comparables available" card should appear in the full report.

## Right Rail Rendering

The right rail should receive strict live same-model peers, not broad similar cars.

It should:

- show live/current same-model peers when available
- hide the peer list area when empty
- keep the upper summary area, including verdict, fair value, asking, and price delta
- use clearer copy such as `Live same-model listings` instead of `Similar at this price`

## Export Rendering

PDF and Excel exports should use the same strict historical comparable source.

If strict historical comparables are empty:

- PDF should not render the Comparables page/table.
- Excel should not render a comparable sales table.
- Summary/assumptions may show count `0`, but must not imply a data-backed comparable baseline.

## Error Handling

Database failures remain non-fatal:

- log the query failure with existing logging conventions
- return an empty strict comparable set
- omit comparable-dependent sections
- continue report generation where possible

## Tests

Focused tests should cover:

- strict identity normalization
- no match between `911` and `911 GT3`
- no match between `911 GT3` and `911 GT3 RS`
- historical comparable query/filter behavior
- right-rail peer filter excludes broader same-family cars
- online report omits Comparables section when strict historical comparables are empty
- PDF/Excel omit comparable table/page when strict historical comparables are empty

Pass criteria:

- targeted tests pass
- no new broad-match fallback remains in report comparable paths
- no new dependencies
- worktree stays isolated from unrelated main checkout changes

