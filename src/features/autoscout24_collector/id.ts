import crypto from "node:crypto";

/**
 * Normalize an AutoScout24 URL by stripping tracking params and fragments.
 */
export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://www.autoscout24.com${url}`);
    u.hash = "";
    for (const key of Array.from(u.searchParams.keys())) {
      if (/^utm_/i.test(key) || key === "ref" || key === "fbclid" || key === "cldtidx" || key === "source") {
        u.searchParams.delete(key);
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Extract the listing slug from an AutoScout24 detail URL.
 * URL pattern: /offers/porsche-911-carrera-4s-gasoline-{identifiers}
 */
export function extractListingSlug(url: string): string | null {
  const match = url.match(/\/offers\/([^?#]+)/);
  return match ? match[1] : null;
}

/**
 * Derive a stable, deterministic sourceId for deduplication.
 * Priority: explicit ID > URL slug > URL hash.
 */
export function deriveSourceId(input: {
  sourceId?: string | null;
  sourceUrl: string;
}): string {
  const explicit = (input.sourceId ?? "").trim();
  if (explicit) return truncateTo200(`as24-${explicit}`);

  const slug = extractListingSlug(input.sourceUrl);
  if (slug) return truncateTo200(`as24-${slug}`);

  const url = canonicalizeUrl(input.sourceUrl);
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 32);
  return truncateTo200(`as24-${hash}`);
}

function truncateTo200(value: string): string {
  return value.length <= 200 ? value : value.slice(0, 200);
}
