# Scraper Recovery — All Issues Fix Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore all scrapers, cron jobs, and GitHub Actions to full operational health.

**Architecture:** Fix lockfile → fix individual scrapers → verify each with live tests → confirm GHA runs green.

**Tech Stack:** Node.js, npm, Supabase, Vercel Cron, GitHub Actions, Scrapling (Python)

---

## Issue Summary

| # | Issue | Severity | Root Cause |
|---|-------|----------|------------|
| 1 | All GitHub Actions failing (13 days) | CRITICAL | `package-lock.json` missing `server-only@0.0.1` |
| 2 | AutoTrader discovery broken (7 days) | HIGH | GraphQL gateway returning 0 listings |
| 3 | BeForward discovery stalled (7 days) | MEDIUM | 0 listings discovered/written, possible HTML change |
| 4 | Porsche collector low writes | LOW | Likely normal — needs verification |
| 5 | Elferspot missed 2 runs | LOW | Vercel timeout (291s avg vs 300s limit) |

---

## Chunk 1: Fix package-lock.json (Unblocks ALL GHA Workflows)

### Task 1: Regenerate lockfile

**Files:**
- Modify: `package-lock.json`

- [ ] **Step 1: Verify the issue**

```bash
grep -c "server-only" package-lock.json
# Expected: 0 (confirms it's missing)
```

- [ ] **Step 2: Run npm install to sync lockfile**

```bash
npm install
```

Expected: Resolves `server-only@0.0.1` and updates `package-lock.json`.

- [ ] **Step 3: Verify server-only is now in lockfile**

```bash
grep "server-only" package-lock.json | head -5
# Expected: Shows entry for server-only
```

- [ ] **Step 4: Verify npm ci works (simulates GHA install)**

```bash
npm ci
# Expected: Completes without errors
```

- [ ] **Step 5: Commit**

```bash
git add package-lock.json
git commit -m "fix: sync package-lock.json with package.json (add server-only)"
```

- [ ] **Step 6: Push to trigger GHA workflows**

```bash
git push
```

### Task 2: Verify GitHub Actions recover

- [ ] **Step 1: Wait 2 minutes, then check GHA status**

```bash
gh run list --limit 10 --json name,status,conclusion,startedAt
# Expected: New runs triggered, ideally some in "in_progress" or "completed/success"
```

- [ ] **Step 2: If no auto-trigger, manually dispatch the Liveness Checker**

```bash
gh workflow run liveness-checker.yml
```

- [ ] **Step 3: Wait for completion and verify success**

```bash
gh run list --workflow=liveness-checker.yml --limit 1 --json conclusion
# Expected: [{"conclusion":"success"}]
```

