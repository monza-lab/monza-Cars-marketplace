import type { Workbook } from "exceljs"
import {
  EXCEL_COLORS,
  EXCEL_FONTS,
  NUMBER_FMT,
  applyWarmBackground,
  formulaCell,
  headerCell,
  sectionLabelCell,
  titleCell,
} from "../styles"

export function buildLiveModelSheet(wb: Workbook, askingUsd: number): void {
  const ws = wb.addWorksheet("Live Model", {
    // Soft Beige tab signals "formulas, don't touch"
    properties: { tabColor: { argb: EXCEL_COLORS.softBeige } },
    views: [{ showGridLines: false, state: "normal" }],
  })
  ws.columns = [{ width: 44 }, { width: 20 }]

  let row = 1

  // Keep exactly 2 header rows so the hardcoded `B8` / `B${row-N}` formula
  // references below still resolve to the same cells.
  ws.getCell(`A${row}`).value = "LIVE MODEL"
  Object.assign(ws.getCell(`A${row}`), titleCell())
  ws.mergeCells(`A${row}:B${row}`)
  row += 1

  ws.getCell(`A${row}`).value =
    "Formulas reading from Assumptions · do not edit, change the rose cells in Assumptions"
  Object.assign(ws.getCell(`A${row}`), sectionLabelCell())
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

  const labelFont = () => ({
    bold: true,
    name: EXCEL_FONTS.bodyName,
    size: 11,
    color: { argb: EXCEL_COLORS.brandForeground },
  })

  const putFormula = (label: string, formula: string, numFmt?: string) => {
    const labelCell = ws.getCell(`A${row}`)
    labelCell.value = label
    labelCell.font = labelFont()
    labelCell.alignment = { vertical: "middle", indent: 1 }
    const valueCell = ws.getCell(`B${row}`)
    valueCell.value = { formula }
    Object.assign(valueCell, formulaCell())
    if (numFmt) valueCell.numFmt = numFmt
    row++
  }

  const putStatic = (label: string, value: number, numFmt?: string) => {
    const labelCell = ws.getCell(`A${row}`)
    labelCell.value = label
    labelCell.font = labelFont()
    labelCell.alignment = { vertical: "middle", indent: 1 }
    const valueCell = ws.getCell(`B${row}`)
    valueCell.value = value
    Object.assign(valueCell, formulaCell())
    if (numFmt) valueCell.numFmt = numFmt
    row++
  }

  section("Fair Value computation")
  putFormula("Adjusted baseline (USD)", "BASELINE_MEDIAN_USD*(1+MARKET_DELTA_PCT)", NUMBER_FMT.usd)
  putFormula("Specific-Car Fair Value mid (USD)", "BASELINE_MEDIAN_USD*(1+MARKET_DELTA_PCT)*(1+AGG_MODIFIER_PCT)", NUMBER_FMT.usd)

  row++
  section("Asking price (static)")
  putStatic("Asking price (USD)", askingUsd, NUMBER_FMT.usd)

  row++
  section("Delta vs Fair Value")
  putFormula(
    "Delta (%)",
    `(B${row - 2}-B${row - 5})/B${row - 5}`,
    NUMBER_FMT.percent,
  )

  row++
  section("Landed cost breakdown (USD)")
  putFormula("CIF base (price + shipping + insurance)", "B8+SHIPPING_USD+(B8*MARINE_INSURANCE_PCT)", NUMBER_FMT.usd)
  putFormula("Customs duty", `B${row - 1}*DUTY_PCT`, NUMBER_FMT.usd)
  putFormula("VAT / sales tax", `(B${row - 2}+B${row - 1})*VAT_PCT`, NUMBER_FMT.usd)
  putFormula("Port + broker fees", "PORT_BROKER_USD", NUMBER_FMT.usd)
  putFormula("Registration", "REGISTRATION_USD", NUMBER_FMT.usd)
  putFormula(
    "Total landed cost add",
    `SUM(B${row - 5}:B${row - 1})-B8`,
    NUMBER_FMT.usd,
  )

  row++
  section("Total investment")
  putFormula("Total investment (USD)", `B${row - 2}`, NUMBER_FMT.usd)

  row++
  section("Ownership 5-year total (optional)")
  putFormula(
    "Total maintenance + insurance over hold (USD)",
    "(ANNUAL_MAINT_USD+ANNUAL_INSURANCE_USD)*HOLD_YEARS",
    NUMBER_FMT.usd,
  )

  applyWarmBackground(ws, row - 1, 2)
}
