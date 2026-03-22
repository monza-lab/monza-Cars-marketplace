# Liveness Checker — Design Spec

**Date:** 2026-03-23
**Status:** Draft
**Goal:** Detect and remove listings that no longer exist on their source marketplace within 24 hours SLA, achieving near-100% data freshness.

---

## Problem Statement

Monza currently has no active URL health checking. Dead listings are only detected passively:

- **Auction listings** (BaT, C&B, CC): detected via `end_time` expiry — works well.
- **Dealer/classified listings** (AS24, Elferspot, AutoTrader, BeForward, Classic.com): detected only if the image backfill or enrichment cron happens to fetch the URL and gets a 404. Otherwise, listings stay active for up to **90 days** before the staleness safety net catches them.

Additional issues:
- Status inconsistency: enrichment crons use `'delisted'`, cleanup/backfill use `'unsold'`. Both are excluded from the active frontend feed (`WHERE status = 'active'`), but analytics queries must account for both.
- The `__dead_url__` sentinel in the images array is an indirect signaling mechanism that couples backfill and cleanup.

---

## Scope

**In scope:**
- New `liveness-check` GitHub Actions job that verifies source URLs of active dealer/classified listings
- New `last_verified_at` column on the `listings` table
- Reduce staleness window from 90 → 30 days
- Collectors and enrichments update `last_verified_at` on successful upsert/fetch
- Remove `__dead_url__` sentinel from backfill (it already sets `status = 'unsold'` alongside the sentinel; the change is removing the sentinel, not adding the status)
- Register `'liveness-check'` in the `ScraperName` type union

**Out of scope:**
- Auction listings (already handled by `end_time` expiry)
- Full `'delisted'` → `'unsold'` codebase-wide unification (see Appendix A — separate follow-up project touching ~20+ files across collectors, normalizers, types, Zod schemas, and frontend mappers)
- Alerting/notifications for failed scraper runs (separate project)
- Data quality dashboard enhancements beyond basic liveness metrics

---

## Design

### 1. Schema Change

```sql
ALTER TABLE listings ADD COLUMN last_verified_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX idx_listings_liveness_queue
ON listings (last_verified_at ASC NULLS FIRST)
WHERE status = 'active';
```

- `NULL` = never verified (highest priority for checker)
- Updated whenever a health check, collector upsert, or enrichment fetch confirms the URL is alive

### 2. Liveness Checker Core

**Location:** `src/features/scrapers/liveness_checker/`

```
src/features/scrapers/liveness_checker/
  index.ts          — core logic: query → check → update
  cli.ts            — CLI entry point (npx tsx ...cli.ts)
  sourceConfig.ts   — per-source rate limits, batch sizes, delay
```

**Algorithm:**

1. Query active listings ordered by `last_verified_at ASC NULLS FIRST`, limit configurable (default 6,000)
   - Filter: `WHERE status = 'active' AND source_url IS NOT NULL`
   - Exclude auction sources (BaT, CarsAndBids, CollectingCars) — handled by `end_time` expiry
2. Group by source
3. Process all sources **in parallel** — each source runs in its own async loop with per-source rate limiting via `Promise.allSettled()`
4. For each listing, fetch `source_url` using a Chrome-like User-Agent header (same as `backfillImages.ts`):
   - **200** → `UPDATE last_verified_at = NOW()`
   - **301/302** → follow redirect (Node `fetch` default), then check final status. If final is 200, mark alive. See soft-404 note below.
   - **404/410** → `UPDATE status = 'unsold', last_verified_at = NOW()`
   - **403/429/503** → circuit-break that source (after 3 consecutive). Do not touch the listing.
   - **Timeout/network error** → skip, retry next cycle
5. Record results to `scraper_runs` with `scraper_name = 'liveness-check'`

**Soft-404 handling:** Some marketplaces (notably AutoScout24) redirect deleted listings to a search page with HTTP 200. The liveness checker does NOT attempt to detect soft-404s via body parsing — this is a known limitation. The staleness safety net (30-day cutoff in cleanup) handles these edge cases. A future enhancement could add per-source body validators.

**Per-source configuration (parallel execution):**

Each source runs independently in its own async loop. With 55 min budget and parallel execution, each source gets the full time window:

