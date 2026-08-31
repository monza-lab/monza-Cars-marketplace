import { describe, expect, it, vi } from "vitest";

import type { ScraperAssuranceReport } from "../src/features/scrapers/common/assurance/database";
import {
  determineAssuranceExitCode,
  parseAssuranceArgs,
  runQueueDrivenRepair,
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

describe("runQueueDrivenRepair", () => {
  function withGap(unresolvedFields = 1): ScraperAssuranceReport {
    return report({
      totals: {
        ...report().totals,
        activeListings: 1,
        requiredFields: 1,
        unresolvedFields,
        contractResolutionPct: unresolvedFields === 0 ? 100 : 0,
      },
      repairQueue: unresolvedFields === 0 ? [] : [{
        listingId: "listing-1",
        source: "BaT",
        sourceUrl: "https://example.com/listing-1",
        field: "vin",
        reason: "missing",
        repairJobIds: ["bat-detail", "enrich-vin"],
      }],
    });
  }

  it("executes planned jobs and rebuilds the queue until 100 percent", async () => {
    const execute = vi.fn(async () => ({
      exitCode: 0,
      stdout: "complete",
      stderr: "",
      durationMs: 1_000,
      timedOut: false,
    }));
    const loadReport = vi.fn(async () => withGap(0));

    const result = await runQueueDrivenRepair(withGap(), 2, execute, loadReport);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      command: "npx",
      args: [
        "tsx",
        "scripts/run-scrapers.ts",
        "--repair-jobs=bat-detail,enrich-vin",
      ],
      shell: false,
    }));
    expect(loadReport).toHaveBeenCalledTimes(1);
    expect(result.metadata.completed).toBe(true);
    expect(result.report.totals.contractResolutionPct).toBe(100);
    expect(result.command.ok).toBe(true);
    expect(JSON.stringify(execute.mock.calls)).not.toMatch(/cleanup|delist/i);
  });

  it("blocks immediately when a repair wave makes no progress", async () => {
    const execute = vi.fn(async () => ({
      exitCode: 0, stdout: "complete", stderr: "", durationMs: 10, timedOut: false,
    }));
    const loadReport = vi.fn(async () => withGap());

    const result = await runQueueDrivenRepair(withGap(), 3, execute, loadReport);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.metadata.completed).toBe(false);
    expect(result.metadata.blockers).toEqual([expect.objectContaining({ kind: "no_progress" })]);
    expect(result.command.ok).toBe(false);
  });

  it("blocks when the iteration budget ends with unresolved fields", async () => {
    let unresolved = 3;
    const execute = vi.fn(async () => ({
      exitCode: 0, stdout: "complete", stderr: "", durationMs: 10, timedOut: false,
    }));
    const loadReport = vi.fn(async () => withGap(--unresolved));

    const result = await runQueueDrivenRepair(withGap(3), 2, execute, loadReport);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.metadata.completed).toBe(false);
    expect(result.metadata.blockers).toEqual([expect.objectContaining({ kind: "iteration_limit" })]);
    expect(result.report.totals.unresolvedFields).toBe(1);
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
