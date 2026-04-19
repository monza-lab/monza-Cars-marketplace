import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { GET } from "./route";

function makeSupabaseClient(rows: Array<Record<string, unknown>>, email = "caposk8@hotmail.com") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: email ? { email } : null,
        },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: rows,
          error: null,
        }),
      }),
    }),
  };
}

describe("GET /api/admin/scrapers/field-completeness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns field percentages and explicit image completeness per source", async () => {
    mocks.createClient.mockResolvedValue(
      makeSupabaseClient([
        {
          source: "BaT",
          vin: "WP0ZZZ99ZTS392124",
          trim: "Carrera",
          engine: "3.6L",
          transmission: "Manual",
          mileage: 120000,
          color_exterior: "Black",
          color_interior: "Tan",
          body_style: "Coupe",
          current_bid: 100000,
          images: ["https://img.example.com/1.jpg"],
        },
        {
          source: "BaT",
          vin: null,
          trim: "",
          engine: null,
          transmission: "",
          mileage: null,
          color_exterior: null,
          color_interior: "",
          body_style: null,
          current_bid: 0,
          images: [],
        },
        {
          source: "Classic",
          vin: "WP0ZZZ99ZTS392125",
          trim: "Turbo",
          engine: "3.3L",
          transmission: "Manual",
          mileage: 80000,
          color_exterior: "Silver",
          color_interior: "Black",
          body_style: "Coupe",
          current_bid: 0,
          images: ["https://img.example.com/2.jpg", "https://img.example.com/3.jpg"],
        },
      ])
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe(200);
    expect(body.data).toEqual([
      {
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
      },
      {
        source: "Classic",
        total: 1,
        vin: 100,
        trim: 100,
        engine: 100,
        transmission: 100,
        mileage: 100,
        color_exterior: 100,
        color_interior: 100,
        body_style: 100,
        price: 0,
        images: 100,
        imageCompleteness: {
          withImages: 1,
          missingImages: 0,
          percentage: 100,
        },
      },
    ]);
    expect(body.generatedAt).toEqual(expect.any(String));
  });
});
