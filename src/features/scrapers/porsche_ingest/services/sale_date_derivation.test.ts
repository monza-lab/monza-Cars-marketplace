import { describe, expect, it } from "vitest";

import { CanonicalListingSchema } from "../contracts/listing";
import { evaluateSoldWindow } from "./sold_filter";
import { __testables, deriveSaleDate } from "./sale_date_derivation";

function seedLikeListing() {
  return CanonicalListingSchema.parse({
    source: "BaT",
    source_id: "108904112",
    source_url: "https://bringatrailer.com/listing/1998-porsche-911-carrera-4s-40/",
    make: "Porsche",
    model: "911",
    year: 1998,
    title: "34k-Mile 1998 Porsche 911 Carrera 4S Coupe 6-Speed",
    status: "sold",
    sale_date: null,
    mileage_unit: "km",
    auction_house: "Bring a Trailer",
    images: [],
    raw_payload: {
      auctionStatus: "ended",
      cardText: "Sold for USD $205,000 on 2/20/26",
    },
  });
}

describe("sale date derivation", () => {
  it("parses seed-like sold text date", () => {
    const parsed = __testables.extractDateFromText("Sold for USD $205,000 on 2/20/26");
    expect(parsed).toBe("2026-02-20");
  });

  it("strict mode accepts once derived date exists", async () => {
    const listing = seedLikeListing();
    const derived = await deriveSaleDate(listing, {
      strictMode: true,
      soldOnly: true,
      cache: new Map(),
    });
    expect(derived).toBe("2026-02-20");

    const decision = evaluateSoldWindow({ ...listing, sale_date: derived }, { soldOnly: true, soldWithinMonths: 12, strictSaleDate: true });
    expect(decision).toEqual({ keep: true });
  });

  it("uses createdDate fallback outside strict sold-only mode", async () => {
    const listing = CanonicalListingSchema.parse({
      source: "AutoScout24",
      source_id: "as24_2",
      source_url: "https://www.autoscout24.com/offers/porsche-911-as24-2",
      make: "Porsche",
      model: "911",
      year: 2019,
      title: "2019 Porsche 911 Carrera",
      status: "active",
      sale_date: null,
      mileage_unit: "km",
      auction_house: "AutoScout24",
      images: [],
      raw_payload: {
        createdDate: "2025-04-14T10:48:07.027Z",
      },
    });

    const derived = await deriveSaleDate(listing, {
      strictMode: false,
      soldOnly: false,
      cache: new Map(),
    });

    expect(derived).toBe("2025-04-14");
  });
});
