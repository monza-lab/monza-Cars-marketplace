# Source-Native VIN Retrieval Plan

> **For Capos:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan.

## Goal

Improve how the scraper system retrieves vehicle identifiers from marketplace pages before deciding whether VIN-derived insights belong in the v3 report.

This plan intentionally separates:

- **Source-native retrieval:** Scrapers extracting VIN/chassis/frame/serial values from marketplace listing/detail pages.
- **Decoder enrichment:** Existing NHTSA/local VIN decoding jobs that only enrich rows after a VIN already exists.

The immediate decision is not "add VIN decoding to the v3 report." The decision is "which source scrapers can materially increase trustworthy identifier coverage, and in what order."

## Phase Zero Context

Environment observed:

- OS: Windows, PowerShell
- Repo: `monza-Cars-marketplace`
- Runtime stack from `package.json`: Next.js 16.1.6, React 19.2.3, TypeScript 5.9.3, Vitest 4.0.18, Supabase JS 2.95.3
- Relevant docs: `docs/scrapers/SCRAPERS.md`
- Relevant DB table: `listings`
- Relevant current enrichment paths:
  - `src/app/api/cron/enrich-vin/route.ts`
  - `scripts/enrich-from-vin.ts`
  - `src/features/scrapers/common/nhtsaVinDecoder.ts`
  - `src/lib/vin/porscheVin.ts`

Observed active Porsche coverage from the live DB audit:

| Source | Active rows | Rows with identifier in `vin` | Coverage | Current read |
|---|---:|---:|---:|---|
| AutoScout24 | 17,198 | 1 | ~0.0% | Huge volume, source likely hides VIN on most pages |
| Classic.com | 807 | 807 | 100.0% | Excellent source-native coverage |
| Elferspot | 3,881 | 808 | 20.8% | High volume and likely improvable |
| Bring a Trailer | 133 | 127 | 95.5% | Good coverage; protect with tests |
| BeForward | 538 | 49 | 9.1% | Chassis-heavy source; current handling is weak |
| AutoTrader UK | 1,022 | 4 | 0.4% | Medium volume, likely hidden VIN; still worth structured payload audit |
| Cars & Bids | 27 historical/all rows | 27 | 100.0% | Small but good coverage |

## Current Scraper Classification

### Criticality Tiers

| Tier | Marketplace | Why |
|---|---|---|
| P0 | Elferspot | 3,881 active Porsche rows, only 20.8% identifier coverage, detail pages already parsed, high report impact if coverage improves. |
| P0 | BeForward | 538 active rows, low spec coverage, source exposes `Chassis No.`, but current pipeline stores it as `vin` and truncates values. High risk of losing useful chassis data. |
| P1 | AutoTrader UK | 1,022 active rows, almost no VIN coverage. Product-page parser currently sets structured VIN to null, so we need one focused payload audit before deprioritizing. |
| P1 | Bring a Trailer | Coverage is already high. Work is defensive: keep VIN/chassis extraction stable and classify pre-1981 identifiers properly. |
| P2 | Classic.com | Coverage is already excellent. Only minor normalization/classification work is useful. |
| P2 | Cars & Bids | Existing specs extraction supports `vin` and `chassis`; low volume. Protect with tests. |
| P2 | Collecting Cars | Existing specs extraction supports `vin`, `chassis number`, and `chassis`; low/auction volume. Protect with tests. |
| P3 | AutoScout24 | Largest source but nearly no VIN exposure despite detail/scrapling paths. Do a proof audit, then do not spend more VIN-specific effort unless the source exposes a field. |

### Source-Native Extraction Inventory

