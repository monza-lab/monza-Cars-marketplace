# Scraper Critical Fixes — May 7, 2026

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 10 scraper failures from the May 7 run — dev server crashes causing 6 instant "fetch failed" failures, false-positive failure on time-budget enrichments, and BeForward enrichment crash.

**Architecture:** Three-pronged fix: (1) add server health-check + retry in the runner before each cron route call, (2) stop treating time-budget exhaustion as an error in both cron routes and the runner, (3) harden BeForward enrichment error handling.

**Tech Stack:** TypeScript, Next.js API routes, Supabase, node:child_process

---

## Diagnosis Summary

| # | Issue | Scrapers Affected | Root Cause | Severity |
|---|-------|-------------------|------------|----------|
| 1 | **Dev server crash → "fetch failed"** | Validator, Cleanup, VIN, Titles, Images (all 1-5ms) + Elferspot Enrich (66s) | Server becomes unresponsive after ~2h of heavy scraping. Single health check at startup; no retry. | P0 |
| 2 | **Time budget = false failure** | AutoTrader Enrich (984/994 enriched, marked FAILED) | Route returns HTTP 500 when budget expires. Runner sees `status >= 400` → "failed" | P1 |
| 3 | **BeForward Enrich 500 w/ null body** | BeForward Enrich (13s, exitCode 500, empty body) | Likely Cloudflare 403 → circuit breaker → outer catch → 500 with non-parseable body | P1 |
| 4 | **AS24 shard saturation** | panamera, taycan, boxster, cayman, catchall | 20-page limit reached; capturing only 15-40% of listings | P2 |
| 5 | **BeForward collector zero writes** | beforward discovery | All 3 recent runs wrote 0 records | P2 |

---

## Chunk 1: Runner Resilience (Tasks 1-2)

### Task 1: Add server health-check + retry before each cron route call

**Files:**
- Modify: `scripts/run-scrapers.ts` (lines 581-654, `runCronScraper` function)

The current `runCronScraper` does a single `fetch()` with no retry and no pre-call health check. If the dev server has crashed (e.g., Next.js OOM), every subsequent cron route fails instantly with "fetch failed" (ECONNREFUSED).

- [ ] **Step 1: Add `probeServer()` helper above `runCronScraper`**

