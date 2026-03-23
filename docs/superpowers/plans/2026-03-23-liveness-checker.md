# Liveness Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily GitHub Actions job that verifies source URLs of active dealer/classified listings and marks dead ones as `unsold`, plus supporting changes (schema, monitoring, cleanup improvements).

**Architecture:** A new `liveness_checker` module under `src/features/scrapers/` processes all 5 dealer sources in parallel, each with its own rate-limited async loop. The checker queries a FIFO queue ordered by `last_verified_at ASC NULLS FIRST`, fetches each URL, and updates status based on HTTP response. All collectors and enrichments also update `last_verified_at` on successful upsert/fetch.

**Tech Stack:** TypeScript, Node.js `fetch`, Supabase client, Vitest, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-23-liveness-checker-design.md`

**Note:** Dashboard Data Quality UI enhancements are out of scope per spec ("Data quality dashboard enhancements beyond basic liveness metrics" listed as out of scope). The liveness checker will appear automatically in the monitoring dashboard as a new scraper card via `scraper_runs` registration. Custom liveness coverage queries can be added as a follow-up.

---

### Task 1: Register `liveness-check` in monitoring types

**Files:**
- Modify: `src/features/scrapers/common/monitoring/types.ts:1`

- [ ] **Step 1: Add `'liveness-check'` to the ScraperName union**

In `src/features/scrapers/common/monitoring/types.ts`, line 1, add `'liveness-check'` to the end of the union:

```typescript
export type ScraperName = 'porsche' | 'ferrari' | 'autotrader' | 'beforward' | 'classic' | 'autoscout24' | 'elferspot' | 'backfill-images' | 'enrich-vin' | 'enrich-titles' | 'enrich-details' | 'enrich-autotrader' | 'enrich-beforward' | 'enrich-elferspot' | 'enrich-details-bulk' | 'bat-detail' | 'validate' | 'cleanup' | 'liveness-check';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors related to ScraperName

- [ ] **Step 3: Commit**

```bash
git add src/features/scrapers/common/monitoring/types.ts
git commit -m "feat(monitoring): add liveness-check to ScraperName union"
```

---

### Task 2: Create sourceConfig.ts — per-source configuration

**Files:**
- Create: `src/features/scrapers/liveness_checker/sourceConfig.ts`

- [ ] **Step 1: Create the source config file**

```typescript
/**
 * Per-source configuration for the liveness checker.
 * Each source gets its own async loop running in parallel.
 */

export interface SourceConfig {
  /** Source name as stored in listings.source */
  source: string;
  /** Delay between requests in ms */
  delayMs: number;
  /** Max listings to check per run (bounded by time budget) */
  maxPerRun: number;
  /** Custom User-Agent header (defaults to CHROME_UA) */
  userAgent?: string;
  /** Custom request headers */
  headers?: Record<string, string>;
}

/**
 * Chrome-like User-Agent to avoid bot detection.
 * Same UA used by backfillImages.ts.
 */
export const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/** Sources excluded from liveness checks (handled by end_time expiry) */
export const EXCLUDED_SOURCES = ["BaT", "CarsAndBids", "CollectingCars"];

/**
 * Dealer/classified sources to check.
 * Delays respect each site's robots.txt crawl-delay where known.
 */
export const SOURCE_CONFIGS: SourceConfig[] = [
  { source: "AutoScout24",  delayMs: 2_000,  maxPerRun: 1_650 },
  { source: "Elferspot",    delayMs: 10_000, maxPerRun: 330 },
  { source: "AutoTrader",   delayMs: 2_000,  maxPerRun: 1_650 },
  { source: "BeForward",    delayMs: 2_500,  maxPerRun: 1_320 },
  { source: "ClassicCom",   delayMs: 3_000,  maxPerRun: 1_100 },
];

/** Circuit breaker: stop a source after this many consecutive failures */
export const CIRCUIT_BREAK_THRESHOLD = 3;

/** Default time budget in ms (55 minutes, leaving 5 min buffer for GH Actions 60 min timeout) */
export const DEFAULT_TIME_BUDGET_MS = 55 * 60 * 1_000;

/** HTTP request timeout per URL in ms */
export const REQUEST_TIMEOUT_MS = 15_000;
```

