# Scraper Runner TUI — Design Spec

**Date:** 2026-04-21
**Status:** Approved

## Overview

Interactive TUI script that lets the user select and run any combination of scrapers, enrichment jobs, cron routes, and maintenance tasks from a single terminal command. Uses `prompts` for checkbox selection and runs everything in series with live output.

## Execution

```bash
npx tsx scripts/run-scrapers.ts        # Interactive TUI
npm run scrapers                        # Same, via package.json script

# Bypass TUI with flags
npx tsx scripts/run-scrapers.ts --full          # Run everything
npx tsx scripts/run-scrapers.ts --discovery     # Only discovery phase
npx tsx scripts/run-scrapers.ts --enrichment    # Only enrichment phase
npx tsx scripts/run-scrapers.ts --dry-run       # Pass --dryRun to all scrapers
```

## TUI Layout

Multi-select with checkboxes, grouped by phase. Discovery pre-selected by default.

```
? Select scrapers to run (space to toggle, enter to execute):

── Discovery (CLI) ────────────────────────
◉ Porsche Collector         (BaT, C&B, CollectingCars)
◉ Ferrari Collector         (BaT, C&B, CollectingCars)
◉ BeForward Collector       (summary-only, 10 pages)
◉ Classic.com Collector     (Scrapling, 20 pages)
◉ AutoScout24 Collector     (Scrapling, 7000 listings)
◉ Elferspot Collector       (100 pages)

── Enrichment (CLI) ───────────────────────
◯ BaT Detail Scraper        (100 listings, 30 min)
◯ Classic.com Scrapling Enrichment (500 listings)
◯ AS24 Scrapling Enrichment (500 listings)

── Cron: Discovery & Enrichment (HTTP) ────
◯ AutoTrader Discovery
◯ AutoTrader Enrichment
◯ BeForward Enrichment
◯ Elferspot Enrichment

── Cron: Maintenance (HTTP) ───────────────
◯ Listing Validator
◯ Cleanup
◯ VIN Enrichment
◯ Title Enrichment
◯ Image Backfill (cross-source)

── Post-run (CLI) ─────────────────────────
◯ Liveness Checker          (100 listings, sample)
◯ Scraper Health Audit      (last 3 days)
```

## Scraper Definitions

Each scraper is defined as:

```ts
interface ScraperDef {
  id: string;
  name: string;
  description: string;
  phase: 'discovery' | 'enrichment' | 'cron-enrichment' | 'cron-maintenance' | 'post-run';
  type: 'cli' | 'cron';
  // CLI scrapers
  command?: string;
  args?: string[];
  dryRunFlag?: string;
  // Cron scrapers
  cronRoute?: string;
  // Shared
  defaultSelected: boolean;
  timeoutMs: number;
}
```

All CLI scrapers use `--dryRun` (camelCase) as their dry-run flag.

### Discovery (CLI)

| ID | Command | Args | dryRunFlag | Timeout |
|----|---------|------|------------|---------|
| `porsche` | `npx tsx src/features/scrapers/porsche_collector/cli.ts` | `--mode=daily` | `--dryRun` | 10 min |
| `ferrari` | `npx tsx src/features/scrapers/ferrari_collector/cli.ts` | `--mode=daily` | `--dryRun` | 10 min |
| `beforward` | `npx tsx src/features/scrapers/beforward_porsche_collector/cli.ts` | `--summaryOnly --maxPages=10` | `--dryRun` | 10 min |
| `classic` | `npx tsx src/features/scrapers/classic_collector/cli.ts` | `--maxPages=20` | `--dryRun` | 30 min |
| `as24` | `npx tsx src/features/scrapers/autoscout24_collector/cli.ts` | `--maxListings=7000` | `--dryRun` | 30 min |
| `elferspot` | `npx tsx src/features/scrapers/elferspot_collector/cli.ts` | `--maxPages=100` | `--dryRun` | 30 min |

> AS24 uses `--maxListings=7000` (vs CLI default of 50000) for faster manual runs.

### Enrichment (CLI)

| ID | Command | Args | dryRunFlag | Timeout |
|----|---------|------|------------|---------|
| `bat-detail` | `npx tsx scripts/bat-detail-scraper.ts` | `--limit=100 --timeBudgetMs=1800000` | `--dryRun` | 30 min |
| `classic-enrich` | `npx tsx scripts/classic-enrich-scrapling.ts` | `--limit=500` | `--dryRun` | 25 min |
| `as24-enrich` | `npx tsx scripts/as24-enrich-scrapling.ts` | `--limit=500` | `--dryRun` | 25 min |

### Cron: Discovery & Enrichment (HTTP)

| ID | Route | Timeout |
|----|-------|---------|
| `cron-autotrader` | `/api/cron/autotrader` | 5 min |
| `cron-autotrader-enrich` | `/api/cron/enrich-autotrader` | 5 min |
| `cron-beforward-enrich` | `/api/cron/enrich-beforward` | 5 min |
| `cron-elferspot-enrich` | `/api/cron/enrich-elferspot` | 5 min |

