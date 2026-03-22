import * as cheerio from "cheerio";
import { fetchHtml } from "./net";

export interface AutoTraderDetailParsed {
  title: string | null;
  price: number | null;
  priceText: string | null;
  mileage: number | null;
  mileageUnit: string | null;
  location: string | null;
  description: string | null;
  images: string[];
  vin: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  transmission: string | null;
  engine: string | null;
  bodyStyle: string | null;
}

/**
 * Fetch an AutoTrader listing detail page and extract structured data via Cheerio.
 * Returns all-null fields on any error (does not throw).
 */
export async function fetchAutoTraderDetail(
  url: string,
  timeoutMs = 15_000
): Promise<AutoTraderDetailParsed> {
  const empty: AutoTraderDetailParsed = {
    title: null, price: null, priceText: null, mileage: null, mileageUnit: null,
    location: null, description: null, images: [], vin: null, exteriorColor: null,
    interiorColor: null, transmission: null, engine: null, bodyStyle: null,
  };

  try {
    const html = await fetchHtml(url, timeoutMs);
    return parseAutoTraderHtml(html);
  } catch {
    return empty;
  }
}

/** Parse AutoTrader HTML into structured fields. Exported for testing. */
export function parseAutoTraderHtml(html: string): AutoTraderDetailParsed {
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim()
    || $('[data-testid="vehicle-title"]').first().text().trim()
    || null;

  const priceText = $('[data-testid="price"]').first().text().trim()
    || $(".price").first().text().trim()
    || $('[class*="price"]').first().text().trim()
    || null;
  const price = priceText ? parsePrice(priceText) : null;

  const mileageText = $('[data-testid="mileage"]').first().text().trim()
    || $('[class*="mileage"]').first().text().trim()
    || null;
  const mileage = mileageText ? parseMileage(mileageText) : null;
  const mileageUnit = mileageText?.toLowerCase().includes("km") ? "km" : "miles";

  const location = $('[data-testid="location"]').first().text().trim()
    || $('[class*="location"]').first().text().trim()
    || null;

  const description = $('[data-testid="description"]').first().text().trim()
    || $('[class*="description"]').first().text().trim()
    || null;

  const transmission = $('[data-testid="transmission"]').first().text().trim()
    || $('[class*="transmission"]').first().text().trim()
    || null;

  const engine = $('[data-testid="engine"]').first().text().trim()
    || $('[class*="engine"]').first().text().trim()
    || null;

  const exteriorColor = $('[data-testid="exterior-color"]').first().text().trim()
    || $('[class*="exterior"]').first().text().trim()
    || null;

  // VIN: search full body text for 17-char ISO VIN pattern
  const bodyText = $("body").text();
  const vinMatch = bodyText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
  const vin = vinMatch ? vinMatch[0].toUpperCase() : null;

  // Images: collect up to 20 image URLs
  const images: string[] = [];
  $("img").each((_, el) => {
    if (images.length >= 20) return false;
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src && src.includes("autotrader")) {
      images.push(src);
    }
  });

  return {
    title: title || null,
    price,
    priceText: priceText || null,
    mileage,
    mileageUnit: mileage ? mileageUnit : null,
    location: location || null,
    description: description || null,
    images,
    vin,
    exteriorColor: exteriorColor || null,
    interiorColor: null, // Not available on AutoTrader pages
    transmission: transmission || null,
    engine: engine || null,
    bodyStyle: null, // Not available on AutoTrader pages
  };
}

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num === 0 ? null : num;
}

function parseMileage(text: string): number | null {
  const cleaned = text.replace(/[^0-9]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}
