import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ScraperAssuranceReport } from "../src/features/scrapers/common/assurance/database";

export interface RepairReleaseInput {
  phase: "merge" | "production";
  assurance: ScraperAssuranceReport;
  scraperTestsPassed: boolean;
  typecheckPassed: boolean;
  lintPassed: boolean;
  buildPassed: boolean;
  githubChecksPassed: boolean;
  previewReady: boolean;
  mergedCommit?: string;
  productionCommit?: string;
  productionReady?: boolean;
  postDeploySmokePassed?: boolean;
}

export interface RepairReleaseDecision {
  eligible: boolean;
  blockedReasons: string[];
}

export function evaluateRepairRelease(input: RepairReleaseInput): RepairReleaseDecision {
  const reasons = new Set<string>();
  const report = input.assurance;

  if (report.totals.contractResolutionPct !== 100) reasons.add("contract_resolution_below_100");
  if (report.totals.unresolvedFields !== 0 || report.repairQueue.length !== 0) {
    reasons.add("unresolved_fields_remain");
  }
  if (report.inventory.manifestErrors.length > 0
    || report.inventory.unknownDatabaseSources.length > 0
    || report.inventory.missingDatabaseSources.length > 0
    || report.inventory.unassessedActiveListings > 0) {
    reasons.add("inventory_not_clean");
  }
  if (report.canaries.length === 0
    || report.canaries.some((canary) => !canary.ok || canary.status !== "healthy")) {
    reasons.add("source_canaries_not_healthy");
  }
  if (report.tests.some((test) => !test.ok)) reasons.add("assurance_tests_failed");
  if (report.repair?.blockers.length) reasons.add("repair_blockers_remain");
  if (!input.scraperTestsPassed) reasons.add("scraper_tests_failed");
  if (!input.typecheckPassed) reasons.add("typecheck_failed");
  if (!input.lintPassed) reasons.add("lint_failed");
  if (!input.buildPassed) reasons.add("build_failed");
  if (!input.githubChecksPassed) reasons.add("github_checks_failed_or_missing");
  if (!input.previewReady) reasons.add("preview_not_ready");

  if (input.phase === "production") {
    if (!input.mergedCommit || !input.productionCommit
      || input.mergedCommit !== input.productionCommit) {
      reasons.add("production_commit_mismatch");
    }
    if (!input.productionReady) reasons.add("production_not_ready");
    if (!input.postDeploySmokePassed) reasons.add("post_deploy_smoke_failed");
  }

  return { eligible: reasons.size === 0, blockedReasons: Array.from(reasons).sort() };
}

function parseInputPath(args: readonly string[]): string {
  const input = args.find((argument) => argument.startsWith("--input="))
    ?.slice("--input=".length).trim();
  if (!input) throw new Error("--input=<release-observations.json> is required");
  return path.resolve(process.cwd(), input);
}

function main(): void {
  const inputPath = parseInputPath(process.argv.slice(2));
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as RepairReleaseInput;
  const decision = evaluateRepairRelease(input);
  console.log(JSON.stringify(decision, null, 2));
  process.exitCode = decision.eligible ? 0 : 1;
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(`[scraper-repair-release] ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
