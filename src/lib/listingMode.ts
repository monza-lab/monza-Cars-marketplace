import { isAuctionPlatform } from "./makePageConstants";

export type ListingMode = "live_auction" | "ended_auction" | "for_sale" | "sold";

type ListingLike = {
  platform?: string | null;
  status?: string | null;
  endTime?: string | Date | null;
  bidCount?: number | null;
};

function parseEndTime(value?: string | Date | null): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function getListingMode(car: ListingLike, now: number = Date.now()): ListingMode {
  const auction = isAuctionPlatform(car.platform);
  const ended = car.status === "ENDED";
  const endMs = parseEndTime(car.endTime);
  const expired = endMs !== null && endMs <= now;

  if (auction) {
    return ended || expired ? "ended_auction" : "live_auction";
  }
  return ended ? "sold" : "for_sale";
}

export function isLiveListing(car: ListingLike, now: number = Date.now()): boolean {
  const mode = getListingMode(car, now);
  return mode === "live_auction" || mode === "for_sale";
}

export function getListingModeLabel(mode: ListingMode): string {
  switch (mode) {
    case "live_auction":
      return "Live Auction";
    case "ended_auction":
      return "Auction Ended";
    case "for_sale":
      return "For Sale";
    case "sold":
      return "Sold";
  }
}

export function getExternalLinkLabel(mode: ListingMode, platformShort: string): string {
  switch (mode) {
    case "live_auction":
      return `Bid on ${platformShort}`;
    case "for_sale":
      return `View on ${platformShort}`;
    case "ended_auction":
    case "sold":
      return `View original listing on ${platformShort}`;
  }
}
