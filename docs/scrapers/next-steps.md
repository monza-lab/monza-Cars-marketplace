# Scrapers: Next Steps for 100% Data Coverage

Current state as of 2026-03-20. Based on full manual run of all scrapers + analysis of GitHub Actions history, cron route code, and nightly scraper_runs data.

---

## Status Summary

| # | Scraper | Status | Daily Yield | Coverage Gap |
|---|---------|--------|-------------|--------------|
| 1 | Porsche (BaT+C&B+CC) | **Working** — 3 sources + backfill | ~1,030 (BaT) | C&B and CC return 403 (Cloudflare/SPA) |
| 2 | Ferrari (BaT) | Working (Porsche-only project) | ~75 new | N/A — project is Porsche-only |
| 3 | AutoTrader UK | **Working** — dynamic version detection | ~98 new | Porsche-only; version auto-detected |
| 4 | BeForward | **Working** — image backfill active | ~0 new (stable inventory) | Dead URLs now marked as unsold |
| 5 | Classic.com | **Broken** — Cloudflare blocks | 0 | Needs residential proxy credentials |
| 6 | AutoScout24 | **Working** — 100% shards | ~4,979 new | Detail enrichment via enrich-details cron |
| 7 | Image Backfill | **Working** — dead URL handling | 20/source/run | Dead URLs → unsold on 404/410 |
| 8 | Cleanup | **Working** — 3-step maintenance | N/A | Stale→sold/unsold, dead URLs→unsold, junk deletion |
| 9 | Validate | **Working** | N/A | Validates last 25h of listings |
| 10 | VIN Enrichment | **Working** | N/A | NHTSA vPIC decoding |
| 11 | Title Enrichment | **Working** | N/A | Regex extraction of specs from titles |
| 12 | AS24 Detail Enrichment | **Working** (manual) | 25/run | Not on scheduled cron yet |

---

## OPEN — Action Required

### 1. Classic.com needs a residential proxy

**File:** `.github/workflows/classic-collector.yml`

Classic.com uses Cloudflare protection. Without a proxy, only page 1 of search results loads — all subsequent pages and all detail pages time out. The workflow already has `DECODO_PROXY_*` env vars wired but no actual proxy credentials configured.

**Action required:**
1. Get a Decodo/SmartProxy residential proxy subscription
2. Add these GitHub Actions secrets:
   - `DECODO_PROXY_URL` (e.g. `http://gate.smartproxy.com:7000`)
   - `DECODO_PROXY_USER`
   - `DECODO_PROXY_PASS`
3. Add the same to `.env.local` for local runs

**Impact:** HIGH — Classic.com scraper produces 0 usable data without it.

---

### 2. Cars & Bids and Collecting Cars return 403

**Scrapers:** Porsche Collector, Ferrari Collector

Both Cars & Bids and Collecting Cars are SPA/Cloudflare-protected sites. The HTTP-based scraper gets 403 errors. Currently only BaT works for auction data.

**Options:**
- Add Playwright-based scraping (like Classic.com) for C&B and CC
- Use a residential proxy with the HTTP scraper
- Accept BaT-only auction coverage for now

**Impact:** MEDIUM — BaT already provides the bulk of auction data (~1,030 listings/night).

---

### 3. ~~Schedule AS24 Detail Enrichment~~ — FIXED

Added to `vercel.json` at `30 7 * * *`. Running successfully (25 listings/run).

### 3b. GitHub Actions workflows broken — FIXED (2026-03-21)

All three GitHub Actions workflows (AutoScout24, Classic.com, Classic.com Image Backfill) were failing since Mar 18 due to the scraper directory restructure (`src/features/` → `src/features/scrapers/`). Workflow paths updated. Also fixed Playwright browser install to include `rebrowser-playwright` version.

---

### 4. AutoScout24 saturated shard splitting is dead code

**File:** `src/features/autoscout24_collector/shards.ts`

`splitSaturatedShard()` exists but is never called. Large shards that hit the 20-page AS24 pagination cap silently truncate data. The fix raised `maxListings` to 7000 which covers most shards, but fundamentally the problem remains for high-volume model/country combinations.

**Impact:** LOW — affects maybe 2-3 shards out of 52.

---

## FIXED (2026-03-20)

### 5. Dead URL listings staying active — FIXED

**Status:** Two-part fix implemented:

1. **Forward fix** — `backfillImages.ts`: on 404/410, now sets `status = 'unsold'` alongside `images = ['__dead_url__']` so the listing immediately leaves the active feed.
2. **Retroactive fix** — `cleanup/route.ts`: new Step 1c finds existing `__dead_url__` listings still marked `active` and sets them to `unsold`.

**Commits:** `9e389a7`, `6e655d7`

---

