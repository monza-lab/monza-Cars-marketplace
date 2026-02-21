import { describe, expect, it } from "vitest";

import { CanonicalListingSchema } from "../contracts/listing";
import { evaluateSoldWindow } from "./sold_filter";

function baseListing() {
  return CanonicalListingSchema.parse({
    source: "BaT",
    source_id: "bat_1",
    source_url: "https://bringatrailer.com/listing/test/",
    make: "Porsche",
    model: "911",
    year: 2010,
    title: "2010 Porsche 911",
    status: "sold",
    sale_date: new Date().toISOString().slice(0, 10),
    mileage_unit: "km",
    auction_house: "Bring a Trailer",
    images: [],
    raw_payload: {},
  });
}

describe("sold window filter", () => {
  it("rejects non-sold records when soldOnly enabled", () => {
    const listing = { ...baseListing(), status: "active" as const };
    const result = evaluateSoldWindow(listing, { soldOnly: true, soldWithinMonths: 12 });
    expect(result).toEqual({ keep: false, reason: "not_sold" });
  });

  it("rejects sold records older than window", () => {
    const listing = { ...baseListing(), sale_date: "2020-01-01" };
    const result = evaluateSoldWindow(listing, { soldOnly: true, soldWithinMonths: 12 });
    expect(result).toEqual({ keep: false, reason: "outside_sold_window" });
  });

  it("accepts ended raw status as sold-equivalent", () => {
    const listing = {
      ...baseListing(),
      status: "draft" as const,
      raw_payload: { auctionStatus: "ended", scrapedTimestamp: new Date().toISOString() },
      sale_date: null,
    };
    const result = evaluateSoldWindow(listing, { soldOnly: true, soldWithinMonths: 12 });
    expect(result).toEqual({ keep: true });
  });
});