| Marketplace | Current identifier path | Gap |
|---|---|---|
| AutoTrader UK | `src/features/scrapers/autotrader_collector/detail.ts` HTML body regex; structured parser explicitly returns `vin: null`. | Audit `__NEXT_DATA__`/product payloads and only add extraction if the field exists. Avoid broad scraping work if marketplace does not publish VIN. |
| AutoScout24 | `src/features/scrapers/autoscout24_collector/detail.ts`, `src/features/scrapers/autoscout24_collector/scrapling.ts`, `scripts/as24_scrapling_fetch.py` check JSON-LD/body/Next data. | Existing code suggests the site does not expose VIN reliably. Add a small proof audit and then treat VIN as not available for AS24. |
| Classic.com | `src/features/scrapers/classic_collector/detail.ts` extracts `VIN:` from page text/specs and URL fallback. | Works. Preserve behavior and classify 17-char VIN versus shorter chassis values. |
| Elferspot | `src/features/scrapers/elferspot_collector/detail.ts` generic 17-char body regex; `src/app/api/cron/enrich-elferspot/route.ts` writes detail VIN. | Improve detail parser to prefer labeled fields and JSON-LD `vehicleIdentificationNumber`; add sample tests; improve detail enrichment targeting for active rows missing identifiers. |
| BeForward | `src/features/scrapers/beforward_porsche_collector/detail.ts` maps `Chassis No.` directly into `vin`; writers/enrichment truncate to 17 chars. | Treat as vehicle identifier, not always true VIN. Stop truncating blindly; preserve original chassis string where schema allows or classify before writing. |
| Bring a Trailer | `src/features/scrapers/auctions/bringATrailer.ts` extracts `vin|chassis|serial|frame` from keyed text and body. | Good extraction; add classification so pre-1981 chassis values do not get decoded as VINs. |
| Cars & Bids | `src/features/scrapers/auctions/carsAndBids.ts` reads specs `vin` or `chassis`. | Good extraction; add tests for both labels. |
| Collecting Cars | `src/features/scrapers/auctions/collectingCars.ts` reads specs `vin`, `chassis number`, `chassis`. | Good extraction; add tests for all labels. |

## File, LOC, Dependency Budget

Planned file budget:

| File | Action | Estimated LOC change |
|---|---|---:|
| `src/features/scrapers/common/vehicleIdentifier.ts` | Add tiny shared classifier/extractor for VIN/chassis labels | +160 |
| `src/features/scrapers/common/vehicleIdentifier.test.ts` | Unit tests for classifier/extractor | +220 |
| `src/features/scrapers/elferspot_collector/detail.ts` | Use classifier; add JSON-LD/labeled extraction | +60 |
| `src/features/scrapers/elferspot_collector/detail.test.ts` | Add/extend parser fixtures | +120 |
| `src/features/scrapers/beforward_porsche_collector/detail.ts` | Classify `Chassis No.` and avoid mislabeling where possible | +40 |
| `src/features/scrapers/beforward_porsche_collector/normalize.ts` | Preserve identifier semantics through normalization | +50 |
| `src/features/scrapers/beforward_porsche_collector/*.test.ts` | Update BeForward expectations around chassis/VIN | +120 |
| `src/features/scrapers/autotrader_collector/detail.ts` | Add targeted structured-payload identifier extraction if fixture proves field exists | +50 |
| `src/features/scrapers/autotrader_collector/detail.test.ts` | Add proof fixtures for present/absent VIN | +100 |
| `src/features/scrapers/auctions/*.test.ts` | Protect BaT/C&B/CollectingCars label handling | +160 |
| `scripts/vin-retrieval-audit.ts` | DB coverage audit by source/status/identifier type | +180 |
| `docs/scrapers/SCRAPERS.md` | Document source-native identifier behavior and priority | +100 |

Dependency budget:

- Runtime deps: **0**
- Dev deps: **0**
- Use existing TypeScript, Vitest, Supabase client, Cheerio, and scraper infrastructure.

Expected largest touched file remains under 1,000 LOC added/changed for this feature. If BeForward schema changes require a migration, create one migration file only after confirming the target columns.

## Design Decision

Introduce one shared feature-local helper:

`src/features/scrapers/common/vehicleIdentifier.ts`

This is justified despite the "rule of three" because the same concern already appears in more than three scraper families: AutoTrader, AutoScout24, Classic.com, Elferspot, BeForward, BaT, Cars & Bids, and Collecting Cars.

The helper should classify identifiers into:

- `vin_17`: 17-character VIN candidate, excluding I/O/Q
- `chassis_or_serial`: shorter or marketplace-native chassis/frame/serial identifier
- `invalid`: empty, too noisy, or clearly not a vehicle identifier

It should not call NHTSA and should not decode Porsche VINs. It only normalizes source-native values.

Target API:

```ts
export type VehicleIdentifierKind = "vin_17" | "chassis_or_serial" | "invalid";

export type VehicleIdentifier = {
  raw: string;
  normalized: string;
  kind: VehicleIdentifierKind;
  sourceLabel: string | null;
};

export function classifyVehicleIdentifier(raw: string | null | undefined, sourceLabel?: string | null): VehicleIdentifier | null;

export function extractVehicleIdentifierFromText(text: string, options?: {
  labels?: string[];
  allowGenericVin?: boolean;
}): VehicleIdentifier | null;
```

