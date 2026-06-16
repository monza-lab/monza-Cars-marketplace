# BeForward Cron Data Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BeForward ingestion converge toward the marketplace inventory instead of only refreshing the first few pages, while making write counts, terminal status, and audit signals honest enough to prove data accuracy.

**Architecture:** Keep the existing BeForward vertical slice and add a small crawl-planning layer inside it. Split cron behavior into fast freshness discovery and bounded full-coverage windows so Vercel's 300s runtime is respected without permanently capping coverage at 75-250 rows. Treat liveness and terminal status as evidence-based state transitions, not as side effects of incomplete crawls.

**Tech Stack:** Next.js App Router cron routes, TypeScript, Vitest, Supabase service-role writes, existing BeForward Scrapling/fetch adapters, existing scraper monitoring tables.

---

## Locality Envelope

**files**
- Modify `src/features/scrapers/beforward_porsche_collector/types.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/collector.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/discover.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/normalize.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/normalize.test.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/discover.test.ts`
- Create `src/features/scrapers/beforward_porsche_collector/collector.test.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts`
- Modify `src/app/api/cron/beforward/route.ts`
- Modify `src/app/api/cron/beforward/route.test.ts`
- Modify `scripts/bf-collector-cli.ts`
- Modify `scripts/run-scrapers.ts`
- Modify `scripts/run-scrapers.test.ts`
- Create `scripts/audit-beforward-accuracy.ts`
- Create `agents/testscripts/beforward-data-accuracy.md`

**LOC/file target**
- `types.ts`: +25 LOC, keep under 140 LOC
- `collector.ts`: +120 LOC, keep under 360 LOC
- `discover.ts`: +20 LOC, keep under 240 LOC
- `normalize.ts`: +30 LOC, keep under 260 LOC
- `supabase_writer.ts`: +120 LOC, keep under 500 LOC
- Tests: +80-180 LOC per touched test file
- `route.ts`: +90 LOC, keep under 260 LOC
- `scripts/bf-collector-cli.ts`: +60 LOC, keep under 260 LOC
- `scripts/run-scrapers.ts`: +25 LOC, keep under existing file size
- `scripts/audit-beforward-accuracy.ts`: 180-260 LOC
- `agents/testscripts/beforward-data-accuracy.md`: 120-180 LOC

**deps**
- Runtime deps: 0 new
- Dev deps: 0 new
- External services: existing Supabase and existing BeForward/Scrapling path only

## Phase Zero Context

Current evidence from the 2026-06-06 run:
- BeForward source reports `totalResults=3553`.
- Manual runner processes `maxPages=10`, so only 250 summaries are scanned.
- Vercel cron processes `maxPages=3`, so only 75 summaries are scanned.
- Database has far more terminal BeForward rows than active rows.
- Sampled terminal BeForward rows are still live and `In-Stock` on source pages.
- Current `counts.written` increments even when writer returns `{ wrote: false }`.

Non-functional requirements:
- Vercel cron must finish under `maxDuration = 300`.
- Manual runner can be longer, but should remain resumable and observable.
- One failed or blocked page must not poison the whole run.
- No ambiguous fetch failure may mark a listing terminal.
- Every run must report coverage: `sourceTotal`, `sourceTotalPages`, `plannedPages`, `processedPages`, `coveragePercent`, `actualWrites`, `skippedInvalid`, `reactivated`, `terminalized`.

Pass/fail criteria:
- A single full-coverage CLI run can process all BeForward result pages or resume until complete.
- Cron route no longer pretends three pages equals source coverage.
- BeForward `written` equals actual DB upserts.
- A listing seen active in discovery/detail is reactivated from `delisted` or `unsold`.
- The audit script can compare source result count to active DB rows and flag divergence.

## Task 1: Add Honest Collector Counters

**Files:**
- Modify `src/features/scrapers/beforward_porsche_collector/types.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/collector.ts`
- Create `src/features/scrapers/beforward_porsche_collector/collector.test.ts`

- [ ] **Step 1: Extend `CollectorCounts`**

Add fields that distinguish processing from successful writes:

```ts
export interface CollectorCounts {
  discovered: number;
  detailsFetched: number;
  normalized: number;
  writeAttempts: number;
  written: number;
  skippedInvalid: number;
  dryRunSkipped: number;
  errors: number;
}
```

