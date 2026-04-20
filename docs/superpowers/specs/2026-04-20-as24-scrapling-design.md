# AutoScout24 Scrapling Integration

**Date:** 2026-04-20
**Status:** Approved
**Scope:** Replace Playwright with Scrapling (requests-based `Fetcher`) for AutoScout24 collector

---

## Problem

The AutoScout24 collector has been **100% blocked by Akamai Bot Manager** for 8+ consecutive days on both GitHub Actions and local CLI runs. Every Playwright page navigation times out at 30s. The circuit breaker triggers after 5 consecutive empty shards, resulting in 0 listings discovered per run.

Only the lightweight Vercel Cron (which runs a limited scope) continues to work, capturing ~100-147 listings/day instead of the ~31,000 potential across 52 shards.

**Root cause:** Akamai detects Playwright's headless Chromium fingerprint regardless of stealth configuration, user-agent rotation, or proxy usage.

## Solution

Adopt the same Scrapling-based approach that solved Classic.com's Cloudflare blocking problem with 95%+ success rate and zero blocks. Use Scrapling's `Fetcher` (requests-based, `impersonate="chrome"`) which mimics Chrome's TLS fingerprint and HTTP/2 settings without running a browser.

AutoScout24 is a Next.js application that embeds all listing data in `__NEXT_DATA__` JSON within the initial HTML response — no JavaScript execution required. This makes it ideal for a requests-based fetcher.

## Architecture

```
Python Fetcher (scrapling)          TS Wrapper               Collector
─────────────────────────           ──────────               ─────────
Fetcher.get(url, impersonate)  ←──  spawnSync/execFile  ←──  discover loop
Extract __NEXT_DATA__ JSON          Parse JSON stdout        Normalize listings
Return listings + pagination        Return structured data   Upsert to Supabase
```

### Components

| Component | File | Status |
|-----------|------|--------|
| Python fetcher | `scripts/as24_scrapling_fetch.py` | New |
| TS wrapper | `src/features/scrapers/autoscout24_collector/scrapling.ts` | New |
| Enrichment script | `scripts/as24-enrich-scrapling.ts` | New |
| Discovery integration | `src/features/scrapers/autoscout24_collector/discover.ts` | Modified |
| Collector orchestration | `src/features/scrapers/autoscout24_collector/collector.ts` | Modified |
| GHA collector workflow | `.github/workflows/autoscout24-collector.yml` | Modified |
| GHA enrichment workflow | `.github/workflows/autoscout24-enrich.yml` | Modified (replaces current `enrich-as24-bulk.ts` with scrapling) |

### Unchanged components

- `normalize.ts` — listing normalization
- `shards.ts` — shard generation strategy
- `checkpoint.ts` — resumable state persistence
- `supabase_writer.ts` — database upsert logic
- `cli.ts` — CLI argument parsing (minor flag additions)
- `browser.ts` — retained as Playwright fallback

---

## Component Details

### 1. Python Fetcher (`scripts/as24_scrapling_fetch.py`)

Adapts the Classic.com pattern (`scripts/classic_scrapling_fetch.py`) with a key difference: this script takes a **mode argument** (`search` or `detail`) as its first CLI arg, followed by one or more URLs. Classic.com's script takes only URLs (no mode) because it only handles detail pages.

**Search mode** — fetches a search page URL, extracts `__NEXT_DATA__` JSON, returns parsed listings:

```bash
python scripts/as24_scrapling_fetch.py search "https://www.autoscout24.com/lst/porsche/911?cy=D&fregfrom=2012&fregto=2019"
```

```json
{
  "ok": true,
  "mode": "search",
  "listings": [
    {
      "id": "guid-string",
      "url": "https://www.autoscout24.com/offers/...",
      "title": "Porsche 911 Carrera 4S",
      "make": "Porsche",
      "model": "911",
      "price": 85000,
      "currency": "EUR",
      "year": 2015,
      "mileageKm": 45000,
      "fuelType": "Petrol",
      "transmission": "Manual",
      "power": "400 hp",
      "images": ["https://prod.pictures.autoscout24.net/..."],
      "location": "Munich, 80331",
      "country": "D",
      "sellerType": "dealer",
      "firstRegistration": "03/2015"
    }
  ],
  "totalResults": 342,
  "totalPages": 18
}
```

