import { describe, expect, it } from "vitest";

import {
  LISTING_IMAGE_PLACEHOLDER,
  LIVE_DB_STATUS_VALUES,
  interleaveResultsBySource,
  isLiveListingStatus,
  normalizeListingImageUrl,
  resolveListingImages,
  resolveCanonicalSource,
} from "./supabaseLiveListings";

describe("supabaseLiveListings source and status normalization", () => {
  it("maps marketplace source aliases to canonical values", () => {
    expect(resolveCanonicalSource("BaT", null)).toBe("BaT");
    expect(resolveCanonicalSource("bringatrailer", null)).toBe("BaT");
    expect(resolveCanonicalSource("autoscout24", null)).toBe("AutoScout24");
    expect(resolveCanonicalSource("AUTO_SCOUT_24", null)).toBe("AutoScout24");
    expect(resolveCanonicalSource("autotrader", null)).toBe("AutoTrader");
    expect(resolveCanonicalSource("AUTO_TRADER", null)).toBe("AutoTrader");
    expect(resolveCanonicalSource("beforward", null)).toBe("BeForward");
    expect(resolveCanonicalSource("BE_FORWARD", null)).toBe("BeForward");
    expect(resolveCanonicalSource("carsandbids", null)).toBe("CarsAndBids");
    expect(resolveCanonicalSource("collectingcars", null)).toBe("CollectingCars");
  });

  it("falls back to platform aliases when source is inconsistent", () => {
    expect(resolveCanonicalSource("legacy_feed", "AUTO_SCOUT_24")).toBe("AutoScout24");
    expect(resolveCanonicalSource("legacy_feed", "BRING_A_TRAILER")).toBe("BaT");
    expect(resolveCanonicalSource("legacy_feed", "AUTO_TRADER")).toBe("AutoTrader");
    expect(resolveCanonicalSource("legacy_feed", "BE_FORWARD")).toBe("BeForward");
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

describe("supabaseLiveListings image url normalization", () => {
  it("keeps known AutoTrader host urls", () => {
    expect(normalizeListingImageUrl("https://m.atcdn.co.uk/a/media/abc.jpg")).toBe(
      "https://m.atcdn.co.uk/a/media/abc.jpg"
    );
  });

  it("normalizes protocol-relative urls", () => {
    expect(normalizeListingImageUrl("//m.atcdn.co.uk/a/media/abc.jpg")).toBe(
      "https://m.atcdn.co.uk/a/media/abc.jpg"
    );
  });

  it("normalizes AutoTrader resize token urls into concrete paths", () => {
    expect(normalizeListingImageUrl("https://m.atcdn.co.uk/a/media/{resize}/abc.jpg")).toBe(
      "https://m.atcdn.co.uk/a/media/abc.jpg"
    );
  });

  it("normalizes AutoTrader resize token when token is URL-encoded", () => {
    expect(normalizeListingImageUrl("https://m.atcdn.co.uk/a/media/%7Bresize%7D/abc.jpg")).toBe(
      "https://m.atcdn.co.uk/a/media/abc.jpg"
    );
  });

  it("rejects unknown template tokens", () => {
    expect(normalizeListingImageUrl("https://m.atcdn.co.uk/a/media/{badtoken}/abc.jpg")).toBeNull();
  });

  it("rejects unknown hosts to avoid next/image host failures", () => {
    expect(normalizeListingImageUrl("https://unknown-images.example.com/photo.jpg")).toBeNull();
  });

  it("uses neutral placeholder when all candidate images are invalid", () => {
    const resolved = resolveListingImages([
      "https://unknown-images.example.com/photo.jpg",
      "https://m.atcdn.co.uk/a/media/{badtoken}/abc.jpg",
      null,
      "",
    ]);

    expect(resolved).toEqual([LISTING_IMAGE_PLACEHOLDER]);
  });

  it("keeps normalized listing image when at least one is valid", () => {
    const resolved = resolveListingImages([
      "https://unknown-images.example.com/photo.jpg",
      "https://m.atcdn.co.uk/a/media/{resize}/abc.jpg",
    ]);

    expect(resolved).toEqual(["https://m.atcdn.co.uk/a/media/abc.jpg"]);
  });

  it("normalizes real AutoTrader listing image pattern from Supabase payloads", () => {
    expect(
      normalizeListingImageUrl("https://m.atcdn.co.uk/a/media/{resize}/9d4417fa89f14146a53b45937e829dd4.jpg")
    ).toBe("https://m.atcdn.co.uk/a/media/9d4417fa89f14146a53b45937e829dd4.jpg");
  });
});

describe("fetchPricedListingsForModel", () => {
  it("is exported as a function", async () => {
    const mod = await import("./supabaseLiveListings")
    expect(typeof mod.fetchPricedListingsForModel).toBe("function")
  })
})
