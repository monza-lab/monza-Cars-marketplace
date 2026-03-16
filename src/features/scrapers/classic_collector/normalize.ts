import type {
  ClassicComRawListing,
  DetailParsed,
  ListingSummary,
  NormalizedListing,
  NormalizedListingStatus,
  NormalizedLocation,
  ScrapeMeta,
} from "./types";
import { deriveSourceId, extractVinFromUrl, extractClassicComId } from "./id";

const MILES_TO_KM = 1.609344;

/* ------------------------------------------------------------------ */
/*  Main normalization                                                 */
/* ------------------------------------------------------------------ */

export function normalizeListing(input: {
  summary: ListingSummary;
  detail: DetailParsed;
  meta: ScrapeMeta;
}): NormalizedListing | null {
  const raw = input.detail.raw;
  const title = (raw.title || input.summary.title).trim();
  if (!title) return null;

  const year = raw.year ?? input.summary.year;
  if (!year) return null;

  const make = raw.make ?? input.summary.make ?? "Porsche";
  if (make.toLowerCase() !== "porsche") return null;

  const model = raw.model ?? input.summary.model ?? parseModelFromTitle(title);
  if (!model) return null;

  const vin = raw.vin ?? input.summary.vin ?? extractVinFromUrl(input.summary.sourceUrl);
  const classicComId = extractClassicComId(input.summary.sourceUrl);
  const sourceId = deriveSourceId({ vin, classicComId, sourceUrl: input.summary.sourceUrl });

  const location = parseUSLocation(raw.location ?? input.summary.location);
  const status = mapStatus(raw.saleResult, raw.status ?? input.summary.status);
  const auctionHouse = parseAuctionHouse(raw.auctionHouse ?? input.summary.auctionHouse);
  const listDate = toUtcDateOnly(new Date(input.meta.scrapeTimestamp));

  const price = raw.hammerPrice ?? raw.price ?? input.summary.price;
  const mileageKm = normalizeMileageToKm(
    raw.mileage ?? null,
    raw.mileageUnit ?? "miles",
  );

  const photos = raw.images ?? [];
  const finalPrice = status === "sold" ? price : null;
  const currentBid = price;

  return {
    source: "ClassicCom",
    sourceId,
    sourceUrl: input.summary.sourceUrl,
    title,
    platform: "CLASSIC_COM",
    sellerNotes: raw.description,
    endTime: raw.endTime ? new Date(raw.endTime) : null,
    startTime: raw.startTime ? new Date(raw.startTime) : null,
    reserveStatus: raw.reserveStatus,
    finalPrice,
    locationString: buildLocationString(location),
    year,
    make,
    model,
    trim: raw.trim ?? null,
    bodyStyle: raw.bodyStyle ?? null,
    engine: raw.engine ?? null,
    transmission: raw.transmission ?? null,
    exteriorColor: raw.exteriorColor ?? null,
    interiorColor: raw.interiorColor ?? null,
    vin,
    mileageKm,
    mileageUnitStored: "km",
    status,
    reserveMet: null,
    listDate,
    saleDate: status === "sold" ? (raw.auctionDate ?? listDate) : null,
    auctionDate: raw.auctionDate ?? null,
    auctionHouse,
    descriptionText: raw.description,
    photos,
    photosCount: photos.length,
    location,
    pricing: {
      hammerPrice: finalPrice,
      currentBid,
      bidCount: raw.bidCount ?? null,
      originalCurrency: price ? "USD" : null,
      rawPriceText: price ? `$${price.toLocaleString("en-US")}` : null,
    },
    dataQualityScore: scoreDataQuality({
      year,
      model,
      vin,
      auctionHouse,
      saleDate: status === "sold" ? (raw.auctionDate ?? listDate) : null,
      country: location.country,
      photosCount: photos.length,
      hasPrice: price !== null && price > 0,
    }),
  };
}

