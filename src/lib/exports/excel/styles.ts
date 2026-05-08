// Shared ExcelJS style constants. Colors mirror the MonzaHaus brand v2.1.
// ExcelJS uses ARGB strings for colors (alpha + 6-hex).
//
// Brand rules (monzahaus-brand-manual v2.1 — Heritage Lavender):
// - Excel is always LIGHT editorial (rule: brand artifact, not theme-responsive).
// - NEVER pure white (#FFFFFF) — use Warm Cream (#FDFBF9).
// - NEVER blue / navy-black — use Ink (#141413).
// - NEVER red for negative — use Burnt Orange (#FB923C).
// - Accents: Lavender Deep (#D6BEDC) for accents on the warm sheet bg;
//   Heritage Lavender (#E1CCE5) for highlights and tab colors;
//   Lavender Ink Deep (#3F2A47) for text on lavender fills.
import type { Alignment, Borders, Fill, Font, Worksheet } from "exceljs"

export const EXCEL_COLORS = {
  // Brand accent — Heritage Lavender (v2.1)
  brandPrimary: "FFD6BEDC",      // Lavender Deep (CTAs / accent on warm cream)
  brandRose: "FFE1CCE5",         // Heritage Lavender (kept the property name to
                                  // avoid breaking call sites; value updated)
  brandLavenderInk: "FF5D3F66",  // Lavender Ink (text on lavender fills, captions)
  brandLavenderInkDeep: "FF3F2A47", // Lavender Ink Deep (strong contrast)
  // Text
  brandForeground: "FF141413",   // Ink (v2.1 — replaces Dark Espresso)
  brandMuted: "FF9A8E88",        // Stone (muted labels)
  // Surfaces
  warmCream: "FFFDFBF9",         // Warm Cream (default data background)
  softBeige: "FFF5F2EE",         // Soft Beige (formula / reference tables)
  warmBorder: "FFE8E2DC",        // Warm Border
  lavenderVeil: "FFF1E6F3",      // Lavender Veil (subtle accent surfaces)
  // Header strip — Ink, not navy
  headerBg: "FF141413",
  headerText: "FFFDFBF9",
  // Cell-role palette
  inputBg: "FFF1E6F3",           // Lavender Veil — "edit me" (replaces warm rose-tint)
  inputText: "FF3F2A47",         // Lavender Ink Deep (editable values stand out, text on lavender)
  formulaBg: "FFF5F2EE",         // Soft Beige — "don't touch, live formula"
  formulaText: "FF141413",       // Ink
  dataBg: "FFFDFBF9",            // Warm Cream — default data
} as const

export const EXCEL_FONTS = {
  // Brand would be Cormorant/Karla, but Excel can't bundle webfonts reliably.
  // Calibri stays as the body fallback; the brand identity is carried by color
  // and hierarchy instead. Numerical cells use the bundled monospace.
  bodyName: "Calibri",
  monoName: "Consolas",
} as const

// Ready-made style descriptors
export function headerCell(): {
  font: Partial<Font>
  fill: Fill
  alignment: Partial<Alignment>
  border?: Partial<Borders>
} {
  return {
    font: {
      name: EXCEL_FONTS.bodyName,
      bold: true,
      color: { argb: EXCEL_COLORS.headerText },
      size: 11,
    },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.headerBg } },
    alignment: { horizontal: "left", vertical: "middle", indent: 1 },
  }
}

export function inputCell(): {
  font: Partial<Font>
  fill: Fill
  alignment: Partial<Alignment>
  numFmt?: string
} {
  return {
    font: {
      name: EXCEL_FONTS.bodyName,
      size: 11,
      bold: true,
      color: { argb: EXCEL_COLORS.inputText },
    },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.inputBg } },
    alignment: { horizontal: "right", vertical: "middle" },
  }
}

export function formulaCell(): {
  font: Partial<Font>
  fill: Fill
  alignment: Partial<Alignment>
  numFmt?: string
} {
  return {
    font: {
      name: EXCEL_FONTS.monoName,
      size: 11,
      color: { argb: EXCEL_COLORS.formulaText },
    },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.formulaBg } },
    alignment: { horizontal: "right", vertical: "middle" },
  }
}

export function dataCell(): {
  font: Partial<Font>
  fill: Fill
  alignment: Partial<Alignment>
} {
  return {
    font: {
      name: EXCEL_FONTS.bodyName,
      size: 11,
      color: { argb: EXCEL_COLORS.brandForeground },
    },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.dataBg } },
    alignment: { horizontal: "left", vertical: "middle" },
  }
}

export function titleCell(): { font: Partial<Font>; alignment: Partial<Alignment> } {
  return {
    font: {
      name: EXCEL_FONTS.bodyName,
      bold: true,
      size: 18,
      color: { argb: EXCEL_COLORS.brandPrimary },
    },
    alignment: { horizontal: "left", vertical: "middle" },
  }
}

export function sectionLabelCell(): {
  font: Partial<Font>
  alignment: Partial<Alignment>
} {
  return {
    font: {
      name: EXCEL_FONTS.bodyName,
      bold: true,
      size: 9,
      color: { argb: EXCEL_COLORS.brandMuted },
    },
    alignment: { horizontal: "left", vertical: "middle" },
  }
}

// Paint Warm Cream across every cell in the used range that doesn't already
// carry an explicit fill. Call once at the end of a sheet so headers and
// role-painted cells keep their color and everything else picks up the warm bg.
export function applyWarmBackground(
  ws: Worksheet,
  lastRow: number,
  lastCol: number,
): void {
  for (let r = 1; r <= lastRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c)
      if (!cell.fill || cell.fill.type !== "pattern") {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: EXCEL_COLORS.dataBg },
        }
      }
    }
  }
}

export const NUMBER_FMT = {
  usdK: '"$"#,##0"K"',
  usd: '"$"#,##0',
  percent: "0.0%",
  plain: "General",
} as const
