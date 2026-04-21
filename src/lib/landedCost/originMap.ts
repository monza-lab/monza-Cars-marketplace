import type { OriginCountry } from "./types";
import { sourceToCanonicalMarket } from "@/lib/pricing/canonicalMarket";

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
  const canonical = sourceToCanonicalMarket(source);
  if (!canonical) return null;
  return CANONICAL_TO_ORIGIN[canonical] ?? null;
}
