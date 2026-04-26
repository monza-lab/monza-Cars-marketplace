# Scraper Runner TUI — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an interactive TUI script that lets the user select and run any combination of scrapers, enrichment jobs, cron routes, and maintenance tasks from a single `npm run scrapers` command.

**Architecture:** Single TypeScript file (`scripts/run-scrapers.ts`) using `prompts` for checkbox multi-select. Scraper definitions are a const array. Execution is serial via `child_process.spawn` (CLI scrapers) or `fetch` (cron routes). Summary table printed at the end.

**Tech Stack:** TypeScript, `prompts` (npm), `child_process.spawn`, `fetch`

**Spec:** `docs/superpowers/specs/2026-04-21-scraper-runner-tui-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/run-scrapers.ts` | Create | The entire TUI: definitions, CLI parsing, TUI prompt, execution loop, summary |
| `package.json` | Modify | Add `"scrapers"` script |
| `run_all_scrapers.ps1` | Delete | Replaced by this script |

---

## Chunk 1: Setup and Scraper Definitions

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install prompts**

```bash
npm install prompts
npm install -D @types/prompts
```

- [ ] **Step 2: Add npm script**

In `package.json`, add to `"scripts"`:

```json
"scrapers": "tsx scripts/run-scrapers.ts"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add prompts dependency and scrapers npm script"
```

---

### Task 2: Create script with scraper definitions and env loading

**Files:**
- Create: `scripts/run-scrapers.ts`

- [ ] **Step 1: Create the file with imports, env loading, types, and scraper definitions**