If still failing, check logs:
```bash
gh run view --log-failed $(gh run list --workflow=liveness-checker.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

---

## Chunk 2: Fix AutoTrader Discovery

### Task 3: Diagnose AutoTrader gateway issue

**Files:**
- Modify: `src/features/scrapers/autotrader_collector/discover.ts`

- [ ] **Step 1: Test gateway locally to understand the failure**

```bash
npx tsx -e "
import { fetchAutoTraderGatewayPage, resetCachedAppVersion } from './src/features/scrapers/autotrader_collector/discover';
resetCachedAppVersion();
const result = await fetchAutoTraderGatewayPage({
  page: 1,
  timeoutMs: 15000,
  filters: { make: 'Porsche', postcode: 'SW1A 1AA' }
});
console.log('Results:', result.totalResults, 'Listings:', result.listings.length);
if (result.listings.length > 0) console.log('First:', JSON.stringify(result.listings[0], null, 2));
"
```

This will reveal one of:
- HTTP error (status code) → gateway URL or headers changed
- 0 listings returned → response schema changed
- Works locally → Vercel IP is being blocked

- [ ] **Step 2: If gateway returns error, test version detection**

```bash
npx tsx -e "
import { detectAppVersion, resetCachedAppVersion } from './src/features/scrapers/autotrader_collector/discover';
resetCachedAppVersion();
const version = await detectAppVersion();
console.log('Detected version:', version);
"
```

- [ ] **Step 3: Test raw fetch to AT gateway to inspect response shape**

```bash
npx tsx -e "
const res = await fetch('https://www.autotrader.co.uk/at-gateway?opname=SearchResultsListingsGridQuery', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-sauron-app-name': 'sauron-search-results-app',
    'x-sauron-app-version': 'b0f8e3a29c',
    Origin: 'https://www.autotrader.co.uk',
    Referer: 'https://www.autotrader.co.uk/car-search?postcode=SW1A+1AA&make=Porsche',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  },
  body: JSON.stringify({
    operationName: 'SearchResultsListingsGridQuery',
    query: 'query SearchResultsListingsGridQuery(\$filters:[FilterInput!]!,\$channel:Channel!,\$page:Int,\$sortBy:SearchResultsSort,\$listingType:[ListingType!],\$searchId:String!,\$featureFlags:[FeatureFlag]){searchResults(input:{facets:[],filters:\$filters,channel:\$channel,page:\$page,sortBy:\$sortBy,listingType:\$listingType,searchId:\$searchId,featureFlags:\$featureFlags}){listings{__typename ... on SearchListing{advertId title price vehicleLocation images trackingContext{advertContext{make model year} advertCardFeatures{priceIndicator}}}}page{number results{count}}trackingContext{searchId}}}',
    variables: {
      filters: [
        { filter: 'price_search_type', selected: ['total'] },
        { filter: 'postcode', selected: ['SW1A 1AA'] },
        { filter: 'make', selected: ['Porsche'] },
      ],
      channel: 'cars',
      page: 1,
      sortBy: 'relevance',
      listingType: null,
      searchId: 'test-' + Date.now(),
      featureFlags: [],
    },
  }),
});
console.log('Status:', res.status);
const body = await res.text();
console.log('Body (first 1000):', body.slice(0, 1000));
"
```

- [ ] **Step 4: Apply fix based on diagnosis**

Possible fixes (apply whichever matches diagnosis):

**A) If GraphQL schema changed** — update the query and response types in `discover.ts`
**B) If version detection fails** — update `FALLBACK_APP_VERSION` and detection regex
**C) If Vercel IP blocked** — add geo-header workaround or switch to User-Agent rotation
**D) If 403/429 from gateway** — add retry with exponential backoff or Scrapling fallback

After applying the fix:

- [ ] **Step 5: Run local test again to confirm fix works**

```bash
npx tsx -e "
import { fetchAutoTraderGatewayPage, resetCachedAppVersion } from './src/features/scrapers/autotrader_collector/discover';
resetCachedAppVersion();
const result = await fetchAutoTraderGatewayPage({ page: 1, timeoutMs: 15000, filters: { make: 'Porsche' } });
console.log('Results:', result.totalResults, 'Listings:', result.listings.length);
"
# Expected: totalResults > 0, listings.length > 0
```

- [ ] **Step 6: Run the full cron route locally**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/autotrader
# Expected: JSON with discovered > 0 or written > 0
```

(Requires `npm run dev` running in another terminal.)

- [ ] **Step 7: Commit**

```bash
git add src/features/scrapers/autotrader_collector/
git commit -m "fix(scrapers): fix AutoTrader gateway discovery [describe specific fix]"
```

---

## Chunk 3: Fix BeForward Discovery

### Task 4: Diagnose BeForward stall

**Files:**
- Modify: `src/features/scrapers/beforward_porsche_collector/discover.ts` (if HTML changed)
- Modify: `src/app/api/cron/beforward/route.ts` (fix success reporting)

- [ ] **Step 1: Test BeForward search page fetch locally**

