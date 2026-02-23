import type { CanonicalListing } from "../contracts/listing";

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const normalized = parsed.toString();
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    return url.trim();
  }
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildListingFingerprint(listing: Pick<CanonicalListing, "year" | "model" | "vin" | "mileage" | "final_price" | "hammer_price" | "current_bid" | "city">): string | null {
  const model = normalizeText(listing.model);
  if (!model) return null;

  const vin = normalizeText(listing.vin ?? undefined).replace(/\s+/g, "");
  if (vin) {
    return `${listing.year}|${model}|vin:${vin}`;
  }

  const mileage = listing.mileage;
  const city = normalizeText(listing.city ?? undefined);
  const price = listing.final_price ?? listing.hammer_price ?? listing.current_bid;
  if (mileage === null || mileage === undefined || price === null || price === undefined || !city) {
    return null;
  }

  return `${listing.year}|${model}|${Math.trunc(mileage)}|${Math.trunc(price)}|${city}`;
}

function dedupeKey(listing: CanonicalListing): string | null {
  if (listing.source && listing.source_id) return `sid:${listing.source}:${listing.source_id}`;
  if (listing.source_url) return `url:${normalizeUrl(listing.source_url)}`;
  const fingerprint = buildListingFingerprint(listing);
  if (fingerprint) return `fp:${listing.source}:${fingerprint}`;
  return null;
}

export function dedupeListings(listings: CanonicalListing[]): CanonicalListing[] {
  const seen = new Set<string>();
  const output: CanonicalListing[] = [];

  for (const listing of listings) {
    const key = dedupeKey(listing);
    if (!key) {
      output.push(listing);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(listing);
  }

  return output;
}
