import { describe, it, expect } from "vitest";
import { classifyGt, GT_SERIES } from "./porscheGt";
import type { SoldListingRecord } from "@/lib/supabaseLiveListings";

function mk(
  overrides: Partial<SoldListingRecord> & { model: string; year: number; title?: string }
): SoldListingRecord {
  return {
    price: 200000,
    date: "2024-01-15",
    title: overrides.title ?? `${overrides.year} Porsche ${overrides.model}`,
    ...overrides,
  };
}

describe("classifyGt", () => {
  it("classifies a 997 GT3 RS", () => {
    expect(classifyGt(mk({ model: "911 GT3 RS 997", year: 2010 }))).toBe("997-gt3");
  });

  it("classifies a 991 GT3", () => {
    expect(classifyGt(mk({ model: "911 GT3 991", year: 2014 }))).toBe("991-gt3");
  });

  it("classifies a 997 GT2 RS", () => {
    expect(classifyGt(mk({ model: "911 GT2 RS 997", year: 2011 }))).toBe("997-gt2");
  });

  it("classifies a 964 RS (air-cooled RS, not GT3)", () => {
    expect(classifyGt(mk({ model: "911 Carrera RS 964", year: 1992 }))).toBe("964-rs");
  });

  it("classifies a 718 Cayman GT4", () => {
    expect(classifyGt(mk({ model: "718 Cayman GT4", year: 2020 }))).toBe("718-gt4");
  });

  it("rejects a regular 911 Carrera", () => {
    expect(classifyGt(mk({ model: "911 Carrera 991", year: 2015 }))).toBeNull();
  });

  it("rejects a 911 Turbo", () => {
    expect(classifyGt(mk({ model: "911 Turbo S 991", year: 2017 }))).toBeNull();
  });

  it("rejects a 996 Turbo (not a GT car)", () => {
    expect(classifyGt(mk({ model: "911 Turbo 996", year: 2003 }))).toBeNull();
  });
});

describe("GT_SERIES", () => {
  it("has 10 GT series covering all Porsche GT variants", () => {
    expect(GT_SERIES).toHaveLength(10);
    expect([...GT_SERIES]).toContain("964-rs");
    expect([...GT_SERIES]).toContain("992-gt3");
    expect([...GT_SERIES]).toContain("718-gt4");
  });
});
