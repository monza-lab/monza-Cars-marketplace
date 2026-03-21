# 100% Data Quality: Source-by-Source Enrichment

## Problem

29,422 active Porsche listings across 5 sources average only 69% field completeness. AutoTrader (6,214 listings) has 0% enrichment beyond title+price. AutoScout24 (15,988 listings) lacks VIN/engine/colors entirely. ClassicCom (2,775 listings) is missing prices on 96% of records. The current `enrich-details` cron only processes 25 AS24 listings per run.

## Goal

Achieve >90% field completeness across all sources within 30 days by building source-specific detail enrichment crons, scaling existing enrichment throughput 10x, and hardening the title parsing pipeline.

## Approach

Independent enrichment cron per source, following the proven `enrich-details` pattern. Each is testable and deployable separately. No shared dispatch layer — YAGNI for 5 sources.

## Current Field Completeness (Active Listings, from Supabase 2026-03-21)

| Field | AS24 (15,988) | AutoTrader (6,214) | BaT (23) | ClassicCom (2,775) | BeForward (4,422) |
|---|---|---|---|---|---|
| VIN | 0% | 0% | 96% | 91% | 80% |
| Trim | 3% | 7% | 83% | 4% | 0% |
| Engine | 0% | 0% | 83% | 8% | 79% |
| Transmission | 47% | 0% | 91% | 5% | 80% |
| Mileage | 100% | 0% | 87% | 4% | 100% |
| Color Ext. | 0% | 0% | 74% | 4% | 80% |
| Color Int. | 0% | 0% | 83% | 4% | 0% |
| Body Style | 1% | 0% | 43% | 8% | 0% |
| Price | 100% | 100% | 13% | 4% | 100% |
| Images | 100% | 100% | 100% | 100% | 100% |

---

## Section 1: AutoScout24 Enrichment Scale-Up

### Current State

- Cron: `/api/cron/enrich-details` — 25 listings/run, 2s delay, 5-min budget
- Method: HTTP + Cheerio `parseDetailHtml()` (no Playwright)
- Query: `source = 'AutoScout24' AND status = 'active' AND trim IS NULL`
- Gap: 15,988 listings need enrichment. At 25/run = 640 runs needed.

### Design

**A. Vercel cron increase: 25 → 100/run**
- Reduce inter-request delay from 2s → 1s
- Process up to 100 listings within the 5-min budget
- Keep `maxDuration: 300` — actual budget ~270s after overhead
- Priority: `ORDER BY updated_at ASC` (oldest-updated first, matching current `enrich-details` behavior)

**B. New GitHub Actions workflow: `autoscout24-enrich.yml`**
- Runs daily after the collector (schedule: `30 6 * * *`)
- Reuses `parseDetailHtml()` from `autoscout24_collector/`
- Processes 500 listings/run with 1s delay
- Time budget: 30 minutes
- Records run via `recordScraperRun()` as `enrich-details-bulk`

**C. "Attempted" marker**
- After fetching a detail page, set `trim = ''` (empty string) if no trim found
- This distinguishes "enrichment attempted, no trim available" from "never enriched" (`trim IS NULL`)
- Prevents re-processing the same listing
- **Code change required:** Current `enrich-details` route skips the DB update entirely when `newFieldCount === 0` (line ~132). Must modify to write `trim = ''` even when no other fields are extracted

### Expected Throughput

600 listings/day → all 15,988 covered in ~27 days.

### Fields Extracted by `parseDetailHtml()`

`trim`, `transmission`, `bodyStyle`, `engine`, `color_exterior`, `color_interior`, `vin`, `description`, `images`

---

## Section 2: AutoTrader UK Detail Enrichment

### Current State

- 6,214 active listings
- 100% null on: mileage, engine, transmission, VIN, colors, body_style, trim
- Collector uses GraphQL API (`SearchResultsListingsGridQuery`) for search results only — returns title, price, images, location
- Detail data is already available via HTML scraping: `fetchAutoTraderData()` in `collector.ts` parses detail pages with Cheerio

### Design

