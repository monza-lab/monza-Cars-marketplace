/**
 * MonzaHaus PDF theme tokens — Heritage Lavender v2.1
 *
 * Two themes: `dark` (noir) and `light` (warm cream).
 * Both follow the MonzaHaus brand manual v2.1.
 *
 * Rule: NEVER use pure white, pure black, blue-black, or red.
 */

export type PdfTheme = "light" | "dark"

export interface PdfColorTokens {
  // Surfaces
  background: string
  card: string
  cardWarm: string
  cardLavender: string
  // Text
  foreground: string
  muted: string
  mutedStrong: string
  // Accent — Heritage Lavender family
  primary: string         // Heritage Lavender on dark / Lavender Deep on light
  primaryDeep: string     // Lavender Deep on dark / Lavender Ink on light
  primaryInk: string      // Lavender Ink Deep — strong text on lavender bg
  primaryVeil: string     // Lavender Veil — subtle bg
  // Financial indicators
  positive: string
  negative: string
  warning: string
  // Structural
  border: string
  borderSoft: string
}

/**
 * Dark mode — Noir editorial (brand default for evening / collector salon feel).
 */
const DARK: PdfColorTokens = {
  background: "#0E0E0D",     // Noir
  card: "#161114",           // Noir Card
  cardWarm: "#1A1418",       // slight warm tint
  cardLavender: "#1F1721",   // lavender-tinted card for hero blocks
  foreground: "#E8E2DE",     // Bone / Warm White
  muted: "#6B6365",          // Stone Dark
  mutedStrong: "#8B8386",
  primary: "#E1CCE5",        // Heritage Lavender — vivid on noir
  primaryDeep: "#D6BEDC",    // Lavender Deep
  primaryInk: "#3F2A47",     // Lavender Ink Deep
  primaryVeil: "#221A26",    // subtle lavender wash on dark
  positive: "#34D399",
  negative: "#FB923C",
  warning: "#FBBF24",
  border: "#2A2226",
  borderSoft: "#201619",
}

/**
 * Light mode — Warm Cream editorial (gallery daylight feel).
 */
const LIGHT: PdfColorTokens = {
  background: "#FDFBF9",     // Warm Cream — never pure white
  card: "#F5F2EE",           // Soft Beige
  cardWarm: "#F8F4F0",       // softer beige
  cardLavender: "#F1E6F3",   // Lavender Veil
  foreground: "#141413",     // Ink
  muted: "#9A8E88",          // Stone
  mutedStrong: "#5D3F66",    // Lavender Ink for muted-strong on light
  primary: "#D6BEDC",        // Lavender Deep — primary on light bg
  primaryDeep: "#B89FBE",    // Lavender Mid
  primaryInk: "#3F2A47",     // Lavender Ink Deep
  primaryVeil: "#F1E6F3",    // Lavender Veil bg
  positive: "#15803D",       // deeper green for contrast on cream
  negative: "#C2410C",       // burnt orange — deeper for cream contrast
  warning: "#B45309",        // amber-deep for cream contrast
  border: "#E8E2DC",         // Warm Border
  borderSoft: "#EFEAE4",
}

export function getPdfTokens(theme: PdfTheme): PdfColorTokens {
  return theme === "light" ? LIGHT : DARK
}

/**
 * Helmet (casco) glyph colors per surface — used by the Wordmark component.
 *
 * In dark surfaces we use Lavender Ink Deep (#3F2A47) for the visor/strap
 * instead of pure noir so the helmet's interior reads distinctly against
 * a noir background (the canonical brand SVG includes a noir rect behind
 * the helmet to provide that contrast; we render without that rect).
 */
export function getHelmetColors(theme: PdfTheme): {
  shell: string
  visor: string
  strap: string
} {
  if (theme === "light") {
    return { shell: "#D6BEDC", visor: "#0E0E0D", strap: "#0E0E0D" }
  }
  return { shell: "#E1CCE5", visor: "#3F2A47", strap: "#3F2A47" }
}
