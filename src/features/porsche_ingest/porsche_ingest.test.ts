import { describe, expect, it } from "vitest";

import { CanonicalListingSchema } from "./contracts/listing";
import { buildListingFingerprint, dedupeListings } from "./services/dedupe";
import { normalizeRawListing } from "./services/normalize";

describe("porsche_ingest normalize + dedupe", () => {
  it("normalizes BaT payload into canonical contract", () => {
    const raw = {
      id: 123,
      auctionUrl: "https://bringatrailer.com/listing/2004-porsche-911-gt3/",
      title: "2004 Porsche 911 GT3",
      brand: "Porsche",
      model: "911",
      year: 2004,
      auctionStatus: "sold",
      currentBid: 156000,
      currency: "USD",
      images: ["https://cdn.example.com/a.jpg"],
    };

    const out = normalizeRawListing({ source: "BaT", raw });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(CanonicalListingSchema.parse(out.value).source).toBe("BaT");
    expect(out.value.make).toBe("Porsche");
    expect(out.value.current_bid).toBe(156000);
  });

  it("rejects non-porsche payload", () => {
    const out = normalizeRawListing({
      source: "CarsAndBids",
      raw: {
        id: "cab_10",
        url: "https://carsandbids.com/auctions/test",
        title: "2019 BMW M3",
        make: "BMW",
      },
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reject.reason).toBe("non_porsche");
  });

  it("rejects record when explicit make is non-porsche", () => {
    const out = normalizeRawListing({
      source: "BaT",
      raw: {
        id: 9,
        auctionUrl: "https://bringatrailer.com/listing/test-9",
        title: "Porsche-themed poster",
        make: "Ford",
      },
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reject.reason).toBe("non_porsche");
  });

  it("dedupes by source+source_id+url", () => {
    const a = CanonicalListingSchema.parse({
      source: "ClassicCars",
      source_id: "cc_1",
      source_url: "https://classiccars.com/listing/1",
      make: "Porsche",
      model: "911",
      year: 1989,
      title: "1989 Porsche 911",
      status: "active",
      sale_date: null,
      mileage_unit: "km",
      auction_house: "ClassicCars",
      images: [],
      raw_payload: {},
    });
    const deduped = dedupeListings([a, a]);
    expect(deduped).toHaveLength(1);
  });

  it("maps AutoScout24 nested pricing and location fields", () => {
    const out = normalizeRawListing({
      source: "AutoScout24",
      raw: {
        id: "as24_1",
        url: "https://www.autoscout24.com/offers/porsche-911-as24-1",
        title: "2018 Porsche 911 Carrera",
        brand: "Porsche",
        model: "911",
        attributes: {
          Mileage: "54,300 km",
          "First Registration": "01/2018",
        },
        price: {
          total: {
            amount: 102900,
            currency: "EUR",
          },
        },
        dealerDetails: {
          addressStructured: {
            countryCode: "DE",
            city: "Berlin",
          },
        },
        images: ["https://images.example.com/porsche.jpg"],
      },
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.status).toBe("active");
    expect(out.value.final_price).toBe(102900);
    expect(out.value.currency).toBe("EUR");
    expect(out.value.year).toBe(2018);
    expect(out.value.country).toBe("DE");
    expect(out.value.city).toBe("Berlin");
  });

  it("builds deterministic fallback fingerprint", () => {
    const fingerprint = buildListingFingerprint({
      year: 2017,
      model: "911",
      vin: null,
      mileage: 50000,
      final_price: 88000,
      hammer_price: null,
      current_bid: null,
      city: "Munich",
    });
    expect(fingerprint).toBe("2017|911|50000|88000|munich");
  });
});
