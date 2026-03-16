import { describe, expect, it } from "vitest";

import { assertCheckpointIdentity, checksumIds, keepByScope } from "./run";

describe("historical bat run helpers", () => {
  it("keeps all scope without vehicle filtering", () => {
    const mapped = {
      source: "BaT",
      source_id: "1",
      source_url: "https://bringatrailer.com/listing/test-1/",
      title: "Porsche wheels",
      make: "Porsche",
      model: "Unknown",
      year: null,
      status: "sold",
      sale_date: "2026-02-21",
      sale_date_confidence: "sold_text",
      current_bid: 100,
      currency: "USD",
      raw_payload: {},
    } as const;

    const result = keepByScope("all", mapped, { id: 1, title: "Porsche wheels" });
    expect(result).toEqual({ keep: true });
  });

  it("rejects unsold listings for sold_vehicle scope", () => {
    const mapped = {
      source: "BaT",
      source_id: "2",
      source_url: "https://bringatrailer.com/listing/test-2/",
      title: "1998 Porsche 911",
      make: "Porsche",
      model: "911",
      year: 1998,
      status: "unsold",
      sale_date: "2026-02-21",
      sale_date_confidence: "sold_text",
      current_bid: 100,
      currency: "USD",
      raw_payload: {},
    } as const;

    const result = keepByScope("sold_vehicle", mapped, { id: 2, title: "1998 Porsche 911" });
    expect(result).toEqual({ keep: false, reason: "not_sold" });
  });

  it("produces stable checksums for id sequences", () => {
    expect(checksumIds(["1", "2", "3"])).toBe(checksumIds(["1", "2", "3"]));
    expect(checksumIds(["1", "2", "3"])).not.toBe(checksumIds(["3", "2", "1"]));
  });

  it("fails checkpoint identity when bound fields mismatch", () => {
    expect(() => assertCheckpointIdentity({
      live: true,
      checkpoint: {
        scope: "vehicle",
        time_frame: "1Y",
        items_total: 5808,
        pages_total: 242,
        last_page: 10,
      },
      config: {
        dryRun: false,
        timeFrame: "1Y",
        scope: "all",
        maxPages: 20,
        startPage: 0,
        checkpointPath: "var/porsche_collector/historical_bat/checkpoint.json",
        allowCheckpointMismatch: false,
      },
    })).toThrow(/Checkpoint identity mismatch/);
  });
});
