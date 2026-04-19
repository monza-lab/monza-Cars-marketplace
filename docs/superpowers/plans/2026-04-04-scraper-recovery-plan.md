# Scraper Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore scraper reliability so every scheduled job either writes valid data or fails loudly with a useful reason.

**Architecture:** Treat scraper health as a contract across discovery, enrichment, persistence, and monitoring. Fix shared data-layer bugs first, then job-specific zero-output and anti-bot issues, and finally harden browser-based collectors like Classic with an explicit proxy validation path.

**Tech Stack:** TypeScript, Next.js route handlers, Playwright, Supabase, Vitest, GitHub Actions, Vercel Cron, Cheerio.

---

## Phase Zero: Current Failure Map

This plan covers the problems confirmed in Supabase over the last runs:

- `backfill-images` is still broken on `malformed array literal: "[]"`.
- `enrich-beforward` still writes a nonexistent `fuel_type` column.
- `autotrader` completes with zero discovery and zero writes.
- `enrich-autotrader` discovers rows but writes none.
- `porsche` discovers listings but writes none because Cars & Bids and Collecting Cars are blocked.
- `classic` is running, but it still needs a real proxy health check and Cloudflare validation.
- `ferrari`, `beforward`, `autoscout24`, `bat-detail`, `cleanup`, `enrich-vin`, `enrich-titles`, `enrich-details`, `enrich-details-bulk`, `enrich-elferspot`, and `liveness-check` are functioning, but some need hardening so they do not regress.

## File Budget

- Files to modify: 14
- Files to create: 3
- Target LOC per file: <= 250
- Dependencies: 0 new

---

### Task 1: Lock the health contract

**Files:**
- Modify: `src/features/scrapers/common/monitoring/health.ts`
- Modify: `src/features/scrapers/common/monitoring/index.ts`
- Modify: `src/features/scrapers/common/monitoring/audit.ts`
- Test: `src/features/scrapers/common/monitoring/health.test.ts`
- Test: `src/features/scrapers/common/monitoring/audit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { classifyScraperRun, type ScraperRunSummary } from "./health";

describe("classifyScraperRun", () => {
  it("treats zero-write discovery jobs as degraded", () => {
    const run: ScraperRunSummary = {
      scraperName: "autotrader",
      success: true,
      discovered: 100,
      written: 0,
      errorsCount: 0,
      finishedAt: "2026-04-04T00:00:00.000Z",
    };

    expect(classifyScraperRun(run)).toEqual({
      state: "DEGRADED",
      reason: "zero_output",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/common/monitoring/health.test.ts`
Expected: fail because zero-output jobs are still treated as healthy.

- [ ] **Step 3: Write minimal implementation**

```ts
export type ScraperHealthState = "HEALTHY" | "DEGRADED" | "FAILED" | "ZERO_OUTPUT" | "RUNNING";

export function classifyScraperRun(run: ScraperRunSummary): { state: ScraperHealthState; reason?: string } {
  if (!run.success) return { state: "FAILED", reason: "run_failed" };
  if (run.discovered > 0 && run.written === 0) return { state: "DEGRADED", reason: "zero_output" };
  if (run.discovered === 0 && run.written === 0) return { state: "ZERO_OUTPUT", reason: "no_discovery" };
  if (run.errorsCount > 0) return { state: "DEGRADED", reason: "errors_present" };
  return { state: "HEALTHY" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/common/monitoring/health.test.ts src/features/scrapers/common/monitoring/audit.test.ts`
