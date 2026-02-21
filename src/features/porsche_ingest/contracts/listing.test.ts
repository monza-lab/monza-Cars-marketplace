import { describe, expect, it } from "vitest";

import { CanonicalListingSchema } from "./listing";

describe("canonical listing contract", () => {
  it("accepts a minimal Porsche listing", () => {
    const parsed = CanonicalListingSchema.parse({
      source: "BaT",
      source_id: "bat_1",
      source_url: "https://bringatrailer.com/listing/test/",
      make: "Porsche",
      model: "911",
      year: 1995,
      title: "1995 Porsche 911",
      status: "sold",
      sale_date: "2026-02-20",
      mileage_unit: "km",
      auction_house: "Bring a Trailer",
      images: [],
      raw_payload: {},
    });

    expect(parsed.make).toBe("Porsche");
    expect(parsed.model).toBe("911");
  });
});