| Source | Delay | Max listings in 55 min | Estimated active listings | Full coverage cycle |
|---|---|---|---|---|
| AutoScout24 | 2s | ~1,650 | ~31,000 | ~19 days |
| Elferspot | 10s | ~330 | ~3,900 | ~12 days |
| AutoTrader | 2s | ~1,650 | ~TBD | ~TBD |
| BeForward | 2.5s | ~1,320 | ~TBD | ~TBD |
| Classic.com | 3s | ~1,100 | ~TBD | ~TBD |

**Total:** ~6,050 listings/day across all sources, ~55 minutes runtime (parallel).

**Request headers:** Each source uses a Chrome-like `User-Agent` to avoid bot detection. The existing `backfillImages.ts` UA string should be reused. Per-source overrides can be configured in `sourceConfig.ts` (e.g., Elferspot may need different headers).

**Circuit breaker:**
- If 3 consecutive requests to a source return 403/429/503, stop checking that source for the rest of the run.
- The source will be retried in the next daily run.
- Circuit break events are logged in `error_messages[]` in `scraper_runs`.

### 3. CLI Interface

```bash
# Default run
npx tsx src/features/scrapers/liveness_checker/cli.ts

# Limit to specific source
npx tsx src/features/scrapers/liveness_checker/cli.ts --source=AutoScout24 --maxListings=500

# Dry run (no DB writes)
npx tsx src/features/scrapers/liveness_checker/cli.ts --dryRun

# Custom delay
npx tsx src/features/scrapers/liveness_checker/cli.ts --source=Elferspot --delayMs=15000
```

**CLI flags:**

| Flag | Default | Description |
|---|---|---|
| `--maxListings` | `6000` | Max total listings to check |
| `--source` | `all` | Filter to a single source |
| `--delayMs` | per-source default | Override delay between requests |
| `--timeBudgetMs` | `3300000` (55 min) | Stop checking before this time |
| `--dryRun` | `false` | Skip DB writes |

### 4. GitHub Actions Workflow

```yaml
name: Liveness Checker (Daily)
on:
  schedule:
    - cron: '30 10 * * *'  # 10:30 UTC daily
  workflow_dispatch:
    inputs:
      max_listings:
        description: 'Max listings to check'
        default: '6000'
      dry_run:
        description: 'Skip DB writes'
        default: 'false'

jobs:
  liveness-check:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsx src/features/scrapers/liveness_checker/cli.ts
            --maxListings=${{ inputs.max_listings || '6000' }}
            ${{ inputs.dry_run == 'true' && '--dryRun' || '' }}
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

**Schedule:** 10:30 UTC daily — after all collectors and enrichments have run, so `last_verified_at` is already updated for listings they touched. The checker only verifies the ones nobody else touched that day.

**No Playwright, no proxies needed** — plain HTTP GET requests.

### 5. Status Handling

The liveness checker uses `status = 'unsold'` for dead URLs, consistent with the cleanup cron and backfill-images.

**Note:** A full `'delisted'` → `'unsold'` unification is out of scope for this project. The `'delisted'` status is used across ~20+ files (collectors, normalizers, types, Zod schemas, frontend mappers). Both statuses are already excluded from the active frontend feed (`WHERE status = 'active'`), so they function equivalently for the user. A separate follow-up project will unify them (see Appendix A).

### 6. Staleness Window Reduction

In `src/app/api/cron/cleanup/route.ts`, change the dealer staleness threshold from 90 → 30 days.

This acts as a **safety net** for listings the liveness checker couldn't reach (persistent blocks, network issues). With the checker as the primary detection mechanism, 30 days is a reasonable fallback.

### 7. Collectors Update `last_verified_at`

Every collector's upsert implicitly confirms the URL is alive. Add `last_verified_at: new Date().toISOString()` to the upsert payload in these exact files:

- `src/features/scrapers/porsche_collector/supabase_writer.ts`
- `src/features/scrapers/ferrari_collector/supabase_writer.ts`
- `src/features/scrapers/autoscout24_collector/supabase_writer.ts`
- `src/features/scrapers/classic_collector/supabase_writer.ts`
- `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- `src/features/scrapers/elferspot_collector/supabase_writer.ts`
- `src/features/autotrader_collector/supabase_writer.ts`

