import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  executeCanaryCommand,
  runSourceCanary,
  type CommandExecutor,
} from "../src/features/scrapers/common/assurance/canaries";
import {
  buildAssuranceReport,
  compareAssuranceReports,
  fetchActiveListings,
  persistAssuranceReport,
  readPreviousAssuranceReport,
  type CommandResult,
  type ScraperAssuranceReport,
} from "../src/features/scrapers/common/assurance/database";
import {
  ASSURANCE_SOURCES,
  validateAssuranceManifest,
} from "../src/features/scrapers/common/assurance/manifest";

export type AssuranceMode = "scan" | "canary" | "full";

export interface AssuranceArgs {
  mode: AssuranceMode;
  repair: boolean;
  maxRepairIterations: number;
  artifactDir: string;
}

const DEFAULT_ARTIFACT_DIR = "agents/testscripts/artifacts";

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadEnvironment(): void {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env"));
}

export function parseAssuranceArgs(args: string[]): AssuranceArgs {
  let mode: AssuranceMode = "full";
  let repair = false;
  let maxRepairIterations = 3;
  let artifactDir = DEFAULT_ARTIFACT_DIR;

  for (const argument of args) {
    if (argument === "--repair") {
      repair = true;
      continue;
    }
    if (argument.startsWith("--mode=")) {
      const value = argument.slice("--mode=".length);
      if (!(["scan", "canary", "full"] as const).includes(value as AssuranceMode)) {
        throw new Error(`Unsupported assurance mode: ${value}`);
      }
      mode = value as AssuranceMode;
      continue;
    }
    if (argument.startsWith("--max-repair-iterations=")) {
      const value = Number(argument.slice("--max-repair-iterations=".length));
      if (!Number.isInteger(value) || value < 1 || value > 10) {
        throw new Error("--max-repair-iterations must be an integer from 1 to 10");
      }
      maxRepairIterations = value;
      continue;
    }
    if (argument.startsWith("--artifact-dir=")) {
      const value = argument.slice("--artifact-dir=".length).trim();
      if (!value) throw new Error("--artifact-dir must be non-empty");
      artifactDir = value;
      continue;
    }
    throw new Error(`Unsupported argument: ${argument}`);
  }
  if (repair && mode !== "full") throw new Error("Repair is supported only in full mode");
  return { mode, repair, maxRepairIterations, artifactDir };
}

