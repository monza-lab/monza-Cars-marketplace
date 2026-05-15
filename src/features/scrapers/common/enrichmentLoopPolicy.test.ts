import { describe, expect, it } from "vitest";

import {
  buildMissingAnyFilter,
  classifyScraplingBody,
  isCriticalNoOutput,
} from "./enrichmentLoopPolicy";

describe("enrichment loop policy", () => {
  it("builds a Supabase OR filter for missing text and numeric fields", () => {
    expect(
      buildMissingAnyFilter([
        { field: "description_text", type: "text" },
        { field: "hammer_price", type: "numeric" },
      ]),
    ).toBe("description_text.is.null,description_text.eq.,hammer_price.is.null");
  });

  it("treats short Scrapling HTTP bodies as blocked so callers can escalate", () => {
    expect(classifyScraplingBody({ mode: "http", htmlLength: 1949 })).toEqual({
      kind: "blocked",
      message: "Short scrapling body (1949)",
    });
  });

  it("treats short dynamic bodies as hard errors to avoid retry loops", () => {
    expect(classifyScraplingBody({ mode: "dynamic", htmlLength: 1949 })).toEqual({
      kind: "error",
      message: "Short scrapling body (1949)",
    });
  });

  it("flags critical enrichment jobs that discover work but write nothing", () => {
    expect(
      isCriticalNoOutput({
        id: "cron-vin",
        status: "ok",
        discovered: 500,
        written: 0,
      }),
    ).toBe(true);

    expect(
      isCriticalNoOutput({
        id: "as24-enrich",
        status: "ok",
        discovered: 500,
        written: 392,
      }),
    ).toBe(false);
  });
});
