import { describe, expect, it } from "vitest";

import { buildHardFailureError } from "./collector";

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