- [ ] **Step 2: Commit**

```bash
git add src/features/scrapers/liveness_checker/sourceConfig.ts
git commit -m "feat(liveness): add per-source configuration"
```

---

### Task 3: Create index.ts — core liveness checker logic

**Files:**
- Create: `src/features/scrapers/liveness_checker/index.ts`
- Test: `src/features/scrapers/liveness_checker/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/scrapers/liveness_checker/index.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockIs = vi.fn();
const mockNotIn = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { checkSource, type LivenessResult } from "./index";

describe("checkSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Chain: select → eq → notIn → is → order → limit
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ not: vi.fn().mockReturnValue({ is: mockIs }) });
    mockIs.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [], error: null });

    // Chain: update → eq
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });

  it("marks listing as unsold when source returns 404", async () => {
    const listing = {
      id: "test-123",
      source: "AutoScout24",
      source_url: "https://autoscout24.com/listing/123",
    };
    mockLimit.mockResolvedValue({ data: [listing], error: null });
    mockFetch.mockResolvedValue({ status: 404, ok: false });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await checkSource({
      source: "AutoScout24",
      delayMs: 0,
      maxPerRun: 10,
      timeBudgetMs: 60_000,
      dryRun: false,
    });

    expect(result.dead).toBe(1);
    expect(result.alive).toBe(0);
    expect(mockFrom).toHaveBeenCalledWith("listings");
  });

  it("marks listing as alive when source returns 200", async () => {
    const listing = {
      id: "test-456",
      source: "Elferspot",
      source_url: "https://elferspot.com/listing/456",
    };
    mockLimit.mockResolvedValue({ data: [listing], error: null });
    mockFetch.mockResolvedValue({ status: 200, ok: true });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await checkSource({
      source: "Elferspot",
      delayMs: 0,
      maxPerRun: 10,
      timeBudgetMs: 60_000,
      dryRun: false,
    });

    expect(result.alive).toBe(1);
    expect(result.dead).toBe(0);
  });

  it("circuit-breaks after 3 consecutive 403s", async () => {
    const listings = [
      { id: "a", source: "AutoScout24", source_url: "https://as24.com/1" },
      { id: "b", source: "AutoScout24", source_url: "https://as24.com/2" },
      { id: "c", source: "AutoScout24", source_url: "https://as24.com/3" },
      { id: "d", source: "AutoScout24", source_url: "https://as24.com/4" },
    ];
    mockLimit.mockResolvedValue({ data: listings, error: null });
    mockFetch.mockResolvedValue({ status: 403, ok: false });

    const result = await checkSource({
      source: "AutoScout24",
      delayMs: 0,
      maxPerRun: 10,
      timeBudgetMs: 60_000,
      dryRun: false,
    });

    // Should stop after 3, not check the 4th
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.circuitBroken).toBe(true);
  });

  it("marks listing as unsold when source returns 410 Gone", async () => {
    const listing = {
      id: "test-410",
      source: "AutoScout24",
      source_url: "https://autoscout24.com/listing/410",
    };
    mockLimit.mockResolvedValue({ data: [listing], error: null });
    mockFetch.mockResolvedValue({ status: 410, ok: false });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await checkSource({
      source: "AutoScout24",
      delayMs: 0,
      maxPerRun: 10,
      timeBudgetMs: 60_000,
      dryRun: false,
    });

    expect(result.dead).toBe(1);
    expect(result.alive).toBe(0);
  });

  it("skips DB writes in dry run mode", async () => {
    const listing = {
      id: "test-789",
      source: "Elferspot",
      source_url: "https://elferspot.com/789",
    };
    mockLimit.mockResolvedValue({ data: [listing], error: null });
    mockFetch.mockResolvedValue({ status: 404, ok: false });

    const result = await checkSource({
      source: "Elferspot",
      delayMs: 0,
      maxPerRun: 10,
      timeBudgetMs: 60_000,
      dryRun: true,
    });

    expect(result.dead).toBe(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/liveness_checker/index.test.ts`
