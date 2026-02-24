export function normalizeAuctionPlatform(platform: string | null | undefined): string | null {
  if (!platform) return null;
  const normalized = platform.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (normalized === "BRINGATRAILER" || normalized === "BAT") return "BRING_A_TRAILER";
  if (normalized === "AUTOSCOUT24") return "AUTO_SCOUT_24";
  if (normalized === "AUTOTRADER") return "AUTO_TRADER";
  if (normalized === "BEFORWARD") return "BE_FORWARD";
  if (normalized === "CARSANDBIDS") return "CARS_AND_BIDS";
  if (normalized === "COLLECTINGCARS") return "COLLECTING_CARS";

  return platform.toUpperCase();
}

export const REGION_TO_PLATFORM: Record<string, string> = {
  US: "BRING_A_TRAILER",
  EU: "AUTO_SCOUT_24",
  UK: "AUTO_TRADER",
  JP: "BE_FORWARD",
};

export function filterAuctionsForRegion<T extends { platform: string | null | undefined }>(
  auctions: T[],
  selectedRegion: string | null | undefined,
): T[] {
  if (!selectedRegion) return auctions;

  const targetPlatform = REGION_TO_PLATFORM[selectedRegion];
  if (!targetPlatform) return auctions;

  return auctions.filter((auction) => normalizeAuctionPlatform(auction.platform) === targetPlatform);
}