## Implementation Phases

### Phase 1: Add Identifier Classification Boundary

Files:

- `src/features/scrapers/common/vehicleIdentifier.ts`
- `src/features/scrapers/common/vehicleIdentifier.test.ts`

Tasks:

1. Add `classifyVehicleIdentifier`.
2. Accept real 17-character VINs as `vin_17`.
3. Accept source-labeled values such as `Chassis No.`, `chassis`, `serial`, and `frame` as `chassis_or_serial` when shorter than 17 but at least 5 alphanumeric characters.
4. Reject unlabeled short values.
5. Normalize whitespace, uppercase letters, remove obvious separators, but keep the raw value available.
6. Add tests for:
   - `WP0AA299XYS123456` => `vin_17`
   - `WP0ZZZ99Z` with label `Chassis No.` => `chassis_or_serial`
   - lowercase VIN => uppercase `vin_17`
   - values containing I/O/Q => invalid as `vin_17`
   - generic body text with labeled VIN
   - generic body text with labeled chassis

Pass criteria:

- `npx vitest run src/features/scrapers/common/vehicleIdentifier.test.ts`

### Phase 2: Fix P0 Elferspot Retrieval

Files:

- `src/features/scrapers/elferspot_collector/detail.ts`
- `src/features/scrapers/elferspot_collector/detail.test.ts`
- `src/app/api/cron/enrich-elferspot/route.ts` only if detail targeting currently skips active rows missing identifiers

Tasks:

1. Parse `vehicleIdentificationNumber` from JSON-LD if present.
2. Parse labeled text fields before generic 17-character body regex:
   - `VIN`
   - `Chassis`
   - `Chassis number`
   - `Frame`
   - `Serial`
3. Keep generic 17-character body regex as fallback only.
4. Ensure `enrich-elferspot` targets active rows where `vin` is null, not just rows missing unrelated detail fields.
5. Keep writes compatible with the current `listings.vin` column until schema is updated.

Pass criteria:

- `npx vitest run src/features/scrapers/elferspot_collector/detail.test.ts`
- A dry audit shows active Elferspot missing-identifier rows are selected by the enrichment query.

### Phase 3: Fix P0 BeForward Semantics

Files:

