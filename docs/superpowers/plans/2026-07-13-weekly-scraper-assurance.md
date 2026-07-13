# Weekly Scraper Assurance and Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a deterministic scraper-assurance harness that lets a weekly Codex worktree automation measure and restore 100% source-specific listing contract resolution, safely repair data and scraper code, and deliver validated code changes as draft pull requests.

**Architecture:** Consolidate scraper/source/job knowledge into one typed manifest, evaluate every active listing with pure source-contract logic, and expose that logic through a PostgreSQL-backed CLI that produces a machine-readable repair queue. A canary runner executes every source in dry-run mode without polluting operational health records; the Codex automation consumes deterministic reports, runs bounded enrichment, repairs code test-first, and opens a draft PR only when code changes.

**Tech Stack:** TypeScript 5.9, Node.js 20+, Next.js 16, Vitest 4, `pg`, existing scraper CLIs and enrichment loop, Codex worktree automations, GitHub CLI/GitHub app, Vercel production deployment.

---

## File map

- Create `src/features/scrapers/common/assurance/manifest.ts` — authoritative source, job, workflow, command, and field-contract inventory.
- Create `src/features/scrapers/common/assurance/manifest.test.ts` — uniqueness, filesystem, workflow, and source-registration gates.
- Create `src/features/scrapers/common/assurance/completeness.ts` — pure field usability, evidence validation, listing evaluation, and aggregate metrics.
- Create `src/features/scrapers/common/assurance/completeness.test.ts` — source-contract and evidence-state regression tests.
- Create `src/features/scrapers/common/assurance/database.ts` — active-listing query, report construction, previous-report comparison, and artifact persistence.
- Create `src/features/scrapers/common/assurance/database.test.ts` — report and repair-queue tests with in-memory rows.
- Create `src/features/scrapers/common/assurance/repairPolicy.ts` — mechanically enforced additive/corrective patch and evidence rules.
- Create `src/features/scrapers/common/assurance/repairPolicy.test.ts` — destructive-field and invalid-evidence rejection tests.
- Create `src/features/scrapers/common/assurance/canaries.ts` — bounded source command execution and result classification.
- Create `src/features/scrapers/common/assurance/canaries.test.ts` — command, timeout, output, and failure classification tests.
- Create `scripts/scraper-assurance.ts` — preflight, tests, scan, canary, bounded repair, rescan, report, and exit-code orchestration.
- Create `scripts/record-scraper-assurance-evidence.ts` — transactionally record verified field-resolution evidence only.
- Modify `src/features/scrapers/common/sourceRegistry.ts` — derive canonical sources and scraper mappings from the assurance manifest.
- Modify `src/features/scrapers/common/monitoring/record.ts` — suppress monitoring rows during assurance canaries.
- Modify `scripts/run-scrapers.ts` — import the authoritative job definitions instead of maintaining its own array.
- Modify `scripts/scraper-health-audit.ts` — import authoritative audit job specs and include contract metrics.
- Modify `scripts/coverage-snapshot.ts` — retain market metrics while consuming the shared source inventory.
- Modify `src/app/api/admin/scrapers/field-completeness/route.ts` — expose raw completeness and contract resolution from shared evaluation rules.
- Modify `package.json` — add focused test, scan, canary, and full assurance commands.
- Modify `.gitignore` — ignore timestamped scraper-assurance reports while preserving fixtures and code.
- Modify `docs/scrapers/SCRAPERS.md` — document the manifest, commands, safety boundary, and weekly run outcomes.

## Task 1: Extract the authoritative source and job manifest

**Files:**
- Create: `src/features/scrapers/common/assurance/manifest.ts`
- Create: `src/features/scrapers/common/assurance/manifest.test.ts`
- Modify: `src/features/scrapers/common/sourceRegistry.ts`
- Modify: `scripts/run-scrapers.ts`
- Modify: `scripts/scraper-health-audit.ts`

- [ ] **Step 1: Write the failing manifest tests**

```ts
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSURANCE_SOURCES,
  SCRAPER_JOBS,
  validateAssuranceManifest,
} from "./manifest";

describe("scraper assurance manifest", () => {
  it("registers every canonical marketplace source", () => {
    expect(ASSURANCE_SOURCES.map((source) => source.id).sort()).toEqual([
      "AutoScout24",
      "AutoTrader",
      "BaT",
      "BeForward",
      "CarsAndBids",
      "ClassicCom",
      "CollectingCars",
      "Elferspot",
    ]);
  });

  it("keeps job identifiers unique", () => {
    const ids = SCRAPER_JOBS.map((job) => job.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("accounts for scraper feature directories and workflow files", () => {
    expect(validateAssuranceManifest(path.resolve(process.cwd()))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and verify the missing-module failure**

Run: `npx vitest run src/features/scrapers/common/assurance/manifest.test.ts`

Expected: FAIL because `assurance/manifest.ts` does not exist.

- [ ] **Step 3: Define the manifest interfaces and all eight sources**

Create these exported contracts in `manifest.ts`:

```ts
import type { ScraperJobSpec } from "../monitoring/audit";

