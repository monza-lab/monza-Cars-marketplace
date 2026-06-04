# Enrichment Automation Loop — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--enrich-loop` flag to `run-scrapers.ts` that repeatedly runs all enrichment scrapers in a loop until data quality targets are met or a max iteration count is reached — eliminating the need to manually re-run enrichment.

**Architecture:** Extends the existing `scripts/run-scrapers.ts` orchestrator with a new `--enrich-loop` flag. After each iteration, a lightweight quality check queries Supabase for remaining gaps per source. The loop exits when all sources meet their fill-rate thresholds or `--max-iterations` is reached. An optional `--pause` flag controls the cooldown between iterations.

**Tech Stack:** TypeScript (tsx), Supabase JS client (already in project), existing scraper infrastructure

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `scripts/enrich-loop-quality.ts` | Quality check: query Supabase for fill-rate gaps per source, return remaining counts and pass/fail per target |
| Modify | `scripts/run-scrapers.ts:322-337` | Add `--enrich-loop`, `--max-iterations=N`, `--pause=N` flags to `CliFlags` and `parseFlags()` |
| Modify | `scripts/run-scrapers.ts:695-766` | Add loop logic in `main()`: after enrichment run, call quality check, decide continue/stop |

---

## Chunk 1: Quality Check Module

### Task 1: Create `scripts/enrich-loop-quality.ts`

This module queries Supabase for the fill-rate of key fields per enrichment source and reports whether quality targets are met.

**Files:**
- Create: `scripts/enrich-loop-quality.ts`

**Quality targets** (derived from current data gaps and enrichment capabilities):

| Source | Field | Target Fill % | Enrichment Scraper |
|--------|-------|--------------|-------------------|
| AutoScout24 | description_text | 90% | as24-enrich |
| AutoScout24 | trim | 90% | as24-enrich |
| AutoTrader | description_text | 90% | cron-autotrader-enrich |
| AutoTrader | images | 95% | cron-autotrader-enrich |
| Classic.com | description_text | 90% | classic-enrich |
| Classic.com | mileage | 80% | classic-enrich |
| Elferspot | description_text | 90% | cron-elferspot-enrich |
| Elferspot | hammer_price | 80% | cron-elferspot-enrich |
| BeForward | images | 95% | cron-beforward-enrich |
| BaT | description_text | 90% | bat-detail |
| ALL | images | 95% | cron-images |
| ALL | engine | 80% | cron-vin, cron-titles |
| ALL | transmission | 80% | cron-vin, cron-titles |

- [ ] **Step 1: Create the quality check module**

