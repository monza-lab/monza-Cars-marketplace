/**
 * Shared formatting helpers for PDF templates.
 * All output is human-readable — never raw enum or snake_case values.
 */

/**
 * Convert snake_case, kebab-case, or lowercase enum values to Title Case.
 * Preserves all-uppercase acronyms (PMP, FIA, OEM, VIN, USA, EU, UK).
 *
 *   "very_high"     → "Very High"
 *   "above_average" → "Above Average"
 *   "moderate"      → "Moderate"
 *   "PMP stock"     → "PMP Stock"
 *   "FIA-approved"  → "FIA Approved"
 *   "OEM"           → "OEM"
 */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—"
  return value
    .toString()
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word
      // Preserve acronyms (2+ chars, all uppercase already)
      if (word.length >= 2 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)) {
        return word
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(" ")
}

/**
 * Capitalize only the first letter — for names like make ("porsche" → "Porsche").
 */
export function capitalize(value: string | null | undefined): string {
  if (!value) return ""
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Title-case a full vehicle title: capitalize each significant word.
 *   "2024 porsche 911 GT3 R Rennsport" → "2024 Porsche 911 GT3 R Rennsport"
 * Leaves UPPERCASE acronyms (GT3, RS, S/T) intact.
 */
export function titleCaseVehicle(title: string | null | undefined): string {
  if (!title) return ""
  return title
    .split(" ")
    .map((word) => {
      if (!word) return word
      // Leave acronyms (≥2 chars all uppercase) as-is
      if (word.length >= 2 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word
      // Leave model numbers (992, 911) as-is
      if (/^\d+$/.test(word)) return word
      // Title case otherwise
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(" ")
}

/**
 * Compact currency formatter: $918K, $1.2M, etc.
 */
export function fmtCurrency(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—"
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1000) return `$${Math.round(v / 1000)}K`
  return `$${Math.round(v).toLocaleString("en-US")}`
}

/**
 * Format a full USD amount with commas (used in tables).
 */
export function fmtCurrencyFull(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—"
  const sign = v < 0 ? "-" : ""
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`
}

/**
 * Format a delta percent with sign: +12.3%, -4.5%, +0.0%.
 */
export function fmtDelta(percent: number | null | undefined): string {
  if (percent == null || !Number.isFinite(percent)) return "—"
  const sign = percent >= 0 ? "+" : ""
  return `${sign}${percent.toFixed(1)}%`
}

/**
 * Shorten a URL to its domain + a clean label.
 *   "https://www.hagerty.com/media/market-trends/porsche-paint-to-sample-values/"
 *     → { domain: "hagerty.com", path: "Paint To Sample Values" }
 */
export function shortenUrl(url: string | null | undefined): { domain: string; path: string } {
  if (!url) return { domain: "", path: "" }
  try {
    const u = new URL(url)
    const domain = u.hostname.replace(/^www\./, "")
    // Take the last meaningful path segment, replace hyphens with spaces, title-case.
    const lastSegment = u.pathname.split("/").filter(Boolean).pop() ?? ""
    const path = humanize(lastSegment.replace(/\.[a-z]+$/i, ""))
    return { domain, path }
  } catch {
    return { domain: url, path: "" }
  }
}

/**
 * Format an ISO date as a readable string: "May 12, 2026".
 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

/**
 * Truncate text to a max length with an ellipsis.
 */
export function truncate(text: string | null | undefined, max: number): string {
  if (!text) return ""
  if (text.length <= max) return text
  return `${text.slice(0, max).trim()}…`
}