### 6. Exchange rates were hardcoded — FIXED

**Status:** Replaced hardcoded `TO_USD = { EUR: 1.09, GBP: 1.27, JPY: 0.0067 }` with live rates from the Frankfurter API across all 4 files that used them:
- `supabaseLiveListings.ts` (server-side)
- `makePageHelpers.ts` (server-side)
- `valuation.ts` (client-side, via CurrencyContext)
- `DashboardClient.tsx` (client-side, via CurrencyContext)

New shared helper: `src/lib/exchangeRates.ts` — Frankfurter API, 1h memory cache, 5s timeout, fallback rates.

**Commit:** `e3344f9`

---

## FIXED (2026-03-19)

### 7. Porsche cron only scraped BaT — FIXED

All 3 sources enabled (`BaT`, `CarsAndBids`, `CollectingCars`). `maxActivePagesPerSource` reduced to 2 and collector budget to 180s to accommodate LightBackfill step.

### 8. Porsche cron never called LightBackfill — FIXED

Step 3 added to Porsche cron route calling `runLightBackfill({ windowDays: 30, maxListingsPerModel: 1 })`. Time-budgeted with 90s max, skipped if <30s remaining.

### 9. AutoScout24 only covered 87% of shards — FIXED

`maxListings` raised from 5000 to 7000 in `.github/workflows/autoscout24-collector.yml`.

### 10. AutoScout24 detail page enrichment — FIXED

New `/api/cron/enrich-details` cron route. Processes 25 AS24 listings per run via plain HTTP + `parseDetailHtml()` (cheerio, no Playwright).

### 11. BeForward image backfill column type mismatch — FIXED

Changed `images.eq.{}` to `images.eq.[]` in both `common/backfillImages.ts` and `beforward_porsche_collector/backfill.ts`.

### 12. Ferrari backfill timeout — FIXED

Added time-budget tracking. `scrapeDetails: false` and `maxEndedPagesPerSource: 2` reduce collector time, leaving ~50-90s for backfill.

### 13. AutoTrader brittle hard-coded API headers — FIXED

Added `detectAppVersion()` with 3 detection strategies + fallback. Tests cover all strategies + caching + fallback.

---

## LOW PRIORITY — Future Expansion

### 14. All scrapers except Ferrari are Porsche-only

| Scraper | Current Makes | Potential |
|---------|--------------|-----------|
| AutoTrader | Porsche | Ferrari (code exists, needs `make` override in cron) |
| BeForward | Porsche | Any make (needs URL builder update) |
| Classic.com | Porsche, US only | Ferrari, EU locations |
| AutoScout24 | Porsche | Ferrari, BMW, Mercedes (needs `make` param in shards) |

### 15. Classic.com only covers US market

The cron hard-codes `location: "US"`. Classic.com also has European inventory.

### 16. No sold-data tracking for dealer listings

BeForward, AutoTrader, AutoScout24, and Classic.com only track active for-sale listings. When a listing disappears, it's now marked as `unsold` (via dead URL detection). The actual sale price is unknown — only BaT tracks hammer prices.

Consider: snapshot `asking_price` daily to track price drops over time.

---

## Recommended Priority Order

| Priority | Task | Effort | Impact | Status |
|----------|------|--------|--------|--------|
| 1 | Get Decodo proxy for Classic.com | Config only | Unlocks entire scraper | **OPEN** |
| 2 | Fix C&B / CC 403s (Playwright or proxy) | 2-4 hours | 2 more auction sources | **OPEN** |
| 3 | Schedule AS24 Detail Enrichment | 1 line in vercel.json | Automated metadata enrichment | **OPEN** |
| 4 | Fix saturated shard splitting | 1-2 hours | Complete AS24 coverage | **OPEN** |
| 5 | ~~Dead URL delisting~~ | 30 min | Clean active feed | **FIXED** |
| 6 | ~~Exchange rates~~ | 1 hour | Accurate regional valuations | **FIXED** |
| 7 | ~~Enable CarsAndBids + CollectingCars~~ | 10 min | 2 new auction sources | **FIXED** |
| 8 | ~~Add LightBackfill to Porsche cron~~ | 15 min | Sold auction history | **FIXED** |
| 9 | ~~Raise AutoScout24 maxListings~~ | 2 min | 100% shard coverage | **FIXED** |
| 10 | ~~Fix BeForward image backfill filter~~ | 5 min | Images for BeForward | **FIXED** |
| 11 | ~~AS24 detail enrichment~~ | 15 min | Rich listing metadata | **FIXED** |
| 12 | ~~Ferrari backfill timeout~~ | 30 min | Reliable sold-auction data | **FIXED** |
| 13 | ~~AutoTrader header hardening~~ | 30 min | Prevent silent API breakage | **FIXED** |
