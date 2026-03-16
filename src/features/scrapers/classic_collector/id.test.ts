import { describe, it, expect } from "vitest";
import { extractVinFromUrl, extractClassicComId, deriveSourceId, canonicalizeUrl } from "./id";

describe("extractVinFromUrl", () => {
  it("extracts a 17-char VIN from a standard classic.com vehicle URL", () => {
    const url = "https://www.classic.com/veh/2023-porsche-911-gt3-WP0AC2A98PS230517-WYG0PA4/";
    expect(extractVinFromUrl(url)).toBe("WP0AC2A98PS230517");
  });

  it("extracts VIN regardless of surrounding model text", () => {
    const url = "https://www.classic.com/veh/1989-porsche-911-carrera-WP0AB0916KS120456-abc1234/";
    expect(extractVinFromUrl(url)).toBe("WP0AB0916KS120456");
  });

  it("returns null for URLs without a VIN", () => {
    expect(extractVinFromUrl("https://www.classic.com/search/?q=Porsche")).toBeNull();
  });

  it("returns null for market pages", () => {
    expect(extractVinFromUrl("https://www.classic.com/m/porsche/911/")).toBeNull();
  });

  it("is case-insensitive and returns uppercase", () => {
    const url = "https://www.classic.com/veh/2020-porsche-taycan-wp0ac2a98ps230517-xyz/";
    expect(extractVinFromUrl(url)).toBe("WP0AC2A98PS230517");
  });

  it("excludes VINs with I, O, Q (invalid per ISO 3779)", () => {
    // I, O, Q are not valid VIN characters - this should not match
    const url = "https://www.classic.com/veh/2020-porsche-IOOOOOOOOOOOOOOOO-abc/";
    expect(extractVinFromUrl(url)).toBeNull();
  });
});

describe("extractClassicComId", () => {
  it("extracts the short ID suffix from a vehicle URL", () => {
    const url = "https://www.classic.com/veh/2023-porsche-911-gt3-WP0AC2A98PS230517-WYG0PA4/";
    expect(extractClassicComId(url)).toBe("WYG0PA4");
  });

  it("handles URLs without trailing slash", () => {
    const url = "https://www.classic.com/veh/2023-porsche-911-gt3-WP0AC2A98PS230517-peBRM74";
    expect(extractClassicComId(url)).toBe("peBRM74");
  });

  it("returns null for non-vehicle URLs", () => {
    expect(extractClassicComId("https://www.classic.com/search/?q=Porsche")).toBeNull();
  });
});

describe("deriveSourceId", () => {
  it("uses VIN as primary key when available", () => {
    const id = deriveSourceId({
      vin: "WP0AC2A98PS230517",
      classicComId: "WYG0PA4",
      sourceUrl: "https://www.classic.com/veh/...",
    });
    expect(id).toBe("classic-WP0AC2A98PS230517");
  });

  it("falls back to classicComId when VIN is null", () => {
    const id = deriveSourceId({
      vin: null,
      classicComId: "WYG0PA4",
      sourceUrl: "https://www.classic.com/veh/...",
    });
    expect(id).toBe("classic-id-WYG0PA4");
  });

  it("falls back to classicComId when VIN is too short", () => {
    const id = deriveSourceId({
      vin: "SHORT",
      classicComId: "abc1234",
      sourceUrl: "https://www.classic.com/veh/...",
    });
    expect(id).toBe("classic-id-abc1234");
  });

  it("falls back to URL hash when both VIN and classicComId are null", () => {
    const id = deriveSourceId({
      vin: null,
      classicComId: null,
      sourceUrl: "https://www.classic.com/veh/some-unknown-listing/",
    });
    expect(id).toMatch(/^classic-[a-f0-9]{24}$/);
  });

  it("produces deterministic hashes for the same URL", () => {
    const a = deriveSourceId({ vin: null, classicComId: null, sourceUrl: "https://www.classic.com/veh/x/" });
    const b = deriveSourceId({ vin: null, classicComId: null, sourceUrl: "https://www.classic.com/veh/x/" });
    expect(a).toBe(b);
  });

  it("produces different hashes for different URLs", () => {
    const a = deriveSourceId({ vin: null, classicComId: null, sourceUrl: "https://www.classic.com/veh/a/" });
    const b = deriveSourceId({ vin: null, classicComId: null, sourceUrl: "https://www.classic.com/veh/b/" });
    expect(a).not.toBe(b);
  });
});

describe("canonicalizeUrl", () => {
  it("strips UTM parameters", () => {
    const url = "https://www.classic.com/veh/test/?utm_source=google&utm_medium=cpc";
    expect(canonicalizeUrl(url)).toBe("https://www.classic.com/veh/test/");
  });

  it("strips fbclid and gclid", () => {
    const url = "https://www.classic.com/veh/test/?fbclid=abc&gclid=def";
    expect(canonicalizeUrl(url)).toBe("https://www.classic.com/veh/test/");
  });

  it("removes hash fragments", () => {
    const url = "https://www.classic.com/veh/test/#section";
    expect(canonicalizeUrl(url)).toBe("https://www.classic.com/veh/test/");
  });

  it("preserves meaningful query parameters", () => {
    const url = "https://www.classic.com/search/?q=Porsche&status=forsale";
    const result = canonicalizeUrl(url);
    expect(result).toContain("q=Porsche");
    expect(result).toContain("status=forsale");
  });

  it("handles relative paths", () => {
    const url = "/veh/some-car/";
    expect(canonicalizeUrl(url)).toBe("https://www.classic.com/veh/some-car/");
  });
});