**Note:** `src/features/scrapers/porsche_ingest/` is legacy and not actively used — excluded from this change.

Similarly, enrichment crons that successfully fetch a detail page should update `last_verified_at` on the listing:

- `src/app/api/cron/enrich-details/route.ts` (AS24)
- `src/app/api/cron/enrich-elferspot/route.ts`
- `src/app/api/cron/enrich-beforward/route.ts`

### 8. Remove `__dead_url__` Sentinel

**In `src/features/scrapers/common/backfillImages.ts`:**
- The code already sets `status = 'unsold'` alongside the `__dead_url__` sentinel on 404/410
- The change is: remove `images: ['__dead_url__']` from the update payload, keep only `status: 'unsold'` and `updated_at`

**In `src/app/api/cron/cleanup/route.ts`:**
- Remove Step 1c (`WHERE images @> '["__dead_url__"]'`) — no longer needed

**One-time cleanup migration:**
```sql
UPDATE listings
SET status = 'unsold', images = '{}'
WHERE images @> '["__dead_url__"]'::jsonb AND status = 'active';
```

### 9. Monitoring

The liveness checker registers in `scraper_runs` like every other scraper:

| Field | Value |
|---|---|
| `scraper_name` | `'liveness-check'` |
| `discovered` | Total URLs checked |
| `written` | Listings marked `unsold` (dead URLs found) |
| `refresh_checked` | URLs confirmed alive |
| `source_counts` | Per-source breakdown: `{ "AutoScout24": { "discovered": 1650, "written": 15 }, ... }` (uses existing `discovered`/`written` shape from `ScraperRunRecord`) |
| `error_messages` | Circuit break events, network errors |

**Type registration:** Add `'liveness-check'` to the `ScraperName` string literal union in `src/features/scrapers/common/monitoring/types.ts`.

**Dashboard metrics (Data Quality tab):**

| Metric | Query |
|---|---|
| Listings never verified | `COUNT(*) WHERE status='active' AND last_verified_at IS NULL` |
| Verification coverage % | `COUNT(last_verified_at IS NOT NULL) / COUNT(*) WHERE status='active'` |
| Avg days since verification | `AVG(NOW() - last_verified_at) WHERE status='active'` |
| Dead URLs found (7d) | `SUM(written) FROM scraper_runs WHERE scraper_name='liveness-check' AND finished_at > NOW()-7d` |

---

## Updated Daily Schedule

```
00:00  Ferrari Collector           (Vercel, 5 min)    → updates last_verified_at
01:00  Porsche Collector           (Vercel, 5 min)    → updates last_verified_at
01:30  BaT Detail Scraper          (GH Actions, 30 min)
02:00  AutoTrader Collector        (Vercel, 5 min)    → updates last_verified_at
03:00  BeForward Collector         (Vercel, 5 min)    → updates last_verified_at
04:00  Classic.com Collector       (GH Actions, 45 min) → updates last_verified_at
04:30  Classic.com Image Backfill  (GH Actions, 45 min)
05:00  AutoScout24 Collector       (GH Actions, 90 min) → updates last_verified_at
05:30  Listing Validator           (Vercel, 1 min)
06:00  Cleanup                     (Vercel, 1 min)     → staleness 30d (was 90d)
06:30  Image Backfill              (Vercel, 5 min)     → marks unsold directly
07:00  VIN Enrichment              (Vercel, 1 min)
07:15  Title Enrichment            (Vercel, 1 min)
09:15  Elferspot Collector         (Vercel, 5 min)    → updates last_verified_at
09:45  Elferspot Enrichment        (Vercel, 5 min)    → updates last_verified_at
10:30  Liveness Checker            (GH Actions, 60 min) ← NEW
  --   AS24 Detail Enrichment      (Vercel, manual)   → updates last_verified_at
```

---

## Files Changed

