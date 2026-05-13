import type { Workbook, Worksheet } from "exceljs"
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

/**
 * Live Model sheet — every value is a formula reading from Assumptions
 * named ranges or from another Live Model cell. Edit only the rose cells
 * in Assumptions.
 *
 * Previous version had hardcoded `B8` references and brittle `row-N`
 * math that pointed to empty cells. This rewrite tracks every named cell
 * via a `refs` map so all cross-references resolve correctly even if the
 * sheet layout changes.
 */
export function buildLiveModelSheet(wb: Workbook, askingUsd: number): void {
  const ws = wb.addWorksheet("Live Model", {
    properties: { tabColor: { argb: EXCEL_COLORS.softBeige } },
    views: [{ showGridLines: false, state: "normal" }],
  })
  ws.columns = [{ width: 44 }, { width: 22 }]

  let row = 1

  // ── Header ────────────────────────────────────────────────────────
  ws.getCell(`A${row}`).value = "LIVE MODEL"
  Object.assign(ws.getCell(`A${row}`), titleCell())
  ws.mergeCells(`A${row}:B${row}`)
  row += 1

  ws.getCell(`A${row}`).value =
    "Formulas reading from Assumptions · do not edit, change the rose cells in Assumptions"
  Object.assign(ws.getCell(`A${row}`), sectionLabelCell())
  ws.mergeCells(`A${row}:B${row}`)
  row += 2

  // ── Helpers ───────────────────────────────────────────────────────
  const labelFont = () => ({
    bold: true,
    name: EXCEL_FONTS.bodyName,
    size: 11,
    color: { argb: EXCEL_COLORS.brandForeground },
  })

  const section = (title: string): void => {
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

  // Track cell references for every computed/static value so cross-cell
  // formulas can refer to them by symbolic name instead of brittle row math.
  const refs: Record<string, string> = {}

  const putFormula = (
    key: string | null,
    label: string,
    formula: string,
    numFmt?: string,
    boldValue = false,
  ): void => {
    const labelCell = ws.getCell(`A${row}`)
    labelCell.value = label
    labelCell.font = labelFont()
    labelCell.alignment = { vertical: "middle", indent: 1 }
    const valueCell = ws.getCell(`B${row}`)
    valueCell.value = { formula }
    Object.assign(valueCell, formulaCell())
    if (numFmt) valueCell.numFmt = numFmt
    if (boldValue) {
      valueCell.font = {
        ...valueCell.font,
        bold: true,
        size: 12,
        color: { argb: EXCEL_COLORS.brandLavenderInkDeep },
      }
    }
    if (key) refs[key] = `B${row}`
    row++
  }

  const putStatic = (
    key: string | null,
    label: string,
    value: number,
    numFmt?: string,
  ): void => {
    const labelCell = ws.getCell(`A${row}`)
    labelCell.value = label
    labelCell.font = labelFont()
    labelCell.alignment = { vertical: "middle", indent: 1 }
    const valueCell = ws.getCell(`B${row}`)
    valueCell.value = value
    Object.assign(valueCell, formulaCell())
    // Static values get a distinct fill so the reader knows they aren't
    // recomputed from formulas — they are the report's captured inputs.
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: EXCEL_COLORS.warmCream },
    }
    if (numFmt) valueCell.numFmt = numFmt
    if (key) refs[key] = `B${row}`
    row++
  }

  // ── Fair Value computation ────────────────────────────────────────
  section("Fair Value computation")
  putFormula(
    "adjBaseline",
    "Adjusted baseline (USD)",
    "BASELINE_MEDIAN_USD*(1+MARKET_DELTA_PCT)",
    NUMBER_FMT.usd,
  )
  putFormula(
    "fairMid",
    "Specific-car Fair Value mid (USD)",
    `${refs.adjBaseline}*(1+AGG_MODIFIER_PCT)`,
    NUMBER_FMT.usd,
    true, // bold — the centerpiece of the sheet
  )
  putFormula(
    "fairLow",
    "Fair Value low (USD)",
    "FAIR_LOW_USD",
    NUMBER_FMT.usd,
  )
  putFormula(
    "fairHigh",
    "Fair Value high (USD)",
    "FAIR_HIGH_USD",
    NUMBER_FMT.usd,
  )

  row++
  // ── Asking price (captured) ───────────────────────────────────────
  section("Asking price (captured at generation)")
  putStatic("asking", "Asking price (USD)", askingUsd, NUMBER_FMT.usd)

  row++
  // ── Delta vs Fair Value ───────────────────────────────────────────
  section("Delta vs Fair Value")
  putFormula(
    "deltaUsd",
    "Δ Asking − Fair (USD)",
    `${refs.asking}-${refs.fairMid}`,
    NUMBER_FMT.usd,
  )
  putFormula(
    "deltaPct",
    "Δ Asking − Fair (%)",
    `(${refs.asking}-${refs.fairMid})/${refs.fairMid}`,
    NUMBER_FMT.percent,
    true,
  )
  putFormula(
    "rangePosition",
    "Position within Fair Range",
    `IF(${refs.fairHigh}=${refs.fairLow},0,(${refs.asking}-${refs.fairLow})/(${refs.fairHigh}-${refs.fairLow}))`,
    NUMBER_FMT.percent,
  )

  row++
  // ── Landed cost breakdown ─────────────────────────────────────────
  section("Landed cost breakdown (USD)")
  putFormula(
    "cifBase",
    "CIF base (asking × FX + shipping + insurance)",
    `${refs.asking}*FX_RATE+SHIPPING_USD+(${refs.asking}*FX_RATE*MARINE_INSURANCE_PCT)`,
    NUMBER_FMT.usd,
  )
  putFormula(
    "duty",
    "Customs duty",
    `${refs.cifBase}*DUTY_PCT`,
    NUMBER_FMT.usd,
  )
  putFormula(
    "vat",
    "VAT / sales tax",
    `(${refs.cifBase}+${refs.duty})*VAT_PCT`,
    NUMBER_FMT.usd,
  )
  putFormula(
    "portBroker",
    "Port + broker fees",
    "PORT_BROKER_USD",
    NUMBER_FMT.usd,
  )
  putFormula(
    "registration",
    "Registration",
    "REGISTRATION_USD",
    NUMBER_FMT.usd,
  )
  putFormula(
    "landedAdd",
    "Total landed cost add-on",
    `SHIPPING_USD+(${refs.asking}*FX_RATE*MARINE_INSURANCE_PCT)+${refs.duty}+${refs.vat}+${refs.portBroker}+${refs.registration}`,
    NUMBER_FMT.usd,
  )

  row++
  // ── Total investment ──────────────────────────────────────────────
  section("Total investment")
  putFormula(
    "totalInvestment",
    "All-in cost to take delivery (USD)",
    `${refs.asking}+${refs.landedAdd}`,
    NUMBER_FMT.usd,
    true,
  )

  row++
  // ── Ownership over hold ───────────────────────────────────────────
  section("Ownership over hold period")
  putFormula(
    "annualCarry",
    "Annual carry (maintenance + insurance)",
    "ANNUAL_MAINT_USD+ANNUAL_INSURANCE_USD",
    NUMBER_FMT.usd,
  )
  putFormula(
    "totalCarry",
    "Total carry over hold (USD)",
    `${refs.annualCarry}*HOLD_YEARS`,
    NUMBER_FMT.usd,
  )
  putFormula(
    "trueCostOfOwnership",
    "True cost of ownership end-of-hold (USD)",
    `${refs.totalInvestment}+${refs.totalCarry}`,
    NUMBER_FMT.usd,
    true,
  )

  row++
  // ── Break-even & return ───────────────────────────────────────────
  section("Break-even & return scenarios")
  putFormula(
    "breakEvenSale",
    "Break-even sale price (USD)",
    `${refs.trueCostOfOwnership}`,
    NUMBER_FMT.usd,
  )
  putFormula(
    "sellAtMidPctReturn",
    "Return if sold at Fair mid (%)",
    `(${refs.fairMid}-${refs.trueCostOfOwnership})/${refs.trueCostOfOwnership}`,
    NUMBER_FMT.percent,
  )
  putFormula(
    "sellAtHighPctReturn",
    "Return if sold at Fair high (%)",
    `(${refs.fairHigh}-${refs.trueCostOfOwnership})/${refs.trueCostOfOwnership}`,
    NUMBER_FMT.percent,
  )

  applyWarmBackground(ws, row - 1, 2)
}
