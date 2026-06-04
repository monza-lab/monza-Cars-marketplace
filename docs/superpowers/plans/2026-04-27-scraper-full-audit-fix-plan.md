# Scraper Full Audit & Fix Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken, degraded, and zero-write scrapers identified in the 2026-04-26 full run audit so every source delivers reliable, complete data.

**Architecture:** 14 issues across 7 collectors, 5 enrichment jobs, and 2 maintenance jobs. Fixes grouped into 8 independent tasks ordered by severity: CRITICAL (no data flowing) first, then HIGH (data quality), then MEDIUM (degraded performance). Each task is self-contained and can be developed/tested independently.

**Tech Stack:** TypeScript, Node.js, Cheerio, Scrapling (Python), Supabase, Playwright (optional)

**Run date:** 2026-04-26 | **Run ID:** `14395fe1-7966-4f95-ab83-a8be4ad09ea0`

---

## Diagnostic Summary

### Full Run Results (2026-04-26)

| Scraper                          | Status   | Duration | Issues |
|----------------------------------|----------|----------|--------|
| Porsche Collector                | TIMEOUT  | 30m 00s  | No timeBudgetMs from CLI |
| Ferrari Collector                | TIMEOUT  | 30m 00s  | No timeBudgetMs from CLI |
| BeForward Collector              | OK       | 0m 17s   | ZERO-WRITE: 0 discovered |
| Classic.com Collector            | OK       | 5m 59s   | 11 errors in health audit |
| AutoScout24 Collector            | FAILED   | 0m 03s   | Quick failure, no preflight |
| Elferspot Collector              | FAILED   | 20m 16s  | Circuit breaker triggered |
| BaT Detail Scraper               | OK       | 14m 09s  | ZERO-WRITE: 60 fetched, 0 written |
| Classic.com Scrapling Enrichment | OK       | 1m 19s   | 500 queried, 500 skipped |
| AS24 Scrapling Enrichment        | OK       | 18m 04s  | 500 queried, 500 no data, 500 DB updates |
| AutoTrader Discovery             | OK       | 1m 35s   | 3/4 runs failed in health audit |
| AutoTrader Enrichment            | OK       | 2m 23s   | Working well |
| BeForward Enrichment             | OK       | 1m 16s   | HTTP 404 + HTTP 429 |
| Elferspot Enrichment             | OK       | 2m 40s   | AUD currency enum error |
| Listing Validator                | OK       | 0m 04s   | 3 errors in health audit |
| Cleanup                          | OK       | 0m 15s   | 1 error in health audit |
| VIN Enrichment                   | OK       | 0m 22s   | ZERO-WRITE: 500 discovered, 0 written |
| Title Enrichment                 | OK       | 0m 01s   | ZERO-WRITE: 1000 discovered, 0 written |
| Image Backfill                   | OK       | 1m 19s   | 1 BeForward 404 error |
| Liveness Checker                 | OK       | 3m 39s   | Classic.com circuit break (10x 403) |
| Scraper Health Audit             | OK       | 0m 01s   | 13 jobs with issues |

### Health Audit (3-day window)

| Scraper | Status | Runs | Written | Errors |
|---------|--------|------|---------|--------|
| ferrari | WORKING | 3 | 271 | 0 |
| porsche | WORKING | 3 | 8 | 0 |
| autotrader | DEGRADED | 4 | 80 | 3 |
| beforward | ZERO-WRITE | 3 | 0 | 0 |
| classic | DEGRADED | 6 | 493 | 11 |
| autoscout24 | WORKING | 5 | 200 | 0 |
| elferspot | WORKING | 2 | 1946 | 0 |
| bat-detail | ZERO-WRITE | 2 | 0 | 0 |
| enrich-vin | ZERO-WRITE | 4 | 0 | 0 |
| enrich-titles | ZERO-WRITE | 4 | 0 | 0 |
| enrich-beforward | DEGRADED | 4 | 15 | 2 |
| enrich-elferspot | DEGRADED | 4 | 191 | 9 |
| enrich-details | DEGRADED | 3 | 279 | 21 |
| liveness-check | DEGRADED | 2 | 6 | 4 |

---

## Issue Classification

### CRITICAL — No data flowing

