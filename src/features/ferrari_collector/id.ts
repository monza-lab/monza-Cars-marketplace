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

  if (input.source === "BaT") {
    const m = lower.match(/\/listing\/([^/?#]+)/);
    if (m) return truncateTo200(`bat-${m[1]}`);
  }
  if (input.source === "CarsAndBids") {
    const m = lower.match(/\/auctions\/([^/?#]+)/);
    if (m) return truncateTo200(`cab-${m[1]}`);
  }
  if (input.source === "CollectingCars") {
    const m = lower.match(/\/(cars|lots)\/([^/?#]+)/);
    if (m) return truncateTo200(`cc-${m[2]}`);
  }

  // Stable fallback: sha256 of URL
  return truncateTo200(`${input.source.toLowerCase()}-${sha256Hex(url).slice(0, 32)}`);
}

export function truncateTo200(value: string): string {
  if (value.length <= 200) return value;
  return value.slice(0, 200);
}