```typescript
/**
 * Quick TCP probe — returns true if dev server responds, false otherwise.
 * Used before each cron route call to detect crashed server early.
 */
async function probeServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${DEV_SERVER}/api/health`, {
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(t);
    return res.ok || res.status === 307 || res.status === 308 || res.status === 404;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Add retry wrapper with health check inside `runCronScraper`**

Replace the single `fetch()` call in `runCronScraper` (lines 605-638) with a retry loop:

```typescript
// Inside runCronScraper, replace the try block:
try {
  const MAX_RETRIES = 2;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Health check before each attempt
    const serverUp = await probeServer();
    if (!serverUp) {
      console.error(`  ⚠ Dev server not responding (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
      if (attempt < MAX_RETRIES) {
        console.log(`  Waiting 10s before retry...`);
        await new Promise((r) => setTimeout(r, 10_000));
        continue;
      }
      return {
        id: scraper.id, name: scraper.name, phase: scraper.phase, type: scraper.type,
        status: "failed", durationMs: Date.now() - start,
        stdout: "", stderr: "Dev server not responding after retries",
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), scraper.timeoutMs);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${cronSecret}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const body = await res.json().catch(() => null);
      if (body) console.log(JSON.stringify(body, null, 2));

      const failed = res.status >= 400 || (body && (body as Record<string, unknown>).error);

      return {
        id: scraper.id, name: scraper.name, phase: scraper.phase, type: scraper.type,
        status: failed ? "failed" : "ok",
        durationMs: Date.now() - start,
        exitCode: res.status,
        stdout: body ? JSON.stringify(body, null, 2) : "",
        stderr: "",
        cronResponse: body,
      };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const isTimeout = err instanceof DOMException && err.name === "AbortError";

      if (isTimeout) {
        return {
          id: scraper.id, name: scraper.name, phase: scraper.phase, type: scraper.type,
          status: "timeout", durationMs: Date.now() - start,
          stdout: "", stderr: lastErr.message,
        };
      }

      // Connection error — retry
      console.error(`  Fetch failed (attempt ${attempt + 1}): ${lastErr.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  }

  return {
    id: scraper.id, name: scraper.name, phase: scraper.phase, type: scraper.type,
    status: "failed", durationMs: Date.now() - start,
    stdout: "", stderr: lastErr?.message ?? "fetch failed",
  };
} catch (err) {
  // ... keep existing outer catch
}
```

- [ ] **Step 3: Test by running with dev server up**

```bash
npx tsx scripts/run-scrapers.ts --full --dry-run
```

Expected: cron routes should succeed or show "Dev server not responding" with retries if server is down.

- [ ] **Step 4: Commit**

```bash
git add scripts/run-scrapers.ts
git commit -m "fix(runner): add health-check + retry before each cron route call"
```

---

### Task 2: Stop treating time-budget exhaustion as an error

**The problem chain:**
1. `enrich-autotrader/route.ts` line 93: pushes "Time budget reached..." to `errors[]`
2. Line 207: `success = errors.length === 0` → false
3. Line 242: `{ status: success ? 200 : 500 }` → HTTP 500
4. `run-scrapers.ts` line 624: `res.status >= 400` → marks as "failed"

Same pattern in `enrich-beforward/route.ts` (line 84, 159, 211) and `enrich-elferspot/route.ts`.

**Files:**
- Modify: `src/app/api/cron/enrich-autotrader/route.ts` (lines 92-95, 207, 242)
- Modify: `src/app/api/cron/enrich-beforward/route.ts` (lines 83-86, 159, 211)
- Modify: `src/app/api/cron/enrich-elferspot/route.ts` (equivalent lines)

#### 2a: Fix enrich-autotrader

- [ ] **Step 1: Separate time-budget from real errors**

In `src/app/api/cron/enrich-autotrader/route.ts`, change the time-budget message from an error to a warning. Replace lines 92-95:

```typescript
// BEFORE (line 92-95):
if (Date.now() - startTime > TIME_BUDGET_MS) {
  errors.push(`Time budget reached after ${enriched} enrichments`);
  break;
}

// AFTER:
let timeBudgetReached = false;
// ... (add this variable declaration before the while loop, around line 58)

// Then at line 92-95:
if (Date.now() - startTime > TIME_BUDGET_MS) {
  timeBudgetReached = true;
  break;
}
```

- [ ] **Step 2: Update success logic**

Replace line 207:
```typescript
// BEFORE:
const success = errors.length === 0 && !noWrittenRows;

// AFTER:
const success = errors.length === 0 && !noWrittenRows;
```

And line 242:
```typescript
// BEFORE:
{ status: success ? 200 : 500 }

// AFTER — time budget with progress is NOT a 500:
{ status: success || timeBudgetReached ? 200 : 500 }
```

Add `timeBudgetReached` to the response body:
```typescript
return NextResponse.json(
  {
    success: success || timeBudgetReached,
    runId,
    discovered,
    enriched,
    demoted,
    written,
    errors,
    timeBudgetReached,
    successReason: timeBudgetReached ? "time_budget_reached" : successReason,
    duration: `${Date.now() - startTime}ms`,
  },
  { status: success || timeBudgetReached ? 200 : 500 }
);
```

- [ ] **Step 3: Commit autotrader fix**

```bash
git add src/app/api/cron/enrich-autotrader/route.ts
git commit -m "fix(enrich-autotrader): treat time-budget exhaustion as success, not error"
```

#### 2b: Fix enrich-beforward

- [ ] **Step 4: Apply same pattern to enrich-beforward**

In `src/app/api/cron/enrich-beforward/route.ts`:

Add `let timeBudgetReached = false;` before the loop (around line 76).

Replace lines 83-86:
```typescript
if (Date.now() - startTime > TIME_BUDGET_MS) {
  timeBudgetReached = true;
  break;
}
```

Replace line 159:
```typescript
const success = errors.length === 0 || timeBudgetReached;
```

Replace lines 177-185 (return statement):
```typescript
return NextResponse.json({
  success: success || timeBudgetReached,
  runId,
  discovered,
  enriched,
  errors,
  timeBudgetReached,
  successReason: timeBudgetReached
    ? "time_budget_reached"
    : success
      ? "all_rows_enriched"
      : "errors_present",
  duration: `${Date.now() - startTime}ms`,
});
```

Note: Remove the `{ status: 500 }` on the catch block's response only for time-budget — keep 500 for actual crashes.

- [ ] **Step 5: Commit beforward fix**

```bash
git add src/app/api/cron/enrich-beforward/route.ts
git commit -m "fix(enrich-beforward): treat time-budget exhaustion as success"
```

#### 2c: Fix enrich-elferspot

- [ ] **Step 6: Apply same pattern to enrich-elferspot**

Same changes as above. Find the time-budget check and success logic, apply the same `timeBudgetReached` pattern.

- [ ] **Step 7: Commit elferspot fix**

```bash
git add src/app/api/cron/enrich-elferspot/route.ts
git commit -m "fix(enrich-elferspot): treat time-budget exhaustion as success"
```

---

## Chunk 2: Runner Success Detection Fix (Task 3)

### Task 3: Fix runner's cron success detection

**Files:**
- Modify: `scripts/run-scrapers.ts` (line 624-625)

The runner currently treats ANY response with `body.error` as failed:
```typescript
const failed = res.status >= 400 || (body && (body as Record<string, unknown>).error);
```

This catches legitimate `error` fields in error responses, but should also respect `body.success === true`.

- [ ] **Step 1: Update the success detection logic**

Replace line 624-625:
```typescript
// BEFORE:
const failed = res.status >= 400 || (body && (body as Record<string, unknown>).error);

// AFTER — trust body.success when present:
const bodyObj = body as Record<string, unknown> | null;
const failed =
  res.status >= 400 && !(bodyObj?.success === true);
```

This means: if the HTTP status is >= 400 BUT the body says `success: true`, treat it as OK. This handles the edge case where routes might return weird status codes but the body confirms success.

- [ ] **Step 2: Commit**

```bash
git add scripts/run-scrapers.ts
git commit -m "fix(runner): trust body.success over HTTP status for cron success detection"
```

---

## Chunk 3: BeForward Enrichment Crash Hardening (Task 4)

### Task 4: Harden BeForward enrichment error handling

**Files:**
- Modify: `src/app/api/cron/enrich-beforward/route.ts` (lines 92-156, error handling)

The BeForward enrichment returned HTTP 500 with no parseable body after 13 seconds. This suggests an unhandled exception (possibly in `parseDetailHtml()` or the fetch itself) that crashes the route handler before it can return a proper JSON response.

- [ ] **Step 1: Add per-listing error boundary with better logging**

In the per-row `catch` block (lines 147-156), add more defensive error handling:

```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);

  if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
    errors.push(`Circuit-break: ${msg}`);
    break;
  }

  // Handle fetch-level failures (network, DNS, etc)
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
    errors.push(`Network error for ${row.source_url}: ${msg}`);
    continue;
  }

  errors.push(`Failed ${row.source_url}: ${msg}`);
}
```

- [ ] **Step 2: Add safety wrapper around `parseDetailHtml`**

The HTML parser might throw on unexpected content. Wrap the call:

```typescript
let detail;
try {
  detail = parseDetailHtml(html);
} catch (parseErr) {
  errors.push(`Parse error (${row.id}): ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
  // Mark as attempted to avoid re-processing
  await client
    .from("listings")
    .update({ trim: "", updated_at: new Date().toISOString() })
    .eq("id", row.id);
  continue;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/enrich-beforward/route.ts
git commit -m "fix(enrich-beforward): harden error handling for network and parse failures"
```

---

## Chunk 4: AS24 Shard Saturation (Task 5)

### Task 5: Add price-range sub-shards for saturated AS24 models

**Files:**
- Modify: `src/features/scrapers/autoscout24_collector/collector.ts` (shard definitions)

Five shards are hitting the 20-page limit and missing 60-85% of available listings:
- `panamera-all`: 370 of 2,507 (15%)
- `taycan-all`: 345 of 1,900 (18%)
- `boxster-all`: 319 of 1,589 (20%)
- `cayman-all`: 334 of 878 (38%)
- `porsche-all-catchall`: 266 of 31,615 (<1%)

- [ ] **Step 1: Read the current shard definitions**

Read the collector file to find where shards are defined. Look for the array of shard objects.

- [ ] **Step 2: Split saturated model shards into price ranges**

For each saturated shard, replace the single shard with 2-3 price-range sub-shards. Example for panamera:

```typescript
// BEFORE:
{ id: "panamera-all", model: "panamera", priceFrom: undefined, priceTo: undefined }

// AFTER:
{ id: "panamera-low", model: "panamera", priceFrom: undefined, priceTo: 50000 },
{ id: "panamera-mid", model: "panamera", priceFrom: 50001, priceTo: 120000 },
{ id: "panamera-high", model: "panamera", priceFrom: 120001, priceTo: undefined },
```

Apply similar splits for taycan, boxster, cayman. The catchall shard can stay as-is (it's for edge-case models not covered by other shards).

- [ ] **Step 3: Verify URL generation includes price params**

Check that the URL builder appends `pricefrom` and `priceto` query params when defined.

- [ ] **Step 4: Test locally**

```bash
npx tsx src/features/scrapers/autoscout24_collector/cli.ts --maxListings=100 --dryRun
```

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/autoscout24_collector/collector.ts
git commit -m "fix(as24): split saturated shards into price-range sub-shards"
```

---

## Chunk 5: BeForward Collector Zero-Write Investigation (Task 6)

### Task 6: Investigate and fix BeForward collector writing 0 records

**Files:**
- Read: `src/features/scrapers/beforward_porsche_collector/collector.ts`
- Read: `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- Check Supabase: `listings` table for `source = 'BeForward'` count and last updated

- [ ] **Step 1: Check DB state**

Run SQL to check BeForward listing status:
```sql
SELECT status, count(*) FROM listings WHERE source = 'BeForward' GROUP BY status;
SELECT max(updated_at), max(created_at) FROM listings WHERE source = 'BeForward';
```

- [ ] **Step 2: Run collector with verbose logging**

```bash
npx tsx src/features/scrapers/beforward_porsche_collector/cli.ts --maxPages=2 --verbose
```

Check if:
- Pages return valid HTML
- Listings are being discovered
- Dedup filter is removing all of them
- Normalize returns null for all

- [ ] **Step 3: Diagnose and fix based on findings**

Common causes:
- BeForward site structure changed → parser returns empty
- All discovered listings already exist in DB (dedup removes all)
- `summaryOnly` mode skips detail fetch, normalize needs detail data

- [ ] **Step 4: Commit fix**

```bash
git add src/features/scrapers/beforward_porsche_collector/
git commit -m "fix(beforward): fix zero-write collector issue"
```

---

## Execution Order

1. **Task 1** (runner health check + retry) — highest impact, fixes 6 failures
2. **Task 2** (time-budget not an error) — fixes 3 false failures
3. **Task 3** (runner success detection) — complements Task 2
4. **Task 4** (BeForward enrich hardening) — prevents crash cascades
5. **Task 5** (AS24 shards) — improves data coverage
6. **Task 6** (BeForward zero-write) — investigation needed first
