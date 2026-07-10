import { describe, expect, it } from "vitest";

import { buildBatDetailUpdates } from "../../scripts/bat-detail-scraper";

describe("buildBatDetailUpdates", () => {
  it("truncates varchar-limited BaT detail fields before DB update", () => {
    const updates = buildBatDetailUpdates(
      {
        images: [],
        engine: null,
        mileage: null,
        vin: null,
        transmission: null,
        color_exterior: null,
        color_interior: null,
        body_style: null,
        description_text: null,
        seller_notes: null,
        current_bid: null,
        hammer_price: null,
        original_currency: null,
      },
      {
        images: ["https://bringatrailer.com/example.jpg"],
        engine: "3.8L Flat-Six".repeat(20),
        mileage: 12000,
        mileageUnit: "miles",
        vin: "WP0ZZZ99ZTS392124-OVERLONG",
        transmission: "Six-Speed Manual".repeat(20),
        exteriorColor: "Guards Red ".repeat(20),
        interiorColor: "Black Leather ".repeat(20),
        bodyStyle: "Coupe ".repeat(20),
        description: "Long text fields are allowed here.".repeat(20),
        sellerNotes: "Seller notes are text, not varchar.".repeat(20),
        currentBid: 123456,
      },
    );

    expect(updates.vin).toHaveLength(17);
    expect(updates.color_exterior).toHaveLength(100);
    expect(updates.color_interior).toHaveLength(100);
    expect(updates.body_style).toHaveLength(50);
    expect(updates.engine).toContain("3.8L Flat-Six");
    expect(updates.transmission).toContain("Six-Speed Manual");
  });
});
