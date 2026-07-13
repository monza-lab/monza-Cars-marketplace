import { describe, expect, it, vi } from "vitest";

import {
  RARITY_BACKFILL_DEFAULTS,
  backfillListingRarity,
  parseBackfillArgs,
} from "./backfill-listing-rarity";

describe("backfill-listing-rarity", () => {
  it("parses dry-run, limit, status, batch, and pause flags", () => {
    expect(parseBackfillArgs([
      "--dry-run",
      "--limit=25",
      "--status=active",
      "--batch-size=10",
      "--pause-ms=0",
    ])).toEqual({
      ...RARITY_BACKFILL_DEFAULTS,
      dryRun: true,
      limit: 25,
      status: "active",
      batchSize: 10,
      pauseMs: 0,
    });
  });

  it("updates active rows first with batch writes and skips unchanged payloads", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: "00000000-0000-0000-0000-000000000001",
            year: 1988,
            model: "959SC",
            trim: "by Canepa",
            title: "1988 Porsche 959SC by Canepa",
            description_text: null,
            seller_notes: null,
            mileage: 2448,
            mileage_unit: "mi",
            rarity_score: null,
            rarity_tier: null,
            rarity_signals_json: null,
            rarity_score_version: null,
            ranking_variant: null,
          },
          {
            id: "00000000-0000-0000-0000-000000000002",
            year: 2006,
            model: "Cayman",
            trim: "S 6-Speed",
            title: "2006 Porsche Cayman S 6-Speed",
            description_text: null,
            seller_notes: null,
            mileage: 143232,
            mileage_unit: "mi",
            rarity_score: 5,
            rarity_tier: "common",
            rarity_signals_json: ["manual_transmission"],
            rarity_score_version: "listing-rarity-v7",
            ranking_variant: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const stats = await backfillListingRarity(
      { connect: vi.fn(), end: vi.fn(), query },
      {
        ...RARITY_BACKFILL_DEFAULTS,
        dryRun: false,
        batchSize: 10,
        pauseMs: 0,
        status: "active",
      },
    );

    expect(stats).toEqual({ scanned: 2, updated: 2, skipped: 0, batches: 1 });
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("status::text = $3"),
      [null, "listing-rarity-v8.1", "active", 10],
    );
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("update public.listings as l"), [
      expect.any(String),
    ]);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("refresh_listings_active_counts"),
    );

    const updatePayload = JSON.parse(query.mock.calls[1][1][0]);
    expect(updatePayload).toEqual([
      expect.objectContaining({
        id: "00000000-0000-0000-0000-000000000001",
        rarity_score: expect.any(Number),
        rarity_tier: "unique",
        rarity_score_version: "listing-rarity-v8.1",
        ranking_variant: "959:959",
      }),
      expect.objectContaining({
        id: "00000000-0000-0000-0000-000000000002",
        ranking_variant: "cayman:cayman-s",
      }),
    ]);
  });
});