export function requiredEnvironment(args: AssuranceArgs): string[] {
  const required = new Set<string>();
  if (args.mode === "scan" || args.mode === "full") required.add("DATABASE_URL");
  if (args.mode === "canary" || args.mode === "full") {
    required.add("NEXT_PUBLIC_SUPABASE_URL");
    required.add("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (args.repair) required.add("CRON_SECRET");
  return Array.from(required).sort();
}

export function assertAssurancePreflight(args: AssuranceArgs): void {
  const missing = requiredEnvironment(args).filter((name) => !process.env[name]);
  if (missing.length > 0) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

async function runFocusedAssuranceTests(
  execute: CommandExecutor = executeCanaryCommand,
): Promise<CommandResult> {
  const result = await execute({
    command: "npx",
    args: [
      "vitest",
      "run",
      "src/features/scrapers/common/assurance",
      "src/features/scrapers/common/monitoring/record.test.ts",
      "tests/integration/coverage-snapshot.test.ts",
      "scripts/scraper-assurance.test.ts",
      "scripts/run-scrapers.test.ts",
    ],
    timeoutMs: 120_000,
    env: { ...process.env, SCRAPER_ASSURANCE_CANARY: "1" },
    shell: false,
  });
  return {
    id: "focused-assurance-tests",
    ok: result.exitCode === 0 && !result.timedOut,
    durationMs: result.durationMs,
    summary: result.exitCode === 0 && !result.timedOut
      ? "Focused assurance tests passed"
      : `Focused assurance tests failed (exit=${result.exitCode}, timeout=${result.timedOut})`,
  };
}

export async function runBoundedEnrichment(
  maxIterations: number,
  execute: CommandExecutor = executeCanaryCommand,
): Promise<CommandResult> {
  const result = await execute({
    command: "npx",
    args: [
      "tsx",
      "scripts/run-scrapers.ts",
      "--enrich-loop",
      `--max-iterations=${maxIterations}`,
      "--pause=1",
    ],
    timeoutMs: Math.max(30 * 60_000, maxIterations * 4 * 60 * 60_000),
    env: {
      ...process.env,
      SCRAPER_RUNNER_BASE_URL:
        process.env.SCRAPER_RUNNER_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    },
    shell: false,
  });
  return {
    id: "bounded-enrichment-loop",
    ok: result.exitCode === 0 && !result.timedOut,
    durationMs: result.durationMs,
    summary: result.exitCode === 0 && !result.timedOut
      ? `Bounded enrichment completed (${maxIterations} max iterations)`
      : `Bounded enrichment failed (exit=${result.exitCode}, timeout=${result.timedOut})`,
  };
}

export async function runRegisteredJobHealthAudit(
  execute: CommandExecutor = executeCanaryCommand,
): Promise<CommandResult> {
  const result = await execute({
    command: "npx",
    args: ["tsx", "scripts/scraper-health-audit.ts", "--json", "--strict"],
    timeoutMs: 5 * 60_000,
    env: { ...process.env, SCRAPER_ASSURANCE_CANARY: "1" },
    shell: false,
  });
  return {
    id: "registered-job-health-audit",
    ok: result.exitCode === 0 && !result.timedOut,
    durationMs: result.durationMs,
    summary: result.exitCode === 0 && !result.timedOut
      ? "Every registered operational job passed the strict health audit"
      : `Registered job health audit failed (exit=${result.exitCode}, timeout=${result.timedOut})`,
  };
}

async function runAllSourceCanaries() {
  const results = [];
  for (const source of ASSURANCE_SOURCES) {
    for (const canary of source.canaries) {
      console.log(`[assurance] Canary: ${source.label} / ${canary.jobId}`);
      results.push(await runSourceCanary(source, canary));
    }
  }
  return results;
}

function applyInventoryErrors(report: ScraperAssuranceReport, manifestErrors: string[]): void {
  report.inventory.manifestErrors = [...manifestErrors];
  if (manifestErrors.length > 0) report.outcome = "blocked";
}

function attachPreviousComparison(report: ScraperAssuranceReport, artifactDir: string): void {
  const previous = readPreviousAssuranceReport(artifactDir);
  if (previous) report.comparison = compareAssuranceReports(report, previous);
}

export function determineAssuranceExitCode(report: ScraperAssuranceReport): 0 | 1 | 2 | 3 | 4 {
  if (
    report.inventory.manifestErrors.length > 0
    || report.inventory.unknownDatabaseSources.length > 0
    || report.inventory.missingDatabaseSources.length > 0
    || report.inventory.unassessedActiveListings > 0
  ) return 4;
  if (report.canaries.some((canary) => canary.status === "blocked")) return 3;
  if (report.totals.unresolvedFields > 0 || report.totals.contractResolutionPct < 100) return 2;
  if (report.tests.some((test) => !test.ok) || report.canaries.some((canary) => !canary.ok)) return 1;
  return 0;
}

export function canRepairAssurance(report: ScraperAssuranceReport): boolean {
  return report.totals.unresolvedFields > 0
    && report.inventory.unknownDatabaseSources.length === 0
    && report.inventory.missingDatabaseSources.length === 0
    && report.inventory.unassessedActiveListings === 0
    && report.inventory.manifestErrors.length === 0
    && report.canaries.length > 0
    && report.canaries.every((canary) => canary.ok && canary.status === "healthy")
    && report.tests.find((test) => test.id === "focused-assurance-tests")?.ok === true;
}

async function runAssurance(args: AssuranceArgs): Promise<ScraperAssuranceReport> {
  const artifactDir = path.resolve(process.cwd(), args.artifactDir);
  const manifestErrors = validateAssuranceManifest(process.cwd());

  if (args.mode === "canary") {
    const report = buildAssuranceReport([], await runAllSourceCanaries());
    applyInventoryErrors(report, manifestErrors);
    attachPreviousComparison(report, artifactDir);
    return report;
  }

  const tests: CommandResult[] = [];
  if (args.mode === "full") tests.push(await runFocusedAssuranceTests());
  let rows = await fetchActiveListings();
  let canaries = [];
  if (args.mode === "full") canaries = await runAllSourceCanaries();
  let repaired = false;

  const initial = buildAssuranceReport(rows, canaries, new Date(), tests);
  applyInventoryErrors(initial, manifestErrors);
  const safeToRepair = args.repair && canRepairAssurance(initial);
  if (safeToRepair) {
    const repairResult = await runBoundedEnrichment(args.maxRepairIterations);
    tests.push(repairResult);
    repaired = repairResult.ok;
    rows = await fetchActiveListings();
  }
  if (args.mode === "full") tests.push(await runRegisteredJobHealthAudit());

  const report = buildAssuranceReport(rows, canaries, new Date(), tests, repaired);
  applyInventoryErrors(report, manifestErrors);
  attachPreviousComparison(report, artifactDir);
  return report;
}

function printSummary(report: ScraperAssuranceReport, artifactPath: string): void {
  console.log(`[assurance] Outcome: ${report.outcome}`);
  console.log(`[assurance] Active listings: ${report.totals.activeListings}`);
  console.log(`[assurance] Raw completeness: ${report.totals.rawCompletenessPct}%`);
  console.log(`[assurance] Contract resolution: ${report.totals.contractResolutionPct}%`);
  console.log(`[assurance] Unresolved fields: ${report.totals.unresolvedFields}`);
  for (const item of report.repairQueue.slice(0, 100)) {
    console.log(`[assurance] GAP ${item.source}/${item.listingId}/${item.field}: ${item.reason}`);
  }
  if (report.repairQueue.length > 100) {
    console.log(`[assurance] ${report.repairQueue.length - 100} additional gaps are retained in the artifact`);
  }
  console.log(`[assurance] Artifact: ${artifactPath}`);
}

async function main(): Promise<void> {
  loadEnvironment();
  const args = parseAssuranceArgs(process.argv.slice(2));
  assertAssurancePreflight(args);
  const report = await runAssurance(args);
  const artifactPath = persistAssuranceReport(report, path.resolve(process.cwd(), args.artifactDir));
  printSummary(report, artifactPath);
  process.exitCode = determineAssuranceExitCode(report);
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`[assurance] ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
