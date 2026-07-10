import type { CanonicalMarket } from "./types";

const MAP: Record<string, CanonicalMarket> = {
  "BaT": "US",
  "Bring a Trailer": "US",
  "ClassicCom": "US",
  "Classic.com": "US",
  "CarsAndBids": "US",
  "AutoScout24": "EU",
  "Elferspot": "EU",
  "CollectingCars": "EU",
  "AutoTrader": "UK",
  "BeForward": "JP",
};

export function sourceToCanonicalMarket(source: string | null | undefined): CanonicalMarket | null {
  if (!source) return null;
  return MAP[source] ?? null;
}

export const AUCTION_SOURCES: readonly string[] = ["BaT", "Bring a Trailer", "ClassicCom", "Classic.com", "CarsAndBids"] as const;

export function isAuctionSource(source: string | null | undefined): boolean {
  if (!source) return false;
  return AUCTION_SOURCES.includes(source);
}
