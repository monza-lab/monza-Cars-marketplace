// Shared ExcelJS style constants. Colors mirror the Monza Haus brand.
// ExcelJS uses ARGB strings for colors (alpha + 6-hex).
import type { Alignment, Borders, Fill, Font } from "exceljs"

export const EXCEL_COLORS = {
  brandPrimary: "FFD4738A", // pink
  brandBackground: "FF0E0A0C",
  brandForeground: "FFE8E2DE",
  brandMuted: "FF6B6365",
  border: "FF2A2024",
  // Cell-role palette
  inputCell: "FFDDEBF7", // soft blue — "edit me"
  formulaCell: "FFF2F2F2", // neutral grey — "don't touch"
  dataCell: "FFFFFFFF",
  headerCell: "FF1F2A44",
  headerText: "FFFFFFFF",
} as const

export const EXCEL_FONTS = {
  bodyName: "Calibri",
  monoName: "Consolas",
} as const

// Ready-made style descriptors
export function headerCell(): { font: Partial<Font>; fill: Fill; alignment: Partial<Alignment>; border?: Partial<Borders> } {
  return {
    font: { name: EXCEL_FONTS.bodyName, bold: true, color: { argb: EXCEL_COLORS.headerText }, size: 11 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.headerCell } },
    alignment: { horizontal: "left", vertical: "middle" },
  }
}

export function inputCell(): { font: Partial<Font>; fill: Fill; alignment: Partial<Alignment>; numFmt?: string } {
  return {
    font: { name: EXCEL_FONTS.bodyName, size: 11, color: { argb: "FF1F4E79" } }, // dark blue for input
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.inputCell } },
    alignment: { horizontal: "right", vertical: "middle" },
  }
}

export function formulaCell(): { font: Partial<Font>; fill: Fill; alignment: Partial<Alignment>; numFmt?: string } {
  return {
    font: { name: EXCEL_FONTS.monoName, size: 11, color: { argb: "FF000000" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_COLORS.formulaCell } },
    alignment: { horizontal: "right", vertical: "middle" },
  }
}

export function titleCell(): { font: Partial<Font>; alignment: Partial<Alignment> } {
  return {
    font: { name: EXCEL_FONTS.bodyName, bold: true, size: 16, color: { argb: EXCEL_COLORS.brandPrimary } },
    alignment: { horizontal: "left", vertical: "middle" },
  }
}

export const NUMBER_FMT = {
  usdK: '"$"#,##0"K"',
  usd: '"$"#,##0',
  percent: '0.0%',
  plain: "General",
} as const
