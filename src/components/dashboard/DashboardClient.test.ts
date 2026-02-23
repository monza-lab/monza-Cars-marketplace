import { describe, expect, it } from "vitest";

import {
  filterAuctionsForRegion,
  normalizeAuctionPlatform,
  REGION_TO_PLATFORM,
} from "./platformMapping";

describe("DashboardClient region and platform mapping", () => {
  it("keeps US and EU tabs pinned to expected platforms", () => {
    expect(REGION_TO_PLATFORM.US).toBe("BRING_A_TRAILER");
    expect(REGION_TO_PLATFORM.EU).toBe("AUTO_SCOUT_24");
  });

  it("normalizes BaT and AutoScout variants used by ingestion", () => {
    expect(normalizeAuctionPlatform("BaT")).toBe("BRING_A_TRAILER");
    expect(normalizeAuctionPlatform("BRING_A_TRAILER")).toBe("BRING_A_TRAILER");
    expect(normalizeAuctionPlatform("AutoScout24")).toBe("AUTO_SCOUT_24");
    expect(normalizeAuctionPlatform("AUTO_SCOUT_24")).toBe("AUTO_SCOUT_24");
  });

  it("falls back to raw auctions when region mapping false-empties results", () => {
    const auctions = [
      { id: "1", platform: "CARS_AND_BIDS" },
      { id: "2", platform: "COLLECTING_CARS" },
    ];

    const result = filterAuctionsForRegion(auctions, "EU");

    expect(result).toEqual(auctions);
  });

  it("keeps region-scoped auctions when mapping returns matches", () => {
    const auctions = [
      { id: "1", platform: "BaT" },
      { id: "2", platform: "AutoScout24" },
    ];

    const result = filterAuctionsForRegion(auctions, "US");

    expect(result).toEqual([{ id: "1", platform: "BaT" }]);
  });
});