- `src/features/scrapers/beforward_porsche_collector/detail.ts`
- `src/features/scrapers/beforward_porsche_collector/normalize.ts`
- `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- `src/app/api/cron/enrich-beforward/route.ts`
- Existing BeForward tests adjacent to those files

Tasks:

1. Classify `Chassis No.` with the shared helper.
2. Stop treating every BeForward `Chassis No.` as a true 17-character VIN.
3. Remove blind truncation as the semantic default. If the database column still forces 17 chars, do not silently truncate without logging/classifying the discarded value.
4. If schema support exists for a separate chassis/source identifier field, write:
   - `vin` only for `vin_17`
   - chassis/source identifier into the separate field
5. If no schema support exists, produce a follow-up migration proposal rather than stuffing non-VIN chassis values into `vin`.
6. Update tests that currently expect long VIN truncation to instead assert classification and no silent data loss.

Pass criteria:

- `npx vitest run src/features/scrapers/beforward_porsche_collector src/app/api/cron/enrich-beforward`
- BeForward rows no longer convert valid chassis identifiers into misleading truncated VINs.

### Phase 4: P1 AutoTrader Proof Audit

Files:

- `src/features/scrapers/autotrader_collector/detail.ts`
- `src/features/scrapers/autotrader_collector/detail.test.ts`
- `scripts/autotrader_scrapling_fetch.py` only if the Python detail path is the actual source of detail HTML for VIN fields

Tasks:

1. Add fixture-driven tests for current product-page payloads.
2. Search parsed payloads for fields named:
   - `vin`
   - `vehicleIdentificationNumber`
   - `chassis`
   - `chassisNumber`
   - `frame`
   - `serial`
3. If no such field exists in current fixtures/pages, mark AutoTrader as "VIN not source-exposed" in `SCRAPERS.md`.
4. If a field exists, map it through `classifyVehicleIdentifier`.
5. Keep HTML fallback extraction, but do not rely on broad body regex unless the page has an identifier label nearby.

Pass criteria:

- `npx vitest run src/features/scrapers/autotrader_collector/detail.test.ts`
- Audit note states whether AutoTrader is fixable or source-limited.

### Phase 5: Protect Auction Scrapers

Files:

- `src/features/scrapers/auctions/bringATrailer.ts`
- `src/features/scrapers/auctions/bringATrailer.test.ts`
- `src/features/scrapers/auctions/carsAndBids.ts`
- `src/features/scrapers/auctions/carsAndBids.test.ts`
- `src/features/scrapers/auctions/collectingCars.ts`
- `src/features/scrapers/auctions/collectingCars.test.ts`

Tasks:

1. Keep current BaT extraction behavior for labels `vin`, `chassis`, `serial`, and `frame`.
2. Add tests for pre-1981 chassis identifiers and modern VINs.
3. Add Cars & Bids tests for both `VIN` and `Chassis`.
4. Add Collecting Cars tests for `VIN`, `Chassis Number`, and `Chassis`.
5. Do not refactor auction code broadly unless tests expose an actual bug.

Pass criteria:

- `npx vitest run src/features/scrapers/auctions`

### Phase 6: Classify AutoScout24 as Source-Limited Unless Proven Otherwise

Files:

- `src/features/scrapers/autoscout24_collector/detail.ts`
- `src/features/scrapers/autoscout24_collector/scrapling.ts`
- `scripts/as24_scrapling_fetch.py`
- `docs/scrapers/SCRAPERS.md`

Tasks:

1. Run a small sampled detail audit of active AS24 URLs with missing VIN.
2. Check whether `__NEXT_DATA__`, JSON-LD, or spec tables expose a VIN/chassis field.
3. If no field is exposed, document AutoScout24 as not a VIN retrieval priority.
4. Only change parser code if the audit finds a real field.

Pass criteria:

- Audit artifact stored under `agents/testscripts/artifacts/`.
- `SCRAPERS.md` clearly says AS24 VIN retrieval is source-limited unless future page structure changes.

### Phase 7: Add Coverage Audit Script

Files:

- `scripts/vin-retrieval-audit.ts`

Tasks:

1. Read `.env.local` and `.env` the same way `scripts/scraper-health-audit.ts` does.
2. Query active Porsche listings grouped by source.
3. Report:
   - total active rows
   - `vin` non-null rows
   - 17-character VIN-looking rows
   - short chassis/serial-looking rows
   - invalid/noisy identifier rows
4. Write JSON artifact to `agents/testscripts/artifacts/vin-retrieval-audit-<timestamp>.json`.
5. Print a compact table for operator use.

Pass criteria:

- `npx tsx scripts/vin-retrieval-audit.ts --make=Porsche --status=active`
- Artifact includes per-source counts and sample redacted identifiers.

### Phase 8: Documentation and V3 Decision Gate

Files:

- `docs/scrapers/SCRAPERS.md`

Tasks:

1. Add a "Vehicle Identifier Retrieval" subsection.
2. Document each marketplace as:
   - strong source-native VIN
   - source-native chassis/serial
   - source-limited/no reliable VIN
3. State that `enrich-vin` only decodes existing VINs and does not retrieve missing identifiers.
4. Add a v3 report gate:
   - VIN/chassis intelligence may be shown opportunistically per listing.
   - It should not become a prominent report section until active VIN/chassis coverage materially improves or the report UI clearly handles missing values.

Pass criteria:

- Docs match the latest audit output.

## Testscript

Identifier retrieval implementation should finish with:

```powershell
npx vitest run src/features/scrapers/common/vehicleIdentifier.test.ts
npx vitest run src/features/scrapers/elferspot_collector src/features/scrapers/beforward_porsche_collector src/features/scrapers/auctions
npx tsx scripts/vin-retrieval-audit.ts --make=Porsche --status=active
```

If AutoTrader or AutoScout24 parser code is touched:

```powershell
npx vitest run src/features/scrapers/autotrader_collector src/features/scrapers/autoscout24_collector
```

Regression check before using this in reports:

```powershell
npm test -- --runInBand
```

If Vitest rejects `--runInBand`, use:

```powershell
npm test
```

## Recommendation

Proceed in this order:

1. Build the shared identifier classifier.
2. Fix Elferspot retrieval.
3. Fix BeForward chassis semantics.
4. Add the audit script and rerun DB coverage.
5. Only then decide whether v3 should surface VIN/chassis intelligence beyond small opportunistic facts.

AutoScout24 should not consume more VIN-specific effort unless the proof audit finds a source-exposed field. AutoTrader should get one structured-payload proof pass because the current parser explicitly returns `vin: null`, but it should be stopped quickly if the marketplace does not publish VIN.
