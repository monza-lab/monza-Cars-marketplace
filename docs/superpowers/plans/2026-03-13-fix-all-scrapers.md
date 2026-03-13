# Fix All Scrapers Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 critical scraper issues: AutoScout24 duplicate key errors, missing `scraper_active_runs` table, and 3 dead scrapers (porsche/autotrader/classic).

**Architecture:** Each fix is independent. Problem 1 is a DB constraint conflict in the upsert logic. Problem 2 is a missing SQL migration. Problem 3 requires per-scraper diagnosis and targeted fixes (IP blocking, stale GraphQL, normalization failures).

**Tech Stack:** Supabase (PostgreSQL), TypeScript, Playwright, Cheerio, Next.js API routes

---

## Chunk 1: AutoScout24 Upsert Fix + Missing Migration

### Task 1: Fix AutoScout24 duplicate key constraint conflict

**Context:** The `listings` table has TWO unique constraints:
- `listings_source_source_id_unique` on `(source, source_id)` — used by onConflict
- `listings_source_url_unique` on `(source_url)` — causes INSERT failures

When a listing's URL slug changes (seller edits title), the `source_id` changes but `source_url` may already exist under the old `source_id`. The upsert can't find the old `(source, source_id)`, tries INSERT, and fails on `source_url`.

**Fix strategy:** Before upserting, check if a row with the same `source_url` already exists but with a different `source_id`. If so, update the existing row's `source_id` to the new value, then proceed with the normal upsert.

**Files:**
- Modify: `src/features/autoscout24_collector/supabase_writer.ts:37-60`

- [ ] **Step 1: Add source_url conflict resolution to upsertListing**

In `src/features/autoscout24_collector/supabase_writer.ts`, replace the `upsertListing` function (lines 37-60) with:

```typescript
async function upsertListing(client: SupabaseClient, listing: NormalizedListing, meta: ScrapeMeta): Promise<string> {
  const row = mapNormalizedListingToListingsRow(listing, meta);

  // Handle source_url conflict: if a row exists with the same source_url but
  // a different source_id (e.g. AS24 changed the URL slug), update its
  // source_id first so the onConflict upsert can match it.
  const { data: existing } = await client
    .from("listings")
    .select("id, source_id")
    .eq("source_url", listing.sourceUrl)
    .limit(1);

  if (existing?.[0] && existing[0].source_id !== listing.sourceId) {
    await client
      .from("listings")
      .update({ source_id: listing.sourceId })
      .eq("id", existing[0].id);
  }

  const { data, error } = await client
    .from("listings")
    .upsert(row, { onConflict: "source,source_id" })
    .select("id")
    .limit(1);

  if (error) throw new Error(`Supabase listings upsert failed: ${error.message}`);
  const id = (data as Array<{ id: string }> | null)?.[0]?.id;
  if (id) return id;

  // Fallback: select the row we just upserted
  const sel = await client
    .from("listings")
    .select("id")
    .eq("source", listing.source)
    .eq("source_id", listing.sourceId)
    .limit(1);
  if (sel.error) throw new Error(`Supabase listings select failed: ${sel.error.message}`);
  const fallback = (sel.data as Array<{ id: string }> | null)?.[0]?.id;
  if (!fallback) throw new Error("Supabase listings upsert returned no id");
  return fallback;
}
```

- [ ] **Step 2: Verify the change compiles**

Run: `npx tsc --noEmit src/features/autoscout24_collector/supabase_writer.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/autoscout24_collector/supabase_writer.ts
git commit -m "fix(autoscout24): resolve source_url conflict before upsert"
```

---

### Task 2: Create missing `scraper_active_runs` table in Supabase

**Context:** The migration file `supabase/migrations/20260304_scraper_active_runs.sql` exists locally but was never applied to the production Supabase database. The `markScraperRunStarted()` and `clearScraperRunActive()` functions fail silently because the table doesn't exist.

**Files:**
- Reference: `supabase/migrations/20260304_scraper_active_runs.sql`

