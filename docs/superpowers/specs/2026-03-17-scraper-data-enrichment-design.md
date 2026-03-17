# Scraper Data Enrichment Design

## Goal

Fill missing data fields across 40,308 listings in the Supabase `listings` table by improving existing scrapers and adding free enrichment sources — without paying for proxies or third-party services.

## Context

An audit of the listings table revealed significant data gaps:

| Source | Total | Key Missing Fields | Root Cause |
|--------|------:|-------------------|------------|
| **AutoTrader** | 6,491 | mileage (100%), engine (100%), transmission (100%), VIN (100%), colors (100%) | GraphQL query doesn't request available fields |
| **BaT** | 5,297 | images (93%), mileage (94%), engine (95%), VIN (94%), colors (95%) | `scrapeDetails: false` in cron (Vercel 5-min limit) |
| **AutoScout24** | 19,024 | engine (100%), VIN (100%), colors (100%), trim (100%) | Never runs with `scrapeDetails: true` |
| **ClassicCom** | 4,802 | images (73%), mileage (74%), engine (74%), transmission (74%) | `summaryOnly=true` + Cloudflare blocks without proxy |
| **BeForward** | 4,694 | images (14%), engine (19%), VIN (18%) | 18% are summary-only; image backfill in progress |

## Constraints

- No paid proxy services (Decodo/SmartProxy)
- No new third-party paid APIs
- Must not break existing scraper architecture
- Vercel cron limit: 300s (5 minutes)
- GitHub Actions: 45-minute timeout, free for 2000 min/month. Current usage: Classic.com collector (~20 min/day) + AS24 collector (~20 min/day) ≈ 1200 min/month. Adding BaT detail scraper (~30 min/day) brings total to ~2100 min/month — slightly over budget. Mitigate by reducing BaT to 20 min/day or running every other day.

## Architecture

Four independent phases, ordered by effort/risk. Each phase is a standalone improvement that delivers value independently.

### Phase 1A: Expand AutoTrader GraphQL Query

**Problem:** The GraphQL query requests only 5 fields, but the schema exposes ~15 more.

**Solution:** Add `mileage`, `fuelType`, `transmission`, `engineSize`, `bodyType`, `colour`, `doors`, `registration` to the existing `SearchResultsListingsGridQuery` in `autotrader_collector/discover.ts`. Update the normalizer to map these new fields.

**Files:**
- Modify: `src/features/scrapers/autotrader_collector/discover.ts` — expand GraphQL query + `GatewayListing` interface
- Modify: `src/features/scrapers/autotrader_collector/collector.ts` — update `ActiveListingBase` interface and `scrapeActiveListings()` to pass new fields
- Modify: `src/features/scrapers/autotrader_collector/normalize.ts` — map new GraphQL fields to DB columns

**Validation step (required):** GraphQL rejects unknown fields — it does NOT silently return null. Before expanding the query, we must discover which fields actually exist in AutoTrader's schema. Approach:
1. Make a single test request with one new field (e.g., `mileage`). If the response is 200 with data, the field exists.
2. If the field is rejected (400 error or `errors` array), try alternative field names (e.g., `odometerReading`, `miles`, `derivedMileage`).
3. Repeat for each candidate field. Only add confirmed fields to the production query.
4. Alternative: Use a GraphQL introspection query (`__schema { types { name fields { name } } }`) — many public GraphQL APIs leave introspection enabled.

**Full data pipeline:** The expanded fields must flow through the entire pipeline:
- `discover.ts`: Add fields to the GraphQL query and to the `GatewayListing` TypeScript interface
- `collector.ts`: Update the `ActiveListingBase` interface and `scrapeActiveListings()` to pass new fields through
- `normalize.ts`: Map the new GraphQL field names to the `listings` table column names

**Risk:** Low-Medium. The query expansion itself is safe (test one field at a time). The main risk is that AutoTrader may use non-obvious field names — the validation step mitigates this.

**Impact:** 6,491 listings gain mileage, engine, transmission, body type, color.

### Phase 1B: NHTSA Batch VIN Decoder

**Problem:** ~8,000 listings have VINs but missing engine/transmission/body data.

**Solution:** Use the free NHTSA vPIC API (`vpic.nhtsa.dot.gov`) to batch-decode VINs (50 at a time) and fill in engine, transmission, body_style, drive_type where null.

**Files:**
- Create: `src/features/scrapers/common/nhtsaVinDecoder.ts` — batch decode function
- Create: `scripts/enrich-from-vin.ts` — CLI script
- Create: `src/app/api/cron/enrich-vin/route.ts` — daily cron endpoint
- Modify: `vercel.json` — add cron schedule

