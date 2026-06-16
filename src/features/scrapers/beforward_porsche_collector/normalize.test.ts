import { describe, expect, it } from "vitest";

import { mapStatus, normalizeListing, normalizeListingFromSummary, parseLocation } from "./normalize";
import type { DetailParsed, ListingSummary, ScrapeMeta } from "./types";

describe("beforward_porsche_collector normalize", () => {
  it("maps statuses robustly", () => {
    expect(mapStatus("In-Stock", null)).toBe("active");
    expect(mapStatus(null, "https://schema.org/InStock")).toBe("active");
    expect(mapStatus(null, "https://schema.org/OutOfStock")).toBe("delisted");
  });

  it("parses location with sane defaults", () => {
    expect(parseLocation("OSAKA").country).toBe("Japan");
    expect(parseLocation("Korea").country).toBe("Korea");
    expect(parseLocation(null).country).toBe("Unknown");
  });

  it("normalizes summary + detail into listing", () => {
    const summary: ListingSummary = {
      page: 1,
      sourceUrl: "https://www.beforward.jp/porsche/911/cc227877/id/14244419/",
      refNo: "CC227877",
      title: "2016 PORSCHE 911",
      priceUsd: 61160,
      totalPriceUsd: 62631,
      mileageKm: 51793,
      year: 2016,
      location: "Osaka",
    };

    const detail: DetailParsed = {
      title: "2016 PORSCHE 911 991H1 CC227877",
      refNo: "CC227877",
      sourceStatus: "In-Stock",
      schemaAvailability: "https://schema.org/InStock",
      schemaPriceUsd: 61160,
      year: 2016,
      make: "Porsche",
      model: "911",
      trim: "991H1",
      mileageKm: 51793,
      transmission: "Automatic",
      engine: "3,000cc",
      exteriorColor: "White",
      interiorColor: null,
      vin: "WP0ZZZ99ZHS111949",
      location: "OSAKA",
      fuel: "Petrol",
      drive: "2wheel drive",
      doors: 2,
      seats: 4,
      modelCode: "991H1",
      chassisNo: "WP0ZZZ99ZHS111949",
      engineCode: null,
      subRefNo: "PRC2602221445",
      features: ["ABS"],
      sellingPoints: ["Non Smoker"],
      images: ["https://image-cdn.beforward.jp/large/202602/14244419/CC227877_1ce601b3.jpg"],
    };

    const meta: ScrapeMeta = {
      runId: "run-1",
      scrapeTimestamp: "2026-02-22T00:00:00.000Z",
    };

    const out = normalizeListing({ summary, detail, meta });
    expect(out).not.toBeNull();
    expect(out?.sourceId).toBe("bf-CC227877");
    expect(out?.status).toBe("active");
    expect(out?.photosCount).toBe(1);
    expect(out?.pricing.currentBid).toBe(61160);
    expect(out?.sourceVehicleIdentifier).toMatchObject({
      normalized: "WP0ZZZ99ZHS111949",
      kind: "vin_17",
      sourceLabel: "Chassis No.",
    });
  });

  it("carries a source-native chassis identifier separately from vin", () => {
    const summary: ListingSummary = {
      page: 1,
      sourceUrl: "https://www.beforward.jp/porsche/911/cc227877/id/14244419/",
      refNo: "CC227877",
      title: "1973 PORSCHE 911",
      priceUsd: 61160,
      totalPriceUsd: 62631,
      mileageKm: 51793,
      year: 1973,
      location: "Osaka",
    };
    const detail: DetailParsed = {
      title: "1973 PORSCHE 911 CC227877",
      refNo: "CC227877",
      sourceStatus: "In-Stock",
      schemaAvailability: "https://schema.org/InStock",
      schemaPriceUsd: 61160,
      year: 1973,
      make: "Porsche",
      model: "911",
      trim: null,
      mileageKm: 51793,
      transmission: "Manual",
      engine: "2,400cc",
      exteriorColor: "White",
      interiorColor: null,
      vin: null,
      location: "OSAKA",
      fuel: "Petrol",
      drive: "2wheel drive",
      doors: 2,
      seats: 4,
      modelCode: null,
      chassisNo: "9113601234",
      engineCode: null,
      subRefNo: null,
      features: [],
      sellingPoints: [],
      images: [],
    };

    const out = normalizeListing({
      summary,
      detail,
      meta: { runId: "run-1", scrapeTimestamp: "2026-02-22T00:00:00.000Z" },
    });

    expect(out?.vin).toBeNull();
    expect(out?.sourceVehicleIdentifier).toMatchObject({
      normalized: "9113601234",
      kind: "chassis_or_serial",
      sourceLabel: "Chassis No.",
    });
  });

  it("normalizes summary-only listing", () => {
    const summary: ListingSummary = {
      page: 1,
      sourceUrl: "https://www.beforward.jp/porsche/cayenne/cc168968/id/14194359/",
      refNo: "CC168968",
      title: "2015 PORSCHE CAYENNE",
      priceUsd: 8630,
      totalPriceUsd: 11011,
      mileageKm: 116586,
      year: 2015,
      location: "Yokohama",
    };

    const out = normalizeListingFromSummary({
      summary,
      meta: { runId: "r", scrapeTimestamp: "2026-02-22T00:00:00.000Z" },
    });

    expect(out).not.toBeNull();
    expect(out?.model).toBe("CAYENNE");
    expect(out?.pricing.currentBid).toBe(8630);
  });

  it.each([
    {
      sourceUrl: "https://www.beforward.jp/porsche/porsche-others/cb893406/id/13958025/",
      title: "2016 PORSCHE SPECIAL",
    },
    {
      sourceUrl: "https://www.beforward.jp/porsche/other/cb893406/id/13958025/",
      title: "2016 PORSCHE PORSCHE OTHERS",
    },
  ])("normalizes BeForward porsche-others summaries without rejecting make/model", ({ sourceUrl, title }) => {
    const out = normalizeListingFromSummary({
      summary: {
        page: 1,
        sourceUrl,
        refNo: "CB893406",
        title,
        priceUsd: 30000,
        totalPriceUsd: 32000,
        mileageKm: 50000,
        year: 2016,
        location: "Yokohama",
      },
      meta: { runId: "r", scrapeTimestamp: "2026-06-07T00:00:00.000Z" },
    });

    expect(out).not.toBeNull();
    expect(out?.make).toBe("Porsche");
    expect(out?.model).toBe("OTHER");
  });
});
