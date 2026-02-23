import { describe, expect, it } from "vitest";

import {
  LIVE_DB_STATUS_VALUES,
  interleaveResultsBySource,
  isLiveListingStatus,
  resolveCanonicalSource,
} from "./supabaseLiveListings";

describe("supabaseLiveListings source and status normalization", () => {
  it("maps BaT and AutoScout source aliases to canonical values", () => {
    expect(resolveCanonicalSource("BaT", null)).toBe("BaT");
    expect(resolveCanonicalSource("bringatrailer", null)).toBe("BaT");
    expect(resolveCanonicalSource("autoscout24", null)).toBe("AutoScout24");
    expect(resolveCanonicalSource("AUTO_SCOUT_24", null)).toBe("AutoScout24");
    expect(resolveCanonicalSource("carsandbids", null)).toBe("CarsAndBids");
    expect(resolveCanonicalSource("collectingcars", null)).toBe("CollectingCars");
  });

  it("falls back to platform aliases when source is inconsistent", () => {
    expect(resolveCanonicalSource("legacy_feed", "AUTO_SCOUT_24")).toBe("AutoScout24");
    expect(resolveCanonicalSource("legacy_feed", "BRING_A_TRAILER")).toBe("BaT");
  });

  it("treats live status variants as live", () => {
    expect(isLiveListingStatus("active")).toBe(true);
    expect(isLiveListingStatus("ACTIVE")).toBe(true);
    expect(isLiveListingStatus("live")).toBe(true);
    expect(isLiveListingStatus("ENDING_SOON")).toBe(true);
    expect(isLiveListingStatus("sold")).toBe(false);
    expect(isLiveListingStatus("unsold")).toBe(false);
  });

  it("keeps DB live status filter enum-safe", () => {
    expect(LIVE_DB_STATUS_VALUES).toEqual(["active"]);
    expect(LIVE_DB_STATUS_VALUES).not.toContain("ACTIVE");
    expect(LIVE_DB_STATUS_VALUES).not.toContain("live");
    expect(LIVE_DB_STATUS_VALUES).not.toContain("ending_soon");
  });
});

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
