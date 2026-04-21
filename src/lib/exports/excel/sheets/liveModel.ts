import type { Workbook } from "exceljs"
import { EXCEL_COLORS, formulaCell, headerCell, titleCell, NUMBER_FMT } from "../styles"

export function buildLiveModelSheet(wb: Workbook, askingUsd: number): void {
  const ws = wb.addWorksheet("Live Model", {
    properties: { tabColor: { argb: "FF808080" } },
    views: [{ showGridLines: false, state: "normal" }],
  })
  ws.columns = [{ width: 42 }, { width: 18 }]

  let row = 1
  ws.getCell(`A${row}`).value = "LIVE MODEL — formulas reading from Assumptions"
  Object.assign(ws.getCell(`A${row}`), titleCell())
  ws.mergeCells(`A${row}:B${row}`)
  row += 1
  ws.getCell(`A${row}`).value = "Do not edit. Change the blue cells in Assumptions instead."
  ws.getCell(`A${row}`).font = { italic: true, color: { argb: EXCEL_COLORS.brandMuted }, size: 10 }
  ws.mergeCells(`A${row}:B${row}`)
  row += 2

  const section = (title: string) => {
    const cell = ws.getCell(`A${row}`)
    cell.value = title
    Object.assign(cell, headerCell())
    ws.mergeCells(`A${row}:B${row}`)
    row++
  }

  const putFormula = (label: string, formula: string, numFmt?: string) => {
    const labelCell = ws.getCell(`A${row}`)
    labelCell.value = label
    labelCell.font = { bold: true, name: "Calibri" }
    const valueCell = ws.getCell(`B${row}`)
    valueCell.value = { formula }
    Object.assign(valueCell, formulaCell())
    if (numFmt) valueCell.numFmt = numFmt
    row++
  }

  const putStatic = (label: string, value: number, numFmt?: string) => {
    const labelCell = ws.getCell(`A${row}`)
    labelCell.value = label
    labelCell.font = { bold: true, name: "Calibri" }
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
}
