# Closed-Loop Scraper Assurance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the scraper assurance repair command execute its real repair queue, fail unless contract resolution reaches 100%, and promote fully validated agent repairs through the repository's production path.

**Architecture:** Add a pure repair planner beside the assurance contract, add an explicit safe repair-job mode to the existing scraper runner, and let the assurance orchestrator rebuild the database queue after every bounded repair wave. Keep code diagnosis in the scheduled Codex task, which may auto-merge only after the deterministic release predicate and platform checks pass.

**Tech Stack:** TypeScript, Vitest, existing scraper runner and assurance manifest, GitHub Actions/Git integration, Vercel Git deployment.

---

### Task 1: Derive executable repair plans from assurance gaps

**Files:**
- Create: `src/features/scrapers/common/assurance/repairPlan.ts`
- Create: `src/features/scrapers/common/assurance/repairPlan.test.ts`
- Modify: `src/features/scrapers/common/assurance/manifest.ts`
- Modify: `src/features/scrapers/common/assurance/manifest.test.ts`

- [ ] **Step 1: Write failing planner tests**

Cover deduplicated job selection, source/field traceability, rejection of unknown/destructive job IDs, and a manifest assertion that every source repair ID resolves to a registered non-destructive job.

```ts
expect(buildRepairPlan(reportWithGaps).jobIds).toEqual([
  "bat-detail",
  "enrich-titles",
  "enrich-vin",
]);
expect(() => buildRepairPlan(reportWithUnknownJob)).toThrow("unknown repair job");
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npx vitest run src/features/scrapers/common/assurance/repairPlan.test.ts src/features/scrapers/common/assurance/manifest.test.ts`

Expected: failure because `repairPlan.ts` and repair-ID validation do not exist.

- [ ] **Step 3: Implement the minimal pure planner**

Define `RepairPlan`, `RepairPlanGap`, and `buildRepairPlan(report)`. Resolve IDs against `SCRAPER_JOBS`, reject destructive or missing mappings, deduplicate jobs, and retain counts by source, field, and reason.

- [ ] **Step 4: Add repair-ID manifest validation**

Extend `validateAssuranceManifest()` so every `source.repairJobIds` entry exists, covers the source, and is non-destructive.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run: `npx vitest run src/features/scrapers/common/assurance/repairPlan.test.ts src/features/scrapers/common/assurance/manifest.test.ts`

Expected: all tests pass.

### Task 2: Add an explicit non-destructive repair-job runner mode

**Files:**
- Modify: `scripts/run-scrapers.ts`
- Modify: `scripts/run-scrapers.test.ts`
- Modify: `src/features/scrapers/common/assurance/manifest.ts`

- [ ] **Step 1: Write failing runner-selection tests**

Export pure helpers that map assurance job IDs to runner jobs and reject destructive, unknown, or unavailable cron jobs.

```ts
expect(resolveRepairRunnerIds(["backfill-images"])).toEqual([
  "bf-images",
  "classic-images",
  "cron-images",
]);
expect(() => resolveRepairRunnerIds(["cleanup"])).toThrow("destructive");
```

Add a result-classification test proving output containing a triggered circuit breaker becomes failed.

- [ ] **Step 2: Run runner tests and confirm RED**

Run: `npx vitest run scripts/run-scrapers.test.ts`

Expected: failure because repair selection and circuit-break classification are not exported or enforced.

- [ ] **Step 3: Implement `--repair-jobs=<manifest ids>`**

Parse a comma-separated list, map manifest job IDs through `ASSURANCE_RUNNER_JOB_MAP`, select every safe runner implementation, and run one repair wave without the interactive selector. Cron jobs must use an explicit reachable `SCRAPER_RUNNER_BASE_URL` or fail before writes.

- [ ] **Step 4: Harden result classification and exit status**

Classify timeouts, nonzero exits, triggered circuit breakers, and critical no-output results as failures. Exit nonzero when any selected repair job fails.

- [ ] **Step 5: Run runner and inventory tests and confirm GREEN**

Run: `npx vitest run scripts/run-scrapers.test.ts src/features/scrapers/common/assurance/manifest.test.ts`

Expected: all tests pass.

### Task 3: Replace bounded legacy enrichment with queue-driven repair waves

**Files:**
- Modify: `scripts/scraper-assurance.ts`
- Modify: `scripts/scraper-assurance.test.ts`
- Modify: `src/features/scrapers/common/assurance/database.ts`
- Modify: `src/features/scrapers/common/assurance/database.test.ts`

- [ ] **Step 1: Write failing orchestration tests**