| # | Issue | Scraper | Root Cause |
|---|-------|---------|------------|
| C1 | Cars & Bids returns 0 auctions | Porsche/Ferrari Collectors | HTTP 403 — anti-bot blocking plain `fetch()` |
| C2 | Collecting Cars returns 0 auctions | Porsche/Ferrari Collectors | HTTP 403 — anti-bot blocking plain `fetch()` |
| C3 | BeForward discovers 0 listings | BeForward Collector | DOM selectors (`tr.stocklist-row`) likely broken |
| C4 | Porsche/Ferrari collectors TIMEOUT at 30min | Porsche/Ferrari CLIs | CLI doesn't pass `timeBudgetMs` to collector |

### HIGH — Data quality gaps

| # | Issue | Scraper | Root Cause |
|---|-------|---------|------------|
| H1 | BaT detail scraper: 60 fetched, 0 written | bat-detail-scraper.ts | All queried listings already have engine/mileage/VIN/etc filled; update object is empty |
| H2 | BaT null prices on ended auctions | bringATrailer.ts | `.current-bid-value` selector misses sold-auction price display (`Sold for $X`) |
| H3 | Elferspot AUD currency enum error | enrich-elferspot | `monza_currency` DB enum doesn't include AUD; scraper passes raw currency through |
| H4 | Classic.com enrichment skips all 500 | classic-enrich-scrapling.ts | Detail pages fetched=0, all 500 marked "no data" — **diagnostic needed** (Scrapling may be returning empty, or page structure changed) |

### MEDIUM — Degraded but partially working

| # | Issue | Scraper | Root Cause |
|---|-------|---------|------------|
| M1 | AutoScout24 collector fails in 3s | AS24 Collector | No preflight check; likely Scrapling init failure |
| M2 | Liveness checker circuit-breaks on Classic.com | Liveness Checker | Classic.com returns 403 on direct fetch; needs Scrapling or different approach |
| M3 | BeForward enrichment: 404s + 429s | enrich-beforward | Dead URLs not cleaned up; rate limit too aggressive |

### LOW — Working but zero-write (likely already enriched)

| # | Issue | Scraper | Root Cause |
|---|-------|---------|------------|
| L1 | VIN Enrichment: 500 discovered, 0 written | enrich-vin | All discovered VINs already decoded — normal steady-state |
| L2 | Title Enrichment: 1000 discovered, 0 written | enrich-titles | All titles already parsed — normal steady-state |

> **L1 and L2 are NOT bugs.** These enrichment jobs discover listings that *could* need enrichment, then skip them because the data is already present. This is expected behavior when the pipeline is caught up. No fix needed.

### NOT ADDRESSED — Monitored but no fix needed now

| # | Issue | Note |
|---|-------|------|
| N1 | AutoTrader 3/4 runs failed | Latest run succeeded (80 written). Intermittent — likely transient API issues. Monitor next 3 days. |
| N2 | Image Backfill 1 BeForward 404 | Will be resolved by Task 8 Part C (dead-URL pre-filter in BeForward enrichment). |
| N3 | AS24 Scrapling Enrichment "500 no data" | Scrapling returned empty for all 500 detail pages but still wrote DB updates (timestamps). Same class as H4. If H4 fix (Classic.com Scrapling) reveals a Scrapling-wide issue, this gets fixed too. |
| N4 | Listing Validator 3 errors | Low severity — likely edge-case model names. Monitor. |
| N5 | Cleanup 1 error | Low severity — cleanup ran successfully otherwise (113 written). |

---

## File Map

### Files to create

| File | Responsibility |
|------|---------------|
| `src/features/scrapers/auctions/carsAndBidsScrapling.ts` | Scrapling wrapper for Cars & Bids (follow pattern in `batScrapling.ts`) |
| `src/features/scrapers/auctions/collectingCarsScrapling.ts` | Scrapling wrapper for Collecting Cars (follow pattern in `batScrapling.ts`) |

### Files to modify

