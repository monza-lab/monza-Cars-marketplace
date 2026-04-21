import type { Workbook } from "exceljs"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { CollectorCar } from "@/lib/curatedCars"
import { EXCEL_COLORS, headerCell, titleCell } from "../styles"

export function buildSummarySheet(
  wb: Workbook,
  report: HausReportV2,
  car: CollectorCar,
  askingUsd: number,
  verdict: "BUY" | "WATCH" | "WALK",
): void {
  const ws = wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: EXCEL_COLORS.brandPrimary } },
    views: [{ showGridLines: false, state: "normal" }],
  })

  ws.columns = [{ width: 30 }, { width: 30 }]

  let row = 1
  ws.getCell(`A${row}`).value = "MONZA HAUS · Haus Report"
  Object.assign(ws.getCell(`A${row}`), titleCell())
  ws.mergeCells(`A${row}:B${row}`)
  row += 2

  const put = (label: string, value: string | number) => {
    const labelCell = ws.getCell(`A${row}`)
    labelCell.value = label
    labelCell.font = { bold: true, name: "Calibri" }
    ws.getCell(`B${row}`).value = value
    row++
  }

  const section = (title: string) => {
    const cell = ws.getCell(`A${row}`)
    cell.value = title
    Object.assign(cell, headerCell())
    ws.mergeCells(`A${row}:B${row}`)
    row++
  }

  section("Vehicle")
  put("Full Title", `${car.year} ${car.make} ${car.model}${car.trim && car.trim !== "—" && car.trim !== car.model ? " " + car.trim : ""}`)
  put("Year", car.year)
  put("Make", car.make)
  put("Model", car.model)
  if (car.trim) put("Trim", car.trim)
  put("Mileage", `${car.mileage.toLocaleString()} ${car.mileageUnit}`)

  row++
  section("Verdict")
  put("Verdict", verdict)
  put("Asking (USD)", askingUsd)
  put("Fair Value mid (USD)", report.specific_car_fair_value_mid)
  const delta = report.specific_car_fair_value_mid === 0
    ? 0
    : ((askingUsd - report.specific_car_fair_value_mid) / report.specific_car_fair_value_mid) * 100
  put("Delta vs Fair Value (%)", Number(delta.toFixed(1)))

  row++
  section("Fair Value range")
  put("Low (USD)", report.specific_car_fair_value_low)
  put("Mid (USD)", report.specific_car_fair_value_mid)
  put("High (USD)", report.specific_car_fair_value_high)
  put("Comparables count", report.comparables_count)
  put("Comparable layer", report.comparable_layer_used)

  row++
  section("Provenance")
  put("Generated at", report.generated_at)
  put("Report tier", report.tier)
  put("Report version", report.report_version)
  put("Report hash", report.report_hash || "—")
  put("Extraction version", report.extraction_version)
  if (report.report_hash) {
    const verifyCell = ws.getCell(`B${row}`)
    verifyCell.value = {
      text: `Verify online: monzahaus.com/verify/${report.report_hash.slice(0, 12)}`,
      hyperlink: `https://monzahaus.com/verify/${report.report_hash}`,
    }
    ws.getCell(`A${row}`).value = "Verify URL"
    ws.getCell(`A${row}`).font = { bold: true, name: "Calibri" }
    row++
  }
}
