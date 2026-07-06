import { describe, expect, it } from "vitest";

import {
  AS24_TARGET_FIELDS,
  buildMissingAs24TargetFieldFilter,
  buildUnusableAs24TargetFieldFilter,
  buildMissingAs24TargetOrDetailFilter,
  buildMissingCriticalSpecFilter,
  buildMissingDetailOrCriticalSpecFilter,
  buildMissingAnyFilter,
  classifyScraplingBody,
  isUsableTargetFieldValue,
  isCriticalNoOutput,
  shouldFailEnrichmentLoopRun,
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

  it("builds enrichment filters that always include critical spec gaps", () => {
    expect(buildMissingCriticalSpecFilter()).toBe(
      "engine.is.null,engine.eq.,transmission.is.null,transmission.eq.",
    );
    expect(buildMissingDetailOrCriticalSpecFilter(["trim"])).toBe(
      "trim.is.null,trim.eq.,engine.is.null,engine.eq.,transmission.is.null,transmission.eq.",
    );
  });

  it("builds AutoScout24 target-field filters with color before secondary details", () => {
    expect(AS24_TARGET_FIELDS).toEqual(["color_exterior", "engine", "transmission"]);
    expect(buildMissingAs24TargetFieldFilter()).toBe(
      "color_exterior.is.null,color_exterior.eq.,engine.is.null,engine.eq.,transmission.is.null,transmission.eq.",
    );
    expect(buildUnusableAs24TargetFieldFilter()).toBe(
      'color_exterior.is.null,color_exterior.eq.,color_exterior.in.("Not specified","Unknown","N/A","-"),engine.is.null,engine.eq.,engine.in.("Not specified","Unknown","N/A","-"),transmission.is.null,transmission.eq.,transmission.in.("Not specified","Unknown","N/A","-")',
    );
    expect(buildMissingAs24TargetOrDetailFilter(["trim", "body_style"])).toBe(
      "color_exterior.is.null,color_exterior.eq.,engine.is.null,engine.eq.,transmission.is.null,transmission.eq.,trim.is.null,trim.eq.,body_style.is.null,body_style.eq.",
    );
  });

  it("rejects placeholder values as unusable target coverage", () => {
    for (const value of [null, undefined, "", " ", "Not specified", "Unknown", "N/A", "-"]) {
      expect(isUsableTargetFieldValue(value)).toBe(false);
    }

    expect(isUsableTargetFieldValue("Automatic")).toBe(true);
    expect(isUsableTargetFieldValue("Black")).toBe(true);
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

  it("flags critical detail jobs that discover work but write nothing", () => {
    expect(
      isCriticalNoOutput({
        id: "cron-enrich-details",
        status: "ok",
        discovered: 500,
        written: 0,
      }),
    ).toBe(true);

    expect(
      isCriticalNoOutput({
        id: "cron-titles",
        status: "ok",
        discovered: 500,
        written: 0,
      }),
    ).toBe(false);

    expect(
      isCriticalNoOutput({
        id: "as24-enrich",
        status: "ok",
        discovered: 500,
        written: 392,
      }),
    ).toBe(false);
  });

  it("does not fail a scheduled loop only because quality gaps remain", () => {
    expect(
      shouldFailEnrichmentLoopRun({
        qualityGapsRemaining: true,
        failOnQualityGaps: false,
      }),
    ).toBe(false);

    expect(
      shouldFailEnrichmentLoopRun({
        qualityGapsRemaining: true,
        failOnQualityGaps: true,
      }),
    ).toBe(true);
  });
});