- [ ] **Step 1: Run the migration SQL against the production database**

Execute this SQL via the Supabase Dashboard SQL Editor or via direct PG connection:

```sql
CREATE TABLE IF NOT EXISTS scraper_active_runs (
  scraper_name TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  runtime TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraper_active_runs_updated_at
  ON scraper_active_runs (updated_at DESC);

ALTER TABLE scraper_active_runs ENABLE ROW LEVEL SECURITY;

-- Drop policies first to make idempotent
DROP POLICY IF EXISTS "Public read active runs" ON scraper_active_runs;
DROP POLICY IF EXISTS "Service role write active runs" ON scraper_active_runs;

CREATE POLICY "Public read active runs" ON scraper_active_runs
  FOR SELECT USING (true);

CREATE POLICY "Service role write active runs" ON scraper_active_runs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

- [ ] **Step 2: Verify the table exists**

Run via PG or Supabase client:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'scraper_active_runs';
```
Expected: 1 row returned

- [ ] **Step 3: Test write + read cycle**

```typescript
// Verify markScraperRunStarted works
await markScraperRunStarted({
  scraperName: "test",
  runId: "test-123",
  startedAt: new Date().toISOString(),
  runtime: "cli",
});
// Verify clearScraperRunActive works
await clearScraperRunActive("test");
```

---

## Chunk 2: Fix Dead Scrapers

### Task 3: Fix Porsche (BaT) scraper — datacenter IP blocking

**Context:** BaT returns HTTP 200 but with a block/challenge page instead of auction data. The embedded JSON marker `auctionsCurrentInitialData` is not found in the HTML, so the scraper returns 0 auctions. The cron route already receives proxy credentials (`DECODO_PROXY_*`) but the porsche collector doesn't pass them to the BaT scraper.

The porsche collector uses `runCollector()` from `src/features/porsche_collector/collector.ts` which calls `scrapeActiveListings()` which calls `scrapeBringATrailer()` from `src/lib/scrapers/bringATrailer.ts`. The BaT scraper uses HTTP fetch (not Playwright) and does NOT use proxies.

**Files:**
- Modify: `src/lib/scrapers/bringATrailer.ts` — add proxy support to HTTP fetches
- Modify: `src/features/porsche_collector/collector.ts` — pass proxy config down
- Modify: `src/app/api/cron/porsche/route.ts` — pass proxy env vars to collector

- [ ] **Step 1: Read the BaT scraper's fetch mechanism**

Read `src/lib/scrapers/bringATrailer.ts` to find the HTTP fetch function and understand how to add proxy headers. Look for `fetchPage`, `fetch`, or `axios` calls.

- [ ] **Step 2: Add proxy support to BaT scraper**

The BaT scraper uses plain `fetch()`. Add optional proxy support via the `DECODO_PROXY_*` env vars. If running on Vercel, use the proxy URL as an HTTP agent.

Option A (simplest): Pass proxy URL as `https_proxy` env var and use `node-fetch` with agent.
Option B: Add a `proxyFetch` wrapper that routes through the Decodo proxy.

Since the cron route already has `DECODO_PROXY_URL`, `DECODO_PROXY_USER`, `DECODO_PROXY_PASS` as env vars, the BaT scraper can read them directly.

Add to the fetch call in `bringATrailer.ts`:
```typescript
// At the top of the file
import { HttpsProxyAgent } from 'https-proxy-agent';

function getProxyAgent(): HttpsProxyAgent | undefined {
  const proxyUrl = process.env.DECODO_PROXY_URL;
  const user = process.env.DECODO_PROXY_USER;
  const pass = process.env.DECODO_PROXY_PASS;
  if (!proxyUrl) return undefined;

  try {
    const url = new URL(proxyUrl);
    if (user) url.username = user;
    if (pass) url.password = pass;
    return new HttpsProxyAgent(url.toString());
  } catch {
    return undefined;
  }
}

// Then in the fetch call, add the agent option:
const agent = getProxyAgent();
const response = await fetch(url, {
  headers: { ... },
  ...(agent ? { agent } : {}),
});
```

