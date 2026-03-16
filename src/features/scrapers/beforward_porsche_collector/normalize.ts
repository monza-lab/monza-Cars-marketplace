import type { DetailParsed, ListingSummary, NormalizedListing, NormalizedListingStatus, NormalizedLocation, ScrapeMeta } from "./types";

import { deriveSourceId } from "./id";

export function normalizeListing(input: {
  summary: ListingSummary;
  detail: DetailParsed;
  meta: ScrapeMeta;
}): NormalizedListing | null {
  const title = (input.detail.title || input.summary.title).trim();
  if (!title) return null;

  const year = input.detail.year ?? input.summary.year;
  if (!year) return null;

  const make = input.detail.make ?? "Porsche";
  const model = input.detail.model ?? parseModelFromTitle(input.summary.title);
  if (!model) return null;

  const location = parseLocation(input.detail.location ?? input.summary.location);
  const status = mapStatus(input.detail.sourceStatus, input.detail.schemaAvailability);
  const listDate = toUtcDateOnly(new Date(input.meta.scrapeTimestamp));
  const currentBid = input.detail.schemaPriceUsd ?? input.summary.priceUsd;
  const finalPrice = status === "active" ? null : currentBid;

  const photos = input.detail.images;
  const photosCount = photos.length;
  const sourceId = deriveSourceId({ refNo: input.detail.refNo ?? input.summary.refNo, sourceUrl: input.summary.sourceUrl });
  const saleDate = listDate;

  const normalized: NormalizedListing = {
    source: "BeForward",
    sourceId,
    sourceUrl: input.summary.sourceUrl,
    title,
    platform: "BE_FORWARD",
    sellerNotes: input.detail.sellingPoints.length > 0 ? input.detail.sellingPoints.join("; ") : null,
    endTime: null,
    startTime: null,
    reserveStatus: null,
    finalPrice,
    locationString: buildLocationString(location),
    year,
    make,
    model,
    trim: input.detail.trim,
    bodyStyle: null,
    engine: input.detail.engine,
    transmission: input.detail.transmission,
    exteriorColor: input.detail.exteriorColor,
    interiorColor: input.detail.interiorColor,
    vin: input.detail.vin,
    mileageKm: input.detail.mileageKm ?? input.summary.mileageKm,
    mileageUnitStored: "km",
    status,
    reserveMet: null,
    listDate,
    saleDate,
    auctionDate: saleDate,
    auctionHouse: "BeForward",
    descriptionText: null,
    photos,
    photosCount,
    location,
    pricing: {
      hammerPrice: finalPrice,
      currentBid,
      bidCount: null,
      originalCurrency: currentBid ? "USD" : null,
      rawPriceText: currentBid ? `$${currentBid}` : null,
    },
    dataQualityScore: scoreDataQuality({
      year,
      model,
      saleDate,
      country: location.country,
      photosCount,
      hasPrice: currentBid !== null,
    }),
  };

  return normalized;
}

export function normalizeListingFromSummary(input: {
  summary: ListingSummary;
  meta: ScrapeMeta;
}): NormalizedListing | null {
  const title = input.summary.title.trim();
  if (!title) return null;
  const year = input.summary.year;
  const model = parseModelFromTitle(title);
  if (!year || !model) return null;

  const location = parseLocation(input.summary.location);
  const listDate = toUtcDateOnly(new Date(input.meta.scrapeTimestamp));
  const currentBid = input.summary.priceUsd;

  return {
    source: "BeForward",
    sourceId: deriveSourceId({ refNo: input.summary.refNo, sourceUrl: input.summary.sourceUrl }),
    sourceUrl: input.summary.sourceUrl,
    title,
    platform: "BE_FORWARD",
    sellerNotes: null,
    endTime: null,
    startTime: null,
    reserveStatus: null,
    finalPrice: null,
    locationString: buildLocationString(location),
    year,
    make: "Porsche",
    model,
    trim: null,
    bodyStyle: null,
    engine: null,
    transmission: null,
    exteriorColor: null,
    interiorColor: null,
    vin: null,
    mileageKm: input.summary.mileageKm,
    mileageUnitStored: "km",
    status: "active",
    reserveMet: null,
    listDate,
    saleDate: listDate,
    auctionDate: listDate,
    auctionHouse: "BeForward",
    descriptionText: null,
    photos: [],
    photosCount: 0,
    location,
    pricing: {
      hammerPrice: null,
      currentBid,
      bidCount: null,
      originalCurrency: currentBid ? "USD" : null,
      rawPriceText: currentBid ? `$${currentBid}` : null,
    },
    dataQualityScore: scoreDataQuality({
      year,
      model,
      saleDate: listDate,
      country: location.country,
      photosCount: 0,
      hasPrice: currentBid !== null,
    }),
  };
}

function parseModelFromTitle(title: string): string | null {
  const cleaned = title.replace(/\s+/g, " ").trim();
  const m = cleaned.match(/\bPORSCHE\s+([A-Z0-9-]+)/i);
  if (!m) return null;
  return m[1].toUpperCase();
}

export function mapStatus(sourceStatus: string | null, schemaAvailability: string | null): NormalizedListingStatus {
  const src = (sourceStatus ?? "").trim().toLowerCase();
  const availability = (schemaAvailability ?? "").trim().toLowerCase();

  if (src === "in-stock") return "active";
  if (src === "sold") return "sold";
  if (src === "reserved") return "active";
  if (src === "out-of-stock") return "delisted";

  if (availability.includes("instock")) return "active";
  if (availability.includes("outofstock")) return "delisted";
  if (availability.includes("soldout")) return "sold";

  return "delisted";
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

  const country = /\b(korea|japan|uae|thailand|uk|united kingdom|australia|singapore)\b/i.test(raw)
    ? normalizeCountryName(raw)
    : "Japan";

  const city = raw.replace(/[^A-Za-z\s-]/g, "").trim() || null;
  return {
    locationRaw: raw,
    country,
    region: null,
    city,
    postalCode: null,
  };
}

function normalizeCountryName(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("korea")) return "Korea";
  if (lower.includes("japan")) return "Japan";
  if (lower.includes("uae")) return "UAE";
  if (lower.includes("thailand")) return "Thailand";
  if (lower.includes("uk") || lower.includes("united kingdom")) return "UK";
  if (lower.includes("australia")) return "Australia";
  if (lower.includes("singapore")) return "Singapore";
  return "Japan";
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
  if (input.year && input.year >= 1900) score += 20;
  if (input.model && input.model.trim().length > 0) score += 15;
  if (input.saleDate) score += 20;
  if (input.country && input.country !== "Unknown") score += 15;
  if (input.photosCount > 0) score += 20;
  if (input.hasPrice) score += 10;
  return Math.max(0, Math.min(100, score));
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
