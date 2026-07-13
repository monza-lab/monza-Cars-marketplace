import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ASSURANCE_SOURCES,
  ASSURANCE_AUDIT_JOB_SPECS,
  SCRAPER_JOBS,
  getSourceIdsForScraper,
  validateAssuranceManifest,
  validateRunnerInventory,
} from "./manifest";
import { getSourcesForScraper } from "../sourceRegistry";

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

  it("maps shared auction collectors to all three auction sources", () => {
    expect(getSourceIdsForScraper("porsche")).toEqual([
      "BaT",
      "CarsAndBids",
      "CollectingCars",
    ]);
    expect(getSourcesForScraper("porsche")).toEqual([
      "BaT",
      "CarsAndBids",
      "CollectingCars",
    ]);
  });

  it("live-checks both shared auction projects for every auction source", () => {
    for (const source of ASSURANCE_SOURCES.filter((candidate) =>
      ["BaT", "CarsAndBids", "CollectingCars"].includes(candidate.id))) {
      expect(source.canaries.map((canary) => canary.jobId).sort())
        .toEqual(["ferrari", "porsche"]);
      expect(source.canaries.every((canary) => canary.timeoutMs >= 180_000)).toBe(true);
      expect(source.canaries.find((canary) => canary.jobId === "ferrari")?.args)
        .toContain("--make=Ferrari");
    }
  });

  it("strictly audits every operational job not represented by the audit command itself", () => {
    const auditedNames = new Set(ASSURANCE_AUDIT_JOB_SPECS.map((spec) => spec.scraperName));
    for (const job of SCRAPER_JOBS.filter((candidate) =>
      !["health-audit", "enrichment-loop"].includes(candidate.id))) {
      expect(auditedNames, `${job.id} is absent from the strict job audit`)
        .toContain(job.scraperName);
    }
  });

  it("accounts for scraper feature directories and workflow files", () => {
    expect(validateAssuranceManifest(path.resolve(process.cwd()))).toEqual([]);
  });

  it("accounts for every job exposed by the interactive scraper runner", () => {
    const source = readFileSync(path.resolve(process.cwd(), "scripts/run-scrapers.ts"), "utf8");
    const definitions = source.match(/const SCRAPERS:[\s\S]*?^\];/m)?.[0] ?? "";
    const runnerIds = Array.from(definitions.matchAll(/^\s+id: "([^"]+)",/gm), (match) => match[1]);
    expect(validateRunnerInventory(runnerIds)).toEqual([]);
  });
});