- [ ] **Step 2: Add the failing collector test**

Create `src/features/scrapers/beforward_porsche_collector/collector.test.ts` with mocks for `discoverPage`, `normalizeListingFromSummary`, and the writer. The key assertion is that `written` only increments when `upsertAll(...).wrote === true`.

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./discover", async () => {
  const actual = await vi.importActual<typeof import("./discover")>("./discover");
  return {
    ...actual,
    discoverPage: vi.fn(),
  };
});

vi.mock("./supabase_writer", () => ({
  createDryRunWriter: vi.fn(),
  createSupabaseWriter: vi.fn(),
}));

import { discoverPage } from "./discover";
import { createSupabaseWriter } from "./supabase_writer";
import { runBeForwardPorscheCollector } from "./collector";

describe("runBeForwardPorscheCollector counters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts actual writes separately from skipped rows", async () => {
    vi.mocked(discoverPage).mockResolvedValue({
      totalResults: 25,
      pageCount: 1,
      listings: [
        {
          page: 1,
          sourceUrl: "https://www.beforward.jp/porsche/911/aa111111/id/1/",
          refNo: "AA111111",
          title: "2016 PORSCHE 911",
          priceUsd: 50000,
          totalPriceUsd: 52000,
          mileageKm: 10000,
          year: 2016,
          location: "Yokohama",
        },
        {
          page: 1,
          sourceUrl: "https://www.beforward.jp/porsche/porsche-others/bb222222/id/2/",
          refNo: "BB222222",
          title: "2016 PORSCHE PORSCHE OTHERS",
          priceUsd: 30000,
          totalPriceUsd: 32000,
          mileageKm: 20000,
          year: 2016,
          location: "Osaka",
        },
      ],
    });

    vi.mocked(createSupabaseWriter).mockReturnValue({
      healthCheck: async () => {},
      upsertAll: vi
        .fn()
        .mockResolvedValueOnce({ listingId: "id-1", wrote: true })
        .mockResolvedValueOnce({ listingId: "skipped_invalid", wrote: false }),
    });

    const result = await runBeForwardPorscheCollector({
      mode: "daily",
      make: "Porsche",
      maxPages: 1,
      startPage: 1,
      maxDetails: 100,
      summaryOnly: true,
      concurrency: 1,
      rateLimitMs: 1,
      timeoutMs: 1000,
      checkpointPath: "var/test-bf-counter/checkpoint.json",
      outputPath: "var/test-bf-counter/listings.jsonl",
      dryRun: false,
    });

    expect(result.counts.writeAttempts).toBe(2);
    expect(result.counts.written).toBe(1);
    expect(result.counts.skippedInvalid).toBe(1);
  });
});
```

- [ ] **Step 3: Run the failing test**

Run:

```bash
npx vitest run src/features/scrapers/beforward_porsche_collector/collector.test.ts
```

Expected before implementation: failure because `writeAttempts` and `skippedInvalid` do not exist, and `written` increments on every non-throwing writer result.

- [ ] **Step 4: Implement counter handling**

In `collector.ts`, initialize the new fields and replace the write block with:

```ts
counts.writeAttempts++;
const writeResult = await writer.upsertAll(row, meta, config.dryRun);
if (writeResult.wrote) {
  counts.written++;
} else if (writeResult.listingId === "skipped_invalid") {
  counts.skippedInvalid++;
} else if (writeResult.listingId === "dry_run") {
  counts.dryRunSkipped++;
}
```

- [ ] **Step 5: Run targeted tests**

Run:

```bash
npx vitest run src/features/scrapers/beforward_porsche_collector/collector.test.ts src/app/api/cron/beforward/route.test.ts
```

Expected: PASS after updating route test fixtures to include new counter fields.

## Task 2: Make Crawl Coverage Explicit

**Files:**
- Modify `src/features/scrapers/beforward_porsche_collector/types.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/collector.ts`
- Modify `scripts/bf-collector-cli.ts`
- Modify `scripts/run-scrapers.ts`
- Modify `scripts/run-scrapers.test.ts`

- [ ] **Step 1: Extend result metadata**

Add these fields to `CollectorResult`:

```ts
sourceTotalPages: number;
plannedStartPage: number;
plannedEndPage: number;
coveragePercent: number | null;
coverageLimited: boolean;
coverageReason: "complete" | "max_pages" | "time_budget" | "checkpoint" | "unknown";
```

- [ ] **Step 2: Add collector coverage calculation**

After computing `rawPageCount` and clamped `pageCount`, derive:

```ts
const plannedStartPage = startPage;
const plannedEndPage = pageCount;
const coveragePercent = rawPageCount > 0
  ? Math.round(((pageCount - startPage + 1) / rawPageCount) * 10_000) / 100
  : null;
