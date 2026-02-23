import { describe, expect, it } from "vitest";

import { interleaveResultsBySource } from "./supabaseLiveListings";

describe("supabaseLiveListings interleaveResultsBySource", () => {
  it("keeps all rows from a populated source when another source is empty", () => {
    const batRows = Array.from({ length: 86 }, (_, index) => `bat-${index}`);
    const autoscoutRows: string[] = [];

    const result = interleaveResultsBySource([batRows, autoscoutRows], 120);

    expect(result).toHaveLength(86);
    expect(result).toEqual(batRows);
  });

  it("caps output by global limit while preserving interleaving", () => {
    const sourceA = ["a1", "a2", "a3"];
    const sourceB = ["b1", "b2", "b3"];

    const result = interleaveResultsBySource([sourceA, sourceB], 4);

    expect(result).toEqual(["a1", "b1", "a2", "b2"]);
  });
});
