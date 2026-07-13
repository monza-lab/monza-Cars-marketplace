import { extractSeries, getSeriesForBrand, matchVariant } from "./brandConfig";
import { hasReplicaOrTributeLanguage, isHistoricClassicIcon } from "./listingRarity";

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
  homepageRank: number;
  homepageScore: number;
  intrinsicScore: number;
  marketScarcityScore: number;
  marketSupplyCount: number | null;
  evidenceScore: number;
  variantKey: string;
  collectorPriority: number;
  isClassic: boolean;
  isModernSpecial: boolean;
  hasUsablePhotography: boolean;
};

export type HomepageOrderedListing = {
  id: string;
  endTime?: string | Date | null;
  homepageRank?: number | null;
  homepageScore?: number | null;
  rarityScore?: number | null;
};

const CLASSIC_SERIES = new Set(["356", "f-model", "g-model", "930", "964", "993"]);
const MODERN_SPECIAL_SIGNALS = new Set([
  "hypercar",
  "homologation_special",
  "gt_model",
  "limited_edition",
  "sonderwunsch",
]);
const TOP_TEN_LANES = [
  "classic",
  "modern",
  "classic",
  "open",
  "classic",
  "modern",
  "classic",
  "open",
  "modern",
  "classic",
] as const;

type HomepageLane = "classic" | "modern" | "open";
type RankedCandidate<T extends HomepageRankingListing> = Omit<RankedHomepageListing<T>, "homepageRank"> & {
  homepageRank: number;
  vehicleKey: string;
};

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

function hasUsablePhotography(listing: HomepageRankingListing): boolean {
  return (listing.images ?? []).some(
    (image) => typeof image === "string" && image.length > 0 && !/placeholder/i.test(image),
  );
}

function rankOne<T extends HomepageRankingListing>(
  listing: T,
  context: HomepageRankingContext,
): RankedCandidate<T> {
  const variant = resolveHomepageVariant(listing);
  const supply = variant.recognized ? context.supplyByVariant.get(variant.key) ?? null : null;
  const marketScarcityScore = variant.recognized && variant.modern && supply !== null
    ? scarcityScore(supply, context.maxModernVariantSupply)
    : 0;
  const intrinsicScore = Math.max(0, Math.min(100, listing.rarityScore ?? 0));
  const evidenceScore = listingEvidenceScore(listing, variant.recognized);
  const signals = new Set(listing.raritySignals ?? []);
  const replicaOrTribute = hasReplicaOrTributeLanguage(listing);
  const isClassic = variant.recognized
    && CLASSIC_SERIES.has(variant.series.toLowerCase())
    && !replicaOrTribute;
  const isModernSpecial = variant.modern
    && !replicaOrTribute
    && [...signals].some((signal) => MODERN_SPECIAL_SIGNALS.has(signal));
  const historicClassicIcon = isClassic && (
    signals.has("historic_classic_icon") || isHistoricClassicIcon(listing)
  );
  const collectorPriority = historicClassicIcon ? 3 : signals.has("hypercar") ? 2 : 1;
  const usablePhotography = hasUsablePhotography(listing);

  return {
    listing,
    homepageRank: 0,
    // Diagnostic only. Explicit homepageRank is the ordering contract.
    homepageScore: intrinsicScore + marketScarcityScore + evidenceScore + (usablePhotography ? 0 : -10),
    intrinsicScore,
    marketScarcityScore,
    marketSupplyCount: supply,
    evidenceScore,
    variantKey: variant.key,
    collectorPriority,
    isClassic,
    isModernSpecial,
    hasUsablePhotography: usablePhotography,
    vehicleKey: vehicleKey(listing),
  };
}

function compareRanked<T extends HomepageRankingListing>(
  a: RankedCandidate<T>,
  b: RankedCandidate<T>,
): number {
  if (a.collectorPriority !== b.collectorPriority) return b.collectorPriority - a.collectorPriority;
  if (a.intrinsicScore !== b.intrinsicScore) return b.intrinsicScore - a.intrinsicScore;
  if (a.evidenceScore !== b.evidenceScore) return b.evidenceScore - a.evidenceScore;
  if (a.hasUsablePhotography !== b.hasUsablePhotography) return a.hasUsablePhotography ? -1 : 1;
  if (a.marketScarcityScore !== b.marketScarcityScore) {
    return b.marketScarcityScore - a.marketScarcityScore;
  }
  const aTime = a.listing.endTime ? new Date(a.listing.endTime).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.listing.endTime ? new Date(b.listing.endTime).getTime() : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return a.listing.id.localeCompare(b.listing.id);
}

