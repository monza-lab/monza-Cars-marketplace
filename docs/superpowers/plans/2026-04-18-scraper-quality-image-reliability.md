# Scraper Quality and Image Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the current scraper regressions across discovery, enrichment, and image handling so every scraper either produces useful data or fails loudly with actionable diagnostics.

**Architecture:** Treat scraper health as a contract across four layers: discovery, normalization, persistence, and image coverage. First, add a shared quality matrix so the latest run of every scraper is scored the same way, then fix the high-signal failures one scraper family at a time, and finally harden the image backfill and reporting path so image regressions are visible immediately.

**Tech Stack:** TypeScript, Next.js route handlers, Supabase, Vitest, Playwright, Cheerio, GitHub Actions, Vercel Cron.

---

## Phase Zero: Latest Run Failure Map

This plan is based on the latest monitoring data and workflow runs captured on `2026-04-18`:

- `autoscout24` failed in GitHub Actions because discovery hit repeated Akamai blocks and returned `0 discovered / 0 written`.
- `autotrader` failed its latest run with `Zero output: AutoTrader discovered and wrote no rows`.
- `classic` still completes, but the latest run reports duplicate-key upsert errors against `listings_source_url_unique`.
- `porsche` completed successfully, but the latest run wrote `0` rows after discovering `1040`, which is suspicious enough to treat as a quality regression until proven otherwise.
- `beforward` is healthy on discovery, but the enrichment track (`enrich-beforward`) still hits time budgets and leaves partial coverage.
- `elferspot` collector runs are healthy, but enrichment still loses rows to 404 delists and time-budget cutoffs.
- `ferrari`, `bat-detail`, `backfill-images`, `cleanup`, `enrich-vin`, `enrich-titles`, `enrich-details`, and `enrich-details-bulk` are currently stable enough that the work there is mostly about preserving image quality and preventing regression.
- `validate` and `liveness-check` pass, but they should be promoted from “it ran” to “it enforces the image and quality contract.”

## Scope Ledger

- Files to modify: 18 to 24
- Files to create: 0 to 1
- Target LOC per file: 40 to 250, with no file above 400 LOC
- Dependencies: 0 new dependencies

---

### Task 1: Create a shared scraper quality matrix with image-aware statuses

**Files:**
- Modify: `src/features/scrapers/common/monitoring/types.ts`
- Modify: `src/features/scrapers/common/monitoring/health.ts`
- Modify: `src/features/scrapers/common/monitoring/audit.ts`
- Modify: `src/features/scrapers/common/monitoring/queries.ts`
- Modify: `src/app/api/admin/scrapers/live/route.ts`
- Modify: `src/app/api/admin/scrapers/field-completeness/route.ts`
- Modify: `src/components/dashboard/utils/aggregation.ts`
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Test: `src/features/scrapers/common/monitoring/health.test.ts`
- Test: `src/features/scrapers/common/monitoring/audit.test.ts`
- Test: `src/features/scrapers/common/monitoring/queries.test.ts`
- Test: `src/app/api/admin/scrapers/live/route.test.ts`
- Test: `src/app/api/admin/scrapers/field-completeness/route.test.ts`
- Test: `src/components/dashboard/DashboardClient.test.ts`

**Why this comes first:** the latest-run evidence is spread across Supabase and GitHub Actions. The workers need one place to answer three questions for every scraper: did it run, did it write, and did it preserve images.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { classifyScraperRun } from "@/features/scrapers/common/monitoring/health";

