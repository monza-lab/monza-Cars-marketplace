import { describe, expect, it } from "vitest";

import { normalizeFromSearch } from "./normalize";
import type { AS24ListingSummary, ScrapeMeta } from "./types";

function makeSearch(overrides: Partial<AS24ListingSummary> = {}): AS24ListingSummary {
  return {
    id: "as24-test-1",
    url: "https://www.autoscout24.com/offers/porsche-911-test",
    title: "1978 Porsche 911 SC",
    price: 75000,
    currency: "EUR",
    mileageKm: 120000,
    year: 1978,
    make: "Porsche",
    model: "911",
    fuelType: null,
    transmission: null,
    power: null,
    location: "Berlin",
    country: "D",
    sellerType: null,
    images: [],
    firstRegistration: null,
    ...overrides,
  };
}

const meta: ScrapeMeta = {
  runId: "test-run",
  scrapeTimestamp: "2026-06-29T00:00:00.000Z",
};

describe("normalizeFromSearch", () => {
  it("drops summaries without a usable source URL before they reach Supabase", () => {
    const listing = normalizeFromSearch({
      search: makeSearch({ url: "" }),
      meta,
      targetMake: "Porsche",
    });

    expect(listing).toBeNull();
  });
});