```typescript
// scripts/enrich-loop-quality.ts
/**
 * Lightweight quality-gap checker for the enrichment loop.
 * Queries Supabase for fill-rates of key fields per source.
 * Returns which targets are met and which have remaining gaps.
 */
import { createClient } from "@supabase/supabase-js";

export interface QualityTarget {
  source: string;       // "AutoScout24", "ALL", etc.
  field: string;        // column name
  targetPct: number;    // e.g. 90
  label: string;        // display name
}

export interface GapResult {
  target: QualityTarget;
  total: number;
  filled: number;
  fillPct: number;
  remaining: number;
  passed: boolean;
}

export interface QualityCheckResult {
  allPassed: boolean;
  gaps: GapResult[];
  timestamp: string;
}

export const DEFAULT_TARGETS: QualityTarget[] = [
  { source: "AutoScout24", field: "description_text", targetPct: 90, label: "AS24 descriptions" },
  { source: "AutoScout24", field: "trim", targetPct: 90, label: "AS24 trim" },
  { source: "ClassicCom", field: "description_text", targetPct: 90, label: "Classic descriptions" },
  { source: "ClassicCom", field: "mileage", targetPct: 80, label: "Classic mileage" },
  { source: "Elferspot", field: "description_text", targetPct: 90, label: "Elferspot descriptions" },
  { source: "Elferspot", field: "hammer_price", targetPct: 80, label: "Elferspot prices" },
  { source: "BeForward", field: "images", targetPct: 95, label: "BeForward images" },
  { source: "BringATrailer", field: "description_text", targetPct: 90, label: "BaT descriptions" },
  { source: "AutoTrader", field: "description_text", targetPct: 90, label: "AT descriptions" },
  { source: "AutoTrader", field: "images", targetPct: 95, label: "AT images" },
  { source: "ALL", field: "images", targetPct: 95, label: "All images" },
  { source: "ALL", field: "engine", targetPct: 80, label: "All engine" },
  { source: "ALL", field: "transmission", targetPct: 80, label: "All transmission" },
];

/**
 * Count rows where a field is filled vs total, for a given source filter.
 * Only checks active listings (status = 'active').
 */
async function countFillRate(
  sb: ReturnType<typeof createClient>,
  source: string,
  field: string
): Promise<{ total: number; filled: number }> {
  // Get total active count for source
  let totalQuery = sb
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (source !== "ALL") totalQuery = totalQuery.eq("source", source);
  const { count: total } = await totalQuery;

  // Get filled count — depends on field type
  let filledQuery = sb
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (source !== "ALL") filledQuery = filledQuery.eq("source", source);

  if (field === "images") {
    // images is TEXT[] (native Postgres array) — empty = "{}"
    filledQuery = filledQuery.not("images", "is", null).neq("images", "{}");
  } else if (["year", "mileage", "hammer_price", "current_bid"].includes(field)) {
    // Numeric fields: just check not null
    filledQuery = filledQuery.not(field, "is", null);
  } else {
    // Text fields: not null and not empty string
    filledQuery = filledQuery.not(field, "is", null).neq(field, "");
  }

  const { count: filled } = await filledQuery;

  return { total: total ?? 0, filled: filled ?? 0 };
}

export async function checkQuality(
  sb: ReturnType<typeof createClient>,
  targets: QualityTarget[] = DEFAULT_TARGETS
): Promise<QualityCheckResult> {
  const gaps: GapResult[] = [];

  for (const target of targets) {
    const { total, filled } = await countFillRate(sb, target.source, target.field);
    const fillPct = total === 0 ? 100 : Math.round((filled / total) * 1000) / 10;
    const remaining = total - filled;
    const passed = fillPct >= target.targetPct;
    gaps.push({ target, total, filled, fillPct, remaining, passed });
  }

  return {
    allPassed: gaps.every((g) => g.passed),
    gaps,
    timestamp: new Date().toISOString(),
  };
}

export function printQualityReport(result: QualityCheckResult): void {
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│                   ENRICHMENT QUALITY CHECK                  │");
  console.log("├──────────────────────┬────────┬────────┬───────┬───────────┤");
  console.log("│ Target               │ Fill % │ Target │  Gap  │  Status   │");
  console.log("├──────────────────────┼────────┼────────┼───────┼───────────┤");

  for (const g of result.gaps) {
    const label = g.target.label.padEnd(20).slice(0, 20);
    const fill = `${g.fillPct.toFixed(1)}%`.padStart(6);
    const tgt = `${g.target.targetPct}%`.padStart(5);
    const gap = String(g.remaining).padStart(5);
    const status = g.passed ? "\x1b[32m  PASS   \x1b[0m" : "\x1b[31m  FAIL   \x1b[0m";
    console.log(`│ ${label} │ ${fill} │  ${tgt} │ ${gap} │${status}│`);
  }

  console.log("├──────────────────────┴────────┴────────┴───────┴───────────┤");
  const overall = result.allPassed
    ? "\x1b[32m ALL TARGETS MET ✓\x1b[0m"
    : "\x1b[33m GAPS REMAINING\x1b[0m";
  console.log(`│ ${overall.padEnd(59)}│`);
  console.log("└─────────────────────────────────────────────────────────────┘");
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsx -e "import { DEFAULT_TARGETS } from './scripts/enrich-loop-quality'; console.log(DEFAULT_TARGETS.length, 'targets loaded')"`
Expected: `11 targets loaded`