const coverageLimited = rawPageCount > pageCount;
const coverageReason = coverageLimited ? "max_pages" : "complete";
```

Return and log those fields. The log must make the limitation obvious:

```ts
logEvent({
  level: coverageLimited ? "warn" : "info",
  event: coverageLimited ? "collector.coverage_limited" : "collector.coverage_complete",
  runId,
  totalResults,
  sourceTotalPages: rawPageCount,
  plannedStartPage,
  plannedEndPage,
  coveragePercent,
});
```

- [ ] **Step 3: Change manual runner to full coverage**

In `scripts/run-scrapers.ts`, change the BeForward Collector args from:

```ts
"--maxPages=10",
```

to:

```ts
"--maxPages=200",
"--summaryOnly=true",
```

Keep enrichment/detail/image work as separate jobs. This lets manual/scheduled non-Vercel runs converge over all source pages without adding details to every row inline.

- [ ] **Step 4: Add CLI support for checkpoint paths and booleans**

In `scripts/bf-collector-cli.ts`, parse:

```ts
const checkpointPath = getFlag("checkpointPath", "var/beforward_porsche_collector/checkpoint.json");
const outputPath = getFlag("outputPath", "var/beforward_porsche_collector/listings.jsonl");
const summaryOnly = getFlag("summaryOnly", "false") === "true";
const startPage = parseInt(getFlag("startPage", "1"), 10);
```

Pass those values through to `runCollector`. This fixes diagnostic runs silently ignoring custom checkpoint/output flags.

- [ ] **Step 5: Update runner tests**

In `scripts/run-scrapers.test.ts`, assert the BeForward block contains `--maxPages=200` and `--summaryOnly=true`.

- [ ] **Step 6: Run tests**

Run:

```bash
npx vitest run scripts/run-scrapers.test.ts src/features/scrapers/beforward_porsche_collector/collector.test.ts
```

Expected: PASS.

## Task 3: Introduce Bounded Cron Windows Instead Of Permanent Page Caps

**Files:**
- Modify `src/app/api/cron/beforward/route.ts`
- Modify `src/app/api/cron/beforward/route.test.ts`

- [ ] **Step 1: Define cron modes**

Read an optional query parameter:

```ts
const url = new URL(request.url);
const mode = url.searchParams.get("mode") === "coverage" ? "coverage" : "fresh";
```

Use two profiles:

```ts
const profile = mode === "coverage"
  ? {
      maxPages: 25,
      summaryOnly: true,
      maxDetails: 0,
      backfillMaxListings: 0,
      refreshBudgetMs: 45_000,
      rateLimitMs: 3000,
    }
  : {
      maxPages: 5,
      summaryOnly: true,
      maxDetails: 0,
      backfillMaxListings: 8,
      refreshBudgetMs: 60_000,
      rateLimitMs: 3500,
    };
```

Fresh mode catches the newest pages frequently. Coverage mode advances deeper windows and should be run by a separate scheduler or manual trigger until full coverage converges.

- [ ] **Step 2: Use a persistent coverage checkpoint name**

For coverage mode:

```ts
checkpointPath: "/tmp/beforward_coverage_checkpoint.json",
outputPath: "/tmp/beforward_coverage_listings.jsonl",
```

For fresh mode:

```ts
checkpointPath: "/tmp/beforward_fresh_checkpoint.json",
outputPath: "/tmp/beforward_fresh_listings.jsonl",
```

Note: `/tmp` is not durable across Vercel invocations. This is acceptable for fresh mode but insufficient for true multi-run coverage. Task 4 adds DB-backed page state.

- [ ] **Step 3: Report mode and coverage metrics in response and monitoring**

Add `mode`, `sourceTotalPages`, `plannedStartPage`, `plannedEndPage`, `coveragePercent`, and `coverageLimited` to the response JSON and `recordScraperRun.error_messages` when coverage is limited:

```ts
const coverageMessages = result.coverageLimited
  ? [`coverage_limited: processed pages ${result.plannedStartPage}-${result.plannedEndPage} of ${result.sourceTotalPages}`]
  : [];
