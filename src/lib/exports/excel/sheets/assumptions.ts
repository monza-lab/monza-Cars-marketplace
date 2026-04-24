import type { Workbook, Worksheet } from "exceljs"
import type { HausReportV2 } from "@/lib/fairValue/types"
import {
  EXCEL_COLORS,
  EXCEL_FONTS,
  NUMBER_FMT,
  applyWarmBackground,
  headerCell,
  inputCell,
  sectionLabelCell,
  titleCell,
} from "../styles"

function addNamedInput(
  ws: Worksheet,
  row: number,
  label: string,
  value: number | string,
  rangeName: string,
  numFmt?: string,
  comment?: string,
): void {
  const labelCell = ws.getCell(`A${row}`)
  labelCell.value = label
  labelCell.font = {
    bold: true,
    name: EXCEL_FONTS.bodyName,
    size: 11,
    color: { argb: EXCEL_COLORS.brandForeground },
  }
  labelCell.alignment = { vertical: "middle", indent: 1 }

  const valueCell = ws.getCell(`B${row}`)
  valueCell.value = value
  Object.assign(valueCell, inputCell())
  if (numFmt) valueCell.numFmt = numFmt
  if (comment) {
    valueCell.note = { texts: [{ text: comment }] }
  }
  // Define named range for this cell (scoped to workbook)
  ws.workbook.definedNames.add(`Assumptions!$B$${row}`, rangeName)
}

export function buildAssumptionsSheet(wb: Workbook, report: HausReportV2): void {
  const ws = wb.addWorksheet("Assumptions", {
    properties: { tabColor: { argb: EXCEL_COLORS.brandRose } },
    views: [{ showGridLines: false, state: "normal" }],
  })
  ws.columns = [{ width: 44 }, { width: 20 }]

  let row = 1

  // Wordmark + tagline
  ws.getCell(`A${row}`).value = "ASSUMPTIONS"
  Object.assign(ws.getCell(`A${row}`), titleCell())
  ws.mergeCells(`A${row}:B${row}`)
  row++
  ws.getCell(`A${row}`).value = "Edit the rose cells to re-run the model"
  Object.assign(ws.getCell(`A${row}`), sectionLabelCell())
  ws.mergeCells(`A${row}:B${row}`)
  row++

  ws.getCell(`A${row}`).value =
    "Rose cells are your inputs. Beige cells in Live Model are formulas — edit only the rose."
  ws.getCell(`A${row}`).font = {
    italic: true,
    name: EXCEL_FONTS.bodyName,
    color: { argb: EXCEL_COLORS.brandMuted },
    size: 10,
  }
  ws.getCell(`A${row}`).alignment = { vertical: "middle" }
  ws.mergeCells(`A${row}:B${row}`)
  row += 2

  const section = (title: string) => {
    const cell = ws.getCell(`A${row}`)
    cell.value = title
    Object.assign(cell, headerCell())
    const rhs = ws.getCell(`B${row}`)
    rhs.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: EXCEL_COLORS.headerBg },
    }
    ws.mergeCells(`A${row}:B${row}`)
    ws.getRow(row).height = 22
    row++
  }

  section("Market baseline")
  addNamedInput(ws, row++, "Comparables median (USD)", report.median_price, "BASELINE_MEDIAN_USD", NUMBER_FMT.usd, "Monza Haus-computed median of variant sold comps. Edit if you disagree with the basis.")
  addNamedInput(ws, row++, "Fair Value low (USD)", report.specific_car_fair_value_low, "FAIR_LOW_USD", NUMBER_FMT.usd)
  addNamedInput(ws, row++, "Fair Value high (USD)", report.specific_car_fair_value_high, "FAIR_HIGH_USD", NUMBER_FMT.usd)
  addNamedInput(ws, row++, "Comparables count", report.comparables_count, "COMPARABLES_COUNT", NUMBER_FMT.plain)
  addNamedInput(ws, row++, "Market delta since capture (%)", 0, "MARKET_DELTA_PCT", NUMBER_FMT.percent, "User-specified market drift since Monza Haus captured the data. Default 0 = use captured numbers as-is.")

  row++
  section("Modifiers (aggregate)")
  addNamedInput(ws, row++, "Aggregate modifier (%)", Number((report.modifiers_total_percent / 100).toFixed(4)), "AGG_MODIFIER_PCT", NUMBER_FMT.percent, "Sum of all 12 modifiers applied. Can be overridden.")

  row++
  section("Landed cost inputs (USD)")
  addNamedInput(ws, row++, "Shipping", 4500, "SHIPPING_USD", NUMBER_FMT.usd, "Quote from broker. Monza Haus default ~$3,000–$6,000 depending on origin.")
  addNamedInput(ws, row++, "Exchange rate vs USD", 1.0, "FX_RATE", NUMBER_FMT.plain, "Multiplier from origin currency to USD. Set 1.0 if price is already USD.")
  addNamedInput(ws, row++, "Duty rate (%)", 0.025, "DUTY_PCT", NUMBER_FMT.percent, "US: 2.5% (passenger); EU: ~10%; UK: 0% post-Brexit for some categories.")
  addNamedInput(ws, row++, "VAT / sales tax (%)", 0.0725, "VAT_PCT", NUMBER_FMT.percent, "Destination-specific — California ~7.25%, Germany 19%, UK 20%.")
  addNamedInput(ws, row++, "Marine insurance (%)", 0.015, "MARINE_INSURANCE_PCT", NUMBER_FMT.percent)
  addNamedInput(ws, row++, "Port + broker fees (USD)", 850, "PORT_BROKER_USD", NUMBER_FMT.usd)
  addNamedInput(ws, row++, "Registration (USD)", 250, "REGISTRATION_USD", NUMBER_FMT.usd)

  row++
  section("Ownership extras (optional)")
  addNamedInput(ws, row++, "Annual maintenance (USD)", 3500, "ANNUAL_MAINT_USD", NUMBER_FMT.usd)
  addNamedInput(ws, row++, "Annual insurance (USD)", 1800, "ANNUAL_INSURANCE_USD", NUMBER_FMT.usd)
  addNamedInput(ws, row++, "Expected hold period (years)", 5, "HOLD_YEARS", NUMBER_FMT.plain)

  applyWarmBackground(ws, row - 1, 2)
}