```ts
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
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import prompts from "prompts";

// ── Env loading (same pattern as other scripts) ─────────────────────

function loadEnvFromFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFromFile(path.resolve(process.cwd(), ".env"));

// ── Types ───────────────────────────────────────────────────────────

type Phase =
  | "discovery"
  | "enrichment"
  | "cron-enrichment"
  | "cron-maintenance"
  | "post-run";

interface ScraperDef {
  id: string;
  name: string;
  description: string;
  phase: Phase;
  type: "cli" | "cron";
  command?: string;
  args?: string[];
  dryRunFlag?: string;
  cronRoute?: string;
  defaultSelected: boolean;
  timeoutMs: number;
}

// ── Scraper definitions ─────────────────────────────────────────────

const SCRAPERS: ScraperDef[] = [
  // Discovery (CLI)
  {
    id: "porsche",
    name: "Porsche Collector",
    description: "BaT, C&B, CollectingCars",
    phase: "discovery",
    type: "cli",
    command: "npx",
    args: ["tsx", "src/features/scrapers/porsche_collector/cli.ts", "--mode=daily"],
    dryRunFlag: "--dryRun",
    defaultSelected: true,
    timeoutMs: 10 * 60_000,
  },
  {
    id: "ferrari",
    name: "Ferrari Collector",
    description: "BaT, C&B, CollectingCars",
    phase: "discovery",
    type: "cli",
    command: "npx",
    args: ["tsx", "src/features/scrapers/ferrari_collector/cli.ts", "--mode=daily"],
    dryRunFlag: "--dryRun",
    defaultSelected: true,
    timeoutMs: 10 * 60_000,
  },
  {
    id: "beforward",
    name: "BeForward Collector",
    description: "summary-only, 10 pages",
    phase: "discovery",
    type: "cli",
    command: "npx",
    args: [
      "tsx",
      "src/features/scrapers/beforward_porsche_collector/cli.ts",
      "--summaryOnly",
      "--maxPages=10",
    ],
    dryRunFlag: "--dryRun",
    defaultSelected: true,
    timeoutMs: 10 * 60_000,
  },
  {
    id: "classic",
    name: "Classic.com Collector",
    description: "Scrapling, 20 pages",
    phase: "discovery",
    type: "cli",
    command: "npx",
    args: ["tsx", "src/features/scrapers/classic_collector/cli.ts", "--maxPages=20"],
    dryRunFlag: "--dryRun",
    defaultSelected: true,
    timeoutMs: 30 * 60_000,
  },
  {
    id: "as24",
    name: "AutoScout24 Collector",
    description: "Scrapling, 7000 listings",
    phase: "discovery",
    type: "cli",
    command: "npx",
    args: [
      "tsx",
      "src/features/scrapers/autoscout24_collector/cli.ts",
      "--maxListings=7000",
    ],
    dryRunFlag: "--dryRun",
    defaultSelected: true,
    timeoutMs: 30 * 60_000,
  },
  {
    id: "elferspot",
    name: "Elferspot Collector",
    description: "100 pages",
    phase: "discovery",
    type: "cli",
    command: "npx",
    args: ["tsx", "src/features/scrapers/elferspot_collector/cli.ts", "--maxPages=100"],
    dryRunFlag: "--dryRun",
    defaultSelected: true,
    timeoutMs: 30 * 60_000,
  },

  // Enrichment (CLI)
  {
    id: "bat-detail",
    name: "BaT Detail Scraper",
    description: "100 listings, 30 min",
    phase: "enrichment",
    type: "cli",
    command: "npx",
    args: [
      "tsx",
      "scripts/bat-detail-scraper.ts",
      "--limit=100",
      "--timeBudgetMs=1800000",
    ],
    dryRunFlag: "--dryRun",
    defaultSelected: false,
    timeoutMs: 30 * 60_000,
  },
  {
    id: "classic-enrich",
    name: "Classic.com Scrapling Enrichment",
    description: "500 listings",
    phase: "enrichment",
    type: "cli",
    command: "npx",
    args: ["tsx", "scripts/classic-enrich-scrapling.ts", "--limit=500"],
    dryRunFlag: "--dryRun",
    defaultSelected: false,
    timeoutMs: 25 * 60_000,
  },
  {
    id: "as24-enrich",
    name: "AS24 Scrapling Enrichment",
    description: "500 listings",
    phase: "enrichment",
    type: "cli",
    command: "npx",
    args: ["tsx", "scripts/as24-enrich-scrapling.ts", "--limit=500"],
    dryRunFlag: "--dryRun",
    defaultSelected: false,
    timeoutMs: 25 * 60_000,
  },

  // Cron: Discovery & Enrichment (HTTP)
  {
    id: "cron-autotrader",
    name: "AutoTrader Discovery",
    description: "cron route",
    phase: "cron-enrichment",
    type: "cron",
    cronRoute: "/api/cron/autotrader",
    defaultSelected: false,
    timeoutMs: 5 * 60_000,
  },
  {
    id: "cron-autotrader-enrich",
    name: "AutoTrader Enrichment",
    description: "cron route",
    phase: "cron-enrichment",
    type: "cron",
    cronRoute: "/api/cron/enrich-autotrader",
    defaultSelected: false,
    timeoutMs: 5 * 60_000,
  },
  {
    id: "cron-beforward-enrich",
    name: "BeForward Enrichment",
    description: "cron route",
    phase: "cron-enrichment",
    type: "cron",
    cronRoute: "/api/cron/enrich-beforward",
    defaultSelected: false,
    timeoutMs: 5 * 60_000,
  },
  {
    id: "cron-elferspot-enrich",
    name: "Elferspot Enrichment",
    description: "cron route",
    phase: "cron-enrichment",
    type: "cron",
    cronRoute: "/api/cron/enrich-elferspot",
    defaultSelected: false,
    timeoutMs: 5 * 60_000,
  },

  // Cron: Maintenance (HTTP)
  {
    id: "cron-validate",
    name: "Listing Validator",
    description: "cron route",
    phase: "cron-maintenance",
    type: "cron",
    cronRoute: "/api/cron/validate",
    defaultSelected: false,
    timeoutMs: 2 * 60_000,
  },
  {
    id: "cron-cleanup",
    name: "Cleanup",
    description: "cron route",
    phase: "cron-maintenance",
    type: "cron",
    cronRoute: "/api/cron/cleanup",
    defaultSelected: false,
    timeoutMs: 2 * 60_000,
  },
  {
    id: "cron-vin",
    name: "VIN Enrichment",
    description: "cron route",
    phase: "cron-maintenance",
    type: "cron",
    cronRoute: "/api/cron/enrich-vin",
    defaultSelected: false,
    timeoutMs: 2 * 60_000,
  },
  {
    id: "cron-titles",
    name: "Title Enrichment",
    description: "cron route",
    phase: "cron-maintenance",
    type: "cron",
    cronRoute: "/api/cron/enrich-titles",
    defaultSelected: false,
    timeoutMs: 2 * 60_000,
  },
  {
    id: "cron-images",
    name: "Image Backfill",
    description: "cross-source, cron route",
    phase: "cron-maintenance",
    type: "cron",
    cronRoute: "/api/cron/backfill-images",
    defaultSelected: false,
    timeoutMs: 5 * 60_000,
  },

  // Post-run (CLI)
  {
    id: "liveness",
    name: "Liveness Checker",
    description: "100 listings, sample",
    phase: "post-run",
    type: "cli",
    command: "npx",
    args: [
      "tsx",
      "src/features/scrapers/liveness_checker/cli.ts",
      "--maxListings=100",
    ],
    dryRunFlag: "--dryRun",
    defaultSelected: false,
    timeoutMs: 10 * 60_000,
  },
  {
    id: "health-audit",
    name: "Scraper Health Audit",
    description: "last 3 days",
    phase: "post-run",
    type: "cli",
    command: "npx",
    args: ["tsx", "scripts/scraper-health-audit.ts", "--days=3"],
    defaultSelected: false,
    timeoutMs: 1 * 60_000,
  },
];
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsx --eval "import './scripts/run-scrapers.ts'"
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/run-scrapers.ts
git commit -m "feat(runner): add scraper definitions and types"
```

