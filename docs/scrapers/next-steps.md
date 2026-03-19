# Scrapers: Next Steps for 100% Data Coverage

Current state as of 2026-03-19. Based on full manual run of all scrapers + analysis of GitHub Actions history and cron route code.

---

## Status Summary

| # | Scraper | Status | Daily Yield | Coverage Gap |
|---|---------|--------|-------------|--------------|
| 1 | Porsche (BaT+C&B+CC) | **FIXED** — 3 sources + backfill | ~36+ new | All 3 auction sources active; LightBackfill enabled |
| 2 | Ferrari (BaT) | Working (Porsche-only project) | ~75 new | N/A — project is Porsche-only |
| 3 | AutoTrader UK | **FIXED** — dynamic version detection | ~98 new | Porsche-only; version auto-detected from page source |
| 4 | BeForward | **FIXED** — image backfill filter | 0 new | Porsche-only; image filter corrected |
| 5 | Classic.com | **Broken** | 0 | Needs residential proxy |
| 6 | AutoScout24 | **FIXED** — 100% shards | ~4,979 new | maxListings raised to 7000 |

---

## ~~CRITICAL — Fix Immediately~~ (Resolved)

### 1. ~~Cleanup cron is deleting all Ferrari listings~~ — N/A

**Status:** Not a bug — project is Porsche-only. The cleanup cron correctly deletes non-Porsche listings. Ferrari scraper exists but the project scope is Porsche only.

---

### 2. Classic.com needs a residential proxy

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

## HIGH PRIORITY — Significant Data Gaps

### 3. ~~Porsche cron only scrapes BaT~~ — FIXED (2026-03-19)

**Status:** All 3 sources enabled (`BaT`, `CarsAndBids`, `CollectingCars`). `maxActivePagesPerSource` reduced to 2 and collector budget to 180s to accommodate LightBackfill step.

---

### 4. ~~Porsche cron never calls LightBackfill~~ — FIXED (2026-03-19)

**Status:** Step 3 added to Porsche cron route calling `runLightBackfill({ windowDays: 30, maxListingsPerModel: 1 })`. Time-budgeted with 90s max, skipped if <30s remaining.

---

### 5. ~~AutoScout24 only covers 87% of shards~~ — FIXED (2026-03-19)

**Status:** `maxListings` raised from 5000 to 7000 in `.github/workflows/autoscout24-collector.yml`. Should now cover all 52 shards.

**Still open:** `splitSaturatedShard()` in `shards.ts` is dead code — large shards that hit the 20-page AS24 pagination cap silently truncate data.

---

## MEDIUM PRIORITY — Enrichment & Quality

### 6. ~~AutoScout24 never fetches detail pages~~ — FIXED (2026-03-19)

**Status:** New `/api/cron/enrich-details` cron route created. Processes 25 AS24 listings per run via plain HTTP fetch + `parseDetailHtml()` (cheerio, no Playwright). Enriches: trim, transmission, bodyStyle, engine, colors, VIN, description, images. Circuit-breaks on 403/429. Registered in monitoring dashboard as "AS24 Detail Enrichment".

---

### 7. ~~BeForward image backfill column type mismatch~~ — FIXED (2026-03-19)

**Status:** Changed `images.eq.{}` to `images.eq.[]` in both `common/backfillImages.ts` and `beforward_porsche_collector/backfill.ts`. The `images` column is `jsonb` storing arrays.

---

### 8. ~~Ferrari backfill times out~~ — FIXED (2026-03-19, previous session)

**Status:** Fixed by adding time-budget tracking to the Ferrari collector. `scrapeDetails: false` and `maxEndedPagesPerSource: 2` reduce collector time, leaving ~50-90s for backfill. Concurrent refresh with `Promise.allSettled` further reduced Step 1 time.

---

### 9. ~~AutoTrader has brittle hard-coded API headers~~ — FIXED (2026-03-19)

**Status:** Added `detectAppVersion()` to `discover.ts` with 3 detection strategies (meta tag, JSON metadata, webpack chunk pattern) + fallback to known `"6c9dff0561"`. Result cached for process lifetime. `fetchAutoTraderGatewayPage()` now calls `detectAppVersion()` instead of using hardcoded header. Tests cover all strategies + caching + fallback.

---

## LOW PRIORITY — Future Expansion

### 10. All scrapers except Ferrari are Porsche-only

| Scraper | Current Makes | Potential |
|---------|--------------|-----------|
| AutoTrader | Porsche | Ferrari (code exists, needs `make` override in cron) |
| BeForward | Porsche | Any make (needs URL builder update) |
| Classic.com | Porsche, US only | Ferrari, EU locations |
| AutoScout24 | Porsche | Ferrari, BMW, Mercedes (needs `make` param in shards) |

Adding Ferrari support to these scrapers would dramatically increase Ferrari listing coverage beyond just BaT auctions.

---

### 11. Classic.com only covers US market

**File:** `src/app/api/cron/classic/route.ts`

The cron hard-codes `location: "US"`. Classic.com also has European inventory. Consider adding additional runs with `location: "EU"` or removing the location filter entirely.

---

### 12. No sold-data tracking for dealer listings

BeForward, AutoTrader, AutoScout24, and Classic.com only track currently active for-sale listings. When a listing disappears, it's marked as `delisted` — but the actual sale price is unknown. Only BaT (via Porsche/Ferrari collectors) tracks hammer prices.

Consider adding price-history tracking: snapshot `asking_price` daily so you can track price drops over time, even without knowing the final sale price.

---

## Recommended Priority Order

| Priority | Task | Effort | Impact | Status |
|----------|------|--------|--------|--------|
| 1 | ~~Fix cleanup cron~~ | 5 min | N/A | N/A — Porsche-only project |
| 2 | Get Decodo proxy for Classic.com | Config only | Unlocks entire scraper | **OPEN** |
| 3 | ~~Enable CarsAndBids + CollectingCars~~ | 10 min | 2 new auction sources | **FIXED** |
| 4 | ~~Add LightBackfill to Porsche cron~~ | 15 min | Sold auction history | **FIXED** |
| 5 | ~~Raise AutoScout24 maxListings to 7000~~ | 2 min | 100% shard coverage | **FIXED** |
| 6 | ~~Fix BeForward image backfill filter~~ | 5 min | Images for BeForward listings | **FIXED** |
| 7 | ~~Ferrari backfill timeout~~ | 30 min | Reliable sold-auction data | **FIXED** |
| 8 | ~~Enable AutoScout24 detail scraping~~ | 15 min | Rich listing metadata | **FIXED** |
| 9 | ~~AutoTrader header hardening~~ | 30 min | Prevent silent API breakage | **FIXED** |
