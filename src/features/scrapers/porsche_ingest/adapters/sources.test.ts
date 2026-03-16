import { describe, expect, it } from "vitest";

import { buildAutoScout24Input, buildBatInput, buildCarsAndBidsUrls, SOURCE_NAME } from "./sources";

describe("source adapters registry", () => {
  it("contains all required Option C sources", () => {
    expect(SOURCE_NAME.bat).toBe("BaT");
    expect(SOURCE_NAME.carsandbids).toBe("CarsAndBids");
    expect(SOURCE_NAME.autoscout24).toBe("AutoScout24");
    expect(SOURCE_NAME.classiccars).toBe("ClassicCars");
  });

  it("builds CarsAndBids URL list for actor input contract", () => {
    const urls = buildCarsAndBidsUrls("backfill", 200);
    expect(urls.length).toBeGreaterThan(2);
    expect(urls[0]).toContain("carsandbids.com/auctions");
    expect(urls.some((url) => url.includes("past?page="))).toBe(true);
  });

  it("builds BaT input with README contract keys", () => {
    const input = buildBatInput(50, { soldOnly: true });
    expect(input).toEqual({
      startUrl: "https://bringatrailer.com/auctions/?search=Porsche&result=sold",
      maxItems: 50,
    });
  });

  it("builds BaT active-only input URL", () => {
    const input = buildBatInput(10, { activeOnly: true });
    expect(input.startUrl).toBe("https://bringatrailer.com/auctions/");
    expect(input.maxItems).toBe(10);
  });

  it("uses explicit BaT startUrl override", () => {
    const input = buildBatInput(500, { startUrlOverride: "https://bringatrailer.com/auctions/results/?search=porsche" });
    expect(input).toEqual({
      startUrl: "https://bringatrailer.com/auctions/results/?search=porsche",
      maxItems: 500,
    });
  });

  it("builds lean AutoScout24 pan-europe input", () => {
    const input = buildAutoScout24Input("sample", 7);
    expect(input.resultLimitPerThread).toBe(7);
    expect(input.maxChargedResults).toBe(7);
    expect(input.reviewLimit).toBe(0);
    expect(input.lightningMode).toBe(true);
    expect(input.startUrls[0]).toContain("autoscout24.com/lst/porsche");
    expect(input.startUrls[0]).toContain("cy=D%2CA%2CI%2CB%2CNL%2CE%2CL%2CF");
  });

  it("uses stable mode-specific sorting for AutoScout24", () => {
    const incremental = buildAutoScout24Input("incremental", 20);
    const backfill = buildAutoScout24Input("backfill", 20);
    expect(incremental.startUrls.length).toBeGreaterThan(1);
    expect(backfill.startUrls.length).toBeGreaterThan(1);
    expect(incremental.startUrls[0]).toContain("sort=age");
    expect(backfill.startUrls[0]).toContain("sort=standard");
    expect(incremental.startUrls[0]).toContain("cy=");
    expect(incremental.resultLimitPerThread).toBe(3);
    expect(incremental.maxChargedResults).toBe(20);
  });

  it("supports country-level AutoScout24 sharding", () => {
    const input = buildAutoScout24Input("incremental", 200, { country: "D" });
    expect(input.startUrls).toEqual([
      "https://www.autoscout24.com/lst/porsche?sort=age&desc=1&ustate=N%2CU&atype=C&cy=D&source=homepage_search-mask",
    ]);
    expect(input.resultLimitPerThread).toBe(200);
  });

  it("rejects unsupported AutoScout24 country shards", () => {
    expect(() => buildAutoScout24Input("incremental", 200, { country: "US" })).toThrow(
      "Unsupported AutoScout24 country shard: US",
    );
  });
});
