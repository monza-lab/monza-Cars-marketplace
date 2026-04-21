import { describe, it, expect, vi } from "vitest";
import { localeToDestination } from "../localeMap";
import { sourceToOriginCountry } from "../originMap";

describe("localeToDestination", () => {
  it("maps en → US", () => {
    expect(localeToDestination("en")).toBe("US");
  });
  it("maps en-gb → UK", () => {
    expect(localeToDestination("en-gb")).toBe("UK");
  });
  it("maps en-GB (capitalized) → UK", () => {
    expect(localeToDestination("en-GB")).toBe("UK");
  });
  it("maps de → DE", () => {
    expect(localeToDestination("de")).toBe("DE");
  });
  it("maps ja → JP", () => {
    expect(localeToDestination("ja")).toBe("JP");
  });
  it("maps unknown locale → US (default) and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(localeToDestination("fr")).toBe("US");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("sourceToOriginCountry", () => {
  it("maps BaT → US", () => {
    expect(sourceToOriginCountry("BaT")).toBe("US");
  });
  it("maps AutoScout24 → DE (EU proxy)", () => {
    expect(sourceToOriginCountry("AutoScout24")).toBe("DE");
  });
  it("maps AutoTrader → UK", () => {
    expect(sourceToOriginCountry("AutoTrader")).toBe("UK");
  });
  it("maps BeForward → JP", () => {
    expect(sourceToOriginCountry("BeForward")).toBe("JP");
  });
  it("returns null for unknown source", () => {
    expect(sourceToOriginCountry("MercadoLibre")).toBeNull();
  });
  it("returns null for empty/missing source", () => {
    expect(sourceToOriginCountry(null)).toBeNull();
    expect(sourceToOriginCountry(undefined)).toBeNull();
    expect(sourceToOriginCountry("")).toBeNull();
  });
});
