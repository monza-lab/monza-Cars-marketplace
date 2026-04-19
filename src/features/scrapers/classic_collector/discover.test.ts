import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./scrapling", () => ({
  canUseScraplingFallback: vi.fn(() => true),
  fetchClassicPageHtmlWithScrapling: vi.fn(),
  shouldPreferScraplingFirst: vi.fn(() => false),
}));

import {
  buildSearchUrl,
  discoverAllListings,
  parseGraphQLSearchResponses,
  parseSearchResultsFromDOM,
} from "./discover";
import { fetchClassicPageHtmlWithScrapling, shouldPreferScraplingFirst } from "./scrapling";

const mockFetchClassicPageHtmlWithScrapling = vi.mocked(fetchClassicPageHtmlWithScrapling);
const mockShouldPreferScraplingFirst = vi.mocked(shouldPreferScraplingFirst);

describe("buildSearchUrl", () => {
  it("builds URL for page 1 without page param", () => {
    const url = buildSearchUrl("Porsche", "US", "forsale");
    expect(url).toContain("q=Porsche");
    expect(url).toContain("result_type=listings");
    expect(url).toContain("status=forsale");
    expect(url).toContain("filters%5Blocation%5D=US");
    expect(url).not.toContain("page=");
  });

  it("builds URL with page param for page > 1", () => {
    const url = buildSearchUrl("Porsche", "US", "forsale", 3);
    expect(url).toContain("page=3");
  });

  it("omits page param for page 1", () => {
    const url = buildSearchUrl("Porsche", "US", "forsale", 1);
    expect(url).not.toContain("page=");
  });
});

describe("parseGraphQLSearchResponses", () => {
  it("extracts listings from a nested GraphQL response", () => {
    const payload = {
      data: {
        search: {
          totalResults: 42,
          results: [
            {
              url: "/veh/2023-porsche-911-gt3-WP0AC2A98PS230517-abc1234/",
              title: "2023 Porsche 911 GT3",
              year: 2023,
              make: "Porsche",
              model: "911",
              price: 225000,
              auctionHouse: "Bring a Trailer",
            },
            {
              url: "/veh/1989-porsche-911-carrera-WP0AB0916KS120456-def5678/",
              title: "1989 Porsche 911 Carrera",
              year: 1989,
              make: "Porsche",
              model: "911",
              price: 85000,
              auctionHouse: "Mecum",
            },
          ],
        },
      },
    };

    const result = parseGraphQLSearchResponses([payload]);
    expect(result.totalResults).toBe(42);
    expect(result.listings).toHaveLength(2);
    expect(result.listings[0].title).toBe("2023 Porsche 911 GT3");
    expect(result.listings[0].year).toBe(2023);
    expect(result.listings[0].sourceUrl).toContain("classic.com/veh/");
    expect(result.listings[0].vin).toBe("WP0AC2A98PS230517");
    expect(result.listings[1].price).toBe(85000);
  });

  it("handles empty payloads", () => {
    const result = parseGraphQLSearchResponses([null, undefined, {}]);
    expect(result.listings).toHaveLength(0);
    expect(result.totalResults).toBeNull();
  });

  it("skips items without /veh/ URL", () => {
    const payload = {
      data: {
        results: [
          { url: "/m/porsche/911/", title: "Porsche 911 Market" },
          { url: "/veh/2023-porsche-911-WP0AC2A98PS230517-abc/", title: "2023 Porsche 911" },
        ],
      },
    };
    const result = parseGraphQLSearchResponses([payload]);
    expect(result.listings).toHaveLength(1);
  });

  it("extracts total from various field names", () => {
    const payload1 = { data: { search: { total: 100, results: [] } } };
    expect(parseGraphQLSearchResponses([payload1]).totalResults).toBe(100);

    const payload2 = { data: { search: { count: 50, results: [] } } };
    expect(parseGraphQLSearchResponses([payload2]).totalResults).toBe(50);
  });
});

