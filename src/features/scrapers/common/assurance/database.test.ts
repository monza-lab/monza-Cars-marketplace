import { describe, expect, it } from "vitest";

import type { AssuranceListingRow } from "./completeness";
import { buildAssuranceReport, compareAssuranceReports } from "./database";

function completeListing(overrides: Partial<AssuranceListingRow> = {}): AssuranceListingRow {
  return {
    id: "listing-1",
    source: "AutoScout24",
    source_id: "source-1",
    source_url: "https://example.test/listing/1",
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
    ...overrides,
  };
}

describe("buildAssuranceReport", () => {
  it("creates a deterministic listing-level repair queue and blocks unknown sources", () => {
    const report = buildAssuranceReport([
      completeListing({ id: "z", source: "AutoScout24", transmission: null }),
      completeListing({ id: "a", source: "AutoScout24", engine: null }),
      completeListing({ id: "b", source: "UnregisteredMarket" }),
    ], [], new Date("2026-07-13T12:00:00Z"));

    expect(report.inventory.unknownDatabaseSources).toEqual(["UnregisteredMarket"]);
    expect(report.repairQueue).toEqual([
      expect.objectContaining({ listingId: "a", source: "AutoScout24", field: "engine" }),
      expect.objectContaining({ listingId: "z", source: "AutoScout24", field: "transmission" }),
    ]);
    expect(report.outcome).toBe("blocked");
  });

  it("blocks and counts active rows whose source is missing instead of reporting 100%", () => {
    const report = buildAssuranceReport([
      completeListing({ id: "missing-source", source: "   " }),
    ], [], new Date("2026-07-13T12:00:00Z"));

    expect(report.inventory.unknownDatabaseSources).toContain("<missing>");
    expect(report.inventory.unassessedActiveListings).toBe(1);
    expect(report.totals.activeListings).toBe(1);
    expect(report.totals.contractResolutionPct).toBeLessThan(100);
    expect(report.outcome).toBe("blocked");
  });

  it("blocks manifest sources with no active rows instead of assigning vacuous 100%", () => {
    const report = buildAssuranceReport([
      completeListing({ source: "AutoScout24" }),
    ], [], new Date("2026-07-13T12:00:00Z"));

    expect(report.sources).toHaveLength(8);
    expect(report.sources.find((source) => source.source === "BaT")).toEqual(
      expect.objectContaining({ activeListings: 0, contractResolutionPct: 0 }),
    );
    expect(report.inventory.missingDatabaseSources).toContain("BaT");
    expect(report.outcome).toBe("blocked");
  });

  it("counts fresh unavailable evidence as resolved but not populated", () => {
    const row = completeListing({
      vin: null,
      enrichment_meta: {
        assurance: {
          fields: {
            vin: {
              state: "unavailable_at_source",
              checkedAt: "2026-07-12T12:00:00.000Z",
              sourceUrl: "https://example.test/listing/1",
              method: "detail-page-inspection",
              evidenceHash: "sha256:abc123",
            },
          },
        },
      },
    });
    const report = buildAssuranceReport([row], [], new Date("2026-07-13T12:00:00Z"));

    expect(report.totals.populatedFields).toBe(report.totals.requiredFields - 1);
    expect(report.totals.resolvedFields).toBe(report.totals.requiredFields);
    expect(report.sources.find((source) => source.source === "AutoScout24")?.unavailableFields).toBe(1);
  });
});

describe("compareAssuranceReports", () => {
  it("flags an unexplained raw-completeness drop above 0.1 percentage points", () => {
    const previous = buildAssuranceReport([
      completeListing(),
    ], [], new Date("2026-07-06T12:00:00Z"));
    const current = buildAssuranceReport([
      completeListing({ engine: null }),
    ], [], new Date("2026-07-13T12:00:00Z"));

    const comparison = compareAssuranceReports(current, previous);

    expect(comparison.sources.find((source) => source.source === "AutoScout24")).toEqual(
      expect.objectContaining({ rawCompletenessRegression: true }),
    );
  });
});
