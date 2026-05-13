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

/**
 * Evidence sheet — every claim in the report traces back here.
 *
 * Sections render conditionally: a section is omitted entirely when its
 * data array is empty (e.g. Comparables and Regional Stats when there is
 * no DB connection).
 *
 * All raw keys (snake_case backend IDs) are mapped to human labels via
 * SIGNAL_LABELS / MODIFIER_LABELS / SOURCE_TYPE_LABELS / WHY_IT_MATTERS.
 */

const TABLE_FIRST_COL = 2
const TABLE_LAST_COL = 6

// ── Label dictionaries ───────────────────────────────────────────────
const SIGNAL_LABELS: Record<string, string> = {
  paint_to_sample: "Paint-to-Sample color",
  transmission: "Transmission",
  service_records: "Service records",
  previous_owners: "Previous owners",
  original_paint: "Original paint",
  documentation: "Documentation",
  seller_tier: "Seller tier",
  exterior_color: "Exterior color",
  exterior_rarity: "Color rarity",
  pts_status: "Paint-to-Sample status",
  vin_decoded: "VIN decoded",
  vin_plant: "Factory of origin",
  vin_warnings: "VIN warnings",
}

const MODIFIER_LABELS: Record<string, string> = {
  paint_to_sample: "Paint-to-Sample premium",
  service_records_complete: "Complete service history",
  low_previous_owners: "Low ownership count",
  original_paint: "Original factory paint",
  documentation_provided: "Documentation provided",
  seller_tier_specialist: "Sold by Porsche specialist",
  color_premium: "Color rarity premium",
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  listing_text: "Listing description",
  structured_field: "Listing data",
  color_intelligence: "Color analysis",
  vin_intelligence: "VIN decoder",
  seller_context: "Seller profile",
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

/** Human explanation of why each signal matters to value. */
const WHY_IT_MATTERS: Record<string, string> = {
  paint_to_sample:
    "PTS commissions are rare special orders that command 10–30% premium",
  transmission:
    "Manual gearboxes on modern Porsches outperform PDK at resale",
  service_records:
    "Documented service history is essential for premium pricing",
  previous_owners:
    "Single-owner cars trade at 3–8% over multi-owner equivalents",
  original_paint:
    "Original factory paint preserves value vs. resprayed cars",
  documentation:
    "Full books, window sticker, and PPI raise buyer confidence",
  seller_tier: "Established specialists vet provenance before listing",
  exterior_color: "Color is the second-largest variable after mileage",
  exterior_rarity:
    "Rare hues anchor desirability and re-sale liquidity",
  pts_status: "Paint-to-Sample status alone can add a five-figure premium",
}

function humanSignal(key: string): string {
  return SIGNAL_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
function humanModifier(key: string): string {
  return MODIFIER_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
function humanSourceType(t: string): string {
  return SOURCE_TYPE_LABELS[t] ?? t.replace(/_/g, " ")
}
function humanConfidence(c: string): string {
  return CONFIDENCE_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1)
}

// ── Helpers ──────────────────────────────────────────────────────────
function addTableHeader(ws: Worksheet, row: number, headers: string[]): void {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, TABLE_FIRST_COL + i)
    cell.value = h
    Object.assign(cell, headerCell())
  })
  ws.getRow(row).height = 22
}

function sectionBanner(ws: Worksheet, row: number, title: string, subtitle?: string): void {
  for (let c = TABLE_FIRST_COL; c <= TABLE_LAST_COL; c++) {
    Object.assign(ws.getCell(row, c), headerCell())
  }
  const titleCell = ws.getCell(row, TABLE_FIRST_COL)
  titleCell.value = subtitle ? `${title}  ·  ${subtitle}` : title
  ws.mergeCells(row, TABLE_FIRST_COL, row, TABLE_LAST_COL)
  ws.getRow(row).height = 22
}

function paintDataRow(ws: Worksheet, row: number, wrapLastCol = false): void {
  for (let c = TABLE_FIRST_COL; c <= TABLE_LAST_COL; c++) {
    const cell = ws.getCell(row, c)
    const style = dataCell()
    cell.font = { ...style.font }
    cell.fill = style.fill
    cell.alignment = {
      ...style.alignment,
      horizontal: c === TABLE_FIRST_COL ? "center" : "left",
      vertical: "middle",
      wrapText: wrapLastCol && c === TABLE_LAST_COL ? true : undefined,
    }
  }
}

