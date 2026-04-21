# Scrapers Daily Report — 2026-04-20

Report generated from cron runs on **2026-04-19** and a manual CLI run on **2026-04-19 22:18 UTC**.

---

## Inventory Summary

| Source | Active | Sold | Unsold | Delisted | Total |
|--------|-------:|-----:|-------:|---------:|------:|
| AutoScout24 | 6,345 | 0 | 3,858 | 12,213 | 22,416 |
| Classic.com | 4,998 | 232 | 459 | 2,307 | 7,996 |
| Elferspot | 4,054 | 0 | 83 | 31 | 4,168 |
| BeForward | 1,619 | 1 | 2,016 | 2,663 | 6,299 |
| AutoTrader | 608 | 0 | 1,012 | 5,345 | 6,965 |
| BaT | 70 | 4,364 | 1,405 | 0 | 5,839 |
| Cars & Bids | 0 | 0 | 0 | 0 | 0 |
| Collecting Cars | 0 | 0 | 0 | 0 | 0 |
| **Total** | **17,694** | **4,597** | **8,833** | **22,559** | **53,683** |

All active listings are **Porsche**. Ferrari active: 0 (Ferrari scraper writes to BaT/C&B/CC sources with `make=Ferrari`; 38 written today were ended auction records).

---

## Collector Runs (April 19)

| Scraper | Status | Discovered | Written | Errors | Last Run (UTC) |
|---------|--------|------------|---------|--------|----------------|
| Ferrari Collector | WORKING | 1,241 | 38 | 0 | 00:04 |
| Porsche Collector (cron) | DEGRADED | 1,068 | 0 | 2 | 01:05 |
| AutoTrader Collector | FAILED | 0 | 0 | 1 | 02:01 |
| BeForward Collector | WORKING | 75 | 75 | 0 | 03:02 |
| Classic.com Collector | DEGRADED | 1,080 | 118 | 12 | 13:28 |
| AutoScout24 Collector | WORKING | 124 | 100 | 0 | 05:02 |
| Elferspot Collector | STUCK | 0 | 0 | 0 | — |

### Collector Details

**Ferrari Collector** — Healthy. Discovered 1,241 listings across BaT, wrote 38 new/updated records.

**Porsche Collector (cron)** — Discovered 1,068 BaT listings but wrote 0 (all were duplicates of existing records). The 2 errors are from **Cars & Bids** and **Collecting Cars** returning **HTTP 403** (Forbidden). These sites are actively blocking plain HTTP scrapers and need a browser-based fallback (Playwright/Scrapling) to resume collection. The cron runs with `scrapeDetails: false` and only 2 pages — lighter than CLI mode.

**AutoTrader Collector** — Failed with 1 error. The AutoTrader GraphQL API (`at-gateway`) appears to be rejecting requests. Enrichment also failed (see below).

**BeForward Collector** — Healthy. 75 new listings discovered and written in summary-only mode.

**Classic.com Collector** — 3 runs (GitHub Actions). 1,080 discovered, 118 written, 12 errors. The errors are expected Cloudflare blocks on detail pages — the Scrapling/Playwright fallback chain handles most but some fail. Last run only wrote 3, indicating most listings were already in the DB.

**AutoScout24 Collector** — Healthy. 124 discovered, 100 written from GitHub Actions run.

**Elferspot Collector** — STUCK. No runs completed in the last 24h. An active run was last updated 837 minutes ago (~14 hours), suggesting it timed out or hung without recording completion. The enrichment cron did run successfully (see below), so the data pipeline isn't fully broken.

---

## Enrichment Runs (April 19)

| Enrichment Job | Status | Processed | Written | Errors | Last Run (UTC) |
|----------------|--------|-----------|---------|--------|----------------|
| VIN Enrichment | WORKING | 1,000 | 717 | 0 | 07:02 |
| Title Enrichment | WORKING | 1,000 | 338 | 0 | 07:15 |
| AS24 Detail Enrichment | DEGRADED | 100 | 95 | 5 | 07:32 |
| BeForward Enrichment | DEGRADED | 50 | 35 | 1 | 08:04 |
| Elferspot Enrichment | DEGRADED | 100 | 85 | 2 | 09:50 |
| AutoTrader Enrichment | FAILED | 13 | 0 | 1 | 07:45 |

**VIN Enrichment** — 717 listings decoded via NHTSA API. Strong performance.

**Title Enrichment** — 338 listings enriched with specs parsed from titles (engine, transmission, body, trim).

**AS24 Detail Enrichment** — 95/100 enriched, 5 errors (likely 404/410 delisted pages).

**BeForward Enrichment** — 35/50 enriched, 1 error. Acceptable.

