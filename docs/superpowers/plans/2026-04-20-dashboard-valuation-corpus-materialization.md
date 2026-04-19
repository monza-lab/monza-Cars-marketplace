# Dashboard follow-up: materialize valuation corpus aggregation

## Why this is the next suggestion

The current dashboard cache fixes the missing-family problem and reduces some request-time pressure, but one expensive path still remains:

- `src/lib/dashboardCache.ts` still calls `fetchValuationCorpusForMake(..., 40_000)` on the request path.
- `src/lib/supabaseLiveListings.ts` still pages through the full priced listings corpus to derive `regionalValByFamily`.

That means the dashboard can still spend a long time scanning the raw valuation corpus before it can render family-level valuation data. The cache now fails faster and falls back more safely, but the underlying computation is still too heavy to be request-time work.

## Problem statement

We need the dashboard to:

- show all families for each market
- keep the database responsive
- load fast on repeat visits
- avoid expensive per-request corpus scans

Right now, `regionalValByFamily` is computed from the raw listings corpus on demand. That is the main remaining bottleneck.

## Proposed direction

Move `regionalValByFamily` to a precomputed data path instead of deriving it from the full listings table at request time.

### Preferred option

Create a materialized or pre-aggregated source for:

- family
- make
- market / region
- valuation stats needed by the dashboard

Then have `dashboardCache` read that smaller aggregated source instead of scanning the full corpus.

### Secondary option

If a materialized view is not practical, introduce a dedicated cached table refreshed by a background job or scheduled task.

## What should be preserved

- The sidebar must still show every family, even when there are no cars in the current sample.
- Market-scoped counts must remain accurate.
- The dashboard should continue to degrade gracefully if the precomputed source is stale or temporarily unavailable.

## Suggested implementation scope

### Files

- `src/lib/dashboardCache.ts`
- `src/lib/supabaseLiveListings.ts`
- one new schema/query module if the aggregation source needs a clean boundary
- tests adjacent to the updated code

### Dependency budget

- `0` new dependencies preferred
- use existing Supabase and Next.js primitives first

### Expected LOC

- keep each file under roughly `1000` LOC
- split only if the aggregation logic becomes too large for one coherent slice

## Acceptance criteria

- The dashboard no longer scans the full valuation corpus on every request.
- Family lists remain complete for all markets.
- Request times drop materially on cold and warm loads.
- The DB no longer shows long-running valuation corpus work from dashboard traffic.
- There is a fallback path if the precomputed source is unavailable.

## Open questions

- Should the aggregation be stored per make only, or per make plus region?
- Do we need historical valuation snapshots, or only the current live state?
- Is the refresh cadence acceptable as periodic, or does it need to be event-driven?

## Recommended discussion order

1. Confirm the aggregation granularity.
2. Decide whether to use a materialized view or cached table.
3. Define the refresh strategy.
4. Wire the dashboard cache to the new source.
5. Add regression tests around family completeness and dashboard latency.
