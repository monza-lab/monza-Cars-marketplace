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

import { checkSource, runLivenessCheck } from "./index";
import { SOURCE_CONFIGS } from "./sourceConfig";

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
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: vi.fn().mockResolvedValue('<div class="price">EUR 95,000</div>'),
    });
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
    expect(result.sold).toBe(0);
  });

  it("marks an Elferspot listing sold from the already-fetched 200 response", async () => {
    const listing = {
      id: "sold-english",
      source: "Elferspot",
      source_url: "https://elferspot.com/listing/sold-english",
      hammer_price: 180_000,
      final_price: null,
      sold_price: null,
      original_currency: "EUR",
      enrichment_meta: { retained: "yes" },
    };
    mockLimit.mockResolvedValue({ data: [listing], error: null });
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: vi.fn().mockResolvedValue('<div class="price">Sold · EUR 187,500</div>'),
    });
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

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ checked: 1, sold: 1, alive: 0, dead: 0 });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "sold",
      current_bid: null,
      hammer_price: 187_500,
      final_price: 187_500,
      original_currency: "EUR",
      enrichment_meta: expect.objectContaining({
        retained: "yes",
        elferspot: expect.objectContaining({
          priceStatus: "sold",
          soldPriceStatus: "numeric",
        }),
      }),
    }));
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("sold_price");
  });

  it("recognizes a localized Elferspot sold label", async () => {
    mockLimit.mockResolvedValue({
      data: [{
        id: "sold-localized",
        source: "Elferspot",
        source_url: "https://elferspot.com/listing/sold-localized",
        enrichment_meta: {},
      }],
      error: null,
    });
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: vi.fn().mockResolvedValue('<div class="price">Verkauft · EUR 190,000</div>'),
    });
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

    expect(result).toMatchObject({ sold: 1, alive: 0, dead: 0 });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "sold",
      final_price: 190_000,
    }));
  });

  it("marks sold without fabricating or erasing price evidence", async () => {
    const listing = {
      id: "sold-no-price",
      source: "Elferspot",
      source_url: "https://elferspot.com/listing/sold-no-price",
      hammer_price: 175_000,
      final_price: null,
      sold_price: null,
      original_currency: "EUR",
      enrichment_meta: { retained: "yes", elferspot: { prior: true } },
    };
    mockLimit.mockResolvedValue({ data: [listing], error: null });
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: vi.fn().mockResolvedValue('<div class="price">Sold</div>'),
    });
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

    expect(result.sold).toBe(1);
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload).toMatchObject({
      status: "sold",
      current_bid: null,
      hammer_price: null,
      final_price: null,
      enrichment_meta: {
        retained: "yes",
        elferspot: expect.objectContaining({
          prior: true,
          priceStatus: "sold",
          soldPriceStatus: "unknown",
          priorPriceEvidence: {
            hammerPrice: 175_000,
            finalPrice: null,
            currentBid: null,
            currency: "EUR",
          },
        }),
      },
    });
    expect(payload).not.toHaveProperty("sold_price");
    expect(payload).not.toHaveProperty("original_currency");
  });

  it("keeps an Elferspot challenge page live without marking it sold", async () => {
    mockLimit.mockResolvedValue({
      data: [{
        id: "challenge",
        source: "Elferspot",
        source_url: "https://elferspot.com/listing/challenge",
        enrichment_meta: {},
      }],
      error: null,
    });
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: vi.fn().mockResolvedValue("<html><title>Just a moment...</title><body>Checking your browser</body></html>"),
    });
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

    expect(result).toMatchObject({ sold: 0, alive: 1, dead: 0 });
    expect(mockUpdate).toHaveBeenCalledWith(expect.not.objectContaining({ status: "sold" }));
  });

  it("does not parse an Elferspot block response as sold", async () => {
    const text = vi.fn();
    mockLimit.mockResolvedValue({
      data: [{ id: "blocked", source: "Elferspot", source_url: "https://elferspot.com/blocked" }],
      error: null,
    });
    mockFetch.mockResolvedValue({ status: 403, ok: false, text });
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

    expect(result).toMatchObject({ sold: 0, alive: 1, dead: 0 });
    expect(text).not.toHaveBeenCalled();
  });

  it("circuit-breaks after the configured consecutive 403 threshold", async () => {
    const listings = [
      { id: "a", source: "AutoScout24", source_url: "https://as24.com/1" },
      { id: "b", source: "AutoScout24", source_url: "https://as24.com/2" },
      { id: "c", source: "AutoScout24", source_url: "https://as24.com/3" },
      { id: "d", source: "AutoScout24", source_url: "https://as24.com/4" },
      { id: "e", source: "AutoScout24", source_url: "https://as24.com/5" },
      { id: "f", source: "AutoScout24", source_url: "https://as24.com/6" },
      { id: "g", source: "AutoScout24", source_url: "https://as24.com/7" },
      { id: "h", source: "AutoScout24", source_url: "https://as24.com/8" },
      { id: "i", source: "AutoScout24", source_url: "https://as24.com/9" },
      { id: "j", source: "AutoScout24", source_url: "https://as24.com/10" },
      { id: "k", source: "AutoScout24", source_url: "https://as24.com/11" },
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

    // Should stop once the threshold is reached, without checking the last listing.
    expect(mockFetch).toHaveBeenCalledTimes(10);
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
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: vi.fn().mockResolvedValue('<div class="price">EUR 95,000</div>'),
    });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const run = await runLivenessCheck({ dryRun: true, delayOverrideMs: 0 });

    // Each configured source receives one mocked listing.
    expect(run.totalChecked).toBe(SOURCE_CONFIGS.length);
    expect(run.totalAlive).toBe(SOURCE_CONFIGS.length);
    expect(run.totalDead).toBe(0);
    expect(run.totalSold).toBe(0);
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect(run.results).toHaveLength(SOURCE_CONFIGS.length);
  });
});
