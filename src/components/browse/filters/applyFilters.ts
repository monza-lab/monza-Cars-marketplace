import type { DashboardAuction } from "@/lib/dashboardCache";
import { extractSeries, matchVariant, deriveBodyType } from "@/lib/brandConfig";
import {
  TRANSMISSION_OPTIONS,
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

function normalizeTransmission(raw: string | null): string | null {
  if (!raw) return null;
  const low = raw.toLowerCase();
  for (const opt of TRANSMISSION_OPTIONS) {
    if (opt.keywords.some((k) => low.includes(k))) return opt.id;
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

export function applyFilters(
  auctions: DashboardAuction[],
  f: ClassicFilters,
): DashboardAuction[] {
  const q = f.q.trim().toLowerCase();

  let out = auctions.filter((car) => {
    // Status
    if (f.status === "live" && !isLiveStatus(car.status)) return false;
    if (f.status === "sold" && isLiveStatus(car.status)) return false;

    // Series
    if (f.series.length > 0) {
      const s = extractSeries(car.model, car.year, car.make, car.title);
      if (!f.series.includes(s)) return false;
    }

    // Variants
    if (f.variants.length > 0) {
      const seriesId = extractSeries(car.model, car.year, car.make, car.title);
      const variantId = matchVariant(car.model, car.trim, seriesId, car.make, car.title);
      if (!variantId || !f.variants.includes(variantId)) return false;
    }

    // Year
    if (f.yearMin !== null && car.year < f.yearMin) return false;
    if (f.yearMax !== null && car.year > f.yearMax) return false;

    // Price
    const price = car.currentBid || car.price || 0;
    if (f.priceMin !== null && price < f.priceMin) return false;
    if (f.priceMax !== null && price > f.priceMax) return false;

    // Mileage
    if (f.mileageMin !== null && (car.mileage ?? 0) < f.mileageMin) return false;
    if (f.mileageMax !== null && car.mileage !== null && car.mileage > f.mileageMax) return false;

    // Transmission
    if (f.transmission.length > 0) {
      const t = normalizeTransmission(car.transmission);
      if (!t || !f.transmission.includes(t)) return false;
    }

    // Body
    if (f.body.length > 0) {
      const body = deriveBodyType(car.model, car.trim, car.category, car.make, car.year);
      if (!f.body.includes(body)) return false;
    }

    // Region
    if (f.region.length > 0) {
      if (!car.region || !f.region.includes(car.region)) return false;
    }

    // Drive (derived from title)
    if (f.drive.length > 0) {
      const d = inferDrive(car.model, car.trim, car.title);
      if (!d || !f.drive.includes(d)) return false;
    }

    // Steering: field not consistently available — treat as pass-through if data missing.
    // When steering info is added to the schema, wire it here.

    // Platform
    if (f.platform.length > 0) {
      if (!f.platform.includes(car.platform)) return false;
    }

    // Text search
    if (q) {
      const haystack = `${car.title} ${car.make} ${car.model} ${car.year} ${car.trim ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
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