```

- [ ] **Step 4: Update route tests**

Update the existing successful test to expect fresh mode `maxPages: 5`. Add a second test:

```ts
it("runs bounded coverage mode when requested", async () => {
  const request = new Request("http://localhost:3000/api/cron/beforward?mode=coverage", {
    headers: { authorization: "Bearer test-secret" },
  });

  await GET(request);

  expect(runCollector).toHaveBeenCalledWith(expect.objectContaining({
    maxPages: 25,
    summaryOnly: true,
    rateLimitMs: 3000,
  }));
});
```

- [ ] **Step 5: Run cron tests**

Run:

```bash
npx vitest run src/app/api/cron/beforward/route.test.ts
```

Expected: PASS.

## Task 4: Add Durable Page-Window State For Coverage Cron

**Files:**
- Modify `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts`
- Modify `src/app/api/cron/beforward/route.ts`

- [ ] **Step 1: Add a tiny DB-backed state adapter using existing tables if possible**

Use `scraper_runs` only for reporting, not state. If no existing key-value table exists, avoid a migration at first and store the next page in a small JSON file only for CLI; for Vercel, derive the next page from prior `scraper_runs` coverage metadata if available. If `scraper_runs` cannot store metadata, add the state as part of `error_messages` is not acceptable for production. In that case, create the smallest migration:

```sql
create table if not exists scraper_state (
  scraper_name text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
```

Only use this migration if no existing equivalent table exists.

- [ ] **Step 2: Implement `loadCoverageState` and `saveCoverageState`**

Add exports:

```ts
export interface BeForwardCoverageState {
  nextPage: number;
  sourceTotalPages: number | null;
  completedAt: string | null;
}

export async function loadCoverageState(): Promise<BeForwardCoverageState> {
  // default: { nextPage: 1, sourceTotalPages: null, completedAt: null }
}

export async function saveCoverageState(state: BeForwardCoverageState): Promise<void> {
  // upsert scraper_name = "beforward_coverage"
}
```

- [ ] **Step 3: Use the state in coverage mode**

Before `runCollector`, load state. Pass:

```ts
startPage: coverageState.nextPage,
maxPages: profile.maxPages,
```

After the collector returns:

```ts
const nextPage = result.plannedEndPage >= result.sourceTotalPages
  ? 1
  : result.plannedEndPage + 1;

await saveCoverageState({
  nextPage,
  sourceTotalPages: result.sourceTotalPages,
  completedAt: nextPage === 1 ? new Date().toISOString() : null,
});
```

- [ ] **Step 4: Add state tests**

Mock Supabase calls in `supabase_writer.test.ts` to prove:
- missing state returns page 1
- existing state returns its `nextPage`
- save upserts the correct scraper key

- [ ] **Step 5: Run tests**

Run:

```bash
npx vitest run src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts src/app/api/cron/beforward/route.test.ts
```

Expected: PASS.

## Task 5: Reactivate Live Rows And Prevent False Terminalization

**Files:**
- Modify `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts`

- [ ] **Step 1: Ensure upsert reactivates live rows**

`mapNormalizedListingToListingsRow` already maps live discovered rows to `status: active`. Confirm the upsert always includes `status`, `updated_at`, `last_verified_at`, and `scrape_timestamp`. Add a regression test that an input listing with `status: "active"` maps to a row with `status: "active"` even if the existing DB row was terminal.

- [ ] **Step 2: Narrow `refreshActiveListings`**

Do not mark active listings terminal on parser ambiguity. Only terminalize when:
- HTTP is a confirmed 404 or 410, or
- detail parse explicitly returns source status sold/out-of-stock, and
- the HTML is a real BeForward detail page, not a bot/challenge/short response.

Add helper:

```ts
function isReliableBeForwardDetailHtml(html: string): boolean {
  return html.length > 50_000 && /beforward/i.test(html) && /schema\.org|ga_sale_status|vehicle/i.test(html);
}
```

Use it before applying `mapStatus`.

- [ ] **Step 3: Add tests for ambiguous failures**

Test cases:
- 403 does not update status.
- 429 does not update status.
- short/challenge HTML does not update status.
- `In-Stock` reaffirms active and updates `last_verified_at`.
- explicit `OutOfStock` updates terminal.

- [ ] **Step 4: Add reactivation audit counter**

When an upsert writes an active listing that was previously terminal, count it as `reactivated`. This requires selecting previous `status` before upsert or using returned row data. Prefer one preselect by `source/source_id` inside `upsertListing` and return:

```ts
{ listingId, wrote: true, previousStatus, currentStatus: listing.status }
```

Then increment `counts.reactivated` in collector when previous status is `delisted`, `sold`, or `unsold` and current status is `active`.

- [ ] **Step 5: Run tests**

Run:

```bash
npx vitest run src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts src/features/scrapers/beforward_porsche_collector/collector.test.ts
```

Expected: PASS.

## Task 6: Fix BeForward “Porsche Others” Normalization Loss

**Files:**
- Modify `src/features/scrapers/beforward_porsche_collector/normalize.ts`
- Modify `src/features/scrapers/beforward_porsche_collector/normalize.test.ts`
- Possibly modify `src/features/scrapers/common/listingValidator.ts` only if BeForward-local normalization cannot produce a valid model

- [ ] **Step 1: Add failing tests**

Add cases:

```ts
it("normalizes BeForward porsche-others summaries without rejecting make/model", () => {
  const out = normalizeListingFromSummary({
    summary: {
      page: 1,
      sourceUrl: "https://www.beforward.jp/porsche/porsche-others/cb893406/id/13958025/",
      refNo: "CB893406",
      title: "2016 PORSCHE PORSCHE OTHERS",
      priceUsd: 30000,
      totalPriceUsd: 32000,
      mileageKm: 50000,
      year: 2016,
      location: "Yokohama",
    },
    meta: { runId: "r", scrapeTimestamp: "2026-06-07T00:00:00.000Z" },
  });

  expect(out).not.toBeNull();
  expect(out?.make).toBe("Porsche");
  expect(out?.model).toBe("OTHER");
});
```

- [ ] **Step 2: Implement local model fallback**

When the URL segment is `porsche-others` or title contains `PORSCHE OTHERS`, map model to `OTHER` or the project-approved generic Porsche model bucket. Keep this local to BeForward unless other scrapers need it.

- [ ] **Step 3: Run tests**

Run:

```bash
npx vitest run src/features/scrapers/beforward_porsche_collector/normalize.test.ts src/features/scrapers/common/listingValidator.test.ts
```

Expected: PASS.

## Task 7: Add A BeForward Accuracy Audit Script

**Files:**
- Create `scripts/audit-beforward-accuracy.ts`
- Create `agents/testscripts/beforward-data-accuracy.md`

- [ ] **Step 1: Implement source-vs-DB audit**

The script should:
- fetch BeForward page 1 through existing `discoverPage`
- read `totalResults` and `sourceTotalPages`
- query Supabase counts by status and country for `source = "BeForward"`
- sample 20 terminal rows ordered by recent `last_verified_at`
- fetch those source URLs and classify live/terminal/ambiguous
- write JSON artifact to `agents/testscripts/artifacts/beforward-accuracy-<timestamp>.json`

CLI:

```bash
npx tsx scripts/audit-beforward-accuracy.ts --sample=20
```

Output summary:

```text
BeForward Accuracy Audit
sourceTotal=3553
sourcePages=143
dbActive=...
dbTerminal=...
activeJapan=...
terminalSampleLive=...
coverageGap=...
artifact=...
```

- [ ] **Step 2: Add testscript markdown**

Create `agents/testscripts/beforward-data-accuracy.md` with:
- objective
- required env vars
- exact commands
- expected observations
- artifact path
- cleanup
- pass/fail thresholds

Pass thresholds:
- `coverageGap <= 10%` after full convergence run, unless cleanup model exclusions are explicitly accepted.
- `terminalSampleLive = 0` for sampled rows.
- `coverageLimited=false` on a completed CLI full-coverage run.

- [ ] **Step 3: Run script locally**

Run:

```bash
npx tsx scripts/audit-beforward-accuracy.ts --sample=20
```

Expected: JSON artifact saved and no secrets printed.

## Task 8: Full Verification Sequence

**Files:**
- No new files beyond previous tasks

- [ ] **Step 1: Unit and route tests**

Run:

```bash
npm test -- src/features/scrapers/beforward_porsche_collector src/app/api/cron/beforward/route.test.ts scripts/run-scrapers.test.ts
```

Expected: PASS.

- [ ] **Step 2: Dry-run full coverage**

Run:

```bash
npx tsx scripts/bf-collector-cli.ts --maxPages=200 --summaryOnly=true --dryRun=true --checkpointPath=var/beforward_porsche_collector/checkpoint-dryrun.json --outputPath=var/beforward_porsche_collector/listings-dryrun.jsonl
```

Expected:
- `totalResults` around current marketplace count
- `sourceTotalPages` around `ceil(totalResults / 25)`
- `processedPages` reaches source pages or `maxPages`
- `coverageLimited=false` if source pages <= 200
- no DB writes

- [ ] **Step 3: Real convergence run**

Run only after dry-run looks correct:

```bash
npx tsx scripts/bf-collector-cli.ts --maxPages=200 --summaryOnly=true --checkpointPath=var/beforward_porsche_collector/checkpoint-full.json --outputPath=var/beforward_porsche_collector/listings-full.jsonl
```

Expected:
- actual `written` reflects successful upserts only
- `skippedInvalid` is small and explainable
- `reactivated` may be high on first repair run

- [ ] **Step 4: Run image/detail follow-ups**

Run:

```bash
npx tsx scripts/bf-bulk-backfill-images.ts --maxListings=500 --timeBudgetMs=1800000
npx tsx scripts/run-scrapers.ts --only=cron-beforward-enrich
```

If `--only` is not supported by `run-scrapers.ts`, use the existing BeForward enrichment command from the runner directly.

- [ ] **Step 5: DB audit**

Run:

```bash
npx tsx scripts/audit-beforward-accuracy.ts --sample=20
```

Expected:
- active BeForward count rises materially from the previous `341`
- active Japan count rises materially from the previous `257`
- sampled terminal rows are not live `In-Stock`

- [ ] **Step 6: App-level verification**

Run:

```bash
npm run build
npm run scrapers:audit
```

Expected:
- build passes
- BeForward health is not degraded for recent errors
- BeForward audit notes coverage, not just process OK

## Task 9: Operational Rollout

**Files:**
- Possibly update Vercel cron configuration if present in `vercel.json`, `vercel.ts`, or project dashboard

- [ ] **Step 1: Keep fresh cron frequent**

Run `/api/cron/beforward` in fresh mode daily or more frequently. This catches page 1-5 changes.

- [ ] **Step 2: Run coverage cron separately**

Run `/api/cron/beforward?mode=coverage` repeatedly until durable state wraps back to page 1. With 25 pages per run and ~143 pages on source, this needs roughly six invocations.

- [ ] **Step 3: Prefer local/GitHub runner for full coverage if Vercel IPs are blocked**

If Vercel runtime sees bot-blocks, full coverage should run from the environment that already succeeds with Scrapling/manual runner. The cron route should then be freshness-only.

- [ ] **Step 4: Install Vercel CLI for deployment/log verification**

The global Vercel CLI is currently not installed. Install it when ready:

```bash
npm i -g vercel
```

Use it for environment pulls and production logs:

```bash
vercel env pull .env.local
vercel logs
```

## Completion Criteria

The fix is complete when:
- BeForward collector reports honest write counters.
- Manual full run can cover the entire source result set.
- Vercel cron has explicit fresh/coverage modes and never presents a 3-page crawl as full coverage.
- Live source rows can reactivate terminal DB rows.
- Ambiguous bot/blocked responses do not terminalize listings.
- BeForward `Porsche Others` rows are either accepted into a deliberate bucket or rejected with a measured, reviewed reason.
- Accuracy audit artifact proves source-vs-DB gap and terminal false-positive rate.

## Residual Risks

- BeForward marketplace count may include models cleanup intentionally removes. If MonZA wants only sports/collector Porsche, the audit must compare against the same model policy, not raw source count.
- Vercel `/tmp` is ephemeral; durable coverage state needs DB storage for production cron.
- BeForward anti-bot behavior may vary by region/IP. Treat bot-block pages as ambiguous and retry later, not as evidence of delisting.
- Summary-only rows will not have full photos/details until backfill/enrichment catches up.