Expected: both tests pass and the audit helper surfaces the new states.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/monitoring/health.ts src/features/scrapers/common/monitoring/index.ts src/features/scrapers/common/monitoring/audit.ts src/features/scrapers/common/monitoring/health.test.ts src/features/scrapers/common/monitoring/audit.test.ts
git commit -m "fix: classify scraper health by output and errors"
```

### Task 2: Fix backfill-images query handling

**Files:**
- Modify: `src/features/scrapers/common/backfillImages.ts`
- Modify: `src/app/api/cron/backfill-images/route.ts`
- Test: `src/features/scrapers/common/backfillImages.test.ts`
- Test: `src/app/api/cron/backfill-images/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("selects listings missing images without using malformed array syntax", async () => {
  const result = await backfillImagesForSource({ source: "BaT", maxListings: 1, delayMs: 0, timeBudgetMs: 1000 });
  expect(result.errors).not.toContain('malformed array literal: "[]"');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts src/app/api/cron/backfill-images/route.test.ts`
Expected: fail because the current query still emits the malformed array literal.

- [ ] **Step 3: Write minimal implementation**

```ts
const { data, error } = await supabase
  .from("listings")
  .select("id, source_url, images")
  .eq("source", source)
  .or("images.is.null,images.eq.{}")
  .limit(maxListings);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts src/app/api/cron/backfill-images/route.test.ts`
Expected: pass and the cron route records non-error backfill results when rows exist.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/backfillImages.ts src/app/api/cron/backfill-images/route.ts src/features/scrapers/common/backfillImages.test.ts src/app/api/cron/backfill-images/route.test.ts
git commit -m "fix: backfill missing images query"
```

### Task 3: Remove the BeForward schema mismatch

**Files:**
- Modify: `src/app/api/cron/enrich-beforward/route.ts`
- Test: `src/app/api/cron/enrich-beforward/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("does not attempt to write fuel_type", async () => {
  const res = await GET(new Request("http://localhost", { headers: { authorization: "Bearer test-secret" } }));
  const body = await res.json();
  expect(body.error_messages?.join(" ")).not.toContain("fuel_type");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/enrich-beforward/route.test.ts`
Expected: fail until the nonexistent column is removed from the update payload.

- [ ] **Step 3: Write minimal implementation**

```ts
const update: Record<string, unknown> = {
  updated_at: new Date().toISOString(),
};

if (detail.engine) update.engine = detail.engine;
if (detail.transmission) update.transmission = detail.transmission;
if (detail.mileage != null) update.mileage_km = detail.mileage;
if (detail.exteriorColor) update.color_exterior = detail.exteriorColor;
if (detail.vin) update.vin = detail.vin;
if (detail.description) update.description_text = detail.description;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/enrich-beforward/route.test.ts`
Expected: pass, and live runs should start writing again instead of producing 44 schema errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/enrich-beforward/route.ts src/app/api/cron/enrich-beforward/route.test.ts
git commit -m "fix: align beforward enrichment with listings schema"
```

### Task 4: Make zero-output jobs fail loudly

**Files:**
- Modify: `src/app/api/cron/autotrader/route.ts`
- Modify: `src/app/api/cron/enrich-autotrader/route.ts`
- Modify: `src/app/api/cron/porsche/route.ts`
- Modify: `src/app/api/cron/validate/route.ts`
- Test: `src/app/api/cron/autotrader/route.test.ts`
- Test: `src/app/api/cron/enrich-autotrader/route.test.ts`
- Test: `src/app/api/cron/porsche/route.test.ts`
- Test: `src/app/api/cron/validate/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("returns degraded status when discovered and written are both zero", async () => {
  const res = await GET(new Request("http://localhost", { headers: { authorization: "Bearer test-secret" } }));
  const body = await res.json();
  expect(body.success).toBe(false);
  expect(body.error).toMatch(/zero output/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/autotrader/route.test.ts src/app/api/cron/enrich-autotrader/route.test.ts src/app/api/cron/porsche/route.test.ts src/app/api/cron/validate/route.test.ts`
Expected: the zero-output assertions fail until the routes classify empty work as degraded.

- [ ] **Step 3: Write minimal implementation**

```ts
if (totalDiscovered === 0 && totalWritten === 0) {
  await recordScraperRun({ success: false, error_messages: ["Zero output: no rows discovered or written"] });
  return NextResponse.json({ success: false, error: "Zero output: no rows discovered or written" }, { status: 500 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/autotrader/route.test.ts src/app/api/cron/enrich-autotrader/route.test.ts src/app/api/cron/porsche/route.test.ts src/app/api/cron/validate/route.test.ts`
Expected: zero-output paths are no longer reported as healthy.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/autotrader/route.ts src/app/api/cron/enrich-autotrader/route.ts src/app/api/cron/porsche/route.ts src/app/api/cron/validate/route.ts src/app/api/cron/autotrader/route.test.ts src/app/api/cron/enrich-autotrader/route.test.ts src/app/api/cron/porsche/route.test.ts src/app/api/cron/validate/route.test.ts
git commit -m "fix: fail zero-output scraper runs loudly"
```

### Task 5: Repair Porsche source blocking

**Files:**
- Modify: `src/app/api/cron/porsche/route.ts`
- Modify: `src/features/scrapers/porsche_collector/collector.ts`
- Test: `src/app/api/cron/porsche/route.test.ts`
- Test: `src/features/scrapers/porsche_collector/*.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("records source-level 403s as degraded instead of silently completing with zero writes", async () => {
  const result = await runPorscheCollector({ mode: "daily", maxActivePagesPerSource: 1, maxEndedPagesPerSource: 1, scrapeDetails: false });
  expect(result.errors.some((e) => e.includes("HTTP 403"))).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/porsche/route.test.ts src/features/scrapers/porsche_collector/*.test.ts`
Expected: fail until the collector surfaces source blocking clearly.

- [ ] **Step 3: Write minimal implementation**

```ts
if (sourceErrors.some((e) => /HTTP 403/.test(e))) {
  return { ...result, success: false, degraded: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/porsche/route.test.ts src/features/scrapers/porsche_collector/*.test.ts`
Expected: Porsche reports degraded when sources are blocked and no writes occur.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/porsche/route.ts src/features/scrapers/porsche_collector/collector.ts src/app/api/cron/porsche/route.test.ts src/features/scrapers/porsche_collector/*.test.ts
git commit -m "fix: surface porsche source blocking"
```

### Task 6: Validate the Classic proxy path

**Files:**
- Modify: `src/features/scrapers/classic_collector/browser.ts`
- Modify: `src/features/scrapers/classic_collector/cli.ts`
- Modify: `src/features/scrapers/classic_collector/collector.ts`
- Test: `src/features/scrapers/classic_collector/*.test.ts`
- Test: `src/features/scrapers/common/serverless-browser.ts` if proxy launch behavior needs adjustment

- [ ] **Step 1: Write the failing test**

```ts
it("passes DECODO proxy settings into browser launch", () => {
  const config = {
    proxyServer: "http://gate.smartproxy.com:7000",
    proxyUsername: "user-country-us",
    proxyPassword: "secret",
  };
  expect(buildClassicBrowserLaunchOptions(config).proxy).toEqual({
    server: "http://gate.smartproxy.com:7000",
    username: "user-country-us",
    password: "secret",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/classic_collector/*.test.ts`
Expected: fail if proxy settings are not exposed as a testable launch option.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildClassicBrowserLaunchOptions(config: ClassicProxyConfig) {
  return {
    headless: config.headless,
    proxy: config.proxyServer
      ? { server: config.proxyServer, username: config.proxyUsername, password: config.proxyPassword }
      : undefined,
  };
}
```

- [ ] **Step 4: Run a live proxy smoke test**

Run:
`set -a; source .env.local; set +a; npx tsx src/features/scrapers/classic_collector/cli.ts --dryRun --maxListings=5 --maxPages=1`

Expected:
- browser launches with proxy settings
- Classic pages load instead of failing immediately
- if Cloudflare still blocks, the run should record a proxy/challenge error rather than pretending success

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/classic_collector/browser.ts src/features/scrapers/classic_collector/cli.ts src/features/scrapers/classic_collector/collector.ts src/features/scrapers/classic_collector/*.test.ts
git commit -m "fix: validate classic proxy browser launch"
```

### Task 7: Harden enrichment and maintenance timing

**Files:**
- Modify: `src/app/api/cron/enrich-elferspot/route.ts`
- Modify: `src/app/api/cron/enrich-details/route.ts`
- Modify: `src/app/api/cron/enrich-vin/route.ts`
- Modify: `src/app/api/cron/enrich-titles/route.ts`
- Modify: `src/app/api/cron/cleanup/route.ts`
- Test: `src/app/api/cron/enrich-elferspot/route.test.ts`
- Test: `src/app/api/cron/enrich-details/route.test.ts`
- Test: `src/app/api/cron/enrich-vin/route.test.ts`
- Test: `src/app/api/cron/enrich-titles/route.test.ts`
- Test: `src/app/api/cron/cleanup/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("stops before the time budget is exhausted and records a partial success", async () => {
  const res = await GET(new Request("http://localhost", { headers: { authorization: "Bearer test-secret" } }));
  const body = await res.json();
  expect(body.duration).toBeDefined();
  expect(body.success).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/enrich-elferspot/route.test.ts src/app/api/cron/enrich-details/route.test.ts src/app/api/cron/enrich-vin/route.test.ts src/app/api/cron/enrich-titles/route.test.ts src/app/api/cron/cleanup/route.test.ts`
Expected: fail where jobs overrun or misreport partial work.

- [ ] **Step 3: Write minimal implementation**

```ts
const TIME_BUDGET_MS = 270_000;
if (Date.now() - startTime > TIME_BUDGET_MS) {
  errors.push(`Time budget reached after ${written} items`);
  break;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/enrich-elferspot/route.test.ts src/app/api/cron/enrich-details/route.test.ts src/app/api/cron/enrich-vin/route.test.ts src/app/api/cron/enrich-titles/route.test.ts src/app/api/cron/cleanup/route.test.ts`
Expected: each job exits cleanly and records partial progress.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/enrich-elferspot/route.ts src/app/api/cron/enrich-details/route.ts src/app/api/cron/enrich-vin/route.ts src/app/api/cron/enrich-titles/route.ts src/app/api/cron/cleanup/route.ts src/app/api/cron/enrich-elferspot/route.test.ts src/app/api/cron/enrich-details/route.test.ts src/app/api/cron/enrich-vin/route.test.ts src/app/api/cron/enrich-titles/route.test.ts src/app/api/cron/cleanup/route.test.ts
git commit -m "fix: tighten enrichment and maintenance budgets"
```

### Task 8: Update the runbook and dashboard wording

**Files:**
- Modify: `docs/scrapers/SCRAPERS.md`
- Modify: `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx`
- Modify: `scripts/scraper-health-audit.ts` if present in this branch
- Test: `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.test.tsx` if the label logic changes

- [ ] **Step 1: Write the failing test**

```ts
it("shows zero-output jobs as degraded", () => {
  const state = renderState({ discovered: 100, written: 0, errorsCount: 0 });
  expect(state.label).toBe("DEGRADED");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/[locale]/admin/scrapers/ScrapersDashboardClient.test.tsx`
Expected: fail until the dashboard and labels reflect the new health contract.

- [ ] **Step 3: Write minimal implementation**

```ts
const label = state === "ZERO_OUTPUT" ? "ZERO OUTPUT" : state;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/[locale]/admin/scrapers/ScrapersDashboardClient.test.tsx`
Expected: dashboard matches the health contract and runbook reflects the real status model.

- [ ] **Step 5: Commit**

```bash
git add docs/scrapers/SCRAPERS.md src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx scripts/scraper-health-audit.ts src/app/[locale]/admin/scrapers/ScrapersDashboardClient.test.tsx
git commit -m "docs: align scraper runbook with live health states"
```

---

## Verification Checklist

- Re-run the targeted Vitest files after each task.
- Re-run the live Supabase audit after the shared data fixes land.
- Run the Classic smoke test with `DECODO_PROXY_*` set from the environment.
- Confirm there are no active rows left in `scraper_active_runs` after each cron pass.
- Confirm zero-output jobs are now reported as degraded or failed, not green.

## Coverage Gaps

- This plan covers every confirmed failure from the last database inspection.
- It does not rewrite the collectors wholesale.
- It does not add dependencies.
- It leaves healthy jobs alone except for hardening and monitoring.

## Notes for Workers

- Use the smallest change that makes the failing test pass.
- Do not “improve” unrelated scraper behavior while fixing a specific contract.
- If a run turns out to be a proxy failure on Classic, fix the proxy launch path before touching selectors.
- Keep the database schema and the writer payloads in sync at all times.

