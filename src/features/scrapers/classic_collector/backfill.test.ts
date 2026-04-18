import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must be before imports) ──────────────────────────────────

const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("./detail", () => ({
  fetchAndParseDetail: vi.fn(),
}));

vi.mock("./net", () => ({
  NavigationRateLimiter: class {
    async waitBeforeNavigation() {}
  },
}));

import { backfillMissingImages } from "./backfill";
import { fetchAndParseDetail } from "./detail";

const mockFetch = vi.mocked(fetchAndParseDetail);

// ── Helpers ─────────────────────────────────────────────────────────

const orCalls: string[] = [];

function setupSupabaseMock(rows: Array<{ id: string; source_url: string }> | null, error?: string) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "listings") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              or: (expr: string) => {
                orCalls.push(expr);
                return {
                  order: () => ({
                    limit: () => Promise.resolve({
                      data: rows,
                      error: error ? { message: error } : null,
                    }),
                  }),
                };
              },
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

const mockPage = {} as any; // Playwright Page mock (not actually navigated in tests)

const SAMPLE_ROWS = [
  { id: "row-1", source_url: "https://www.classic.com/veh/2023-porsche-911-gt3-rs/abc123" },
  { id: "row-2", source_url: "https://www.classic.com/veh/2019-porsche-718-cayman/def456" },
];

// ── Tests ───────────────────────────────────────────────────────────

describe("classic backfillMissingImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orCalls.length = 0;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("queries with photos_count.lt.2 in addition to empty images", async () => {
    setupSupabaseMock([]);
    await backfillMissingImages({ page: mockPage, timeBudgetMs: 5000, runId: "test" });
    expect(orCalls).toContain("images.is.null,images.eq.{},photos_count.lt.2");
  });

  it("backfills listings that have images on their detail page", async () => {
    setupSupabaseMock(SAMPLE_ROWS);
    mockFetch
      .mockResolvedValueOnce({
        raw: { images: ["https://images.classic.com/vehicles/img1.jpg", "https://images.classic.com/vehicles/img2.jpg"] },
      } as any)
      .mockResolvedValueOnce({
        raw: { images: ["https://images.classic.com/vehicles/img3.jpg"] },
      } as any);

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.discovered).toBe(2);
    expect(result.backfilled).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        images: ["https://images.classic.com/vehicles/img1.jpg", "https://images.classic.com/vehicles/img2.jpg"],
        photos_count: 2,
      }),
    );
  });

  it("skips listings whose detail page has no images", async () => {
    setupSupabaseMock(SAMPLE_ROWS);
    mockFetch
      .mockResolvedValueOnce({ raw: { images: [] } } as any)
      .mockResolvedValueOnce({
        raw: { images: ["https://images.classic.com/vehicles/img.jpg"] },
      } as any);

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.discovered).toBe(2);
    expect(result.backfilled).toBe(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("circuit-breaks on Cloudflare challenge", async () => {
    setupSupabaseMock(SAMPLE_ROWS);
    mockFetch.mockRejectedValueOnce(new Error("Cloudflare challenge not resolved"));

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Circuit-break.*Cloudflare/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("stops when time budget is exhausted", async () => {
    setupSupabaseMock(SAMPLE_ROWS);

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 0,
      runId: "test-run",
    });

    expect(result.discovered).toBe(2);
    expect(result.backfilled).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns early when no listings need backfill", async () => {
    setupSupabaseMock([]);

    const result = await backfillMissingImages({
      page: mockPage,
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
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.errors).toContain("Missing Supabase env vars");
  });

  it("handles Supabase query errors gracefully", async () => {
    setupSupabaseMock(null, "Connection timeout");

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.errors).toContain("Connection timeout");
    expect(result.discovered).toBe(0);
  });

  it("continues on non-blocking fetch errors", async () => {
    setupSupabaseMock(SAMPLE_ROWS);
    mockFetch
      .mockRejectedValueOnce(new Error("Navigation timeout"))
      .mockResolvedValueOnce({
        raw: { images: ["https://images.classic.com/vehicles/img.jpg"] },
      } as any);

    const result = await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      runId: "test-run",
    });

    expect(result.backfilled).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Navigation timeout/);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("passes correct options to fetchAndParseDetail", async () => {
    setupSupabaseMock([SAMPLE_ROWS[0]]);
    mockFetch.mockResolvedValueOnce({
      raw: { images: ["https://images.classic.com/vehicles/img.jpg"] },
    } as any);

    await backfillMissingImages({
      page: mockPage,
      timeBudgetMs: 60_000,
      pageTimeoutMs: 15_000,
      runId: "test-run-123",
    });

    expect(mockFetch).toHaveBeenCalledWith({
      page: mockPage,
      url: SAMPLE_ROWS[0].source_url,
      pageTimeoutMs: 15_000,
      runId: "test-run-123",
    });
  });
});
