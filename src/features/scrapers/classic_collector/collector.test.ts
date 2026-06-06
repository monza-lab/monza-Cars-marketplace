import { describe, expect, it } from "vitest";

import { getClassicMonitoringState } from "./collector";
import type { CollectorCounts } from "./types";

function counts(overrides: Partial<CollectorCounts> = {}): CollectorCounts {
  return {
    discovered: 0,
    detailsFetched: 0,
    normalized: 0,
    written: 0,
    errors: 0,
    cloudflareBlocked: 0,
    ...overrides,
  };
}

describe("classic collector monitoring state", () => {
  it("fails count-only collector errors when nothing was written", () => {
    const result = getClassicMonitoringState({
      counts: counts({ discovered: 5, errors: 2, written: 0 }),
      errors: [],
    });

    expect(result.success).toBe(false);
    expect(result.errorsCount).toBe(2);
    expect(result.errorMessages).toEqual(["Classic collector reported 2 errors"]);
  });

  it("counts message-only collector errors in addition to counted write errors", () => {
    const result = getClassicMonitoringState({
      counts: counts({ discovered: 5, errors: 2, written: 0 }),
      errors: ["Write error: duplicate key", "Fatal: browser crashed"],
    });

    expect(result.success).toBe(false);
    expect(result.errorsCount).toBe(3);
    expect(result.errorMessages).toEqual(["Write error: duplicate key", "Fatal: browser crashed"]);
  });

  it("allows non-fatal collector errors when the run still writes rows", () => {
    const result = getClassicMonitoringState({
      counts: counts({ discovered: 750, errors: 2, written: 25 }),
      errors: ["Write error: duplicate key"],
    });

    expect(result.success).toBe(true);
    expect(result.errorsCount).toBe(2);
    expect(result.errorMessages).toEqual(["Write error: duplicate key"]);
  });
});
