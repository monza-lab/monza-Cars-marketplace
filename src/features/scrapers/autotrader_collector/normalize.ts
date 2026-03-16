import crypto from "node:crypto";

import type {
  CurrencyCode,
  NormalizedListingStatus,
  NormalizedLocation,
  PlatformEnum,
  SourceKey,
} from "./types";

// UK-specific patterns
const UK_POSTCODE_PATTERN = /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})\b/i;
const UK_REGION_PATTERN = /\b(england|scotland|wales|northern ireland|great britain|london|manchester|birmingham|leeds|glasgow|liverpool|bristol|edinburgh|belfast)\b/i;

// Disallowed title words for filtering non-genuine listings
const DISALLOWED_TITLE_WORDS = [
  /\breplica\b/i,
  /\btribute\b/i,
  /\bkit\b/i,
  /\brebody\b/i,
  /\bposter\b/i,
  /\bmodel\s*car\b/i,
  /\btoy\b/i,
  /\bwheel\b/i,
  /\bengine\b/i,
  /\bluggage\b/i,
  /\bscale\s*model\b/i,
  /\bmemorabilia\b/i,
];

// UK regions for mapping
const UK_REGIONS = new Set([
  "England",
  "Scotland",
  "Wales",
  "Northern Ireland",
  "Greater London",
  "South East",
  "South West",
  "East of England",
  "East Midlands",
  "West Midlands",
  "Yorkshire and the Humber",
  "North West",
  "North East",
]);

/**
 * Check if listing is a Porsche listing
 */
export function isPorscheListing(input: { make?: string | null; title?: string | null }): boolean {
  return isLuxuryCarListing({ ...input, targetMake: "Porsche" });
}

/**
 * Generic luxury car filter - checks if listing matches target make
 */
export function isLuxuryCarListing(input: {
  make?: string | null;
  title?: string | null;
  targetMake: string;
}): boolean {
  const title = (input.title ?? "").trim();
  const make = (input.make ?? "").trim();
  const target = input.targetMake.trim();

  if (!target) return false;

  const makePattern = new RegExp(`^${escapeRegex(target)}$`, "i");
  const titlePattern = new RegExp(`\\b${escapeRegex(target)}\\b`, "i");

  const makeMatches = make.length > 0 && makePattern.test(make);
  const titleMatches = titlePattern.test(title);

  if (!makeMatches && !titleMatches) return false;

  // Filter out non-genuine listings
  for (const re of DISALLOWED_TITLE_WORDS) {
    if (re.test(title)) return false;
  }

  return true;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalize mileage to km
 * UK uses km as standard, but we handle both miles and km
 */
export function normalizeMileageToKm(mileage: number | null | undefined, unit: string | null | undefined): number | null {
  if (mileage === null || mileage === undefined) return null;
  if (!Number.isFinite(mileage) || mileage < 0) return null;

  const u = (unit ?? "").toLowerCase();
  if (u.includes("km")) return Math.round(mileage);
  if (u.includes("mile") || u === "mi" || u.includes("miles")) {
    return Math.round(mileage * 1.609344);
  }
  // Default to km for UK market
  return Math.round(mileage);
}

/**
 * Parse currency from price text
 * UK market primarily uses GBP
 */
export function parseCurrencyFromText(text: string | null | undefined): CurrencyCode | null {
  if (!text) return null;
  const t = text.trim();
  if (t.includes("£") || /\bGBP\b/i.test(t)) return "GBP";
  if (t.includes("$") || /\bUSD\b/i.test(t)) return "USD";
  if (t.includes("€") || /\bEUR\b/i.test(t)) return "EUR";
  if (/\bJPY\b/i.test(t) || /\b¥\b/.test(t)) return "JPY";
  if (/\bCHF\b/i.test(t)) return "CHF";
  // Default to GBP for UK market
  return "GBP";
}

/**
 * Map AutoTrader listing status to normalized status
 * AutoTrader is a classifieds platform, not auction-based
 */
export function mapAuctionStatus(input: {
  sourceStatus?: string | null;
  rawPriceText?: string | null;
  isActive?: boolean;
  priceIndicator?: string | null;
}): NormalizedListingStatus {
  const status = (input.sourceStatus ?? "").toUpperCase();
  const priceText = input.rawPriceText ?? "";

  // Check for sold indicators in price text first
  if (/\b(sold|reserved|under offer|pending)\b/i.test(priceText)) {
    return "sold";
  }

  // AutoTrader specific statuses
  if (status === "ACTIVE" || status === "LIVE") return "active";
  if (status === "SOLD") return "sold";
  if (status === "WITHDRAWN" || status === "DELETED" || status === "EXPIRED") return "delisted";

  // AutoTrader price indicators
  const priceIndicator = input.priceIndicator?.toLowerCase();
  if (priceIndicator === "great-price" || priceIndicator === "great price") {
    return "active"; // Great price = still available
  }
  if (priceIndicator === "good-price" || priceIndicator === "good price") {
    return "active"; // Good price = still available
  }
  // Fair price and no indicator = active listing

  // Default for classifieds: if it's listed, it's active
  if (input.isActive !== false) return "active";

  return "unsold";
}

/**
 * Parse UK location - handles postcodes, regions, and cities
 */
export function parseLocation(locationRaw: string | null | undefined): NormalizedLocation {
  const raw = (locationRaw ?? "").trim();
  if (!raw) {
    return {
      locationRaw: null,
      country: "Unknown",
      region: null,
      city: null,
      postalCode: null,
    };
  }

  // Extract UK postcode
  const postcodeMatch = raw.match(UK_POSTCODE_PATTERN);
  const postalCode = postcodeMatch ? postcodeMatch[1].toUpperCase() : null;

  // Check for UK region indicators
  const regionMatch = raw.match(UK_REGION_PATTERN);
  const region = regionMatch ? capitalizeRegion(regionMatch[1]) : null;

  // Parse "City, Region" or "City, Region, UK" patterns
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);

  // Handle UK location patterns
  if (/\b(uk|united kingdom|england|scotland|wales|northern ireland|great britain)\b/i.test(raw)) {
    // "City, Region, UK" or just "City, UK"
    const city = parts[0] || null;
    const regionFromParts = parts.length >= 2 && !parts[1]?.match(/uk/i) ? parts[1] : region;

    return {
      locationRaw: raw,
      country: "UK",
      region: regionFromParts,
      city,
      postalCode,
    };
  }

  // Handle "City, Region" pattern (UK)
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    // Check if last part is a country or region
    if (UK_REGIONS.has(capitalizeRegion(lastPart) ?? "") || region) {
      return {
        locationRaw: raw,
        country: "UK",
        region: capitalizeRegion(parts[1]) || region,
        city: parts[0],
        postalCode,
      };
    }
  }

  // Single token - could be city or region
  if (parts.length === 1) {
    const part = parts[0];
    // Check if it's a known UK region
    if (UK_REGIONS.has(capitalizeRegion(part) ?? "")) {
      return {
        locationRaw: raw,
        country: "UK",
        region: capitalizeRegion(part),
        city: null,
        postalCode,
      };
    }
    // Otherwise treat as city
    return {
      locationRaw: raw,
      country: "UK",
      region: null,
      city: part,
      postalCode,
    };
  }

  // Default: assume UK if no country specified
  return {
    locationRaw: raw,
    country: "UK",
    region,
    city: parts[0] || null,
    postalCode,
  };
}