**API details:**
- Endpoint: `POST https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/`
- Input: semicolon-separated VINs (max 50)
- Returns: Make, Model, BodyClass, DriveType, EngineConfiguration, EngineCylinders, DisplacementL, FuelTypePrimary, TransmissionStyle, Doors
- Rate limit: No documented limit, but use 1-second delay between batches
- Free, no API key required

**Risk:** Low. NHTSA is a US government API, stable and free. Only works for vehicles sold in the US market (covers BaT, some ClassicCom). European VINs (AutoScout24) may return partial data.

**Impact:** ~8,000 listings gain engine, transmission, body_style from VIN data.

### Phase 1C: Title Parsing Enrichment

**Problem:** Many listing titles contain engine, transmission, and trim info that isn't extracted.

**Solution:** Write new regex-based parsers that extract structured data from listing titles and descriptions. BaT's `scrapeDetail()` has internal parsers, but they operate on structured HTML elements (essentials lists), not free-form text — they cannot be directly reused. The title parsers are new code, inspired by the same patterns but designed for unstructured title strings.

**Files:**
- Create: `src/features/scrapers/common/titleEnrichment.ts` — new regex-based parsers for free-form text
- Create: `scripts/enrich-from-titles.ts` — CLI script
- Create: `src/app/api/cron/enrich-titles/route.ts` — daily cron endpoint (lightweight, runs in seconds)

**Parsers to create (new code):**
- `parseEngineFromText(text)` — matches displacement patterns (e.g., "3.8L", "4.0-liter"), V-config (V6, V8, flat-six), forced induction (turbo, supercharged)
- `parseTransmissionFromText(text)` — matches speed+type patterns (e.g., "6-speed manual", "PDK", "7-speed DCT", "automatic")
- `parseBodyStyleFromText(text)` — matches body keywords (coupe, cabriolet, targa, spider, convertible, SUV, sedan, wagon)
- `parseTrimFromText(text)` — matches known Porsche trims (GT3, GT3 RS, Turbo, Turbo S, Carrera, GTS, 4S, Targa 4S) and common collector car trims

**Risk:** Low. Title parsing is best-effort — only writes to null fields, never overwrites existing data.

**Impact:** ~15,000 listings gain partial engine/transmission/trim data from titles.

### Phase 2: BaT Detail Scraping via GitHub Actions

**Problem:** BaT detail scraping (`scrapeDetail()`) is fully implemented but disabled in the Vercel cron because it exceeds the 5-minute limit.

**Solution:** Create a GitHub Actions workflow that runs BaT detail scraping with a 30-minute budget. BaT is plain HTTP (no Cloudflare, no Playwright needed), so this is lightweight.

**Files:**
- Create: `scripts/bat-detail-scraper.ts` — CLI that queries Supabase for BaT listings missing key fields, fetches detail pages, updates DB
- Create: `.github/workflows/bat-detail-scraper.yml` — daily workflow at 01:30 UTC (after porsche cron at 01:00)

**Design:**
- Query: BaT listings where `images = '{}'` OR `engine IS NULL` OR `mileage IS NULL`
- Rate limit: 2.5s between requests (matches existing BaT delay)
- Budget: 30 minutes → ~700 listings per run
- Reuses existing `scrapeDetail()` from `bringATrailer.ts`
- Records to `scraper_runs` monitoring table

**Pre-flight check (required):** `bringATrailer.ts` has `@ts-nocheck` at line 1, meaning TypeScript errors are silently ignored. Before batch-running `scrapeDetail()` against thousands of listings:
1. Test `scrapeDetail()` against 5-10 known BaT URLs with expected data (verify non-null images, mileage, engine).
2. If any return null for fields that are visibly present on the page, investigate and fix before batch run.
3. Consider removing `@ts-nocheck` and fixing type errors as a preparatory sub-task.

**Risk:** Low. BaT doesn't aggressively rate-limit. The existing scraper already works; this just runs it with more time. The `@ts-nocheck` flag adds minor risk — the pre-flight check mitigates it.

**Impact:** 4,930 BaT listings gain images, mileage, engine, transmission, VIN, colors, description.

### Phase 3: Classic.com Cloudflare Bypass with rebrowser-patches

**Problem:** Classic.com uses Cloudflare, and without a paid proxy the headless browser gets blocked after 1-2 requests.

**Solution:** Replace `playwright` with `rebrowser-playwright` — a free, drop-in replacement that patches CDP (Chrome DevTools Protocol) leaks that Cloudflare uses to detect automation. Currently undetectable by Cloudflare as of March 2026.

**Files:**
- Modify: `package.json` — add `rebrowser-playwright` dependency
- Modify: `src/features/scrapers/classic_collector/browser.ts` — change import from `playwright-core` to `rebrowser-playwright`