**New cron route: `/api/cron/enrich-autotrader`**

**Source file:** `src/app/api/cron/enrich-autotrader/route.ts`

**Prerequisites:**
- Export `fetchAutoTraderData` and `ScrapedAutoTraderData` from `collector.ts` (currently module-private), or extract to a dedicated `autotrader_collector/detail.ts` module (consistent with AS24 and BeForward patterns)
- Fix VIN extraction: change `$("text").text()` to `$("body").text()` for regex matching (current code searches SVG `<text>` elements, missing VIN data)

**Method:** Reuse the existing `fetchAutoTraderData(url)` function from `autotrader_collector/collector.ts`. This function fetches the listing's HTML detail page and parses it with Cheerio using `data-testid` selectors. No GraphQL API exists for per-listing detail — all enrichment comes from HTML scraping.

**Query flow:**
1. Fetch active AutoTrader listings where `engine IS NULL` (proxy for unenriched)
2. For each listing, use its `source_url` (e.g., `https://www.autotrader.co.uk/car-details/{advertId}`)
3. Call `fetchAutoTraderData(source_url)` which extracts:
   - `engine` (via `[data-testid='engine']` or `[class*="engine"]`)
   - `transmission` (via `[data-testid='transmission']` or `[class*="transmission"]`)
   - `mileage` (via `[data-testid='mileage']` or `[class*="mileage"]`, parsed as number)
   - `exteriorColor` (via `[data-testid='exterior-color']` or `[class*="exterior"]`)
   - `vin` (17-char VIN regex match in page text, after VIN selector fix)
   - `description` (via `[data-testid='description']`)
4. Update listing with extracted fields
5. Set `engine = ''` (empty string) if no engine found — marks as "attempted"

**NOT currently extractable** (hardcoded to `null` in `fetchAutoTraderData()`):
- `bodyStyle` — no selector implemented; would require adding new selectors targeting AutoTrader's vehicle spec section
- `interiorColor` — no selector implemented

**Throughput:** 100 listings/run, 1s delay between requests

**Time budget math:** 100 listings × (1s delay + ~1s fetch/parse) = ~200s. Within `maxDuration: 300` (5-min budget with ~270s usable).

**Schedule:** `45 7 * * *` in vercel.json (after enrich-details at 07:30)

**maxDuration:** 300s

**Expected coverage:** 100 listings/day → all 6,214 in ~62 runs (~2 months). Consider adding GH Actions workflow for bulk catch-up (500/run, 30-min budget) to finish in ~13 days.

**Error handling:**
- `fetchAutoTraderData()` returns all-null on any error (timeout, parse failure) — skip and retry next run
- 404/410 response: Mark listing as `delisted`
- Track consecutive failures; circuit-break at 5 failures in a row (likely rate-limited or blocked)
- Record via `recordScraperRun()` as `enrich-autotrader`

**Limitations:**
- Cheerio-based (no JS execution) — if AutoTrader moves spec fields to client-side rendering, this will break
- VIN extraction relies on regex; UK AutoTrader may show registration (VRN) rather than ISO VIN
- AutoTrader may rate-limit or block after sustained scraping; monitor 403 rates

---

## Section 3: ClassicCom Price & Detail Fix

### Current State

- 2,775 active listings, 2,674 (96%) missing price
- Scraper runs with `summaryOnly=true` on Vercel cron → skips detail pages
- GitHub Actions collector fetches detail but has been failing (fixed in this session)
- Classic.com is Cloudflare-protected (needs proxy for Playwright)

### Root Cause (needs investigation)

The Vercel cron (`/api/cron/classic`) runs with `summaryOnly=true` and `maxPages=3`. The GitHub Actions collector (which fetches detail pages) has been failing since March 18 due to path restructure (now fixed). Root cause of missing prices requires investigation:

1. Does the search page parser extract price from listing cards? (Check `discover.ts` selectors)
2. Does `summaryOnly=true` skip price extraction?
3. Are these genuinely "Contact for Price" listings?
4. Is Cloudflare blocking price-bearing pages?