- [ ] **Step 3: Commit**

```bash
git add scripts/enrich-loop-quality.ts
git commit -m "feat(scrapers): add enrichment quality check module for loop automation"
```

---

## Chunk 2: Extend run-scrapers.ts with Loop Logic

### Task 2: Add new CLI flags

**Files:**
- Modify: `scripts/run-scrapers.ts:322-337` (CliFlags interface and parseFlags)

- [ ] **Step 1: Add new flags to CliFlags interface**

Add three new fields to the `CliFlags` interface at line 322:

```typescript
interface CliFlags {
  full: boolean;
  discovery: boolean;
  enrichment: boolean;
  dryRun: boolean;
  enrichLoop: boolean;      // NEW
  maxIterations: number;    // NEW — default 10
  pauseMinutes: number;     // NEW — default 2
}
```

- [ ] **Step 2: Update parseFlags() to parse new flags**

```typescript
function parseFlags(): CliFlags {
  const args = process.argv.slice(2);

  // Parse --max-iterations=N (default 10)
  const maxIterMatch = args.find((a) => a.startsWith("--max-iterations="));
  const maxIterations = maxIterMatch ? parseInt(maxIterMatch.split("=")[1], 10) || 10 : 10;

  // Parse --pause=N in minutes (default 2)
  const pauseMatch = args.find((a) => a.startsWith("--pause="));
  const pauseMinutes = pauseMatch ? parseInt(pauseMatch.split("=")[1], 10) || 2 : 2;

  return {
    full: args.includes("--full"),
    discovery: args.includes("--discovery"),
    enrichment: args.includes("--enrichment"),
    dryRun: args.includes("--dry-run"),
    enrichLoop: args.includes("--enrich-loop"),
    maxIterations,
    pauseMinutes,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/run-scrapers.ts
git commit -m "feat(scrapers): add --enrich-loop, --max-iterations, --pause flags"
```

---

### Task 3: Add loop logic to main()

**Files:**
- Modify: `scripts/run-scrapers.ts:695-766` (main function)

The `--enrich-loop` flag triggers this behavior:
1. Select only enrichment-phase scrapers (both CLI and cron)
2. Run all enrichment scrapers sequentially (one iteration)
3. After each iteration, call `checkQuality()` and print the report
4. If all targets pass → exit with success
5. If `maxIterations` reached → exit with summary of remaining gaps
6. Otherwise → wait `pauseMinutes` and run next iteration
7. Each iteration's results are appended to a single combined run log

- [ ] **Step 1: Add import for quality check at top of file**

Add after existing imports (line 14):

```typescript
import { checkQuality, printQualityReport, type QualityCheckResult } from "./enrich-loop-quality";
```

- [ ] **Step 2: Add Supabase client initialization**

Add after the `loadEnvFromFile` calls (around line 42), guarded so it only initializes when needed:

```typescript
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for quality check");
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
```

Also add the import at the top:
```typescript
import { createClient } from "@supabase/supabase-js";
```

- [ ] **Step 3: Replace main() with loop-aware version**

The key changes in `main()`:
- When `--enrich-loop` is set, auto-select enrichment scrapers by explicit ID (excludes `cron-autotrader` discovery and `cron-validate`/`cron-cleanup` maintenance)
- Wrap the execution in a loop with iteration tracking
- After each iteration, run quality check
- Print iteration summary with remaining gaps
- Pause between iterations

