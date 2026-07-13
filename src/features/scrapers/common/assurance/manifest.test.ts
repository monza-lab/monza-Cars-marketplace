import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ASSURANCE_SOURCES,
  SCRAPER_JOBS,
  getSourceIdsForScraper,
  validateAssuranceManifest,
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
});
