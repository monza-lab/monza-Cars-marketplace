import type { CanonicalListing } from "../contracts/listing";

type SoldWindowFilter = {
  soldOnly: boolean;
  soldWithinMonths?: number;
};

type SoldWindowResult =
  | { keep: true }
  | { keep: false; reason: "not_sold" | "missing_sale_date" | "outside_sold_window" };

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function resolveSoldDate(listing: CanonicalListing): Date | null {
  const raw = listing.raw_payload;
  const candidates: unknown[] = [
    listing.sale_date,
    raw.sale_date,
    raw.saleDate,
    raw.endedAt,
    raw.ended_at,
    raw.soldAt,
    raw.sold_at,
    raw.scrapedTimestamp,
  ];
  for (const candidate of candidates) {
    const parsed = parseDate(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function isSoldOrEnded(listing: CanonicalListing): boolean {
  if (listing.status === "sold") return true;
  const rawStatus = String(
    listing.raw_payload.auctionStatus ?? listing.raw_payload.status ?? listing.raw_payload.state ?? "",
  ).toLowerCase();
  return rawStatus.includes("sold") || rawStatus.includes("ended") || rawStatus.includes("complete") || rawStatus.includes("closed");
}

export function evaluateSoldWindow(listing: CanonicalListing, filter: SoldWindowFilter): SoldWindowResult {
  if (!filter.soldOnly && !filter.soldWithinMonths) return { keep: true };

  if (!isSoldOrEnded(listing)) {
    return { keep: false, reason: "not_sold" };
  }

  if (!filter.soldWithinMonths) return { keep: true };
  const soldAt = resolveSoldDate(listing);
  if (!soldAt) return { keep: false, reason: "missing_sale_date" };

  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - filter.soldWithinMonths);
  if (soldAt < cutoff) return { keep: false, reason: "outside_sold_window" };

  return { keep: true };
}
