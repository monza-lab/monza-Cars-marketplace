import { extractSeries, getSeriesForBrand, matchVariant } from "./brandConfig";

export type HomepageRankingListing = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  title: string;
  vin?: string | null;
  mileage?: number | null;
  exteriorColor?: string | null;
  rarityScore?: number | null;
  raritySignals?: string[] | null;
  images?: string[] | null;
  endTime?: string | Date | null;
};

export type HomepageRankingContext = {
  supplyByVariant: ReadonlyMap<string, number>;
  maxModernVariantSupply: number;
};

export type RankedHomepageListing<T extends HomepageRankingListing = HomepageRankingListing> = {
  listing: T;
  homepageScore: number;
  intrinsicScore: number;
  marketScarcityScore: number;
  marketSupplyCount: number | null;
  evidenceScore: number;
  variantKey: string;
};

export type HomepageOrderedListing = {
  id: string;
  endTime?: string | Date | null;
  homepageScore?: number | null;
  rarityScore?: number | null;
};

const CLASSIC_SERIES = new Set(["356", "f-model", "g-model", "930", "964", "993"]);

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function resolveHomepageVariant(listing: Pick<
  HomepageRankingListing,
  "year" | "make" | "model" | "trim" | "title"
>): {
  series: string;
  variant: string | null;
  key: string;
  recognized: boolean;
  modern: boolean;
} {
  let series = extractSeries(
    listing.model,
    listing.year,
    listing.make || "Porsche",
    listing.title,
  );
  let variant = matchVariant(
    listing.model,
    listing.trim,
    series,
    listing.make || "Porsche",
    listing.title,
  );
  const descriptor = `${listing.model} ${listing.trim ?? ""} ${listing.title}`.toLowerCase();
  const specialistToken = ["wls", "wtl", "speedster"].find((token) =>
    new RegExp(`\\b${token}\\b`, "i").test(descriptor),
  );
  if (specialistToken && !variant?.includes(specialistToken)) {
    for (const candidate of getSeriesForBrand(listing.make || "Porsche")) {
      if (listing.year < candidate.yearRange[0] || listing.year > candidate.yearRange[1]) continue;
      const candidateVariant = matchVariant(
        listing.model,
        listing.trim,
        candidate.id,
        listing.make || "Porsche",
        listing.title,
      );
      if (candidateVariant?.includes(specialistToken)) {
        series = candidate.id;
        variant = candidateVariant;
        break;
      }
    }
  }
  if (variant === null) {
    for (const candidate of getSeriesForBrand(listing.make || "Porsche")) {
      if (listing.year < candidate.yearRange[0] || listing.year > candidate.yearRange[1]) continue;
      const candidateVariant = matchVariant(
        listing.model,
        listing.trim,
        candidate.id,
        listing.make || "Porsche",
        listing.title,
      );
      if (candidateVariant !== null) {
        series = candidate.id;
        variant = candidateVariant;
        break;
      }
    }
  }
  const fallback = normalize(listing.trim) || normalize(listing.model) || "unknown";

  return {
    series,
    variant,
    key: `${normalize(series) || "unknown"}:${variant ?? fallback}`,
    recognized: variant !== null,
    modern: listing.year >= 1998 && !CLASSIC_SERIES.has(series.toLowerCase()),
  };
}