```bash
npx tsx -e "
const res = await fetch('https://www.beforward.jp/stocklist/sortkey=n/keyword=porsche/kmode=and/', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36' },
  signal: AbortSignal.timeout(15000),
});
console.log('Status:', res.status);
const html = await res.text();
console.log('HTML size:', html.length);
console.log('Has stocklist-row:', html.includes('stocklist-row'));
console.log('Has ga_stocklist_results:', html.includes('ga_stocklist_results'));
console.log('First 500 chars:', html.slice(0, 500));
"
```

This reveals if:
- BeForward is geo-blocking (non-JP IPs)
- The HTML structure changed (no `stocklist-row` class)
- The page is returning a CAPTCHA/challenge

- [ ] **Step 2: If HTML structure changed, identify new selectors**

Look for the new pattern for listing rows and extract key selectors:
```bash
npx tsx -e "
import * as cheerio from 'cheerio';
const res = await fetch('https://www.beforward.jp/stocklist/sortkey=n/keyword=porsche/kmode=and/', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36' },
});
const html = await res.text();
const $ = cheerio.load(html);
// Check for listing containers
console.log('tr.stocklist-row:', $('tr.stocklist-row').length);
console.log('.stocklist-row:', $('.stocklist-row').length);
console.log('[class*=stock]:', $('[class*=\"stock\"]').toArray().map(el => el.tagName + '.' + $(el).attr('class')).slice(0, 10));
console.log('Links to /porsche/:', $('a[href^=\"/porsche/\"]').length);
console.log('Total links:', $('a[href]').length);
"
```

- [ ] **Step 3: Apply fix based on diagnosis**

Possible fixes:
**A) If selectors changed** — update `parseListingRows()` in `discover.ts`
**B) If geo-blocked** — add `Accept-Language: ja` header or country-appropriate headers
**C) If CAPTCHA** — switch to Scrapling-based fetcher (like Classic.com/AS24 did)
**D) If the site works but collector config is wrong** — fix URL patterns or filters

- [ ] **Step 4: Run local verification**

```bash
npx tsx src/features/scrapers/beforward_porsche_collector/cli.ts --dryRun --maxPages=2
# Expected: Shows discovered listings > 0
```

- [ ] **Step 5: Fix BeForward cron success reporting**

In `src/app/api/cron/beforward/route.ts`, the `success: true` is hardcoded. Change to reflect actual results:

```typescript
// Change line 72 from:
success: true,
// To:
success: result.counts.discovered > 0 || refreshResult.checked > 0,
```

- [ ] **Step 6: Run cron route locally**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/beforward
# Expected: JSON with discovered > 0
```

- [ ] **Step 7: Commit**

```bash
git add src/features/scrapers/beforward_porsche_collector/ src/app/api/cron/beforward/route.ts
git commit -m "fix(scrapers): fix BeForward discovery [describe specific fix]"
```

---

## Chunk 4: Verify Porsche Collector & Fix Elferspot Timeout

### Task 5: Verify Porsche collector low-write behavior is expected

- [ ] **Step 1: Check if Porsche listings are truly all existing (no new data)**

```bash
npx tsx -e "
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
// Check most recent writes for Porsche auction sources
const { data } = await supabase.from('listings')
  .select('source, source_url, scrape_timestamp')
  .in('source', ['BaT', 'CarsAndBids', 'CollectingCars'])
  .eq('make', 'Porsche')
  .order('scrape_timestamp', { ascending: false })
  .limit(10);
console.log('Latest Porsche auction listings:');
for (const r of data ?? []) console.log(r.source, r.scrape_timestamp, r.source_url?.slice(0, 60));
"
```

If all timestamps are recent (last 24h scrape_timestamp), the collector IS running — it just finds no NEW listings to insert. This is expected for a mature dataset.

- [ ] **Step 2: Confirm by dry-running the collector**

```bash
npx tsx src/features/scrapers/porsche_collector/cli.ts --mode=daily --dryRun --noDetails
# Expected: Shows "discovered: N" (matches ~1100), "new: 0-5" (most already exist)
```

If new = 0, this is normal operation. No fix needed.

### Task 6: Fix Elferspot timeout issue

**Files:**
- Modify: `src/app/api/cron/elferspot/route.ts`

- [ ] **Step 1: Check current Elferspot cron route for timeout risk**

Read the route and identify where time is spent. The avg duration is 291s vs 300s Vercel limit.

- [ ] **Step 2: Reduce scope per cron run**

The fix is to reduce `maxPages` or add a time budget check. Possible approaches:
- Reduce `maxPages` from current value to fit within 250s
- Add early exit when elapsed time > 240s

```typescript
// Add time budget guard in the main loop:
const TIME_BUDGET_MS = 240_000; // 4 minutes (leave 60s margin for cleanup)
const startTime = Date.now();

