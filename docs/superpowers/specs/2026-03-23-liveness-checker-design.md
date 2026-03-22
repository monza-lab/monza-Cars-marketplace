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
- Enrichment crons use `status = 'delisted'` while cleanup/backfill use `'unsold'` — inconsistent.
- The `__dead_url__` sentinel in the images array is an indirect signaling mechanism that couples backfill and cleanup.

---

## Scope

**In scope:**
- New `liveness-check` GitHub Actions job that verifies source URLs of active dealer/classified listings
- New `last_verified_at` column on the `listings` table
- Unify `'delisted'` → `'unsold'` across all enrichment crons
- Reduce staleness window from 90 → 30 days
- Collectors and enrichments update `last_verified_at` on successful upsert/fetch
- Remove `__dead_url__` sentinel — backfill marks `unsold` directly

**Out of scope:**
- Auction listings (already handled by `end_time` expiry)
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

1. Query active listings ordered by `last_verified_at ASC NULLS FIRST`, limit configurable (default 4,000)
2. Group by source
3. Process each source sequentially with per-source rate limiting
4. For each listing, fetch `source_url`:
   - **200/301/302** → `UPDATE last_verified_at = NOW()`
   - **404/410** → `UPDATE status = 'unsold', last_verified_at = NOW()`
   - **403/429/503** → circuit-break that source, move to next source. Do not touch the listing.
   - **Timeout/network error** → skip, retry next cycle
5. Record results to `scraper_runs` with `scraper_name = 'liveness-check'`

**Per-source configuration:**

| Source | Delay between requests | Daily batch size | Full coverage cycle |
|---|---|---|---|
| AutoScout24 | 2s | 1,200 | ~26 days (31K listings) |
| Elferspot | 10s (robots.txt) | 300 | ~13 days (3.9K listings) |
| AutoTrader | 2s | 1,000 | ~depends on volume |
| BeForward | 2.5s | 800 | ~depends on volume |
| Classic.com | 3s | 700 | ~depends on volume |

**Total:** ~4,000 listings/day, ~60 minutes runtime.

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
| `--maxListings` | `4000` | Max total listings to check |
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
        default: '4000'
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
            --maxListings=${{ inputs.max_listings || '4000' }}
            ${{ inputs.dry_run == 'true' && '--dryRun' || '' }}
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

**Schedule:** 10:30 UTC daily — after all collectors and enrichments have run, so `last_verified_at` is already updated for listings they touched. The checker only verifies the ones nobody else touched that day.

**No Playwright, no proxies needed** — plain HTTP GET requests.

### 5. Status Unification

**Change `'delisted'` → `'unsold'` in:**
- `src/app/api/cron/enrich-details/route.ts` (AS24 enrichment)
- `src/app/api/cron/enrich-elferspot/route.ts` (Elferspot enrichment)

**One-time data migration:**
```sql
UPDATE listings SET status = 'unsold' WHERE status = 'delisted';
```

After this, `'delisted'` is no longer used anywhere in the codebase.

### 6. Staleness Window Reduction

In `src/app/api/cron/cleanup/route.ts`, change the dealer staleness threshold from 90 → 30 days.

This acts as a **safety net** for listings the liveness checker couldn't reach (persistent blocks, network issues). With the checker as the primary detection mechanism, 30 days is a reasonable fallback.

### 7. Collectors Update `last_verified_at`

Every collector's upsert implicitly confirms the URL is alive. Add `last_verified_at: new Date().toISOString()` to the upsert payload in:

- Porsche Collector (`supabase_writer.ts` or equivalent)
- Ferrari Collector
- AutoTrader Collector
- BeForward Collector
- Classic.com Collector
- AutoScout24 Collector
- Elferspot Collector

Similarly, enrichment crons that successfully fetch a detail page should update `last_verified_at` on the listing.

### 8. Remove `__dead_url__` Sentinel

**In `src/features/scrapers/common/backfillImages.ts`:**
- When a 404/410 is detected, directly set `status = 'unsold'` instead of `images = ['__dead_url__']`
- Remove the `__dead_url__` sentinel logic

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
| `source_counts` | Per-source breakdown: `{ "AutoScout24": { "checked": 1200, "dead": 15 }, ... }` |
| `error_messages` | Circuit break events, network errors |

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
| **NEW** `src/features/scrapers/liveness_checker/sourceConfig.ts` | Per-source config |
| **NEW** `.github/workflows/liveness-checker.yml` | GitHub Actions workflow |
| `src/app/api/cron/enrich-details/route.ts` | `'delisted'` → `'unsold'` |
| `src/app/api/cron/enrich-elferspot/route.ts` | `'delisted'` → `'unsold'` |
| `src/app/api/cron/cleanup/route.ts` | 90d → 30d staleness; remove `__dead_url__` step |
| `src/features/scrapers/common/backfillImages.ts` | Remove `__dead_url__` sentinel, mark `unsold` directly |
| All 7 collector `supabase_writer.ts` files | Add `last_verified_at` to upsert |
| All enrichment routes | Add `last_verified_at` update on successful fetch |
| `src/components/dashboard/` | Add liveness metrics to Data Quality tab |
| `docs/scrapers/SCRAPERS.md` | Document the new Liveness Checker |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Source blocks our IP after too many health checks | Circuit breaker stops after 3 consecutive 403/429; per-source rate limits respect robots.txt |
| False 404 (temporary server error on source) | Only mark `unsold` on 404/410 specifically; 5xx errors are skipped and retried |
| GitHub Actions quota consumed | ~60 min/day is well within the free tier (2,000 min/month) |
| Listings marked unsold that come back | Collectors will re-discover and re-activate them on next run (upsert sets `status='active'`) |

---

## Success Criteria

1. **Zero active listings with `last_verified_at` > 10 days old** (steady state after ramp-up)
2. **Dead URLs detected within 24h** of removal from source (for listings in daily batch)
3. **No `'delisted'` status** anywhere in the database
4. **No `__dead_url__` sentinel** in any listing's images array
5. **Liveness checker appears green** in the monitoring dashboard
