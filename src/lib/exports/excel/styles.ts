// Shared ExcelJS style constants. Colors mirror the Monza Haus brand.
// ExcelJS uses ARGB strings for colors (alpha + 6-hex).
//
// Brand rules (monzahaus-brand-manual v2.0):
// - NEVER pure white (#FFFFFF) — use Warm Cream (#FDFBF9).
// - NEVER blue / navy-black — use Dark Espresso (#2A2320) or Obsidian Card (#161113).
// - NEVER red for negative — use Burnt Orange (#FB923C).
// - Accents: Salon Burgundy (#7A2E4A) on light, Salon Rose (#D4738A) on dark.
import type { Alignment, Borders, Fill, Font, Worksheet } from "exceljs"

export const EXCEL_COLORS = {
  // Brand accent
  brandPrimary: "FF7A2E4A",      // Salon Burgundy (accent on the warm sheet bg)
  brandRose: "FFD4738A",         // Salon Rose (tab color, highlights)
  // Text
  brandForeground: "FF2A2320",   // Dark Espresso (body text on warm bg)
  brandMuted: "FF9A8E88",        // Museum Gray (muted labels)
  // Surfaces
  warmCream: "FFFDFBF9",         // Warm Cream (default data background)
  softBeige: "FFF5F2EE",         // Soft Beige (formula / reference tables)
  warmBorder: "FFE8E2DC",        // Warm Border
  // Header strip (dark espresso, not navy)
  headerBg: "FF2A2320",
  headerText: "FFFDFBF9",
  // Cell-role palette
  inputBg: "FFFBF2F4",           // Warm rose-tint — "edit me"
  inputText: "FF7A2E4A",         // Salon Burgundy (editable values stand out)
  formulaBg: "FFF5F2EE",         // Soft Beige — "don't touch, live formula"
  formulaText: "FF2A2320",       // Dark Espresso
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
