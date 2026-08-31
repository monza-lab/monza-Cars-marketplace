import { describe, expect, it } from "vitest";

import type { ScraperAssuranceReport } from "./database";
import { buildRepairPlan } from "./repairPlan";

function report(repairQueue: ScraperAssuranceReport["repairQueue"]): ScraperAssuranceReport {
  return {
    generatedAt: "2026-08-31T12:00:00.000Z",
    outcome: "blocked",
    inventory: {
      declaredSources: ["BaT"], observedDatabaseSources: ["BaT"],
      unknownDatabaseSources: [], missingDatabaseSources: [],
      unassessedActiveListings: 0, manifestErrors: [],
    },
    totals: {
      activeListings: 1, requiredFields: 2, populatedFields: 0, resolvedFields: 0,
      unresolvedFields: repairQueue.length, rawCompletenessPct: 0, contractResolutionPct: 0,
    },
    sources: [], repairQueue, canaries: [], tests: [],
  };
}

describe("scraper assurance repair planning", () => {
  it("deduplicates safe jobs while retaining gap traceability", () => {
    const plan = buildRepairPlan(report([
      { listingId: "listing-1", source: "BaT", sourceUrl: "https://example.com/1", field: "vin", reason: "missing", repairJobIds: ["bat-detail", "enrich-vin", "enrich-titles"] },
      { listingId: "listing-1", source: "BaT", sourceUrl: "https://example.com/1", field: "title", reason: "missing", repairJobIds: ["bat-detail", "enrich-titles"] },
    ]));

    expect(plan.jobIds).toEqual(["bat-detail", "enrich-titles", "enrich-vin"]);
    expect(plan.gaps).toHaveLength(2);
    expect(plan.bySource).toEqual({ BaT: 2 });
    expect(plan.byField).toEqual({ title: 1, vin: 1 });
    expect(plan.byReason).toEqual({ missing: 2 });
  });

  it("rejects unknown repair jobs", () => {
    expect(() => buildRepairPlan(report([{
      listingId: "listing-1", source: "BaT", sourceUrl: "https://example.com/1",
      field: "vin", reason: "missing", repairJobIds: ["missing-job"],
    }]))).toThrow("unknown repair job missing-job");
  });

  it("rejects destructive repair jobs", () => {
    expect(() => buildRepairPlan(report([{
      listingId: "listing-1", source: "BaT", sourceUrl: "https://example.com/1",
      field: "vin", reason: "missing", repairJobIds: ["cleanup"],
    }]))).toThrow("destructive repair job cleanup");
  });
});
