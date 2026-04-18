import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { fetchDetailPage } from "@/features/scrapers/elferspot_collector/detail";

// Mock Supabase
const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      or: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: mockLimit,
        }),
      }),
    }),
  }),
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
  })),
}));

// Mock detail parser
vi.mock("@/features/scrapers/elferspot_collector/detail", () => ({
  fetchDetailPage: vi.fn(),
}));

// Mock monitoring
vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/backfill-photos-elferspot", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/backfill-photos-elferspot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    // reset default to empty list; individual tests override
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it("returns 401 without valid auth", async () => {
    const response = await GET(makeRequest("wrong"));
    expect(response.status).toBe(401);
  });

  it("backfills when detail returns >=2 images", async () => {
    mockLimit.mockResolvedValueOnce({
      data: [{ id: "listing-1", source_url: "https://elferspot.com/en/listing/abc" }],
      error: null,
    });
    const images = [
      "https://cdn.elferspot.com/a.jpg",
      "https://cdn.elferspot.com/b.jpg",
      "https://cdn.elferspot.com/c.jpg",
    ];
    (fetchDetailPage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      images,
    } as unknown as Awaited<ReturnType<typeof fetchDetailPage>>);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.discovered).toBe(1);
    expect(data.backfilled).toBe(1);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        images,
        photos_count: images.length,
      }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "listing-1");
  });

  it("skips update when detail returns fewer than 2 images", async () => {
    mockLimit.mockResolvedValueOnce({
      data: [{ id: "listing-2", source_url: "https://elferspot.com/en/listing/xyz" }],
      error: null,
    });
    (fetchDetailPage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      images: ["https://cdn.elferspot.com/only.jpg"],
    } as unknown as Awaited<ReturnType<typeof fetchDetailPage>>);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.discovered).toBe(1);
    expect(data.backfilled).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
