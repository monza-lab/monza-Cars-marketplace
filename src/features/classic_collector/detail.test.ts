import { describe, it, expect } from "vitest";
import { extractVinFromUrl } from "./id";

// Note: fetchAndParseDetail requires a real Playwright Page, so we test
// the VIN extraction and normalization logic separately.
// Integration tests for the full detail flow require a browser context.

describe("detail VIN extraction from URL", () => {
  it("extracts VIN from standard classic.com vehicle URL", () => {
    const url = "https://www.classic.com/veh/2005-porsche-carrera-gt-wp0ca298x5l001385-peDZywW";
    expect(extractVinFromUrl(url)).toBe("WP0CA298X5L001385");
  });

  it("extracts VIN from 911 GT3 URL", () => {
    const url = "https://www.classic.com/veh/2024-porsche-911-gt3-touring-wp0ac2a90rs263305-WReObAn";
    expect(extractVinFromUrl(url)).toBe("WP0AC2A90RS263305");
  });

  it("extracts VIN from 911 Turbo URL", () => {
    const url = "https://www.classic.com/veh/2008-porsche-911-turbo-wp0cd29978s788547-4oGjMG4";
    expect(extractVinFromUrl(url)).toBe("WP0CD29978S788547");
  });

  it("returns null for non-vehicle URLs", () => {
    expect(extractVinFromUrl("https://www.classic.com/m/porsche/911/")).toBeNull();
  });
});