| File | Line(s) | Change |
|------|---------|--------|
| `src/features/scrapers/auctions/carsAndBids.ts` | 77-95 | Add Scrapling fallback to `fetchPage()` |
| `src/features/scrapers/auctions/collectingCars.ts` | 77-95 | Add Scrapling fallback to `fetchPage()` |
| `src/features/scrapers/beforward_porsche_collector/discover.ts` | 97-129 | Update `parseListingRows()` selectors after debugging live HTML |
| `src/features/scrapers/porsche_collector/cli.ts` | 103-114 | Add `timeBudgetMs` to config via `readNumber()` |
| `src/features/scrapers/ferrari_collector/cli.ts` | 103-114 | Add `timeBudgetMs` to config via `readNumber()` |
| `scripts/bat-detail-scraper.ts` | 196-214 | Add `current_bid`, `original_currency` to update fields |
| `src/features/scrapers/auctions/bringATrailer.ts` | 973-982 | Add sold-auction price selectors (`.listing-available-result`, `Sold for $X`) |
| `src/features/scrapers/elferspot_collector/normalize.ts` | ~76 | Add currency validation/mapping before DB write |
| `src/features/scrapers/elferspot_collector/detail.ts` | 134-146 | Validate currency against allowed enum values |
| `scripts/classic-enrich-scrapling.ts` | (diagnose) | Debug why Scrapling returns no data for 500 listings |
| `src/features/scrapers/autoscout24_collector/collector.ts` | ~104-132 | Add preflight connectivity check |
| `src/features/scrapers/liveness_checker/sourceConfig.ts` | EXCLUDED_SOURCES + SOURCE_CONFIGS | Add ClassicCom to EXCLUDED_SOURCES, remove from SOURCE_CONFIGS |
| `src/app/api/cron/enrich-beforward/route.ts` | ~72 | Increase delay from 2s to 4s, add dead-URL pre-filter |
| `scripts/run-scrapers.ts` | 81, 93 | Increase TUI `timeoutMs` to 27min (above CLI timeBudgetMs) |

### Notes on shared patterns

- **Scrapling wrappers:** There is no shared `common/scrapling` module. Each scraper has its own wrapper. For C&B and CC, follow the pattern in `src/features/scrapers/auctions/batScrapling.ts` which uses `spawnSync` to invoke Python.
- **CLI parsing:** Both Porsche and Ferrari CLIs use a custom `parseArgv()` + `readNumber()` helper — NOT yargs. The `CollectorRunConfig` type already has `timeBudgetMs?: number` and the collector code already reads/uses it. Only the CLI passthrough is missing.
- **TUI timeout vs CLI timeBudgetMs:** `scripts/run-scrapers.ts` has a `timeoutMs` per scraper that hard-kills the process. The `--timeBudgetMs` flag is the collector's internal graceful shutdown timer. Both need to be set: CLI budget < TUI timeout.

---

## Chunk 1: CRITICAL Fixes (C1-C4)

### Task 1: Add timeBudgetMs to Porsche/Ferrari Collector CLIs (C4)

**Why:** Both collectors run unbounded from CLI, hitting the 30-minute TUI timeout mid-discovery. The cron routes already pass `timeBudgetMs` correctly — only CLI is broken.

**Files:**
- Modify: `src/features/scrapers/porsche_collector/cli.ts:103-114`
- Modify: `src/features/scrapers/ferrari_collector/cli.ts:103-114`
- Modify: `scripts/run-scrapers.ts:81,93`

- [ ] **Step 1: Read the current Porsche CLI config builder**

Read `src/features/scrapers/porsche_collector/cli.ts` lines 90-120 to see the exact config shape being passed. Note: both CLIs use a custom `parseArgv()` + `readNumber()` helper (NOT yargs). The `CollectorRunConfig` type already has `timeBudgetMs?: number` and the collector code already reads and uses it — only the CLI passthrough is missing.

- [ ] **Step 2: Add `timeBudgetMs` to Porsche CLI config**

In `src/features/scrapers/porsche_collector/cli.ts`, add one line to the config object (around line 113):

```typescript
const config: CollectorRunConfig = {
    mode,
    make: readString(args, "make") ?? "Porsche",
    endedWindowDays: readNumber(args, "endedWindowDays", 90),
    dateFrom: readString(args, "dateFrom"),
    dateTo: readString(args, "dateTo"),
    maxActivePagesPerSource: readNumber(args, "maxActivePages", 10),
    maxEndedPagesPerSource: readNumber(args, "maxEndedPages", 10),
    scrapeDetails: !hasFlag(args, "noDetails"),
    checkpointPath: readString(args, "checkpointPath") ?? "var/porsche_collector/checkpoint.json",
    dryRun: hasFlag(args, "dryRun"),
    timeBudgetMs: readNumber(args, "timeBudgetMs", 25 * 60 * 1000), // 25 min default
  };
```

