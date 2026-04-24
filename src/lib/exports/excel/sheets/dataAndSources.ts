import type { Workbook, Worksheet } from "exceljs"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { RegionalMarketStats } from "@/lib/reports/types"
import type { DbComparableRow } from "@/lib/db/queries"
import {
  EXCEL_COLORS,
  EXCEL_FONTS,
  applyWarmBackground,
  dataCell,
  headerCell,
  sectionLabelCell,
  titleCell,
} from "../styles"

const TABLE_FIRST_COL = 2 // start tables in column B (A is a thin gutter)
const TABLE_LAST_COL = 6

function addTableHeader(ws: Worksheet, row: number, headers: string[]): void {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, TABLE_FIRST_COL + i)
    cell.value = h
    Object.assign(cell, headerCell())
  })
  ws.getRow(row).height = 22
}

function sectionBanner(ws: Worksheet, row: number, title: string): void {
  // Paint the banner across all 5 table columns so the header strip reads as a
  // single continuous band instead of only the first cell.
  for (let c = TABLE_FIRST_COL; c <= TABLE_LAST_COL; c++) {
    Object.assign(ws.getCell(row, c), headerCell())
  }
  ws.getCell(row, TABLE_FIRST_COL).value = title
  ws.mergeCells(row, TABLE_FIRST_COL, row, TABLE_LAST_COL)
  ws.getRow(row).height = 22
}

function paintDataRow(ws: Worksheet, row: number): void {
  for (let c = TABLE_FIRST_COL; c <= TABLE_LAST_COL; c++) {
    const cell = ws.getCell(row, c)
    const style = dataCell()
    // Preserve any numFmt / value already set — only apply font + fill +
    // alignment from the role style.
    cell.font = { ...style.font }
    cell.fill = style.fill
    // Rank column (first col) is centered; everything else left-aligned.
    cell.alignment = {
      ...style.alignment,
      horizontal: c === TABLE_FIRST_COL ? "center" : "left",
      vertical: "middle",
    }
  }
}

export function buildDataAndSourcesSheet(
  wb: Workbook,
  report: HausReportV2,
  regions: RegionalMarketStats[],
  comparables: DbComparableRow[],
): void {
  const ws = wb.addWorksheet("Data & Sources", {
    properties: { tabColor: { argb: EXCEL_COLORS.brandMuted } },
    views: [{ showGridLines: false, state: "normal" }],
  })

  ws.columns = [
    { width: 4 },
    { width: 38 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 38 },
  ]

  let row = 1
  ws.getCell(`B${row}`).value = "DATA & SOURCES"
  Object.assign(ws.getCell(`B${row}`), titleCell())
  row++
  ws.getCell(`B${row}`).value =
    "Every number in the Haus Report traces back to a source row on this sheet"
  Object.assign(ws.getCell(`B${row}`), sectionLabelCell())
  row += 2

  // Comparables
  sectionBanner(ws, row, "Comparables")
  row++
  const compHeaderRow = row
  addTableHeader(ws, row, ["#", "Title", "Mileage", "Sold (USD)", "Sold date", "Platform"])
  row++
  comparables.forEach((c, i) => {
    ws.getCell(row, 1).value = i + 1
    ws.getCell(row, 2).value = c.title
    ws.getCell(row, 3).value = c.mileage
    ws.getCell(row, 4).value = c.soldPrice
    ws.getCell(row, 4).numFmt = '"$"#,##0'
    ws.getCell(row, 5).value = c.soldDate
    ws.getCell(row, 6).value = c.platform
    paintDataRow(ws, row)
    row++
  })
  if (comparables.length > 0) {
    ws.autoFilter = {
      from: { row: compHeaderRow, column: 1 },
      to: { row: row - 1, column: 6 },
    }
  }

  row++
  sectionBanner(ws, row, "Signals Detected")
  row++
  addTableHeader(ws, row, ["#", "Signal", "Value", "Source type", "Confidence", "Source ref"])
  row++
  report.signals_detected.forEach((s, i) => {
    ws.getCell(row, 1).value = i + 1
    ws.getCell(row, 2).value = s.key
    ws.getCell(row, 3).value = s.value_display
    ws.getCell(row, 4).value = s.evidence.source_type
    ws.getCell(row, 5).value = s.evidence.confidence
    ws.getCell(row, 6).value = s.evidence.source_ref
    paintDataRow(ws, row)
    row++
  })

  row++
  sectionBanner(ws, row, "Modifiers Applied")
  row++
  addTableHeader(ws, row, ["#", "Modifier key", "Delta %", "USD contribution", "Signal", "Citation"])
  row++
  report.modifiers_applied.forEach((m, i) => {
    ws.getCell(row, 1).value = i + 1
    ws.getCell(row, 2).value = m.key
    ws.getCell(row, 3).value = m.delta_percent / 100
    ws.getCell(row, 3).numFmt = "0.0%"
    ws.getCell(row, 4).value = m.baseline_contribution_usd
    ws.getCell(row, 4).numFmt = '"$"#,##0'
    ws.getCell(row, 5).value = m.signal_key
    if (m.citation_url) {
      ws.getCell(row, 6).value = { text: m.citation_url, hyperlink: m.citation_url }
    }
    paintDataRow(ws, row)
    // Citation hyperlink: rebrand after paintDataRow overwrote the font
    if (m.citation_url) {
      ws.getCell(row, 6).font = {
        name: EXCEL_FONTS.bodyName,
        size: 11,
        color: { argb: EXCEL_COLORS.brandPrimary },
        underline: true,
      }
    }
    row++
  })

  row++
  sectionBanner(ws, row, "Regional Market Stats")
  row++
  addTableHeader(ws, row, ["#", "Region", "Median (USD)", "Sample", "Trend", "Capture range"])
  row++
  regions.forEach((r, i) => {
    ws.getCell(row, 1).value = i + 1
    ws.getCell(row, 2).value = r.region
    ws.getCell(row, 3).value = r.medianPriceUsd
    ws.getCell(row, 3).numFmt = '"$"#,##0'
    ws.getCell(row, 4).value = r.totalListings
    ws.getCell(row, 5).value = r.trendDirection
    ws.getCell(row, 6).value = `${r.oldestDate} – ${r.newestDate}`
    paintDataRow(ws, row)
    row++
  })

  row++
  sectionBanner(ws, row, "Methodology")
  row++
  ws.getCell(row, TABLE_FIRST_COL).value =
    "Fair Value is the median of variant sold comparables, adjusted by up to twelve modifiers (individually capped at ±15%, aggregate at ±35%). Every claim carries a verifiable source. See monzahaus.com/methodology for details."
  ws.getCell(row, TABLE_FIRST_COL).alignment = { wrapText: true, vertical: "top" }
  ws.getCell(row, TABLE_FIRST_COL).font = {
    name: EXCEL_FONTS.bodyName,
    size: 11,
    color: { argb: EXCEL_COLORS.brandForeground },
    italic: true,
  }
  ws.getRow(row).height = 60
  ws.mergeCells(row, TABLE_FIRST_COL, row, TABLE_LAST_COL)

  applyWarmBackground(ws, row, TABLE_LAST_COL)
}
