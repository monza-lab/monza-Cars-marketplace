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
const spyOrder = vi.fn();
const spyRange = vi.fn();

// Build the chainable proxy: every spy returns `chain` so calls compose.
// `range` is the terminal — resolves the promise.
function makeChain() {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};

  const wrap =
    (spy: ReturnType<typeof vi.fn>) =>
    (...args: unknown[]) => {
      spy(...args);
      return chain;
    };

  chain.select = wrap(spySelect);
  chain.eq = wrap(spyEq);
  chain.ilike = wrap(spyIlike);
  chain.or = wrap(spyOr);
  chain.gte = wrap(spyGte);
  chain.lte = wrap(spyLte);
  chain.in = wrap(spyIn);
  chain.order = wrap(spyOrder);
  chain.range = (...args: unknown[]) => {
    spyRange(...args);
    return Promise.resolve({ data: [], error: null });
  };

  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => makeChain(),
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
    spyOrder.mockClear();
    spyRange.mockClear();
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
    const makeEqCall = eqCalls.find(
      ([col]: [string]) => col === "make",
    );
    expect(makeEqCall).toBeDefined();
    expect(makeEqCall?.[1]).toBe("Porsche");

    // ilike("make", ...) must NOT be called
    const makeiLikeCall = spyIlike.mock.calls.find(
      ([col]: [string]) => col === "make",
    );
    expect(makeiLikeCall).toBeUndefined();

    // series eq filter must be applied
    const seriesEqCall = eqCalls.find(
      ([col]: [string]) => col === "series",
    );
    expect(seriesEqCall).toBeDefined();
    expect(seriesEqCall?.[1]).toBe("992");

    // No .or() call containing "model.ilike." should exist
    const modelOrCall = spyOr.mock.calls.find(([clause]: [string]) =>
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
    const makeEqCall = spyEq.mock.calls.find(
      ([col]: [string]) => col === "make",
    );
    expect(makeEqCall).toBeDefined();
    expect(makeEqCall?.[1]).toBe("Porsche");

    // ilike("make", ...) must NOT be called
    const makeiLikeCall = spyIlike.mock.calls.find(
      ([col]: [string]) => col === "make",
    );
    expect(makeiLikeCall).toBeUndefined();

    // series eq filter must NOT be applied (no series provided)
    const seriesEqCall = spyEq.mock.calls.find(
      ([col]: [string]) => col === "series",
    );
    expect(seriesEqCall).toBeUndefined();

    // Legacy .or() call with model.ilike. MUST be present
    const modelOrCall = spyOr.mock.calls.find(([clause]: [string]) =>
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
    const makeEqCall = spyEq.mock.calls.find(
      ([col]: [string]) => col === "make",
    );
    expect(makeEqCall).toBeDefined();

    // series eq filter applied
    const seriesEqCall = spyEq.mock.calls.find(
      ([col]: [string]) => col === "series",
    );
    expect(seriesEqCall).toBeDefined();
    expect(seriesEqCall?.[1]).toBe("991");

    // Year range from modelPatterns should still be applied alongside series
    const gteCall = spyGte.mock.calls.find(
      ([col]: [string]) => col === "year",
    );
    expect(gteCall).toBeDefined();
    expect(gteCall?.[1]).toBe(2012);

    const lteCall = spyLte.mock.calls.find(
      ([col]: [string]) => col === "year",
    );
    expect(lteCall).toBeDefined();
    expect(lteCall?.[1]).toBe(2019);

    // Legacy .or() with model.ilike. must NOT be called
    const modelOrCall = spyOr.mock.calls.find(([clause]: [string]) =>
      clause.includes("model.ilike."),
    );
    expect(modelOrCall).toBeUndefined();
  });
});
