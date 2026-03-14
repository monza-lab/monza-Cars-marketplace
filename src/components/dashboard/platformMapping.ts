export function normalizeAuctionPlatform(platform: string | null | undefined): string | null {
  if (!platform) return null;
  const normalized = platform.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (normalized === "BRINGATRAILER" || normalized === "BAT") return "BRING_A_TRAILER";
  if (normalized === "AUTOSCOUT24") return "AUTO_SCOUT_24";
  if (normalized === "AUTOTRADER") return "AUTO_TRADER";
  if (normalized === "BEFORWARD") return "BE_FORWARD";
  if (normalized === "CARSANDBIDS") return "CARS_AND_BIDS";
  if (normalized === "COLLECTINGCARS") return "COLLECTING_CARS";
  if (normalized === "CLASSICCOM") return "CLASSIC_COM";

  return platform.toUpperCase();
}

export const REGION_TO_PLATFORMS: Record<string, string[]> = {
  US: ["BRING_A_TRAILER", "CLASSIC_COM", "CARS_AND_BIDS"],
  EU: ["AUTO_SCOUT_24", "COLLECTING_CARS"],
  UK: ["AUTO_TRADER"],
  JP: ["BE_FORWARD"],
};

// Keep single-platform map for backward compatibility
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

  const targetPlatforms = REGION_TO_PLATFORMS[selectedRegion];
  if (!targetPlatforms || targetPlatforms.length === 0) return auctions;

  return auctions.filter((auction) => {
    const normalized = normalizeAuctionPlatform(auction.platform);
    return normalized !== null && targetPlatforms.includes(normalized);
  });
}