export type AssuranceSourceId =
  | "AutoScout24"
  | "AutoTrader"
  | "BaT"
  | "BeForward"
  | "CarsAndBids"
  | "ClassicCom"
  | "CollectingCars"
  | "Elferspot";

export type AssurancePhase =
  | "discovery"
  | "enrichment"
  | "maintenance"
  | "post-run";

export interface AssuranceCommand {
  command: string;
  args: readonly string[];
  timeoutMs: number;
}

export interface AssuranceJob {
  id: string;
  scraperName: ScraperJobSpec["scraperName"];
  label: string;
  phase: AssurancePhase;
  cadence: ScraperJobSpec["cadence"];
  sourceIds: readonly AssuranceSourceId[];
  workflowFiles: readonly string[];
  codePaths: readonly string[];
  testCommand?: AssuranceCommand;
  repairCommand?: AssuranceCommand;
  cronPath?: string;
  destructive: boolean;
}

export interface AssuranceSource {
  id: AssuranceSourceId;
  label: string;
  collectorJobIds: readonly string[];
  enrichmentJobIds: readonly string[];
  canary: AssuranceCommand;
}
```

Define `ASSURANCE_SOURCES` with all eight ids. Use these bounded dry-run canaries:

```ts
export const ASSURANCE_SOURCES: readonly AssuranceSource[] = [
  auctionSource("BaT", "Bring a Trailer"),
  auctionSource("CarsAndBids", "Cars & Bids"),
  auctionSource("CollectingCars", "Collecting Cars"),
  source("AutoScout24", "AutoScout24", "autoscout24", [
    "tsx", "src/features/scrapers/autoscout24_collector/cli.ts",
    "--maxPagesPerShard=1", "--maxListings=20", "--timeBudgetMs=120000", "--dryRun",
  ]),
  source("AutoTrader", "AutoTrader UK", "autotrader", [
    "tsx", "src/features/scrapers/autotrader_collector/cli.ts",
    "--maxPages=1", "--noDetails", "--dryRun",
  ]),
  source("BeForward", "BeForward", "beforward", [
    "tsx", "scripts/bf-collector-cli.ts",
    "--maxPages=1", "--summaryOnly", "--dryRun", "--rateLimitMs=3000",
  ]),
  source("ClassicCom", "Classic.com", "classic", [
    "tsx", "src/features/scrapers/classic_collector/cli.ts",
    "--maxPages=1", "--maxListings=20", "--dryRun",
  ]),
  source("Elferspot", "Elferspot", "elferspot", [
    "tsx", "src/features/scrapers/elferspot_collector/cli.ts",
    "--maxPages=1", "--maxListings=20", "--dryRun", "--fresh",
  ]),
] as const;
```

`auctionSource()` must create a canary using `porsche_collector/cli.ts`, `--mode=daily`, the exact `--sources=<id>`, one active page, zero ended pages, no details, a 120-second budget, and `--dryRun`.

- [ ] **Step 4: Move existing runner jobs into the manifest**

Move the complete current `SCRAPERS` definition from `scripts/run-scrapers.ts` into exported `SCRAPER_JOBS`. Preserve command arguments, dry-run flags, defaults, timeouts, and phases. Add `sourceIds`, `workflowFiles`, `codePaths`, `cadence`, `scraperName`, and `destructive` to every entry. Mark only cleanup, liveness status mutation, and AutoTrader delist execution as destructive; they must never be selected by assurance repair mode.

Export runner-compatible and audit-compatible projections:

```ts
export const RUNNER_SCRAPERS = SCRAPER_JOBS.map(toRunnerScraperDef);

