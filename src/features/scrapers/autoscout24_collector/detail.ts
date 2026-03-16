import type { Page } from "playwright-core";
import * as cheerio from "cheerio";

import type { AS24DetailParsed } from "./types";
import { isAkamaiChallenge, waitForChallengeResolution } from "./browser";

export interface DetailFetchOptions {
  page: Page;
  url: string;
  pageTimeoutMs: number;
  runId: string;
}

/**
 * Navigate to an AutoScout24 listing detail page and extract enriched data.
 */
export async function fetchAndParseDetail(opts: DetailFetchOptions): Promise<AS24DetailParsed> {
  await opts.page.goto(opts.url, {
    waitUntil: "domcontentloaded",
    timeout: opts.pageTimeoutMs,
  });

  // Wait for key content to render
  await opts.page.waitForSelector('[data-testid="listing-details"], .cl-detail, h1', { timeout: 10_000 }).catch(() => {});

  // Handle challenge pages
  if (await isAkamaiChallenge(opts.page)) {
    const resolved = await waitForChallengeResolution(opts.page, 15_000);
    if (!resolved) {
      throw new Error("Akamai challenge not resolved on detail page");
    }
    await opts.page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  }

  const html = await opts.page.content();
  return parseDetailHtml(html);
}

/**
 * Parse an AutoScout24 listing detail page HTML.
 */
export function parseDetailHtml(html: string): AS24DetailParsed {
  const $ = cheerio.load(html);

  // Try JSON-LD first (most reliable)
  const jsonLd = parseDetailJsonLd($);

  // Parse the specs table
  const specs = parseSpecsTable($);

  // Parse gallery images
  const images = parseGalleryImages($);

  // Title
  const title = $("h1").first().text().trim() ||
    $('[data-testid="listing-title"]').first().text().trim() ||
    jsonLd.title || "";

  // Price
  const priceText = $('[data-testid="price"], [class*="price-main"], .cl-detail-price').first().text().trim();
  const price = jsonLd.price ?? parsePrice(priceText);
  const currency = jsonLd.currency ?? detectCurrency(priceText);

  // Description
  const description = $('[data-testid="description"], .cl-detail-description, [class*="description"]').first().text().trim() || null;

  // Seller info
  const sellerName = $('[data-testid="dealer-name"], .cl-detail-vendor-name, [class*="dealer-name"]').first().text().trim() || null;
  const sellerType = $('[data-testid="dealer-type"], [class*="dealer-type"]').first().text().trim() || null;

  // Location
  const locationText = $('[data-testid="dealer-location"], [class*="dealer-location"], [class*="listing-location"]').first().text().trim() || null;

  // VIN
  const bodyText = $("body").text();
  const vinMatch = bodyText.match(/\bVIN\b[:\s]*([A-HJ-NPR-Z0-9]{17})\b/i);
  const vin = vinMatch ? vinMatch[1].toUpperCase() : null;

  // Features list
  const features: string[] = [];
  $('[data-testid*="feature"], .cl-detail-equipment li, [class*="equipment-list"] li').each((_, el) => {
    const text = $(el).text().trim();
    if (text) features.push(text);
  });

  return {
    title,
    price,
    currency,
    year: jsonLd.year ?? parseYear(specs.get("First registration")),
    make: jsonLd.make ?? specs.get("Make") ?? "Porsche",
    model: jsonLd.model ?? specs.get("Model") ?? null,
    trim: specs.get("Model variant") ?? specs.get("Trim") ?? null,
    mileageKm: jsonLd.mileageKm ?? parseMileage(specs.get("Mileage")),
    transmission: specs.get("Transmission") ?? specs.get("Gearbox") ?? null,
    fuelType: specs.get("Fuel type") ?? specs.get("Fuel") ?? null,
    engine: specs.get("Engine size") ?? specs.get("Displacement") ?? null,
    power: specs.get("Power") ?? specs.get("kW") ?? null,
    bodyStyle: specs.get("Body type") ?? specs.get("Body") ?? null,
    exteriorColor: specs.get("Exterior colour") ?? specs.get("Colour") ?? specs.get("Color") ?? null,
    interiorColor: specs.get("Interior colour") ?? specs.get("Upholstery colour") ?? null,
    vin,
    location: locationText,
    country: null,
    region: null,
    sellerType: sellerType || (sellerName ? "Dealer" : null),
    sellerName,
    description,
    images: images.length > 0 ? images : jsonLd.images,
    firstRegistration: specs.get("First registration") ?? null,
    features,
  };
}