NOTE: Check if `https-proxy-agent` is already a dependency. If not, install it:
```bash
npm install https-proxy-agent
```

- [ ] **Step 3: Add diagnostic logging for BaT responses**

In the BaT scraper, after fetching the page, add logging to show:
- HTML length
- Whether the `auctionsCurrentInitialData` marker was found
- Page title (to detect block pages)

This will help debug future blocking issues.

- [ ] **Step 4: Verify the fetch with proxy works locally**

Test manually:
```bash
npx tsx -e "
  const { scrapeBringATrailer } = require('./src/lib/scrapers/bringATrailer');
  scrapeBringATrailer({ maxPages: 1 }).then(r => console.log('Found:', r.length, 'auctions'));
"
```
Expected: Non-zero number of auctions

- [ ] **Step 5: Commit**

```bash
git add src/lib/scrapers/bringATrailer.ts
git commit -m "fix(porsche): add proxy support to BaT scraper for datacenter IP bypass"
```

---

### Task 4: Fix AutoTrader scraper — stale GraphQL query

**Context:** AutoTrader uses a GraphQL gateway API at `https://www.autotrader.co.uk/at-gateway`. The scraper sends a hardcoded `x-sauron-app-version: 6c9dff0561` header and a specific query structure. AutoTrader likely updated their frontend, causing the query to return empty results. The scraper returns 0 discovered every day.

**Files:**
- Modify: `src/features/autotrader_collector/discover.ts` — update GraphQL headers/query
- Reference: `src/features/autotrader_collector/collector.ts`

- [ ] **Step 1: Verify AutoTrader gateway is still accessible**

Use a browser or curl to check if the endpoint responds:
```bash
curl -X POST 'https://www.autotrader.co.uk/at-gateway?opname=SearchResultsListingsGridQuery' \
  -H 'Content-Type: application/json' \
  -H 'x-sauron-app-name: sauron-search-results-app' \
  -H 'x-sauron-app-version: 6c9dff0561' \
  -d '{"operationName":"SearchResultsListingsGridQuery","variables":{"filters":[{"filter":"make","selected":["Porsche"]}],"channel":"cars","page":1,"sortBy":"relevance","searchId":"test","featureFlags":[]},"query":"..."}' \
  -o /tmp/at-response.json
```

Check the response shape. If it returns errors or empty, we need to:
1. Visit autotrader.co.uk in a browser
2. Open DevTools → Network
3. Search for Porsche
4. Find the actual GraphQL request and copy the updated query + headers

- [ ] **Step 2: Update the GraphQL headers and query**

Update `src/features/autotrader_collector/discover.ts`:
- Update `x-sauron-app-version` to the current value from AutoTrader's frontend
- Update the GraphQL query string if the schema changed
- Update the response parsing if the shape changed

- [ ] **Step 3: Add response logging for debugging**

In `fetchAutoTraderGatewayPage()`, log the response status and first 500 chars of the body when 0 listings are returned. This helps detect future API changes.

- [ ] **Step 4: Test locally**

```bash
npx tsx -e "
  const { scrapeActiveListings } = require('./src/features/autotrader_collector/discover');
  scrapeActiveListings({ maxPages: 1 }).then(r => console.log('Found:', r.length));
"
```

- [ ] **Step 5: Commit**

```bash
git add src/features/autotrader_collector/discover.ts
git commit -m "fix(autotrader): update GraphQL gateway query and headers"
```

---

### Task 5: Fix Classic.com scraper — normalization returns null for all listings

**Context:** Classic.com discovers 24 listings but writes 0. The cron route uses `summaryOnly: true` (line 53 of route.ts), which means it calls `normalizeListingFromSummary()` instead of fetching detail pages. This function returns `null` for all 24 listings, likely because required fields (year, model) are missing from the summary data.

**Files:**
- Modify: `src/features/classic_collector/normalize.ts` — add logging and relax validation
- Modify: `src/features/classic_collector/collector.ts` — log normalization failures
- Reference: `src/features/classic_collector/discover.ts`

