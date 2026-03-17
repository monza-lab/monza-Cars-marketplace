// src/lib/listingValidator.ts
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig";

// ─── Constants ───

const NON_CAR_KEYWORDS = [
  "tractor", "literature", "press kit", "tool kit",
  "apal", "genie", "kenworth", "boat", "craft", "bike",
  "minibike", "scooter", "autonacional", "projects unlimited",
] as const;

const INVALID_MODELS = ["porsche", "others", "other"] as const;

const PORSCHE_COLORS = [
  "racing green", "guards red", "speed yellow", "miami blue",
  "gentian blue", "lava orange", "frozen blue", "crayon",
  "irish green", "signal green", "riviera blue", "mexico blue",
  "rubystone red", "maritime blue", "gulf blue", "python green",
  "chalk white", "nardo grey", "oak green", "stone grey",
  "arena red", "jet black", "night blue", "shark blue",
] as const;

// ─── Types ───

export interface ValidationResult {
  valid: boolean;
  fixedModel?: string;
  reason?: string;
}

interface ListingInput {
  make: string;
  model: string;
  title: string;
  year?: number;
}

// ─── Public API ───

/**
 * Check if model field indicates a non-car item.
 * Only checks the model field — title is NOT checked here to avoid false positives
 * (e.g. "handcrafted" matching "craft"). Title-based rejection is handled in
 * validateListing() only when the model is already suspicious.
 * Returns rejection reason string, or null if it's a valid car.
 */
export function isNonCar(model: string, title: string): string | null {
  const lModel = model.toLowerCase().trim();

  // Special diesel rule: reject UNLESS it's a Cayenne Diesel
  if (lModel.includes("diesel") && !lModel.includes("cayenne")) {
    return "non-car:diesel";
  }

  for (const kw of NON_CAR_KEYWORDS) {
    if (lModel.includes(kw)) return `non-car:${kw}`;
  }

  return null;
}

/**
 * Try to extract a valid model from the title string.
 * Returns the model substring (e.g. "911 Carrera S") or null.
 */
export function tryExtractModel(
  title: string,
  year: number | undefined,
  make: string,
): string | null {
  if (!title || title.trim().length < 3) return null;

  // Strip year pattern (4-digit number) and make from title
  const candidate = title
    .replace(/\b(19|20)\d{2}\b/g, "")   // remove years
    .replace(new RegExp(make, "gi"), "") // remove make
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate || candidate.length < 2) return null;

  // Check if this candidate maps to a known series
  const seriesId = extractSeries(candidate, year ?? 0, make);
  const config = getSeriesConfig(seriesId, make);

  if (config) {
    return candidate;
  }

  // Also try the raw title (extractSeries strips make internally)
  const rawSeriesId = extractSeries(title, year ?? 0, make);
  const rawConfig = getSeriesConfig(rawSeriesId, make);

  if (rawConfig && candidate.length >= 2) {
    return candidate;
  }

  return null;
}

/**
 * Check if a model value is actually a Porsche color name.
 */
function isColorAsModel(model: string): boolean {
  const lModel = model.toLowerCase().trim();
  if (lModel.length < 3) return false;

  for (const color of PORSCHE_COLORS) {
    if (lModel.startsWith(color)) return true;
  }
  // Also catch "X Metallic" patterns (e.g. "Racing Green Metallic")
  if (lModel.endsWith("metallic")) return true;
  return false;
}

/**
 * Check if a model value is in the invalid/empty list.
 */
function isInvalidModel(model: string): boolean {
  const lModel = model.toLowerCase().trim();
  if (lModel === "") return true;
  return INVALID_MODELS.some((inv) => lModel === inv);
}

/**
 * Main validation function. Call before writing a listing to the DB.
 */
export function validateListing(listing: ListingInput): ValidationResult {
  const make = (listing.make ?? "").trim();
  const model = (listing.model ?? "").trim();
  const title = (listing.title ?? "").trim();

  // Rule 1: Non-Porsche make → reject
  if (make.toLowerCase() !== "porsche") {
    return { valid: false, reason: `non-porsche-make:${make}` };
  }

  // Rule 2: Non-car item (model field check) → reject
  const nonCarReason = isNonCar(model, title);
  if (nonCarReason) {
    return { valid: false, reason: nonCarReason };
  }

  // Rule 3: Invalid/empty model or color-as-model → try to fix from title
  const modelIsSuspicious = isInvalidModel(model) || isColorAsModel(model);

  // Rule 3a: Title-based non-car check — only when model is already suspicious
  // (avoids false positives like "handcrafted" matching "craft" on valid listings)
  if (modelIsSuspicious) {
    const titleNonCar = ["boat", "craft", "bike", "minibike", "scooter", "tractor"];
    const lTitle = title.toLowerCase();
    for (const kw of titleNonCar) {
      if (lTitle.match(new RegExp(`\\b${kw}\\b`))) {
        return { valid: false, reason: `non-car-title:${kw}` };
      }
    }
  }

  if (modelIsSuspicious) {
    const extracted = tryExtractModel(title, listing.year, "Porsche");
    if (extracted) {
      return { valid: true, fixedModel: extracted };
    }
    return { valid: false, reason: `unresolvable-model:${model}` };
  }

  // Rule 4: Model looks OK
  return { valid: true };
}