### Cron: Maintenance (HTTP)

| ID | Route | Timeout |
|----|-------|---------|
| `cron-validate` | `/api/cron/validate` | 2 min |
| `cron-cleanup` | `/api/cron/cleanup` | 2 min |
| `cron-vin` | `/api/cron/enrich-vin` | 2 min |
| `cron-titles` | `/api/cron/enrich-titles` | 2 min |
| `cron-images` | `/api/cron/backfill-images` | 5 min |

### Post-run (CLI)

| ID | Command | Args | Timeout |
|----|---------|------|---------|
| `liveness` | `npx tsx src/features/scrapers/liveness_checker/cli.ts` | `--maxListings=100` | 10 min |
| `health-audit` | `npx tsx scripts/scraper-health-audit.ts` | `--days=3` | 1 min |

## Dev Server Detection

Before showing the TUI, the script pings `http://localhost:3000` with a 2-second timeout.

- **Server up:** all options available.
- **Server down:** cron-based scrapers are shown but disabled with label "(requires dev server)". A warning is printed at the top.

## Execution Flow

1. Parse CLI flags (`--full`, `--discovery`, `--enrichment`, `--dry-run`)
2. Detect dev server on localhost:3000
3. Show multi-select TUI (or skip if `--full` / phase flags)
4. For each selected scraper, in order:
   a. Print header: `═══ Running: Porsche Collector ═══`
   b. If CLI type: `spawn()` the command, pipe stdout/stderr to terminal
   c. If cron type: `fetch()` the route with CRON_SECRET. Parse JSON response — print `JSON.stringify(body, null, 2)`. Treat HTTP >= 400 or `body.error` as failure.
   d. Track duration and exit status
   e. If timeout exceeded: kill process with SIGTERM
   f. Print result: `✓ OK (2m 15s)` or `✗ FAILED (exit 1, 0m 32s)`
5. Print summary table
6. Exit with code 0 (all passed) or 1 (any failed)

## Dry Run

When `--dry-run` is passed:
- CLI scrapers get their dry run flag appended (`--dryRun` or `--dry-run` depending on the scraper)
- Cron routes get `?dryRun=true` appended to the URL (if supported; otherwise skipped)

## Summary Table

Printed at the end:

```
┌─────────────────────────────────┬──────────┬──────────┐
│ Scraper                         │ Status   │ Duration │
├─────────────────────────────────┼──────────┼──────────┤
│ Porsche Collector               │ ✓ OK     │ 2m 15s   │
│ Ferrari Collector               │ ✓ OK     │ 1m 48s   │
│ BeForward Collector             │ ✗ FAILED │ 0m 32s   │
│ Classic.com Collector           │ ✓ OK     │ 5m 03s   │
│ AutoTrader Discovery (cron)     │ ✓ OK     │ 0m 04s   │
│ Scraper Health Audit            │ ✓ OK     │ 0m 12s   │
├─────────────────────────────────┼──────────┼──────────┤
│ Total                           │ 5/6 OK   │ 9m 54s   │
└─────────────────────────────────┴──────────┴──────────┘
```

## Dependencies

- **New:** `prompts` (runtime), `@types/prompts` (devDependency)
- **Existing:** none — `tsx` auto-loads `.env.local` via the project's Next.js setup; `process.env.CRON_SECRET` is available at runtime

## Files

| File | Action |
|------|--------|
| `scripts/run-scrapers.ts` | Create — single file, ~300-350 lines |
| `package.json` | Add `"scrapers": "tsx scripts/run-scrapers.ts"` to scripts |
| `run_all_scrapers.ps1` | Delete — replaced by this script |

## Intentionally Excluded

The following cron routes are NOT in the TUI because their CLI counterparts are already listed in Discovery:

- `/api/cron/porsche`, `/api/cron/ferrari`, `/api/cron/beforward`, `/api/cron/classic`, `/api/cron/elferspot`, `/api/cron/autoscout24` — redundant with CLI discovery scrapers above.

The following cron routes are excluded as not relevant to manual scraping runs:

- `/api/cron/social-engine` — social media engine, not a scraper
- `/api/cron/refresh-valuation-factors` — pricing computation, not a scraper
- `/api/cron/enrich-details` — legacy AS24 enrichment, replaced by `as24-enrich` CLI
- `/api/cron/backfill-photos-elferspot` — low-priority, Elferspot enrichment covers images

The following CLI scripts are excluded:

- `scripts/enrich-from-vin.ts`, `scripts/enrich-from-titles.ts` — CLI equivalents of the VIN/Title cron routes already listed
- `scripts/enrich-as24-bulk.ts` — legacy, replaced by `as24-enrich-scrapling.ts`
- `scripts/backfill-classic-images.ts` — requires Playwright + proxy, cross-source backfill covers it

## Out of Scope

- No parallel execution (series only, by design)
- No log files (stdout only — pipe to file externally if needed)
- No scheduling (use cron/GHA for that)
- No Vercel/CI integration (this is a local manual tool)
