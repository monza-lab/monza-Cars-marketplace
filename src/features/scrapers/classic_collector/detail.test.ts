import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./browser", () => ({
  isCloudflareChallenge: vi.fn(async () => false),
  waitForCloudflareResolution: vi.fn(async () => true),
}));

vi.mock("./scrapling", () => ({
  canUseScraplingFallback: () => true,
  fetchClassicDetailWithScrapling: vi.fn(),
}));

import { fetchAndParseDetail, parseClassicDetailContent } from "./detail";
import { extractVinFromUrl } from "./id";
import { fetchClassicDetailWithScrapling } from "./scrapling";

const mockScrapling = vi.mocked(fetchClassicDetailWithScrapling);

function createMockPage(extracted: { title: string; bodyText: string; images: string[] }) {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(extracted),
  } as any;
}

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

describe("classic detail parsing", () => {
  it("parses the main listing fields from rendered content", () => {
    const parsed = parseClassicDetailContent(
      {
        title: "2015 Porsche 911 GT3 RS",
        bodyText: [
          "FOR SALE",
          "by",
          "Gooding & Company",
          "Specs",
          "Year",
          "2015",
          "Make",
          "Porsche",
          "Model Family",
          "911",
          "Model Variant",
          "GT3 RS",
          "Model Trim",
          "RS",
          "Engine",
          "4.0L Flat-6",
          "Transmission",
          "7-Speed PDK",
          "Ext. Color Group",
          "White",
          "Int. Color Group",
          "Black",
          "VIN:",
          "WP0AF2A99FS183941",
          "21,004 mi",
          "price range from $200,000 - $240,000",
          "Jan 4, 2026",
          "Sold at",
          "Gooding & Company Auctions",
          "for $228,500",
        ].join("\n"),
        images: [
          "https://images.classic.com/vehicles/one.jpg",
          "https://images.classic.com/vehicles/two.jpg",
        ],
      },
      "https://www.classic.com/veh/2015-porsche-911-gt3-rs-wp0af2a99fs183941-abc123",
    );

    expect(parsed.raw.title).toBe("2015 Porsche 911 GT3 RS");
    expect(parsed.raw.year).toBe(2015);
    expect(parsed.raw.make).toBe("Porsche");
    expect(parsed.raw.model).toBe("911");
    expect(parsed.raw.trim).toBe("RS");
    expect(parsed.raw.vin).toBe("WP0AF2A99FS183941");
    expect(parsed.raw.mileage).toBe(21004);
    expect(parsed.raw.auctionHouse).toBe("Gooding & Company");
    expect(parsed.raw.price).toBe(220000);
    expect(parsed.raw.hammerPrice).toBe(228500);
    expect(parsed.raw.images).toHaveLength(2);
  });
});

describe("fetchAndParseDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers Scrapling when it is available", async () => {
    mockScrapling.mockResolvedValueOnce({
      title: "2018 Porsche 911 GT3",
      bodyText: [
        "FOR SALE",
        "by",
        "Bonhams",
        "Specs",
        "Year",
        "2018",
        "Make",
        "Porsche",
        "Model Family",
        "911",
        "Model Trim",
        "GT3",
        "VIN:",
        "WP0AC2A90JS175001",
        "15,120 mi",
      ].join("\n"),
      images: ["https://images.classic.com/vehicles/fallback.jpg"],
    });

    const page = createMockPage({
      title: "2018 Porsche 911 GT3",
      bodyText: [
        "FOR SALE",
        "by",
        "Bonhams",
        "Specs",
        "Year",
        "2018",
        "Make",
        "Porsche",
        "Model Family",
        "911",
        "Model Trim",
        "GT3",
        "VIN:",
        "WP0AC2A90JS175001",
        "15,120 mi",
      ].join("\n"),
      images: [],
    });

    const parsed = await fetchAndParseDetail({
      page,
      url: "https://www.classic.com/veh/2018-porsche-911-gt3-wp0ac2a90js175001-abc123",
      pageTimeoutMs: 10_000,
      runId: "test-run",
    });

    expect(mockScrapling).toHaveBeenCalledTimes(1);
    expect(page.goto).not.toHaveBeenCalled();
    expect(parsed.raw.images).toEqual(["https://images.classic.com/vehicles/fallback.jpg"]);
    expect(parsed.raw.auctionHouse).toBe("Bonhams");
  });

  it("falls back to Playwright when Scrapling is unavailable", async () => {
    mockScrapling.mockResolvedValueOnce(null as unknown as never);

    const page = createMockPage({
      title: "2020 Porsche 911 Turbo S",
      bodyText: [
        "FOR SALE",
        "by",
        "RM Sotheby's",
        "Specs",
        "Year",
        "2020",
        "Make",
        "Porsche",
        "Model Family",
        "911",
        "Model Trim",
        "Turbo S",
        "VIN:",
        "WP0AD2A95LS185001",
      ].join("\n"),
      images: ["https://images.classic.com/vehicles/playwright.jpg"],
    });

    const parsed = await fetchAndParseDetail({
      page,
      url: "https://www.classic.com/veh/2020-porsche-911-turbo-s-wp0ad2a95ls185001-abc123",
      pageTimeoutMs: 10_000,
      runId: "test-run",
    });

    expect(mockScrapling).toHaveBeenCalledTimes(1);
    expect(page.goto).toHaveBeenCalledTimes(1);
    expect(parsed.raw.title).toBe("2020 Porsche 911 Turbo S");
    expect(parsed.raw.images).toEqual(["https://images.classic.com/vehicles/playwright.jpg"]);
  });
});