**`__NEXT_DATA__` extraction paths:**
- Listings: `data.props.pageProps.listings[]` — each raw listing mapped via `mapNextDataListing()` logic
- Total results: `data.props.pageProps.numberOfResults` → returned as `totalResults`
- Total pages: `data.props.pageProps.numberOfPages` → returned as `totalPages`
- Listing images: upgrade resolution from `250x188` to `720x540` in URL path

**Detail mode** — fetches a listing detail page, extracts vehicle specs:

```bash
python scripts/as24_scrapling_fetch.py detail "https://www.autoscout24.com/offers/porsche-911-..."
```

```json
{
  "ok": true,
  "mode": "detail",
  "vehicle": {
    "trim": "Carrera 4S",
    "vin": "WP0AB2A99FS123456",
    "transmission": "Manual",
    "bodyStyle": "Coupe",
    "engine": "3.8L Flat-6",
    "colorExterior": "Guards Red",
    "colorInterior": "Black Leather",
    "description": "...",
    "images": ["https://prod.pictures.autoscout24.net/..."],
    "features": ["Sport Chrono", "PASM", "..."]
  }
}
```

**Batch mode** — multiple URLs with ProcessPoolExecutor (up to 4 workers for search, 6 for detail):

```bash
python scripts/as24_scrapling_fetch.py detail "url1" "url2" "url3"
```

```json
{
  "ok": true,
  "results": [
    { "ok": true, "mode": "detail", "vehicle": {...}, "url": "url1" },
    { "ok": false, "error": "HTTP 403", "url": "url2" }
  ]
}
```

Search batch uses 4 workers (heavier pages, avoid rate-limit triggering); detail batch uses 6 workers (lighter pages).

**Implementation details:**
- Uses `scrapling.fetchers.requests.Fetcher` with `impersonate="chrome"`
- Timeout: 15s per request for search pages (heavier than Classic.com detail pages), 10s for detail pages
- Retries: 1 attempt
- `__NEXT_DATA__` extraction: parse HTML for `<script id="__NEXT_DATA__">` tag, `json.loads()` content
- Windows UTF-8 stdout fix (same as Classic.com)
- Error handling: exceptions caught and returned as `{ ok: false, error: "..." }`

### 2. TypeScript Wrapper (`src/features/scrapers/autoscout24_collector/scrapling.ts`)

Adapts the Classic.com wrapper pattern. Uses `execFileAsync` (promisified `execFile`) for single URLs and `spawnSync` for batch, communicating via JSON over stdout.

**Types** (defined in `types.ts`):

```typescript
/** Result from scrapling search page fetch */
export interface AS24ScraplingSearchResult {
  listings: AS24ListingSummary[];   // Reuses existing type
  totalResults: number | null;
  totalPages: number | null;
}

/** Result from scrapling detail page fetch */
export interface AS24ScraplingDetailResult {
  trim: string | null;
  vin: string | null;
  transmission: string | null;
  bodyStyle: string | null;
  engine: string | null;
  colorExterior: string | null;
  colorInterior: string | null;
  description: string | null;
  images: string[];
  features: string[];
}
```

**Functions:**

```typescript
// Fetch a search page → listings + pagination info
export async function fetchAS24SearchWithScrapling(
  url: string
): Promise<AS24ScraplingSearchResult | null>

// Fetch a detail page → vehicle specs
export async function fetchAS24DetailWithScrapling(
  url: string
): Promise<AS24ScraplingDetailResult | null>

// Batch fetch detail pages (for enrichment)
export async function fetchAS24DetailBatchWithScrapling(
  urls: string[]
): Promise<(AS24ScraplingDetailResult & { url: string })[] | null>
```

**Field mapping (Python → TS):**