// In the page loop, add:
if (Date.now() - startTime > TIME_BUDGET_MS) {
  console.log(`[Elferspot] Time budget exceeded after page ${page}, stopping early`);
  break;
}
```

- [ ] **Step 3: Verify locally**

```bash
npx tsx src/features/scrapers/elferspot_collector/cli.ts --dryRun --maxPages=5
# Expected: Completes in <30s, shows listings discovered
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/elferspot/route.ts
git commit -m "fix(scrapers): add time budget to Elferspot cron to prevent Vercel timeout"
```

---

## Chunk 5: End-to-End Verification

### Task 7: Push all fixes and verify GHA workflows

- [ ] **Step 1: Push all committed changes**

```bash
git push
```

- [ ] **Step 2: Manually trigger key GHA workflows to verify**

```bash
gh workflow run classic-collector.yml
gh workflow run autoscout24-collector.yml
gh workflow run bat-detail-scraper.yml
gh workflow run liveness-checker.yml
```

- [ ] **Step 3: Monitor GHA runs (wait ~5 min for quick ones, ~30 min for full)**

```bash
# Check status every few minutes:
gh run list --limit 8 --json name,status,conclusion
```

Expected: All runs show `conclusion: "success"`.

- [ ] **Step 4: If any workflow fails, check logs and fix**

```bash
gh run view <run-id> --log-failed | tail -30
```

### Task 8: Verify Vercel cron recovery via database

- [ ] **Step 1: Wait for next AutoTrader cron (02:00 UTC) or trigger manually**

If testing locally:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/autotrader
```

- [ ] **Step 2: Wait for next BeForward cron (03:00 UTC) or trigger manually**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/beforward
```

- [ ] **Step 3: Check scraper_runs table for new successful entries**

```bash
npx tsx -e "
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data } = await supabase.from('scraper_runs')
  .select('scraper_name, success, discovered, written, finished_at')
  .in('scraper_name', ['autotrader', 'beforward', 'elferspot'])
  .order('finished_at', { ascending: false })
  .limit(6);
console.log('Recent runs for fixed scrapers:');
for (const r of data ?? []) {
  console.log(\`  \${r.scraper_name}: success=\${r.success} disc=\${r.discovered} writ=\${r.written} at=\${r.finished_at}\`);
}
"
```

Expected:
- `autotrader`: success=true, discovered > 0
- `beforward`: success=true, discovered > 0
- `elferspot`: success=true (no timeout)

### Task 9: Run health audit to confirm overall recovery

- [ ] **Step 1: Run the health audit CLI**

```bash
npx tsx scripts/scraper-health-audit.ts --days=1 --strict
```

Expected: No FAILED, STALE, STUCK, or ZERO-WRITE statuses. Exit code 0.

- [ ] **Step 2: Final commit (if any verification-prompted fixes)**

```bash
git add -A
git commit -m "fix(scrapers): final adjustments from live verification"
git push
```

---

## Success Criteria

All of the following must be true:

1. `npm ci` succeeds (lockfile synced)
2. All 8 GHA workflows pass (green)
3. AutoTrader cron discovers > 0 listings
4. BeForward cron discovers > 0 listings
5. Elferspot completes within 240s (no timeout)
6. `scraper-health-audit.ts --strict` exits 0
7. Porsche collector behavior confirmed as expected (or fixed)