---

## Chunk 2: CLI Parsing, Dev Server Detection, and TUI

### Task 3: Add CLI flag parsing and dev server detection

**Files:**
- Modify: `scripts/run-scrapers.ts`

- [ ] **Step 1: Add CLI parsing and dev server check functions**

Append after the `SCRAPERS` array:

```ts
// ── CLI flag parsing ────────────────────────────────────────────────

interface CliFlags {
  full: boolean;
  discovery: boolean;
  enrichment: boolean;
  dryRun: boolean;
}

function parseFlags(): CliFlags {
  const args = process.argv.slice(2);
  return {
    full: args.includes("--full"),
    discovery: args.includes("--discovery"),
    enrichment: args.includes("--enrichment"),
    dryRun: args.includes("--dry-run"),
  };
}

// ── Dev server detection ────────────────────────────────────────────

async function isDevServerUp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch("http://localhost:3000", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok || res.status === 307; // next-intl redirects are normal
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/run-scrapers.ts
git commit -m "feat(runner): add CLI flag parsing and dev server detection"
```

---

### Task 4: Add TUI multi-select prompt

**Files:**
- Modify: `scripts/run-scrapers.ts`

- [ ] **Step 1: Add phase labels and TUI prompt function**

Append after the dev server detection:

```ts
// ── Phase labels ────────────────────────────────────────────────────

const PHASE_LABELS: Record<Phase, string> = {
  discovery: "Discovery (CLI)",
  enrichment: "Enrichment (CLI)",
  "cron-enrichment": "Cron: Discovery & Enrichment (HTTP)",
  "cron-maintenance": "Cron: Maintenance (HTTP)",
  "post-run": "Post-run (CLI)",
};

// ── TUI prompt ──────────────────────────────────────────────────────

function buildChoices(
  devServerUp: boolean
): prompts.Choice[] {
  const choices: prompts.Choice[] = [];
  let currentPhase: Phase | null = null;

  for (const s of SCRAPERS) {
    // Add phase separator
    if (s.phase !== currentPhase) {
      currentPhase = s.phase;
      choices.push({
        title: `── ${PHASE_LABELS[s.phase]} ──`,
        value: `__separator_${s.phase}`,
        disabled: true,
      });
    }

    const isCron = s.type === "cron";
    const disabled = isCron && !devServerUp;
    const suffix = disabled ? " (requires dev server)" : "";

    choices.push({
      title: `${s.name}${suffix}`,
      description: s.description,
      value: s.id,
      selected: s.defaultSelected && !disabled,
      disabled,
    });
  }

  return choices;
}

async function selectScrapers(
  flags: CliFlags,
  devServerUp: boolean
): Promise<ScraperDef[]> {
  // Bypass TUI with flags
  if (flags.full) {
    return SCRAPERS.filter((s) => s.type === "cli" || devServerUp);
  }

  const phaseFilter: Phase[] = [];
  if (flags.discovery) phaseFilter.push("discovery");
  if (flags.enrichment) phaseFilter.push("enrichment");

  if (phaseFilter.length > 0) {
    return SCRAPERS.filter(
      (s) =>
        phaseFilter.includes(s.phase) && (s.type === "cli" || devServerUp)
    );
  }

  // Interactive TUI
  const response = await prompts({
    type: "multiselect",
    name: "scrapers",
    message: "Select scrapers to run (space to toggle, enter to execute)",
    choices: buildChoices(devServerUp),
    instructions: false,
  });

  if (!response.scrapers || response.scrapers.length === 0) {
    console.log("No scrapers selected. Exiting.");
    process.exit(0);
  }

  const selectedIds = new Set<string>(response.scrapers);
  return SCRAPERS.filter((s) => selectedIds.has(s.id));
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/run-scrapers.ts
git commit -m "feat(runner): add interactive TUI multi-select prompt"
```

