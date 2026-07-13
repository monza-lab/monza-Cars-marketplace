import { describe, expect, it, vi } from "vitest";

import type { ScraperAssuranceReport } from "../src/features/scrapers/common/assurance/database";
import {
  determineAssuranceExitCode,
  parseAssuranceArgs,
  runBoundedEnrichment,
  runRegisteredJobHealthAudit,
} from "./scraper-assurance";

function report(overrides: Partial<ScraperAssuranceReport> = {}): ScraperAssuranceReport {
  return {
    generatedAt: "2026-07-13T12:00:00.000Z",
    outcome: "healthy",
    inventory: {
      declaredSources: [],
      observedDatabaseSources: [],
      unknownDatabaseSources: [],
      missingDatabaseSources: [],
      unassessedActiveListings: 0,
      manifestErrors: [],
    },
    totals: {
      activeListings: 0,
      requiredFields: 0,
      populatedFields: 0,
      resolvedFields: 0,
      unresolvedFields: 0,
      rawCompletenessPct: 100,
      contractResolutionPct: 100,
    },
    sources: [],
    repairQueue: [],
    canaries: [],
    tests: [],
    ...overrides,
  };
}

describe("parseAssuranceArgs", () => {
  it("parses the bounded full repair contract", () => {
    expect(parseAssuranceArgs(["--mode=full", "--repair", "--max-repair-iterations=2"])).toEqual({
      mode: "full",
      repair: true,
      maxRepairIterations: 2,
      artifactDir: "agents/testscripts/artifacts",
    });
  });

  it("rejects destructive or unknown arguments", () => {
    expect(() => parseAssuranceArgs(["--mode=full", "--repair", "--allow-destructive"]))
      .toThrow("Unsupported argument");
  });

  it("does not permit repair outside full mode", () => {
    expect(() => parseAssuranceArgs(["--mode=scan", "--repair"]))
      .toThrow("Repair is supported only in full mode");
  });
});

describe("runBoundedEnrichment", () => {
  it("invokes only the existing bounded non-destructive enrichment loop", async () => {
    const execute = vi.fn(async () => ({
      exitCode: 0,
      stdout: "complete",
      stderr: "",
      durationMs: 1_000,
      timedOut: false,
    }));

    await runBoundedEnrichment(2, execute);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      command: "npx",
      args: [
        "tsx",
        "scripts/run-scrapers.ts",
        "--enrich-loop",
        "--max-iterations=2",
        "--pause=1",
      ],
      shell: false,
    }));
    expect(JSON.stringify(execute.mock.calls)).not.toMatch(/cleanup|delist/i);
  });
});

describe("registered job health audit", () => {
  it("strictly audits every manifest-backed operational job without writes", async () => {
    const execute = vi.fn(async () => ({
      exitCode: 0,
      stdout: "{}",
      stderr: "",
      durationMs: 1_000,
      timedOut: false,
    }));

    await runRegisteredJobHealthAudit(execute);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      args: ["tsx", "scripts/scraper-health-audit.ts", "--json", "--strict"],
      shell: false,
    }));
  });
});

describe("repair gate", () => {
  it("requires every live canary to be healthy before permitting writes", async () => {
    const { canRepairAssurance } = await import("./scraper-assurance");
    const withGap = report({
      totals: { ...report().totals, unresolvedFields: 1, contractResolutionPct: 99 },
      canaries: [{ id: "canary:BaT", source: "BaT", ok: false, status: "blocked", discovered: 0, exitCode: 0, timedOut: false, durationMs: 1, summary: "blocked" }],
      tests: [{ id: "focused-assurance-tests", ok: true, durationMs: 1, summary: "passed" }],
    });

    expect(canRepairAssurance(withGap)).toBe(false);
    expect(canRepairAssurance({ ...withGap, canaries: withGap.canaries.map((canary) => ({ ...canary, ok: true, status: "healthy", discovered: 1 })) })).toBe(true);
  });
});

describe("determineAssuranceExitCode", () => {
  it("prioritizes inventory drift, external blocks, unresolved fields, then local failures", () => {
    expect(determineAssuranceExitCode(report({
      inventory: { declaredSources: [], observedDatabaseSources: ["Other"], unknownDatabaseSources: ["Other"], missingDatabaseSources: [], unassessedActiveListings: 1, manifestErrors: [] },
    }))).toBe(4);
    expect(determineAssuranceExitCode(report({
      canaries: [{ id: "canary:BaT", source: "BaT", ok: false, status: "blocked", discovered: 0, exitCode: 0, timedOut: false, durationMs: 1, summary: "blocked" }],
    }))).toBe(3);
    expect(determineAssuranceExitCode(report({
      totals: { ...report().totals, unresolvedFields: 1, contractResolutionPct: 99.9 },
    }))).toBe(2);
    expect(determineAssuranceExitCode(report({
      tests: [{ id: "tests", ok: false, durationMs: 1, summary: "failed" }],
    }))).toBe(1);
    expect(determineAssuranceExitCode(report())).toBe(0);
  });
});