**First step:** Run the fixed GH Actions collector and check if new listings get prices. If yes, the issue was simply that the detail-page collector was broken.

### Design

**A. Fix search-page price extraction**

Investigate `classic_collector/`'s search page parser. Classic.com shows price on search cards as `$XX,XXX`. Ensure the Cheerio/Playwright extractor captures it.

**B. New `enrich-classic` cron for existing null-price listings**

- Route: `/api/cron/enrich-classic`
- Query: Active ClassicCom listings where `current_bid IS NULL OR current_bid = 0`
- Method: HTTP fetch of `source_url` (Classic.com detail pages render prices in initial HTML for most listings). Try Cheerio first; fall back to Playwright if Cloudflare blocks.
- Extract: `price`, `mileage`, `engine`, `transmission`, `color_exterior`, `body_style`
- Throughput: 25 listings/run (Classic.com is aggressive with rate limiting)
- Delay: 3s between requests
- Schedule: Add as GitHub Actions step in `classic-collector.yml` (needs Playwright)

**C. "Contact for Price" handling**

If a listing genuinely has no numeric price (dealer says "call"), set `current_bid = -1` as a sentinel value. This distinguishes "no price available" from "not scraped" (`NULL`). No schema changes needed — `current_bid` is already a numeric column. The dashboard should filter out `current_bid <= 0` when computing price statistics.

### Expected Coverage

~110 runs to cover 2,674 listings. With daily GH Actions: ~4 months.
Alternatively, run GH Actions workflow with higher throughput (100/run, 45-min budget): ~27 days.

---

## Section 4: BeForward Detail Enrichment

### Current State

- 4,422 active listings
- 100% missing: trim (parsed from title in `parseDetailHtml()`)
- 20% missing: VIN, engine, color_exterior
- 0% have: interior color, body style — **not available** on BeForward detail pages
- Mileage: 100% complete (from search results)

### Design

**New cron route: `/api/cron/enrich-beforward`**

**Source file:** `src/app/api/cron/enrich-beforward/route.ts`

**Method:** Reuse `parseDetailHtml()` from `beforward_porsche_collector/detail.ts` (Cheerio, no Playwright). The existing BeForward cron already does image backfill using detail pages — this extends it to spec fields.

**Query:** Active BeForward listings where `trim IS NULL`

**Fields extracted by `parseDetailHtml()`:**
- `trim` (parsed from page title after make + model)
- `engine` (from specs table "Engine Size" field)
- `transmission` (from specs table "Transmission" field)
- `color_exterior` (from specs table "Ext. Color" field)
- `vin` (from specs table "Chassis No." field)
- `fuel` (from specs table "Fuel" field)
- `drive` (from specs table "Drive" field)
- `modelCode` (from specs table "Model Code" field)