const HYPERLINK_FONT = {
  name: EXCEL_FONTS.bodyName,
  size: 11,
  color: { argb: "FF1D4ED8" }, // Tailwind blue-700
  underline: true,
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url)
    const domain = u.hostname.replace(/^www\./, "")
    const lastSegment = u.pathname.split("/").filter(Boolean).pop() ?? ""
    const label = lastSegment
      .replace(/\.[a-z]+$/i, "")
      .replace(/[-_]+/g, " ")
      .trim()
    return label ? `${domain} · ${label}` : domain
  } catch {
    return url
  }
}

export function buildDataAndSourcesSheet(
  wb: Workbook,
  report: HausReportV2,
  regions: RegionalMarketStats[],
  comparables: DbComparableRow[],
): void {
  const ws = wb.addWorksheet("Evidence", {
    properties: { tabColor: { argb: EXCEL_COLORS.brandRose } },
    views: [{ showGridLines: false, state: "normal" }],
  })

  ws.columns = [
    { width: 4 },
    { width: 32 },
    { width: 38 },
    { width: 14 },
    { width: 22 },
    { width: 52 },
  ]

  let row = 1
  ws.getCell(`B${row}`).value = "EVIDENCE"
  Object.assign(ws.getCell(`B${row}`), titleCell())
  row++
  ws.getCell(`B${row}`).value =
    "What we found, where we found it, and why it matters to value"
  Object.assign(ws.getCell(`B${row}`), sectionLabelCell())
  row += 2

  // ── Signals Detected ──────────────────────────────────────────────
  const hasSignals =
    report.signals_detected.length > 0 ||
    !!report.color_intelligence ||
    !!report.vin_intelligence

  if (hasSignals) {
    sectionBanner(
      ws,
      row,
      "Signals Detected",
      `${report.signals_detected.length} positive findings extracted from the listing`,
    )
    row++
    // Columns: # · Signal · What we found · Confidence · Source · Why it matters
    addTableHeader(ws, row, ["#", "Signal", "What we found", "Confidence", "Source", "Why it matters"])
    row++

    let idx = 1
    for (const s of report.signals_detected) {
      ws.getCell(row, 1).value = idx++
      ws.getCell(row, 2).value = humanSignal(s.key)
      ws.getCell(row, 3).value = s.value_display
      ws.getCell(row, 4).value = humanConfidence(s.evidence.confidence)
      ws.getCell(row, 5).value = humanSourceType(s.evidence.source_type)
      ws.getCell(row, 6).value = WHY_IT_MATTERS[s.key] ?? "—"
      paintDataRow(ws, row, true)
      // Slightly taller rows when we have multi-line "why it matters" text
      ws.getRow(row).height = 32
      row++
    }

    if (report.color_intelligence) {
      const ci = report.color_intelligence
      const rarityHuman = ci.exteriorRarity
        ? ci.exteriorRarity.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
        : "Unknown"
      const items: { key: string; value: string }[] = [
        { key: "exterior_color", value: ci.exteriorColorName ?? "Unknown" },
        { key: "exterior_rarity", value: rarityHuman },
        { key: "pts_status", value: ci.isPTS ? "Yes" : "No" },
      ]
      for (const s of items) {
        ws.getCell(row, 1).value = idx++
        ws.getCell(row, 2).value = humanSignal(s.key)
        ws.getCell(row, 3).value = s.value
        ws.getCell(row, 4).value = "High"
        ws.getCell(row, 5).value = humanSourceType("color_intelligence")
        ws.getCell(row, 6).value = WHY_IT_MATTERS[s.key] ?? "—"
        paintDataRow(ws, row, true)
        ws.getRow(row).height = 32
        row++
      }
    }

    if (report.vin_intelligence) {
      const vi = report.vin_intelligence
      const items: { key: string; value: string }[] = [
        { key: "vin_decoded", value: vi.vinDecoded ? "Yes" : "No" },
        { key: "vin_plant", value: vi.plant ?? "Unknown" },
      ]
      if (vi.warnings?.length) {
        items.push({ key: "vin_warnings", value: vi.warnings.join("; ") })
      }
      for (const s of items) {
        ws.getCell(row, 1).value = idx++
        ws.getCell(row, 2).value = humanSignal(s.key)
        ws.getCell(row, 3).value = s.value
        ws.getCell(row, 4).value = "High"
        ws.getCell(row, 5).value = humanSourceType("vin_intelligence")
        ws.getCell(row, 6).value = "Provenance via factory-of-origin record"
        paintDataRow(ws, row, true)
        ws.getRow(row).height = 32
        row++
      }
    }
    row++
  }

  // ── Modifiers Applied (the actual valuation math) ─────────────────
  if (report.modifiers_applied.length > 0) {
    sectionBanner(
      ws,
      row,
      "Valuation Adjustments",
      `${report.modifiers_applied.length} adjustments  ·  aggregate ${report.modifiers_total_percent.toFixed(1)}%  ·  click citation to verify the source`,
    )
    row++
    // Columns: # · Adjustment · % impact · USD impact · Tied to · Independent source
    addTableHeader(ws, row, ["#", "Adjustment", "% impact", "USD impact", "Tied to signal", "Independent source"])
    row++

    report.modifiers_applied.forEach((m, i) => {
      ws.getCell(row, 1).value = i + 1
      ws.getCell(row, 2).value = humanModifier(m.key)
      ws.getCell(row, 3).value = m.delta_percent / 100
      ws.getCell(row, 3).numFmt = "+0.0%;-0.0%;0.0%"
      ws.getCell(row, 4).value = m.baseline_contribution_usd
      ws.getCell(row, 4).numFmt = '"+$"#,##0;"-$"#,##0;"$"0'
      ws.getCell(row, 5).value = humanSignal(m.signal_key)
      if (m.citation_url) {
        ws.getCell(row, 6).value = {
          text: shortenUrl(m.citation_url),
          hyperlink: m.citation_url,
        }
      } else {
        ws.getCell(row, 6).value = "—"
      }
      paintDataRow(ws, row)
      if (m.citation_url) {
        ws.getCell(row, 6).font = { ...HYPERLINK_FONT }
      }
      row++
    })

    // Total row
    const totalRowIdx = row
    ws.getCell(row, 1).value = ""
    ws.getCell(row, 2).value = "TOTAL"
    ws.getCell(row, 3).value = report.modifiers_total_percent / 100
    ws.getCell(row, 3).numFmt = "+0.0%;-0.0%;0.0%"
    const totalUsd = report.modifiers_applied.reduce(
      (sum, m) => sum + m.baseline_contribution_usd,
      0,
    )
    ws.getCell(row, 4).value = totalUsd
    ws.getCell(row, 4).numFmt = '"+$"#,##0;"-$"#,##0;"$"0'
    ws.getCell(row, 5).value = ""
    ws.getCell(row, 6).value = ""
    for (let c = TABLE_FIRST_COL; c <= TABLE_LAST_COL; c++) {
      const cell = ws.getCell(totalRowIdx, c)
      cell.font = {
        name: EXCEL_FONTS.bodyName,
        bold: true,
        size: 11,
        color: { argb: EXCEL_COLORS.brandLavenderInkDeep },
      }
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: EXCEL_COLORS.lavenderVeil },
      }
      cell.alignment = {
        horizontal: c === TABLE_FIRST_COL ? "center" : "left",
        vertical: "middle",
      }
    }
    row++
    row++
  }

  // ── Comparables (only render if present) ──────────────────────────
  if (comparables.length > 0) {
    sectionBanner(
      ws,
      row,
      "Comparable Sales",
      `${comparables.length} sold transactions used to anchor fair value`,
    )
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

    ws.autoFilter = {
      from: { row: compHeaderRow, column: 1 },
      to: { row: row - 1, column: 6 },
    }
    row++
  }

  // ── Regional Market Stats (only render if present) ────────────────
  if (regions.length > 0) {
    sectionBanner(ws, row, "Regional Market Stats", `${regions.length} markets compared`)
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
  }

  // ── Methodology (always shown) ────────────────────────────────────
  sectionBanner(ws, row, "How we got to fair value")
  row++
  const methCell = ws.getCell(row, TABLE_FIRST_COL)
  methCell.value =
    "We start with the median sold price of comparable cars of the same variant. " +
    "Then we apply up to twelve premium/discount adjustments — each tied to a " +
    "signal we found in the listing and cited to an independent source. " +
    "Individual adjustments are capped at ±15%; the aggregate is capped at ±35%. " +
    "Open monzahaus.com/methodology for the full engine documentation."
  methCell.alignment = { wrapText: true, vertical: "top" }
  methCell.font = {
    name: EXCEL_FONTS.bodyName,
    size: 11,
    color: { argb: EXCEL_COLORS.brandForeground },
  }
  ws.getRow(row).height = 78
  ws.mergeCells(row, TABLE_FIRST_COL, row, TABLE_LAST_COL)
  row++

  row++
  const linkCell = ws.getCell(row, TABLE_FIRST_COL)
  linkCell.value = {
    text: "Open methodology online → monzahaus.com/methodology",
    hyperlink: "https://monzahaus.com/methodology",
  }
  linkCell.font = { ...HYPERLINK_FONT }
  linkCell.alignment = { vertical: "middle" }
  ws.mergeCells(row, TABLE_FIRST_COL, row, TABLE_LAST_COL)

  applyWarmBackground(ws, row, TABLE_LAST_COL)
}
