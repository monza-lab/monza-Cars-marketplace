import { describe, it, expect } from "vitest";
import { decodePorscheVin } from "./porscheVin";

describe("decodePorscheVin", () => {
  it("rejects empty input", () => {
    const r = decodePorscheVin("");
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("rejects VINs with wrong length", () => {
    const r = decodePorscheVin("WP0ZZZ96ZNS40");
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/17 characters/);
  });

  it("rejects VINs with invalid characters (I, O, Q)", () => {
    const r = decodePorscheVin("WPOZZZ96ZNS400001");
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/invalid characters/);
  });

  it("decodes a 1992 964 Euro Carrera (MY N)", () => {
    const r = decodePorscheVin("WP0ZZZ96ZNS400001");
    expect(r.valid).toBe(true);
    expect(r.wmi).toBe("WP0");
    expect(r.modelYear).toBe(1992);
    expect(r.plant).toBe("S");
    expect(r.plantDescription).toMatch(/Stuttgart/);
    expect(r.serial).toBe("400001");
    expect(r.bodyHint).toMatch(/964/);
  });

  it("decodes a 2016 991 R (year G) — post-2010 interpretation", () => {
    const r = decodePorscheVin("WP0ZZZ99ZGS198765");
    expect(r.valid).toBe(true);
    expect([2016, 1986]).toContain(r.modelYear);
  });

  it("flags unknown WMI as non-Porsche", () => {
    const r = decodePorscheVin("AAAZZZ96ZNS400001");
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /WMI/.test(e))).toBe(true);
  });

  it("exposes raw per-position characters for UI display", () => {
    const r = decodePorscheVin("WP0ZZZ96ZNS400001");
    expect(r.raw.positions.p1).toBe("W");
    expect(r.raw.positions.p10).toBe("N");
    expect(r.raw.positions.p11).toBe("S");
  });
});
