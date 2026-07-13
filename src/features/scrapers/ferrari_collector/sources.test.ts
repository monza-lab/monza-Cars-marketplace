import { describe, expect, it } from "vitest";

import { selectCollectorSources } from "./collector";
import { readNonNegativeNumber } from "./cli";
import { DEFAULT_FERRARI_MAKE } from "./types";

describe("Ferrari collector source selection", () => {
  it("honors the bounded source list used by assurance canaries", () => {
    expect(selectCollectorSources({ sources: ["CollectingCars"] }))
      .toEqual(["CollectingCars"]);
  });

  it("preserves zero to disable ended discovery", () => {
    expect(readNonNegativeNumber({ maxEndedPages: "0" }, "maxEndedPages", 10))
      .toBe(0);
  });

  it("defaults the Ferrari project to Ferrari data", () => {
    expect(DEFAULT_FERRARI_MAKE).toBe("Ferrari");
  });
});
