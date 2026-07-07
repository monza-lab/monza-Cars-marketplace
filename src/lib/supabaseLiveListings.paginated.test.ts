import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Chainable mock for fetchPaginatedListings.
 *
 * Every builder method (select, eq, ilike, or, gte, lte, in, order) returns
 * `this` so the full Supabase query chain resolves correctly. The terminal
 * `range()` resolves to { data: [], error: null }.
 *
 * We spy on individual methods so we can assert which were (or weren't) called.
 */

// Spies — declared here so vi.mock() closure can reference them.
const spySelect = vi.fn();
const spyEq = vi.fn();
const spyIlike = vi.fn();
const spyOr = vi.fn();
const spyGte = vi.fn();
const spyLte = vi.fn();
const spyIn = vi.fn();
const spyIs = vi.fn();
const spyLt = vi.fn();
const spyOrder = vi.fn();
const spyLimit = vi.fn();
const spyFrom = vi.fn();
const createdChains: Record<string, (...args: unknown[]) => unknown>[] = [];

// Build the chainable proxy: every spy returns `chain` so calls compose.
// `range` is the terminal — resolves the promise.
function makeChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};

  const wrap =
    (spy: ReturnType<typeof vi.fn>) =>
    (...args: unknown[]) => {
      (spy as (...a: unknown[]) => void)(...args);
      return chain;
    };

  chain.select = wrap(spySelect);
  chain.eq = wrap(spyEq);
  chain.ilike = wrap(spyIlike);
  chain.or = wrap(spyOr);
  chain.gte = wrap(spyGte);
  chain.lte = wrap(spyLte);
  chain.in = wrap(spyIn);
  chain.is = wrap(spyIs);
  chain.lt = wrap(spyLt);
  chain.order = wrap(spyOrder);
  chain.limit = (...args: unknown[]) => {
    spyLimit(...args);
    return Promise.resolve({ data: [], error: null });
  };

  createdChains.push(chain);
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (...args: unknown[]) => {
      spyFrom(...args);
      return makeChain();
    },
  }),
}));