Also add `--timeBudgetMs=1500000` to the `usage()` help text.

- [ ] **Step 3: Add `timeBudgetMs` to Ferrari CLI config**

Same one-line addition in `src/features/scrapers/ferrari_collector/cli.ts`.

- [ ] **Step 4: Increase TUI hard-kill timeout for collectors**

In `scripts/run-scrapers.ts`, lines 81 and 93: change `timeoutMs: 30 * 60_000` to `timeoutMs: 27 * 60_000` to match the CLI default. The TUI `timeoutMs` is a **hard-kill** of the child process, while `--timeBudgetMs` is the **graceful internal budget**. Set TUI timeout 2 minutes above CLI budget (27 min TUI > 25 min CLI) to allow graceful shutdown.

- [ ] **Step 5: Test Porsche CLI with explicit budget**

```bash
npx tsx src/features/scrapers/porsche_collector/cli.ts --mode=daily --dryRun --timeBudgetMs=60000
```

Expected: Collector finishes within ~60 seconds, exits gracefully with summary.

- [ ] **Step 6: Commit**

```bash
git add src/features/scrapers/porsche_collector/cli.ts src/features/scrapers/ferrari_collector/cli.ts scripts/run-scrapers.ts
git commit -m "fix(scrapers): add timeBudgetMs to Porsche/Ferrari CLI to prevent 30m timeout"
```

---

### Task 2: Add Scrapling Fallback for Cars & Bids (C1)

**Why:** Cars & Bids returns HTTP 403 on plain `fetch()`. The project already has a working Scrapling pattern in `batScrapling.ts` — port it.

**Files:**
- Create: `src/features/scrapers/auctions/carsAndBidsScrapling.ts`
- Modify: `src/features/scrapers/auctions/carsAndBids.ts:77-95`

- [ ] **Step 1: Read the existing BaT Scrapling wrapper**

Read `src/features/scrapers/auctions/batScrapling.ts` to understand the pattern used for Scrapling integration.

- [ ] **Step 2: Read the C&B fetchPage function**

Read `src/features/scrapers/auctions/carsAndBids.ts` lines 77-95.

- [ ] **Step 3: Create Scrapling wrapper for C&B**

Create `src/features/scrapers/auctions/carsAndBidsScrapling.ts` following the pattern in `src/features/scrapers/auctions/batScrapling.ts`:
- Uses `spawnSync` to invoke Python with `StealthyFetcher` + `--solve-cloudflare`
- Accept a URL, return HTML string
- Return `null` if Scrapling is unavailable (e.g., on Vercel where `process.env.VERCEL` is set)

> **Important:** There is NO shared `common/scrapling` module. Each scraper has its own wrapper. Read `batScrapling.ts` first and replicate its pattern — it uses `spawnSync("python", [...])` not a shared function.

- [ ] **Step 4: Add Scrapling fallback to C&B fetchPage**

In `src/features/scrapers/auctions/carsAndBids.ts`, modify `fetchPage()` to try Scrapling when `fetch()` returns 403:

```typescript
async function fetchPage(url: string): Promise<string> {
  try {
    const response = await fetch(url, { headers: DEFAULT_HEADERS, ... });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (err) {
    // Fallback to Scrapling on 403/block
    const html = await fetchCarsAndBidsWithScrapling(url);
    if (html) return html;
    throw err;
  }
}
```

- [ ] **Step 5: Test C&B scraper locally**

```bash
npx tsx src/features/scrapers/porsche_collector/cli.ts --mode=daily --dryRun --noDetails --timeBudgetMs=120000
```

