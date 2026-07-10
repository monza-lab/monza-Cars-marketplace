import { describe, expect, it } from "vitest";

import { buildHardFailureError, buildShardSaturationWarning, shouldRecordShardSaturationWarning } from "./collector";
import { generateShards, splitSaturatedShard } from "./shards";
import type { AS24CountryCode, SearchShard } from "./types";

describe("buildHardFailureError", () => {
  it("flags repeated Akamai blocks with actionable diagnostics", () => {
    const error = buildHardFailureError({
      counts: {
        discovered: 12,
        detailsFetched: 0,
        normalized: 0,
        written: 0,
        errors: 0,
        skippedDuplicate: 0,
        akamaiBlocked: 5,
      },
      errors: ["Aborting: 5 consecutive Akamai blocks"],
      shardsCompleted: 0,
      shardsTotal: 4,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toMatch(/repeated Akamai blocks/i);
    expect(error?.message).toMatch(/discovered=12/);
    expect(error?.message).toMatch(/written=0/);
    expect(error?.message).toMatch(/akamaiBlocked=5/);
  });

  it("flags zero output when nothing was discovered or written", () => {
    const error = buildHardFailureError({
      counts: {
        discovered: 0,
        detailsFetched: 0,
        normalized: 0,
        written: 0,
        errors: 0,
        skippedDuplicate: 0,
        akamaiBlocked: 0,
      },
      errors: [],
      shardsCompleted: 2,
      shardsTotal: 4,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toMatch(/zero output/i);
    expect(error?.message).toMatch(/shardsCompleted=2\/4/);
  });

  it("returns null for healthy runs", () => {
    const error = buildHardFailureError({
      counts: {
        discovered: 88,
        detailsFetched: 0,
        normalized: 0,
        written: 64,
        errors: 0,
        skippedDuplicate: 0,
        akamaiBlocked: 0,
      },
      errors: [],
      shardsCompleted: 4,
      shardsTotal: 4,
    });

    expect(error).toBeNull();
  });
});

describe("AutoScout24 saturation shard policy", () => {
  const countries: AS24CountryCode[] = ["D", "A", "B", "E", "F", "I", "L", "NL"];

  it("does not emit coarse shard ids that saturated in the manual run", () => {
    const shards = generateShards({
      countries,
      models: ["macan", "panamera", "taycan"],
      maxPagesPerShard: 20,
    });

    const ids = shards.map((shard) => shard.id);

    expect(ids).not.toContain("macan-all");
    expect(ids).not.toContain("panamera-low");
    expect(ids).not.toContain("panamera-mid");
    expect(ids).not.toContain("panamera-high");
    expect(ids).not.toContain("taycan-mid");
    expect(ids).not.toContain("taycan-high");
  });

  it("uses predictable audit-readable ids for Macan price splits and Panamera/Taycan year splits", () => {
    const shards = generateShards({
      countries,
      models: ["macan", "panamera", "taycan"],
      maxPagesPerShard: 20,
    });

    const ids = shards.map((shard) => shard.id);

    expect(ids).toContain("macan-low-2014-2018");
    expect(ids).toContain("macan-mid-2019-2021");
    expect(ids).toContain("macan-high-2022-2026");
    expect(ids).toContain("panamera-low-2009-2016");
    expect(ids).toContain("panamera-mid-2017-2020");
    expect(ids).toContain("panamera-high-2021-2026");
    expect(ids).toContain("taycan-mid-2019-2022");
    expect(ids).toContain("taycan-high-2023-2026");
  });

  it("splits latest saturated 718, Cayenne, Macan, and 911 Italy shards", () => {
    const shards = generateShards({
      countries,
      models: ["911", "718", "cayenne", "macan"],
      maxPagesPerShard: 20,
    });

    const ids = shards.map((shard) => shard.id);

    expect(ids).not.toContain("718-all");
    expect(ids).not.toContain("cayenne-all");
    expect(ids).not.toContain("macan-low");
    expect(ids).not.toContain("macan-mid");
    expect(ids).not.toContain("911-I-1998-2012");
    expect(ids).not.toContain("911-I-2019-2026");
    expect(ids).toContain("718-low-2016-2019");
    expect(ids).toContain("cayenne-mid-2011-2018");
    expect(ids).toContain("macan-low-2014-2018");
    expect(ids).toContain("911-I-1998-2005");
    expect(ids).toContain("911-I-2023-2026");
  });

  it("preserves saturated shard lineage when splitting an observed saturated shard", () => {
    const shard: SearchShard = {
      id: "panamera-mid",
      model: "panamera",
      priceFrom: 50001,
      priceTo: 120000,
      countries,
      maxPages: 20,
    };

    const splitIds = splitSaturatedShard(shard).map((split) => split.id);

    expect(splitIds).toEqual([
      "panamera-mid-2009-2016",
      "panamera-mid-2017-2020",
      "panamera-mid-2021-2026",
    ]);
  });

  it("formats saturation warnings for health audit ingestion", () => {
    expect(buildShardSaturationWarning({ shardId: "macan-all", maxPages: 20 })).toBe(
      "discover.shard_saturated: macan-all reached 20-page limit",
    );
  });

  it("does not record saturation warnings for deliberately capped validation runs", () => {
    expect(shouldRecordShardSaturationWarning({ pagesProcessed: 1, maxPages: 1, listingsFound: 20 })).toBe(false);
    expect(shouldRecordShardSaturationWarning({ pagesProcessed: 20, maxPages: 20, listingsFound: 20 })).toBe(true);
  });
});