describe("fetchPaginatedListings", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    vi.resetModules();
    // Clear all spies before each test
    spySelect.mockClear();
    spyEq.mockClear();
    spyIlike.mockClear();
    spyOr.mockClear();
    spyGte.mockClear();
    spyLte.mockClear();
    spyIn.mockClear();
    spyIs.mockClear();
    spyLt.mockClear();
    spyOrder.mockClear();
    spyLimit.mockClear();
    spyFrom.mockClear();
    createdChains.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("case 1: series provided — uses .eq('make') and .eq('series'), never .or() with model.ilike.", async () => {
    const { fetchPaginatedListings } = await import("./supabaseLiveListings");

    await fetchPaginatedListings({
      make: "Porsche",
      series: "992",
      modelPatterns: { keywords: ["992"], yearMin: 2019, yearMax: 2024 },
      status: "all",
    });

    // make filter must use eq, not ilike
    const eqCalls = spyEq.mock.calls;
    const makeEqCall = eqCalls.find(([col]) => col === "make");
    expect(makeEqCall).toBeDefined();
    expect(makeEqCall?.[1]).toBe("Porsche");

    // ilike("make", ...) must NOT be called
    const makeiLikeCall = spyIlike.mock.calls.find(([col]) => col === "make");
    expect(makeiLikeCall).toBeUndefined();

    // series eq filter must be applied
    const seriesEqCall = eqCalls.find(([col]) => col === "series");
    expect(seriesEqCall).toBeDefined();
    expect(seriesEqCall?.[1]).toBe("992");

    // No .or() call containing "model.ilike." should exist
    const modelOrCall = spyOr.mock.calls.find(([clause]) =>
      clause.includes("model.ilike."),
    );
    expect(modelOrCall).toBeUndefined();
  });

  it("case 2: no series, modelPatterns provided — uses legacy keyword-OR path", async () => {
    const { fetchPaginatedListings } = await import("./supabaseLiveListings");

    await fetchPaginatedListings({
      make: "Porsche",
      modelPatterns: { keywords: ["992", "Carrera 4S"], yearMin: 2019 },
      status: "all",
    });

    // make filter must use eq, not ilike
    const makeEqCall = spyEq.mock.calls.find(([col]) => col === "make");
    expect(makeEqCall).toBeDefined();
    expect(makeEqCall?.[1]).toBe("Porsche");

    // ilike("make", ...) must NOT be called
    const makeiLikeCall = spyIlike.mock.calls.find(([col]) => col === "make");
    expect(makeiLikeCall).toBeUndefined();

    // series eq filter must NOT be applied (no series provided)
    const seriesEqCall = spyEq.mock.calls.find(([col]) => col === "series");
    expect(seriesEqCall).toBeUndefined();

    // Legacy .or() call with model.ilike. MUST be present
    const modelOrCall = spyOr.mock.calls.find(([clause]) =>
      clause.includes("model.ilike."),
    );
    expect(modelOrCall).toBeDefined();
    // Verify both keywords appear in the OR clause
    expect(modelOrCall?.[0]).toContain("model.ilike.%992%");
  });

  it("case 3: both series and modelPatterns — series takes precedence, legacy OR is NOT called", async () => {
    const { fetchPaginatedListings } = await import("./supabaseLiveListings");

    await fetchPaginatedListings({
      make: "Porsche",
      series: "991",
      modelPatterns: { keywords: ["991", "Carrera"], yearMin: 2012, yearMax: 2019 },
      status: "all",
    });

    // make filter must use eq
    const makeEqCall = spyEq.mock.calls.find(([col]) => col === "make");
    expect(makeEqCall).toBeDefined();

    // series eq filter applied
    const seriesEqCall = spyEq.mock.calls.find(([col]) => col === "series");
    expect(seriesEqCall).toBeDefined();
    expect(seriesEqCall?.[1]).toBe("991");

    // Year range from modelPatterns should still be applied alongside series
    const gteCall = spyGte.mock.calls.find(([col]) => col === "year");
    expect(gteCall).toBeDefined();
    expect(gteCall?.[1]).toBe(2012);

    const lteCall = spyLte.mock.calls.find(([col]) => col === "year");
    expect(lteCall).toBeDefined();
    expect(lteCall?.[1]).toBe(2019);

    // Legacy .or() with model.ilike. must NOT be called
    const modelOrCall = spyOr.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("model.ilike."),
    );
    expect(modelOrCall).toBeUndefined();
  });

  it("case 4: default path skips the extra live-count query", async () => {
    const { fetchPaginatedListings } = await import("./supabaseLiveListings");

    await fetchPaginatedListings({
      make: "Porsche",
      status: "active",
    });

    expect(spyFrom).toHaveBeenCalledTimes(1);
    expect(spyFrom).toHaveBeenCalledWith("listings");
  });

  it("case 5: default path uses a fixed rarity-first ORDER BY for stable keyset pagination", async () => {
    const { fetchPaginatedListings } = await import("./supabaseLiveListings");

    await fetchPaginatedListings({
      make: "Porsche",
      status: "all",
    });

    expect(spyOrder.mock.calls).toEqual([
      ["rarity_score", { ascending: false, nullsFirst: false }],
      ["end_time", { ascending: true, nullsFirst: false }],
      ["id", { ascending: false }],
    ]);
  });

  it("case 6: free-text search uses token AND semantics across title, model, trim, and series", async () => {
    const { fetchPaginatedListings } = await import("./supabaseLiveListings");

    await fetchPaginatedListings({
      make: "Porsche",
      query: "997 GTS",
      status: "active",
    });

    const clauses = spyOr.mock.calls
      .map(([clause]) => clause)
      .filter((clause): clause is string => typeof clause === "string");

    expect(clauses.some((clause) => clause.includes("%997 GTS%"))).toBe(false);
    expect(clauses).toEqual(
      expect.arrayContaining([
        expect.stringContaining("series.ilike.%997%"),
        expect.stringContaining("trim.ilike.%GTS%"),
      ]),
    );
  });

  it("case 7: free-text search strips PostgREST OR grammar before building clauses", async () => {
    const { fetchPaginatedListings } = await import("./supabaseLiveListings");

    await fetchPaginatedListings({
      make: "Porsche",
      query: "GT3,vin.ilike.*WP0*",
      status: "active",
    });

    const clauses = spyOr.mock.calls
      .map(([clause]) => clause)
      .filter((clause): clause is string => typeof clause === "string");
    const joined = clauses.join("|");

    expect(joined).toContain("title.ilike.%GT3%");
    expect(joined).not.toContain(",vin.ilike");
    expect(joined).not.toContain("*");
  });

  it("dedupes AutoScout24 URL variants by native listing UUID", async () => {
    const { buildListingDeduplicationKey, dedupeListingRows } = await import("./supabaseLiveListings");

    const base = {
      source: "AutoScout24",
      platform: "AUTO_SCOUT_24",
      source_url:
        "https://www.autoscout24.com/offers/porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-04631d26-6ed8-4c2f-b094-51f66294fada",
      title: "Porsche 911 911 3.2 Carrera - PTS - Sonderwunsch - Recaro",
      vin: null,
      images: ["https://www.autoscout24.net/images/test.webp"],
      mileage: 188116,
      hammer_price: 79000,
      current_bid: 79000,
      final_price: null,
    };
    const rows = [
      {
        ...base,
        id: "plain",
        source_id:
          "as24-porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-04631d26-6ed8-4c2f-b094-51f66294fada",
      },
      {
        ...base,
        id: "category",
        source_id:
          "as24-porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-cat_ma57mo1950-04631d26-6ed8-4c2f-b094-51f66294fada",
        source_url:
          "https://www.autoscout24.com/offers/porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-cat_ma57mo1950-04631d26-6ed8-4c2f-b094-51f66294fada",
      },
      {
        ...base,
        id: "model",
        source_id:
          "as24-porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-cat_ma57mo1950ge282va266-04631d26-6ed8-4c2f-b094-51f66294fada",
        source_url:
          "https://www.autoscout24.com/offers/porsche-911-911-3-2-carrera-pts-sonderwunsch-recaro-gasoline-blue-cat_ma57mo1950ge282va266-04631d26-6ed8-4c2f-b094-51f66294fada",
      },
    ];

    type ListingRowForTest = Parameters<typeof buildListingDeduplicationKey>[0];
    const listingRows = rows as unknown as ListingRowForTest[];

    expect(new Set(listingRows.map(buildListingDeduplicationKey)).size).toBe(1);
    expect(dedupeListingRows(listingRows).map((row) => row.id)).toEqual(["plain"]);
  });
});