Expected: C&B source returns >0 auctions instead of 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/scrapers/auctions/carsAndBidsScrapling.ts src/features/scrapers/auctions/carsAndBids.ts
git commit -m "fix(scrapers): add Scrapling fallback to Cars & Bids to bypass HTTP 403"
```

---

### Task 3: Add Scrapling Fallback for Collecting Cars (C2)

**Why:** Same issue as C&B — HTTP 403 blocks plain fetch.

**Files:**
- Create: `src/features/scrapers/auctions/collectingCarsScrapling.ts`
- Modify: `src/features/scrapers/auctions/collectingCars.ts:77-95`

- [ ] **Step 1: Create Scrapling wrapper for Collecting Cars**

Create `src/features/scrapers/auctions/collectingCarsScrapling.ts` following same pattern as Task 2.

- [ ] **Step 2: Add Scrapling fallback to CC fetchPage**

Same pattern as Task 2, in `collectingCars.ts`.

- [ ] **Step 3: Test CC scraper locally**

```bash
npx tsx src/features/scrapers/porsche_collector/cli.ts --mode=daily --dryRun --noDetails --timeBudgetMs=120000
```

Expected: CollectingCars source returns >0 auctions.

- [ ] **Step 4: Commit**

```bash
git add src/features/scrapers/auctions/collectingCarsScrapling.ts src/features/scrapers/auctions/collectingCars.ts
git commit -m "fix(scrapers): add Scrapling fallback to Collecting Cars to bypass HTTP 403"
```

---

### Task 4: Fix BeForward Discovery Selectors (C3)

**Why:** BeForward discovery returns 0 listings despite the site being live. Likely DOM selectors changed.

**Files:**
- Modify: `src/features/scrapers/beforward_porsche_collector/discover.ts:97-129`

- [ ] **Step 1: Fetch live BeForward HTML to diagnose**

Use Scrapling or a browser to fetch the current BeForward Porsche search page and inspect the HTML structure:

```bash
python -c "
from scrapling import StealthyFetcher
f = StealthyFetcher()
page = f.fetch('https://www.beforward.jp/porsche?steering=all&currency=usd')
with open('/tmp/beforward-debug.html', 'w') as out:
    out.write(page.html)
print('Saved. Size:', len(page.html))
"
```

Or use `curl`:

```bash
curl -s -o /tmp/beforward-debug.html -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "https://www.beforward.jp/porsche?steering=all&currency=usd"
```

- [ ] **Step 2: Identify new selectors**

Open `/tmp/beforward-debug.html` and search for listing rows. Compare against current selectors:
- Current: `tr.stocklist-row`
- Current: `a.vehicle-url-link`
- Current: `p.veh-stock-no`
- Current: `p.make-model`

Identify what the new HTML structure uses for listing containers, links, and data fields.

- [ ] **Step 3: Update selectors in `parseListingRows()`**

Update `src/features/scrapers/beforward_porsche_collector/discover.ts` lines 97-129 with the new selectors from Step 2.

- [ ] **Step 4: Test BeForward discovery**

```bash
npx tsx src/features/scrapers/beforward_porsche_collector/cli.ts --dryRun --maxPages=1
```

Expected: >0 listings discovered from page 1.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/beforward_porsche_collector/discover.ts
git commit -m "fix(scrapers): update BeForward selectors to match current DOM structure"
```

---

## Chunk 2: HIGH Data Quality Fixes (H1-H4)

### Task 5: Fix BaT Detail Scraper Zero-Write + Sold Auction Prices (H1 + H2)

**Why two issues, one task:** Both relate to BaT price handling — the detail scraper doesn't write price data (H1), and sold auctions use different selectors (H2). Fixing both together avoids a double-touch.

**Files:**
- Modify: `scripts/bat-detail-scraper.ts:196-214`
- Modify: `src/features/scrapers/auctions/bringATrailer.ts:973-982`

#### Part A: Fix sold-auction price selectors (H2)

- [ ] **Step 1: Read the current scrapeDetail price logic**

Read `src/features/scrapers/auctions/bringATrailer.ts` lines 960-1010.

- [ ] **Step 2: Fetch a sold BaT auction page to inspect HTML**

Fetch a recently-sold BaT listing and inspect the price display:

```bash
curl -s "https://bringatrailer.com/listing/1992-porsche-928-gts-10/" | grep -i "sold\|final\|hammer\|current-bid\|listing-available-result" | head -20
```

Identify which CSS class/element contains the final sold price (e.g., `.listing-available-result`, `Sold for $X`, `.post-title .info-value`).

- [ ] **Step 3: Add sold-auction price selectors to scrapeDetail**

In `bringATrailer.ts`, around line 975-982, add fallback selectors for ended auctions:

