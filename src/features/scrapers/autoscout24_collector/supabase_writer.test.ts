import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseWriter, mapNormalizedListingToListingsRow } from "./supabase_writer";
import type { NormalizedListing, ScrapeMeta } from "./types";

const supabaseMock = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: supabaseMock.createClient,
}));

function makeListing(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
    source: "AutoScout24",
    sourceId: "test-id",
    sourceUrl: "https://www.autoscout24.com/offers/test",
    title: "2020 Porsche 911 Carrera",
    make: "Porsche",
    model: "911",
    trim: null,
    year: 2020,
    bodyStyle: null,
    exteriorColor: null,
    interiorColor: null,
    mileageKm: 10000,
    mileageUnitStored: "km",
    vin: null,
    pricing: { hammerPrice: 100000, originalCurrency: "EUR", currentBid: null, bidCount: 0 },
    location: { country: "DE", region: null, city: null },
    auctionHouse: null,
    auctionDate: null,
    saleDate: null,
    listDate: null,
    status: "active",
    reserveMet: null,
    photosCount: 0,
    descriptionText: null,
    dataQualityScore: 0.5,
    platform: "AutoScout24",
    reserveStatus: null,
    sellerNotes: null,
    photos: [],
    engine: null,
    transmission: null,
    endTime: null,
    startTime: null,
    finalPrice: null,
    locationString: null,
    ...overrides,
  } as NormalizedListing;
}

const meta: ScrapeMeta = {
  scrapeTimestamp: "2026-05-07T00:00:00.000Z",
  runId: "test-run",
};

type FakeResult = { data: unknown[] | null; error: { message: string } | null };

class FakeSupabaseQuery {
  private operation: "select" | "upsert" | "update" | null = null;
  private filters: Record<string, unknown> = {};

  constructor(
    private readonly table: string,
    private readonly executeQuery: (query: FakeSupabaseQuery) => FakeResult,
    public payload?: Record<string, unknown>,
  ) {}

  select(): this {
    this.operation = this.operation ?? "select";
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters[field] = value;
    return this;
  }

  limit(): this {
    return this;
  }

  upsert(payload: Record<string, unknown>): this {
    this.operation = "upsert";
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>): this {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  get tableName(): string {
    return this.table;
  }

  get op(): "select" | "upsert" | "update" | null {
    return this.operation;
  }

  get where(): Record<string, unknown> {
    return this.filters;
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.executeQuery(this)).then(onfulfilled, onrejected);
  }
}

function makeConflictAwareClient() {
  const upsertPayloads: Array<Record<string, unknown>> = [];
  const canonicalId = "canonical-as24-row";
  const conflictingUrl =
    "https://www.autoscout24.com/offers/porsche-911-filtered-cat_ma57mo1950-68a086af-5e80-4d10-a2ea-7dcd3b427d40";

  const client = {
    from(table: string) {
      return new FakeSupabaseQuery(table, (query) => {
        if (query.tableName === "listings" && query.op === "select") {
          if (query.where.source_id === "as24-68a086af-5e80-4d10-a2ea-7dcd3b427d40") {
            return { data: [{ id: canonicalId, source_id: query.where.source_id, source_url: "https://www.autoscout24.com/offers/porsche-911-68a086af-5e80-4d10-a2ea-7dcd3b427d40" }], error: null };
          }
          if (query.where.source_url === conflictingUrl) {
            return { data: [{ id: "older-duplicate-row", source_id: "as24-old-decorated-slug", source_url: conflictingUrl }], error: null };
          }
        }

        if (query.tableName === "listings" && query.op === "upsert") {
          upsertPayloads.push(query.payload ?? {});
          if (query.payload?.source_url === conflictingUrl) {
            return {
              data: null,
              error: { message: 'duplicate key value violates unique constraint "listings_source_url_unique"' },
            };
          }
          return { data: [{ id: canonicalId }], error: null };
        }

        return { data: [], error: null };
      });
    },
  };

  return { client, upsertPayloads, conflictingUrl };
}

