import { describe, expect, it } from "vitest";

import {
  filterAuctionsForRegion,
  normalizeAuctionPlatform,
  REGION_TO_PLATFORM,
} from "./platformMapping";

describe("DashboardClient region and platform mapping", () => {
  it("keeps region tabs pinned to expected platforms", () => {
    expect(REGION_TO_PLATFORM.US).toBe("BRING_A_TRAILER");
    expect(REGION_TO_PLATFORM.EU).toBe("AUTO_SCOUT_24");
    expect(REGION_TO_PLATFORM.UK).toBe("AUTO_TRADER");
    expect(REGION_TO_PLATFORM.JP).toBe("BE_FORWARD");
  });

  it("normalizes mapped platform variants used by ingestion", () => {
    expect(normalizeAuctionPlatform("BaT")).toBe("BRING_A_TRAILER");
    expect(normalizeAuctionPlatform("BRING_A_TRAILER")).toBe("BRING_A_TRAILER");
    expect(normalizeAuctionPlatform("AutoScout24")).toBe("AUTO_SCOUT_24");
    expect(normalizeAuctionPlatform("AUTO_SCOUT_24")).toBe("AUTO_SCOUT_24");
    expect(normalizeAuctionPlatform("AutoTrader")).toBe("AUTO_TRADER");
    expect(normalizeAuctionPlatform("AUTO_TRADER")).toBe("AUTO_TRADER");
    expect(normalizeAuctionPlatform("BeForward")).toBe("BE_FORWARD");
    expect(normalizeAuctionPlatform("BE_FORWARD")).toBe("BE_FORWARD");
  });

  it("returns empty set when strict mapped region has zero matches", () => {
    const auctions = [
      { id: "1", platform: "CARS_AND_BIDS" },
      { id: "2", platform: "COLLECTING_CARS" },
    ];

    const result = filterAuctionsForRegion(auctions, "EU");

    expect(result).toEqual([]);
  });

  it("keeps region-scoped auctions when mapping returns matches", () => {
    const auctions = [
      { id: "1", platform: "BaT" },
      { id: "2", platform: "AutoScout24" },
      { id: "3", platform: "AutoTrader" },
      { id: "4", platform: "BeForward" },
    ];

    const usResult = filterAuctionsForRegion(auctions, "US");
    const ukResult = filterAuctionsForRegion(auctions, "UK");
    const jpResult = filterAuctionsForRegion(auctions, "JP");

    expect(usResult).toEqual([{ id: "1", platform: "BaT" }]);
    expect(ukResult).toEqual([{ id: "3", platform: "AutoTrader" }]);
    expect(jpResult).toEqual([{ id: "4", platform: "BeForward" }]);
  });
});
