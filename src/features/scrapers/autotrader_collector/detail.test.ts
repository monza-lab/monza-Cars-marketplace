import { describe, it, expect, vi } from "vitest";
import { fetchAutoTraderDetail, parseAutoTraderHtml } from "./detail";

describe("parseAutoTraderHtml", () => {
  it("returns all-null for empty HTML", () => {
    const result = parseAutoTraderHtml("<html><body></body></html>");
    expect(result.title).toBeNull();
    expect(result.price).toBeNull();
    expect(result.engine).toBeNull();
    expect(result.vin).toBeNull();
  });

  it("extracts title from h1", () => {
    const html = '<html><body><h1>2023 Porsche 911 GT3</h1></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.title).toBe("2023 Porsche 911 GT3");
  });

  it("extracts price from data-testid", () => {
    const html = '<html><body><span data-testid="price">£85,000</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.price).toBe(85000);
  });

  it("extracts mileage and detects unit", () => {
    const html = '<html><body><span data-testid="mileage">12,500 miles</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.mileage).toBe(12500);
    expect(result.mileageUnit).toBe("miles");
  });

  it("extracts VIN from body text using word boundary", () => {
    const html = '<html><body><p>VIN: WP0ZZZ99ZTS392145</p></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.vin).toBe("WP0ZZZ99ZTS392145");
  });

  it("does not extract VIN from short strings", () => {
    const html = '<html><body><p>Reference: ABC123</p></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.vin).toBeNull();
  });

  it("extracts engine from data-testid", () => {
    const html = '<html><body><span data-testid="engine">3.0L</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.engine).toBe("3.0L");
  });

  it("extracts transmission from class selector", () => {
    const html = '<html><body><span class="spec-transmission">Automatic</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.transmission).toBe("Automatic");
  });

  it("always returns null for bodyStyle and interiorColor", () => {
    const html = '<html><body><h1>Test</h1></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.bodyStyle).toBeNull();
    expect(result.interiorColor).toBeNull();
  });

  it("extracts structured fields from the product-page JSON payload", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            heading: {
              title: "2016 Porsche Macan",
              priceBreakdown: {
                price: {
                  price: 31950,
                  priceFormatted: "£31,950",
                },
              },
            },
            gallery: {
              images: [
                { url: "https://m.atcdn.co.uk/a/media/{resize}/hero.jpg" },
                { url: "https://m.atcdn.co.uk/a/media/{resize}/one.jpg" },
              ],
            },
            overview: {
              keySpecification: [
                { label: "Mileage", value: "19,000 miles" },
                { label: "Body colour", value: "Grey" },
                { label: "Engine", value: "3.0L" },
                { label: "Gearbox", value: "Automatic" },
                { label: "Body type", value: "SUV" },
              ],
            },
            description: {
              text: ["Line one", "Line two"],
              strapline: "Great car",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response("<html><body><h1>Fallback title</h1></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );

    const detail = await fetchAutoTraderDetail(
      "https://www.autotrader.co.uk/car-details/202603261021846",
    );

    expect(detail.title).toBe("2016 Porsche Macan");
    expect(detail.price).toBe(31950);
    expect(detail.priceText).toBe("£31,950");
    expect(detail.mileage).toBe(19000);
    expect(detail.mileageUnit).toBe("miles");
    expect(detail.exteriorColor).toBe("Grey");
    expect(detail.engine).toBe("3.0L");
    expect(detail.transmission).toBe("Automatic");
    expect(detail.bodyStyle).toBe("SUV");
    expect(detail.description).toContain("Line one");
    expect(detail.images).toEqual([
      "https://m.atcdn.co.uk/a/media/hero.jpg",
      "https://m.atcdn.co.uk/a/media/one.jpg",
    ]);
  });

  it("falls back to the search gateway for mileage and images when detail payload is empty", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            heading: {},
            gallery: { images: [] },
            overview: {},
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response("<html><body></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              searchResults: {
                listings: [
                  {
                    advertId: "202209029381504",
                    title: "2016 Porsche Boxster",
                    price: "£42,500",
                    vehicleLocation: "Leeds (13 miles)",
                    images: [
                      "https://m.atcdn.co.uk/a/media/{resize}/hero.jpg",
                      "https://m.atcdn.co.uk/a/media/{resize}/side.jpg",
                    ],
                    badges: [
                      { type: "MILEAGE", displayText: "18,000 miles" },
                      { type: "REGISTERED_YEAR", displayText: "2016 (16 reg)" },
                    ],
                  },
                ],
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const detail = await fetchAutoTraderDetail(
      "https://www.autotrader.co.uk/car-details/202209029381504",
    );

    expect(detail.title).toBe("2016 Porsche Boxster");
    expect(detail.price).toBe(42500);
    expect(detail.mileage).toBe(18000);
    expect(detail.mileageUnit).toBe("miles");
    expect(detail.location).toBe("Leeds (13 miles)");
    expect(detail.images).toEqual([
      "https://m.atcdn.co.uk/a/media/hero.jpg",
      "https://m.atcdn.co.uk/a/media/side.jpg",
    ]);
  });
});