/**
 * Capitalize region name for consistency
 */
function capitalizeRegion(region: string): string | null {
  if (!region) return null;
  const r = region.toLowerCase();
  
  const regionMap: Record<string, string> = {
    "england": "England",
    "scotland": "Scotland",
    "wales": "Wales",
    "northern ireland": "Northern Ireland",
    "great britain": "Great Britain",
    "london": "Greater London",
    "manchester": "Greater Manchester",
    "birmingham": "West Midlands",
    "leeds": "West Yorkshire",
    "glasgow": "Scotland",
    "liverpool": "Merseyside",
    "bristol": "South West",
    "edinburgh": "Scotland",
    "belfast": "Northern Ireland",
  };

  // Check for known region first
  if (regionMap[r]) return regionMap[r];

  // For multi-word regions like "Greater Manchester", "West Yorkshire"
  // capitalize each word
  return region.split(" ").map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(" ");
}

/**
 * Parse year from title string
 */
export function parseYearFromTitle(title: string): number | null {
  const m = title.match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const maxYear = new Date().getUTCFullYear() + 1;
  if (year < 1900 || year > maxYear) return null;
  return year;
}

/**
 * Convert date to UTC date string (YYYY-MM-DD)
 */
export function toUtcDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Calculate data quality score
 */
export function scoreDataQuality(input: {
  year: number | null;
  model: string | null;
  listDate: string | null;
  country: string | null;
  photosCount: number;
  hasPrice: boolean;
}): number {
  let score = 0;
  if (input.year && input.year >= 1900) score += 25;
  if (input.model && input.model.trim().length > 0) score += 15;
  if (input.listDate) score += 25;
  if (input.country && input.country !== "Unknown") score += 15;
  if (input.photosCount > 0) score += 10;
  if (input.hasPrice) score += 10;
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate SHA256 hash
 */
export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Normalize source to auction house name
 */
export function normalizeSourceAuctionHouse(source: SourceKey): string {
  switch (source) {
    case "AutoTrader":
      return "AutoTrader UK";
  }
}

/**
 * Map source to platform enum
 */
export function mapSourceToPlatform(source: SourceKey): PlatformEnum {
  switch (source) {
    case "AutoTrader":
      return "AUTO_TRADER";
  }
}

/**
 * Build location string from normalized location
 */
export function buildLocationString(loc: NormalizedLocation): string | null {
  const parts = [loc.city, loc.region, loc.country].filter(
    (p): p is string => typeof p === "string" && p.length > 0 && p !== "Unknown",
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Parse price indicator from AutoTrader
 * AutoTrader shows "Great Price", "Good Price", "Fair Price" indicators
 */
export function parsePriceIndicator(indicator: string | null | undefined): string | null {
  if (!indicator) return null;
  const i = indicator.toLowerCase().replace(/[\s-]+/g, "");
  if (i === "greatprice" || i === "great") return "great-price";
  if (i === "goodprice" || i === "good") return "good-price";
  if (i === "fairprice" || i === "fair") return "fair-price";
  return null;
}

/**
 * Check if price is a "good deal" based on AutoTrader indicators
 */
export function isGoodDeal(priceIndicator: string | null | undefined): boolean {
  const indicator = parsePriceIndicator(priceIndicator);
  return indicator === "great-price" || indicator === "good-price";
}
