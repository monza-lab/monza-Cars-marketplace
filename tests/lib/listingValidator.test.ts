// tests/lib/listingValidator.test.ts
import { describe, it, expect } from "vitest";
import { validateListing, isNonCar, tryExtractModel } from "@/features/scrapers/common/listingValidator";

describe("isNonCar", () => {
  it("rejects tractors in model", () => {
    expect(isNonCar("tractor", "")).toBe("non-car:tractor");
  });
  it("rejects boats in model", () => {
    expect(isNonCar("craft 168", "")).toBe("non-car:craft");
  });
  it("rejects bikes in model", () => {
    expect(isNonCar("bike", "")).toBe("non-car:bike");
  });
  it("rejects diesel tractors but NOT Cayenne Diesel", () => {
    expect(isNonCar("diesel", "")).toBe("non-car:diesel");
    expect(isNonCar("cayenne diesel", "")).toBeNull();
  });
  it("accepts normal Porsche models", () => {
    expect(isNonCar("911 carrera 4s", "2020 Porsche 911 Carrera 4S")).toBeNull();
    expect(isNonCar("cayenne turbo gt", "")).toBeNull();
  });
});

describe("tryExtractModel", () => {
  it("extracts model from title with year and make", () => {
    const result = tryExtractModel("2019 Porsche 911 Carrera S", 2019, "Porsche");
    expect(result).toBeTruthy();
    expect(result!.toLowerCase()).toContain("911");
  });
  it("extracts Cayenne from title", () => {
    const result = tryExtractModel("2022 Porsche Cayenne Turbo GT", 2022, "Porsche");
    expect(result).toBeTruthy();
  });
  it("returns null for title with no extractable model", () => {
    const result = tryExtractModel("PORSCHE OTHERS", undefined, "Porsche");
    expect(result).toBeNull();
  });
  it("returns null for non-car titles", () => {
    const result = tryExtractModel("Craig Craft 168 Boss Porsche Boat", undefined, "Porsche");
    expect(result).toBeNull();
  });
});

describe("validateListing", () => {
  it("rejects non-Porsche makes", () => {
    const result = validateListing({ make: "Ferrari", model: "488", title: "Ferrari 488", year: 2020 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("non-porsche");
  });
  it("rejects non-car items", () => {
    const result = validateListing({ make: "Porsche", model: "Tractor", title: "Porsche Tractor", year: 1960 });
    expect(result.valid).toBe(false);
  });
  it("fixes bad model 'PORSCHE' when title has valid model", () => {
    const result = validateListing({
      make: "Porsche", model: "PORSCHE", title: "2019 Porsche 911 Carrera S", year: 2019,
    });
    expect(result.valid).toBe(true);
    expect(result.fixedModel).toBeTruthy();
  });
  it("rejects bad model 'PORSCHE' when title has no model", () => {
    const result = validateListing({
      make: "Porsche", model: "PORSCHE", title: "PORSCHE OTHERS", year: undefined,
    });
    expect(result.valid).toBe(false);
  });
  it("fixes model 'Others' when title has valid model", () => {
    const result = validateListing({
      make: "Porsche", model: "Others", title: "Porsche Cayenne 2021", year: 2021,
    });
    expect(result.valid).toBe(true);
    expect(result.fixedModel).toBeTruthy();
  });
  it("detects color-as-model and tries to fix from title", () => {
    const result = validateListing({
      make: "Porsche", model: "Racing Green Metallic", title: "2023 Porsche 911 GT3 RS", year: 2023,
    });
    expect(result.valid).toBe(true);
    expect(result.fixedModel).toBeTruthy();
  });
  it("accepts valid Porsche listings", () => {
    const result = validateListing({
      make: "Porsche", model: "911 Carrera 4S", title: "2020 Porsche 911 Carrera 4S", year: 2020,
    });
    expect(result.valid).toBe(true);
    expect(result.fixedModel).toBeUndefined();
  });
  it("rejects boat in title when model is suspicious", () => {
    const result = validateListing({
      make: "Porsche", model: "PORSCHE", title: "Craig Craft 168 Boss Porsche Boat", year: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("non-car-title");
  });
});
