import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ASSURANCE_SOURCES,
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
