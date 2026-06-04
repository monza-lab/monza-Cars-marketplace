# Enrichment Loop Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GitHub Actions enrichment loop close real data-quality gaps, fail on true scraper failures, and produce auditable artifacts for diagnosis.

**Architecture:** Keep the existing monolithic scraper runner and source-specific enrichment scripts. Fix the broken vertical slices in place: target selection, quality gate semantics, scraper failure classification, and CI artifact capture. No new dependencies; add small feature-local tests near existing scraper tests.

**Tech Stack:** TypeScript, Next.js route handlers, Supabase JS client, Vitest, GitHub Actions, existing Scrapling subprocess scripts.

**Locality Envelope:** {files: 8 modified, 2 tests created/extended, LOC/file: target <1000 and touched blocks <120 LOC/file, deps: 0}

---

## Phase Zero Context

**Observed failure:** GitHub Actions run `25865741913` completed 5 iterations and exited 1 because the final quality gate still had 7 failing targets. Active-run lock table was empty after the run; the workflow did not fail because of a stale lock.

**Environment matrix to capture before execution:**

```powershell
node --version
npm --version
npx tsx --version
gh --version
git rev-parse HEAD
```

Expected: commands print concrete versions and a commit SHA. Save notable deviations in the final execution report.

**Non-functional requirements:**
- No new runtime dependencies.
- GitHub Actions runtime remains under `timeout-minutes: 360`.
- Every scraper failure path must expose actionable diagnostics in stdout/stderr or run-log JSON.
- Quality targets must map to rows that an included enrichment worker can actually improve.
- CI run logs must survive runner teardown as artifacts.

## File Structure

| File | Responsibility |
|------|----------------|
| `.github/workflows/enrichment-loop.yml` | CI orchestration, max iteration defaults, run-log artifact upload |
| `scripts/run-scrapers.ts` | Loop orchestration, per-job result handling, final exit decision |
| `scripts/enrich-loop-quality.ts` | Quality target definitions and fill-rate queries |
| `scripts/classic-enrich-scrapling.ts` | Classic.com description enrichment row selection |
| `src/app/api/cron/enrich-elferspot/route.ts` | Elferspot detail enrichment row selection |
| `scripts/bf-bulk-backfill-images.ts` | BeForward image backfill failure classification and fallback |
| `src/app/api/cron/enrich-vin/route.ts` | VIN enrichment diagnostics and zero-write status classification |
| `src/app/api/cron/enrich-titles/route.ts` | Title enrichment diagnostics and zero-write status classification |
| `scripts/run-scrapers.test.ts` | Runner helper tests |
| `tests/quality/enrich-loop-quality.test.ts` | Quality target and query behavior tests |

## Task 1: Make the Quality Gate Actionable

**Files:**
- Modify: `scripts/enrich-loop-quality.ts`
- Test: `tests/quality/enrich-loop-quality.test.ts`

- [ ] **Step 1: Write failing tests for empty-string gaps and target ownership**

Add tests that lock the two current invariants:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_TARGETS, getTargetsByLabel } from "../../scripts/enrich-loop-quality";

