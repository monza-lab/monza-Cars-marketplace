import crypto from "node:crypto";

import type {
  CurrencyCode,
  NormalizedListingStatus,
  NormalizedLocation,
  PlatformEnum,
  ReserveStatusEnum,
  SourceKey,
} from "./types";

const FERRARI_WORD = /\bferrari\b/i;
const DISALLOWED_TITLE_WORDS = [
  // NOTE: Dino removed — Ferrari Dino 246 GT/GTS, 308 GT4 are genuine Ferraris
  /\breplica\b/i,
  /\btribute\b/i,
  /\bkit\b/i,
  /\brebody\b/i,
  /\bferrari-powered\b/i,
  /\bposter\b/i,
  /\bmodel\s*car\b/i,
  /\btoy\b/i,
  /\bwheel\b/i,
  /\bengine\b/i,
  /\bluggage\b/i,
  /\bscale\s*model\b/i,
  /\bmemorabilia\b/i,
  /\bferrari\s+(?:movie|film|documentary)\b/i, // e.g. "Peugeot from Ferrari Movie"
];

const US_STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

export function isFerrariListing(input: { make?: string | null; title?: string | null }): boolean {
  return isLuxuryCarListing({ ...input, targetMake: "Ferrari" });
}

export function isLuxuryCarListing(input: {
  make?: string | null;
  title?: string | null;
  targetMake: string;
}): boolean {
  const title = (input.title ?? "").trim();
  const make = (input.make ?? "").trim();
  const target = input.targetMake.trim();

  const makePattern = new RegExp(`^${escapeRegex(target)}$`, "i");
  const titlePattern = new RegExp(`\\b${escapeRegex(target)}\\b`, "i");

  const makeMatches = make.length > 0 && makePattern.test(make);
  const titleMatches = titlePattern.test(title);

  if (!makeMatches && !titleMatches) return false;

  for (const re of DISALLOWED_TITLE_WORDS) {
    if (re.test(title)) return false;
  }

  return true;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeMileageToKm(mileage: number | null | undefined, unit: string | null | undefined): number | null {
  if (mileage === null || mileage === undefined) return null;
  if (!Number.isFinite(mileage) || mileage < 0) return null;

  const u = (unit ?? "").toLowerCase();
  if (u.includes("km")) return Math.round(mileage);
  if (u.includes("mile") || u === "mi" || u.includes("miles")) {
    return Math.round(mileage * 1.609344);
  }
  // Unknown unit: assume miles if source is US-centric? Don't guess.
  return null;
}

export function parseCurrencyFromText(text: string | null | undefined): CurrencyCode | null {
  if (!text) return null;
  const t = text.trim();
  if (t.includes("$") || /\bUSD\b/i.test(t)) return "USD";
  if (t.includes("£") || /\bGBP\b/i.test(t)) return "GBP";
  if (t.includes("€") || /\bEUR\b/i.test(t)) return "EUR";
  if (/\bJPY\b/i.test(t) || /\b¥\b/.test(t)) return "JPY";
  if (/\bCHF\b/i.test(t)) return "CHF";
  return null;
}

export function mapAuctionStatus(input: {
  sourceStatus: string | null | undefined;
  rawPriceText?: string | null;
  currentBid?: number | null;
  endTime?: Date | null;
  now?: Date;
}): NormalizedListingStatus {
  const status = (input.sourceStatus ?? "").toUpperCase();
  if (status === "ACTIVE") return "active";
  if (status === "SOLD") return "sold";
  if (status === "NO_SALE") return "unsold";

  if (status === "ENDED") {
    const soldHints = /\bsold\b/i.test(input.rawPriceText ?? "");
    const amount = input.currentBid ?? null;
    if (soldHints || (amount !== null && amount > 0)) return "sold";
    return "unsold";
  }

  const delistedHints = /\b(withdrawn|cancelled|canceled|removed|delisted)\b/i.test(
    input.rawPriceText ?? "",
  );
  if (delistedHints) return "delisted";

  const now = input.now ?? new Date();
  const endTime = input.endTime ?? null;
  const endIsInPast = !!endTime && Number.isFinite(endTime.getTime()) && endTime.getTime() < now.getTime() - 60_000;

  // If we can't detect status but the close time already passed, treat it as ended.
  if (endIsInPast) {
    const soldHints = /\bsold\b/i.test(input.rawPriceText ?? "");
    const amount = input.currentBid ?? null;
    if (soldHints || (amount !== null && amount > 0)) return "sold";
    return "unsold";
  }

  // Unknown status and endTime not in the past.
  // Only treat as active if there's a current bid (indicates a live auction in progress).
  // If no bid data at all, we can't determine status — default to unsold to avoid
  // showing stale/ended listings as live.
  const amount = input.currentBid ?? null;
  if (amount !== null && amount > 0) return "active";
  return "unsold";
}

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

  // Simple postal detection (US + generic)
  const postalMatch = raw.match(/\b(\d{5})(?:-\d{4})?\b/);
  const postalCode = postalMatch ? postalMatch[1] : null;

  // US: "City, ST" or "City, ST 12345"
  const usMatch = raw.match(/^\s*([^,]+),\s*([A-Z]{2})\s*(?:\d{5}(?:-\d{4})?)?\s*$/);
  if (usMatch && US_STATE_CODES.has(usMatch[2])) {
    return {
      locationRaw: raw,
      country: "USA",
      region: usMatch[2],
      city: usMatch[1].trim(),
      postalCode,
    };
  }

  // US: "City, Full State Name 12345" (e.g., "Pennington, New Jersey 08534")
  const usFullMatch = raw.match(/^\s*([^,]+),\s*([A-Za-z ]+?)\s+\d{5}(?:-\d{4})?\s*$/);
  if (usFullMatch && postalCode) {
    return {
      locationRaw: raw,
      country: "USA",
      region: usFullMatch[2].trim(),
      city: usFullMatch[1].trim(),
      postalCode,
    };
  }

  // Common UK patterns
  if (/\b(uk|united kingdom|england|scotland|wales|northern ireland)\b/i.test(raw)) {
    const city = raw.split(",")[0]?.trim() || null;
    return {
      locationRaw: raw,
      country: "UK",
      region: null,
      city,
      postalCode,
    };
  }

  // Trailing country token: "Paris, France" / "Munich, Germany"
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const countryToken = parts[parts.length - 1];
    const cityToken = parts[0] ?? null;
    return {
      locationRaw: raw,
      country: normalizeCountryName(countryToken) ?? "Unknown",
      region: parts.length === 3 ? parts[1] : null,
      city: cityToken,
      postalCode,
    };
  }

  // Single token: could be country
  return {
    locationRaw: raw,
    country: normalizeCountryName(raw) ?? "Unknown",
    region: null,
    city: null,
    postalCode,
  };
}

