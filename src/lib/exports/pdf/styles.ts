import { StyleSheet } from "@react-pdf/renderer"

// Monza Haus brand palette (mirrors src/lib/brandConfig.ts where possible).
// Using Helvetica + Helvetica-Bold (react-pdf built-ins) to avoid font-loading
// complexity in Phase 4. A follow-on task can register Playfair Display for
// display headlines once we commit to a font-file delivery strategy.
export const PDF_COLORS = {
  background: "#0E0A0C",
  card: "#161113",
  foreground: "#E8E2DE",
  muted: "#6B6365",
  primary: "#D4738A",
  primaryForeground: "#FFFFFF",
  positive: "#7EB88A",
  destructive: "#C75C6B",
  amber: "#D4A373",
  border: "#2A2024",
} as const

export const pdfStyles = StyleSheet.create({
  page: {
    backgroundColor: PDF_COLORS.background,
    color: PDF_COLORS.foreground,
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 36,
    flexDirection: "column",
  },
  // Card layouts
  card: {
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    backgroundColor: PDF_COLORS.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  cardDashed: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: PDF_COLORS.border,
    backgroundColor: PDF_COLORS.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  // Typography
  h1: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.foreground,
    marginBottom: 6,
  },
  h2: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.foreground,
    marginTop: 14,
    marginBottom: 6,
  },
  h3: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  body: {
    fontSize: 10,
    color: PDF_COLORS.foreground,
    lineHeight: 1.5,
  },
  bodyMuted: {
    fontSize: 9,
    color: PDF_COLORS.muted,
    lineHeight: 1.4,
  },
  mono: {
    fontFamily: "Courier",
    fontSize: 10,
  },
  monoBold: {
    fontFamily: "Courier-Bold",
    fontSize: 12,
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    letterSpacing: 2,
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
    fontSize: 8,
    color: PDF_COLORS.muted,
  },
})

export function verdictColors(verdict: "BUY" | "WATCH" | "WALK") {
  if (verdict === "BUY")
    return { color: PDF_COLORS.positive, borderColor: PDF_COLORS.positive }
  if (verdict === "WALK")
    return { color: PDF_COLORS.destructive, borderColor: PDF_COLORS.destructive }
  return { color: PDF_COLORS.amber, borderColor: PDF_COLORS.amber }
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