**Elferspot Enrichment** — 85/100 enriched, 2 errors. Acceptable — note this ran even though the discovery cron was stuck.

**AutoTrader Enrichment** — Failed. Found 13 candidates but wrote 0. Same underlying issue as the AutoTrader collector.

---

## Maintenance Jobs (April 19)

| Job | Status | Scanned | Written | Last Run (UTC) |
|-----|--------|---------|---------|----------------|
| Cleanup | WORKING | 53,121 | 30 | 06:00 |
| Listing Validator | ZERO-WRITE | 12,868 | 0 | 05:30 |
| Image Backfill | ZERO-WRITE | 0 | 0 | 06:30 |
| BaT Detail Scraper | IDLE | — | — | — |
| Liveness Checker | IDLE | — | — | — |

**Cleanup** — Scanned 53,121 listings. Marked 30 as stale/dead/junk. Working normally.

**Listing Validator** — Scanned 12,868 recently updated listings. No invalid models or junk found. Clean.

**Image Backfill** — Ran but found no listings needing image backfill. All sources have images covered.

**BaT Detail Scraper** — Did not run (GitHub Actions, no trigger recorded today).

**Liveness Checker** — Did not run (GitHub Actions, no trigger recorded today).

---

## Manual CLI Run — BaT Porsche Collector

Run at **2026-04-19 22:18 UTC** with full detail scraping enabled.

| Metric | Value |
|--------|-------|
| Mode | `daily` with `scrapeDetails: true` |
| Duration | ~34 minutes |
| Auctions found (embedded JSON) | 1,052 |
| Porsche kept | 130 |
| Skipped (missing required fields) | 11 |
| Written to DB | 74 |
| Errors | 0 |
| Data quality score | 85 (from `/de/` URLs), 100 (from EN URLs) |

**Key observations:**
- The embedded JSON extraction is fast and reliable (1,052 auctions in 1.6s)
- Detail pages enriched with mileage, VIN, colors, engine, transmission, body style
- Non-car items correctly filtered: kiddie ride, ducktail spoiler, hood, display hoods, engine, targa panel, wheels, literature, Fuchs wheels, Porsche-Diesel tractor
- 3 listings had null price/currency (score 75): likely premium/reserve auctions
- C&B and CC returned HTTP 403 (same as cron)
- The scraper fetches detail pages twice (German `/de/` URLs then English URLs), causing duplicate work

---

## Issues Requiring Attention

### Critical

1. **Elferspot Collector STUCK** — Active run stuck for 14+ hours without completing. Needs investigation — check if the cron timed out or if there's a hanging process. May need to clear the active run flag in `scraper_runs`.

2. **AutoTrader Collector + Enrichment FAILED** — Both discovery and enrichment failed. The GraphQL API may have changed or is blocking requests. Last successful collection is unknown from this window.

### Moderate

3. **Cars & Bids HTTP 403** — Blocked by anti-bot protection. Needs Playwright/Scrapling fallback to resume collection. Currently 0 listings in inventory.

4. **Collecting Cars HTTP 403** — Same situation as Cars & Bids. Currently 0 listings in inventory.

5. **Porsche Collector cron wrote 0 listings** — While 1,068 were discovered, all were duplicates. This is because the cron runs `scrapeDetails: false` with only 2 pages — the CLI run later wrote 74 new records with full detail data. The cron is functioning but its limited scope means it rarely finds truly new listings.

### Low

6. **BaT Detail Scraper and Liveness Checker idle** — GitHub Actions workflows did not trigger today. Verify the workflow schedules are active.

7. **Classic.com 12 errors** — Expected Cloudflare blocks. The fallback chain handles most cases but some detail pages fail. Not actionable unless error rate increases significantly.

---

## Health Score

| Category | Healthy | Degraded | Failed/Stuck | Total |
|----------|---------|----------|--------------|-------|
| Collectors | 3 | 2 | 2 | 7 |
| Enrichment | 2 | 3 | 1 | 6 |
| Maintenance | 1 | 0 | 0 | 1 |
| **Overall** | **6** | **5** | **3** | **14** |

**Overall health: 43% healthy, 36% degraded, 21% failed/stuck**

Out of 18 tracked jobs, 10 have issues. The core pipeline (discovery + enrichment) is functional for 5 of 7 sources, with AutoTrader and Elferspot discovery needing immediate attention.

---

## Manual CLI Run — BeForward Full Crawl

Run at **2026-04-19 22:36 UTC → 2026-04-20 05:14 UTC** with full detail scraping.

```bash
npx tsx src/features/scrapers/beforward_porsche_collector/cli.ts --maxPages=200 --maxDetails=10000 --concurrency=6
```

### Results

