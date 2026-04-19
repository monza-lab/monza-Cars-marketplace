import * as cheerio from "cheerio";
import { fetchHtml } from "./net";
import { extractAutoTraderImages, normalizeAutoTraderImageUrl } from "./imageUrls";

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

interface AutoTraderProductPageImage {
  url?: string | null;
  classificationTags?: Array<{
    label?: string | null;
    category?: string | null;
  }> | null;
}

interface AutoTraderProductPagePayload {
  id?: string | null;
  gallery?: {
    title?: string | null;
    price?: string | null;
    images?: AutoTraderProductPageImage[] | null;
  } | null;
  heading?: {
    title?: string | null;
  } | null;
}

function extractAdvertId(url: string): string | null {
  const match = url.match(/\/car-details\/(\d+)(?:[/?#]|$)/i);
  return match?.[1] ?? null;
}

async function fetchAutoTraderProductPageGallery(
  url: string,
  timeoutMs: number,
): Promise<{ title: string | null; images: string[] }> {
  const advertId = extractAdvertId(url);
  if (!advertId) return { title: null, images: [] };

  const endpoint = new URL(`https://www.autotrader.co.uk/product-page/v1/advert/${advertId}`);
  endpoint.searchParams.set("channel", "cars");
  endpoint.searchParams.set("postcode", "SW1A 1AA");

  const response = await fetch(endpoint.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: url,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    return { title: null, images: [] };
  }

  const payload = (await response.json()) as AutoTraderProductPagePayload;
  const title = payload.heading?.title?.trim() || payload.gallery?.title?.trim() || null;
  const images = (payload.gallery?.images ?? [])
    .map((image) => image?.url ?? null)
    .map((image) => (typeof image === "string" ? normalizeAutoTraderImageUrl(image) : null))
    .filter((image): image is string => image !== null);

  return { title, images };
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
    const [gallery, html] = await Promise.all([
      fetchAutoTraderProductPageGallery(url, timeoutMs),
      fetchHtml(url, timeoutMs).catch(() => null),
    ]);

    if (html) {
      const parsed = parseAutoTraderHtml(html);
      return {
        ...parsed,
        title: parsed.title ?? gallery.title,
        images: gallery.images.length > 0 ? gallery.images : parsed.images,
      };
    }

    return {
      ...empty,
      title: gallery.title,
      images: gallery.images,
    };
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

  const images = extractAutoTraderImages(html);

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
