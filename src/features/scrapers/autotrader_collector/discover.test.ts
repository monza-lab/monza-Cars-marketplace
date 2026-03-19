import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  buildGatewayFilters,
  buildSearchUrl,
  extractLinks,
  extractSearchResultLinks,
  parseGatewayListings,
  hasNextPage,
  getTotalPages,
  detectAppVersion,
  resetCachedAppVersion,
} from "./discover";

describe("buildGatewayFilters", () => {
  it("always includes required filters", () => {
    const filters = buildGatewayFilters({ make: "Porsche" });
    expect(filters).toEqual(
      expect.arrayContaining([
        { filter: "price_search_type", selected: ["total"] },
        { filter: "postcode", selected: ["SW1A 1AA"] },
        { filter: "make", selected: ["Porsche"] },
      ]),
    );
  });

  it("maps optional range filters", () => {
    const filters = buildGatewayFilters({
      make: "Porsche",
      yearFrom: 2019,
      yearTo: 2024,
      priceTo: 100000,
      mileageTo: 50000,
    });

    expect(filters).toEqual(
      expect.arrayContaining([
        { filter: "min_year_manufactured", selected: ["2019"] },
        { filter: "max_year_manufactured", selected: ["2024"] },
        { filter: "max_price", selected: ["100000"] },
        { filter: "max_mileage", selected: ["50000"] },
      ]),
    );
  });
});

describe("parseGatewayListings", () => {
  it("extracts valid listings and metadata", () => {
    const parsed = parseGatewayListings({
      data: {
        searchResults: {
          listings: [
            {
              advertId: "202601010000001",
              title: "Porsche 911 Carrera",
              price: "£89,995",
              vehicleLocation: "London (5 miles)",
              images: ["https://img.example/1.jpg", ""],
              trackingContext: {
                advertContext: { make: "Porsche", model: "911", year: 2022 },
                advertCardFeatures: { priceIndicator: "good-price" },
              },
            },
            {
              advertId: "",
              title: "invalid",
            },
          ],
          page: { number: 2, results: { count: 1234 } },
          trackingContext: { searchId: "search-abc" },
        },
      },
    });

    expect(parsed.page).toBe(2);
    expect(parsed.totalResults).toBe(1234);
    expect(parsed.searchId).toBe("search-abc");
    expect(parsed.listings).toHaveLength(1);
    expect(parsed.listings[0]).toMatchObject({
      advertId: "202601010000001",
      make: "Porsche",
      model: "911",
      year: 2022,
      priceText: "£89,995",
      priceIndicator: "good-price",
    });
  });

  it("throws when gateway responds with errors", () => {
    expect(() =>
      parseGatewayListings({
        errors: [{ message: "postcode missing" }],
      }),
    ).toThrow("postcode missing");
  });
});

describe("buildSearchUrl", () => {
  it("should build base URL without filters", () => {
    const url = buildSearchUrl({});
    expect(url).toBe("https://www.autotrader.co.uk/car-search");
  });

  it("should build URL with make filter", () => {
    const url = buildSearchUrl({ make: "Porsche" });
    expect(url).toContain("make=Porsche");
  });

  it("should build URL with postcode filter", () => {
    const url = buildSearchUrl({ postcode: "SW1A 1AA" });
    expect(url).toContain("postcode=SW1A+1AA");
  });

  it("should build URL with year filters", () => {
    const url = buildSearchUrl({ yearFrom: 2020, yearTo: 2026 });
    expect(url).toContain("year-from=2020");
    expect(url).toContain("year-to=2026");
  });

  it("should build URL with price filters", () => {
    const url = buildSearchUrl({ priceFrom: 10000, priceTo: 50000 });
    expect(url).toContain("price-from=10000");
    expect(url).toContain("price-to=50000");
  });

  it("should build URL with mileage filters", () => {
    const url = buildSearchUrl({ mileageFrom: 0, mileageTo: 30000 });
    expect(url).toContain("mileage-from=0");
    expect(url).toContain("mileage-to=30000");
  });

  it("should build URL with all filters", () => {
    const url = buildSearchUrl({
      make: "Porsche",
      model: "911",
      postcode: "SW1A 1AA",
      yearFrom: 2020,
      yearTo: 2026,
      priceFrom: 10000,
      priceTo: 100000,
      mileageFrom: 0,
      mileageTo: 50000,
    });
    expect(url).toContain("make=Porsche");
    expect(url).toContain("model=911");
    expect(url).toContain("postcode=SW1A+1AA");
    expect(url).toContain("year-from=2020");
    expect(url).toContain("year-to=2026");
    expect(url).toContain("price-from=10000");
    expect(url).toContain("price-to=100000");
    expect(url).toContain("mileage-from=0");
    expect(url).toContain("mileage-to=50000");
  });
});