describe("parseSearchResultsFromDOM", () => {
  it("extracts listings from HTML with /veh/ links", () => {
    const html = `
      <html><body>
        <div class="listing-card">
          <a href="/veh/2023-porsche-911-gt3-WP0AC2A98PS230517-abc1234/">
            <h3 class="title">2023 Porsche 911 GT3</h3>
            <span class="price">$225,000</span>
            <img src="https://example.com/img.jpg" />
          </a>
        </div>
        <div class="listing-card">
          <a href="/veh/1989-porsche-911-carrera-WP0AB0916KS120456-def5678/">
            <h3 class="title">1989 Porsche 911 Carrera</h3>
            <span class="price">$85,000</span>
          </a>
        </div>
      </body></html>
    `;

    const listings = parseSearchResultsFromDOM(html);
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe("2023 Porsche 911 GT3");
    expect(listings[0].price).toBe(225000);
    expect(listings[0].vin).toBe("WP0AC2A98PS230517");
    expect(listings[0].thumbnailUrl).toBe("https://example.com/img.jpg");
    expect(listings[1].year).toBe(1989);
  });

  it("handles HTML with no /veh/ links", () => {
    const html = `<html><body><p>No listings</p></body></html>`;
    expect(parseSearchResultsFromDOM(html)).toHaveLength(0);
  });

  it("deduplicates listings with same URL", () => {
    const html = `
      <html><body>
        <a href="/veh/2023-porsche-911-WP0AC2A98PS230517-abc/">
          <h3>2023 Porsche 911</h3>
        </a>
        <a href="/veh/2023-porsche-911-WP0AC2A98PS230517-abc/">
          <h3>2023 Porsche 911</h3>
        </a>
      </body></html>
    `;
    expect(parseSearchResultsFromDOM(html)).toHaveLength(1);
  });
});

describe("discoverAllListings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to Scrapling when Playwright discovery fails", async () => {
    mockFetchClassicPageHtmlWithScrapling.mockResolvedValueOnce(`
      <html><body>
        <div class="listing-card">
          <a href="/veh/2024-porsche-911-gt3-WP0AC2A98RS263305-abc1234/">
            <h3 class="title">2024 Porsche 911 GT3</h3>
            <span class="price">$275,000</span>
          </a>
        </div>
      </body></html>
    `);

    const page = {
      on: vi.fn(),
      removeListener: vi.fn(),
      goto: vi.fn().mockRejectedValue(new Error("Execution context was destroyed, most likely because of a navigation")),
    } as unknown as Parameters<typeof discoverAllListings>[0]["page"];

    const result = await discoverAllListings({
      page,
      make: "Porsche",
      location: "US",
      status: "forsale",
      maxPages: 1,
      maxListings: 5,
      navigationDelayMs: 0,
      pageTimeoutMs: 1000,
      runId: "run-1",
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].title).toBe("2024 Porsche 911 GT3");
    expect(result.listings[0].price).toBe(275000);
    expect(mockFetchClassicPageHtmlWithScrapling).toHaveBeenCalledTimes(1);
  });

  it("uses Scrapling first when forced by automation", async () => {
    mockShouldPreferScraplingFirst.mockReturnValueOnce(true);
    mockFetchClassicPageHtmlWithScrapling.mockResolvedValueOnce(`
      <html><body>
        <a href="/veh/2024-porsche-911-gt3-WP0AC2A98RS263305-abc1234/">
          <h3 class="title">2024 Porsche 911 GT3</h3>
          <span class="price">$275,000</span>
        </a>
      </body></html>
    `);

    const page = {
      on: vi.fn(),
      removeListener: vi.fn(),
      goto: vi.fn(),
    } as unknown as Parameters<typeof discoverAllListings>[0]["page"];

    const result = await discoverAllListings({
      page,
      make: "Porsche",
      location: "US",
      status: "forsale",
      maxPages: 1,
      maxListings: 5,
      navigationDelayMs: 0,
      pageTimeoutMs: 1000,
      runId: "run-automation",
    });

    expect(result.listings).toHaveLength(1);
    expect(page.goto).not.toHaveBeenCalled();
    expect(mockFetchClassicPageHtmlWithScrapling).toHaveBeenCalledTimes(1);
  });
});