```typescript
async function main(): Promise<void> {
  const flags = parseFlags();
  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();

  console.log("Checking dev server on localhost:3000...");
  const devServerUp = await isDevServerUp();

  if (devServerUp) {
    console.log("  Dev server detected.");
  } else {
    console.log("  Dev server not running -- cron routes will be unavailable.");
  }
  console.log("");

  // ── Enrich-loop mode ───────────────────────────────────────────
  if (flags.enrichLoop) {
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║           ENRICHMENT LOOP MODE                         ║");
    console.log(`║  Max iterations: ${String(flags.maxIterations).padEnd(3)}  Pause: ${flags.pauseMinutes}min between runs  ║`);
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    const sb = getSupabaseClient();

    // Pre-loop quality check
    console.log("Running initial quality check...\n");
    const initialCheck = await checkQuality(sb);
    printQualityReport(initialCheck);

    if (initialCheck.allPassed) {
      console.log("\nAll quality targets already met. Nothing to do.");
      process.exit(0);
    }

    // Select only enrichment scrapers by explicit ID.
    // Excludes: cron-autotrader (discovery, would add new incomplete rows),
    //           cron-validate / cron-cleanup (could change listing status mid-loop).
    const ENRICH_IDS = new Set([
      "bat-detail", "classic-enrich", "as24-enrich",           // CLI enrichment
      "cron-autotrader-enrich", "cron-beforward-enrich",       // Cron enrichment
      "cron-elferspot-enrich",
      "cron-vin", "cron-titles", "cron-images",                // Cron maintenance (data-filling only)
    ]);
    const enrichScrapers = SCRAPERS.filter(
      (s) => ENRICH_IDS.has(s.id) && (s.type === "cli" || devServerUp)
    );

    if (enrichScrapers.length === 0) {
      console.error("No enrichment scrapers available. Start dev server for cron routes.");
      process.exit(1);
    }

    console.log(`\nEnrichment scrapers selected (${enrichScrapers.length}):`);
    for (const s of enrichScrapers) {
      console.log(`  - ${s.name} (${s.phase})`);
    }

    const allResults: RunResult[] = [];
    let iteration = 0;
    let previousCheck: QualityCheckResult | null = null;

    while (iteration < flags.maxIterations) {
      iteration++;
      console.log(`\n${"═".repeat(60)}`);
      console.log(`  ITERATION ${iteration} / ${flags.maxIterations}`);
      console.log(`${"═".repeat(60)}\n`);

      const iterResults: RunResult[] = [];

      for (const scraper of enrichScrapers) {
        console.log(`\n=== Running: ${scraper.name} ===\n`);
        const result =
          scraper.type === "cli"
            ? await runCliScraper(scraper, flags.dryRun)
            : await runCronScraper(scraper, flags.dryRun);
        iterResults.push(result);
        console.log(
          `\n>> ${scraper.name}: ${result.status.toUpperCase()} (${formatDuration(result.durationMs)})`
        );
      }

      allResults.push(...iterResults);
      printSummary(iterResults);

      // Quality check after iteration
      console.log("\nChecking quality after iteration...\n");
      const postCheck = await checkQuality(sb);
      printQualityReport(postCheck);

      if (postCheck.allPassed) {
        console.log(`\n✓ All quality targets met after ${iteration} iteration(s)!`);
        break;
      }

      // Count remaining gaps
      const failingGaps = postCheck.gaps.filter((g) => !g.passed);
      console.log(`\n${failingGaps.length} target(s) still below threshold.`);

      // Stall detection: if no improvement since last iteration, stop early
      if (previousCheck) {
        const prevFailing = previousCheck.gaps.filter((g) => !g.passed);
        const improved = failingGaps.length < prevFailing.length ||
          failingGaps.some((g, i) => {
            const prev = prevFailing.find((p) => p.target.label === g.target.label);
            return prev && g.fillPct > prev.fillPct + 0.1;
          });
        if (!improved) {
          console.log("\nNo improvement detected since last iteration — stopping early.");
          break;
        }
      }
      previousCheck = postCheck;

      if (iteration < flags.maxIterations) {
        console.log(`Pausing ${flags.pauseMinutes} minute(s) before next iteration...`);
        await new Promise((resolve) => setTimeout(resolve, flags.pauseMinutes * 60_000));
      }
    }

    // Save combined run log
    const finishedAt = new Date().toISOString();
    const totalMs = allResults.reduce((sum, r) => sum + r.durationMs, 0);

    const finalCheck = await checkQuality(sb);
    const anyGaps = !finalCheck.allPassed;

    const log: RunLog = {
      runId,
      startedAt,
      finishedAt,
      durationMs: totalMs,
      flags,
      devServerUp,
      scrapersSelected: enrichScrapers.map((s) => s.id),
      summary: {
        total: allResults.length,
        ok: allResults.filter((r) => r.status === "ok").length,
        failed: allResults.filter((r) => r.status === "failed").length,
        timeout: allResults.filter((r) => r.status === "timeout").length,
      },
      results: allResults,
      loop: {
        iterations: iteration,
        maxIterations: flags.maxIterations,
        allTargetsMet: !anyGaps,
        pauseMinutes: flags.pauseMinutes,
      },
    };

    const logPath = saveRunLog(log);
    console.log(`\nRun log saved: ${logPath}`);
    console.log(`Total iterations: ${iteration}`);
    console.log(`Total duration: ${formatDuration(totalMs)}`);

    process.exit(anyGaps ? 1 : 0);
  }

  // ── Normal mode (unchanged) ────────────────────────────────────
  const selected = await selectScrapers(flags, devServerUp);

  if (flags.dryRun) {
    console.log("[DRY RUN] Scrapers will skip database writes.\n");
  }

  const results: RunResult[] = [];

  for (const scraper of selected) {
    console.log(`\n=== Running: ${scraper.name} ===\n`);

    const result =
      scraper.type === "cli"
        ? await runCliScraper(scraper, flags.dryRun)
        : await runCronScraper(scraper, flags.dryRun);

    results.push(result);

    console.log(
      `\n>> ${scraper.name}: ${result.status.toUpperCase()} (${formatDuration(result.durationMs)})`
    );
  }

  printSummary(results);

  // Save master log JSON
  const finishedAt = new Date().toISOString();
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  const log: RunLog = {
    runId,
    startedAt,
    finishedAt,
    durationMs: totalMs,
    flags,
    devServerUp,
    scrapersSelected: selected.map((s) => s.id),
    summary: {
      total: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      failed: results.filter((r) => r.status === "failed").length,
      timeout: results.filter((r) => r.status === "timeout").length,
    },
    results,
  };

  const logPath = saveRunLog(log);
  console.log(`\nRun log saved: ${logPath}`);

  const anyFailed = results.some((r) => r.status !== "ok");
  process.exit(anyFailed ? 1 : 0);
}
```

