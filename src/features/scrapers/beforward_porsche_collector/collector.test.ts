import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./discover", async () => {
  const actual = await vi.importActual<typeof import("./discover")>("./discover");
  return {
    ...actual,
    discoverPage: vi.fn(),
  };
});

vi.mock("./supabase_writer", () => ({
  createDryRunWriter: vi.fn(),
  createSupabaseWriter: vi.fn(),
}));

import { runBeForwardPorscheCollector } from "./collector";
import { discoverPage } from "./discover";
import { createSupabaseWriter } from "./supabase_writer";

describe("runBeForwardPorscheCollector counters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts actual writes separately from skipped rows", async () => {
    vi.mocked(discoverPage).mockResolvedValue({
      totalResults: 25,
      pageCount: 1,
      listings: [
        {
          page: 1,
          sourceUrl: "https://www.beforward.jp/porsche/911/aa111111/id/1/",
          refNo: "AA111111",
          title: "2016 PORSCHE 911",
          priceUsd: 50000,
          totalPriceUsd: 52000,
          mileageKm: 10000,
          year: 2016,
          location: "Yokohama",
        },
        {
          page: 1,
          sourceUrl: "https://www.beforward.jp/porsche/porsche-others/bb222222/id/2/",
          refNo: "BB222222",
          title: "2016 PORSCHE PORSCHE OTHERS",
          priceUsd: 30000,
          totalPriceUsd: 32000,
          mileageKm: 20000,
          year: 2016,
          location: "Osaka",
        },
      ],
    });

    vi.mocked(createSupabaseWriter).mockReturnValue({
      healthCheck: async () => {},
      upsertAll: vi
        .fn()
        .mockResolvedValueOnce({ listingId: "id-1", wrote: true, previousStatus: null, currentStatus: "active" })
        .mockResolvedValueOnce({ listingId: "skipped_invalid", wrote: false }),
    });

    const result = await runBeForwardPorscheCollector({
      mode: "daily",
      make: "Porsche",
      maxPages: 1,
      startPage: 1,
      maxDetails: 100,
      summaryOnly: true,
      concurrency: 1,
      rateLimitMs: 1,
      timeoutMs: 1000,
      checkpointPath: "var/test-bf-counter/checkpoint.json",
      outputPath: "var/test-bf-counter/listings.jsonl",
      dryRun: false,
    });

    expect(result.counts.writeAttempts).toBe(2);
    expect(result.counts.written).toBe(1);
    expect(result.counts.skippedInvalid).toBe(1);
  });

  it("reports planned crawl coverage when maxPages limits the source pages", async () => {
    vi.mocked(discoverPage).mockResolvedValue({
      totalResults: 100,
      pageCount: 4,
      listings: [],
    });
    vi.mocked(createSupabaseWriter).mockReturnValue({
      healthCheck: async () => {},
      upsertAll: vi.fn(),
    });

    const result = await runBeForwardPorscheCollector({
      mode: "daily",
      make: "Porsche",
      maxPages: 2,
      startPage: 1,
      maxDetails: 0,
      summaryOnly: true,
      concurrency: 1,
      rateLimitMs: 1,
      timeoutMs: 1000,
      checkpointPath: "var/test-bf-coverage/checkpoint.json",
      outputPath: "var/test-bf-coverage/listings.jsonl",
      dryRun: false,
    });

    expect(result.sourceTotalPages).toBe(4);
    expect(result.plannedStartPage).toBe(1);
    expect(result.plannedEndPage).toBe(2);
    expect(result.coveragePercent).toBe(50);
    expect(result.coverageLimited).toBe(true);
    expect(result.coverageReason).toBe("max_pages");
  });
});