/* ------------------------------------------------------------------ */
/*  JSON-LD Parsing                                                     */
/* ------------------------------------------------------------------ */

interface JsonLdData {
  title: string | null;
  price: number | null;
  currency: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileageKm: number | null;
  images: string[];
}

function parseDetailJsonLd($: cheerio.CheerioAPI): JsonLdData {
  const result: JsonLdData = { title: null, price: null, currency: null, year: null, make: null, model: null, mileageKm: null, images: [] };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "");
      if (!data || (data["@type"] !== "Car" && data["@type"] !== "Vehicle")) return;

      result.title = (data.name ?? null) as string | null;
      result.model = (data.model ?? null) as string | null;
      result.year = typeof data.modelDate === "string" ? parseInt(data.modelDate, 10) || null : null;

      const brand = data.brand as Record<string, unknown> | undefined;
      result.make = (brand?.name ?? null) as string | null;

      const offers = data.offers as Record<string, unknown> | undefined;
      if (offers?.price) result.price = Number(offers.price) || null;
      if (offers?.priceCurrency) result.currency = String(offers.priceCurrency);

      const mileage = data.mileageFromOdometer as Record<string, unknown> | undefined;
      if (mileage?.value) result.mileageKm = Number(mileage.value) || null;

      if (typeof data.image === "string") result.images.push(data.image);
      if (Array.isArray(data.image)) {
        for (const img of data.image) {
          if (typeof img === "string") result.images.push(img);
        }
      }
    } catch {
      // Invalid JSON-LD
    }
  });

  return result;
}

/* ------------------------------------------------------------------ */
/*  Specs Table Parsing                                                 */
/* ------------------------------------------------------------------ */

function parseSpecsTable($: cheerio.CheerioAPI): Map<string, string> {
  const specs = new Map<string, string>();

  // AutoScout24 uses dl/dt/dd or table rows for specs
  $('[data-testid*="details"] dt, .cl-detail-spec dt, [class*="key-value"] dt').each((_, el) => {
    const key = $(el).text().trim();
    const value = $(el).next("dd").text().trim();
    if (key && value && value !== "-") {
      specs.set(key, value);
    }
  });

  // Fallback: table rows
  if (specs.size === 0) {
    $("tr, [class*='spec-row']").each((_, el) => {
      const cells = $(el).find("td, th, [class*='key'], [class*='value']");
      if (cells.length >= 2) {
        const key = cells.eq(0).text().trim();
        const value = cells.eq(1).text().trim();
        if (key && value && value !== "-") {
          specs.set(key, value);
        }
      }
    });
  }

  return specs;
}

/* ------------------------------------------------------------------ */
/*  Gallery Images                                                      */
/* ------------------------------------------------------------------ */

function parseGalleryImages($: cheerio.CheerioAPI): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  $('[data-testid*="gallery"] img, .cl-detail-gallery img, [class*="gallery"] img, [class*="image-gallery"] img').each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    if (src && !seen.has(src) && (src.includes("autoscout24") || src.includes("as24") || src.startsWith("https://prod.pictures"))) {
      seen.add(src);
      images.push(src);
    }
  });

  // Fallback: all large images
  if (images.length === 0) {
    $("img[src]").each((_, el) => {
      const src = $(el).attr("src") ?? "";
      if (src && !seen.has(src) && (src.includes("autoscout24") || src.includes("as24") || src.startsWith("https://prod.pictures"))) {
        seen.add(src);
        images.push(src);
      }
    });
  }

  return images;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function parsePrice(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) || num === 0 ? null : num;
}

function detectCurrency(text: string): string | null {
  if (!text) return null;
  if (text.includes("CHF") || text.includes("Fr.")) return "CHF";
  if (text.includes("£") || text.includes("GBP")) return "GBP";
  if (text.includes("$") || text.includes("USD")) return "USD";
  return "EUR";
}

function parseYear(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.match(/((?:19|20)\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

function parseMileage(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) || num === 0 ? null : num;
}