/** Preserve the server-computed homepage order after client-side filtering. */
export function compareHomepageOrdering<T extends HomepageOrderedListing>(a: T, b: T): number {
  const aRank = typeof a.homepageRank === "number" && Number.isFinite(a.homepageRank)
    ? a.homepageRank
    : null;
  const bRank = typeof b.homepageRank === "number" && Number.isFinite(b.homepageRank)
    ? b.homepageRank
    : null;
  if (aRank !== null || bRank !== null) {
    if (aRank === null) return 1;
    if (bRank === null) return -1;
    if (aRank !== bRank) return aRank - bRank;
  }

  const aScore = a.homepageScore ?? a.rarityScore ?? Number.NEGATIVE_INFINITY;
  const bScore = b.homepageScore ?? b.rarityScore ?? Number.NEGATIVE_INFINITY;
  if (aScore !== bScore) return bScore - aScore;

  const aTime = a.endTime ? new Date(a.endTime).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.endTime ? new Date(b.endTime).getTime() : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return a.id.localeCompare(b.id);
}

function buildPacedTail(): HomepageLane[] {
  const total = 40;
  const quota: Record<HomepageLane, number> = { classic: 15, modern: 7, open: 18 };
  const used: Record<HomepageLane, number> = { classic: 0, modern: 0, open: 0 };
  const tieOrder: HomepageLane[] = ["classic", "modern", "open"];
  const result: HomepageLane[] = [];

  for (let index = 0; index < total; index += 1) {
    const lane = tieOrder
      .filter((candidate) => used[candidate] < quota[candidate])
      .sort((a, b) => {
        const deficitA = ((index + 1) * quota[a]) / total - used[a];
        const deficitB = ((index + 1) * quota[b]) / total - used[b];
        return deficitB - deficitA || tieOrder.indexOf(a) - tieOrder.indexOf(b);
      })[0];
    result.push(lane);
    used[lane] += 1;
  }

  return result;
}

const TOP_FIFTY_TAIL_LANES = buildPacedTail();

function buildLaneSchedule(limit: number): HomepageLane[] {
  const schedule: HomepageLane[] = TOP_TEN_LANES.slice(0, Math.min(limit, 10));
  if (limit > 10) {
    schedule.push(...TOP_FIFTY_TAIL_LANES.slice(0, Math.min(limit - 10, 40)));
  }
  while (schedule.length < limit) schedule.push("open");
  return schedule;
}

function matchesLane<T extends HomepageRankingListing>(
  row: RankedCandidate<T>,
  lane: HomepageLane,
): boolean {
  if (lane === "classic") return row.isClassic;
  if (lane === "modern") return row.isModernSpecial;
  return true;
}

function findCandidate<T extends HomepageRankingListing>(
  sorted: readonly RankedCandidate<T>[],
  lane: HomepageLane,
  selectedIds: ReadonlySet<string>,
  selectedVehicles: ReadonlySet<string>,
  variantCounts: ReadonlyMap<string, number>,
  position: number,
): RankedCandidate<T> | undefined {
  const cap = position < 10 ? 2 : 5;
  const eligible = (row: RankedCandidate<T>) =>
    !selectedIds.has(row.listing.id) &&
    !selectedVehicles.has(row.vehicleKey) &&
    matchesLane(row, lane) &&
    (variantCounts.get(row.variantKey) ?? 0) < cap;

  return sorted.find((row) => eligible(row) && row.hasUsablePhotography)
    ?? sorted.find(eligible);
}

export function rankHomepageListings<T extends HomepageRankingListing>(
  listings: readonly T[],
  context: HomepageRankingContext = buildHomepageRankingContext(listings),
  options: { limit?: number } = {},
): RankedHomepageListing<T>[] {
  const limit = Math.max(0, options.limit ?? listings.length);
  const sorted = listings.map((listing) => rankOne(listing, context)).sort(compareRanked);
  const target = Math.min(limit, sorted.length);
  const selected: RankedCandidate<T>[] = [];
  const selectedIds = new Set<string>();
  const selectedVehicles = new Set<string>();
  const variantCounts = new Map<string, number>();

  const add = (row: RankedCandidate<T>) => {
    selected.push(row);
    selectedIds.add(row.listing.id);
    selectedVehicles.add(row.vehicleKey);
    variantCounts.set(row.variantKey, (variantCounts.get(row.variantKey) ?? 0) + 1);
  };

  for (const lane of buildLaneSchedule(target)) {
    const row = findCandidate(
      sorted,
      lane,
      selectedIds,
      selectedVehicles,
      variantCounts,
      selected.length,
    ) ?? findCandidate(
      sorted,
      "open",
      selectedIds,
      selectedVehicles,
      variantCounts,
      selected.length,
    );
    if (row) add(row);
  }

  // Preserve result length if inventory cannot satisfy diversity or dedupe constraints.
  for (const row of sorted) {
    if (selected.length >= target) break;
    if (selectedIds.has(row.listing.id)) continue;
    add(row);
  }

  return selected.map((row, index) => ({
    listing: row.listing,
    homepageRank: index + 1,
    homepageScore: row.homepageScore,
    intrinsicScore: row.intrinsicScore,
    marketScarcityScore: row.marketScarcityScore,
    marketSupplyCount: row.marketSupplyCount,
    evidenceScore: row.evidenceScore,
    variantKey: row.variantKey,
    collectorPriority: row.collectorPriority,
    isClassic: row.isClassic,
    isModernSpecial: row.isModernSpecial,
    hasUsablePhotography: row.hasUsablePhotography,
  }));
}