function normalizeCountryName(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === "usa" || lower === "us" || lower === "united states" || lower === "united states of america") {
    return "USA";
  }
  if (lower === "uk" || lower === "united kingdom" || lower === "great britain") return "UK";
  if (lower === "uae" || lower === "united arab emirates") return "UAE";

  // Title-case-ish fallback for known European names
  const known = [
    "Germany",
    "France",
    "Italy",
    "Spain",
    "Portugal",
    "Netherlands",
    "Belgium",
    "Switzerland",
    "Austria",
    "Ireland",
    "Sweden",
    "Norway",
    "Denmark",
    "Finland",
    "Poland",
    "Czechia",
    "Czech Republic",
    "Hungary",
    "Romania",
    "Bulgaria",
    "Greece",
    "Turkey",
    "Canada",
    "Australia",
    "Japan",
  ];
  for (const k of known) {
    if (k.toLowerCase() === lower) return k;
  }
  return null;
}

export function parseYearFromTitle(title: string): number | null {
  const m = title.match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const maxYear = new Date().getUTCFullYear() + 1;
  if (year < 1900 || year > maxYear) return null;
  return year;
}

export function toUtcDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function scoreDataQuality(input: {
  year: number | null;
  model: string | null;
  saleDate: string | null;
  country: string | null;
  photosCount: number;
  hasPrice: boolean;
}): number {
  let score = 0;
  if (input.year && input.year >= 1900) score += 25;
  if (input.model && input.model.trim().length > 0) score += 15;
  if (input.saleDate) score += 25;
  if (input.country && input.country !== "Unknown") score += 15;
  if (input.photosCount > 0) score += 10;
  if (input.hasPrice) score += 10;
  return Math.max(0, Math.min(100, score));
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function normalizeSourceAuctionHouse(source: SourceKey): string {
  switch (source) {
    case "BaT":
      return "Bring a Trailer";
    case "CarsAndBids":
      return "Cars & Bids";
    case "CollectingCars":
      return "Collecting Cars";
  }
}

export function mapSourceToPlatform(source: SourceKey): PlatformEnum {
  switch (source) {
    case "BaT":
      return "BRING_A_TRAILER";
    case "CarsAndBids":
      return "CARS_AND_BIDS";
    case "CollectingCars":
      return "COLLECTING_CARS";
  }
}

export function mapReserveStatus(reserveMet: boolean | null): ReserveStatusEnum | null {
  if (reserveMet === true) return "RESERVE_MET";
  if (reserveMet === false) return "RESERVE_NOT_MET";
  return null;
}

export function mapReserveStatusFromString(text: string | null): ReserveStatusEnum | null {
  if (!text) return null;
  const upper = text.toUpperCase().replace(/[\s-]+/g, "_");
  if (upper === "NO_RESERVE") return "NO_RESERVE";
  if (upper === "RESERVE_MET") return "RESERVE_MET";
  if (upper === "RESERVE_NOT_MET") return "RESERVE_NOT_MET";
  return null;
}

export function buildLocationString(loc: NormalizedLocation): string | null {
  const parts = [loc.city, loc.region, loc.country].filter(
    (p): p is string => typeof p === "string" && p.length > 0 && p !== "Unknown",
  );
  return parts.length > 0 ? parts.join(", ") : null;
}