---

## Chunk 3: Execution Loop and Summary

### Task 5: Add execution functions (CLI spawn + cron fetch)

**Files:**
- Modify: `scripts/run-scrapers.ts`

- [ ] **Step 1: Add execution helpers and result tracking**

Append after the TUI section:

```ts
// ── Execution ───────────────────────────────────────────────────────

interface RunResult {
  name: string;
  status: "ok" | "failed" | "timeout";
  durationMs: number;
  exitCode?: number;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function runCliScraper(
  scraper: ScraperDef,
  dryRun: boolean
): Promise<RunResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const args = [...(scraper.args || [])];
    if (dryRun && scraper.dryRunFlag) {
      args.push(scraper.dryRunFlag);
    }

    const proc: ChildProcess = spawn(scraper.command!, args, {
      stdio: "inherit",
      shell: true,
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({
        name: scraper.name,
        status: "timeout",
        durationMs: Date.now() - start,
      });
    }, scraper.timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        name: scraper.name,
        status: code === 0 ? "ok" : "failed",
        durationMs: Date.now() - start,
        exitCode: code ?? undefined,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      console.error(`  Error spawning ${scraper.name}: ${err.message}`);
      resolve({
        name: scraper.name,
        status: "failed",
        durationMs: Date.now() - start,
      });
    });
  });
}

async function runCronScraper(
  scraper: ScraperDef,
  dryRun: boolean
): Promise<RunResult> {
  const start = Date.now();
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("  CRON_SECRET not set in .env.local — skipping cron routes");
    return { name: scraper.name, status: "failed", durationMs: 0 };
  }

  let url = `http://localhost:3000${scraper.cronRoute}`;
  if (dryRun) url += "?dryRun=true";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      scraper.timeoutMs
    );

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const body = await res.json().catch(() => null);

    if (body) {
      console.log(JSON.stringify(body, null, 2));
    }

    const failed =
      res.status >= 400 || (body && (body as Record<string, unknown>).error);

    return {
      name: scraper.name,
      status: failed ? "failed" : "ok",
      durationMs: Date.now() - start,
      exitCode: res.status,
    };
  } catch (err) {
    const isTimeout =
      err instanceof DOMException && err.name === "AbortError";
    return {
      name: scraper.name,
      status: isTimeout ? "timeout" : "failed",
      durationMs: Date.now() - start,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/run-scrapers.ts
git commit -m "feat(runner): add CLI spawn and cron fetch execution"
```

---

### Task 6: Add summary table and main function

**Files:**
- Modify: `scripts/run-scrapers.ts`

- [ ] **Step 1: Add summary table printer and main function**

Append after the execution section:

```ts
// ── Summary table ───────────────────────────────────────────────────

function printSummary(results: RunResult[]): void {
  const nameWidth = Math.max(
    ...results.map((r) => r.name.length),
    "Scraper".length
  );
  // removed — replaced by divider below

  console.log("");
  const divider = "-".repeat(nameWidth + 2);
  console.log(`+${divider}+----------+----------+`);
  console.log(
    `| ${"Scraper".padEnd(nameWidth)} | Status   | Duration |`
  );
  console.log(`+${divider}+----------+----------+`);

  for (const r of results) {
    const label =
      r.status === "ok" ? "OK" : r.status === "timeout" ? "TIMEOUT" : "FAILED";
    console.log(
      `| ${r.name.padEnd(nameWidth)} | ${label.padEnd(8)} | ${formatDuration(r.durationMs).padStart(8)} |`
    );
  }

  const passed = results.filter((r) => r.status === "ok").length;
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  console.log(`+${divider}+----------+----------+`);
  console.log(
    `| ${"Total".padEnd(nameWidth)} | ${`${passed}/${results.length} OK`.padEnd(8)} | ${formatDuration(totalMs).padStart(8)} |`
  );
  console.log(`+${divider}+----------+----------+`);
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const flags = parseFlags();

  console.log("Checking dev server on localhost:3000...");
  const devServerUp = await isDevServerUp();

  if (devServerUp) {
    console.log("  Dev server detected.");
  } else {
    console.log("  Dev server not running -- cron routes will be unavailable.");
  }
  console.log("");

  const selected = await selectScrapers(flags, devServerUp);

  if (flags.dryRun) {
    console.log("[DRY RUN] Scrapers will skip database writes.\n");
  }

  const results: RunResult[] = [];

  for (const scraper of selected) {
    console.log(`\n═══ Running: ${scraper.name} ═══\n`);

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

  const anyFailed = results.some((r) => r.status !== "ok");
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the script runs and shows the TUI**

```bash
npx tsx scripts/run-scrapers.ts
```

Expected: TUI shows with checkbox multi-select, phase separators, discovery pre-selected. Ctrl+C to exit without running.

- [ ] **Step 3: Test `--full` flag (dry run)**

```bash
npx tsx scripts/run-scrapers.ts --full --dry-run
```

Expected: skips TUI, runs all CLI scrapers in dry-run mode in series, prints summary table.

- [ ] **Step 4: Test `--discovery` flag (dry run)**

```bash
npx tsx scripts/run-scrapers.ts --discovery --dry-run
```

Expected: runs only the 6 discovery scrapers in dry-run mode.

- [ ] **Step 5: Commit**

```bash
git add scripts/run-scrapers.ts
git commit -m "feat(runner): add summary table, main loop, and CLI flags"
```

---

## Chunk 3: Cleanup

### Task 7: Delete old PowerShell script

**Files:**
- Delete: `run_all_scrapers.ps1`

- [ ] **Step 1: Delete the file**

```bash
rm run_all_scrapers.ps1
```

- [ ] **Step 2: Commit**

```bash
git add run_all_scrapers.ps1
git commit -m "chore: remove run_all_scrapers.ps1, replaced by run-scrapers.ts TUI"
```

---

### Task 8: Smoke test the full workflow

- [ ] **Step 1: Run with `--discovery --dry-run` (no dev server needed)**

```bash
npx tsx scripts/run-scrapers.ts --discovery --dry-run
```

Expected: all 6 discovery scrapers run in dry-run mode, summary table shows 6/6 OK.

- [ ] **Step 2: Run interactive mode, select only Health Audit**

```bash
npx tsx scripts/run-scrapers.ts
```

Deselect all, select only "Scraper Health Audit", press enter.
Expected: runs health audit, prints summary with 1/1 OK.

- [ ] **Step 3: Run via npm script**

```bash
npm run scrapers
```

Expected: same as `npx tsx scripts/run-scrapers.ts`.
