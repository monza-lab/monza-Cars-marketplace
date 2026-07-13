import { describe, expect, it } from "vitest";

import { evaluateListing, type AssuranceListingRow } from "./completeness";
import { getAssuranceSource } from "./manifest";

const complete: AssuranceListingRow = {
  id: "listing-1",
  source: "AutoScout24",
  source_id: "as24-1",
  source_url: "https://example.test/car/1",
  title: "2020 Porsche 911 Carrera",
  make: "Porsche",
  model: "911 Carrera",
  year: 2020,
  status: "active",
  listing_price: 90_000,
  current_bid: null,
  hammer_price: null,
  final_price: null,
  sold_price: null,
  original_currency: "EUR",
  images: ["https://example.test/car.jpg"],
  location: "Berlin, Germany",
  city: "Berlin",
  region: null,
  country: "DE",
  vin: "WP0ZZZ99ZLS123456",
  trim: "Carrera",
  engine: "3.0L Flat-6",
  transmission: "PDK",
  mileage: 12_000,
  mileage_unit: "km",
  color_exterior: "Black",
  color_interior: "Black",
  body_style: "Coupe",
  description_text: "Dealer description",
  enrichment_meta: {},
};

function source() {
  const definition = getAssuranceSource("AutoScout24");
  if (!definition) throw new Error("AutoScout24 contract missing");
  return definition;
}

describe("evaluateListing", () => {
  it("passes a fully populated source contract", () => {
    const result = evaluateListing(complete, source(), new Date("2026-07-13T12:00:00Z"));
    expect(result.unresolved).toEqual([]);
    expect(result.rawCompletenessPct).toBe(100);
    expect(result.contractResolutionPct).toBe(100);
  });

  it("rejects silent blanks and placeholder text", () => {
    const result = evaluateListing(
      { ...complete, engine: null, transmission: "Unknown" },
      source(),
      new Date("2026-07-13T12:00:00Z"),
    );
    expect(result.unresolved).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "engine", reason: "missing" }),
      expect.objectContaining({ field: "transmission", reason: "missing" }),
    ]));
  });

  it("accepts fresh verified source unavailability without inflating raw completeness", () => {
    const result = evaluateListing({
      ...complete,
      vin: null,
      enrichment_meta: {
        assurance: {
          fields: {
            vin: {
              state: "unavailable_at_source",
              checkedAt: "2026-07-12T12:00:00.000Z",
              sourceUrl: complete.source_url!,
              method: "detail-page-inspection",
              evidenceHash: "sha256:abc123",
            },
          },
        },
      },
    }, source(), new Date("2026-07-13T12:00:00Z"));

    expect(result.unresolved).toEqual([]);
    expect(result.contractResolutionPct).toBe(100);
    expect(result.rawCompletenessPct).toBeLessThan(100);
  });

  it("expires unavailable evidence after thirty days", () => {
    const result = evaluateListing({
      ...complete,
      vin: null,
      enrichment_meta: {
        assurance: {
          fields: {
            vin: {
              state: "unavailable_at_source",
              checkedAt: "2026-05-01T12:00:00.000Z",
              sourceUrl: complete.source_url!,
              method: "detail-page-inspection",
              evidenceHash: "sha256:abc123",
            },
          },
        },
      },
    }, source(), new Date("2026-07-13T12:00:00Z"));

    expect(result.unresolved).toContainEqual(
      expect.objectContaining({ field: "vin", reason: "evidence_expired" }),
    );
  });

  it("does not allow unavailable evidence for hard identity fields", () => {
    const result = evaluateListing({
      ...complete,
      title: "",
      enrichment_meta: {
        assurance: {
          fields: {
            title: {
              state: "unavailable_at_source",
              checkedAt: "2026-07-12T12:00:00.000Z",
              sourceUrl: complete.source_url!,
              method: "detail-page-inspection",
              evidenceHash: "sha256:abc123",
            },
          },
        },
      },
    }, source(), new Date("2026-07-13T12:00:00Z"));

    expect(result.unresolved).toContainEqual(
      expect.objectContaining({ field: "title", reason: "unavailable_not_allowed" }),
    );
  });
});
