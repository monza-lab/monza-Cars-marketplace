import crypto from "node:crypto";

import { CanonicalListingSchema, type CanonicalListing, type NormalizeReject } from "../contracts/listing";
import type { SourceKey } from "../adapters/sources";

function readPath(raw: Record<string, unknown>, key: string): unknown {
  if (!key.includes(".")) return raw[key];
  const parts = key.split(".");
  let cursor: unknown = raw;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = readPath(raw, key);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickIdString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = readPath(raw, key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = readPath(raw, key);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const numeric = Number(value.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  return null;
}

function pickImages(raw: Record<string, unknown>): string[] {
  const candidates = [raw.images, raw.photos, raw.photoUrls, raw.image_urls, readPath(raw, "media.images")];
  for (const value of candidates) {
    if (!Array.isArray(value)) continue;
    const urls = value.filter((v): v is string => typeof v === "string" && /^https?:\/\//.test(v));
    if (urls.length > 0) return urls;
  }
  return [];
}

function pickCurrency(raw: Record<string, unknown>): "USD" | "EUR" | "GBP" | null {
  const value = pickString(raw, ["currency", "currency_code", "price.total.currency"]);
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper === "USD" || upper === "EUR" || upper === "GBP") return upper;
  return null;
}

function compactRawPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const keep = [
    "id",
    "url",
    "source_url",
    "title",
    "brand",
    "make",
    "model",
    "modelVersion",
    "vehicleType",
    "status",
    "createdDate",
    "modifiedDate",
    "mileage",
    "price",
    "currency",
    "city",
    "country",
    "attributes",
    "dealerDetails",
    "images",
  ];
  const out: Record<string, unknown> = {};
  for (const key of keep) {
    const value = raw[key];
    if (value === undefined) continue;
    if (key === "dealerDetails" && value && typeof value === "object") {
      const dealer = value as Record<string, unknown>;
      out.dealerDetails = {
        id: dealer.id ?? null,
        name: dealer.name ?? null,
        sellerType: dealer.sellerType ?? null,
        addressStructured: dealer.addressStructured ?? null,
      };
      continue;
    }
    if (key === "attributes" && value && typeof value === "object") {
      const attrs = value as Record<string, unknown>;
      out.attributes = {
        Mileage: attrs.Mileage ?? null,
        "First Registration": attrs["First Registration"] ?? null,
      };
      continue;
    }
    if (key === "images" && Array.isArray(value)) {
      out.images = value.slice(0, 8);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function normalizeStatus(rawStatus: string | null): CanonicalListing["status"] {
  const status = (rawStatus ?? "").toLowerCase();
  if (status.includes("active") || status.includes("live")) return "active";
  if (status.includes("sold")) return "sold";
  if (status.includes("ended") || status.includes("complete") || status.includes("closed")) return "sold";
  if (status.includes("unsold") || status.includes("no sale")) return "unsold";
  if (status.includes("delist") || status.includes("withdrawn") || status.includes("cancel")) return "delisted";
  return "draft";
}

function deriveSourceId(source: SourceKey, raw: Record<string, unknown>, sourceUrl: string): string {
  const explicit = pickIdString(raw, ["source_id", "sourceId", "external_id", "externalId", "id", "listingId", "auctionId"]);
  if (explicit) return explicit;
  const hash = crypto.createHash("sha256").update(source + ":" + sourceUrl).digest("hex").slice(0, 16);
  return `${source}_${hash}`;
}

function deriveYear(raw: Record<string, unknown>, title: string): number | null {
  const direct = pickNumber(raw, ["year", "model_year"]);
  if (direct && direct >= 1948 && direct <= new Date().getUTCFullYear() + 1) return Math.trunc(direct);
  const firstRegistration = pickString(raw, ["attributes.First Registration", "firstRegistration", "registrationDate"]);
  if (firstRegistration) {
    const regMatch = firstRegistration.match(/(19\d{2}|20\d{2})/);
    if (regMatch) return Number(regMatch[1]);
  }
  const match = title.match(/\b(19\d{2}|20\d{2})\b/);
  if (!match) return null;
  return Number(match[1]);
}

function deriveModel(raw: Record<string, unknown>, title: string): string | null {
  const fromRaw = pickString(raw, ["model", "car_model", "series", "modelVersion"]);
  if (fromRaw) return fromRaw;
  const afterMake = title.replace(/\b\d{4}\b\s*/g, "").replace(/porsche/i, "").trim();
  return afterMake ? afterMake.split(/\s+/)[0] ?? null : null;
}

export function normalizeRawListing(input: {
  source: "BaT" | "CarsAndBids" | "AutoScout24" | "ClassicCars";
  raw: Record<string, unknown>;
}): { ok: true; value: CanonicalListing } | { ok: false; reject: NormalizeReject } {
  const title = pickString(input.raw, ["title", "name", "auctionTitle", "headline"]);
  const rawMake = pickString(input.raw, ["make", "brand", "manufacturer"]);
  const make = rawMake ?? "Porsche";
  const rawModel = pickString(input.raw, ["model", "car_model", "series", "modelVersion"]);
  const sourceUrl = pickString(input.raw, ["source_url", "sourceUrl", "url", "listing_url", "auctionUrl", "listingUrl", "href", "link"]);

  if (!title || !sourceUrl) {
    return {
      ok: false,
      reject: { source: input.source, reason: "missing_required_fields", raw: input.raw, details: { title: !!title, sourceUrl: !!sourceUrl } },
    };
  }

  if (rawMake && !/porsche/i.test(rawMake)) {
    return {
      ok: false,
      reject: { source: input.source, reason: "non_porsche", raw: input.raw, details: { rawMake } },
    };
  }

  if (!/porsche/i.test(`${make} ${title} ${rawModel ?? ""}`)) {
    return {
      ok: false,
      reject: { source: input.source, reason: "non_porsche", raw: input.raw },
    };
  }

  const year = deriveYear(input.raw, title);
  const model = deriveModel(input.raw, title);
  if (!year || !model) {
    return {
      ok: false,
      reject: { source: input.source, reason: "missing_year_or_model", raw: input.raw },
    };
  }

  const listingCandidate: CanonicalListing = {
    source: input.source,
    source_id: deriveSourceId(
      input.source === "BaT" ? "bat" : input.source === "CarsAndBids" ? "carsandbids" : input.source === "AutoScout24" ? "autoscout24" : "classiccars",
      input.raw,
      sourceUrl,
    ),
    source_url: sourceUrl,
    make: "Porsche",
    model,
    year,
    title,
    status: normalizeStatus(
      pickString(input.raw, ["status", "auction_status", "auctionStatus", "state"]) ?? (input.source === "AutoScout24" ? "active" : null),
    ),
    sale_date: pickString(input.raw, ["sale_date", "saleDate", "ended_at", "endedAt"]),
    vin: (pickString(input.raw, ["vin", "VIN"]) ?? null)?.toUpperCase().replace(/\s+/g, ""),
    hammer_price: pickNumber(input.raw, ["hammer_price", "hammerPrice", "sold_price", "sale_price", "price.total.amount"]),
    current_bid: pickNumber(input.raw, ["current_bid", "currentBid", "bid", "price.total.amount"]),
    bid_count: pickNumber(input.raw, ["bid_count", "bids"]),
    final_price: pickNumber(input.raw, ["final_price", "finalPrice", "price.total.amount"]),
    currency: pickCurrency(input.raw),
    mileage: pickNumber(input.raw, ["mileage", "odometer", "attributes.Mileage"]),
    mileage_unit:
      /mile/i.test(pickString(input.raw, ["mileage_unit", "odometer_unit", "attributes.Mileage"]) ?? "") ||
      / mi/i.test(pickString(input.raw, ["attributes.Mileage"]) ?? "")
        ? "miles"
        : "km",
    country: pickString(input.raw, ["country", "dealerDetails.addressStructured.countryCode"]) ?? "Unknown",
    region: pickString(input.raw, ["region", "state"]),
    city: pickString(input.raw, ["city", "dealerDetails.addressStructured.city"]),
    auction_house:
      input.source === "BaT"
        ? "Bring a Trailer"
        : input.source === "CarsAndBids"
          ? "Cars & Bids"
          : input.source === "AutoScout24"
            ? "AutoScout24"
            : "ClassicCars",
    description_text: pickString(input.raw, ["description", "description_text", "seller_notes"]),
    images: pickImages(input.raw),
    raw_payload: compactRawPayload(input.raw),
  };

  const parsed = CanonicalListingSchema.safeParse(listingCandidate);
  if (!parsed.success) {
    return {
      ok: false,
      reject: {
        source: input.source,
        reason: "schema_validation_failed",
        raw: input.raw,
        details: { issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`) },
      },
    };
  }

  return { ok: true, value: parsed.data };
}
