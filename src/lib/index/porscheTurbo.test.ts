import { describe, it, expect } from "vitest";
import { classifyTurbo, TURBO_SERIES } from "./porscheTurbo";
import type { SoldListingRecord } from "@/lib/supabaseLiveListings";

function mk(
  overrides: Partial<SoldListingRecord> & { model: string; year: number; title?: string }
): SoldListingRecord {
  return {
    price: 100000,
    date: "2024-01-15",
    title: overrides.title ?? `${overrides.year} Porsche ${overrides.model}`,
    ...overrides,
  };
}

describe("classifyTurbo", () => {
  it("classifies a 930 Turbo", () => {
    expect(classifyTurbo(mk({ model: "930 Turbo", year: 1986 }))).toBe("930-turbo");
  });

  it("classifies a 993 Turbo S", () => {
    expect(classifyTurbo(mk({ model: "911 Turbo S 993", year: 1997 }))).toBe("993-turbo");
  });

  it("classifies a 991 Turbo S", () => {
    expect(classifyTurbo(mk({ model: "911 Turbo S 991", year: 2017 }))).toBe("991-turbo");
  });

  it("excludes a 996 Carrera (non-turbo)", () => {
    expect(classifyTurbo(mk({ model: "911 Carrera 996", year: 2001 }))).toBeNull();
  });

  it("excludes a 997 GT3 even if title mentions track variant", () => {
    expect(
      classifyTurbo(
        mk({ model: "911 GT3 997", year: 2010, title: "2010 Porsche 911 GT3" })
      )
    ).toBeNull();
  });

  it("excludes a 997 GT2 (not a regular Turbo)", () => {
    expect(classifyTurbo(mk({ model: "911 GT2 997", year: 2009 }))).toBeNull();
  });
});

describe("TURBO_SERIES", () => {
  it("contains all seven Porsche 911 Turbo generations", () => {
    expect(TURBO_SERIES).toHaveLength(7);
    expect([...TURBO_SERIES]).toContain("930-turbo");
    expect([...TURBO_SERIES]).toContain("992-turbo");
  });
});
