import { describe, expect, it } from "vitest";

import { classifyVinEnrichmentOutcome, isVinDecodeCandidate } from "./route";

describe("classifyVinEnrichmentOutcome", () => {
  it("marks zero-discovered VIN runs as an exhausted queue", () => {
    expect(classifyVinEnrichmentOutcome({
      discovered: 0,
      decoded: 0,
      written: 0,
      errors: [],
    })).toEqual({
      zeroWriteReason: "queue_exhausted",
      queueExhausted: true,
      degraded: false,
    });
  });

  it("marks decoded VINs with no writable fields as no-new-fields", () => {
    expect(classifyVinEnrichmentOutcome({
      discovered: 5,
      decoded: 5,
      written: 0,
      errors: [],
    })).toMatchObject({
      zeroWriteReason: "no_new_fields",
      queueExhausted: false,
      degraded: true,
    });
  });
});

describe("isVinDecodeCandidate", () => {
  it("accepts post-1981 17-character VINs with legal VIN characters", () => {
    expect(isVinDecodeCandidate({ vin: "WP0CB2961LS451234", year: 1990 })).toBe(true);
  });

  it("rejects short values, pre-1981 chassis identifiers, and illegal VIN letters", () => {
    expect(isVinDecodeCandidate({ vin: "MANUFACTURER", year: 2024 })).toBe(false);
    expect(isVinDecodeCandidate({ vin: "USERNAVBADGESCARS", year: 1964 })).toBe(false);
    expect(isVinDecodeCandidate({ vin: "WP0CB2961LS45123I", year: 1990 })).toBe(false);
  });

  it("rejects ROW-style Porsche ZZZ chassis identifiers that NHTSA does not decode", () => {
    expect(isVinDecodeCandidate({ vin: "WP0ZZZ99ZKS146259", year: 2019 })).toBe(false);
    expect(isVinDecodeCandidate({ vin: "NRWP0ZZZ98ZJK2523", year: 2017 })).toBe(false);
    expect(isVinDecodeCandidate({ vin: "USERNAVBADGESCARS", year: 1990 })).toBe(false);
  });
});