describe("extractLinks", () => {
  const sampleHtmlWithListings = `
<!DOCTYPE html>
<html>
<body>
  <a href="/car-details/2023-Porsche-911/123456789">Porsche 911</a>
  <a href="/car-details/2022-Porsche-Cayman/987654321">Porsche Cayman</a>
  <a href="/vehicle/2021-BMW-3-series/456789123">BMW 3 Series</a>
  <a href="/used-car/porsche/911/111222333">Used Porsche 911</a>
  <a href="https://www.autotrader.co.uk/car-details/2020-Audi-A4/444555666">Audi A4</a>
  <a href="/car-search?make=Porsche">Search Results</a>
  <a href="mailto:info@example.com">Email</a>
  <a href="tel:+441234567890">Call</a>
</body>
</html>
  `;

  it("should extract car-details links", () => {
    const links = extractLinks(sampleHtmlWithListings);
    expect(links).toContain("https://www.autotrader.co.uk/car-details/2023-Porsche-911/123456789");
    expect(links).toContain("https://www.autotrader.co.uk/car-details/2022-Porsche-Cayman/987654321");
  });

  it("should extract vehicle links", () => {
    const links = extractLinks(sampleHtmlWithListings);
    expect(links).toContain("https://www.autotrader.co.uk/vehicle/2021-BMW-3-series/456789123");
  });

  it("should extract used-car links", () => {
    const links = extractLinks(sampleHtmlWithListings);
    expect(links).toContain("https://www.autotrader.co.uk/used-car/porsche/911/111222333");
  });

  it("should handle absolute URLs", () => {
    const links = extractLinks(sampleHtmlWithListings);
    expect(links).toContain("https://www.autotrader.co.uk/car-details/2020-Audi-A4/444555666");
  });

  it("should exclude search result links", () => {
    const links = extractLinks(sampleHtmlWithListings);
    expect(links).not.toContain("https://www.autotrader.co.uk/car-search?make=Porsche");
  });

  it("should exclude mailto links", () => {
    const links = extractLinks(sampleHtmlWithListings);
    expect(links).not.toContain("mailto:info@example.com");
  });

  it("should exclude tel links", () => {
    const links = extractLinks(sampleHtmlWithListings);
    expect(links).not.toContain("tel:+441234567890");
  });

  it("should return empty array for HTML without valid links", () => {
    const html = "<html><body><p>No links here</p></body></html>";
    const links = extractLinks(html);
    expect(links).toEqual([]);
  });
});

describe("extractSearchResultLinks", () => {
  const sampleSearchHtml = `
<!DOCTYPE html>
<html>
<body>
  <a href="/car-details/2023-Porsche-911/123456789">Porsche 911</a>
  <a href="/car-search?make=Porsche&page=2">Next Page</a>
  <a href="/car-search?make=Porsche&page=3">Page 3</a>
</body>
</html>
  `;

  it("should extract listing links", () => {
    const links = extractSearchResultLinks(sampleSearchHtml);
    expect(links).toContain("https://www.autotrader.co.uk/car-details/2023-Porsche-911/123456789");
  });

  it("should also extract search page links", () => {
    const links = extractSearchResultLinks(sampleSearchHtml);
    expect(links).toContain("https://www.autotrader.co.uk/car-search?make=Porsche&page=2");
  });
});

describe("hasNextPage", () => {
  it("should detect next page button with data-testid", () => {
    const html = `
      <html>
      <body>
        <a data-testid="pagination-next" href="?page=2">Next</a>
      </body>
      </html>
    `;
    expect(hasNextPage(html)).toBe(true);
  });

  it("should detect next page with aria-label", () => {
    const html = `
      <html>
      <body>
        <a aria-label="Next page" href="?page=2">Next</a>
      </body>
      </html>
    `;
    expect(hasNextPage(html)).toBe(true);
  });

  it("should detect next page with rel=next", () => {
    const html = `
      <html>
      <body>
        <a rel="next" href="?page=2">Next</a>
      </body>
      </html>
    `;
    expect(hasNextPage(html)).toBe(true);
  });

  it("should return false when no pagination found", () => {
    const html = "<html><body><p>No pagination</p></body></html>";
    expect(hasNextPage(html)).toBe(false);
  });
});

describe("getTotalPages", () => {
  it("should parse total pages from pagination info text", () => {
    const html = `
      <html>
      <body>
        <span data-testid="pagination-info">Page 1 of 24</span>
      </body>
      </html>
    `;
    expect(getTotalPages(html)).toBe(24);
  });

  it("should count page links when no explicit total", () => {
    const html = `
      <html>
      <body>
        <a href="?page=1">1</a>
        <a href="?page=2">2</a>
        <a href="?page=3">3</a>
        <a href="?page=4">4</a>
        <a href="?page=5">5</a>
      </body>
      </html>
    `;
    expect(getTotalPages(html)).toBe(5);
  });

  it("should return 1 when no pagination info", () => {
    const html = "<html><body><p>No pagination</p></body></html>";
    expect(getTotalPages(html)).toBe(1);
  });
});

describe("detectAppVersion", () => {
  beforeEach(() => {
    resetCachedAppVersion();
    vi.restoreAllMocks();
  });

  it("returns fallback version when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));
    const version = await detectAppVersion();
    expect(version).toBe("6c9dff0561");
  });

  it("returns fallback version when page returns non-200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Forbidden", { status: 403 })
    );
    const version = await detectAppVersion();
    expect(version).toBe("6c9dff0561");
  });

  it("detects version from webpack chunk pattern", async () => {
    const html = `<html><head><script src="/_next/static/chunks/_app-abc1234def.js"></script></head></html>`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 })
    );
    const version = await detectAppVersion();
    expect(version).toBe("abc1234def");
  });

  it("detects version from JSON metadata", async () => {
    const html = `<html><script>{"buildId":"ff00112233"}</script></html>`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 })
    );
    const version = await detectAppVersion();
    expect(version).toBe("ff00112233");
  });

  it("caches the result across calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(`<script src="/_app-aabbccddee.js"></script>`, { status: 200 })
    );
    const v1 = await detectAppVersion();
    const v2 = await detectAppVersion();
    expect(v1).toBe("aabbccddee");
    expect(v2).toBe("aabbccddee");
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Only fetched once
  });

  it("returns fallback when no patterns match", async () => {
    const html = `<html><body><h1>AutoTrader</h1></body></html>`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 })
    );
    const version = await detectAppVersion();
    expect(version).toBe("6c9dff0561");
  });
});
