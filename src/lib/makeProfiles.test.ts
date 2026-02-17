import { describe, expect, it } from "vitest";

import {
  DEFAULT_LIVE_MAKE,
  getSupportedLiveMakes,
  isSupportedLiveMake,
  normalizeSupportedMake,
  resolveRequestedMake,
} from "./makeProfiles";

describe("makeProfiles", () => {
  it("keeps Porsche as the default", () => {
    expect(DEFAULT_LIVE_MAKE).toBe("Porsche");
    expect(resolveRequestedMake(null)).toBe("Porsche");
  });

  it("normalizes supported make names", () => {
    expect(normalizeSupportedMake("porsche")).toBe("Porsche");
    expect(normalizeSupportedMake(" FERRARI ")).toBe("Ferrari");
    expect(normalizeSupportedMake("Lamborghini")).toBeNull();
  });

  it("flags supported makes", () => {
    expect(isSupportedLiveMake("Porsche")).toBe(true);
    expect(isSupportedLiveMake("Ferrari")).toBe(true);
    expect(isSupportedLiveMake("BMW")).toBe(false);
  });

  it("returns a copy of the supported list", () => {
    const makes = getSupportedLiveMakes();
    expect(makes).toEqual(["Porsche", "Ferrari"]);
    makes.push("Ferrari");
    expect(getSupportedLiveMakes()).toEqual(["Porsche", "Ferrari"]);
  });
});
