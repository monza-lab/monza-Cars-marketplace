import { describe, it, expect } from "vitest";
import { withSeries, computeSeries } from "./seriesEnrichment";

describe("seriesEnrichment", () => {
  describe("computeSeries", () => {
    it("returns '992' for a known 992 Porsche", () => {
      expect(
        computeSeries({ make: "Porsche", model: "992 Carrera", year: 2023, title: "2023 Porsche 911 Carrera" })
      ).toBe("992");
    });

    it("returns null for empty/zero input", () => {
      expect(
        computeSeries({ make: "Porsche", model: "", year: 0, title: null })
      ).toBeNull();
    });
  });

  describe("withSeries", () => {
    it("adds series='992' for a known 992 Porsche", () => {
      const result = withSeries({
        make: "Porsche",
        model: "992 Carrera",
        year: 2023,
        title: "2023 Porsche 911 Carrera",
      });
      expect(result.series).toBe("992");
    });

    it("adds series=null for empty/zero input", () => {
      const result = withSeries({ make: "Porsche", model: "", year: 0, title: null });
      expect(result.series).toBeNull();
    });

    it("does not mutate the input object", () => {
      const input = { make: "Porsche", model: "992 Carrera", year: 2023, title: "2023 Porsche 911 Carrera" };
      withSeries(input);
      expect(Object.prototype.hasOwnProperty.call(input, "series")).toBe(false);
    });
  });
});