Expected: FAIL — module `./index` not found

- [ ] **Step 3: Write the implementation**

Create `src/features/scrapers/liveness_checker/index.ts`:

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CHROME_UA,
  EXCLUDED_SOURCES,
  SOURCE_CONFIGS,
  CIRCUIT_BREAK_THRESHOLD,
  DEFAULT_TIME_BUDGET_MS,
  REQUEST_TIMEOUT_MS,
  type SourceConfig,
} from "./sourceConfig";

export interface LivenessResult {
  source: string;
  checked: number;
  alive: number;
  dead: number;
  errors: string[];
  circuitBroken: boolean;
}

export interface LivenessRunResult {
  results: LivenessResult[];
  totalChecked: number;
  totalDead: number;
  totalAlive: number;
  durationMs: number;
}

interface CheckSourceOpts {
  source: string;
  delayMs: number;
  maxPerRun: number;
  timeBudgetMs: number;
  dryRun: boolean;
  delayOverrideMs?: number;
}

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Check a single source's listings for liveness.
 * Returns results for that source.
 */
export async function checkSource(opts: CheckSourceOpts): Promise<LivenessResult> {
  const client = getClient();
  const startTime = Date.now();
  const result: LivenessResult = {
    source: opts.source,
    checked: 0,
    alive: 0,
    dead: 0,
    errors: [],
    circuitBroken: false,
  };

  // Query listings needing verification for this source
  const { data: listings, error: queryErr } = await client
    .from("listings")
    .select("id, source, source_url")
    .eq("source", opts.source)
    .eq("status", "active")
    .not("source_url", "is", null)
    .order("last_verified_at", { ascending: true, nullsFirst: true })
    .limit(opts.maxPerRun);

  if (queryErr) {
    result.errors.push(`Query failed: ${queryErr.message}`);
    return result;
  }
  if (!listings || listings.length === 0) return result;

  let consecutiveBlocks = 0;

  for (const listing of listings) {
    // Time budget check
    if (Date.now() - startTime >= opts.timeBudgetMs) {
      console.log(`[liveness] ${opts.source}: time budget reached after ${result.checked} checks`);
      break;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(listing.source_url, {
        method: "GET",
        headers: { "User-Agent": CHROME_UA },
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      result.checked++;

      if (response.status === 404 || response.status === 410) {
        // Dead URL — mark as unsold
        result.dead++;
        consecutiveBlocks = 0;
        if (!opts.dryRun) {
          await client
            .from("listings")
            .update({
              status: "unsold",
              last_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", listing.id);
        }
        console.log(`[liveness] ${opts.source}: DEAD ${listing.source_url}`);
      } else if (response.status === 403 || response.status === 429 || response.status === 503) {
        // Possible block — increment circuit breaker
        consecutiveBlocks++;
        result.errors.push(`${response.status} on ${listing.source_url}`);
        if (consecutiveBlocks >= CIRCUIT_BREAK_THRESHOLD) {
          result.circuitBroken = true;
          result.errors.push(`Circuit break: ${CIRCUIT_BREAK_THRESHOLD} consecutive ${response.status}s`);
          console.log(`[liveness] ${opts.source}: CIRCUIT BREAK after ${consecutiveBlocks} blocks`);
          break;
        }
      } else if (response.ok) {
        // Alive — update last_verified_at
        result.alive++;
        consecutiveBlocks = 0;
        if (!opts.dryRun) {
          await client
            .from("listings")
            .update({ last_verified_at: new Date().toISOString() })
            .eq("id", listing.id);
        }
      } else {
        // Unexpected status — skip, don't touch listing
        consecutiveBlocks = 0;
        result.errors.push(`Unexpected ${response.status} on ${listing.source_url}`);
      }
    } catch (err) {
      // Network error or timeout — skip, still count as checked
      result.checked++;
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Fetch error (${listing.source_url}): ${msg}`);
      consecutiveBlocks = 0;
    }

    // Rate limit delay (skip on last iteration)
    const delay = opts.delayOverrideMs ?? opts.delayMs;
    if (delay > 0) await sleep(delay);
  }

  return result;
}

/**
 * Run the full liveness check across all configured sources in parallel.
 */
export async function runLivenessCheck(opts: {
  maxListings?: number;
  source?: string;
  delayOverrideMs?: number;
  timeBudgetMs?: number;
  dryRun?: boolean;
}): Promise<LivenessRunResult> {
  const startTime = Date.now();
  const timeBudget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const dryRun = opts.dryRun ?? false;

  // Filter to single source if specified
  const configs = opts.source
    ? SOURCE_CONFIGS.filter((c) => c.source === opts.source)
    : SOURCE_CONFIGS;

  if (configs.length === 0) {
    throw new Error(`Unknown source: ${opts.source}. Valid: ${SOURCE_CONFIGS.map((c) => c.source).join(", ")}`);
  }

  // Run all sources in parallel
  const promises = configs.map((config) =>
    checkSource({
      source: config.source,
      delayMs: config.delayMs,
      maxPerRun: opts.maxListings
        ? Math.ceil(opts.maxListings / configs.length)
        : config.maxPerRun,
      timeBudgetMs: timeBudget,
      dryRun,
      delayOverrideMs: opts.delayOverrideMs,
    })
  );

  const settled = await Promise.allSettled(promises);
  const results: LivenessResult[] = [];

  for (const s of settled) {
    if (s.status === "fulfilled") {
      results.push(s.value);
    } else {
      results.push({
        source: "unknown",
        checked: 0,
        alive: 0,
        dead: 0,
        errors: [s.reason?.message ?? String(s.reason)],
        circuitBroken: false,
      });
    }
  }

  return {
    results,
    totalChecked: results.reduce((s, r) => s + r.checked, 0),
    totalDead: results.reduce((s, r) => s + r.dead, 0),
    totalAlive: results.reduce((s, r) => s + r.alive, 0),
    durationMs: Date.now() - startTime,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/scrapers/liveness_checker/index.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/liveness_checker/index.ts src/features/scrapers/liveness_checker/index.test.ts
git commit -m "feat(liveness): add core checker logic with tests"
```

---

### Task 4: Create cli.ts — CLI entry point

**Files:**
- Create: `src/features/scrapers/liveness_checker/cli.ts`

**Note:** This project uses a custom `parseArgv` + `loadEnvFromFile` pattern (no external arg-parsing dependency). Copy the pattern from `src/features/scrapers/elferspot_collector/cli.ts`.

- [ ] **Step 1: Create the CLI file**

```typescript
import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { runLivenessCheck } from "./index";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "../common/monitoring";

function loadEnvFromFile(relPath: string): void {
  const abs = resolvePath(process.cwd(), relPath);
  if (!existsSync(abs)) return;
  const raw = readFileSync(abs, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function parseArgv(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const trimmed = raw.slice(2);
    const eq = trimmed.indexOf("=");
    if (eq === -1) { out[trimmed] = true; continue; }
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

loadEnvFromFile(".env.local");
loadEnvFromFile(".env");

const args = parseArgv(process.argv.slice(2));

if (args.help) {
  console.log(`
Liveness Checker — verify source URLs of active dealer/classified listings.

Usage:
  npx tsx src/features/scrapers/liveness_checker/cli.ts [flags]

Flags:
  --maxListings=N     Max total listings to check (default: 6000)
  --source=NAME       Check only one source (AutoScout24, Elferspot, AutoTrader, BeForward, ClassicCom)
  --delayMs=N         Override per-source delay (ms)
  --timeBudgetMs=N    Time budget in ms (default: 3300000 = 55 min)
  --dryRun            Skip DB writes
  --help              Show this help
`);
  process.exit(0);
}

async function main() {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  console.log(`[liveness] Starting run ${runId}`);
  const maxListings = Number(args.maxListings) || 6000;
  const timeBudgetMs = Number(args.timeBudgetMs) || 3_300_000;
  const source = typeof args.source === "string" ? args.source : undefined;
  const dryRun = args.dryRun === true;
  const delayMs = args.delayMs ? Number(args.delayMs) : undefined;

  console.log(`[liveness] maxListings=${maxListings} source=${source || "all"} dryRun=${dryRun}`);

  await markScraperRunStarted({
    scraperName: "liveness-check",
    runId,
    startedAt: startedAtIso,
    runtime: "cli",
  });

  try {
    const result = await runLivenessCheck({
      maxListings,
      source,
      delayOverrideMs: delayMs,
      timeBudgetMs,
      dryRun,
    });

    // Print summary
    console.log(`\n[liveness] ── Run complete ──`);
    console.log(`[liveness] Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
    console.log(`[liveness] Checked: ${result.totalChecked} | Alive: ${result.totalAlive} | Dead: ${result.totalDead}`);
    for (const r of result.results) {
      console.log(`[liveness]   ${r.source}: checked=${r.checked} alive=${r.alive} dead=${r.dead}${r.circuitBroken ? " CIRCUIT-BROKEN" : ""}`);
      if (r.errors.length > 0) {
        console.log(`[liveness]     errors: ${r.errors.slice(0, 5).join("; ")}${r.errors.length > 5 ? ` (+${r.errors.length - 5} more)` : ""}`);
      }
    }

    // Build source_counts for monitoring
    const sourceCounts: Record<string, { discovered: number; written: number }> = {};
    for (const r of result.results) {
      sourceCounts[r.source] = { discovered: r.checked, written: r.dead };
    }

    const allErrors = result.results.flatMap((r) => r.errors);

    await recordScraperRun({
      scraper_name: "liveness-check",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "cli",
      duration_ms: Date.now() - startTime,
      discovered: result.totalChecked,
      written: result.totalDead,
      errors_count: allErrors.length,
      refresh_checked: result.totalAlive,
      source_counts: sourceCounts,
      error_messages: allErrors.length > 0 ? allErrors.slice(0, 50) : undefined,
    });

    await clearScraperRunActive("liveness-check");
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[liveness] Fatal error: ${msg}`);

    await recordScraperRun({
      scraper_name: "liveness-check",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "cli",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [msg],
    });

    await clearScraperRunActive("liveness-check");
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "liveness_checker" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/scrapers/liveness_checker/cli.ts
git commit -m "feat(liveness): add CLI entry point with monitoring"
```

---

### Task 5: Create GitHub Actions workflow

**Files:**
- Create: `.github/workflows/liveness-checker.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Liveness Checker (Daily)

on:
  schedule:
    - cron: '30 10 * * *'     # 10:30 UTC daily (after all collectors/enrichments)
  workflow_dispatch:
    inputs:
      max_listings:
        description: 'Max listings to check'
        default: '6000'
      source:
        description: 'Check only one source (AutoScout24, Elferspot, AutoTrader, BeForward, ClassicCom)'
        default: ''
      dry_run:
        description: 'Skip DB writes'
        default: 'false'

concurrency:
  group: liveness-checker
  cancel-in-progress: false

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

      - name: Run liveness checker
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          npx tsx src/features/scrapers/liveness_checker/cli.ts \
            --maxListings=${{ github.event.inputs.max_listings || '6000' }} \
            ${{ github.event.inputs.source && format('--source={0}', github.event.inputs.source) || '' }} \
            ${{ github.event.inputs.dry_run == 'true' && '--dryRun' || '' }}
```

- [ ] **Step 2: Validate YAML syntax**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/liveness-checker.yml','utf8'); try{require('yaml').parse(y);console.log('Valid YAML')}catch(e){console.error(e.message)}"`

If `yaml` is not installed, run: `npx yaml-lint .github/workflows/liveness-checker.yml` or simply check manually.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/liveness-checker.yml
git commit -m "ci(liveness): add daily GitHub Actions workflow"
```

---

### Task 6: Remove `__dead_url__` sentinel from backfillImages

**Files:**
- Modify: `src/features/scrapers/common/backfillImages.ts:146-156`
- Test: `src/features/scrapers/common/backfillImages.test.ts` (update existing test)

- [ ] **Step 1: Update the existing test expectation**

In `src/features/scrapers/common/backfillImages.test.ts`, find the test `"marks dead URLs as unsold when source returns 404"` and update the assertion. Change:

```typescript
expect(mockUpdate).toHaveBeenCalledWith(
  expect.objectContaining({ images: ["__dead_url__"], status: "unsold" })
)
```

To:

```typescript
expect(mockUpdate).toHaveBeenCalledWith(
  expect.objectContaining({ status: "unsold" })
)
// Verify __dead_url__ sentinel is NOT set
expect(mockUpdate).not.toHaveBeenCalledWith(
  expect.objectContaining({ images: ["__dead_url__"] })
)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts`
Expected: FAIL — the current code still sets `images: ["__dead_url__"]`

- [ ] **Step 3: Remove the sentinel from the update**

In `src/features/scrapers/common/backfillImages.ts`, lines 148-155, change:

```typescript
          await client
            .from("listings")
            .update({
              images: ["__dead_url__"],
              status: "unsold",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
```

To:

```typescript
          await client
            .from("listings")
            .update({
              status: "unsold",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/backfillImages.ts src/features/scrapers/common/backfillImages.test.ts
git commit -m "fix(backfill): remove __dead_url__ sentinel, mark unsold directly"
```

---

### Task 7: Update cleanup cron — remove dead_url step, reduce staleness to 30d

**Files:**
- Modify: `src/app/api/cron/cleanup/route.ts:185-215`

- [ ] **Step 1: Remove Step 1c (dead URL cleanup)**

In `src/app/api/cron/cleanup/route.ts`, delete lines 185-202 (the entire Step 1c block):

```typescript
    // ── Step 1c: Mark __dead_url__ listings as unsold ──
    // ... through to ...
    const deadUrlFixedCount = deadUrlFixed?.length ?? 0;
    if (deadUrlFixedCount > 0) {
      console.log(`[cron/cleanup] Marked ${deadUrlFixedCount} dead-URL listings as unsold`);
    }
```

Also remove **all** references to `deadUrlFixedCount` throughout the file. There are 7+ occurrences:

- **Line 277**: `if (deadUrlFixedCount > 0) earlyMessages.push(...)` → delete this line
- **Line 289**: `written: totalStaleFixed + reclassified + deadUrlFixedCount + staleDealerCount` → remove `+ deadUrlFixedCount`
- **Line 292**: `refresh_updated: totalStaleFixed + deadUrlFixedCount + staleDealerCount` → remove `+ deadUrlFixedCount`
- **Line 303**: `deadUrlFixed: deadUrlFixedCount` → delete this line from the response JSON
- **Line 344**: `if (deadUrlFixedCount > 0) allMessages.push(...)` → delete this line
- **Line 360**: `written: totalStaleFixed + reclassified + deadUrlFixedCount + staleDealerCount` → remove `+ deadUrlFixedCount`
- **Line 362**: `refresh_updated: totalStaleFixed + deadUrlFixedCount + staleDealerCount` → remove `+ deadUrlFixedCount`
- **Line 376**: `deadUrlFixed: deadUrlFixedCount` → delete this line from the response JSON

After removing the Step 1c block and the variable declaration, a simple search for `deadUrl` in the file should find zero results. If TypeScript complains about undefined `deadUrlFixedCount`, you missed one.

- [ ] **Step 2: Change 90-day threshold to 30 days**

In the same file, line 207, change:

```typescript
    const cutoff90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
```

To:

```typescript
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
```

And update the query that uses it (line 214) from `cutoff90d` to `cutoff30d`. Update the log message accordingly.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "cleanup" | head -5`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/cleanup/route.ts
git commit -m "fix(cleanup): remove __dead_url__ step, reduce staleness 90d→30d"
```

---

### Task 8: Add `last_verified_at` to all collector upserts

**Files:**
- Modify: `src/features/scrapers/elferspot_collector/supabase_writer.ts:42`
- Modify: `src/features/scrapers/porsche_collector/supabase_writer.ts` (same pattern)
- Modify: `src/features/scrapers/ferrari_collector/supabase_writer.ts` (same pattern)
- Modify: `src/features/scrapers/autoscout24_collector/supabase_writer.ts` (same pattern)
- Modify: `src/features/scrapers/classic_collector/supabase_writer.ts` (same pattern)
- Modify: `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts` (same pattern)
- Modify: `src/features/scrapers/autotrader_collector/supabase_writer.ts` (same pattern)

- [ ] **Step 1: Add `last_verified_at` to each collector's upsert row**

In each of the 7 `supabase_writer.ts` files, find the `row` object that is passed to `.upsert()` and add `last_verified_at` next to `updated_at`. Example for Elferspot (`supabase_writer.ts:42`):

Change:
```typescript
    updated_at: new Date().toISOString(),
```

To:
```typescript
    updated_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
```

Repeat for all 7 files. The exact line varies per file, but the pattern is the same — find `updated_at: new Date().toISOString()` inside the upsert row object and add `last_verified_at` right after it.

**Files and their `updated_at` locations:**
- `src/features/scrapers/elferspot_collector/supabase_writer.ts` — line 42
- `src/features/scrapers/porsche_collector/supabase_writer.ts` — find `updated_at` in the row object
- `src/features/scrapers/ferrari_collector/supabase_writer.ts` — find `updated_at` in the row object
- `src/features/scrapers/autoscout24_collector/supabase_writer.ts` — find `updated_at` in the row object
- `src/features/scrapers/classic_collector/supabase_writer.ts` — find `updated_at` in the row object
- `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts` — find `updated_at` in the row object
- `src/features/scrapers/autotrader_collector/supabase_writer.ts` — find `updated_at` in the row object

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "supabase_writer" | head -10`
Expected: No errors (Supabase upsert accepts arbitrary fields)

- [ ] **Step 3: Commit**

```bash
git add \
  src/features/scrapers/elferspot_collector/supabase_writer.ts \
  src/features/scrapers/porsche_collector/supabase_writer.ts \
  src/features/scrapers/ferrari_collector/supabase_writer.ts \
  src/features/scrapers/autoscout24_collector/supabase_writer.ts \
  src/features/scrapers/classic_collector/supabase_writer.ts \
  src/features/scrapers/beforward_porsche_collector/supabase_writer.ts \
  src/features/scrapers/autotrader_collector/supabase_writer.ts
git commit -m "feat(collectors): add last_verified_at to all upserts"
```

---

### Task 9: Add `last_verified_at` to enrichment crons

**Files:**
- Modify: `src/app/api/cron/enrich-details/route.ts`
- Modify: `src/app/api/cron/enrich-elferspot/route.ts`
- Modify: `src/app/api/cron/enrich-beforward/route.ts`

- [ ] **Step 1: Add `last_verified_at` to each enrichment's successful update**

Each enrichment route has multiple `.update()` calls. Only modify the **main enrichment update** (the one that writes extracted detail fields after a successful fetch). Do NOT modify the 404/410 handler or the "no new fields" fallback update.

**`enrich-elferspot/route.ts`**: Find the update call around line 124 that sets multiple enriched fields (hammer_price, mileage, transmission, etc.). Add `last_verified_at: new Date().toISOString()` to that update object. There are 3 update calls in this file — only modify the one that runs when `newFieldCount > 0`.

**`enrich-details/route.ts`**: Same pattern — find the main update that writes trim, transmission, body_style, etc. after successful `parseDetailHtml()`. Add `last_verified_at` there.

**`enrich-beforward/route.ts`**: Same pattern — find the main enrichment update after successful detail page fetch. Add `last_verified_at` there.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "enrich" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add \
  src/app/api/cron/enrich-details/route.ts \
  src/app/api/cron/enrich-elferspot/route.ts \
  src/app/api/cron/enrich-beforward/route.ts
git commit -m "feat(enrichment): add last_verified_at on successful fetch"
```

---

### Task 10: Apply DB migration

**Files:**
- Manual: Run SQL against Supabase

- [ ] **Step 1: Run the schema migration**

In the Supabase SQL editor (Dashboard → SQL Editor), run:

```sql
-- Add last_verified_at column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ DEFAULT NULL;

-- Create partial index for liveness queue
CREATE INDEX IF NOT EXISTS idx_listings_liveness_queue
ON listings (last_verified_at ASC NULLS FIRST)
WHERE status = 'active';
```

- [ ] **Step 2: Run the data cleanup migration**

```sql
-- Clean up any existing __dead_url__ sentinels (uses JSONB containment operator)
UPDATE listings
SET status = 'unsold', images = '[]'::jsonb
WHERE images @> '["__dead_url__"]'::jsonb AND status = 'active';
```

- [ ] **Step 3: Verify**

```sql
-- Confirm column exists
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'listings' AND column_name = 'last_verified_at';

-- Confirm no __dead_url__ sentinels remain (active)
SELECT COUNT(*) FROM listings WHERE images @> '["__dead_url__"]'::jsonb AND status = 'active';
-- Expected: 0
```

---

### Task 11: Update SCRAPERS.md documentation

**Files:**
- Modify: `docs/scrapers/SCRAPERS.md`

- [ ] **Step 1: Add Liveness Checker section**

Add a new section `## 16. Liveness Checker` after section 15 (Elferspot Enrichment) with:
- What it does
- Source directory
- CLI flags table
- Automated schedule (GitHub Actions at 10:30 UTC)
- How to trigger manually on GitHub

- [ ] **Step 2: Update the Daily Schedule Summary**

Add the liveness checker to the schedule at 10:30 UTC. Update the staleness note from 90d to 30d.

- [ ] **Step 3: Commit**

```bash
git add docs/scrapers/SCRAPERS.md
git commit -m "docs(scrapers): add Liveness Checker to SCRAPERS.md"
```

---

### Task 12: End-to-end dry run test

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run src/features/scrapers/liveness_checker/ src/features/scrapers/common/backfillImages.test.ts`
Expected: All tests PASS

- [ ] **Step 2: Run a local dry run**

Run: `npx tsx src/features/scrapers/liveness_checker/cli.ts --dryRun --maxListings=5 --source=Elferspot --delayMs=1000`

Expected: Fetches 5 Elferspot URLs, prints status for each, no DB writes. Output should show:
```
[liveness] Starting run <uuid>
[liveness] maxListings=5 source=Elferspot dryRun=true
...
[liveness] ── Run complete ──
[liveness] Checked: 5 | Alive: X | Dead: Y
```

- [ ] **Step 3: Final commit with all changes**

If any fixes were needed during dry run, commit them:
```bash
git add -A
git commit -m "fix(liveness): fixes from dry run testing"
```
