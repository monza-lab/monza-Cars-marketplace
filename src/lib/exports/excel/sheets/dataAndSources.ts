import type { Workbook, Worksheet } from "exceljs"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { RegionalMarketStats } from "@/lib/reports/types"
import type { DbComparableRow } from "@/lib/db/queries"
import { EXCEL_COLORS, headerCell, titleCell } from "../styles"

function addTableHeader(ws: Worksheet, row: number, headers: string[]): void {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1)
    cell.value = h
    Object.assign(cell, headerCell())
  })
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

  ws.columns = [{ width: 4 }, { width: 36 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 36 }]

  let row = 1
  ws.getCell(`B${row}`).value = "DATA & SOURCES"
  Object.assign(ws.getCell(`B${row}`), titleCell())
  row += 2

  // Comparables table (native Excel filter enabled)
  ws.getCell(`B${row}`).value = "Comparables"
  Object.assign(ws.getCell(`B${row}`), headerCell())
  ws.mergeCells(`B${row}:F${row}`)
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
    row++
  })
  if (comparables.length > 0) {
    ws.autoFilter = {
      from: { row: compHeaderRow, column: 1 },
      to: { row: row - 1, column: 6 },
    }
  }

  row++
  ws.getCell(`B${row}`).value = "Signals Detected"
  Object.assign(ws.getCell(`B${row}`), headerCell())
  ws.mergeCells(`B${row}:F${row}`)
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
    row++
  })

  row++
  ws.getCell(`B${row}`).value = "Modifiers Applied"
  Object.assign(ws.getCell(`B${row}`), headerCell())
  ws.mergeCells(`B${row}:F${row}`)
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
    row++
  })

  row++
  ws.getCell(`B${row}`).value = "Regional Market Stats"
  Object.assign(ws.getCell(`B${row}`), headerCell())
  ws.mergeCells(`B${row}:F${row}`)
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
    row++
  })

  row++
  ws.getCell(`B${row}`).value = "Methodology"
  Object.assign(ws.getCell(`B${row}`), headerCell())
  ws.mergeCells(`B${row}:F${row}`)
  row++
  ws.getCell(`B${row}`).value =
    "Fair Value is the median of variant sold comparables, adjusted by up to twelve modifiers (individually capped at ±15%, aggregate at ±35%). Every claim carries a verifiable source. See monzahaus.com/methodology for details."
  ws.getCell(`B${row}`).alignment = { wrapText: true, vertical: "top" }
  ws.getRow(row).height = 50
  ws.mergeCells(`B${row}:F${row}`)
}
