import { describe, it, expect } from "vitest";
import { classifyWaterCooled, WATER_COOLED_SERIES } from "./waterCooled911";
import type { SoldListingRecord } from "@/lib/supabaseLiveListings";

function mk(
  overrides: Partial<SoldListingRecord> & { model: string; year: number; date?: string; price?: number }
): SoldListingRecord {
  return {
    title: `${overrides.year} Porsche ${overrides.model}`,
    price: 50000,
    date: "2024-01-15",
    ...overrides,
  };
}

describe("classifyWaterCooled", () => {
  it("classifies a 996-era 911 Carrera", () => {
    expect(classifyWaterCooled(mk({ model: "911 Carrera 996", year: 2003 }))).toBe("996");
  });

  it("classifies a 992 Carrera", () => {
    expect(classifyWaterCooled(mk({ model: "911 Carrera 992", year: 2022 }))).toBe("992");
  });

  it("rejects an air-cooled 993", () => {
    expect(classifyWaterCooled(mk({ model: "911 Carrera 993", year: 1996 }))).toBeNull();
  });

  it("rejects a Cayman", () => {
    expect(classifyWaterCooled(mk({ model: "Cayman S", year: 2015 }))).toBeNull();
  });
});

describe("WATER_COOLED_SERIES", () => {
  it("contains exactly the four modern 911 generations", () => {
    expect([...WATER_COOLED_SERIES].sort()).toEqual(["991", "992", "996", "997"]);
  });
});