Inject the command executor and database snapshot loader. Prove that the orchestrator passes the planned job IDs, rebuilds the queue after each wave, stops at 100%, stops on zero progress, and reports failure when the iteration budget ends with gaps.

```ts
expect(execute).toHaveBeenCalledWith(expect.objectContaining({
  args: expect.arrayContaining(["--repair-jobs=bat-detail,enrich-vin"]),
}));
expect(result.completed).toBe(false);
expect(result.blockers[0].kind).toBe("no_progress");
```

- [ ] **Step 2: Run assurance tests and confirm RED**

Run: `npx vitest run scripts/scraper-assurance.test.ts src/features/scrapers/common/assurance/database.test.ts`

Expected: failure because repair waves and structured repair metadata do not exist.

- [ ] **Step 3: Implement repair waves**

Replace `runBoundedEnrichment()` with `runQueueDrivenRepair()`. Each iteration builds a plan, runs `scripts/run-scrapers.ts --repair-jobs=...`, fetches fresh rows, rebuilds the assurance report, and compares unresolved counts. A command failure, no-progress wave, or exhausted budget emits structured blockers.

- [ ] **Step 4: Persist repair metadata**

Extend the assurance report with optional repair metadata containing requested jobs, waves, before/after unresolved counts, completion state, and blockers. Ensure `determineAssuranceExitCode()` remains nonzero whenever final resolution is below 100% or a repair blocker exists.

- [ ] **Step 5: Run assurance tests and confirm GREEN**

Run: `npm run test:scraper-assurance`

Expected: all assurance tests pass.

### Task 4: Gate automatic production promotion

**Files:**
- Create: `scripts/scraper-repair-release.ts`
- Create: `scripts/scraper-repair-release.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/enrichment-loop.yml`
- Modify: `docs/scrapers/SCRAPERS.md`
- External update: `C:/Users/capos/.codex/automations/weekly-scraper-assurance/automation.toml` through the Codex automation API

- [ ] **Step 1: Write failing release-predicate tests**

Create a pure `evaluateRepairRelease()` predicate. It must reject unresolved fields, failed canaries, failed tests/build, missing GitHub checks, non-ready preview/production deployments, and failed post-deploy smoke checks.

- [ ] **Step 2: Run release tests and confirm RED**

Run: `npx vitest run scripts/scraper-repair-release.test.ts`

Expected: failure because the release predicate does not exist.

- [ ] **Step 3: Implement the release predicate and report command**

The command reads the assurance artifact plus explicit CI/deployment observations and emits `eligible`, `blockedReasons`, and verified commit/deployment identifiers. It must not merge or deploy directly; the scheduled Codex task performs those authenticated operations only after `eligible=true`.

- [ ] **Step 4: Strengthen CI and scheduled automation**

Run strict assurance with `--repair-jobs` support and upload artifacts. Update the scheduled automation prompt to create a ready PR, wait for required checks and Vercel preview, enable squash auto-merge, verify the production deployment and smoke checks, and report failure without claiming deployment when any gate is incomplete.

- [ ] **Step 5: Document operational behavior**

Document 100% contract resolution, queue-driven waves, blocker meanings, production promotion gates, required GitHub/Vercel permissions, and rollback expectations.

- [ ] **Step 6: Run focused verification**

Run: `npm run test:scraper-assurance`

Run: `npx vitest run scripts/scraper-repair-release.test.ts`

Expected: all tests pass.

### Task 5: Full verification and production delivery

**Files:**
- Verify all modified files
- Update no unrelated user files

- [ ] **Step 1: Run the scraper suites**

Run: `npm run test:scraper-assurance`

Run: `npm run test:scrapers`

Expected: zero failures.

- [ ] **Step 2: Run static and build verification**

Run: `npx tsc --noEmit`

Run: `npm run lint`

Run: `npm run build`

Expected: zero failures, or an exact unrelated pre-existing blocker documented without claiming completion.

- [ ] **Step 3: Run the live repair contract**

Run: `npm run scrapers:assurance:repair`

Expected: exit zero only if production contract resolution reaches 100%; otherwise preserve the blocker artifact and do not deploy.

- [ ] **Step 4: Deliver through the guarded production path**

Commit only task files in an isolated `codex/` branch, push, open a ready PR, wait for required GitHub/Vercel checks, squash auto-merge only if the release predicate is eligible, then verify the merged commit and production deployment.

- [ ] **Step 5: Report evidence**

Report tests, build, live before/after metrics, remaining blockers, PR/merge commit, production deployment status, and scheduled automation update. Never report success if the live repair gate remains below 100%.