```typescript
// Existing: active auction bid
let detailBid: number | null = null;
const bidValueText = ($('.current-bid-value').first().text().trim()
  || $('.current-bid').first().text().trim());

// NEW: sold auction final price
if (!bidValueText) {
  // Try sold-auction selectors
  const soldText = ($('.listing-available-result .info-value').first().text().trim()
    || $('.post-title .info-value').first().text().trim()
    || $('[class*="sold"]').first().text().trim());
  if (soldText) {
    const priceMatch = soldText.match(/\$[\d,]+/);
    if (priceMatch) detailBid = parsePrice(priceMatch[0]);
  }
}
```

> **Note:** Exact selectors depend on Step 2 inspection. The above is a starting template.

- [ ] **Step 4: Test sold auction price extraction**

Run the detail scraper on a known sold listing:

```bash
npx tsx scripts/bat-detail-scraper.ts --limit=5 --dryRun --preflight
```

Expected: Listings with `status=sold` now have non-null `currentBid`.

#### Part B: Fix detail scraper update builder (H1)

- [ ] **Step 5: Read the current update builder**

Read `scripts/bat-detail-scraper.ts` lines 190-220.

- [ ] **Step 6: Add price/bid fields to update builder**

In `scripts/bat-detail-scraper.ts`, around line 213, add price and currency fields to the update logic:

```typescript
// After existing field checks (line ~213):
if (detail.currentBid != null && !listing.current_bid) {
  updates.current_bid = detail.currentBid;
}
if (detail.currentBid != null && !listing.hammer_price) {
  updates.hammer_price = detail.currentBid;
}
if (!listing.original_currency && detail.currentBid != null) {
  updates.original_currency = 'USD'; // BaT is always USD
}
```

- [ ] **Step 7: Test detail scraper writes**

```bash
npx tsx scripts/bat-detail-scraper.ts --limit=10 --dryRun
```

Expected: `DB updates > 0` for listings that were missing price data.

- [ ] **Step 8: Commit**

```bash
git add scripts/bat-detail-scraper.ts src/features/scrapers/auctions/bringATrailer.ts
git commit -m "fix(scrapers): BaT detail scraper now writes prices + handles sold auctions"
```

---

### Task 6: Fix Elferspot Currency Enum Error (H3)

**Why:** Elferspot listings with AUD (Australian Dollar) fail DB insert because `monza_currency` enum only allows USD/EUR/GBP/JPY/CHF.

**Files:**
- Modify: `src/features/scrapers/elferspot_collector/detail.ts:134-146`
- Modify: `src/features/scrapers/elferspot_collector/normalize.ts:~76`

- [ ] **Step 1: Read the current detail.ts currency extraction**

Read `src/features/scrapers/elferspot_collector/detail.ts` lines 130-150.

- [ ] **Step 2: Read the normalize.ts currency passthrough**

Read `src/features/scrapers/elferspot_collector/normalize.ts` lines 70-80.

- [ ] **Step 3: Add currency validation/mapping in detail.ts**

In `detail.ts`, after extracting currency, validate against allowed values:

```typescript
const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF']);

// After currency extraction (around line 141):
if (!ALLOWED_CURRENCIES.has(currency)) {
  console.warn(`[elferspot:detail] Unsupported currency "${currency}", mapping to EUR`);
  currency = 'EUR';
}
```

- [ ] **Step 4: Also expand the DB enum (Supabase migration)**

Create a Supabase migration to add AUD and other common currencies to the enum:

```sql
ALTER TYPE monza_currency ADD VALUE IF NOT EXISTS 'AUD';
ALTER TYPE monza_currency ADD VALUE IF NOT EXISTS 'SEK';
ALTER TYPE monza_currency ADD VALUE IF NOT EXISTS 'DKK';
ALTER TYPE monza_currency ADD VALUE IF NOT EXISTS 'NOK';
ALTER TYPE monza_currency ADD VALUE IF NOT EXISTS 'PLN';
ALTER TYPE monza_currency ADD VALUE IF NOT EXISTS 'CZK';
```

> **Decision needed:** Either expand the enum (preferred — preserves real data) or map to EUR (lossy). Expanding is better for accurate pricing. If you expand, remove the mapping fallback from Step 3 and instead just validate against the expanded set.

- [ ] **Step 5: Test locally**

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/enrich-elferspot
```

Expected: No "invalid input value for enum monza_currency" errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/scrapers/elferspot_collector/detail.ts src/features/scrapers/elferspot_collector/normalize.ts
git commit -m "fix(scrapers): handle unsupported currencies in Elferspot enrichment"
```