| File | Change |
|---|---|
| **NEW** `src/features/scrapers/liveness_checker/index.ts` | Core checker logic |
| **NEW** `src/features/scrapers/liveness_checker/cli.ts` | CLI entry point |
| **NEW** `src/features/scrapers/liveness_checker/sourceConfig.ts` | Per-source config (rate limits, delays, batch sizes, headers) |
| **NEW** `.github/workflows/liveness-checker.yml` | GitHub Actions workflow |
| `src/features/scrapers/common/monitoring/types.ts` | Add `'liveness-check'` to `ScraperName` union |
| `src/app/api/cron/cleanup/route.ts` | 90d → 30d staleness; remove `__dead_url__` step 1c |
| `src/features/scrapers/common/backfillImages.ts` | Remove `images: ['__dead_url__']` from 404/410 update (keep `status: 'unsold'`) |
| `src/features/scrapers/porsche_collector/supabase_writer.ts` | Add `last_verified_at` to upsert |
| `src/features/scrapers/ferrari_collector/supabase_writer.ts` | Add `last_verified_at` to upsert |
| `src/features/scrapers/autoscout24_collector/supabase_writer.ts` | Add `last_verified_at` to upsert |
| `src/features/scrapers/classic_collector/supabase_writer.ts` | Add `last_verified_at` to upsert |
| `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts` | Add `last_verified_at` to upsert |
| `src/features/scrapers/elferspot_collector/supabase_writer.ts` | Add `last_verified_at` to upsert |
| `src/features/autotrader_collector/supabase_writer.ts` | Add `last_verified_at` to upsert |
| `src/app/api/cron/enrich-details/route.ts` | Add `last_verified_at` update on successful fetch |
| `src/app/api/cron/enrich-elferspot/route.ts` | Add `last_verified_at` update on successful fetch |
| `src/app/api/cron/enrich-beforward/route.ts` | Add `last_verified_at` update on successful fetch |
| `src/components/dashboard/` | Add liveness metrics to Data Quality tab |
| `docs/scrapers/SCRAPERS.md` | Document the new Liveness Checker |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Source blocks our IP after too many health checks | Circuit breaker stops after 3 consecutive 403/429; per-source rate limits respect robots.txt |
| False 404 (temporary server error on source) | Only mark `unsold` on 404/410 specifically; 5xx errors are skipped and retried |
| Soft-404 (redirect to search page with 200) | Known limitation — not detected by HTTP status alone. The 30-day staleness safety net catches these. Future enhancement: per-source body validators in `sourceConfig.ts` |
| GitHub Actions quota consumed | ~60 min/day is well within the free tier (2,000 min/month) |
| Listings marked unsold that come back | Collectors will re-discover and re-activate them on next run (upsert sets `status='active'`) |

---

## Success Criteria

1. **Zero active listings with `last_verified_at` > 20 days old** (steady state after ramp-up; AS24 has ~19-day coverage cycle at ~1,650/day)
2. **Dead URLs detected within 24h** of removal from source (for listings in that day's batch)
3. **No `__dead_url__` sentinel** in any listing's images array
4. **Liveness checker appears green** in the monitoring dashboard
5. **Staleness safety net at 30 days** catches any remaining edge cases (soft-404s, persistent blocks)

---

## Appendix A: `'delisted'` → `'unsold'` Unification (Follow-up Project)

The codebase uses `'delisted'` in ~20+ locations across collectors, normalizers, types, Zod schemas, and frontend mappers. A full unification is out of scope for this spec but should be done as a follow-up. Key files that would need changing:

**Normalizers:** `porsche_collector/normalize.ts`, `ferrari_collector/normalize.ts`, `autoscout24_collector/normalize.ts`, `classic_collector/normalize.ts`, `beforward_porsche_collector/normalize.ts`, `autotrader_collector/normalize.ts`, `porsche_ingest/services/normalize.ts`

**Supabase writers:** All 7 `supabase_writer.ts` files (stale listing marking logic)

**Types & schemas:** 6 `types.ts` files + 2 Zod schemas that define `'delisted'` as a valid status

**Collectors:** `TERMINAL_STATUSES` sets in `porsche_collector/collector.ts`, `ferrari_collector/collector.ts`, `autotrader_collector/collector.ts`

**Frontend:** `src/lib/supabaseLiveListings.ts` (maps `'delisted'` → `'ENDED'`), `src/lib/marketStats.ts` (special-cases `status === 'delisted'`)

**Enrichment routes:** `enrich-details/route.ts`, `enrich-elferspot/route.ts`, `enrich-beforward/route.ts`

Both `'delisted'` and `'unsold'` are excluded from the active frontend feed, so the current inconsistency is cosmetic/analytics-only — not user-facing.
