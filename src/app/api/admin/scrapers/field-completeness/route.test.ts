import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetchActiveListings: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/features/scrapers/common/assurance/database", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/scrapers/common/assurance/database")>();
  return { ...original, fetchActiveListings: mocks.fetchActiveListings };
});

import { GET } from "./route";

function makeSupabaseClient(email = "caposk8@hotmail.com") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: email ? { email } : null,
        },
      }),
    },
  };
}

function listing(overrides: Record<string, unknown> = {}) {
  return {
    id: "listing-1", source: "BaT", source_id: "source-1", source_url: "https://example.test/1",
    title: "2020 Porsche 911", make: "Porsche", model: "911", year: 2020, status: "active",
    listing_price: null, current_bid: 100000, hammer_price: null, final_price: null, sold_price: null,
    original_currency: "USD", images: ["https://img.example.com/1.jpg"], location: "US", city: null,
    region: null, country: "US", vin: "WP0ZZZ99ZTS392124", trim: "Carrera", engine: "3.6L",
    transmission: "Manual", mileage: 120000, mileage_unit: "mi", color_exterior: "Black",
    color_interior: "Tan", body_style: "Coupe", description_text: "Description", enrichment_meta: {},
    ...overrides,
  };
}

describe("GET /api/admin/scrapers/field-completeness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns field percentages and explicit image completeness per source", async () => {
    mocks.createClient.mockResolvedValue(makeSupabaseClient());
    mocks.fetchActiveListings.mockResolvedValue([
      listing(),
      listing({ id: "listing-2", source_id: "source-2", source_url: "https://example.test/2", vin: null,
        trim: "", engine: null, transmission: "", mileage: null, color_exterior: null,
        color_interior: "", body_style: null, current_bid: 0, images: [] }),
      listing({ id: "listing-3", source: "ClassicCom", source_id: "source-3", source_url: "https://example.test/3",
        vin: "WP0ZZZ99ZTS392125", trim: "Turbo", engine: "3.3L", mileage: 80000,
        color_exterior: "Silver", color_interior: "Black", current_bid: 0,
        listing_price: 75000, images: ["https://img.example.com/2.jpg", "https://img.example.com/3.jpg"] }),
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe(200);
    expect(body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "BaT",
        total: 2,
        vin: 50,
        trim: 50,
        engine: 50,
        transmission: 50,
        mileage: 50,
        color_exterior: 50,
        color_interior: 50,
        body_style: 50,
        price: 50,
        images: 50,
        imageCompleteness: {
          withImages: 1,
          missingImages: 1,
          percentage: 50,
        },
        rawCompleteness: expect.any(Number),
        contractResolution: expect.any(Number),
        unresolvedFields: expect.any(Number),
        verifiedUnavailableFields: 0,
      }),
      expect.objectContaining({
        source: "ClassicCom",
        total: 1,
        vin: 100,
        trim: 100,
        engine: 100,
        transmission: 100,
        mileage: 100,
        color_exterior: 100,
        color_interior: 100,
        body_style: 100,
        price: 100,
        images: 100,
        imageCompleteness: {
          withImages: 1,
          missingImages: 0,
          percentage: 100,
        },
        rawCompleteness: 100,
        contractResolution: 100,
        unresolvedFields: 0,
        verifiedUnavailableFields: 0,
      }),
    ]));
    expect(body.data).toHaveLength(8);
    expect(body.generatedAt).toEqual(expect.any(String));
  });
});
