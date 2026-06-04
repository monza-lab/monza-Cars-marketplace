import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildElferspotMeta,
  GET,
  mergeRowsForEnrichment,
  resolveBatchLimit,
  resolveDelayMs,
  type EnrichmentRow,
} from "./route";

// Mock Supabase
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockQueryResult = { data: [], error: null };
type MockQueryBuilder = PromiseLike<typeof mockQueryResult> & {
  or: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
};
const mockQueryBuilder = {
  or: vi.fn(() => mockQueryBuilder),
  is: vi.fn(() => mockQueryBuilder),
  then: (resolve: (value: typeof mockQueryResult) => unknown, reject: (reason?: unknown) => unknown) =>
    Promise.resolve(mockQueryResult).then(resolve, reject),
} satisfies MockQueryBuilder;
const mockOr = mockQueryBuilder.or;
const mockIs = mockQueryBuilder.is;
const mockLimit = vi.fn().mockReturnValue(mockQueryBuilder);
const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrder });
const mockEqSource = vi.fn().mockReturnValue({ eq: mockEqStatus });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSource });
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
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

import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/enrich-elferspot", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/enrich-elferspot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("returns 401 without valid auth", async () => {
    const response = await GET(makeRequest("wrong"));
    expect(response.status).toBe(401);
  });

  it("returns 200 with empty results when no listings need enrichment", async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.discovered).toBe(0);
    expect(data.enriched).toBe(0);
    expect(mockOr).toHaveBeenCalledWith(
      'description_text.is.null,description_text.eq.,enrichment_meta->elferspot->>descriptionStatus.is.null,enrichment_meta->elferspot->>descriptionStatus.not.in.("missing","detail_unavailable","blocked_unverified")'
    );
    expect(mockOr).toHaveBeenCalledWith("vin.is.null,vin.eq.");
    expect(mockIs).toHaveBeenCalledWith("hammer_price", null);
    expect(mockOr).toHaveBeenCalledWith(
      'enrichment_meta->elferspot->>priceStatus.is.null,enrichment_meta->elferspot->>priceStatus.not.in.("sold","price_on_request","hidden","not_listed","detail_unavailable","blocked_unverified")'
    );
  });

  it("queries missing descriptions before price-only gaps", async () => {
    await GET(makeRequest());

    expect(mockFrom).toHaveBeenCalledWith("listings");
    expect(mockOr).toHaveBeenCalledWith(
      'description_text.is.null,description_text.eq.,enrichment_meta->elferspot->>descriptionStatus.is.null,enrichment_meta->elferspot->>descriptionStatus.not.in.("missing","detail_unavailable","blocked_unverified")'
    );
  });

  it("calls monitoring lifecycle functions", async () => {
    await GET(makeRequest());
    expect(markScraperRunStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        scraperName: "enrich-elferspot",
        runtime: "vercel_cron",
      })
    );
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "enrich-elferspot",
        success: true,
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("enrich-elferspot");
  });

  it("returns 500 when Supabase env vars missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("Supabase");
  });

  it("clamps the optional batch limit", () => {
    expect(resolveBatchLimit(new Request("http://localhost/api/cron/enrich-elferspot?limit=75"))).toBe(75);
    expect(resolveBatchLimit(new Request("http://localhost/api/cron/enrich-elferspot?limit=999"))).toBe(300);
    expect(resolveBatchLimit(new Request("http://localhost/api/cron/enrich-elferspot?limit=bad"))).toBe(250);
  });

  it("clamps the optional inter-row delay", () => {
    expect(resolveDelayMs(new Request("http://localhost/api/cron/enrich-elferspot?delayMs=250"))).toBe(250);
    expect(resolveDelayMs(new Request("http://localhost/api/cron/enrich-elferspot?delayMs=99999"))).toBe(5000);
    expect(resolveDelayMs(new Request("http://localhost/api/cron/enrich-elferspot?delayMs=bad"))).toBe(1000);
  });

  it("alternates description, VIN, and price rows while deduping overlaps", () => {
    const row = (id: string): EnrichmentRow => ({
      id,
      source_url: `https://www.elferspot.com/en/car/${id}/`,
      enrichment_meta: null,
    });

    expect(
      mergeRowsForEnrichment(
        [row("description-1"), row("overlap"), row("description-2")],
        [row("vin-1")],
        [row("price-1"), row("overlap"), row("price-2")],
        5,
      ).map((item) => item.id),
    ).toEqual(["description-1", "vin-1", "price-1", "overlap", "description-2"]);
  });

  it("preserves existing Elferspot meta while writing current audit statuses", () => {
    expect(
      buildElferspotMeta(
        { elferspot: { priceStatus: "unknown", descriptionStatus: "missing", checkedAt: "old" } },
        { priceStatus: "numeric", descriptionStatus: "present", checkedAt: "new" },
      ),
    ).toEqual({
      elferspot: {
        priceStatus: "numeric",
        descriptionStatus: "present",
        checkedAt: "new",
      },
    });
  });

  it("preserves source-native chassis identifiers in Elferspot meta", () => {
    expect(
      buildElferspotMeta(null, {
        vehicleIdentifier: {
          raw: "9113601234",
          normalized: "9113601234",
          kind: "chassis_or_serial",
          sourceLabel: "Chassis",
        },
        checkedAt: "new",
      }),
    ).toEqual({
      elferspot: {
        vehicleIdentifier: {
          raw: "9113601234",
          normalized: "9113601234",
          kind: "chassis_or_serial",
          sourceLabel: "Chassis",
        },
        checkedAt: "new",
      },
    });
  });
});
