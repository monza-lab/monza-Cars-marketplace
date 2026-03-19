import { describe, it, expect } from "vitest";
import { validateListing, isNonCar, tryExtractModel } from "./listingValidator";

describe("listingValidator", () => {
  describe("validateListing", () => {
    it("accepts a valid Porsche listing", () => {
      const result = validateListing({
        make: "Porsche",
        model: "911 Carrera",
        title: "2020 Porsche 911 Carrera S",
        year: 2020,
      });
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("rejects non-Porsche makes", () => {
      const result = validateListing({
        make: "BMW",
        model: "M3",
        title: "2020 BMW M3",
        year: 2020,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("non-porsche-make");
    });

    it("rejects Porsche diesel tractors", () => {
      const result = validateListing({
        make: "Porsche",
        model: "Diesel Standard",
        title: "1958 Porsche Diesel Standard Tractor",
        year: 1958,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("non-car:diesel");
    });

    it("allows Cayenne Diesel (not a tractor)", () => {
      const result = validateListing({
        make: "Porsche",
        model: "Cayenne Diesel",
        title: "2015 Porsche Cayenne Diesel",
        year: 2015,
      });
      expect(result.valid).toBe(true);
    });

    it("rejects boats", () => {
      const result = validateListing({
        make: "Porsche",
        model: "boat",
        title: "Porsche speedboat",
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("non-car:boat");
    });

    it("rejects kit cars", () => {
      const result = validateListing({
        make: "Porsche",
        model: "APAL Speedster",
        title: "APAL Porsche Speedster Kit",
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("non-car:apal");
    });

    it("rejects bikes", () => {
      const result = validateListing({
        make: "Porsche",
        model: "bike",
        title: "Porsche bike",
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("non-car:bike");
    });

    it("fixes listings with color-as-model when title has real model", () => {
      const result = validateListing({
        make: "Porsche",
        model: "Guards Red",
        title: "1987 Porsche 911 Turbo Guards Red",
        year: 1987,
      });
      expect(result.valid).toBe(true);
      expect(result.fixedModel).toBeDefined();
    });

    it("rejects listings with generic model and no extractable title", () => {
      const result = validateListing({
        make: "Porsche",
        model: "Others",
        title: "Porsche item",
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("unresolvable-model");
    });
  });

  describe("isNonCar", () => {
    it("detects tractor", () => {
      expect(isNonCar("tractor", "")).not.toBeNull();
    });

    it("detects literature", () => {
      expect(isNonCar("literature set", "")).not.toBeNull();
    });

    it("passes valid models", () => {
      expect(isNonCar("911 Carrera", "")).toBeNull();
    });
  });
});
