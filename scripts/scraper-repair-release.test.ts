import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import type { ScraperAssuranceReport } from "../src/features/scrapers/common/assurance/database";
import { evaluateRepairRelease, type RepairReleaseInput } from "./scraper-repair-release";

function assurance(overrides: Partial<ScraperAssuranceReport> = {}): ScraperAssuranceReport {
  return {
    generatedAt: "2026-08-31T12:00:00.000Z",
    outcome: "repaired",
    inventory: {
      declaredSources: ["BaT"], observedDatabaseSources: ["BaT"],
      unknownDatabaseSources: [], missingDatabaseSources: [],
      unassessedActiveListings: 0, manifestErrors: [],
    },
    totals: {
      activeListings: 1, requiredFields: 1, populatedFields: 1, resolvedFields: 1,
      unresolvedFields: 0, rawCompletenessPct: 100, contractResolutionPct: 100,
    },
    sources: [], repairQueue: [],
    canaries: [{
      id: "canary:BaT", source: "BaT", ok: true, status: "healthy", discovered: 1,
      exitCode: 0, timedOut: false, durationMs: 1, summary: "healthy",
    }],
    tests: [{ id: "focused-assurance-tests", ok: true, durationMs: 1, summary: "passed" }],
    repair: {
      completed: true, initialUnresolvedFields: 1, finalUnresolvedFields: 0,
      waves: [], blockers: [],
    },
    ...overrides,
  };
}

function input(overrides: Partial<RepairReleaseInput> = {}): RepairReleaseInput {
  return {
    phase: "merge",
    assurance: assurance(),
    scraperTestsPassed: true,
    typecheckPassed: true,
    lintPassed: true,
    buildPassed: true,
    githubChecksPassed: true,
    previewReady: true,
    ...overrides,
  };
}

describe("scraper repair release gate", () => {
  it("allows merge only when every assurance and CI gate passed", () => {
    expect(evaluateRepairRelease(input())).toEqual({ eligible: true, blockedReasons: [] });
  });

  it("rejects unresolved fields, repair blockers, and incomplete checks", () => {
    const report = assurance({
      totals: { ...assurance().totals, unresolvedFields: 2, contractResolutionPct: 99 },
      repairQueue: [{
        listingId: "listing-1", source: "BaT", sourceUrl: "https://example.com/1",
        field: "vin", reason: "missing", repairJobIds: ["bat-detail"],
      }],
      repair: {
        completed: false, initialUnresolvedFields: 2, finalUnresolvedFields: 2,
        waves: [], blockers: [{ kind: "no_progress", message: "stalled", iteration: 1, unresolvedFields: 2 }],
      },
    });

    const result = evaluateRepairRelease(input({
      assurance: report,
      githubChecksPassed: false,
      previewReady: false,
    }));

    expect(result.eligible).toBe(false);
    expect(result.blockedReasons).toEqual(expect.arrayContaining([
      "contract_resolution_below_100",
      "unresolved_fields_remain",
      "repair_blockers_remain",
      "github_checks_failed_or_missing",
      "preview_not_ready",
    ]));
  });

  it("verifies the merged commit, production deployment, and smoke check", () => {
    expect(evaluateRepairRelease(input({
      phase: "production",
      mergedCommit: "abc123",
      productionCommit: "abc123",
      productionReady: true,
      postDeploySmokePassed: true,
    }))).toEqual({ eligible: true, blockedReasons: [] });

    expect(evaluateRepairRelease(input({
      phase: "production",
      mergedCommit: "abc123",
      productionCommit: "def456",
      productionReady: false,
      postDeploySmokePassed: false,
    })).blockedReasons).toEqual(expect.arrayContaining([
      "production_commit_mismatch",
      "production_not_ready",
      "post_deploy_smoke_failed",
    ]));
  });

  it("runs the strict queue-driven assurance contract in GitHub Actions", () => {
    const workflow = readFileSync(".github/workflows/enrichment-loop.yml", "utf8");
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(workflow).toContain("npm run scrapers:assurance:repair");
    expect(workflow).toContain("DATABASE_URL: ${{ secrets.DATABASE_URL }}");
    expect(workflow).toContain("agents/testscripts/artifacts/scraper-assurance-*.json");
    expect(packageJson.scripts["test:scraper-assurance"])
      .toContain("scripts/scraper-repair-release.test.ts");
  });
});
