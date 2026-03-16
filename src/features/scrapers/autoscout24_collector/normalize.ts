import type {
  AS24ListingSummary,
  AS24DetailParsed,
  NormalizedListing,
  NormalizedLocation,
  CurrencyCode,
  ScrapeMeta,
} from "./types";
import { deriveSourceId } from "./id";
import { parseYearFromTitle, parseYearFromRegistration } from "./discover";

const COUNTRY_MAP: Record<string, string> = {
  D: "Germany", DE: "Germany",
  A: "Austria", AT: "Austria",
  B: "Belgium", BE: "Belgium",
  E: "Spain", ES: "Spain",
  F: "France", FR: "France",
  I: "Italy", IT: "Italy",
  L: "Luxembourg", LU: "Luxembourg",
  NL: "Netherlands",
  CH: "Switzerland",
};

/**
 * Normalize a listing from search summary + optional detail data.
 */
export function normalizeListing(input: {
  search: AS24ListingSummary;
  detail: AS24DetailParsed | null;
  meta: ScrapeMeta;
  targetMake: string;
}): NormalizedListing | null {
  const { search, detail, meta } = input;

  if (!isLuxuryCarListing({ make: search.make, title: search.title, targetMake: input.targetMake })) {
    return null;
  }

  const year = detail?.year ?? search.year ?? parseYearFromRegistration(search.firstRegistration) ?? parseYearFromTitle(search.title);
  if (!year || year < 1948 || year > new Date().getFullYear() + 2) return null;

  const model = detail?.model ?? search.model ?? parseModelFromTitle(search.title);
  if (!model) return null;

  const sourceId = deriveSourceId({ sourceId: search.id, sourceUrl: search.url });
  const location = parseLocation(
    detail?.location ?? search.location,
    detail?.country ?? search.country,
  );

  const askingPrice = detail?.price ?? search.price;
  const currency = parseCurrencyCode(detail?.currency ?? search.currency);

  const today = toUtcDateOnly(new Date());

  return {
    source: "AutoScout24",
    sourceId,
    sourceUrl: search.url,
    title: detail?.title ?? search.title,
    platform: "AUTO_SCOUT_24",
    sellerNotes: null,
    endTime: null,
    startTime: null,
    reserveStatus: null,
    finalPrice: null,
    locationString: buildLocationString(location),
    year,
    make: "Porsche",
    model,
    trim: detail?.trim ?? null,
    bodyStyle: detail?.bodyStyle ?? null,
    engine: detail?.engine ?? null,
    transmission: detail?.transmission ?? search.transmission ?? null,
    exteriorColor: detail?.exteriorColor ?? null,
    interiorColor: detail?.interiorColor ?? null,
    vin: detail?.vin ?? null,
    mileageKm: detail?.mileageKm ?? search.mileageKm ?? null,
    mileageUnitStored: "km",
    status: "active",
    reserveMet: null,
    listDate: today,
    saleDate: null,
    auctionDate: null,
    auctionHouse: "AutoScout24",
    descriptionText: detail?.description ?? null,
    photos: detail?.images ?? search.images,
    photosCount: (detail?.images ?? search.images).length,
    location,
    pricing: {
      hammerPrice: askingPrice,
      currentBid: askingPrice,
      bidCount: null,
      originalCurrency: currency,
      rawPriceText: null,
    },
    dataQualityScore: scoreDataQuality({
      year,
      model,
      listDate: today,
      country: location.country,
      photosCount: (detail?.images ?? search.images).length,
      hasPrice: askingPrice !== null && askingPrice > 0,
    }),
  };
}

/**
 * Normalize from search listing only (no detail fetch).
 */
export function normalizeFromSearch(input: {
  search: AS24ListingSummary;
  meta: ScrapeMeta;
  targetMake: string;
}): NormalizedListing | null {
  return normalizeListing({ ...input, detail: null });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export function isLuxuryCarListing(input: {
  make?: string | null;
  title?: string | null;
  targetMake: string;
}): boolean {
  const make = (input.make ?? "").toLowerCase();
  const title = (input.title ?? "").toLowerCase();
  const target = input.targetMake.toLowerCase();

  if (make.includes(target)) return true;
  if (title.includes(target)) return true;

  // Reject obvious non-matches
  const disallowed = ["replica", "kit car", "kit-car", "toy", "model car", "diecast", "poster"];
  for (const word of disallowed) {
    if (title.includes(word)) return false;
  }

  return false;
}

export function parseLocation(
  locationRaw: string | null,
  countryCode: string | null,
): NormalizedLocation {
  const country = mapCountryCodeToName(countryCode) ?? "Unknown";

  if (!locationRaw) {
    return { locationRaw: null, country, region: null, city: null, postalCode: null };
  }

  // AutoScout24 locations: "Berlin, Germany" or "München, Bayern" or "75000 Paris"
  const parts = locationRaw.split(",").map((p) => p.trim());
  const city = parts[0] || null;
  const region = parts.length > 1 ? parts[1] : null;

  // Extract postal code
  const postalMatch = locationRaw.match(/\b(\d{4,5})\b/);
  const postalCode = postalMatch ? postalMatch[1] : null;

  return { locationRaw, country, region, city, postalCode };
}

export function mapCountryCodeToName(code: string | null): string | null {
  if (!code) return null;
  return COUNTRY_MAP[code.toUpperCase()] ?? null;
}

export function buildLocationString(loc: NormalizedLocation): string | null {
  const parts: string[] = [];
  if (loc.city) parts.push(loc.city);
  if (loc.region) parts.push(loc.region);
  if (loc.country && loc.country !== "Unknown") parts.push(loc.country);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function parseCurrencyCode(raw: string | null): CurrencyCode | null {
  if (!raw) return "EUR";
  const upper = raw.toUpperCase().trim();
  if (upper === "EUR" || upper === "€") return "EUR";
  if (upper === "CHF" || upper === "FR.") return "CHF";
  if (upper === "GBP" || upper === "£") return "GBP";
  if (upper === "USD" || upper === "$") return "USD";
  return "EUR";
}

export function scoreDataQuality(input: {
  year: number | null;
  model: string | null;
  listDate: string | null;
  country: string | null;
  photosCount: number;
  hasPrice: boolean;
}): number {
  let score = 0;
  if (input.year && input.year >= 1948 && input.year <= new Date().getFullYear() + 2) score += 25;
  if (input.model && input.model.length > 0) score += 15;
  if (input.listDate) score += 25;
  if (input.country && input.country !== "Unknown") score += 15;
  if (input.photosCount > 0) score += 10;
  if (input.hasPrice) score += 10;
  return score;
}

function toUtcDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseModelFromTitle(title: string): string | null {
  const m = title.match(/\bPorsche\s+(\S+)/i);
  return m ? m[1] : null;
}
