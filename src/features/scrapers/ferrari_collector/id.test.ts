import { describe, it, expect } from "vitest";

import { canonicalizeUrl, deriveSourceId } from "./id";

describe("ferrari_collector id", () => {
  it("canonicalizes URLs by stripping tracking params", () => {
    const u = canonicalizeUrl("https://bringatrailer.com/listing/foo/?utm_source=x&utm_medium=y#section");
    expect(u).toBe("https://bringatrailer.com/listing/foo/");
  });

  it("derives stable source ids from URL when missing", () => {
    expect(
      deriveSourceId({
        source: "BaT",
        sourceId: null,
        sourceUrl: "https://bringatrailer.com/listing/2003-ferrari-360-modena/",
      }),
    ).toBe("bat-2003-ferrari-360-modena");

    expect(
      deriveSourceId({
        source: "CarsAndBids",
        sourceId: null,
        sourceUrl: "https://carsandbids.com/auctions/2001-ferrari-360",
      }),
    ).toBe("cab-2001-ferrari-360");

    expect(
      deriveSourceId({
        source: "CollectingCars",
        sourceId: null,
        sourceUrl: "https://collectingcars.com/cars/1999-ferrari-355",
      }),
    ).toBe("cc-1999-ferrari-355");
  });

  it("prefers explicit sourceId", () => {
    expect(
      deriveSourceId({ source: "BaT", sourceId: "bat-xyz", sourceUrl: "https://bringatrailer.com/listing/x/" }),
    ).toBe("bat-xyz");
  });
});
