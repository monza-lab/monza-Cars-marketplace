import { StyleSheet } from "@react-pdf/renderer"
import type { PdfTheme, PdfColorTokens } from "./theme"
import { getPdfTokens } from "./theme"

/**
 * MonzaHaus PDF stylesheet — Heritage Lavender v2.1.
 *
 * `createPdfStyles(theme)` is the modern API that returns a theme-aware
 * StyleSheet. `pdfStyles` and `PDF_COLORS` remain exported (dark default)
 * for backward compatibility with templates that haven't migrated yet.
 */

const FONT_MARK = "Saira"   // wordmark only
const FONT_SERIF = "Cormorant" // display/hero/titles/prices
const FONT_SANS = "Karla"   // body/UI/labels
const FONT_MONO = "Courier" // data (system fallback)

export function createPdfStyles(theme: PdfTheme) {
  const c = getPdfTokens(theme)

  return StyleSheet.create({
    page: {
      backgroundColor: c.background,
      color: c.foreground,
      fontFamily: FONT_SANS,
      fontWeight: 400,
      fontSize: 10,
      // Tighter vertical paddings let multi-page sections breathe less
      // and reduce the trailing-empty-space problem on short chapters.
      paddingTop: 38,
      paddingBottom: 44,
      paddingHorizontal: 48,
      flexDirection: "column",
    },
    pageCover: {
      backgroundColor: c.background,
      color: c.foreground,
      fontFamily: FONT_SANS,
      padding: 0,
      flexDirection: "column",
    },

    // ─── Surfaces ─────────────────────────────────────────────────
    card: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    cardLavender: {
      borderWidth: 1,
      borderColor: c.primaryDeep,
      backgroundColor: c.cardLavender,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    cardSoft: {
      backgroundColor: c.cardWarm,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    },
    cardDashed: {
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
    },

    // ─── Typography hierarchy ─────────────────────────────────────
    // Chapter — extra-large editorial display for section openers.
    chapter: {
      fontFamily: FONT_SERIF,
      fontWeight: 300,
      fontSize: 38,
      letterSpacing: -1,
      color: c.foreground,
      lineHeight: 1.05,
      marginBottom: 4,
    },
    chapterEyebrow: {
      fontFamily: FONT_SANS,
      fontWeight: 500,
      fontSize: 9,
      color: c.primary,
      textTransform: "uppercase",
      letterSpacing: 3.5,
      marginBottom: 10,
    },
    // H1/H2 — within-page hierarchy.
    h1: {
      fontFamily: FONT_SERIF,
      fontWeight: 400,
      fontSize: 26,
      letterSpacing: -0.4,
      color: c.foreground,
      marginBottom: 8,
      lineHeight: 1.15,
    },
    h2: {
      fontFamily: FONT_SERIF,
      fontWeight: 500,
      fontSize: 16,
      letterSpacing: -0.2,
      color: c.foreground,
      marginTop: 14,
      marginBottom: 6,
    },
    h3: {
      fontFamily: FONT_SANS,
      fontWeight: 500,
      fontSize: 8.5,
      color: c.muted,
      textTransform: "uppercase",
      letterSpacing: 2.4,
      marginBottom: 4,
    },
    eyebrow: {
      fontFamily: FONT_SANS,
      fontWeight: 500,
      fontSize: 8,
      color: c.muted,
      textTransform: "uppercase",
      letterSpacing: 2,
    },
    body: {
      fontFamily: FONT_SANS,
      fontWeight: 400,
      fontSize: 10,
      color: c.foreground,
      lineHeight: 1.55,
    },
    bodyEmphasis: {
      fontFamily: FONT_SANS,
      fontWeight: 500,
      fontSize: 10,
      color: c.foreground,
      lineHeight: 1.5,
    },
    bodyMuted: {
      fontFamily: FONT_SANS,
      fontWeight: 400,
      fontSize: 9,
      color: c.muted,
      lineHeight: 1.5,
    },
    lede: {
      fontFamily: FONT_SERIF,
      fontWeight: 400,
      fontSize: 13,
      letterSpacing: -0.1,
      color: c.foreground,
      lineHeight: 1.45,
    },
    mono: {
      fontFamily: FONT_MONO,
      fontSize: 10,
      color: c.foreground,
    },
    monoBold: {
      fontFamily: FONT_MONO,
      fontSize: 12,
      color: c.foreground,
    },
    priceDisplay: {
      fontFamily: FONT_SERIF,
      fontWeight: 500,
      fontSize: 30,
      letterSpacing: -0.6,
      color: c.foreground,
    },
    priceLarge: {
      fontFamily: FONT_SERIF,
      fontWeight: 500,
      fontSize: 44,
      letterSpacing: -1.0,
      color: c.foreground,
    },

    // ─── Layout helpers ──────────────────────────────────────────
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
    rowStart: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    divider: {
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      marginVertical: 12,
    },
    dividerSoft: {
      borderBottomWidth: 1,
      borderBottomColor: c.borderSoft,
      marginVertical: 8,
    },

    // ─── Verdict chip ────────────────────────────────────────────
    verdictChip: {
      paddingHorizontal: 18,
      paddingVertical: 7,
      borderRadius: 22,
      borderWidth: 2,
      fontFamily: FONT_SANS,
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: 3.5,
      textAlign: "center",
      alignSelf: "center",
    },

    // ─── Footer ──────────────────────────────────────────────────
    pageFooter: {
      position: "absolute",
      bottom: 24,
      left: 48,
      right: 48,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 10,
      fontFamily: FONT_SANS,
      fontWeight: 400,
      fontSize: 7.5,
      color: c.muted,
      letterSpacing: 0.3,
    },

    // ─── Tags / chips ────────────────────────────────────────────
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: c.border,
      fontFamily: FONT_SANS,
      fontWeight: 500,
      fontSize: 7.5,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: c.muted,
      alignSelf: "flex-start",
    },
    tagPrimary: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      backgroundColor: c.primaryVeil,
      fontFamily: FONT_SANS,
      fontWeight: 500,
      fontSize: 7.5,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: c.primary,
      alignSelf: "flex-start",
    },
  })
}

/**
 * Verdict pill color set, theme-aware.
 */
export function verdictColorsForTheme(
  verdict: "BUY" | "WATCH" | "WALK" | "PENDING",
  theme: PdfTheme,
) {
  const c = getPdfTokens(theme)
  if (verdict === "BUY") return { color: c.positive, borderColor: c.positive }
  if (verdict === "WALK") return { color: c.negative, borderColor: c.negative }
  if (verdict === "PENDING") return { color: c.muted, borderColor: c.muted }
  return { color: c.warning, borderColor: c.warning }
}

/**
 * Re-export tokens for convenience in templates.
 */
export function getThemeTokens(theme: PdfTheme): PdfColorTokens {
  return getPdfTokens(theme)
}

// ──────────────────────────────────────────────────────────────────
// Backward-compatible exports — default to dark theme for any
// template that hasn't migrated to `createPdfStyles(theme)` yet.
// ──────────────────────────────────────────────────────────────────

export const PDF_COLORS = {
  ...getPdfTokens("dark"),
}

export const pdfStyles = createPdfStyles("dark")

export function verdictColors(verdict: "BUY" | "WATCH" | "WALK" | "PENDING") {
  return verdictColorsForTheme(verdict, "dark")
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