**NOT extractable** (BeForward pages don't show these):
- `color_interior` — hardcoded to `null` in parser; not present on BeForward pages
- `body_style` — not present in BeForward specs table; hardcoded to `null` in normalizer

**Throughput:** 50 listings/run, 2s delay (BeForward rate-limits at ~100 req/5min)

**Schedule:** `0 8 * * *` in vercel.json

**maxDuration:** 300s

**Expected coverage:** All 4,422 in ~88 runs (~3 months).
Consider adding GH Actions workflow for bulk catch-up: 200/run → 22 runs → 22 days.

---

## Section 5: Title Parsing Hardening

### Current State

- `enrich-titles` processes 5,000 listings/run (CPU-only, no API calls)
- Uses regex patterns: `parseEngineFromText()`, `parseTransmissionFromText()`, `parseBodyStyleFromText()`, `parseTrimFromText()`
- Known false positive patterns exist (e.g., "fuel capacity 5 gallons" → "5-speed") but no systematic measurement of false positive rate
- No test suite beyond unit tests

### Design

**A. Context guards**

Add negative-context rules to each parser:
- Engine: Reject if preceded by "fuel", "capacity", "tank", "miles"
- Transmission: Reject if preceded by "fuel", "gauge", "dial"
- Body style: Reject if preceded by "color", "paint", "finish"

**B. Word-boundary enforcement**

Ensure patterns match on word boundaries only. Example:
- Current: `/(\d\.\d)L/` matches "3.8L" and "13.8Lbs"
- Fixed: `/\b(\d\.\d)\s*[Ll](?:iter|itre)?\b/`

**C. Test suite (200+ cases)**

Build from real listing titles across all sources:
- 100 BaT titles (highest quality, serve as ground truth)
- 50 AS24 titles (European format, metric)
- 30 AutoTrader titles (UK format)
- 20 BeForward titles (Japanese export format)

Each case: `{ input: title, expected: { engine, transmission, bodyStyle, trim } }`

**D. Accuracy metric**

After parsing, record `title_parse_fields_extracted: number` in the enrichment run stats. Track extraction rate over time.

---

## Section 6: Field-Level Monitoring

### Current State

- `scraper_runs` tracks run-level metrics (discovered, written, errors)
- No field-level completeness tracking
- No trend detection or regression alerting
- Admin dashboard at `/admin/scrapers` shows run history only

### Design

**A. New Supabase RPC function: `field_completeness_by_source()`**

```sql
CREATE OR REPLACE FUNCTION field_completeness_by_source()
RETURNS TABLE (
  source TEXT,
  total_active BIGINT,
  pct_vin NUMERIC,
  pct_trim NUMERIC,
  pct_engine NUMERIC,
  pct_transmission NUMERIC,
  pct_mileage NUMERIC,
  pct_color_ext NUMERIC,
  pct_color_int NUMERIC,
  pct_body_style NUMERIC,
  pct_price NUMERIC,
  pct_images NUMERIC
) AS $$
  SELECT
    source,
    COUNT(*)::BIGINT AS total_active,
    ROUND(100.0 * COUNT(vin) / NULLIF(COUNT(*), 0), 1) AS pct_vin,
    ROUND(100.0 * COUNT(trim) / NULLIF(COUNT(*), 0), 1) AS pct_trim,
    -- ... etc for each field
  FROM listings
  WHERE status = 'active'
  GROUP BY source
  ORDER BY source;
$$ LANGUAGE sql STABLE;
```

**B. Dashboard integration**

Add a "Field Completeness" card to the existing `/admin/scrapers` page:
- Heatmap: source (rows) x field (columns), color-coded by completion %
- Green: >90%, Yellow: 50-90%, Red: <50%
- Updated on each page load (query is lightweight, single table scan with GROUP BY)

**C. Daily snapshots (optional, Phase 2)**

Store daily completeness percentages in a `field_completeness_snapshots` table for trend tracking. Detect regressions: "AS24 engine% dropped from 45% to 12% yesterday."

---

## Implementation Order

| Priority | Section | Effort | Impact (listings affected) |
|----------|---------|--------|---------------------------|
| 1 | AS24 Scale-Up (Section 1) | 4h | 15,988 |
| 2 | AutoTrader Enrichment (Section 2) | 4h | 6,214 |
| 3 | BeForward Enrichment (Section 4) | 4h | 4,422 |
| 4 | ClassicCom Price Fix (Section 3) | 6h | 2,775 |
| 5 | Title Parsing (Section 5) | 4h | All 29,422 |
| 6 | Monitoring (Section 6) | 3h | Observability |

**Total estimated effort:** ~25 hours across 6 independent work streams.

---

## Success Criteria

- Average field completeness across all sources: >90% (up from 69%)
- No source below 70% completeness
- AutoTrader: mileage, engine, transmission, exteriorColor populated on >80% of listings
- AS24: trim, engine, colors populated on >80% of listings
- ClassicCom: price populated on >60% of listings (excluding genuine "Contact for Price")
- Title parsing: test suite of 200+ real titles passing with <10% false positive rate
- Field-level monitoring live on admin dashboard

## Non-Goals

- Adding new scraper sources (no new marketplaces)
- ML-based extraction (regex hardening is sufficient for now)
- Cross-source deduplication (separate project)
- Real-time enrichment (batch cron is sufficient)
