import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase — use a chainable builder that supports all PostgREST methods
const mockLimit = vi.fn();
const mockUpdate = vi.fn();

function createChainBuilder() {
  const builder: Record<string, any> = {};
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.not = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.limit = mockLimit;
  return builder;
}

let selectBuilder: ReturnType<typeof createChainBuilder>;

const mockFrom = vi.fn(() => ({
  select: vi.fn().mockImplementation(() => selectBuilder),
  update: mockUpdate,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { checkSource, runLivenessCheck, type LivenessResult } from "./index";

describe("checkSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectBuilder = createChainBuilder();
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  it("marks listing as unsold when source returns 404", async () => {
    const listing = {
      id: "test-123",
      source: "AutoScout24",
      source_url: "https://autoscout24.com/listing/123",
    };
    mockLimit.mockResolvedValue({ data: [listing], error: null });
    mockFetch.mockResolvedValue({ status: 404, ok: false });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await checkSource({
      source: "AutoScout24",
      delayMs: 0,
      maxPerRun: 10,
      timeBudgetMs: 60_000,
      dryRun: false,
    });

    expect(result.dead).toBe(1);
    expect(result.alive).toBe(0);
    expect(mockFrom).toHaveBeenCalledWith("listings");
  });

  it("marks listing as unsold when source returns 410 Gone", async () => {
    const listing = {
      id: "test-410",
      source: "AutoScout24",
      source_url: "https://autoscout24.com/listing/410",
    };
    mockLimit.mockResolvedValue({ data: [listing], error: null });
    mockFetch.mockResolvedValue({ status: 410, ok: false });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await checkSource({
      source: "AutoScout24",
      delayMs: 0,
      maxPerRun: 10,
      timeBudgetMs: 60_000,
      dryRun: false,
    });

    expect(result.dead).toBe(1);
    expect(result.alive).toBe(0);
  });

  it("marks listing as alive when source returns 200", async () => {
    const listing = {
      id: "test-456",
      source: "Elferspot",
      source_url: "https://elferspot.com/listing/456",
    };
    mockLimit.mockResolvedValue({ data: [listing], error: null });
    mockFetch.mockResolvedValue({ status: 200, ok: true });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await checkSource({
      source: "Elferspot",
      delayMs: 0,
      maxPerRun: 10,
      timeBudgetMs: 60_000,
      dryRun: false,
    });

    expect(result.alive).toBe(1);
    expect(result.dead).toBe(0);
  });

  it("circuit-breaks after 3 consecutive 403s", async () => {
    const listings = [
      { id: "a", source: "AutoScout24", source_url: "https://as24.com/1" },
      { id: "b", source: "AutoScout24", source_url: "https://as24.com/2" },
      { id: "c", source: "AutoScout24", source_url: "https://as24.com/3" },
      { id: "d", source: "AutoScout24", source_url: "https://as24.com/4" },
    ];
    mockLimit.mockResolvedValue({ data: listings, error: null });
    mockFetch.mockResolvedValue({ status: 403, ok: false });

    const result = await checkSource({
      source: "AutoScout24",
      delayMs: 0,
      maxPerRun: 10,
      timeBudgetMs: 60_000,
      dryRun: false,
    });

    // Should stop after 3, not check the 4th
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.circuitBroken).toBe(true);
  });

  it("skips DB writes in dry run mode", async () => {
    const listing = {
      id: "test-789",
      source: "Elferspot",
      source_url: "https://elferspot.com/789",
    };
    mockLimit.mockResolvedValue({ data: [listing], error: null });
    mockFetch.mockResolvedValue({ status: 404, ok: false });

    const result = await checkSource({
      source: "Elferspot",
      delayMs: 0,
      maxPerRun: 10,
      timeBudgetMs: 60_000,
      dryRun: true,
    });

    expect(result.dead).toBe(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("runLivenessCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectBuilder = createChainBuilder();
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  it("throws on unknown source", async () => {
    await expect(
      runLivenessCheck({ source: "UnknownSource", dryRun: true })
    ).rejects.toThrow("Unknown source: UnknownSource");
  });

  it("aggregates results from multiple sources", async () => {
    // Return one listing per source — mockLimit is shared across all queries
    const listing = {
      id: "agg-1",
      source: "AutoScout24",
      source_url: "https://autoscout24.com/agg/1",
    };
    mockLimit.mockResolvedValue({ data: [listing], error: null });
    mockFetch.mockResolvedValue({ status: 200, ok: true });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const run = await runLivenessCheck({ dryRun: true, delayOverrideMs: 0 });

    // 5 sources in SOURCE_CONFIGS, each gets 1 listing → 5 checked, 5 alive
    expect(run.totalChecked).toBe(5);
    expect(run.totalAlive).toBe(5);
    expect(run.totalDead).toBe(0);
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect(run.results).toHaveLength(5);
  });
});
