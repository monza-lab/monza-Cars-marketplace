import type { OriginCountry } from "./types";
import { sourceToCanonicalMarket } from "@/lib/pricing/canonicalMarket";

const PLATFORM_TO_ORIGIN: Record<string, OriginCountry> = {
  BRING_A_TRAILER: "US",
  CARS_AND_BIDS: "US",
  CLASSIC_COM: "US",
  COLLECTING_CARS: "UK",
  AUTO_SCOUT_24: "DE",
  ELFERSPOT: "DE",
  AUTO_TRADER: "UK",
  BE_FORWARD: "JP",
};

const CANONICAL_TO_ORIGIN: Record<string, OriginCountry> = {
  US: "US",
  EU: "DE",
  UK: "UK",
  JP: "JP",
};

export function sourceToOriginCountry(
  source: string | null | undefined,
): OriginCountry | null {
  if (!source) return null;
  const platformOrigin = PLATFORM_TO_ORIGIN[source];
  if (platformOrigin) return platformOrigin;
  const canonical = sourceToCanonicalMarket(source);
  if (!canonical) return null;
  return CANONICAL_TO_ORIGIN[canonical] ?? null;
}
