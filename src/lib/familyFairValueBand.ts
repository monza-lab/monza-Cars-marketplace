import { getSeriesConfig } from "./brandConfig";
import { hasReplicaOrTributeLanguage } from "./listingRarity";

/**
 * A family fair-value band is the p25–p75 of every car in one (family, market)
 * segment. It describes the ordinary cars of that family, so it can never stand
 * in for the value of the car in front of the reader: a 964 Carrera RS read
 * against the "964" band looks 208 % overpriced, a 997.2 GT3 RS against the
 * "997" band 2209 %, a 356 replica 60 % underpriced. The per-car number is the
 * report's `specific_car_fair_value_low/high`.
 *
 * Rules encoded here:
 *  1. Special variants never carry the family band — the band is not about them.
 *  2. Replicas, tributes and post-production "classics" never carry it either.
 *  3. The band must plausibly bracket the car's own price to sit next to it.
 *  4. Whatever survives is labelled as the family's range, never as this car's
 *     fair value.
 */

export type FamilyBandCandidate = {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  title?: string | null;
  family?: string | null;
};

export type FairValueBand = { low: number; high: number };

/**
 * Variants whose value is set by their own scarcity rather than by the family
 * they share a chassis with. Matched against title + model + trim.
 */
const SPECIAL_VARIANT_PATTERNS: readonly RegExp[] = [
  /\brs\b/i,
  /\brsr\b/i,
  /\bgt\s?[1234]\b/i,
  /\bturbo\s?s\b/i,
  /\bspeedster\b/i,
  /\bspyder\b/i,
  /\bclub\s?sport\b/i,
  /\b911\s?r\b/i,
  /\bcayman\s?r\b/i,
  /\bs\s?\/\s?t\b/i,
  /\b4\.0\b/i,
  /\bsport\s?classic\b/i,
  /\bweissach\b/i,
  /\bleichtbau\b/i,
  /\bcarrera\s?gt\b/i,
  /\b918\b/i,
  /\b959\b/i,
  /\bslantnose\b/i,
  /\bflachbau\b/i,
  /\bsonderwunsch\b/i,
  /\bruf\b/i,
];

/** The last 356 left Zuffenhausen in 1965; a later one is a replica or a kit. */
const POST_PRODUCTION_CLASSICS: readonly { pattern: RegExp; lastYear: number }[] = [
  { pattern: /\b356\b/i, lastYear: 1965 },
  { pattern: /\b550\s?spyder\b/i, lastYear: 1957 },
];

const BAND_LOW_TOLERANCE = 0.6;
const BAND_HIGH_TOLERANCE = 1.5;

function descriptorOf(listing: FamilyBandCandidate): string {
  return [listing.title, listing.model, listing.trim]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

/** A model claimed for a year in which the factory no longer built it. */
export function isPostProductionClassic(listing: FamilyBandCandidate): boolean {
  if (typeof listing.year !== "number" || !Number.isFinite(listing.year)) return false;
  const descriptor = `${descriptorOf(listing)} ${listing.family ?? ""}`;
  return POST_PRODUCTION_CLASSICS.some(
    ({ pattern, lastYear }) => pattern.test(descriptor) && listing.year! > lastYear,
  );
}

/** True when the family's ordinary range can honestly describe this listing. */
export function isFamilyBandRepresentative(listing: FamilyBandCandidate): boolean {
  const descriptor = descriptorOf(listing);
  if (!descriptor) return false;
  if (hasReplicaOrTributeLanguage(listing)) return false;
  if (isPostProductionClassic(listing)) return false;
  return !SPECIAL_VARIANT_PATTERNS.some((pattern) => pattern.test(descriptor));
}

/**
 * The band must bracket the car's own price to be shown beside it. A price with
 * no number attached (POA) makes no comparison, so it does not disqualify.
 */
export function bandBracketsPrice(
  band: FairValueBand,
  priceUsd: number | null | undefined,
): boolean {
  if (typeof priceUsd !== "number" || !Number.isFinite(priceUsd) || priceUsd <= 0) return true;
  return (
    priceUsd >= band.low * BAND_LOW_TOLERANCE && priceUsd <= band.high * BAND_HIGH_TOLERANCE
  );
}

/** "964 family" — the label comes from brandConfig, never from the raw id. */
export function familyBandLabel(
  family: string | null | undefined,
  make: string | null | undefined = "Porsche",
): string | null {
  if (!family) return null;
  const label = getSeriesConfig(family, make || "Porsche")?.label;
  return label ? `${label} family` : null;
}

/**
 * Single gate for showing a family band next to one listing. Returns the label
 * to render it under, or null when the band must stay hidden.
 */
export function resolveFamilyBandLabel(
  listing: FamilyBandCandidate,
  band: FairValueBand | null | undefined,
  priceUsd: number | null | undefined,
): string | null {
  if (!band) return null;
  if (!(band.low > 0) || !(band.high >= band.low)) return null;
  if (!isFamilyBandRepresentative(listing)) return null;
  if (!bandBracketsPrice(band, priceUsd)) return null;
  return familyBandLabel(listing.family, listing.make);
}
