import { describe, it, expect } from "vitest";
import { resolveDutyRate, resolveVatRate } from "../calculator";

describe("resolveDutyRate", () => {
  it("US < 25 yrs: standard 2.5%", () => {
    const { ratePct, note } = resolveDutyRate("US", 10);
    expect(ratePct).toBe(2.5);
    expect(note).toBeNull();
  });
  it("US ≥ 25 yrs: 0% with exemption note", () => {
    const { ratePct, note } = resolveDutyRate("US", 25);
    expect(ratePct).toBe(0);
    expect(note).toMatch(/25-year/);
  });
  it("UK < 30 yrs: standard 10%", () => {
    expect(resolveDutyRate("UK", 20).ratePct).toBe(10);
  });
  it("UK ≥ 30 yrs: 5% with historic note", () => {
    const { ratePct, note } = resolveDutyRate("UK", 30);
    expect(ratePct).toBe(5);
    expect(note).toMatch(/Historic/);
  });
  it("DE always 10% (no exemption)", () => {
    expect(resolveDutyRate("DE", 10).ratePct).toBe(10);
    expect(resolveDutyRate("DE", 50).ratePct).toBe(10);
  });
  it("JP always 0%", () => {
    expect(resolveDutyRate("JP", 0).ratePct).toBe(0);
    expect(resolveDutyRate("JP", 50).ratePct).toBe(0);
  });
});

describe("resolveVatRate", () => {
  it("US sales tax: 6% regardless of age", () => {
    expect(resolveVatRate("US", 50).ratePct).toBe(6);
  });
  it("DE VAT standard: 19%", () => {
    expect(resolveVatRate("DE", 10).ratePct).toBe(19);
  });
  it("DE VAT ≥ 30 yrs: reduced 7%", () => {
    const { ratePct, note } = resolveVatRate("DE", 30);
    expect(ratePct).toBe(7);
    expect(note).toMatch(/Historic/);
  });
  it("UK VAT ≥ 30 yrs: reduced 5%", () => {
    expect(resolveVatRate("UK", 30).ratePct).toBe(5);
  });
  it("JP consumption tax: 10%", () => {
    expect(resolveVatRate("JP", 50).ratePct).toBe(10);
  });
});
