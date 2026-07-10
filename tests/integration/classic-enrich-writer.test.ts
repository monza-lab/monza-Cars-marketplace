import { describe, expect, it } from "vitest";

import { buildClassicEnrichmentUpdate } from "../../scripts/classic-enrich-scrapling";
import type { DetailParsed } from "../../src/features/scrapers/classic_collector/types";

const baseListing = {
  id: "classic-1",
  source_url: "https://www.classic.com/veh/1/",
  title: "1974 Porsche 911 Carrera",
  images: [] as string[],
  description_text: null as string | null,
  engine: null as string | null,
  mileage: null as number | null,
  vin: null as string | null,
  transmission: null as string | null,
  color_exterior: null as string | null,
  color_interior: null as string | null,
  body_style: null as string | null,
  photos_count: null as number | null,
  hammer_price: null as number | null,
  location: null as string | null,
  seller_notes: null as string | null,
};

function detail(raw: Partial<DetailParsed["raw"]>): DetailParsed {
  return {
    raw: {
      id: "",
      title: "1974 Porsche 911 Carrera",
      year: 1974,
      make: "Porsche",
      model: "911",
      trim: "Carrera",
      vin: null,
      mileage: null,
      mileageUnit: "miles",
      price: null,
      currency: "USD",
      status: "forsale",
      auctionHouse: "Classic.com",
      auctionDate: null,
      location: null,
      images: [],
      url: "https://www.classic.com/veh/1/",
      description: null,
      exteriorColor: null,
      interiorColor: null,
      engine: null,
      transmission: null,
      bodyStyle: null,
      bidCount: null,
      reserveStatus: null,
      saleResult: null,
      hammerPrice: null,
      endTime: null,
      startTime: null,
      ...raw,
    },
  };
}

describe("buildClassicEnrichmentUpdate", () => {
  it("preserves full engine and transmission text while bounding varchar fields", () => {
    const updates = buildClassicEnrichmentUpdate(
      baseListing,
      detail({
        engine: "3.2L Flat-Six with Bosch Motronic fuel injection",
        transmission: "5-Speed Manual G50 transaxle",
        vin: "WP0ZZZ91ZES100000EXTRA",
        exteriorColor: "Guards Red ".repeat(20),
        interiorColor: "Black leather ".repeat(20),
        bodyStyle: "Coupe with sunroof ".repeat(10),
      }),
      "2026-07-09T00:00:00.000Z",
    );

    expect(updates.engine).toBe("3.2L Flat-Six with Bosch Motronic fuel injection");
    expect(updates.transmission).toBe("5-Speed Manual G50 transaxle");
    expect(String(updates.vin)).toHaveLength(17);
    expect(String(updates.color_exterior)).toHaveLength(100);
    expect(String(updates.color_interior)).toHaveLength(100);
    expect(String(updates.body_style)).toHaveLength(50);
  });
});
