import { describe, expect, it } from "vitest";

import { buildBatInput, buildCarsAndBidsUrls, SOURCE_NAME } from "./sources";

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
});