| Metric | Value |
|--------|-------|
| Duration | 6h 38min |
| Pages processed | 156 / 162 attempted |
| Total on site | 4,034 listings |
| Discovered | 3,880 (96.2%) |
| Details fetched | 3,814 |
| Written to DB | 3,880 |
| Page-level errors | 6 |
| Total fetch errors | 72 |

### Error Breakdown

| Type | Count | Impact |
|------|-------|--------|
| HTTP 429 (rate limit) | ~55 detail + 5 page-level | High — each burst causes ~5 min cooldown |
| HTTP 404 (dead listings) | ~20 detail + 1 page-level | Low — already removed from site |
| Unresolvable model | 154 skipped (3.8%) | Medium — listings with only "Porsche", no model |

### Rate Limiting Analysis

With `concurrency=6`, each 429 response blocks all 6 concurrent requests simultaneously, causing ~5-minute cooldown cycles. This happened ~10 times during the run at pages: 6, 12, 18, 24, 37, 41, 63, 68, 85, 112, 133, 138, 149.

The 429 bursts are the primary time sink — without them, the run would have completed in ~3-4 hours instead of 6h38m.

### 404 Concentration

Pages 87-88 had ~15 HTTP 404s between them (Cayenne, Panamera, 911 listings). These are older listings already sold/removed from BeForward. The 404 rate increases significantly past page 85, indicating stale inventory in later pages.

### Unresolvable Model Pattern

154 listings (3.8%) were skipped with `unresolvable-model:PORSCHE`. These appear across all years (2009-2025) and increase in frequency toward later pages. BeForward lists these as "Porsche" without a specific model in the card view — the detail page may contain model info but is not checked during validation.

### Changes Applied

Based on this run's performance data, the following defaults were updated:

| Parameter | Before | After | Reason |
|-----------|--------|-------|--------|
| `concurrency` | 6 | 3 | Avoid 429 bursts from 6 simultaneous requests |
| `rateLimitMs` | 2500ms | 4000ms | More conservative pacing between requests |

Applied to: `collector.ts` (defaults), `cli.ts` (defaults + help), `route.ts` (cron config), `SCRAPERS.md` (docs).

Expected impact: fewer 429 cooldowns, paradoxically faster total runtime despite slower per-request rate.

---

## Scrapling Evaluation for BeForward

### Current Fetching Architecture

BeForward uses **plain HTTP `fetch()`** with static headers (User-Agent, Accept) via `net.ts`. No browser emulation, no TLS fingerprint impersonation, no Cloudflare handling. The `PerDomainRateLimiter` enforces a minimum interval between requests, and `withRetry()` does exponential backoff with 4x delay on 429s.

### Would Scrapling Help?

**Partially — but it's not the right tool for this problem.**

| Factor | Assessment |
|--------|------------|
| **Anti-bot protection** | BeForward uses simple IP-based rate limiting (429), NOT Cloudflare/Akamai WAF. Scrapling's browser impersonation doesn't help here. |
| **429 root cause** | Too many requests per time window from the same IP. Scrapling sends requests from the same IP — same problem. |
| **What would actually help** | Proxy rotation (different IPs) or lower request rate. The concurrency/rateLimitMs changes address this. |
| **Scrapling overhead** | Python subprocess spawn per request adds ~200-500ms latency — counterproductive for 3,800+ detail pages. |
| **Vercel compatibility** | Scrapling requires Python runtime, unavailable on Vercel. Cron route would need a separate GHA workflow. |

### When Scrapling WOULD Help BeForward

1. **If BeForward adds Cloudflare/WAF protection** in the future — Scrapling's `StealthyFetcher` with `--solve-cloudflare` would bypass it, as proven with Classic.com (95%+ success).
2. **For the "unresolvable model" problem** — Scrapling could render JavaScript-heavy pages that might reveal model data hidden from plain HTTP. However, BeForward pages are static HTML, so this is unlikely.

### Recommendation

**Don't add Scrapling to BeForward now.** The 429s are an IP rate-limiting issue, not a bot-detection issue. The concurrency/rateLimitMs changes are the correct fix. If BeForward adds Cloudflare protection in the future, the Scrapling integration pattern from Classic.com (`scrapling.ts` + Python fetch script) can be ported in ~2 hours.

**Better alternatives for further improvement:**
1. **Proxy rotation** — Route detail-page requests through Decodo residential proxy to distribute load across IPs. Already configured in the project for other scrapers.
2. **Adaptive backoff** — Current 429 backoff is 30s minimum. Could implement progressive IP cooling (30s → 60s → 120s) and resume from different page ranges.
3. **Stale page cutoff** — Skip pages beyond ~130 (where 404 rate spikes), reducing wasted requests on dead listings.