---

### Task 7: Diagnose & Fix Classic.com Enrichment (H4)

**Why:** Classic.com enrichment fetches 500 listings but gets 0 detail pages and skips all 500. Scrapling appears to return empty results.

**Files:**
- Modify: `scripts/classic-enrich-scrapling.ts`
- Possibly modify: `src/features/scrapers/classic_collector/scrapling.ts`

- [ ] **Step 1: Read the enrichment script**

Read `scripts/classic-enrich-scrapling.ts` to understand the flow: what does it query, how does it call Scrapling, what qualifies as "no data"?

- [ ] **Step 2: Test Scrapling directly on a Classic.com listing**

```bash
python scripts/classic_scrapling_fetch.py "https://www.classic.com/veh/1996-porsche-911-turbo-WP0AC2991TS375556/"
```

Expected: JSON output with `ok: true`. If `ok: false` or empty, Classic.com may have changed their anti-bot or page structure.

- [ ] **Step 3: Diagnose the "no data" skip logic**

In the enrichment script, find where it decides "no data" and add debug logging:

```typescript
// Before the skip decision:
console.log(`[debug] Listing ${listing.id}: scrapling returned`, JSON.stringify(result).slice(0, 200));
```

Run:

```bash
npx tsx scripts/classic-enrich-scrapling.ts --limit=5 --dryRun --preflight
```

Expected: See what Scrapling actually returns for these listings.

- [ ] **Step 4: Fix based on diagnosis**

Common causes:
1. **Scrapling returns empty HTML** → Classic.com changed their anti-bot. May need to update Scrapling args or use `--solve-cloudflare`.
2. **HTML is returned but parsing fails** → Page structure changed. Update Cheerio selectors.
3. **URL format changed** → Classic.com remodeled their URL schema. Update URL builder.

Apply the appropriate fix based on findings.

- [ ] **Step 5: Test enrichment end-to-end**

```bash
npx tsx scripts/classic-enrich-scrapling.ts --limit=10 --dryRun
```

Expected: `Detail pages fetched > 0`, `Skipped (no data) < 10`.

- [ ] **Step 6: Commit**

```bash
git add scripts/classic-enrich-scrapling.ts
git commit -m "fix(scrapers): fix Classic.com enrichment Scrapling fetch returning empty"
```

---

## Chunk 3: MEDIUM Fixes (M1-M3)

### Task 8: Fix AutoScout24 Quick Failure + Liveness + BeForward Rate Limits (M1-M3)

These three are smaller, independent issues grouped into one task for efficiency.

**Files:**
- Modify: `src/features/scrapers/autoscout24_collector/collector.ts:~104-132`
- Modify: `src/features/scrapers/liveness_checker/` (per-source config)
- Modify: `src/app/api/cron/enrich-beforward/route.ts`

#### Part A: AutoScout24 Preflight Check (M1)

- [ ] **Step 1: Read AS24 collector initialization**

Read `src/features/scrapers/autoscout24_collector/collector.ts` lines 100-150.

- [ ] **Step 2: Add preflight connectivity check**

Add a preflight check before browser/Scrapling initialization, similar to what Elferspot does:

```typescript
// Before main discovery loop:
const preflightUrl = 'https://www.autoscout24.com/lst/porsche?cy=L&atype=C&sort=age&desc=1';
try {
  const testResult = await fetchAS24SearchWithScrapling(preflightUrl);
  if (!testResult || testResult.listings.length === 0) {
    throw new Error('Preflight returned no listings');
  }
  console.log(`[AS24] Preflight OK: ${testResult.listings.length} listings from Luxembourg`);
} catch (err) {
  console.error(`[AS24] Preflight FAILED:`, err);
  // Record failure and exit gracefully instead of crashing
  return { success: false, error: 'Preflight connectivity check failed' };
}
```

- [ ] **Step 3: Test AS24 collector**

```bash
npx tsx src/features/scrapers/autoscout24_collector/cli.ts --dryRun --maxListings=5 --countries=L
```

Expected: Either passes preflight and discovers listings, or fails fast with clear error message.

- [ ] **Step 4: Commit**

```bash
git add src/features/scrapers/autoscout24_collector/collector.ts
git commit -m "fix(scrapers): add preflight check to AS24 collector for fast failure"
```

