# Listing Freshness: Activate BaT Porsche Active Refresh

## Problem

311 BAT Porsche listings were stuck with `status: active` despite their auctions having ended weeks ago. The Porsche cron route stubs out the refresh step with a hardcoded zero result:

```typescript
// Step 2: Refresh skipped on Vercel cron — GitHub Actions handles full refresh
const refreshResult = { checked: 0, updated: 0, errors: [] as string[] };
```

Meanwhile, `refreshActiveListings()` already exists in `src/features/porsche_collector/supabase_writer.ts` (lines 207-285) — it just isn't called.

## Goals

1. Activate the existing `refreshActiveListings()` in the Porsche cron route
2. Scope the refresh query to BaT Porsche listings only (currently queries all makes/sources)
3. Add rate limiting to the refresh loop (currently missing)
4. Keep the `end_time`-based cleanup cron as a universal safety net

## Non-Goals

- Changing Classic.com or AutoScout24 refresh thresholds (7/14 days is acceptable for classifieds)
- Adding GitHub Actions workflows (Vercel cron only)
- Refreshing live bid data (prices, images) on active listings
- Changing `maxEndedPagesPerSource` from 0 (refresh handles status detection)

## Design

### Pipeline Change

The Porsche cron route changes from:

```
[Refresh STUBBED] -> Discover active listings -> Write to DB
```

To:

```
Refresh existing active listings -> Discover new active listings -> Write to DB
```

### Refresh Query Scoping

The existing `refreshActiveListings()` queries ALL active listings across all makes and sources:

```typescript
let query = client.from("listings").select("...").eq("status", "active");
```

This will be scoped to BaT Porsche only:

```typescript
let query = client.from("listings").select("...")
  .eq("status", "active")
  .ilike("make", "porsche")
  .eq("source", "BaT");
```

This reduces the refresh set from potentially thousands to ~50-70 listings.

### Rate Limiting

The current refresh loop has no delay between HTTP requests, risking IP blocks from BaT. Add a 1.5-2s random delay between requests (matching the main scraper's rate limiting pattern).

### Budget & Limits

- Vercel cron: 300s max, collector uses 270s budget
- Refresh budget: pass `maxListings: 30` to cap at ~60s (2s per request)
- Time-budget guard: if refresh exceeds 60s, break and continue to discovery
- Subtract actual refresh duration from the collector's time budget

### Status Detection

The refresh uses `fetchAuctionData()` from `src/lib/scraper.ts`, which:
1. Fetches the listing URL HTML
2. Detects the platform via URL pattern
3. Parses status from the page
4. Returns structured auction data

The result feeds into `mapAuctionStatus()` from `src/features/porsche_collector/normalize.ts`, which maps to `sold`, `unsold`, or `delisted`.

For HTTP 404/410 responses, the listing is marked `delisted`.

### Safety Nets (Already Implemented)

Three layers of defense from the bug fix:

1. **Cleanup cron** (`/api/cron/cleanup`): Marks any listing with `end_time < now` as `sold`/`unsold`. Daily at 06:00 UTC.
2. **Query-level filter** (`supabaseLiveListings.ts`): Excludes listings where `end_time < now` from active queries.
3. **`mapStatus()` default**: Returns `"ENDED"` for unknown status values.

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/cron/porsche/route.ts` | Replace stubbed refresh with actual `refreshActiveListings()` call; pass time budget; include metrics |
| `src/features/porsche_collector/supabase_writer.ts` | Add `make`/`source` filter to refresh query; add rate-limiting delay; add `maxListings` parameter |

No changes needed to `src/lib/scrapers/bringATrailer.ts` — the refresh uses `fetchAuctionData` from `src/lib/scraper.ts`.

## Files Already Modified (Bug Fix)

| File | Change |
|------|--------|
| `src/lib/supabaseLiveListings.ts` | `mapStatus()` default to ENDED; `end_time` filter in queries |
| `src/app/api/cron/cleanup/route.ts` | Stale auction detection (`end_time < now`) |

## Testing

1. Run the refresh function locally against Supabase to verify it correctly detects ended BaT auctions
2. Verify the Porsche cron completes within the 300s Vercel limit (refresh + discovery)
3. Check that truly live auctions are NOT incorrectly marked as ended
4. Monitor `scraper_runs` table for `refresh_checked`/`refresh_updated` counts over a few days
