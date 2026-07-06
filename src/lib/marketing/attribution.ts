export const ATTRIBUTION_STORAGE_KEY = "monzahaus_first_touch_attribution"

const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000

export interface AttributionSnapshot {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  fbclid: string | null
  landing_path: string
  referrer: string | null
  first_seen_at: string
}

function normalizeString(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, 500) : null
}

function parseStored(value: string | null): AttributionSnapshot | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<AttributionSnapshot>
    if (!parsed.first_seen_at || !parsed.landing_path) return null
    return {
      utm_source: normalizeString(parsed.utm_source ?? null),
      utm_medium: normalizeString(parsed.utm_medium ?? null),
      utm_campaign: normalizeString(parsed.utm_campaign ?? null),
      utm_term: normalizeString(parsed.utm_term ?? null),
      utm_content: normalizeString(parsed.utm_content ?? null),
      fbclid: normalizeString(parsed.fbclid ?? null),
      landing_path: normalizeString(parsed.landing_path) ?? "/",
      referrer: normalizeString(parsed.referrer ?? null),
      first_seen_at: parsed.first_seen_at,
    }
  } catch {
    return null
  }
}

function isFresh(snapshot: AttributionSnapshot, now = Date.now()): boolean {
  const firstSeen = Date.parse(snapshot.first_seen_at)
  return Number.isFinite(firstSeen) && now - firstSeen <= ATTRIBUTION_TTL_MS
}

function hasAttributionSignal(url: URL, referrer: string | null): boolean {
  return (
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid"]
      .some((key) => url.searchParams.has(key)) ||
    Boolean(referrer)
  )
}

export function buildAttributionSnapshot(
  url: URL,
  referrer: string | null = null,
  now = new Date(),
): AttributionSnapshot {
  return {
    utm_source: normalizeString(url.searchParams.get("utm_source")),
    utm_medium: normalizeString(url.searchParams.get("utm_medium")),
    utm_campaign: normalizeString(url.searchParams.get("utm_campaign")),
    utm_term: normalizeString(url.searchParams.get("utm_term")),
    utm_content: normalizeString(url.searchParams.get("utm_content")),
    fbclid: normalizeString(url.searchParams.get("fbclid")),
    landing_path: `${url.pathname}${url.search}`,
    referrer: normalizeString(referrer),
    first_seen_at: now.toISOString(),
  }
}

export function readStoredAttribution(): AttributionSnapshot | null {
  if (typeof window === "undefined") return null
  const snapshot = parseStored(window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY))
  if (!snapshot) return null
  if (isFresh(snapshot)) return snapshot
  window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY)
  return null
}

export function captureAttributionFromLocation(
  url: URL,
  referrer: string | null = null,
): AttributionSnapshot | null {
  if (typeof window === "undefined") return null
  const existing = readStoredAttribution()
  if (existing) return existing
  if (!hasAttributionSignal(url, referrer)) return null

  const snapshot = buildAttributionSnapshot(url, referrer)
  window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(snapshot))
  return snapshot
}

export function captureAttributionFromBrowser(): AttributionSnapshot | null {
  if (typeof window === "undefined") return null
  return captureAttributionFromLocation(
    new URL(window.location.href),
    document.referrer || null,
  )
}
