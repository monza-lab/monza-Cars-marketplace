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
  if (normalized === "ELFERSPOT") return "ELFERSPOT";

  return platform.toUpperCase();
}

export const REGION_TO_PLATFORMS: Record<string, string[]> = {
  US: ["BRING_A_TRAILER", "CLASSIC_COM", "CARS_AND_BIDS"],
  EU: ["AUTO_SCOUT_24", "COLLECTING_CARS", "ELFERSPOT"],
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

// ─── PLATFORM TYPE: auction vs listing ───
// Auction platforms: timed bidding events
const AUCTION_PLATFORMS = new Set(["BRING_A_TRAILER", "CARS_AND_BIDS", "COLLECTING_CARS"])
// Listing platforms: fixed-price or dealer listings
const LISTING_PLATFORMS = new Set(["AUTO_SCOUT_24", "AUTO_TRADER", "BE_FORWARD", "CLASSIC_COM", "ELFERSPOT"])

export function isAuctionPlatform(platform: string | null | undefined): boolean {
  const normalized = normalizeAuctionPlatform(platform)
  return normalized !== null && AUCTION_PLATFORMS.has(normalized)
}

export function isListingPlatform(platform: string | null | undefined): boolean {
  const normalized = normalizeAuctionPlatform(platform)
  return normalized !== null && LISTING_PLATFORMS.has(normalized)
}

/**
 * Returns the correct content label for a region:
 * US → both auctions and listings, EU/UK/JP → listings only
 */
export function getRegionContentLabel(region: string | null | undefined): "auctions" | "listings" | "mixed" {
  if (!region) return "mixed"
  if (region === "US") return "mixed" // BaT auctions + Classic.com listings
  return "listings" // EU, UK, JP — all listing platforms
}

/**
 * Returns display label for a platform
 */
export function getPlatformTypeLabel(platform: string | null | undefined): string {
  return isAuctionPlatform(platform) ? "Auction" : "Listing"
}

export function filterAuctionsForRegion<T extends { platform: string | null | undefined; region?: string | null | undefined }>(
  auctions: T[],
  selectedRegion: string | null | undefined,
): T[] {
  if (!selectedRegion) return auctions;

  const targetPlatforms = REGION_TO_PLATFORMS[selectedRegion];
  if (!targetPlatforms || targetPlatforms.length === 0) return auctions;

  return auctions.filter((auction) => {
    // Match by region field (set from country by mapRegion) OR by platform
    if (auction.region && auction.region.toUpperCase() === selectedRegion.toUpperCase()) return true;
    const normalized = normalizeAuctionPlatform(auction.platform);
    return normalized !== null && targetPlatforms.includes(normalized);
  });
}
