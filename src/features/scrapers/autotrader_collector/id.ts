import { sha256Hex } from "./normalize";
import type { SourceKey } from "./types";

export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    // Keep query because sometimes it encodes lot/source id, but for these marketplaces it usually doesn't.
    // Still, strip known tracking params to improve stability.
    for (const key of Array.from(u.searchParams.keys())) {
      if (/^utm_/i.test(key) || key === "ref" || key === "fbclid") u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function deriveSourceId(input: {
  source: SourceKey;
  sourceId?: string | null;
  sourceUrl: string;
}): string {
  const explicit = (input.sourceId ?? "").trim();
  if (explicit) return truncateTo200(explicit);

  const url = canonicalizeUrl(input.sourceUrl);
  const lower = url.toLowerCase();

  if (input.source === "AutoTrader") {
    // AutoTrader URL patterns:
    // /car-details/2023-Porsche-911/123456789
    // /vehicle/2023-porsche-911-12345678
    // /used-car/porsche/911/12345678
    const carDetailsMatch = lower.match(/\/car-details\/[^/]+\/(\d+)/);
    if (carDetailsMatch) return truncateTo200(`at-${carDetailsMatch[1]}`);
    
    const vehicleMatch = lower.match(/\/vehicle\/[^/]+-(\d+)/);
    if (vehicleMatch) return truncateTo200(`at-${vehicleMatch[1]}`);
    
    const usedCarMatch = lower.match(/\/used-car\/[^/]+\/[^/]+\/(\d+)/);
    if (usedCarMatch) return truncateTo200(`at-${usedCarMatch[1]}`);
  }

  // Stable fallback: sha256 of URL
  return truncateTo200(`${input.source.toLowerCase()}-${sha256Hex(url).slice(0, 32)}`);
}

export function truncateTo200(value: string): string {
  if (value.length <= 200) return value;
  return value.slice(0, 200);
}