export const ASSURANCE_AUDIT_JOB_SPECS: ScraperJobSpec[] = SCRAPER_JOBS.map((job) => ({
  scraperName: job.scraperName,
  label: job.label,
  cadence: job.cadence,
  cronPath: job.cronPath,
}));
```

- [ ] **Step 5: Implement manifest drift detection**

`validateAssuranceManifest(rootDir)` must:

```ts
export function validateAssuranceManifest(rootDir: string): string[] {
  const errors: string[] = [];
  validateUniqueIds(errors);
  validateSourceJobReferences(errors);
  validateDeclaredPaths(rootDir, errors);
  validateWorkflowCoverage(rootDir, errors);
  validateFeatureDirectoryCoverage(rootDir, errors);
  return errors.sort();
}
```

The explicit ignored feature directories are `common`, `ferrari_history`, `liveness_checker`, and `porsche_ingest`; each is covered by a maintenance job or shared infrastructure rather than representing an independent marketplace. The `auctions` directory is covered by the three auction source contracts. Every `.github/workflows/*.yml` file must appear in a job's `workflowFiles` list.

- [ ] **Step 6: Replace duplicate registries with manifest projections**

Update `sourceRegistry.ts` to export canonical source definitions derived from `ASSURANCE_SOURCES`. Add `getSourcesForScraper(scraperName): readonly CanonicalSource[]`. Preserve `getSourceForScraper()` as the first mapped source for compatibility and add a regression test proving `porsche` maps to BaT, CarsAndBids, and CollectingCars through the plural API.

Update `run-scrapers.ts` to import `RUNNER_SCRAPERS`. Update `scraper-health-audit.ts` to import `ASSURANCE_AUDIT_JOB_SPECS` and remove its private `JOB_SPECS` array.

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npx vitest run src/features/scrapers/common/assurance/manifest.test.ts src/features/scrapers/common/monitoring/audit.test.ts
```

Expected: PASS and zero manifest drift errors.

- [ ] **Step 8: Commit the manifest slice**

```powershell
git add src/features/scrapers/common/assurance/manifest.ts src/features/scrapers/common/assurance/manifest.test.ts src/features/scrapers/common/sourceRegistry.ts scripts/run-scrapers.ts scripts/scraper-health-audit.ts
git commit -m "refactor(scrapers): centralize assurance manifest"
```

## Task 2: Implement source-specific completeness evaluation

**Files:**
- Create: `src/features/scrapers/common/assurance/completeness.ts`
- Create: `src/features/scrapers/common/assurance/completeness.test.ts`
- Modify: `src/features/scrapers/common/assurance/manifest.ts`

- [ ] **Step 1: Write failing field-evaluation tests**

```ts
import { describe, expect, it } from "vitest";
import { evaluateListing } from "./completeness";
import { getAssuranceSource } from "./manifest";

const complete = {
  id: "listing-1",
  source: "AutoScout24",
  source_id: "as24-1",
  source_url: "https://example.test/car/1",
  title: "2020 Porsche 911 Carrera",
  make: "Porsche",
  model: "911 Carrera",
  year: 2020,
  status: "active",
  listing_price: 90000,
  original_currency: "EUR",
  images: ["https://example.test/car.jpg"],
  location: "Berlin, Germany",
  vin: "WP0ZZZ99ZLS123456",
  trim: "Carrera",
  engine: "3.0L Flat-6",
  transmission: "PDK",
  mileage: 12000,
  mileage_unit: "km",
  color_exterior: "Black",
  color_interior: "Black",
  body_style: "Coupe",
  description_text: "Dealer description",
  enrichment_meta: {},
};

describe("evaluateListing", () => {
  it("passes a fully populated source contract", () => {
    const result = evaluateListing(complete, getAssuranceSource("AutoScout24"), new Date("2026-07-13"));
    expect(result.unresolved).toEqual([]);
    expect(result.rawCompletenessPct).toBe(100);
    expect(result.contractResolutionPct).toBe(100);
  });

  it("rejects a silent blank", () => {
    const result = evaluateListing({ ...complete, engine: null }, getAssuranceSource("AutoScout24"), new Date("2026-07-13"));
    expect(result.unresolved).toContainEqual(expect.objectContaining({ field: "engine", reason: "missing" }));
  });

  it("accepts fresh verified source unavailability without inflating raw completeness", () => {
    const result = evaluateListing({
      ...complete,
      vin: null,
      enrichment_meta: {
        assurance: {
          fields: {
            vin: {
              state: "unavailable_at_source",
              checkedAt: "2026-07-12T12:00:00.000Z",
              sourceUrl: complete.source_url,
              method: "detail-page-inspection",
              evidenceHash: "sha256:abc",
            },
          },
        },
      },
    }, getAssuranceSource("AutoScout24"), new Date("2026-07-13"));
    expect(result.contractResolutionPct).toBe(100);
    expect(result.rawCompletenessPct).toBeLessThan(100);
  });

  it("expires unavailable evidence after thirty days", () => {
    const result = evaluateListing({
      ...complete,
      vin: null,
      enrichment_meta: {
        assurance: { fields: { vin: {
          state: "unavailable_at_source",
          checkedAt: "2026-05-01T12:00:00.000Z",
          sourceUrl: complete.source_url,
          method: "detail-page-inspection",
          evidenceHash: "sha256:abc",
        } } },
      },
    }, getAssuranceSource("AutoScout24"), new Date("2026-07-13"));
    expect(result.unresolved).toContainEqual(expect.objectContaining({ field: "vin", reason: "evidence_expired" }));
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npx vitest run src/features/scrapers/common/assurance/completeness.test.ts`

Expected: FAIL because the evaluator does not exist.

- [ ] **Step 3: Define field and evidence contracts**

```ts
export const ASSURANCE_FIELDS = [
  "source", "source_id", "source_url", "title", "make", "model", "year", "status",
  "price", "original_currency", "images", "location",
  "vin", "trim", "engine", "transmission", "mileage", "mileage_unit",
  "color_exterior", "color_interior", "body_style", "description_text",
] as const;

export type AssuranceField = typeof ASSURANCE_FIELDS[number];
export type ResolutionState =
  | "populated_from_source"
  | "populated_from_authoritative_enrichment"
  | "unavailable_at_source"
  | "temporarily_blocked"
  | "invalid_source_value";

export interface FieldEvidence {
  state: ResolutionState;
  checkedAt: string;
  sourceUrl: string;
  method: string;
  evidenceHash: `sha256:${string}`;
  retryAfter?: string;
}
```

Extend each source in the manifest with `requiredFields`, `unavailableFields`, and `repairJobIds`. Identity fields and images cannot be unavailable. VIN, trim, engine, transmission, mileage, colors, body style, description, and source-published location may use verified unavailability. Price may use verified unavailability for `price_on_request` classified listings and auctions with no bid; currency is resolved when price is unavailable for that reason.

- [ ] **Step 4: Implement pure field usability and evidence validation**

`evaluateListing()` must normalize empty strings and placeholders (`Unknown`, `N/A`, `Not specified`, `-`) as missing. Synthetic `price` is usable when any of `listing_price`, `current_bid`, `hammer_price`, `final_price`, or `sold_price` is positive. Synthetic `location` is usable when any of `location`, `city`, `region`, or `country` is present. Images require at least one valid HTTP(S) URL.

Evidence counts only when the field is in `unavailableFields`, state is `unavailable_at_source`, the URL equals the listing's current `source_url`, the hash begins with `sha256:`, and `checkedAt` is no older than 30 days.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/features/scrapers/common/assurance/completeness.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the completeness slice**

```powershell
git add src/features/scrapers/common/assurance/completeness.ts src/features/scrapers/common/assurance/completeness.test.ts src/features/scrapers/common/assurance/manifest.ts
git commit -m "feat(scrapers): define listing completeness contracts"
```

## Task 3: Build the full-database scanner and repair queue

**Files:**
- Create: `src/features/scrapers/common/assurance/database.ts`
- Create: `src/features/scrapers/common/assurance/database.test.ts`
- Modify: `scripts/coverage-snapshot.ts`

- [ ] **Step 1: Write failing aggregate and inventory tests**

```ts
import { describe, expect, it } from "vitest";
import { buildAssuranceReport } from "./database";

describe("buildAssuranceReport", () => {
  it("creates a listing-level repair queue and fails unknown sources", () => {
    const report = buildAssuranceReport([
      completeListing({ id: "a", source: "AutoScout24", engine: null }),
      completeListing({ id: "b", source: "UnregisteredMarket" }),
    ], [], new Date("2026-07-13T12:00:00Z"));

    expect(report.inventory.unknownDatabaseSources).toEqual(["UnregisteredMarket"]);
    expect(report.repairQueue).toContainEqual(expect.objectContaining({
      listingId: "a",
      source: "AutoScout24",
      field: "engine",
    }));
    expect(report.outcome).toBe("blocked");
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run src/features/scrapers/common/assurance/database.test.ts`

Expected: FAIL because `database.ts` does not exist.

- [ ] **Step 3: Implement the active-listing query**

Use `pg` and one read-only query selecting every active row and all contract columns:

```sql
SELECT id, source, source_id, source_url, title, make, model, year, status,
       listing_price, current_bid, hammer_price, final_price, sold_price,
       original_currency, images, photos_count, location, city, region, country,
       vin, trim, engine, transmission, mileage, mileage_unit,
       color_exterior, color_interior, body_style, description_text,
       enrichment_meta, created_at, updated_at
FROM public.listings
WHERE status::text = 'active'
ORDER BY source, id
```

Run the query inside a read-only transaction and return every row; do not paginate through the Supabase REST default limit.

- [ ] **Step 4: Implement report aggregation**

```ts
export interface ScraperAssuranceReport {
  generatedAt: string;
  outcome: "healthy" | "repaired" | "blocked";
  inventory: {
    declaredSources: string[];
    observedDatabaseSources: string[];
    unknownDatabaseSources: string[];
  };
  totals: {
    activeListings: number;
    requiredFields: number;
    populatedFields: number;
    resolvedFields: number;
    unresolvedFields: number;
    rawCompletenessPct: number;
    contractResolutionPct: number;
  };
  sources: SourceAssuranceSummary[];
  repairQueue: RepairQueueItem[];
  canaries: CanaryResult[];
  tests: CommandResult[];
  comparison?: WeeklyComparison;
}
```

Sort repair-queue items by source, listing id, and field for deterministic output. Cap the human summary at 100 examples while retaining the full machine-readable queue in the local artifact.

- [ ] **Step 5: Add timestamped artifact persistence and previous-run comparison**

Write reports to `agents/testscripts/artifacts/scraper-assurance-<timestamp>.json`. Locate the most recent prior report, compare per-source raw completeness, contract resolution, unavailable counts, and unresolved counts, and mark raw-completeness regression when it drops by more than 0.1 percentage points without an explanatory evidence-state change.

- [ ] **Step 6: Share source inventory with coverage snapshots**

Update `coverage-snapshot.ts` so unknown database sources produce a source alert and all eight manifest sources appear even when they have zero current rows. Preserve existing market coverage output.

- [ ] **Step 7: Run focused database and coverage tests**

Run:

```powershell
npx vitest run src/features/scrapers/common/assurance/database.test.ts tests/integration/coverage-snapshot.test.ts
```

Expected: PASS. The live read-only scan is executed after Task 6 creates the orchestration CLI.

- [ ] **Step 8: Commit the database slice**

```powershell
git add src/features/scrapers/common/assurance/database.ts src/features/scrapers/common/assurance/database.test.ts scripts/coverage-snapshot.ts
git commit -m "feat(scrapers): scan listing contract coverage"
```

## Task 4: Enforce safe evidence and production repair boundaries

**Files:**
- Create: `src/features/scrapers/common/assurance/repairPolicy.ts`
- Create: `src/features/scrapers/common/assurance/repairPolicy.test.ts`
- Create: `scripts/record-scraper-assurance-evidence.ts`

- [ ] **Step 1: Write failing safety tests**

```ts
import { describe, expect, it } from "vitest";
import { assertSafeListingPatch, buildEvidencePatch } from "./repairPolicy";

describe("scraper assurance repair policy", () => {
  it("rejects lifecycle mutation", () => {
    expect(() => assertSafeListingPatch({ status: "delisted" })).toThrow("Prohibited listing field: status");
  });

  it("rejects identity mutation", () => {
    expect(() => assertSafeListingPatch({ source: "Other" })).toThrow("Prohibited listing field: source");
  });

  it("requires evidence for unavailable fields", () => {
    expect(() => buildEvidencePatch({
      field: "vin",
      state: "unavailable_at_source",
      checkedAt: "2026-07-13T00:00:00Z",
      sourceUrl: "https://example.test/car/1",
      method: "detail-page-inspection",
      evidenceHash: "",
    })).toThrow("evidenceHash");
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npx vitest run src/features/scrapers/common/assurance/repairPolicy.test.ts`

Expected: FAIL because the repair policy does not exist.

- [ ] **Step 3: Implement the write whitelist**

Permit only additive or corrective data fields plus `enrichment_meta`:

```ts
const SAFE_LISTING_PATCH_FIELDS = new Set([
  "listing_price", "current_bid", "hammer_price", "final_price", "sold_price",
  "original_currency", "images", "photos_count", "location", "city", "region", "country",
  "vin", "trim", "engine", "transmission", "mileage", "mileage_unit",
  "color_exterior", "color_interior", "body_style", "description_text", "seller_notes",
  "enrichment_meta",
]);
```

Reject `id`, `source`, `source_id`, `source_url`, `status`, timestamps, and every unknown key. Never expose a generic SQL patch option in the CLI.

- [ ] **Step 4: Implement the evidence-recording CLI**

Accept exactly:

```text
--listing=<uuid>
--field=<AssuranceField>
--state=unavailable_at_source|temporarily_blocked|invalid_source_value
--source-url=<https-url>
--method=<non-empty-string>
--evidence-hash=sha256:<hex>
--retry-after=<ISO8601 optional>
```

In one transaction, select the active listing `FOR UPDATE`, confirm source URL equality, confirm the source contract permits unavailability for that field, merge under `enrichment_meta.assurance.fields[field]`, run `assertSafeListingPatch`, update only `enrichment_meta`, reread the row, and commit. Print a redacted JSON confirmation containing listing id, field, state, and checked timestamp.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/features/scrapers/common/assurance/repairPolicy.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the repair-policy slice**

```powershell
git add src/features/scrapers/common/assurance/repairPolicy.ts src/features/scrapers/common/assurance/repairPolicy.test.ts scripts/record-scraper-assurance-evidence.ts
git commit -m "feat(scrapers): guard assurance repairs"
```

## Task 5: Add bounded live canaries without health-record pollution

**Files:**
- Create: `src/features/scrapers/common/assurance/canaries.ts`
- Create: `src/features/scrapers/common/assurance/canaries.test.ts`
- Modify: `src/features/scrapers/common/monitoring/record.ts`
- Create: `src/features/scrapers/common/monitoring/record.test.ts`

- [ ] **Step 1: Write failing canary tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { runSourceCanary } from "./canaries";

describe("runSourceCanary", () => {
  it("sets canary mode, preserves dry-run, and classifies nonzero discovery", async () => {
    const execute = vi.fn(async () => ({ exitCode: 0, stdout: "discovered=3 written=0", stderr: "", durationMs: 100 }));
    const result = await runSourceCanary(fakeSource("AutoTrader"), execute);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      env: expect.objectContaining({ SCRAPER_ASSURANCE_CANARY: "1" }),
    }));
    expect(result.status).toBe("healthy");
    expect(result.discovered).toBe(3);
  });

  it("fails zero discovery and blocking output", async () => {
    const execute = vi.fn(async () => ({ exitCode: 0, stdout: "discovered=0", stderr: "captcha challenge", durationMs: 100 }));
    const result = await runSourceCanary(fakeSource("AutoTrader"), execute);
    expect(result.status).toBe("blocked");
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npx vitest run src/features/scrapers/common/assurance/canaries.test.ts`

Expected: FAIL because the canary runner does not exist.

- [ ] **Step 3: Suppress operational records during canaries**

At the top of every exported write function in `monitoring/record.ts`, return a successful no-op when:

```ts
function assuranceCanaryActive(): boolean {
  return process.env.SCRAPER_ASSURANCE_CANARY === "1";
}
```

Add a monitoring regression test proving `recordScraperRun`, `markScraperRunStarted`, `clearScraperRunActive`, and `clearStaleActiveRun` do not call Supabase in canary mode.

- [ ] **Step 4: Implement bounded command execution**

Spawn `npx` with the manifest's exact argument array, `shell: false`, inherited environment plus `SCRAPER_ASSURANCE_CANARY=1`, captured output, and a hard timeout. Classify:

- `healthy`: exit 0, discovered count greater than zero, no block signature;
- `failed`: nonzero exit, timeout, malformed output, or parser errors;
- `blocked`: CAPTCHA, WAF, access denied, robots denial, or challenge-page signature;
- `empty`: exit 0 with verified zero discovery.

Redact URL credentials, bearer tokens, cookies, and proxy environment values from captured output before persistence.

- [ ] **Step 5: Run focused canary and monitoring tests**

Run:

```powershell
npx vitest run src/features/scrapers/common/assurance/canaries.test.ts src/features/scrapers/common/monitoring/record.test.ts
```

Expected: PASS. The live eight-source canary pass is executed after Task 6 creates the orchestration CLI.

- [ ] **Step 6: Commit the canary slice**

```powershell
git add src/features/scrapers/common/assurance/canaries.ts src/features/scrapers/common/assurance/canaries.test.ts src/features/scrapers/common/monitoring/record.ts src/features/scrapers/common/monitoring/record.test.ts
git commit -m "feat(scrapers): add bounded source canaries"
```

## Task 6: Build the one-command assurance orchestrator

**Files:**
- Create: `scripts/scraper-assurance.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add failing CLI parsing tests**

Export and test `parseAssuranceArgs()`:

```ts
expect(parseAssuranceArgs(["--mode=full", "--repair", "--max-repair-iterations=2"])).toEqual({
  mode: "full",
  repair: true,
  maxRepairIterations: 2,
  artifactDir: "agents/testscripts/artifacts",
});
expect(() => parseAssuranceArgs(["--mode=full", "--repair", "--allow-destructive"])).toThrow("Unsupported argument");
```

- [ ] **Step 2: Implement preflight and modes**

Support only `scan`, `canary`, and `full` modes. `scan` requires `DATABASE_URL`. `canary` requires the source-specific scraper environment. `full --repair` additionally requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` when cron enrichment is selected.

Preflight must report missing variable names without printing values.

- [ ] **Step 3: Implement the full orchestration flow**

```ts
async function runFull(args: AssuranceArgs): Promise<ScraperAssuranceReport> {
  const tests = await runFocusedAssuranceTests();
  const inventoryErrors = validateAssuranceManifest(process.cwd());
  const initial = await scanDatabase();
  const canaries = await runAllSourceCanaries();
  let final = initial;

  if (args.repair && initial.totals.unresolvedFields > 0) {
    await runBoundedEnrichment(args.maxRepairIterations);
    final = await scanDatabase();
  }

  return finalizeReport({ initial, final, canaries, tests, inventoryErrors });
}
```

`runBoundedEnrichment()` must call the existing non-destructive enrichment loop only:

```text
npx tsx scripts/run-scrapers.ts --enrich-loop --max-iterations=<N> --pause=1
```

The existing enrichment loop excludes cleanup and delist jobs; retain and test that exclusion. The final assurance scanner, not the legacy enrichment thresholds, determines success.

- [ ] **Step 4: Define deterministic exit codes**

- `0`: healthy or repaired with 100% contract resolution, all tests pass, every canary healthy.
- `1`: local implementation/test/preflight failure.
- `2`: unresolved listing gaps remain after bounded repair.
- `3`: one or more sources are externally blocked.
- `4`: inventory drift or unknown database source.

Always persist the report before exiting nonzero when database access succeeded.

- [ ] **Step 5: Add package commands and artifact ignore**

```json
{
  "test:scraper-assurance": "vitest run src/features/scrapers/common/assurance tests/integration/coverage-snapshot.test.ts",
  "scrapers:assurance:scan": "tsx scripts/scraper-assurance.ts --mode=scan",
  "scrapers:assurance:canary": "tsx scripts/scraper-assurance.ts --mode=canary",
  "scrapers:assurance": "tsx scripts/scraper-assurance.ts --mode=full",
  "scrapers:assurance:repair": "tsx scripts/scraper-assurance.ts --mode=full --repair --max-repair-iterations=3"
}
```

Add `agents/testscripts/artifacts/scraper-assurance-*.json` to `.gitignore`.

- [ ] **Step 6: Run focused and integration tests**

Run:

```powershell
npm run test:scraper-assurance
npm run scrapers:assurance:scan
```

Expected: tests PASS. The scan deterministically reports the live baseline and exits according to unresolved count.

- [ ] **Step 7: Commit the orchestrator slice**

```powershell
git add scripts/scraper-assurance.ts package.json package-lock.json .gitignore
git commit -m "feat(scrapers): orchestrate assurance checks"
```

## Task 7: Integrate contract truth into existing monitoring and admin reporting

**Files:**
- Modify: `scripts/scraper-health-audit.ts`
- Modify: `src/app/api/admin/scrapers/field-completeness/route.ts`
- Modify: `src/features/scrapers/common/monitoring/audit.ts`
- Test: `src/features/scrapers/common/monitoring/audit.test.ts`
- Test: `src/app/api/admin/scrapers/field-completeness/route.test.ts`

- [ ] **Step 1: Write failing monitoring integration tests**

Add assertions that a scraper cannot be `working` when its source has unresolved contract fields, that raw and resolved percentages remain separate, and that `blocked`/`invalid_source_value` evidence never counts as resolved.

```ts
expect(applyContractCoverageGate(workingSummary, {
  rawCompletenessPct: 92,
  contractResolutionPct: 99.9,
  unresolvedFields: 1,
})).toMatchObject({ status: "degraded" });
```

- [ ] **Step 2: Use shared evaluator results in the health audit**

Include report fields:

```ts
contract_coverage: {
  active_listings: number;
  raw_completeness_pct: number;
  contract_resolution_pct: number;
  unresolved_fields: number;
  unavailable_fields: number;
};
```

Mark source jobs degraded for any unresolved field and failed when a source has historical rows but zero active rows without a verified external-empty condition.

- [ ] **Step 3: Update the admin field-completeness response**

Preserve the existing per-field percentages. Add `rawCompleteness`, `contractResolution`, `unresolvedFields`, and `verifiedUnavailableFields` per source. Query the evidence metadata required by the shared evaluator. Keep authorization behavior unchanged.

- [ ] **Step 4: Run route, monitoring, and assurance tests**

Run:

```powershell
npx vitest run src/features/scrapers/common/monitoring/audit.test.ts src/app/api/admin/scrapers/field-completeness/route.test.ts
npm run test:scraper-assurance
```

Expected: PASS.

- [ ] **Step 5: Commit the monitoring integration**

```powershell
git add scripts/scraper-health-audit.ts src/features/scrapers/common/monitoring/audit.ts src/features/scrapers/common/monitoring/audit.test.ts src/app/api/admin/scrapers/field-completeness/route.ts src/app/api/admin/scrapers/field-completeness/route.test.ts
git commit -m "feat(scrapers): gate health on contract coverage"
```

## Task 8: Document, verify, repair the live baseline, deploy, and schedule

**Files:**
- Modify: `docs/scrapers/SCRAPERS.md`
- Verify: all files changed by Tasks 1–7
- External action: create the Codex automation after project discovery
- External action: publish the implementation branch and deploy the approved initial implementation

- [ ] **Step 1: Document operator commands and outcomes**

Document:

```text
npm run test:scraper-assurance
npm run scrapers:assurance:scan
npm run scrapers:assurance:canary
npm run scrapers:assurance
npm run scrapers:assurance:repair
```

Explain `healthy`, `repaired`, and `blocked`, exit codes 0–4, evidence expiry, raw versus resolved completeness, the no-destructive-writes rule, and where timestamped reports are stored.

- [ ] **Step 2: Run static verification**

Run:

```powershell
npm run test:scraper-assurance
npm run test:scrapers
npm run test:integration
npm run lint
npm run build
```

Expected: all commands exit 0. If unrelated pre-existing failures remain, isolate and document them before continuing; do not claim a clean deployment.

- [ ] **Step 3: Run the live read-only assurance pass**

Run:

```powershell
npm run scrapers:assurance:scan
npm run scrapers:assurance:canary
```

Expected: every active listing is counted and every source returns a classified canary. Preserve the generated baseline report.

- [ ] **Step 4: Run bounded production repair**

Start the local Next.js server with production credentials available, then run:

```powershell
npm run scrapers:assurance:repair
```

Expected: additive/corrective enrichment runs only; no cleanup or delist job executes; the final report either reaches 100% contract resolution or exits blocked with an exact repair queue.

- [ ] **Step 5: Perform final verification after live writes**

Run:

```powershell
npm run scrapers:assurance:scan
npm run test:scraper-assurance
npm run build
```

Expected: code tests and build pass; production completeness matches the final report.

- [ ] **Step 6: Commit documentation and final fixes**

```powershell
git add docs/scrapers/SCRAPERS.md
git commit -m "docs(scrapers): document weekly assurance operations"
```

- [ ] **Step 7: Publish and deploy the initial implementation**

Push the implementation branch and open a draft PR with test, canary, live-repair, and build evidence. After the initial implementation is approved for production, merge it and deploy through the repository's existing Vercel-linked workflow. Install the missing global CLI before direct platform validation:

```powershell
npm i -g vercel
vercel env pull
vercel deploy --prod
vercel logs
```

Expected: production deployment succeeds and the admin completeness endpoint returns the shared contract metrics. Do not merge or deploy a weekly repair PR automatically; this step applies only to the initial approved assurance implementation.

- [ ] **Step 8: Create the weekly Codex worktree automation**

Use the repository's project id returned by the Codex project-listing capability. Create an enabled cron automation named `Weekly Scraper Assurance & Repair`, execution environment `worktree`, scheduled Sunday 18:00 Europe/Berlin, with a local environment configuration that exposes the required database, scraper, browser, and GitHub credentials without copying `.env.local` into Git.

Use this task prompt:

```text
Run the repository's weekly scraper assurance workflow. Read AGENTS.md and docs/superpowers/specs/2026-07-13-weekly-scraper-assurance-design.md first. Execute npm run test:scraper-assurance and npm run scrapers:assurance:repair. Inspect the structured report and every failed source canary. For code defects, reproduce the smallest failing path, add a regression fixture or test, patch the smallest scraper boundary, rerun focused tests and the affected bounded live canary, then rerun the full assurance scan. Make at most three evidence-driven repair attempts per source. Production writes are limited to additive or corrective listing enrichment and field-resolution evidence; never delete listings, change listing lifecycle status in bulk, run migrations, change secrets, bypass marketplace access controls, merge, or deploy. If code changed and all deterministic gates pass, commit in the isolated worktree, push a codex/ prefixed branch, and open a draft PR with before/after completeness, canary, test, and build evidence. If no code changed, report the healthy or data-repaired result without a PR. If any unresolved field, blocked source, missing credential, or unsafe required change remains, report BLOCKED with the exact source, listings, fields, attempts, evidence, and required human action. Never report success unless all declared jobs were checked, every source canary is healthy, every active listing was evaluated, and contract resolution is 100%.
```

- [ ] **Step 9: Verify the automation configuration**

View the created automation and confirm its name, enabled status, worktree destination, repository project id, Sunday 18:00 Europe/Berlin schedule, model/reasoning configuration, and full prompt. Record the first scheduled run time in the handoff.

- [ ] **Step 10: Final handoff**

Report implemented architecture, exact tests and live commands, baseline and post-repair metrics, production deployment URL/status, automation id and next run, draft PR URL, remaining blockers, and the safety guarantees proven by tests.

## Plan self-review

- Spec coverage: Tasks 1–8 cover authoritative inventory, source contracts, field evidence, full active-listing scans, bounded canaries, safe repairs, LLM repair input, monitoring integration, draft PR delivery, deployment, and weekly scheduling.
- Scope: one vertical operational system; existing daily scraper workflows remain intact.
- Type consistency: source ids, fields, evidence states, report outcomes, and exit codes use one definition throughout.
- Safety consistency: repair mode never selects cleanup or delist jobs; evidence updates cannot mutate listing identity or lifecycle status.
- No placeholder implementation steps remain.
