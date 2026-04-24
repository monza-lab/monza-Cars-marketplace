import { StyleSheet } from "@react-pdf/renderer"

// Monza Haus brand palette — dark-mode PDF per brand manual v2.0.
// Exact hex values verified against monzahaus-brand-manual v2.0 (see
// skills/monzahaus-branding). NEVER use pure white, blue-black, or red.
export const PDF_COLORS = {
  // Base surface
  background: "#0E0A0C",        // Obsidian
  card: "#161113",              // Obsidian Card
  cardWarm: "#1A1315",          // slight warm tint for inner surfaces
  // Text
  foreground: "#E8E2DE",        // Bone / Warm White
  muted: "#6B6365",             // Cool Gray
  mutedStrong: "#8B8386",       // raised-prominence muted for sub-labels
  // Accent
  primary: "#D4738A",           // Salon Rose (dark-mode accent)
  primaryDeep: "#7A2E4A",       // Salon Burgundy (pressed / gradient stop)
  primaryForeground: "#FFFFFF",
  // Financial indicators (brand: NEVER red for negative)
  positive: "#34D399",          // Emerald Mint
  negative: "#FB923C",          // Burnt Orange (instead of red)
  warning: "#FBBF24",           // Amber
  // Structural
  border: "#2A2226",            // Dark Border
  borderSoft: "#201619",        // quieter divider
} as const

// Brand typography — Cormorant (serif, display) + Karla (sans, body).
// Registered via src/lib/exports/pdf/fonts.ts at runtime; if registration
// fails the fontFamily strings still resolve to the registered families.
const FONT_SERIF = "Cormorant"
const FONT_SANS = "Karla"
const FONT_MONO = "Courier" // built-in fallback for numerical data

export const pdfStyles = StyleSheet.create({
  page: {
    backgroundColor: PDF_COLORS.background,
    color: PDF_COLORS.foreground,
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 10,
    padding: 36,
    flexDirection: "column",
  },
  // Card layouts
  card: {
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    backgroundColor: PDF_COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardDashed: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: PDF_COLORS.border,
    backgroundColor: PDF_COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  // Typography — editorial hierarchy
  wordmark: {
    fontFamily: FONT_SERIF,
    fontWeight: 500,
    fontSize: 14,
    letterSpacing: 3,
    color: PDF_COLORS.primary,
  },
  h1: {
    fontFamily: FONT_SERIF,
    fontWeight: 400,
    fontSize: 28,
    letterSpacing: -0.3,
    color: PDF_COLORS.foreground,
    marginBottom: 6,
  },
  h2: {
    fontFamily: FONT_SERIF,
    fontWeight: 500,
    fontSize: 16,
    letterSpacing: -0.2,
    color: PDF_COLORS.foreground,
    marginTop: 14,
    marginBottom: 6,
  },
  h3: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: 9,
    color: PDF_COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 4,
  },
  body: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 10,
    color: PDF_COLORS.foreground,
    lineHeight: 1.55,
  },
  bodyEmphasis: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: 10,
    color: PDF_COLORS.foreground,
    lineHeight: 1.5,
  },
  bodyMuted: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 9,
    color: PDF_COLORS.muted,
    lineHeight: 1.45,
  },
  mono: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: PDF_COLORS.foreground,
  },
  monoBold: {
    fontFamily: FONT_MONO,
    fontSize: 14,
    color: PDF_COLORS.foreground,
  },
  priceDisplay: {
    // Serif display for prices, per brand "Price: Cormorant 500".
    fontFamily: FONT_SERIF,
    fontWeight: 500,
    fontSize: 26,
    letterSpacing: -0.5,
    color: PDF_COLORS.foreground,
  },
  // Layout helpers
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowSpread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    marginVertical: 10,
  },
  // Verdict chip
  verdictChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    fontFamily: FONT_SANS,
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 3,
    textAlign: "center",
    alignSelf: "center",
  },
  // Footer (every page)
  pageFooter: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    paddingTop: 8,
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: 8,
    color: PDF_COLORS.muted,
  },
})

export function verdictColors(verdict: "BUY" | "WATCH" | "WALK") {
  if (verdict === "BUY")
    return { color: PDF_COLORS.positive, borderColor: PDF_COLORS.positive }
  if (verdict === "WALK")
    return { color: PDF_COLORS.negative, borderColor: PDF_COLORS.negative }
  return { color: PDF_COLORS.warning, borderColor: PDF_COLORS.warning }
}

export function fmtK(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—"
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  return `$${Math.round(v / 1000)}K`
}

export function fmtDate(iso: string): string {
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