#### Part B: Liveness Checker Classic.com Circuit Break (M2)

- [ ] **Step 5: Read liveness checker per-source config**

Read the liveness checker configuration to find where Classic.com is checked.

- [ ] **Step 6: Skip Classic.com in liveness checker**

Classic.com returns 403 on plain HEAD/GET requests, causing circuit break after 10 attempts. The enrichment job already handles 404/delisting detection, so liveness checking is redundant.

File: `src/features/scrapers/liveness_checker/sourceConfig.ts`

Two changes needed:
1. Add `"ClassicCom"` to the `EXCLUDED_SOURCES` array (currently only has `["BaT", "CarsAndBids", "CollectingCars"]`)
2. Remove the `ClassicCom` entry from `SOURCE_CONFIGS` array

```typescript
// In EXCLUDED_SOURCES (around line 23):
const EXCLUDED_SOURCES = ["BaT", "CarsAndBids", "CollectingCars", "ClassicCom"];
```

- [ ] **Step 7: Commit**

```bash
git add src/features/scrapers/liveness_checker/sourceConfig.ts
git commit -m "fix(scrapers): skip Classic.com in liveness checker (uses 403 anti-bot)"
```

#### Part C: BeForward Enrichment Rate Limits (M3)

- [ ] **Step 8: Read BeForward enrichment config**

Read `src/app/api/cron/enrich-beforward/route.ts` to find rate limit and error handling config.

- [ ] **Step 9: Increase delay and add dead-URL pre-filter**

1. Increase request delay from 2s to 4s (`DELAY_MS = 2_000` → `4_000`)
2. Before fetching a URL for enrichment, check if the listing was already marked dead by liveness checker
3. On HTTP 404: mark listing as `delisted` and skip (don't count as error)

```typescript
// Increase delay:
const DELAY_MS = 4000; // was 2500

// Pre-filter dead URLs:
const listings = await supabase
  .from('listings')
  .select('*')
  .eq('source', 'BeForward')
  .neq('status', 'delisted')  // skip already-delisted
  .neq('status', 'unsold')    // skip already-unsold
  // ... rest of query
```

- [ ] **Step 10: Commit**

```bash
git add src/app/api/cron/enrich-beforward/route.ts
git commit -m "fix(scrapers): increase BeForward delay, skip dead URLs in enrichment"
```

---

## Execution Order

Tasks can be executed independently (no dependencies between tasks), but suggested priority:

1. **Task 1** (timeBudgetMs) — 5 min — unblocks Porsche/Ferrari collectors immediately
2. **Task 4** (BeForward selectors) — 15 min — requires HTML inspection
3. **Task 2** (C&B Scrapling) — 10 min — follows proven Scrapling pattern
4. **Task 3** (CC Scrapling) — 10 min — identical to Task 2
5. **Task 5** (BaT prices) — 15 min — requires HTML inspection of sold auctions
6. **Task 6** (Elferspot currency) — 10 min — straightforward enum fix
7. **Task 7** (Classic.com enrichment) — 20 min — diagnostic, root cause unclear
8. **Task 8** (AS24 + Liveness + BeForward) — 15 min — three small independent fixes

**Total estimated: ~100 minutes of implementation**

---

## Post-Fix Verification

After all fixes are applied, run the full scraper suite again:

```bash
npx tsx agents/testscripts/run-scrapers.ts
```

**Success criteria:**

| Scraper | Expected |
|---------|----------|
| Porsche Collector | OK, finishes in <25min, writes >0 |
| Ferrari Collector | OK, finishes in <25min, writes >0 |
| BeForward Collector | OK, discovered >0 |
| Cars & Bids | >0 auctions (via Porsche/Ferrari collectors) |
| Collecting Cars | >0 auctions (via Porsche/Ferrari collectors) |
| BaT Detail Scraper | DB updates >0 |
| Classic.com Enrichment | Skipped <50% |
| AutoScout24 Collector | OK or clear preflight failure |
| Elferspot Enrichment | 0 currency enum errors |
| BeForward Enrichment | 0 HTTP 429 errors |
| Liveness Checker | No Classic.com circuit break |

Then run the health audit:

```bash
npx tsx scripts/scraper-health-audit.ts --days=1 --strict
```

Expected: 0 FAILED, 0 ZERO-WRITE (except VIN/Title enrichment which are normal steady-state).