- [ ] **Step 4: Update file header comment with new usage examples**

Update the top-of-file comment block:

```typescript
/**
 * Scraper Runner TUI
 *
 * Interactive multi-select to run scrapers, enrichment jobs, and cron routes.
 *
 * Usage:
 *   npx tsx scripts/run-scrapers.ts          # Interactive TUI
 *   npm run scrapers                          # Same
 *   npx tsx scripts/run-scrapers.ts --full    # Run everything
 *   npx tsx scripts/run-scrapers.ts --discovery --dry-run
 *   npx tsx scripts/run-scrapers.ts --enrich-loop                # Loop until quality targets met (max 10 iterations)
 *   npx tsx scripts/run-scrapers.ts --enrich-loop --max-iterations=20 --pause=5
 */
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsx -e "console.log('syntax ok')" && npx tsx scripts/run-scrapers.ts --help 2>&1 | head -5 || echo "compilation check — no --help flag expected"`

(Since the script doesn't have `--help`, just verify it doesn't crash on import by checking the TUI prompt appears.)

- [ ] **Step 6: Commit**

```bash
git add scripts/run-scrapers.ts
git commit -m "feat(scrapers): implement --enrich-loop with quality-target-based iteration"
```

---

### Task 4: Add npm script shortcut

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Add convenience npm script**

