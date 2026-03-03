import crypto from "node:crypto";

/**
 * Extract VIN from a classic.com vehicle URL.
 * URL pattern: /veh/{year}-{make}-{model}-...-{VIN}-{shortId}/
 * VIN is 17 alphanumeric chars (excluding I, O, Q per ISO 3779).
 */
export function extractVinFromUrl(url: string): string | null {
  // Match a 17-char VIN pattern in the URL path
  const match = url.match(/[/-]([A-HJ-NPR-Z0-9]{17})(?:[/-]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Extract the short ID suffix from a classic.com vehicle URL.
 * URL pattern: /veh/...-{shortId}/
 * The shortId is the last path segment (typically 7 chars, alphanumeric).
 */
export function extractClassicComId(url: string): string | null {
  const match = url.match(/\/veh\/[^/]*?-([A-Za-z0-9]{5,10})\/?(?:\?|#|$)/);
  return match ? match[1] : null;
}

/**
 * Derive a stable, deterministic sourceId for deduplication.
 * Priority: VIN > classicComId > URL hash.
 */
export function deriveSourceId(input: {
  vin: string | null;
  classicComId: string | null;
  sourceUrl: string;
}): string {
  if (input.vin && input.vin.length === 17) {
    return `classic-${input.vin}`;
  }

  if (input.classicComId) {
    return `classic-id-${input.classicComId}`;
  }

  const url = canonicalizeUrl(input.sourceUrl);
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 24);
  return `classic-${hash}`;
}

/**
 * Normalize a classic.com URL by stripping tracking params and fragments.
 */
export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://www.classic.com${url}`);
    u.hash = "";
    for (const key of Array.from(u.searchParams.keys())) {
      if (/^utm_/i.test(key) || key === "ref" || key === "fbclid" || key === "gclid") {
        u.searchParams.delete(key);
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}
