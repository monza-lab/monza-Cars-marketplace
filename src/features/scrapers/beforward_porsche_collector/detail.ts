import * as cheerio from "cheerio";

import { fetchHtml, getDomainFromUrl, PerDomainRateLimiter, withRetry } from "./net";
import type { DetailParsed } from "./types";

export async function fetchAndParseDetail(input: {
  url: string;
  timeoutMs: number;
  limiter: PerDomainRateLimiter;
}): Promise<DetailParsed> {
  const domain = getDomainFromUrl(input.url);
  await input.limiter.waitForDomain(domain);
  const { value: html } = await withRetry(() => fetchHtml(input.url, input.timeoutMs), {
    retries: 5,
    baseDelayMs: 2000,
  });
  return parseDetailHtml(html);
}

export function parseDetailHtml(html: string): DetailParsed {
  const $ = cheerio.load(html);

  const ld = parseJsonLd($);
  const specs = parseSpecsTable($);
  const title = cleanText($("h1").first().text()) || cleanText($("title").text());
  const parsedTitle = parseMakeModelTrimYear(title);

  const features = parseFeatureList($, "FEATURES");
  const sellingPoints = parseFeatureList($, "SELLING POINTS");
  const images = parseGalleryImages(html, $);

  return {
    title,
    refNo: normalizeNullable(specs.get("Ref. No.")) ?? normalizeNullable(ld.sku),
    sourceStatus: normalizeNullable($("meta[name='ga_sale_status']").attr("content")) ?? null,
    schemaAvailability: normalizeNullable(ld.availability),
    schemaPriceUsd: parseNumber(ld.price),
    year: parsedTitle.year,
    make: parsedTitle.make,
    model: parsedTitle.model,
    trim: parsedTitle.trim,
    mileageKm: parseKm(specs.get("Mileage") ?? null),
    transmission: normalizeNullable(specs.get("Transmission")),
    engine: normalizeNullable(specs.get("Engine Size")),
    exteriorColor: normalizeNullable(specs.get("Ext. Color")),
    interiorColor: null,
    vin: normalizeNullable(specs.get("Chassis No.")),
    location: normalizeNullable(specs.get("Location")),
    fuel: normalizeNullable(specs.get("Fuel")),
    drive: normalizeNullable(specs.get("Drive")),
    doors: parseNumber(specs.get("Doors") ?? null),
    seats: parseNumber(specs.get("Seats") ?? null),
    modelCode: normalizeNullable(specs.get("Model Code")),
    chassisNo: normalizeNullable(specs.get("Chassis No.")),
    engineCode: normalizeNullable(specs.get("Engine Code")),
    subRefNo: normalizeNullable(specs.get("Sub Ref No")),
    features,
    sellingPoints,
    images,
  };
}

type JsonLdShape = {
  sku?: string;
  offers?: { price?: string | number; availability?: string };
};

function parseJsonLd($: cheerio.CheerioAPI): { sku: string | null; price: number | null; availability: string | null } {
  const scripts = $("script[type='application/ld+json']").toArray();
  for (const script of scripts) {
    const raw = $(script).text();
    if (!raw.includes("\"sku\"")) continue;
    try {
      const parsed = JSON.parse(raw) as JsonLdShape;
      const sku = normalizeNullable(parsed.sku);
      const availability = normalizeNullable(parsed.offers?.availability);
      const price = parseNumber(parsed.offers?.price);
      return { sku, price, availability };
    } catch {
      continue;
    }
  }
  return { sku: null, price: null, availability: null };
}

function parseSpecsTable($: cheerio.CheerioAPI): Map<string, string> {
  const map = new Map<string, string>();
  $("table.specification tr").each((_i, tr) => {
    const cells = $(tr).children("th,td").toArray();
    for (let i = 0; i < cells.length - 1; i++) {
      const keyCell = cells[i];
      if (keyCell.tagName?.toLowerCase() !== "th") continue;
      const valCell = cells[i + 1];
      const key = cleanText($(keyCell).text());
      const value = cleanText($(valCell).text());
      if (!key) continue;
      map.set(key, value);
      i++;
    }
  });
  return map;
}

function parseFeatureList($: cheerio.CheerioAPI, heading: string): string[] {
  const out: string[] = [];
  const section = $("p.list-title")
    .filter((_i, el) => cleanText($(el).text()).toUpperCase() === heading)
    .first()
    .closest("div.remarks");
  if (!section.length) return out;

  section.find("li").each((_i, li) => {
    const value = cleanText($(li).text());
    if (value) out.push(value);
  });
  return out;
}

function parseGalleryImages(html: string, $: cheerio.CheerioAPI): string[] {
  const out = new Set<string>();
  const match = html.match(/var\s+gallery_images\s*=\s*JSON\.parse\('([^']+)'\)/);
  if (match) {
    try {
      const raw = match[1].replace(/\\\//g, "/");
      const images = JSON.parse(raw) as string[];
      for (const image of images) {
        const normalized = toAbsoluteImageUrl(image);
        if (normalized) out.add(normalized);
      }
    } catch {
      // no-op
    }
  }

  $("input.fn-images-pc[data-path], input.fn-images-mobile[data-path]").each((_i, el) => {
    const p = $(el).attr("data-path");
    const normalized = toAbsoluteImageUrl(p ?? null);
    if (normalized) out.add(normalized);
  });

  return Array.from(out);
}

function toAbsoluteImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return null;
}

function parseMakeModelTrimYear(title: string): {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
} {
  const cleaned = cleanText(title);
  const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  const makeMatch = cleaned.match(/\bPORSCHE\b/i);
  const make = makeMatch ? "Porsche" : null;
  if (!make) return { year, make: null, model: null, trim: null };

  const afterMake = cleaned.split(/\bPORSCHE\b/i)[1]?.trim() ?? "";
  if (!afterMake) return { year, make, model: null, trim: null };

  const modelToken = afterMake.split(/\s+/)[0] ?? "";
  const model = modelToken ? modelToken : null;
  const trimRaw = afterMake.slice(modelToken.length).trim();
  return {
    year,
    make,
    model,
    trim: trimRaw || null,
  };
}

function parseKm(input: string | null | undefined): number | null {
  const text = normalizeNullable(input);
  if (!text) return null;
  const m = text.match(/([\d,]+)\s*km/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function parseNumber(input: string | number | null | undefined): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  const m = input.match(/\d[\d,]*/);
  if (!m) return null;
  const n = parseInt(m[0].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeNullable(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = cleanText(input);
  if (!v || v === "-" || v.toUpperCase() === "N/A") return null;
  return v;
}

function cleanText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}
