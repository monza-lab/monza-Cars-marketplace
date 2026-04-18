import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Keyset cursor pagination tests for fetchPaginatedListings.
 *
 * Three cases:
 * 1. No cursor + page fits (rows.length <= pageSize) → hasMore: false, nextCursor: null
 * 2. No cursor + page overflows (rows.length > pageSize) → hasMore: true, nextCursor set
 * 3. Cursor provided with non-null endTime → .or() called with the exact keyset clause
 */

// Chainable mock shape per spec
const chain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => chain }),
}));

// Helper to build minimal ListingRow-like objects for the mock
function makeRow(id: string, end_time: string | null = null) {
  return {
    id,
    year: 2020,
    make: "Porsche",
    model: "911",
    trim: null,
    source: "BaT",
    source_url: "https://bringatrailer.com/listing/test",
    status: "active",
    sale_date: null,
    country: "USA",
    region: null,
    city: null,
    hammer_price: null,
    original_currency: null,
    listing_price: 50000,
    mileage: null,
    mileage_unit: null,
    vin: null,
    color_exterior: null,
    color_interior: null,
    description_text: null,
    body_style: null,
    title: `2020 Porsche 911 #${id}`,
    platform: "BRING_A_TRAILER",
    current_bid: 50000,
    bid_count: 5,
    reserve_status: null,
    seller_notes: null,
    images: [],
    engine: null,
    transmission: null,
    end_time,
    start_time: null,
    final_price: null,
    location: null,
  };
}

describe("fetchPaginatedListings — keyset cursor pagination", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    vi.resetModules();

    // Reset all chain spies
    chain.select.mockReset().mockReturnThis();
    chain.eq.mockReset().mockReturnThis();
    chain.or.mockReset().mockReturnThis();
    chain.in.mockReset().mockReturnThis();
    chain.gte.mockReset().mockReturnThis();
    chain.lte.mockReset().mockReturnThis();
    chain.is.mockReset().mockReturnThis();
    chain.lt.mockReset().mockReturnThis();
    chain.order.mockReset().mockReturnThis();
    chain.limit.mockReset().mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("case 1: no cursor + page fits → hasMore: false, nextCursor: null", async () => {
    const pageSize = 3;
    // Return exactly pageSize rows (not pageSize+1), so hasMore should be false
    const rows = [
      makeRow("id-1", "2026-04-20T10:00:00Z"),
      makeRow("id-2", "2026-04-21T10:00:00Z"),
      makeRow("id-3", "2026-04-22T10:00:00Z"),
    ];

    chain.limit.mockResolvedValueOnce({ data: rows, error: null });

    const { fetchPaginatedListings } = await import("./supabaseLiveListings");

    const result = await fetchPaginatedListings({
      make: "Porsche",
      pageSize,
      cursor: null,
      status: "all",
    });

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.cars).toHaveLength(3);
  });

  it("case 2: no cursor + page overflows → hasMore: true, nextCursor set to last kept row", async () => {
    const pageSize = 3;
    // Return pageSize+1 rows to trigger overflow
    const rows = [
      makeRow("id-1", "2026-04-20T10:00:00Z"),
      makeRow("id-2", "2026-04-21T10:00:00Z"),
      makeRow("id-3", "2026-04-22T10:00:00Z"),
      makeRow("id-4", "2026-04-23T10:00:00Z"), // the overflow row
    ];

    chain.limit.mockResolvedValueOnce({ data: rows, error: null });

    const { fetchPaginatedListings } = await import("./supabaseLiveListings");

    const result = await fetchPaginatedListings({
      make: "Porsche",
      pageSize,
      cursor: null,
      status: "all",
    });

    expect(result.hasMore).toBe(true);
    expect(result.cars).toHaveLength(pageSize); // trimmed to pageSize
    // nextCursor must reference the last KEPT row (index pageSize-1 = "id-3")
    expect(result.nextCursor).toEqual({
      endTime: "2026-04-22T10:00:00Z",
      id: "id-3",
    });
  });

  it("case 3: cursor with non-null endTime → .or() called with keyset clause", async () => {
    const pageSize = 5;
    const cursorEndTime = "2026-04-22T10:00:00Z";
    const cursorId = "id-3";

    chain.limit.mockResolvedValueOnce({ data: [], error: null });

    const { fetchPaginatedListings } = await import("./supabaseLiveListings");

    await fetchPaginatedListings({
      make: "Porsche",
      pageSize,
      cursor: { endTime: cursorEndTime, id: cursorId },
      status: "all",
    });

    // Verify .or() was called with the exact keyset OR clause
    const orCalls = chain.or.mock.calls as [string][];
    const keysetOrCall = orCalls.find(([clause]) =>
      clause.includes(`end_time.gt.${cursorEndTime}`) &&
      clause.includes(`end_time.eq.${cursorEndTime}`) &&
      clause.includes(`id.lt.${cursorId}`)
    );

    expect(keysetOrCall).toBeDefined();
    expect(keysetOrCall?.[0]).toBe(
      `end_time.gt.${cursorEndTime},and(end_time.eq.${cursorEndTime},id.lt.${cursorId})`
    );
  });
});