**Scope note:** `classic_collector/browser.ts` imports from `common/serverless-browser.ts`. Changing the import in `serverless-browser.ts` would affect ALL browser-based scrapers (ClassicCom AND AutoScout24). Instead, only change the import in `classic_collector/browser.ts` itself. If `browser.ts` re-exports or delegates to `serverless-browser.ts`, create a separate browser launcher in `browser.ts` that uses `rebrowser-playwright` directly, keeping the shared module unchanged.

**How rebrowser-patches works:**
- Patches the `Runtime.Enable` CDP command that anti-bot systems use to detect Playwright/Puppeteer
- Removes CDP serialization patterns that fingerprint automation
- Sets `navigator.webdriver` to false at the browser engine level (not JavaScript)
- Maintains full Playwright API compatibility

**Risk:** Medium. Cloudflare evolves detection. This works now (March 2026) but may break in the future. However, it's free and the code change is minimal (one import). If it stops working, we revert and fall back to the proxy approach.

**Testing:** Run the existing `scripts/backfill-classic-images.ts` with the new dependency. If it backfills >10 listings without Cloudflare blocks, it works.

**Impact:** 2,951 ClassicCom listings gain images, mileage, engine, transmission, colors, trim.

### Phase 4: AutoScout24 Plain HTTP for Search Pages (Experimental)

**Problem:** AutoScout24 uses Playwright for search pages, but the data is embedded in `__NEXT_DATA__` JSON in the initial HTML. If we can fetch with plain HTTP, scraping becomes 10x faster.

**Solution:** Try `node-curl-impersonate` with Chrome TLS fingerprint for AutoScout24 search pages. Extract `__NEXT_DATA__` from the raw HTML response.

**Files:**
- Create: `src/features/scrapers/autoscout24_collector/httpDiscover.ts` — plain HTTP discovery using curl-impersonate
- Modify: `src/features/scrapers/autoscout24_collector/collector.ts` — add option to use HTTP discovery

**Risk:** High. Akamai may block curl-impersonate. This is experimental — if it fails, we keep the existing Playwright approach and rely on Phases 1B/1C for data enrichment.

**Impact:** If it works, AutoScout24 scraping becomes viable on Vercel (no Playwright), potentially enabling detail page enrichment.

## Data Flow

```
Existing listings (40,308)
  │
  ├─ Phase 1A: AutoTrader GraphQL expansion
  │   └─ Next cron run fills mileage/engine/transmission/color for 6,491 AT listings
  │
  ├─ Phase 1B: NHTSA VIN decoder (daily cron)
  │   └─ Batch-decodes VINs → fills engine/transmission/body for ~8,000 listings
  │
  ├─ Phase 1C: Title enrichment (daily cron)
  │   └─ Parses titles → fills engine/transmission/trim for ~15,000 listings
  │
  ├─ Phase 2: BaT detail scraper (GitHub Actions daily)
  │   └─ Fetches detail pages → fills images/mileage/engine/VIN/colors for 4,930 listings
  │
  ├─ Phase 3: Classic.com rebrowser-patches
  │   └─ Bypasses Cloudflare → fills images/mileage/engine/colors for 2,951 listings
  │
  └─ Phase 4: AS24 HTTP discovery (experimental)
      └─ If works: faster scraping, potentially enables detail enrichment
```

## Testing Strategy

- **Phase 1A:** Run one AutoTrader cron cycle, compare field counts before/after
- **Phase 1B:** Decode 10 VINs manually, verify accuracy against known specs
- **Phase 1C:** Run against 100 titles, manually spot-check parsed values
- **Phase 2:** Run CLI with `--limit 10`, verify images/mileage appear in DB
- **Phase 3:** Run classic backfill with `--maxListings=20`, verify >10 succeed without Cloudflare block
- **Phase 4:** Fetch 3 AS24 search URLs with curl-impersonate, check if `__NEXT_DATA__` is present

## Schedule (after implementation)

```
00:00  Ferrari Collector        (Vercel Cron)
01:00  Porsche Collector        (Vercel Cron)
01:30  BaT Detail Scraper       (GitHub Actions)     ← NEW
02:00  AutoTrader Collector     (Vercel Cron)         ← Enhanced with more fields
03:00  BeForward Collector      (Vercel Cron)
04:00  Classic.com Collector    (GitHub Actions)
04:30  Classic.com Image Backfill (GitHub Actions)    ← Now works without proxy
05:00  AutoScout24 Collector    (GitHub Actions)
05:30  Listing Validator        (Vercel Cron)
06:00  Cleanup                  (Vercel Cron)
06:30  Image Backfill           (Vercel Cron)
07:00  VIN Enrichment           (Vercel Cron)         ← NEW
07:15  Title Enrichment         (Vercel Cron)         ← NEW
```
