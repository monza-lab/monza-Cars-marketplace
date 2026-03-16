# Scrapers: Next Steps for 100% Data Coverage

Current state as of 2026-03-15. Based on full manual run of all 6 scrapers + analysis of GitHub Actions history and cron route code.

---

## Status Summary

| # | Scraper | Status | Daily Yield | Coverage Gap |
|---|---------|--------|-------------|--------------|
| 1 | Porsche (BaT) | Working | ~36 new | Only 1 of 3 sources active; no backfill |
| 2 | Ferrari (BaT) | **Data deleted daily** | ~75 new (then deleted) | Cleanup cron deletes all Ferrari listings |
| 3 | AutoTrader UK | Working | ~98 new | Porsche-only; brittle API headers |
| 4 | BeForward | Working (low yield) | 0 new | Porsche-only; image backfill broken |
| 5 | Classic.com | **Broken** | 0 | Needs residential proxy |
| 6 | AutoScout24 | Working | ~4,979 new | 87% shard coverage at 5000 cap |

---

## CRITICAL — Fix Immediately

### 1. Cleanup cron is deleting all Ferrari listings

**File:** `src/app/api/cron/cleanup/route.ts:24`

The `detectJunk()` function has Rule 1: `if (make !== "porsche") return "non-porsche-make"`. This deletes **every Ferrari listing** daily — the Ferrari collector writes ~75-192 listings per run, then the cleanup cron at 06:00 UTC deletes them all.

**Fix:** Add Ferrari (and future makes) to the allowlist:

```typescript
// Rule 1: Non-supported makes
const allowedMakes = ["porsche", "ferrari"];
if (!allowedMakes.includes(make)) {
  return `unsupported-make:${row.make}`;
}
```

**Impact:** HIGH — Ferrari data has been silently deleted for weeks/months.

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

### 3. Porsche cron only scrapes BaT (ignores CarsAndBids + CollectingCars)

**File:** `src/app/api/cron/porsche/route.ts:55`

The collector supports 3 sources (`BaT`, `CarsAndBids`, `CollectingCars`), but the cron hard-codes `sources: ["BaT"]`. CarsAndBids and CollectingCars are never called automatically.

**Fix:** Enable all 3 sources:

```typescript
const result = await runCollector({
  mode: "daily",
  sources: ["BaT", "CarsAndBids", "CollectingCars"],
  maxActivePagesPerSource: 3,
  maxEndedPagesPerSource: 0,
  scrapeDetails: false,
  timeBudgetMs: remainingBudgetMs,
  dryRun: false,
});
```

**Risk:** May exceed the 5-minute Vercel limit. Consider reducing `maxActivePagesPerSource` to 2 if timing is tight.

---

### 4. Porsche cron never calls LightBackfill (sold auction history)

**File:** `src/app/api/cron/porsche/route.ts`

The Ferrari cron has a step 3 that calls `runLightBackfill()` to ingest recently sold BaT auctions. The Porsche cron has the exact same function available in `porsche_collector/historical_backfill.ts` but never calls it.

**Fix:** Add a step 3 to the Porsche cron route (same pattern as Ferrari cron):

```typescript
// Step 3: Light backfill of recent sold auctions
const backfillBudgetMs = Math.min(remainingMs, 120_000);
if (backfillBudgetMs > 30_000) {
  const backfillResult = await runLightBackfill({
    timeBudgetMs: backfillBudgetMs,
    windowDays: 30,
  });
}
```

**Impact:** Without this, only active (currently live) Porsche auctions are tracked. All sold auction data (hammer prices, sell-through rates) is missing.

---

### 5. AutoScout24 only covers 87% of shards (45/52)

**File:** `.github/workflows/autoscout24-collector.yml`

At `maxListings=5000`, the run completes 45 of 52 shards before hitting the cap. The remaining 7 shards (likely smaller country + model combos like Netherlands, Luxembourg) are never scraped.