export function normalizeListingFromSummary(input: {
  summary: ListingSummary;
  meta: ScrapeMeta;
}): NormalizedListing | null {
  const title = input.summary.title.trim();
  if (!title) {
    console.warn(`[classic:normalize] Skipped: no title | url=${input.summary.sourceUrl}`);
    return null;
  }

  const year = input.summary.year ?? parseYearFromTitle(title);
  const make = input.summary.make ?? parseMakeFromTitle(title) ?? "Porsche";
  if (make.toLowerCase() !== "porsche") {
    console.warn(`[classic:normalize] Skipped: make="${make}" not Porsche | title="${title}"`);
    return null;
  }

  const model = input.summary.model ?? parseModelFromTitle(title) ?? parseModelFromTitleBroad(title);
  if (!year || !model) {
    console.warn(`[classic:normalize] Skipped: year=${year} model=${model} | title="${title}" url=${input.summary.sourceUrl}`);
    return null;
  }

  const vin = input.summary.vin ?? extractVinFromUrl(input.summary.sourceUrl);
  const classicComId = extractClassicComId(input.summary.sourceUrl);
  const sourceId = deriveSourceId({ vin, classicComId, sourceUrl: input.summary.sourceUrl });

  const location = parseUSLocation(null);
  const auctionHouse = parseAuctionHouse(input.summary.auctionHouse);
  const listDate = toUtcDateOnly(new Date(input.meta.scrapeTimestamp));
  const price = input.summary.price;

  return {
    source: "ClassicCom",
    sourceId,
    sourceUrl: input.summary.sourceUrl,
    title,
    platform: "CLASSIC_COM",
    sellerNotes: null,
    endTime: null,
    startTime: null,
    reserveStatus: null,
    finalPrice: null,
    locationString: buildLocationString(location),
    year,
    make,
    model,
    trim: null,
    bodyStyle: null,
    engine: null,
    transmission: null,
    exteriorColor: null,
    interiorColor: null,
    vin,
    mileageKm: null,
    mileageUnitStored: "km",
    status: "active",
    reserveMet: null,
    listDate,
    saleDate: null,
    auctionDate: null,
    auctionHouse,
    descriptionText: null,
    photos: [],
    photosCount: 0,
    location,
    pricing: {
      hammerPrice: null,
      currentBid: price,
      bidCount: null,
      originalCurrency: price ? "USD" : null,
      rawPriceText: price ? `$${price.toLocaleString("en-US")}` : null,
    },
    dataQualityScore: scoreDataQuality({
      year,
      model,
      vin,
      auctionHouse,
      saleDate: null,
      country: location.country,
      photosCount: 0,
      hasPrice: price !== null && price > 0,
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  Status mapping                                                     */
/* ------------------------------------------------------------------ */

export function mapStatus(
  saleResult: string | null,
  statusRaw: string | null,
): NormalizedListingStatus {
  const result = (saleResult ?? "").trim().toLowerCase();
  const st = (statusRaw ?? "").trim().toLowerCase();

  if (result === "sold" || st === "sold") return "sold";
  if (result === "not_sold" || result === "not sold" || result === "unsold") return "unsold";
  if (result === "bid_to" || result === "bid to") return "active";
  if (st === "active" || st === "forsale" || st === "for_sale" || st === "for sale") return "active";
  if (st === "ended" || st === "withdrawn" || st === "removed") return "delisted";

  return "active";
}

/* ------------------------------------------------------------------ */
/*  US location parsing                                                */
/* ------------------------------------------------------------------ */

const US_STATE_MAP: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

// Reverse map: full state name (lowercase) → abbreviation
const US_STATE_NAME_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_MAP).map(([abbr, name]) => [name.toLowerCase(), abbr]),
);

export function parseUSLocation(locationRaw: string | null | undefined): NormalizedLocation {
  const raw = (locationRaw ?? "").trim();
  if (!raw) {
    return { locationRaw: null, country: "US", region: null, city: null, postalCode: null };
  }

  let postalCode: string | null = null;
  const zipMatch = raw.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) postalCode = zipMatch[1];

  // Strip trailing ", USA" or ", US" (classic.com appends this)
  const cleaned = raw.replace(/,\s*USA?\s*$/i, "").trim();

  // Try "City, ST" or "City, ST ZIP" pattern (2-letter abbreviation)
  const cityAbbrMatch = cleaned.match(/^([^,]+),\s*([A-Z]{2})\b/i);
  if (cityAbbrMatch) {
    const city = cityAbbrMatch[1].trim();
    const stateAbbr = cityAbbrMatch[2].toUpperCase();
    const region = US_STATE_MAP[stateAbbr] ?? null;
    return {
      locationRaw: raw,
      country: "US",
      region,
      city,
      postalCode,
    };
  }

  // Try "City, Full State Name" (classic.com format: "Miami, Florida, USA")
  const cityFullStateMatch = cleaned.match(/^([^,]+),\s*(.+)$/);
  if (cityFullStateMatch) {
    const city = cityFullStateMatch[1].trim();
    const stateCandidate = cityFullStateMatch[2].trim().toLowerCase();
    if (US_STATE_NAME_MAP[stateCandidate]) {
      return {
        locationRaw: raw,
        country: "US",
        region: US_STATE_MAP[US_STATE_NAME_MAP[stateCandidate]],
        city,
        postalCode,
      };
    }
  }

  // Try just a state abbreviation
  const stateOnly = raw.toUpperCase().trim();
  if (US_STATE_MAP[stateOnly]) {
    return {
      locationRaw: raw,
      country: "US",
      region: US_STATE_MAP[stateOnly],
      city: null,
      postalCode,
    };
  }

  return { locationRaw: raw, country: "US", region: null, city: raw, postalCode };
}

/* ------------------------------------------------------------------ */
/*  Auction house name normalization                                   */
/* ------------------------------------------------------------------ */

const AUCTION_HOUSE_MAP: Record<string, string> = {
  "bring a trailer": "Bring a Trailer",
  "bat": "Bring a Trailer",
  "bringatrailer": "Bring a Trailer",
  "rm sotheby's": "RM Sotheby's",
  "rm sothebys": "RM Sotheby's",
  "rmsothebys": "RM Sotheby's",
  "mecum": "Mecum Auctions",
  "mecum auctions": "Mecum Auctions",
  "gooding": "Gooding & Company",
  "gooding & company": "Gooding & Company",
  "gooding and company": "Gooding & Company",
  "bonhams": "Bonhams",
  "pcarmarket": "PCarMarket",
  "cars and bids": "Cars & Bids",
  "cars & bids": "Cars & Bids",
  "carsandbids": "Cars & Bids",
  "hemmings": "Hemmings",
  "barrett-jackson": "Barrett-Jackson",
  "barrett jackson": "Barrett-Jackson",
  "collecting cars": "Collecting Cars",
  "collectingcars": "Collecting Cars",
  "elferspot": "Elferspot",
  "autotrader": "AutoTrader",
  "ebay": "eBay",
  "ebay motors": "eBay Motors",
  "dupont registry": "duPont Registry",
  "classic driver": "Classic Driver",
  "broad arrow": "Broad Arrow",
  "rm sotheby": "RM Sotheby's",
  "gooding &": "Gooding & Company",
  "gooding and": "Gooding & Company",
  "mecum ": "Mecum Auctions",
  "barrett-jackson ": "Barrett-Jackson",
  "barrett jackson ": "Barrett-Jackson",
  "bonhams ": "Bonhams",
  "collecting cars ": "Collecting Cars",
};

export function parseAuctionHouse(raw: string | null | undefined): string {
  if (!raw) return "Classic.com";
  const trimmed = raw.trim();
  if (!trimmed) return "Classic.com";

  // Exact match first
  const key = trimmed.toLowerCase();
  if (AUCTION_HOUSE_MAP[key]) return AUCTION_HOUSE_MAP[key];

  // Partial match: "Barrett-Jackson Las Vegas (2016)" → "Barrett-Jackson"
  for (const [pattern, canonical] of Object.entries(AUCTION_HOUSE_MAP)) {
    if (key.startsWith(pattern)) return canonical;
  }

  return trimmed;
}

/* ------------------------------------------------------------------ */
/*  Mileage conversion                                                 */
/* ------------------------------------------------------------------ */

export function normalizeMileageToKm(
  mileage: number | null,
  unit: string | null,
): number | null {
  if (mileage === null || mileage < 0) return null;
  const u = (unit ?? "miles").toLowerCase();
  if (u === "km" || u === "kilometers") return Math.round(mileage);
  return Math.round(mileage * MILES_TO_KM);
}

/* ------------------------------------------------------------------ */
/*  Data quality scoring                                               */
/* ------------------------------------------------------------------ */

export function scoreDataQuality(input: {
  year: number | null;
  model: string | null;
  vin: string | null;
  auctionHouse: string | null;
  saleDate: string | null;
  country: string | null;
  photosCount: number;
  hasPrice: boolean;
}): number {
  let score = 0;
  if (input.year && input.year >= 1900) score += 15;
  if (input.model && input.model.trim().length > 0) score += 10;
  if (input.vin && input.vin.length === 17) score += 15;
  if (input.auctionHouse && input.auctionHouse !== "Unknown" && input.auctionHouse !== "Classic.com") score += 10;
  if (input.saleDate) score += 15;
  if (input.country && input.country !== "Unknown") score += 10;
  if (input.photosCount > 0) score += 15;
  if (input.hasPrice) score += 10;
  return Math.max(0, Math.min(100, score));
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseYearFromTitle(title: string): number | null {
  const m = title.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function parseMakeFromTitle(title: string): string | null {
  const m = title.match(/\b(Porsche|Ferrari|BMW|Mercedes|Lamborghini)\b/i);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : null;
}

function parseModelFromTitle(title: string): string | null {
  const cleaned = title.replace(/\s+/g, " ").trim();
  const m = cleaned.match(/\bPorsche\s+(\S+)/i);
  return m ? m[1] : null;
}

/**
 * Broader model extraction: strips year and make, takes up to 3 words.
 * Handles titles like "1973 Porsche 911 Carrera RS" → "911 Carrera RS"
 * or "2024 911 GT3" → "911 GT3"
 */
function parseModelFromTitleBroad(title: string): string | null {
  const cleaned = title
    .replace(/\b(19|20)\d{2}\b/, "")    // strip year
    .replace(/\bPorsche\b/i, "")         // strip make
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const words = cleaned.split(/\s+/).slice(0, 3).join(" ");
  return words || null;
}

export function toUtcDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildLocationString(loc: NormalizedLocation): string | null {
  const parts = [loc.city, loc.region, loc.country].filter(
    (p): p is string => typeof p === "string" && p.length > 0 && p !== "Unknown",
  );
  return parts.length > 0 ? parts.join(", ") : null;
}
