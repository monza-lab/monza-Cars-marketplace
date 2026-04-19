import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAutoTraderDetail, parseAutoTraderHtml } from "./detail";
import { extractAutoTraderImages } from "./imageUrls";

beforeEach(() => {
  vi.restoreAllMocks();
});

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

  it("extracts and normalizes the gallery from a recorded fixture", () => {
    const html = readFileSync(
      resolve(process.cwd(), "tests/fixtures/autotrader-gallery-detail.html"),
      "utf8",
    );

    const images = extractAutoTraderImages(html);

    expect(images).toEqual([
      "https://m.atcdn.co.uk/a/media/hero.jpg",
      "https://m.atcdn.co.uk/a/media/one.jpg",
      "https://m.atcdn.co.uk/a/media/two.jpg",
      "https://m.atcdn.co.uk/a/media/three.jpg",
    ]);

    const parsed = parseAutoTraderHtml(html);
    expect(parsed.images).toEqual(images);
  });

  it("ignores non-photo AutoTrader assets that are not gallery media", () => {
    const html = `
      <html><body>
        <img src="https://apm-assets.prod.atcdn.co.uk/elastic-apm-rum.umd.min.js" />
        <img src="https://m.atcdn.co.uk/a/media/hero.jpg" />
      </body></html>
    `;

    expect(extractAutoTraderImages(html)).toEqual([
      "https://m.atcdn.co.uk/a/media/hero.jpg",
    ]);
  });

  it("prefers the live product-page gallery when available", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            heading: { title: "2020 Porsche 911 Carrera S" },
            gallery: {
              images: [
                {
                  url: "https://m.atcdn.co.uk/a/media/{resize}/hero.jpg",
                },
                {
                  url: "https://m.atcdn.co.uk/a/media/{resize}/one.jpg",
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response("<html><body><h1>Fallback title</h1></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );

    const result = await fetchAutoTraderDetail(
      "https://www.autotrader.co.uk/car-details/202602099784872",
    );

    expect(result.title).toBe("Fallback title");
    expect(result.images).toEqual([
      "https://m.atcdn.co.uk/a/media/hero.jpg",
      "https://m.atcdn.co.uk/a/media/one.jpg",
    ]);
  });
});