describe("enrichment loop quality targets", () => {
  it("keeps every failing target mapped to a runnable enrichment concern", () => {
    const targets = getTargetsByLabel(DEFAULT_TARGETS);

    expect(targets["AS24 descriptions"].owner).toBe("as24-enrich");
    expect(targets["AS24 trim"].owner).toBe("as24-enrich");
    expect(targets["Classic descriptions"].owner).toBe("classic-enrich");
    expect(targets["Elferspot descriptions"].owner).toBe("cron-elferspot-enrich");
    expect(targets["Elferspot prices"].owner).toBe("cron-elferspot-enrich");
    expect(targets["BeForward images"].owner).toBe("bf-images");
    expect(targets["All engine"].owner).toBe("detail-or-vin-title");
  });

  it("does not include duplicate workers for the same AS24 trim backlog", () => {
    const labels = DEFAULT_TARGETS.map((target) => target.label);

    expect(labels).toContain("AS24 trim");
    expect(labels.filter((label) => label === "AS24 trim")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npx vitest run tests/quality/enrich-loop-quality.test.ts
```

Expected: FAIL because `owner` and `getTargetsByLabel` do not exist.

- [ ] **Step 3: Add target ownership metadata**

Update `QualityTarget` and `DEFAULT_TARGETS`:

```ts
export interface QualityTarget {
  source: string;
  field: string;
  targetPct: number;
  label: string;
  owner:
    | "as24-enrich"
    | "classic-enrich"
    | "cron-elferspot-enrich"
    | "bf-images"
    | "bat-detail"
    | "at-enrich"
    | "cron-images"
    | "detail-or-vin-title";
  criticality: "critical" | "high" | "medium";
}

export function getTargetsByLabel(
  targets: QualityTarget[] = DEFAULT_TARGETS,
): Record<string, QualityTarget> {
  return Object.fromEntries(targets.map((target) => [target.label, target]));
}
```

Assign owners:

```ts
{ source: "AutoScout24", field: "description_text", targetPct: 90, label: "AS24 descriptions", owner: "as24-enrich", criticality: "critical" },
{ source: "AutoScout24", field: "trim", targetPct: 90, label: "AS24 trim", owner: "as24-enrich", criticality: "critical" },
{ source: "ClassicCom", field: "description_text", targetPct: 90, label: "Classic descriptions", owner: "classic-enrich", criticality: "high" },
{ source: "ClassicCom", field: "mileage", targetPct: 80, label: "Classic mileage", owner: "classic-enrich", criticality: "medium" },
{ source: "Elferspot", field: "description_text", targetPct: 90, label: "Elferspot descriptions", owner: "cron-elferspot-enrich", criticality: "high" },
{ source: "Elferspot", field: "hammer_price", targetPct: 80, label: "Elferspot prices", owner: "cron-elferspot-enrich", criticality: "high" },
{ source: "BeForward", field: "images", targetPct: 95, label: "BeForward images", owner: "bf-images", criticality: "high" },
{ source: "BringATrailer", field: "description_text", targetPct: 90, label: "BaT descriptions", owner: "bat-detail", criticality: "medium" },
{ source: "AutoTrader", field: "description_text", targetPct: 90, label: "AT descriptions", owner: "at-enrich", criticality: "medium" },
{ source: "AutoTrader", field: "images", targetPct: 95, label: "AT images", owner: "at-enrich", criticality: "medium" },
{ source: "ALL", field: "images", targetPct: 95, label: "All images", owner: "cron-images", criticality: "medium" },
{ source: "ALL", field: "engine", targetPct: 80, label: "All engine", owner: "detail-or-vin-title", criticality: "critical" },
{ source: "ALL", field: "transmission", targetPct: 80, label: "All transmission", owner: "detail-or-vin-title", criticality: "medium" },
```

- [ ] **Step 4: Run tests**

Run:

```powershell
npx vitest run tests/quality/enrich-loop-quality.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/enrich-loop-quality.ts tests/quality/enrich-loop-quality.test.ts
git commit -m "test(scrapers): document enrichment quality target ownership"
```

## Task 2: Fix Classic.com Stuck Description Gap

**Files:**
- Modify: `scripts/classic-enrich-scrapling.ts`
- Test: create or extend `tests/quality/enrich-loop-quality.test.ts`

- [ ] **Step 1: Extract Classic row-needs predicate**

Add this exported helper near `truncate`:

```ts
export function classicDescriptionNeedsEnrichment(value: string | null | undefined): boolean {
  return value == null || value.trim() === "";
}
```

- [ ] **Step 2: Write failing unit test**

Add:

```ts
import { classicDescriptionNeedsEnrichment } from "../../scripts/classic-enrich-scrapling";

it("treats null and empty Classic descriptions as needing enrichment", () => {
  expect(classicDescriptionNeedsEnrichment(null)).toBe(true);
  expect(classicDescriptionNeedsEnrichment("")).toBe(true);
  expect(classicDescriptionNeedsEnrichment("   ")).toBe(true);
  expect(classicDescriptionNeedsEnrichment("Factory option summary")).toBe(false);
});
```

- [ ] **Step 3: Run focused test**

Run:

```powershell
npx vitest run tests/quality/enrich-loop-quality.test.ts
```

Expected: PASS for helper import if the script does not execute `main()` on import. If it executes `main()`, proceed to Step 4 and guard the script entrypoint.

- [ ] **Step 4: Guard Classic script entrypoint**

Replace the bottom call with:

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Change the Supabase selector**

Replace:

```ts
.is("description_text", null)
```

with:

```ts
.or("description_text.is.null,description_text.eq.")
```

- [ ] **Step 6: Run test**

Run:

```powershell
npx vitest run tests/quality/enrich-loop-quality.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add scripts/classic-enrich-scrapling.ts tests/quality/enrich-loop-quality.test.ts
git commit -m "fix(scrapers): include empty Classic descriptions in enrichment"
```

## Task 3: Fix Elferspot Price Gap Selection

**Files:**
- Modify: `src/app/api/cron/enrich-elferspot/route.ts`
- Test: `src/app/api/cron/enrich-elferspot/route.test.ts`

- [ ] **Step 1: Add failing test for price-only backlog**

Extend the mocked Supabase query assertions so the route must select rows missing either descriptions or prices:

```ts
it("selects Elferspot rows missing description or hammer price", async () => {
  await GET(new Request("http://localhost/api/cron/enrich-elferspot", {
    headers: { authorization: "Bearer test-secret" },
  }));

  expect(mockQuery.or).toHaveBeenCalledWith("description_text.is.null,description_text.eq.,hammer_price.is.null");
});
```

Set `process.env.CRON_SECRET = "test-secret"` in the test setup if not already present.

- [ ] **Step 2: Run failing test**

Run:

```powershell
npx vitest run src/app/api/cron/enrich-elferspot/route.test.ts
```

Expected: FAIL because the route currently uses `.is("description_text", null)`.

- [ ] **Step 3: Update selector and selected columns**

Replace:

```ts
.select("id,source_url")
.eq("source", "Elferspot")
.eq("status", "active")
.is("description_text", null)
```

with:

```ts
.select("id,source_url,description_text,hammer_price")
.eq("source", "Elferspot")
.eq("status", "active")
.or("description_text.is.null,description_text.eq.,hammer_price.is.null")
```

- [ ] **Step 4: Avoid overwriting prices with null**

Keep existing update guards:

```ts
if (detail.price) {
  update.hammer_price = detail.price;
  update.current_bid = detail.price;
  update.original_currency = detail.currency;
}
```

No change needed here; the selector is the root cause.

- [ ] **Step 5: Run route test**

Run:

```powershell
npx vitest run src/app/api/cron/enrich-elferspot/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/cron/enrich-elferspot/route.ts src/app/api/cron/enrich-elferspot/route.test.ts
git commit -m "fix(scrapers): include Elferspot price-only rows in enrichment"
```

## Task 4: Make BeForward Image Backfill Fail Correctly and Try Dynamic Fallback

**Files:**
- Modify: `scripts/bf-bulk-backfill-images.ts`
- Test: create `tests/quality/beforward-image-backfill.test.ts`

- [ ] **Step 1: Extract short-body classification helper**

Add near fetch outcome definitions:

```ts
export function classifyShortBody(length: number): FetchOutcome {
  if (length > 0 && length < 5000) {
    return {
      kind: "blocked",
      status: 0,
      message: `Short body (${length})`,
    };
  }
  return { kind: "error", message: `Short body (${length})` };
}
```

- [ ] **Step 2: Write failing test**

Create `tests/quality/beforward-image-backfill.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyShortBody } from "../../scripts/bf-bulk-backfill-images";

describe("BeForward image backfill fetch classification", () => {
  it("classifies short anti-bot pages as blocked so fallback can escalate", () => {
    expect(classifyShortBody(1949)).toEqual({
      kind: "blocked",
      status: 0,
      message: "Short body (1949)",
    });
  });
});
```

- [ ] **Step 3: Guard script entrypoint**

Replace the bottom call with:

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("\nFATAL:", e);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Use helper in both fetch paths**

Replace:

```ts
if (html.length < 5000) return { kind: "error", message: `Short body (${html.length})` };
```

with:

```ts
if (html.length < 5000) return classifyShortBody(html.length);
```

Replace:

```ts
if (!parsed.html || parsed.html.length < 5000)
  return { kind: "error", message: `Short scrapling body (${parsed.html?.length ?? 0})` };
```

with:

```ts
if (!parsed.html || parsed.html.length < 5000) {
  const result = classifyShortBody(parsed.html?.length ?? 0);
  return result.kind === "blocked"
    ? { ...result, message: `Short scrapling body (${parsed.html?.length ?? 0})` }
    : result;
}
```

- [ ] **Step 5: Exit non-zero when all active rows fail**

After printing failures:

```ts
if (queue.length > 0 && filled === 0 && markedDead === 0 && failed === queue.length) {
  console.error("No BeForward image rows were recovered; treating backfill as failed.");
  process.exit(1);
}
```

- [ ] **Step 6: Run tests**

Run:

```powershell
npx vitest run tests/quality/beforward-image-backfill.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add scripts/bf-bulk-backfill-images.ts tests/quality/beforward-image-backfill.test.ts
git commit -m "fix(scrapers): classify BeForward short pages as blocked"
```

## Task 5: Stop Masking Zero-Write VIN and Title Enrichment

**Files:**
- Modify: `src/app/api/cron/enrich-vin/route.ts`
- Modify: `src/app/api/cron/enrich-titles/route.ts`
- Test: route tests if present, otherwise create `tests/quality/enrichment-zero-write.test.ts`

- [ ] **Step 1: Add shared zero-write rule in each route**

In `enrich-vin`, replace unconditional success with:

```ts
const success = errors.length === 0 && (discovered === 0 || written > 0);
const successReason =
  discovered === 0 ? "no_rows" :
  written > 0 ? "rows_updated" :
  "zero_writes";
```

Use `success` in `recordScraperRun` and return `successReason` in JSON.

In `enrich-titles`, replace:

```ts
const success = errors.length === 0 || written > 0;
```

with:

```ts
const success = errors.length === 0 && (discovered === 0 || written > 0);
const successReason =
  discovered === 0 ? "no_rows" :
  written > 0 ? "rows_updated" :
  "zero_writes";
```

- [ ] **Step 2: Return HTTP 500 on zero-write backlog**

For both routes, change the final response to:

```ts
return NextResponse.json(
  {
    success,
    successReason,
    runId,
    duration: `${Date.now() - startTime}ms`,
    discovered,
    written,
    errors: errors.slice(0, 10),
  },
  { status: success ? 200 : 500 },
);
```

- [ ] **Step 3: Run focused route tests**

Run:

```powershell
npx vitest run src/app/api/cron/enrich-vin/route.test.ts src/app/api/cron/enrich-titles/route.test.ts
```

Expected: If files do not exist, Vitest reports no test files. Create route tests in the next step.

- [ ] **Step 4: Create tests if missing**

Create `tests/quality/enrichment-zero-write.test.ts` with small pure helper tests by extracting this helper into both files or a local exported helper from one file:

```ts
export function classifyEnrichmentOutcome(discovered: number, written: number, errors: string[]) {
  const success = errors.length === 0 && (discovered === 0 || written > 0);
  const successReason =
    discovered === 0 ? "no_rows" :
    written > 0 ? "rows_updated" :
    "zero_writes";
  return { success, successReason };
}
```

Test:

```ts
import { describe, expect, it } from "vitest";
import { classifyEnrichmentOutcome } from "../../src/app/api/cron/enrich-titles/route";

describe("enrichment zero-write outcome", () => {
  it("fails when rows were discovered but none were updated", () => {
    expect(classifyEnrichmentOutcome(1000, 0, [])).toEqual({
      success: false,
      successReason: "zero_writes",
    });
  });

  it("passes when no backlog exists", () => {
    expect(classifyEnrichmentOutcome(0, 0, [])).toEqual({
      success: true,
      successReason: "no_rows",
    });
  });
});
```

- [ ] **Step 5: Run tests**

Run:

```powershell
npx vitest run tests/quality/enrichment-zero-write.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/cron/enrich-vin/route.ts src/app/api/cron/enrich-titles/route.ts tests/quality/enrichment-zero-write.test.ts
git commit -m "fix(scrapers): fail enrichment routes on zero-write backlog"
```

## Task 6: Make the Loop Stop on Critical Worker Failures

**Files:**
- Modify: `scripts/run-scrapers.ts`
- Test: `scripts/run-scrapers.test.ts`

- [ ] **Step 1: Add failure classification helper**

Add near `RunResult`:

```ts
const CRITICAL_LOOP_WORKERS = new Set([
  "as24-enrich",
  "classic-enrich",
  "bf-images",
  "cron-elferspot-enrich",
  "cron-vin",
  "cron-titles",
]);

export function hasCriticalLoopFailure(results: Pick<RunResult, "id" | "status">[]): boolean {
  return results.some((result) => CRITICAL_LOOP_WORKERS.has(result.id) && result.status !== "ok");
}
```

- [ ] **Step 2: Write failing runner test**

Add to `scripts/run-scrapers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hasCriticalLoopFailure } from "./run-scrapers";

describe("enrichment loop critical failure detection", () => {
  it("flags failed critical enrichment workers", () => {
    expect(hasCriticalLoopFailure([
      { id: "bf-images", status: "failed" },
      { id: "at-enrich", status: "ok" },
    ])).toBe(true);
  });

  it("ignores successful critical enrichment workers", () => {
    expect(hasCriticalLoopFailure([
      { id: "bf-images", status: "ok" },
      { id: "as24-enrich", status: "ok" },
    ])).toBe(false);
  });
});
```

- [ ] **Step 3: Guard runner entrypoint**

Replace:

```ts
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

with:

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Break loop on critical failure**

After `printSummary(iterResults);`, add:

```ts
if (hasCriticalLoopFailure(iterResults)) {
  console.error("\nCritical enrichment worker failed; stopping loop before more retries.");
  allResults.push(...iterResults);
  break;
}
```

If `allResults.push(...iterResults);` already happened before this block, do not add it a second time.

- [ ] **Step 5: Run tests**

Run:

```powershell
npx vitest run scripts/run-scrapers.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add scripts/run-scrapers.ts scripts/run-scrapers.test.ts
git commit -m "fix(scrapers): stop enrichment loop on critical worker failure"
```

## Task 7: Right-Size AS24 Loop Throughput

**Files:**
- Modify: `.github/workflows/enrichment-loop.yml`
- Modify: `scripts/run-scrapers.ts`

- [ ] **Step 1: Increase scheduled default iterations**

In workflow dispatch defaults, change:

```yaml
default: '5'
```

to:

```yaml
default: '8'
```

For scheduled runs, change:

```yaml
--max-iterations=${{ github.event.inputs.max_iterations || '5' }}
```

to:

```yaml
--max-iterations=${{ github.event.inputs.max_iterations || '8' }}
```

- [ ] **Step 2: Increase AS24 batch budget inside loop only**

In `SCRAPERS`, leave the standalone AS24 definition conservative. In loop selection, clone AS24 scraper args:

```ts
function tuneForEnrichmentLoop(scraper: ScraperDef): ScraperDef {
  if (scraper.id !== "as24-enrich") return scraper;
  return {
    ...scraper,
    args: [
      "tsx",
      "scripts/as24-enrich-scrapling.ts",
      "--limit=750",
      "--timeBudgetMs=1800000",
      "--delayMs=1500",
    ],
    timeoutMs: 35 * 60_000,
  };
}
```

Then build:

```ts
const enrichScrapers = SCRAPERS
  .filter((s) => ENRICH_IDS.has(s.id) && (s.type === "cli" || devServerUp))
  .map(tuneForEnrichmentLoop);
```

- [ ] **Step 3: Run syntax check**

Run:

```powershell
npx tsx -e "import('./scripts/run-scrapers.ts').then(() => console.log('runner import ok'))"
```

Expected: `runner import ok`.

- [ ] **Step 4: Commit**

```powershell
git add .github/workflows/enrichment-loop.yml scripts/run-scrapers.ts
git commit -m "fix(scrapers): increase AS24 enrichment loop throughput"
```

## Task 8: Preserve Run Logs as GitHub Artifacts

**Files:**
- Modify: `.github/workflows/enrichment-loop.yml`

- [ ] **Step 1: Add artifact upload step**

After the `Run enrichment loop` step, add:

```yaml
      - name: Upload enrichment run logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: enrichment-loop-logs-${{ github.run_id }}
          path: logs/scraper-runs/*.json
          if-no-files-found: warn
```

- [ ] **Step 2: Validate workflow YAML by printing it**

Run:

```powershell
Get-Content .github\workflows\enrichment-loop.yml
```

Expected: upload step is aligned under `steps`, not inside the previous `run` block.

- [ ] **Step 3: Commit**

```powershell
git add .github/workflows/enrichment-loop.yml
git commit -m "ci(scrapers): upload enrichment loop run logs"
```

## Task 9: Full Verification Script

**Files:**
- No production file changes

- [ ] **Step 1: Run unit and route tests**

Run:

```powershell
npx vitest run tests/quality scripts/run-scrapers.test.ts src/app/api/cron/enrich-elferspot/route.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 2: Run TypeScript import checks**

Run:

```powershell
npx tsx -e "import('./scripts/enrich-loop-quality.ts').then(m => console.log(m.DEFAULT_TARGETS.length, 'targets'))"
npx tsx -e "import('./scripts/run-scrapers.ts').then(() => console.log('runner import ok'))"
```

Expected: first command prints `13 targets`; second prints `runner import ok`.

- [ ] **Step 3: Run dry loop smoke test**

Run:

```powershell
npx tsx scripts/run-scrapers.ts --enrich-loop --max-iterations=1 --pause=0 --dry-run
```

Expected:
- Initial quality table prints.
- One iteration starts.
- No DB writes occur.
- If critical workers fail because dry-run still calls external services, capture the first failed worker and do not classify the plan as complete until the failure is understood.

- [ ] **Step 4: Capture final quality baseline**

Run:

```powershell
npx tsx -e "import { createClient } from '@supabase/supabase-js'; import { checkQuality, printQualityReport } from './scripts/enrich-loop-quality.ts'; const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false}}); checkQuality(sb).then(printQualityReport)"
```

Expected: quality table prints current gaps. This is not expected to pass until the next real GitHub run drains backlog.

## Defect Report Template for Remaining Failures

Use this exact structure if a target remains red after implementation:

```md
Title:
Severity:
Frequency:
Phase:
Script identifier:
Environment matrix:
Build commit:
Reproduction steps:
Observed behavior:
Expected behavior:
Artifact references:
Suspected boundary:
Initial hypothesis:
Workaround:
Regression test status:
Owner:
```

## Execution Order and Pass/Fail Criteria

1. Task 1 passes if targets include owners and tests pass.
2. Task 2 passes if Classic enrichment queries null and empty descriptions.
3. Task 3 passes if Elferspot enrichment queries missing price-only rows.
4. Task 4 passes if BeForward short CI pages escalate instead of silently returning OK with zero recovered rows.
5. Task 5 passes if VIN/title discovered>0 + written=0 returns failed JSON and HTTP 500.
6. Task 6 passes if the loop stops on critical worker failure instead of spending hours retrying a known-broken path.
7. Task 7 passes if AS24 scheduled throughput is increased without changing standalone runner behavior.
8. Task 8 passes if GitHub uploads `logs/scraper-runs/*.json` even on failure.
9. Task 9 passes if all focused tests and import checks run with exit code 0.

## Self-Review

**Spec coverage:** Covers locks, GitHub Actions, stuck targets, criticality, BeForward CI failure, AS24 under-provisioning, Classic selector mismatch, Elferspot price selector mismatch, VIN/title zero-write masking, and artifact retention.

**Placeholder scan:** No TBD/TODO/implement-later placeholders. Each task includes file paths, concrete edits, commands, and expected observations.

**Type consistency:** `QualityTarget.owner`, `criticality`, `getTargetsByLabel`, `classifyShortBody`, `classifyEnrichmentOutcome`, and `hasCriticalLoopFailure` are defined before use in tests.