The Python search output maps to `AS24ListingSummary` via the TS wrapper. The Python script replicates the `mapNextDataListing()` field extraction from `discover.ts`, outputting flat fields that match `AS24ListingSummary` directly: `fuelType` (not `fuel`), `mileageKm`, `sellerType`, `location` as a flat string (`"Munich, 80331"`), and `country` as a separate string (`"D"`). No additional mapping layer needed in the TS wrapper — it passes through the parsed listings array.

Note: `AS24ScraplingDetailResult` uses `colorExterior`/`colorInterior` field names (matching DB column names), while the existing `AS24DetailParsed` type uses `exteriorColor`/`interiorColor`. These are separate types with separate consumers — no conflict, but implementers should be aware of the naming difference.

**Predicate functions:**

```typescript
/** Returns true if scrapling is available (not Vercel, Python installed) */
function canUseScrapling(): boolean {
  return !process.env.VERCEL && process.env.AS24_FORCE_SCRAPLING !== "0";
}

/** Returns true if Playwright fallback should be skipped */
function shouldSkipPlaywrightFallback(): boolean {
  return process.env.AS24_DISABLE_PLAYWRIGHT_FALLBACK === "1";
}
```

**Configuration:**
- Python binary: `process.env.SCRAPLING_PYTHON` (default: `python3.11`)
- Timeout: 30s for single search, 120s for batch
- Disabled on Vercel: `process.env.VERCEL` check (no Python runtime)

**Feature flags:**

| Variable | Default | Description |
|----------|---------|-------------|
| `AS24_FORCE_SCRAPLING` | `1` (implicit) | Set to `0` to revert to Playwright-first |
| `AS24_DISABLE_PLAYWRIGHT_FALLBACK` | — | `1` = skip Playwright fallback entirely |

### 3. Discovery Integration (`discover.ts` + `collector.ts` modifications)

#### `discover.ts` changes

New exported function `discoverShardWithScrapling()` that replaces the Playwright-based `discoverShard()` when scrapling is active. Mirrors the same interface (`DiscoverResult`) and pagination loop but calls `fetchAS24SearchWithScrapling()` instead of `page.goto()`:

```
discoverShardWithScrapling(shard, opts):
  for pageNum = startPage to shard.maxPages:
    url = buildSearchUrl(shard, pageNum)
    result = fetchAS24SearchWithScrapling(url)

    if !result:
      break  // fetch failed, stop this shard

    listings.push(...result.listings)
    await opts.onPageDone(shard.id, pageNum, result.listings.length)

    if result.listings.length === 0:
      break  // no more listings

    await delay(navigationDelayMs)  // rate limiting

  return { listings, pagesProcessed, totalResults }
```

The existing `discoverShard()` (Playwright-based) remains unchanged for fallback use.

#### `collector.ts` changes

The browser launch becomes **conditional** on whether scrapling is active:

```
// Before the shard loop:
const useScrapling = canUseScrapling();
let browser, context, page;

if (!useScrapling) {
  browser = await launchStealthBrowser(config);
  context = await createStealthContext(browser, config);
  page = await createPage(context);
}

// In the shard loop:
if (useScrapling) {
  discoverResult = await discoverShardWithScrapling(shard, { ... });
} else {
  discoverResult = await discoverShard({ page, shard, ... });
}

// After the shard loop:
if (browser) await browser.close();
```

