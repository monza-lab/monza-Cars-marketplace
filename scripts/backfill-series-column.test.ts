import { describe, it, expect } from "vitest";
import { mapRowToUpdate } from "./backfill-series-column";

describe("mapRowToUpdate", () => {
  it("returns { id, series } for a recognizable Porsche 992 row", () => {
    const result = mapRowToUpdate({
      id: "abc",
      make: "Porsche",
      model: "992 Carrera",
      year: 2023,
      title: null,
    });
    expect(result).toEqual({ id: "abc", series: "992" });
  });

  it("returns null when model is empty and year is 0", () => {
    const result = mapRowToUpdate({
      id: "abc",
      make: "Porsche",
      model: "",
      year: 0,
      title: null,
    });
    expect(result).toBeNull();
  });

  it("returns null when make is null", () => {
    const result = mapRowToUpdate({
      id: "abc",
      make: null,
      model: "992",
      year: 2023,
      title: null,
    });
    expect(result).toBeNull();
  });
});
