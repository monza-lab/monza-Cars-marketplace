import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must be before imports) ──────────────────────────────────

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("./detail", () => ({
  fetchAndParseDetail: vi.fn(),
}));

vi.mock("./net", () => ({
  PerDomainRateLimiter: class {
    async waitForDomain() {}
  },
  getDomainFromUrl: () => "www.beforward.jp",
}));

import { backfillMissingImages } from "./backfill";
import { fetchAndParseDetail } from "./detail";

const mockFetch = vi.mocked(fetchAndParseDetail);

// ── Helpers ─────────────────────────────────────────────────────────

function setupSupabaseMock(rows: Array<{ id: string; source_url: string }> | null, error?: string) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "listings") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              or: () => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: rows,
                    error: error ? { message: error } : null,
                  }),
                }),
              }),
            }),
          }),
        }),
        update: (data: Record<string, unknown>) => {
          mockUpdate(data);
          return {
            eq: () => Promise.resolve({ error: null }),
          };
        },
      };
    }
    return {};
  });
}

const SAMPLE_ROWS = [
  { id: "row-1", source_url: "https://www.beforward.jp/porsche/911/id/1/" },
  { id: "row-2", source_url: "https://www.beforward.jp/porsche/cayenne/id/2/" },
];

// ── Tests ───────────────────────────────────────────────────────────

describe("beforward backfillMissingImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("backfills listings that have images on their detail page", async () => {
    setupSupabaseMock(SAMPLE_ROWS);
    mockFetch
      .mockResolvedValueOnce({
        images: ["https://img.beforward.jp/photo1.jpg", "https://img.beforward.jp/photo2.jpg"],
      } as any)
      .mockResolvedValueOnce({
        images: ["https://img.beforward.jp/photo3.jpg"],
      } as any);

    const result = await backfillMissingImages({
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.discovered).toBe(2);
    expect(result.backfilled).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        images: ["https://img.beforward.jp/photo1.jpg", "https://img.beforward.jp/photo2.jpg"],
        photos_count: 2,
      }),
    );
  });

  it("skips listings whose detail page has no images", async () => {
    setupSupabaseMock(SAMPLE_ROWS);
    mockFetch
      .mockResolvedValueOnce({ images: [] } as any)
      .mockResolvedValueOnce({ images: ["https://img.beforward.jp/photo.jpg"] } as any);

    const result = await backfillMissingImages({
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.discovered).toBe(2);
    expect(result.backfilled).toBe(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("backs off on 403 and continues when below the limit", async () => {
    vi.useFakeTimers();
    setupSupabaseMock(SAMPLE_ROWS);
    mockFetch
      .mockRejectedValueOnce(new Error("HTTP 403 Forbidden"))
      .mockResolvedValueOnce({
        images: ["https://img.beforward.jp/photo.jpg"],
      } as any);

    const promise = backfillMissingImages({
      timeBudgetMs: 60_000,
      runId: "test-run",
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.discovered).toBe(2);
    expect(result.backfilled).toBe(1);
    expect(result.errors[0]).toMatch(/Rate limited/);
    // Should attempt the second listing after backoff
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("backs off on 429 and continues when below the limit", async () => {
    vi.useFakeTimers();
    setupSupabaseMock(SAMPLE_ROWS);
    mockFetch
      .mockRejectedValueOnce(new Error("HTTP 429 Too Many Requests"))
      .mockResolvedValueOnce({
        images: ["https://img.beforward.jp/photo.jpg"],
      } as any);

    const promise = backfillMissingImages({
      timeBudgetMs: 60_000,
      runId: "test-run",
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.errors[0]).toMatch(/Rate limited/);
    expect(result.backfilled).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("circuit-breaks after repeated rate limits", async () => {
    vi.useFakeTimers();
    setupSupabaseMock([
      { id: "row-1", source_url: "https://www.beforward.jp/porsche/911/id/1/" },
      { id: "row-2", source_url: "https://www.beforward.jp/porsche/cayenne/id/2/" },
      { id: "row-3", source_url: "https://www.beforward.jp/porsche/boxster/id/3/" },
    ]);
    mockFetch
      .mockRejectedValueOnce(new Error("HTTP 429 Too Many Requests"))
      .mockRejectedValueOnce(new Error("HTTP 429 Too Many Requests"))
      .mockRejectedValueOnce(new Error("HTTP 429 Too Many Requests"));

    const promise = backfillMissingImages({
      timeBudgetMs: 60_000,
      runId: "test-run",
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.errors.some((e) => e.includes("Circuit-break"))).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("stops when time budget is exhausted", async () => {
    setupSupabaseMock(SAMPLE_ROWS);
    // Simulate a very tight time budget (already expired)
    const result = await backfillMissingImages({
      timeBudgetMs: 0, // already expired
      runId: "test-run",
    });

    expect(result.discovered).toBe(2);
    expect(result.backfilled).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns early when no listings need backfill", async () => {
    setupSupabaseMock([]);

    const result = await backfillMissingImages({
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.discovered).toBe(0);
    expect(result.backfilled).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("handles missing Supabase env vars", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const result = await backfillMissingImages({
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.errors).toContain("Missing Supabase env vars");
  });

  it("handles Supabase query errors gracefully", async () => {
    setupSupabaseMock(null, "Connection timeout");

    const result = await backfillMissingImages({
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.errors).toContain("Connection timeout");
    expect(result.discovered).toBe(0);
  });

  it("continues on non-blocking fetch errors", async () => {
    setupSupabaseMock(SAMPLE_ROWS);
    mockFetch
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockResolvedValueOnce({
        images: ["https://img.beforward.jp/photo.jpg"],
      } as any);

    const result = await backfillMissingImages({
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.backfilled).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/ETIMEDOUT/);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
