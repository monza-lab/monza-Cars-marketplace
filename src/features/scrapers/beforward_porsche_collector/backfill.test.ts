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

  it("circuit-breaks on 403 response", async () => {
    setupSupabaseMock(SAMPLE_ROWS);
    mockFetch.mockRejectedValueOnce(new Error("HTTP 403 Forbidden"));

    const result = await backfillMissingImages({
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.discovered).toBe(2);
    expect(result.backfilled).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Circuit-break/);
    // Should NOT attempt the second listing
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("circuit-breaks on 429 response", async () => {
    setupSupabaseMock(SAMPLE_ROWS);
    mockFetch.mockRejectedValueOnce(new Error("HTTP 429 Too Many Requests"));

    const result = await backfillMissingImages({
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.errors[0]).toMatch(/Circuit-break/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
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