describe("mapNormalizedListingToListingsRow", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("truncates make, model, trim, vin, engine, transmission to VARCHAR limits", () => {
    const listing = makeListing({
      make: "A".repeat(150),
      model: "B".repeat(150),
      trim: "C".repeat(150),
      vin: "WVWZZZ3CZWE123456789", // 20 chars
      engine: "D".repeat(150),
      transmission: "E".repeat(150),
    });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect((row.make as string).length).toBe(100);
    expect((row.model as string).length).toBe(100);
    expect((row.trim as string).length).toBe(100);
    expect((row.vin as string).length).toBe(17);
    expect((row.engine as string).length).toBe(100);
    expect((row.transmission as string).length).toBe(100);
  });

  it("truncates body_style, color_exterior, color_interior to 100", () => {
    const listing = makeListing({
      bodyStyle: "F".repeat(120),
      exteriorColor: "G".repeat(130),
      interiorColor: "H".repeat(110),
    });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect((row.body_style as string).length).toBe(100);
    expect((row.color_exterior as string).length).toBe(100);
    expect((row.color_interior as string).length).toBe(100);
  });

  it("passes through short values unchanged", () => {
    const listing = makeListing({
      make: "Porsche",
      model: "911",
      trim: "Carrera S",
      vin: "WP0AB2A99LS12345",
      engine: "3.0L Flat-6",
      transmission: "PDK",
    });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect(row.make).toBe("Porsche");
    expect(row.model).toBe("911");
    expect(row.trim).toBe("Carrera S");
    expect(row.vin).toBe("WP0AB2A99LS12345");
    expect(row.engine).toBe("3.0L Flat-6");
    expect(row.transmission).toBe("PDK");
  });

  it("omits nullable detail-only fields when normalized listing values are null", () => {
    const listing = makeListing({
      make: "Porsche",
      model: "911",
      trim: null,
      vin: null,
      engine: null,
      transmission: null,
      bodyStyle: null,
      exteriorColor: null,
      interiorColor: null,
      descriptionText: null,
      auctionDate: null,
      saleDate: null,
      listDate: null,
      reserveMet: null,
      reserveStatus: null,
      finalPrice: null,
      locationString: null,
    });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect(row).not.toHaveProperty("trim");
    expect(row).not.toHaveProperty("body_style");
    expect(row).not.toHaveProperty("color_exterior");
    expect(row).not.toHaveProperty("color_interior");
    expect(row).not.toHaveProperty("engine");
    expect(row).not.toHaveProperty("vin");
    expect(row).not.toHaveProperty("description_text");
    expect(row).not.toHaveProperty("transmission");

    expect(row.auction_date).toBeNull();
    expect(row.sale_date).toBeNull();
    expect(row.list_date).toBeNull();
    expect(row.reserve_met).toBeNull();
    expect(row.reserve_status).toBeNull();
    expect(row.final_price).toBeNull();
    expect(row.location).toBeNull();
  });

  it("preserves transmission from search summary when available", () => {
    const listing = makeListing({ transmission: "Manual" });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect(row.transmission).toBe("Manual");
  });

  it("omits empty and placeholder target fields that would erase usable details", () => {
    const listing = makeListing({
      exteriorColor: "",
      engine: "Not specified",
      transmission: "-",
    });

    const row = mapNormalizedListingToListingsRow(listing, meta);

    expect(row).not.toHaveProperty("color_exterior");
    expect(row).not.toHaveProperty("engine");
    expect(row).not.toHaveProperty("transmission");
  });

  it("preserves the canonical AS24 row when an older duplicate owns the discovered source_url", async () => {
    const { client, upsertPayloads, conflictingUrl } = makeConflictAwareClient();
    supabaseMock.createClient.mockReturnValueOnce(client);
    const writer = createSupabaseWriter();

    await expect(
      writer.upsertAll(
        makeListing({
          sourceId: "as24-68a086af-5e80-4d10-a2ea-7dcd3b427d40",
          sourceUrl: conflictingUrl,
          pricing: { hammerPrice: 100000, originalCurrency: "EUR", currentBid: null, bidCount: 0, rawPriceText: null },
        }),
        meta,
        false,
      ),
    ).resolves.toEqual({ listingId: "canonical-as24-row", wrote: true });

    expect(upsertPayloads[0]).not.toHaveProperty("source_url");
  });
});
