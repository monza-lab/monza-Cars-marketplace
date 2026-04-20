import type { DashboardAuction } from "@/lib/dashboardCache";
import {
  extractSeries,
  matchVariant,
  deriveBodyType,
  getSeriesConfig,
  getSeriesVariants,
  resolveSeriesIdForFamily,
} from "@/lib/brandConfig";
import {
  DRIVE_OPTIONS,
  type ClassicFilters,
  type SortOption,
} from "./types";

function isLiveStatus(status: string): boolean {
  return status === "ACTIVE" || status === "ENDING_SOON";
}

function parseEndTimeMs(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normalize a raw transmission string into a canonical filter value.
 *
 * Order matters:
 *  - PDK first (dual-clutch transaxles may contain "manual" in marketing copy).
 *  - Automatic next (AMT = "Automated Manual Transmission" is driver-wise auto).
 *  - Manual last (catches "-speed" phrasing like "Six-Speed Manual Transaxle").
 */
export function normalizeTransmission(raw: string | null): string | null {
  if (!raw || raw === "—") return null;
  const low = raw.toLowerCase();
  if (low.includes("pdk") || low.includes("dual-clutch") || low.includes("dual clutch")) {
    return "pdk";
  }
  if (
    low.includes("automated") ||
    low.includes("automatic") ||
    low.includes("tiptronic") ||
    low.includes("semi-auto") ||
    low === "a/t" ||
    low === "auto"
  ) {
    return "automatic";
  }
  if (low.includes("manual") || low.includes("m/t") || low === "mt" || low.includes("-speed")) {
    return "manual";
  }
  return null;
}

function inferDrive(model: string, trim: string | null, title: string): string | null {
  const text = `${model} ${trim ?? ""} ${title}`.toLowerCase();
  for (const opt of DRIVE_OPTIONS) {
    if (opt.keywords.some((k) => text.includes(k))) return opt.id;
  }
  return null;
}

/**
 * Enriched haystack: title + series label + variant label/keywords +
 * transmission + body type + region. Lets text search match semantic
 * concepts ("GT3 Touring", "manual", "coupe") even when they don't
 * appear verbatim in the title/model fields.
 */
function buildSearchHaystack(car: DashboardAuction): string {
  const parts: string[] = [
    car.title,
    car.make,
    car.model,
    String(car.year),
    car.trim ?? "",
  ];

  const seriesId = extractSeries(car.model, car.year, car.make, car.title);
  const seriesCfg = getSeriesConfig(seriesId, car.make);
  if (seriesCfg) {
    parts.push(seriesCfg.label, seriesCfg.family);
  }

  const variantId = matchVariant(car.model, car.trim, seriesId, car.make, car.title);
  if (variantId) {
    const variants = getSeriesVariants(seriesId, car.make);
    const v = variants.find((x) => x.id === variantId);
    if (v) {
      parts.push(v.label, ...v.keywords);
    }
  }

  const trans = normalizeTransmission(car.transmission);
  if (trans) parts.push(trans);

  const body = deriveBodyType(car.model, car.trim, car.category, car.make, car.year);
  if (body !== "Unknown") parts.push(body);

  if (car.region) parts.push(car.region);

  return parts.join(" ").toLowerCase();
}

export function applyFilters(
  auctions: DashboardAuction[],
  f: ClassicFilters,
): DashboardAuction[] {
  const q = f.q.trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

  let out = auctions.filter((car) => {
    if (f.status === "live" && !isLiveStatus(car.status)) return false;
    if (f.status === "sold" && isLiveStatus(car.status)) return false;

    if (f.series.length > 0) {
      const s = extractSeries(car.model, car.year, car.make, car.title);
      const matchesSeries = f.series.some((seriesId) => {
        const resolved = resolveSeriesIdForFamily(car.make, seriesId) ?? seriesId;
        return resolved === s;
      });
      if (!matchesSeries) return false;
    }

    if (f.variants.length > 0) {
      const seriesId = extractSeries(car.model, car.year, car.make, car.title);
      const variantId = matchVariant(car.model, car.trim, seriesId, car.make, car.title);
      if (!variantId || !f.variants.includes(variantId)) return false;
    }

    if (f.yearMin !== null && car.year < f.yearMin) return false;
    if (f.yearMax !== null && car.year > f.yearMax) return false;

    const price = car.currentBid || car.price || 0;
    if (f.priceMin !== null && price < f.priceMin) return false;
    if (f.priceMax !== null && price > f.priceMax) return false;

    if (f.mileageMin !== null && (car.mileage ?? 0) < f.mileageMin) return false;
    if (f.mileageMax !== null && car.mileage !== null && car.mileage > f.mileageMax) return false;

    if (f.transmission.length > 0) {
      const t = normalizeTransmission(car.transmission);
      if (!t || !f.transmission.includes(t)) return false;
    }

    if (f.body.length > 0) {
      const body = deriveBodyType(car.model, car.trim, car.category, car.make, car.year);
      if (!f.body.includes(body)) return false;
    }

    if (f.region.length > 0) {
      if (!car.region || !f.region.includes(car.region)) return false;
    }

    if (f.drive.length > 0) {
      const d = inferDrive(car.model, car.trim, car.title);
      if (!d || !f.drive.includes(d)) return false;
    }

    // Steering: not consistently available — pass-through when missing.

    if (f.platform.length > 0) {
      if (!f.platform.includes(car.platform)) return false;
    }

    if (tokens.length > 0) {
      const haystack = buildSearchHaystack(car);
      for (const t of tokens) {
        if (!haystack.includes(t)) return false;
      }
    }

    return true;
  });

  out = sortAuctions(out, f.sort);
  return out;
}

function sortAuctions(list: DashboardAuction[], sort: SortOption): DashboardAuction[] {
  const copy = [...list];
  switch (sort) {
    case "priceDesc":
      return copy.sort((a, b) => b.currentBid - a.currentBid);
    case "priceAsc":
      return copy.sort((a, b) => a.currentBid - b.currentBid);
    case "yearDesc":
      return copy.sort((a, b) => b.year - a.year);
    case "yearAsc":
      return copy.sort((a, b) => a.year - b.year);
    case "mileageAsc":
      return copy.sort((a, b) => (a.mileage ?? Infinity) - (b.mileage ?? Infinity));
    case "endingSoon":
      return copy.sort((a, b) => {
        const aLive = isLiveStatus(a.status);
        const bLive = isLiveStatus(b.status);
        if (aLive !== bLive) return aLive ? -1 : 1;
        const aEnd = parseEndTimeMs(a.endTime);
        const bEnd = parseEndTimeMs(b.endTime);
        if (aEnd === null && bEnd === null) return 0;
        if (aEnd === null) return 1;
        if (bEnd === null) return -1;
        return aEnd - bEnd;
      });
    case "newest":
    default:
      return copy.sort((a, b) => {
        const aLive = isLiveStatus(a.status);
        const bLive = isLiveStatus(b.status);
        if (aLive !== bLive) return aLive ? -1 : 1;
        return 0;
      });
  }
}