Add to `package.json` scripts:

```json
"scrapers:enrich-loop": "tsx scripts/run-scrapers.ts --enrich-loop"
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat(scrapers): add npm run scrapers:enrich-loop shortcut"
```

---

## Chunk 3: Update RunLog Type for Loop Metadata

### Task 5: Extend RunLog interface with optional loop field

**Files:**
- Modify: `scripts/run-scrapers.ts:663-678` (RunLog interface)

Note: The loop metadata is already populated in the `main()` code from Task 3. This task only adds the type definition.

- [ ] **Step 1: Add optional loop field to RunLog interface**

Add after the `results` field in the `RunLog` interface:

```typescript
  results: RunResult[];
  // Loop metadata (only present in --enrich-loop runs)
  loop?: {
    iterations: number;
    maxIterations: number;
    allTargetsMet: boolean;
    pauseMinutes: number;
  };
```

- [ ] **Step 2: Commit**

```bash
git add scripts/run-scrapers.ts
git commit -m "feat(scrapers): add loop metadata type to RunLog interface"
```

---

## Summary

### Usage

```bash
# Basic: run enrichment loop with defaults (10 iterations, 2min pause)
npm run scrapers:enrich-loop

# Custom: up to 20 iterations, 5min cooldown
npx tsx scripts/run-scrapers.ts --enrich-loop --max-iterations=20 --pause=5

# Dry run: test the loop logic without DB writes
npx tsx scripts/run-scrapers.ts --enrich-loop --dry-run

# Existing commands remain unchanged
npm run scrapers              # Interactive TUI
npm run scrapers -- --full    # Run everything once
```

### Flow Diagram

```
Start
  │
  ▼
Initial quality check ──→ All passed? ──→ Exit (0)
  │ no                         yes
  ▼
┌─────────────────────────────┐
│  ITERATION N                │
│  Run all enrichment scrapers│
│  (CLI + cron routes)        │
│  Print summary table        │
│                             │
│  Quality check              │
│  ├── All passed → Exit (0)  │
│  ├── No improvement → Exit  │
│  ├── Max iterations → Exit  │
│  └── Gaps remain → Pause    │
│       └── Next iteration    │
└─────────────────────────────┘
  │
  ▼
Save combined run log
Exit (0 if all passed, 1 if gaps remain)
```

### Files Changed

| File | Change |
|------|--------|
| `scripts/enrich-loop-quality.ts` | **New** — quality gap checker module |
| `scripts/run-scrapers.ts` | **Modified** — new flags + loop logic in main() |
| `package.json` | **Modified** — npm script shortcut |

### Estimated Throughput Per Iteration

| Scraper | Batch Size | Rate Limit | ~Duration |
|---------|-----------|-----------|-----------|
| bat-detail | 100 | 2.5s | ~4 min |
| classic-enrich | 500 | 2s | ~17 min |
| as24-enrich | 500 | 2s | ~17 min |
| cron-autotrader-enrich | 200×20 | 0ms | ~2 min |
| cron-beforward-enrich | 50 | 4s | ~3 min |
| cron-elferspot-enrich | 50 | 2.5s | ~2 min |
| cron-vin | 500 | 1s batch | ~2 min |
| cron-titles | 1000 | CPU | ~1 min |
| cron-images | varies | varies | ~5 min |
| **Total per iteration** | | | **~53 min** |

With 2-min pause: ~55 min per iteration. At 10 iterations max: ~9 hours worst case. Stall detection exits early if no progress, so typical runs converge in 3-5 iterations (~4-5 hours).

**Note:** `--dry-run` combined with `--enrich-loop` will always stall after iteration 1 (no DB writes = no quality improvement). The stall detector will exit after 2 iterations in this case.