function validVin(vin: string | null | undefined): string | null {
  const normalized = String(vin ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.length >= 11 ? normalized : null;
}

function vehicleKey(listing: HomepageRankingListing): string {
  const vin = validVin(listing.vin);
  if (vin) return `vin:${vin}`;

  if (typeof listing.mileage === "number" && Number.isFinite(listing.mileage)) {
    return [
      "fingerprint",
      listing.year,
      normalize(listing.make),
      normalize(listing.model),
      normalize(listing.trim),
      normalize(listing.title),
      Math.round(listing.mileage),
      normalize(listing.exteriorColor),
    ].join(":");
  }

  return `listing:${listing.id}`;
}

export function buildHomepageRankingContext(
  listings: readonly HomepageRankingListing[],
): HomepageRankingContext {
  const vehiclesByVariant = new Map<string, Set<string>>();
  const modernVariants = new Set<string>();

  for (const listing of listings) {
    const variant = resolveHomepageVariant(listing);
    if (!variant.recognized) continue;

    const vehicles = vehiclesByVariant.get(variant.key) ?? new Set<string>();
    vehicles.add(vehicleKey(listing));
    vehiclesByVariant.set(variant.key, vehicles);
    if (variant.modern) modernVariants.add(variant.key);
  }

  const supplyByVariant = new Map<string, number>();
  let maxModernVariantSupply = 1;
  for (const [key, vehicles] of vehiclesByVariant) {
    supplyByVariant.set(key, vehicles.size);
    if (modernVariants.has(key)) {
      maxModernVariantSupply = Math.max(maxModernVariantSupply, vehicles.size);
    }
  }

  return { supplyByVariant, maxModernVariantSupply };
}

export function buildHomepageRankingContextFromSupply(
  supply: Readonly<Record<string, number>>,
): HomepageRankingContext {
  const supplyByVariant = new Map<string, number>();
  let maxModernVariantSupply = 1;

  for (const [key, rawCount] of Object.entries(supply)) {
    const count = Number(rawCount);
    if (!Number.isFinite(count) || count <= 0) continue;
    supplyByVariant.set(key, count);
    const series = key.split(":", 1)[0].toLowerCase();
    if (!CLASSIC_SERIES.has(series)) {
      maxModernVariantSupply = Math.max(maxModernVariantSupply, count);
    }
  }

  return { supplyByVariant, maxModernVariantSupply };
}

function scarcityScore(supply: number, maxSupply: number): number {
  if (supply <= 1 || maxSupply <= 1) return 15;
  const normalized = Math.log(supply) / Math.log(maxSupply);
  return Math.max(0, Math.min(15, Math.round((1 - normalized) * 15)));
}

function listingEvidenceScore(listing: HomepageRankingListing, recognizedVariant: boolean): number {
  let score = 0;
  if (recognizedVariant) score += 2;
  if (validVin(listing.vin)) score += 2;
  if ((listing.raritySignals?.length ?? 0) >= 2) score += 1;
  return score;
}

function visualPenalty(listing: HomepageRankingListing): number {
  const usable = (listing.images ?? []).some(
    (image) => typeof image === "string" && image.length > 0 && !/placeholder/i.test(image),
  );
  return usable ? 0 : -10;
}

function rankOne<T extends HomepageRankingListing>(
  listing: T,
  context: HomepageRankingContext,
): RankedHomepageListing<T> {
  const variant = resolveHomepageVariant(listing);
  const supply = variant.recognized ? context.supplyByVariant.get(variant.key) ?? null : null;
  const marketScarcityScore = variant.recognized && variant.modern && supply !== null
    ? scarcityScore(supply, context.maxModernVariantSupply)
    : 0;
  const intrinsicScore = Math.max(0, Math.min(100, listing.rarityScore ?? 0));
  const evidenceScore = listingEvidenceScore(listing, variant.recognized);

  return {
    listing,
    homepageScore: intrinsicScore + marketScarcityScore + evidenceScore + visualPenalty(listing),
    intrinsicScore,
    marketScarcityScore,
    marketSupplyCount: supply,
    evidenceScore,
    variantKey: variant.key,
  };
}

function compareRanked<T extends HomepageRankingListing>(
  a: RankedHomepageListing<T>,
  b: RankedHomepageListing<T>,
): number {
  if (a.homepageScore !== b.homepageScore) return b.homepageScore - a.homepageScore;
  if (a.intrinsicScore !== b.intrinsicScore) return b.intrinsicScore - a.intrinsicScore;
  const aTime = a.listing.endTime ? new Date(a.listing.endTime).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.listing.endTime ? new Date(b.listing.endTime).getTime() : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return a.listing.id.localeCompare(b.listing.id);
}

/** Preserve the server-computed homepage order after client-side filtering. */
export function compareHomepageOrdering<T extends HomepageOrderedListing>(a: T, b: T): number {
  const aScore = a.homepageScore ?? a.rarityScore ?? Number.NEGATIVE_INFINITY;
  const bScore = b.homepageScore ?? b.rarityScore ?? Number.NEGATIVE_INFINITY;
  if (aScore !== bScore) return bScore - aScore;

  const aTime = a.endTime ? new Date(a.endTime).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.endTime ? new Date(b.endTime).getTime() : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return a.id.localeCompare(b.id);
}

export function rankHomepageListings<T extends HomepageRankingListing>(
  listings: readonly T[],
  context: HomepageRankingContext = buildHomepageRankingContext(listings),
  options: { limit?: number } = {},
): RankedHomepageListing<T>[] {
  const limit = Math.max(0, options.limit ?? listings.length);
  const sorted = listings.map((listing) => rankOne(listing, context)).sort(compareRanked);
  const selected: RankedHomepageListing<T>[] = [];
  const deferred: RankedHomepageListing<T>[] = [];
  const counts = new Map<string, number>();

  for (const row of sorted) {
    const variantCount = counts.get(row.variantKey) ?? 0;
    const cap = selected.length < 10 ? 2 : 5;
    if (variantCount >= cap) {
      deferred.push(row);
      continue;
    }
    selected.push(row);
    counts.set(row.variantKey, variantCount + 1);
    if (selected.length >= limit) return selected;
  }

  for (const row of deferred) {
    if (selected.length >= limit) break;
    selected.push(row);
  }

  return selected;
}