- [ ] **Step 1: Read normalizeListingFromSummary() and discover types**

Read `src/features/classic_collector/normalize.ts` to find:
- Which fields are required (cause null return)
- What the `ListingSummary` type looks like
- What data classic.com discovery actually provides

Read `src/features/classic_collector/types.ts` for the `ListingSummary` interface.

- [ ] **Step 2: Add logging for normalization failures**

In `normalizeListingFromSummary()`, before each `return null`, add a console.warn:

```typescript
if (!title) {
  console.warn(`[classic:normalize] Skipped: no title | url=${summary.sourceUrl}`);
  return null;
}
if (!year || year < 1900) {
  console.warn(`[classic:normalize] Skipped: bad year=${year} | title="${title}" url=${summary.sourceUrl}`);
  return null;
}
if (!model) {
  console.warn(`[classic:normalize] Skipped: no model | title="${title}" url=${summary.sourceUrl}`);
  return null;
}
```

- [ ] **Step 3: Add year/model extraction from title as fallback**

If `summary.year` is missing, try extracting from `summary.title` using regex:
```typescript
const yearFromTitle = title.match(/\b(19[4-9]\d|20[0-2]\d)\b/)?.[1];
const year = summary.year || (yearFromTitle ? parseInt(yearFromTitle, 10) : 0);
```

If `summary.model` is missing, try extracting from title after the make:
```typescript
const modelFromTitle = title.replace(/^\d{4}\s+/, '').replace(/^porsche\s+/i, '').split(/\s+/).slice(0, 3).join(' ');
const model = summary.model || modelFromTitle || null;
```

- [ ] **Step 4: Log normalization stats in collector**

In `src/features/classic_collector/collector.ts`, in the `summaryOnly` loop, add:
```typescript
if (!normalized) {
  counts.errors++;
  errors.push(`Normalize failed: ${summary.title ?? summary.sourceUrl}`);
}
```

- [ ] **Step 5: Test locally with a dry run**

```bash
npx tsx src/features/classic_collector/cli.ts \
  --make=Porsche --location=US --status=forsale \
  --maxPages=1 --maxListings=5 --summaryOnly --dryRun
```
Expected: See normalization warnings and check if any now pass

- [ ] **Step 6: Commit**

```bash
git add src/features/classic_collector/normalize.ts src/features/classic_collector/collector.ts
git commit -m "fix(classic): add year/model extraction fallbacks and normalization logging"
```

---

## Chunk 3: GitHub Actions Workflow Fix

### Task 6: Fix GitHub Actions `npm ci` failure

**Context:** Both collector workflows (`autoscout24-collector.yml` and `classic-collector.yml`) fail at `npm ci` with `EUSAGE` error. The `cache: 'npm'` option in `actions/setup-node@v4` was already removed in a previous session. Verify the fix is in place and push.

**Files:**
- Verify: `.github/workflows/autoscout24-collector.yml`
- Verify: `.github/workflows/classic-collector.yml`

- [ ] **Step 1: Verify workflow files have the fix**

Check that both files:
1. Do NOT have `cache: 'npm'` in setup-node
2. DO have the "Verify environment" step

- [ ] **Step 2: Commit if not already committed**

```bash
git add .github/workflows/autoscout24-collector.yml .github/workflows/classic-collector.yml
git commit -m "fix(ci): remove npm cache option and add env verification step"
```

---

## Summary of All Changes

| Task | File | Change |
|------|------|--------|
| 1 | `supabase_writer.ts` | Pre-check source_url before upsert |
| 2 | Supabase DB (SQL) | Create `scraper_active_runs` table |
| 3 | `bringATrailer.ts` | Add proxy support for BaT HTTP fetches |
| 4 | `autotrader/discover.ts` | Update GraphQL query + headers |
| 5 | `classic/normalize.ts` | Add year/model fallbacks + logging |
| 6 | `.github/workflows/*.yml` | Remove `cache: 'npm'` |