The circuit breaker logic adapts: instead of counting "Akamai blocks" (which don't occur with scrapling), count consecutive shards where `discoverResult.listings.length === 0 && discoverResult.pagesProcessed === 0` as "blocked" and abort after 5. The `akamaiBlocked` count is replaced with `fetchFailed` for scrapling mode.

Context refresh (every 100 listings) is skipped when running in scrapling mode since there is no browser to refresh.

### 4. Enrichment Script (`scripts/as24-enrich-scrapling.ts`)

**Replaces** the existing `scripts/enrich-as24-bulk.ts`. The existing script uses HTTP+cheerio for detail pages; the new one uses Scrapling for better anti-bot evasion.

**Query:**
```sql
SELECT id, source_url, title, trim, transmission, body_style, engine,
       color_exterior, color_interior, vin, description_text, images
FROM listings
WHERE source = 'AutoScout24'
  AND status = 'active'
  AND trim IS NULL
ORDER BY updated_at ASC
LIMIT $limit
```

**CLI flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--limit` | `500` | Max listings to enrich |
| `--timeBudgetMs` | `1200000` (20 min) | Total time budget |
| `--delayMs` | `2000` | Delay between requests |
| `--dryRun` | `false` | Skip DB writes |
| `--preflight` | `false` | Test first 5 only |

**Update-only-null pattern and sentinel:**
- Only overwrites DB fields that are currently null/empty
- **Always** sets `trim = ""` (empty string) after attempting a listing, regardless of success or failure. This prevents infinite re-processing since the query filters on `trim IS NULL`. Listings where trim is legitimately unavailable get `""` instead of remaining `NULL`.
- Other fields (vin, transmission, body_style, engine, colors, description_text) are only written when extracted and currently null
- Records run via `recordScraperRun()`

### 5. GHA Workflow Changes

#### `autoscout24-collector.yml` modifications

```yaml
# Add Python + scrapling setup step (before collector run)
- uses: actions/setup-python@v5
  with:
    python-version: "3.11"
- run: pip install "scrapling[fetchers]"

# Add env vars to the collector run step
env:
  SCRAPLING_PYTHON: python
  AS24_DISABLE_PLAYWRIGHT_FALLBACK: "1"
```

Playwright install step is kept but made conditional (only when `AS24_DISABLE_PLAYWRIGHT_FALLBACK != "1"`) for fallback support.

#### `autoscout24-enrich.yml` modification

The **existing** workflow at `.github/workflows/autoscout24-enrich.yml` (currently runs `enrich-as24-bulk.ts` at 06:30 UTC) is updated to:
- Add Python + scrapling setup
- Change the script from `scripts/enrich-as24-bulk.ts` to `scripts/as24-enrich-scrapling.ts`
- Move schedule to 07:30 UTC (after collector completes)
- Keep the same workflow_dispatch inputs

The old `scripts/enrich-as24-bulk.ts` is retained but no longer called by the workflow.

---

## Fallback Strategy

```
1. Scrapling Fetcher (requests-based) [DEFAULT]
   → impersonate="chrome", no browser, no proxy
   → Active when: AS24_FORCE_SCRAPLING != "0" AND NOT on Vercel

2. Playwright + Decodo proxy [OPT-IN FALLBACK]
   → headless Chromium, residential proxy rotation
   → Active when: AS24_FORCE_SCRAPLING = "0"

3. Summary-only (Vercel Cron)
   → existing lightweight path, ~100 listings/day
   → Active when: running on Vercel (scrapling unavailable)
```

## Schedule (Updated)

```
05:00  AutoScout24 Collector       (GitHub Actions, Scrapling-first, ~30 min)
07:30  AutoScout24 Enrichment      (GitHub Actions, Scrapling, ~20 min)
  --   AS24 Detail Enrichment      (Vercel Cron, HTTP+cheerio, manual only)
```

The existing `autoscout24-enrich.yml` schedule moves from 06:30 to 07:30 UTC. No new workflow file is created.

Expected improvement: from 0 listings/run (Playwright blocked) to ~31,000 listings/run (Scrapling, 52 shards × 20 pages).

## Risks

| Risk | Mitigation |
|------|------------|
| Akamai blocks `Fetcher` too (requires JS challenge) | Escalate to `StealthyFetcher` (browser-based scrapling) |
| `__NEXT_DATA__` structure changes | Python parser versioned; test suite with fixture HTML |
| Rate limiting (429) | 2s delay between requests; circuit breaker on consecutive 429s |
| Scrapling package unavailable on GHA | Pin version in requirements; cache pip install |
| Batch search fetches trigger rate limiting | Search batch limited to 4 workers (not 6) |

## Success Criteria

- Scrapling fetcher returns listing data for AS24 search pages (validate with preflight)
- GHA collector run discovers >1,000 listings (vs current 0)
- No Akamai blocks in scrapling mode
- Enrichment script fills trim/VIN/colors for existing listings
- Existing Vercel Cron continues to work unchanged