describe("classifyScraperRun", () => {
  it("marks a run as degraded when it discovers rows but writes zero and has image gaps", () => {
    const result = classifyScraperRun({
      scraperName: "porsche",
      success: true,
      discovered: 1040,
      written: 0,
      errorsCount: 2,
      imageCoverage: { withImages: 0, missingImages: 1040 },
    });

    expect(result.state).toBe("DEGRADED");
    expect(result.reason).toBe("zero_output");
    expect(result.flags).toContain("image_gap");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/common/monitoring/health.test.ts src/features/scrapers/common/monitoring/audit.test.ts src/features/scrapers/common/monitoring/queries.test.ts`
Expected: fail because the current health model does not expose image-aware quality flags.

- [ ] **Step 3: Write minimal implementation**

```ts
export type ScraperHealthState = "HEALTHY" | "DEGRADED" | "FAILED" | "ZERO_OUTPUT" | "RUNNING";

export interface ScraperImageCoverage {
  withImages: number;
  missingImages: number;
}

export interface ScraperRunSummary {
  scraperName: string;
  success: boolean;
  discovered: number;
  written: number;
  errorsCount: number;
  imageCoverage?: ScraperImageCoverage;
  finishedAt: string;
}

export function classifyScraperRun(run: ScraperRunSummary) {
  const flags: string[] = [];
  if (run.imageCoverage && run.imageCoverage.missingImages > 0) flags.push("image_gap");
  if (!run.success) return { state: "FAILED" as const, reason: "run_failed", flags };
  if (run.discovered > 0 && run.written === 0) return { state: "DEGRADED" as const, reason: "zero_output", flags };
  if (run.errorsCount > 0) return { state: "DEGRADED" as const, reason: "errors_present", flags };
  return { state: "HEALTHY" as const, flags };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/common/monitoring/health.test.ts src/features/scrapers/common/monitoring/audit.test.ts src/features/scrapers/common/monitoring/queries.test.ts src/app/api/admin/scrapers/live/route.test.ts src/app/api/admin/scrapers/field-completeness/route.test.ts src/components/dashboard/DashboardClient.test.ts`
Expected: the admin API and dashboard reflect `DEGRADED` when zero-write or image-gap runs appear.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/monitoring/types.ts src/features/scrapers/common/monitoring/health.ts src/features/scrapers/common/monitoring/audit.ts src/features/scrapers/common/monitoring/queries.ts src/app/api/admin/scrapers/live/route.ts src/app/api/admin/scrapers/field-completeness/route.ts src/components/dashboard/utils/aggregation.ts src/components/dashboard/DashboardClient.tsx src/features/scrapers/common/monitoring/health.test.ts src/features/scrapers/common/monitoring/audit.test.ts src/features/scrapers/common/monitoring/queries.test.ts src/app/api/admin/scrapers/live/route.test.ts src/app/api/admin/scrapers/field-completeness/route.test.ts src/components/dashboard/DashboardClient.test.ts
git commit -m "fix: make scraper health image-aware"
```

### Task 2: Fix AutoScout24 discovery so Akamai blocks produce actionable failures, not silent zero output

**Files:**
- Modify: `src/app/api/cron/autoscout24/route.ts`
- Modify: `src/features/scrapers/autoscout24_collector/collector.ts`
- Modify: `src/features/scrapers/autoscout24_collector/discover.ts`
- Modify: `src/features/scrapers/autoscout24_collector/browser.ts`
- Modify: `src/features/scrapers/autoscout24_collector/net.ts`
- Modify: `src/features/scrapers/autoscout24_collector/logging.ts`
- Modify: `src/features/scrapers/autoscout24_collector/supabase_writer.ts`
- Test: `src/app/api/cron/autoscout24/route.test.ts`
- Test: `src/features/scrapers/autoscout24_collector/collector.test.ts`
- Test: `src/features/scrapers/autoscout24_collector/discover.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { runCollector } from "@/features/scrapers/autoscout24_collector/collector";

vi.mock("@/features/scrapers/autoscout24_collector/discover", () => ({
  discoverListings: vi.fn(async () => ({ listings: [], errors: ["Akamai block"], blocked: true })),
}));

describe("runCollector", () => {
  it("fails loudly when discovery is blocked and yields zero rows", async () => {
    const result = await runCollector({ maxListings: 10, dryRun: true });
    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Akamai/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/autoscout24_collector/collector.test.ts src/features/scrapers/autoscout24_collector/discover.test.ts src/app/api/cron/autoscout24/route.test.ts`
Expected: fail until the collector treats repeated block detection as a first-class failure with clear diagnostics.

- [ ] **Step 3: Write minimal implementation**

```ts
if (counts.discovered === 0 && counts.written === 0) {
  return {
    success: false,
    errors: ["Akamai or upstream block prevented discovery"],
    counts,
  };
}

if (blockedConsecutively >= 5) {
  throw new Error("Aborting: 5 consecutive Akamai blocks");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/autoscout24_collector/collector.test.ts src/features/scrapers/autoscout24_collector/discover.test.ts src/app/api/cron/autoscout24/route.test.ts`
Expected: route returns a non-200 status on a blocked run, the error message names Akamai explicitly, and the logs preserve the shard/page that failed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/autoscout24/route.ts src/features/scrapers/autoscout24_collector/collector.ts src/features/scrapers/autoscout24_collector/discover.ts src/features/scrapers/autoscout24_collector/browser.ts src/features/scrapers/autoscout24_collector/net.ts src/features/scrapers/autoscout24_collector/logging.ts src/features/scrapers/autoscout24_collector/supabase_writer.ts src/app/api/cron/autoscout24/route.test.ts src/features/scrapers/autoscout24_collector/collector.test.ts src/features/scrapers/autoscout24_collector/discover.test.ts
git commit -m "fix(autoscout24): fail loudly on Akamai blocks"
```

### Task 3: Fix AutoTrader zero-output and make the enrichment path produce measurable work

**Files:**
- Modify: `src/app/api/cron/autotrader/route.ts`
- Modify: `src/app/api/cron/enrich-autotrader/route.ts`
- Modify: `src/features/scrapers/autotrader_collector/collector.ts`
- Modify: `src/features/scrapers/autotrader_collector/discover.ts`
- Modify: `src/features/scrapers/autotrader_collector/detail.ts`
- Modify: `src/features/scrapers/autotrader_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/autotrader_collector/types.ts`
- Test: `src/app/api/cron/autotrader/route.test.ts`
- Test: `src/app/api/cron/enrich-autotrader/route.test.ts`
- Test: `src/features/scrapers/autotrader_collector/collector.test.ts`
- Test: `src/features/scrapers/autotrader_collector/discover.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/api/cron/autotrader/route";

vi.mock("@/features/scrapers/autotrader_collector/collector", () => ({
  runCollector: vi.fn(async () => ({ success: true, counts: { discovered: 0, written: 0 }, errors: [] })),
}));

describe("GET /api/cron/autotrader", () => {
  it("returns failure when the collector produces zero useful output", async () => {
    const res = await GET(new Request("http://localhost", { headers: { authorization: "Bearer test-secret" } }));
    const body = await res.json();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(body.error).toMatch(/zero output/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/autotrader/route.test.ts src/app/api/cron/enrich-autotrader/route.test.ts src/features/scrapers/autotrader_collector/collector.test.ts src/features/scrapers/autotrader_collector/discover.test.ts`
Expected: fail until the route treats `0 discovered / 0 written` as a hard quality failure.

- [ ] **Step 3: Write minimal implementation**

```ts
if (result.counts.discovered === 0 && result.counts.written === 0) {
  await recordScraperRun({
    scraper_name: "autotrader",
    success: false,
    errors_count: 1,
    error_messages: ["Zero output: AutoTrader discovered and wrote no rows"],
  });
  return NextResponse.json({ success: false, error: "Zero output: AutoTrader discovered and wrote no rows" }, { status: 502 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/autotrader/route.test.ts src/app/api/cron/enrich-autotrader/route.test.ts src/features/scrapers/autotrader_collector/collector.test.ts src/features/scrapers/autotrader_collector/discover.test.ts`
Expected: both the collector and the enrichment cron now emit a clear failure when the gateway query yields no rows, and the existing header/query fallback remains covered by tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/autotrader/route.ts src/app/api/cron/enrich-autotrader/route.ts src/features/scrapers/autotrader_collector/collector.ts src/features/scrapers/autotrader_collector/discover.ts src/features/scrapers/autotrader_collector/detail.ts src/features/scrapers/autotrader_collector/supabase_writer.ts src/features/scrapers/autotrader_collector/types.ts src/app/api/cron/autotrader/route.test.ts src/app/api/cron/enrich-autotrader/route.test.ts src/features/scrapers/autotrader_collector/collector.test.ts src/features/scrapers/autotrader_collector/discover.test.ts
git commit -m "fix(autotrader): fail on zero-output runs"
```

### Task 4: Make Porsche and Classic idempotent, then verify their image output

**Files:**
- Modify: `src/app/api/cron/porsche/route.ts`
- Modify: `src/features/scrapers/porsche_collector/collector.ts`
- Modify: `src/features/scrapers/porsche_collector/historical_backfill.ts`
- Modify: `src/features/scrapers/porsche_collector/normalize.ts`
- Modify: `src/features/scrapers/porsche_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/porsche_collector/historical_bat/run.ts`
- Modify: `src/app/api/cron/classic/route.ts`
- Modify: `src/features/scrapers/classic_collector/browser.ts`
- Modify: `src/features/scrapers/classic_collector/collector.ts`
- Modify: `src/features/scrapers/classic_collector/normalize.ts`
- Modify: `src/features/scrapers/classic_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/classic_collector/discover.ts`
- Test: `src/app/api/cron/porsche/route.test.ts`
- Test: `src/features/scrapers/porsche_collector/supabase_writer.test.ts`
- Test: `src/features/scrapers/porsche_collector/collector.images.test.ts`
- Test: `src/app/api/cron/classic/route.test.ts`
- Test: `src/features/scrapers/classic_collector/normalize.test.ts`
- Test: `src/features/scrapers/classic_collector/discover.test.ts`
- Test: `src/features/scrapers/classic_collector/supabase_writer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { GET as GET_PORSCHE } from "@/app/api/cron/porsche/route";

vi.mock("@/features/scrapers/porsche_collector/collector", () => ({
  runCollector: vi.fn(async () => ({
    success: true,
    counts: { discovered: 1040, written: 0, errors: 2 },
    errors: ["BaT listings parsed, but no rows passed validation"],
  })),
}));

describe("GET /api/cron/porsche", () => {
  it("fails the run when discovery is non-zero but writes are zero", async () => {
    const res = await GET_PORSCHE(new Request("http://localhost", { headers: { authorization: "Bearer test-secret" } }));
    const body = await res.json();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(body.error).toMatch(/zero/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/porsche/route.test.ts src/features/scrapers/porsche_collector/supabase_writer.test.ts src/features/scrapers/porsche_collector/collector.images.test.ts src/app/api/cron/classic/route.test.ts src/features/scrapers/classic_collector/normalize.test.ts src/features/scrapers/classic_collector/discover.test.ts src/features/scrapers/classic_collector/supabase_writer.test.ts`
Expected: fail because the current routes do not yet treat the zero-write Porsche run as a quality regression.

- [ ] **Step 3: Write minimal implementation**

```ts
if (result.counts.discovered > 0 && result.counts.written === 0) {
  throw new Error("Porsche collector produced discovery without writes");
}

const dedupeKey = `${listing.source}:${listing.sourceUrl}`;
if (seen.has(dedupeKey)) continue;
seen.add(dedupeKey);
```

For Classic, make the writer ignore duplicate source URLs before the upsert call instead of letting `listings_source_url_unique` generate noisy errors.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/porsche/route.test.ts src/features/scrapers/porsche_collector/supabase_writer.test.ts src/features/scrapers/porsche_collector/collector.images.test.ts src/app/api/cron/classic/route.test.ts src/features/scrapers/classic_collector/normalize.test.ts src/features/scrapers/classic_collector/discover.test.ts src/features/scrapers/classic_collector/supabase_writer.test.ts`
Expected: Porsche no longer reports a false-positive success when it writes nothing, and Classic stops emitting duplicate-key noise while preserving image rows.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/porsche/route.ts src/features/scrapers/porsche_collector/collector.ts src/features/scrapers/porsche_collector/historical_backfill.ts src/features/scrapers/porsche_collector/normalize.ts src/features/scrapers/porsche_collector/supabase_writer.ts src/features/scrapers/porsche_collector/historical_bat/run.ts src/app/api/cron/classic/route.ts src/features/scrapers/classic_collector/browser.ts src/features/scrapers/classic_collector/collector.ts src/features/scrapers/classic_collector/normalize.ts src/features/scrapers/classic_collector/supabase_writer.ts src/features/scrapers/classic_collector/discover.ts src/app/api/cron/porsche/route.test.ts src/features/scrapers/porsche_collector/supabase_writer.test.ts src/features/scrapers/porsche_collector/collector.images.test.ts src/app/api/cron/classic/route.test.ts src/features/scrapers/classic_collector/normalize.test.ts src/features/scrapers/classic_collector/discover.test.ts src/features/scrapers/classic_collector/supabase_writer.test.ts
git commit -m "fix: make porsche and classic runs idempotent"
```

### Task 5: Tighten BeForward and Elferspot enrichment so partial runs are intentional and image-safe

**Files:**
- Modify: `src/app/api/cron/beforward/route.ts`
- Modify: `src/app/api/cron/enrich-beforward/route.ts`
- Modify: `src/app/api/cron/elferspot/route.ts`
- Modify: `src/app/api/cron/enrich-elferspot/route.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/backfill.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/detail.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/normalize.ts`
- Modify: `src/features/scrapers/elferspot_collector/collector.ts`
- Modify: `src/features/scrapers/elferspot_collector/detail.ts`
- Modify: `src/features/scrapers/elferspot_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/elferspot_collector/normalize.ts`
- Test: `src/app/api/cron/beforward/route.test.ts`
- Test: `src/app/api/cron/enrich-beforward/route.test.ts`
- Test: `src/app/api/cron/elferspot/route.test.ts`
- Test: `src/app/api/cron/enrich-elferspot/route.test.ts`
- Test: `src/features/scrapers/beforward_porsche_collector/backfill.test.ts`
- Test: `src/features/scrapers/beforward_porsche_collector/detail.test.ts`
- Test: `src/features/scrapers/elferspot_collector/detail.test.ts`
- Test: `src/features/scrapers/elferspot_collector/collector.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { GET as GET_ENRICH_BEFORWARD } from "@/app/api/cron/enrich-beforward/route";

vi.mock("@/features/scrapers/beforward_porsche_collector/detail", () => ({
  parseDetailHtml: vi.fn(() => ({ images: [], description: "", vin: null })),
}));

describe("GET /api/cron/enrich-beforward", () => {
  it("marks the run as partial when it hits the time budget before finishing", async () => {
    const res = await GET_ENRICH_BEFORWARD(new Request("http://localhost", { headers: { authorization: "Bearer test-secret" } }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.error_messages.join(" ")).toMatch(/time budget/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/beforward/route.test.ts src/app/api/cron/enrich-beforward/route.test.ts src/app/api/cron/elferspot/route.test.ts src/app/api/cron/enrich-elferspot/route.test.ts src/features/scrapers/beforward_porsche_collector/backfill.test.ts src/features/scrapers/beforward_porsche_collector/detail.test.ts src/features/scrapers/elferspot_collector/detail.test.ts src/features/scrapers/elferspot_collector/collector.test.ts`
Expected: fail because time-budget exits and 404 delists are not yet being classified consistently as partial, image-safe outcomes.

- [ ] **Step 3: Write minimal implementation**

```ts
if (remainingMs <= 30_000) {
  backfillResult = { discovered: 0, backfilled: 0, errors: ["Time budget reached before backfill"] };
}

if (error?.status === 404 || error?.status === 410) {
  return { status: "delisted", shouldKeepImages: false };
}

if (written < discovered) {
  errorMessages.push(`Time budget reached after ${written} enrichments`);
}
```

For Elferspot, keep the latest-run behavior honest: a run that hits the budget can still be successful, but it must expose the shortfall and preserve image URLs for the rows it did enrich.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/beforward/route.test.ts src/app/api/cron/enrich-beforward/route.test.ts src/app/api/cron/elferspot/route.test.ts src/app/api/cron/enrich-elferspot/route.test.ts src/features/scrapers/beforward_porsche_collector/backfill.test.ts src/features/scrapers/beforward_porsche_collector/detail.test.ts src/features/scrapers/elferspot_collector/detail.test.ts src/features/scrapers/elferspot_collector/collector.test.ts`
Expected: partial runs are recorded with explicit budget diagnostics, and image-bearing rows keep their assets instead of being discarded by over-aggressive cleanup.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/beforward/route.ts src/app/api/cron/enrich-beforward/route.ts src/app/api/cron/elferspot/route.ts src/app/api/cron/enrich-elferspot/route.ts src/features/scrapers/beforward_porsche_collector/backfill.ts src/features/scrapers/beforward_porsche_collector/detail.ts src/features/scrapers/beforward_porsche_collector/supabase_writer.ts src/features/scrapers/beforward_porsche_collector/normalize.ts src/features/scrapers/elferspot_collector/collector.ts src/features/scrapers/elferspot_collector/detail.ts src/features/scrapers/elferspot_collector/supabase_writer.ts src/features/scrapers/elferspot_collector/normalize.ts src/app/api/cron/beforward/route.test.ts src/app/api/cron/enrich-beforward/route.test.ts src/app/api/cron/elferspot/route.test.ts src/app/api/cron/enrich-elferspot/route.test.ts src/features/scrapers/beforward_porsche_collector/backfill.test.ts src/features/scrapers/beforward_porsche_collector/detail.test.ts src/features/scrapers/elferspot_collector/detail.test.ts src/features/scrapers/elferspot_collector/collector.test.ts
git commit -m "fix: make beforward and elferspot enrichment budget-aware"
```

### Task 6: Make image backfill source-aware and enforce image coverage for every scraper family

**Files:**
- Modify: `src/features/scrapers/common/backfillImages.ts`
- Modify: `src/features/scrapers/common/backfillImages.test.ts`
- Modify: `src/app/api/cron/backfill-images/route.ts`
- Modify: `src/app/api/cron/backfill-images/route.test.ts`
- Modify: `src/features/scrapers/common/monitoring/record.ts`
- Modify: `src/features/scrapers/common/monitoring/queries.ts`
- Modify: `src/app/api/admin/scrapers/field-completeness/route.ts`
- Modify: `src/components/dashboard/utils/aggregation.ts`
- Modify: `docs/scrapers/SCRAPERS.md`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { backfillImagesForSource } from "@/features/scrapers/common/backfillImages";

describe("backfillImagesForSource", () => {
  it("prefers rows with missing images and skips dead URLs", async () => {
    const result = await backfillImagesForSource({
      source: "BeForward",
      maxListings: 5,
      timeBudgetMs: 10_000,
      rateLimitMs: 1_000,
    });

    expect(result.errors.join(" ")).not.toMatch(/malformed array literal/i);
    expect(result.errors.join(" ")).not.toMatch(/dead url/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts src/app/api/cron/backfill-images/route.test.ts`
Expected: fail until the query and selection logic reliably target rows missing images without breaking on array syntax or dead-link rows.

- [ ] **Step 3: Write minimal implementation**

```ts
const { data } = await supabase
  .from("listings")
  .select("id, source, source_url, images, status")
  .in("source", sources)
  .or("images.is.null,images.eq.{}");

const keep = rows.filter((row) => !isDeadUrl(row.source_url));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts src/app/api/cron/backfill-images/route.test.ts src/app/api/admin/scrapers/field-completeness/route.test.ts`
Expected: image backfill only touches rows that actually need assets, the route reports a clean partial-success shape when budgets are hit, and the admin completeness endpoint exposes per-source image deficits.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/backfillImages.ts src/features/scrapers/common/backfillImages.test.ts src/app/api/cron/backfill-images/route.ts src/app/api/cron/backfill-images/route.test.ts src/features/scrapers/common/monitoring/record.ts src/features/scrapers/common/monitoring/queries.ts src/app/api/admin/scrapers/field-completeness/route.ts src/components/dashboard/utils/aggregation.ts docs/scrapers/SCRAPERS.md
git commit -m "fix: make image backfill source-aware"
```

### Task 7: Harden schedules and alerts so quality regressions are visible before the next daily run

**Files:**
- Modify: `.github/workflows/autoscout24-collector.yml`
- Modify: `.github/workflows/classic-collector.yml`
- Modify: `.github/workflows/autoscout24-enrich.yml`
- Modify: `.github/workflows/liveness-checker.yml`
- Create: `src/features/scrapers/common/monitoring/quality.ts`
- Test: `src/features/scrapers/common/monitoring/quality.test.ts`
- Create: `scripts/verify-scraper-quality.mjs`
- Modify: `docs/scrapers/SCRAPERS.md`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { shouldFailQualityGate } from "./quality";

describe("shouldFailQualityGate", () => {
  it("fails when a critical scraper has zero output or missing images", () => {
    const result = shouldFailQualityGate([
      { scraperName: "autoscout24", success: false, discovered: 0, written: 0, imageCoverage: { withImages: 0, missingImages: 0 } },
      { scraperName: "porsche", success: true, discovered: 1040, written: 0, imageCoverage: { withImages: 0, missingImages: 1040 } },
    ]);

    expect(result.fail).toBe(true);
    expect(result.reasons).toContain("autoscout24:zero_output");
    expect(result.reasons).toContain("porsche:image_gap");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/common/monitoring/quality.test.ts`
Expected: fail until the new quality gate helper exists and classifies zero-output/image-gap runs.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface QualityGateRun {
  scraperName: string;
  success: boolean;
  discovered: number;
  written: number;
  imageCoverage?: { withImages: number; missingImages: number };
}

export function shouldFailQualityGate(runs: QualityGateRun[]) {
  const reasons: string[] = [];
  for (const run of runs) {
    if (!run.success || (run.discovered > 0 && run.written === 0)) {
      reasons.push(`${run.scraperName}:zero_output`);
    }
    if (run.imageCoverage && run.imageCoverage.missingImages > 0) {
      reasons.push(`${run.scraperName}:image_gap`);
    }
  }
  return { fail: reasons.length > 0, reasons };
}
```

Add a script entry point that loads the last successful run per critical scraper and exits with code `1` when `shouldFailQualityGate()` reports any `zero_output` or `image_gap` reason. Update the listed workflows so they run the script immediately after the scraper step, before upload or downstream jobs. Document the rule in `docs/scrapers/SCRAPERS.md`: a scraper job is not considered healthy unless it either writes data and preserves images, or it explicitly declares that it does not own images.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/common/monitoring/quality.test.ts && node scripts/verify-scraper-quality.mjs --dry-run`
Expected: the helper test passes and the script prints the same reasons without mutating the database.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/autoscout24-collector.yml .github/workflows/classic-collector.yml .github/workflows/autoscout24-enrich.yml .github/workflows/liveness-checker.yml src/features/scrapers/common/monitoring/quality.ts src/features/scrapers/common/monitoring/quality.test.ts scripts/verify-scraper-quality.mjs docs/scrapers/SCRAPERS.md
git commit -m "fix: add scraper quality gate for zero output and image gaps"
```

---

## Self-Review

**Spec coverage check**

- Latest-run regressions are covered for `autoscout24`, `autotrader`, `classic`, `porsche`, `beforward`, and `elferspot`.
- Stable scrapers are still included through the shared monitoring and image coverage work, so they remain guarded against regressions.
- Image handling is addressed both in the individual scrapers and in the shared backfill/reporting path.
- GitHub Actions and the quality-gate script are included so the plan does not stop at code and forget the delivery mechanism.

**Placeholder scan**

- No `TBD`, `TODO`, or vague “add validation” language remains.
- Each task names concrete files, tests, commands, and expected results.
- Each task defines the failure condition it is meant to eliminate.

**Type and contract consistency**

- `ScraperRunSummary` and `ScraperImageCoverage` are defined before they are used.
- The route names, scraper names, and test file paths match the existing repository layout.
- The plan uses the existing scraper names from monitoring: `autoscout24`, `autotrader`, `backfill-images`, `bat-detail`, `beforward`, `classic`, `cleanup`, `elferspot`, `enrich-autotrader`, `enrich-beforward`, `enrich-details`, `enrich-details-bulk`, `enrich-elferspot`, `enrich-titles`, `enrich-vin`, `ferrari`, `liveness-check`, `porsche`, and `validate`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-scraper-quality-image-reliability.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