**Options:**
- **A) Raise maxListings to 7000** — should cover all 52 shards. Increase timeout to 120 min.
- **B) Accept 87%** — the missing shards are small markets (L, NL). Cost-benefit may not justify the extra GH Actions minutes.

**Also:** `splitSaturatedShard()` in `shards.ts` is dead code — large shards that hit the 20-page AS24 pagination cap silently truncate data. Consider wiring it up for the 911-D shards (Germany, the largest market).

---

## MEDIUM PRIORITY — Enrichment & Quality

### 6. AutoScout24 never fetches detail pages

**File:** `.github/workflows/autoscout24-collector.yml:64`

The workflow runs with `scrapeDetails=false` (default). All data comes from search result cards. This means these fields are always null for AutoScout24 listings:
- `transmission` (manual/automatic)
- `engine` (displacement, cylinders)
- `body_style`
- `exterior_color` / `interior_color`
- `vin`
- `description`

**Fix:** Consider enabling `--scrapeDetails` for a subset (e.g., new listings only) or running a periodic detail-enrichment job. This adds ~2s per listing, so a full 5000-listing detail scrape would take ~3 hours.

---

### 7. BeForward image backfill may have a column type mismatch

**File:** `src/features/beforward_porsche_collector/backfill.ts`

The backfill query filters `images.is.null,images.eq.{}` which translates to SQL `images IS NULL OR images = '{}'`. If the `images` column stores JSON arrays (`[]`) instead of PostgreSQL text arrays (`{}`), the filter never matches and backfill finds 0 listings.

**Fix:** Verify the `images` column type in Supabase. If it's `jsonb`, change the filter to:

```typescript
.or("images.is.null,images.eq.[]")
```

---

### 8. Ferrari backfill times out (insufficient time budget)

**File:** `src/app/api/cron/ferrari/route.ts`

Steps 1+2 (refresh + discover) consume ~250s of the 300s Vercel limit. The LightBackfill step gets only ~50s, which is barely enough to process 2-3 BaT model pages before timing out.

**Options:**
- **A) Skip CarsAndBids + CollectingCars in the Ferrari cron** (they return 0 results anyway) to free up time for backfill
- **B) Move Ferrari backfill to a separate cron route** (e.g. `/api/cron/ferrari-backfill`) with its own 5-min budget
- **C) Move Ferrari collector to GitHub Actions** (like AutoScout24) for a longer runtime

---

### 9. AutoTrader has brittle hard-coded API headers

**File:** `src/features/autotrader_collector/collector.ts`

The GraphQL gateway request uses hard-coded headers:
```
x-sauron-app-name: sauron-search-ui
x-sauron-app-version: 6c9dff0561
```

If AutoTrader rotates their internal app version, the scraper will silently fail (likely 403 or empty results). There is no version-detection mechanism.

**Fix:** Add a pre-flight check that fetches `autotrader.co.uk` and extracts the current app version from the page source, or alert when the gateway returns unexpected responses.

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

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 1 | Fix cleanup cron (stop deleting Ferrari) | 5 min | Saves ~192 listings/day |
| 2 | Get Decodo proxy for Classic.com | Config only | Unlocks entire scraper |
| 3 | Enable CarsAndBids + CollectingCars in Porsche cron | 10 min | 2 new auction sources |
| 4 | Add LightBackfill to Porsche cron | 15 min | Sold auction history |
| 5 | Raise AutoScout24 maxListings to 7000 | 2 min | 100% shard coverage |
| 6 | Fix BeForward image backfill filter | 5 min | Images for all BeForward listings |
| 7 | Separate Ferrari backfill into own cron | 30 min | Reliable sold-auction data |
| 8 | Enable AutoScout24 detail scraping | 15 min | Rich listing metadata |
| 9 | Add Ferrari to AutoTrader/AutoScout24 | 1-2 hours | Multi-source Ferrari coverage |
