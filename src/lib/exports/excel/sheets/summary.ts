import type { Workbook } from "exceljs"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { CollectorCar } from "@/lib/curatedCars"
import {
  EXCEL_COLORS,
  EXCEL_FONTS,
  applyWarmBackground,
  headerCell,
  sectionLabelCell,
  titleCell,
} from "../styles"

export function buildSummarySheet(
  wb: Workbook,
  report: HausReportV2,
  car: CollectorCar,
  askingUsd: number,
  verdict: "BUY" | "WATCH" | "WALK",
): void {
  const ws = wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: EXCEL_COLORS.brandRose } },
    views: [{ showGridLines: false, state: "normal" }],
  })

  ws.columns = [{ width: 32 }, { width: 38 }]

  let row = 1

  // Wordmark + tagline
  ws.getCell(`A${row}`).value = "MONZA HAUS"
  Object.assign(ws.getCell(`A${row}`), titleCell())
  ws.mergeCells(`A${row}:B${row}`)
  row++
  ws.getCell(`A${row}`).value = "Haus Report · Investment-Grade Automotive Assets"
  Object.assign(ws.getCell(`A${row}`), sectionLabelCell())
  ws.mergeCells(`A${row}:B${row}`)
  row += 2

  const put = (label: string, value: string | number) => {
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
    valueCell.font = {
      name: typeof value === "number" ? EXCEL_FONTS.monoName : EXCEL_FONTS.bodyName,
      size: 11,
      color: { argb: EXCEL_COLORS.brandForeground },
    }
    valueCell.alignment = { vertical: "middle", horizontal: typeof value === "number" ? "right" : "left" }
    row++
  }

  const section = (title: string) => {
    const cell = ws.getCell(`A${row}`)
    cell.value = title
    Object.assign(cell, headerCell())
    // Mirror header fill on the second column so the band is continuous
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

  section("Vehicle")
  put(
    "Full Title",
    `${car.year} ${car.make} ${car.model}${
      car.trim && car.trim !== "—" && car.trim !== car.model ? " " + car.trim : ""
    }`,
  )
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
  const delta =
    report.specific_car_fair_value_mid === 0
      ? 0
      : ((askingUsd - report.specific_car_fair_value_mid) /
          report.specific_car_fair_value_mid) *
        100
  put("Delta vs Fair Value (%)", Number(delta.toFixed(1)))

  // Color the verdict value per brand rules (never red; use burnt orange).
  const verdictRow = row - 4 // first put after section("Verdict")
  const vCell = ws.getCell(`B${verdictRow}`)
  vCell.font = {
    name: EXCEL_FONTS.bodyName,
    bold: true,
    size: 12,
    color: {
      argb:
        verdict === "BUY"
          ? "FF34D399"
          : verdict === "WALK"
            ? "FFFB923C"
            : "FFFBBF24",
    },
  }

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
    verifyCell.font = {
      name: EXCEL_FONTS.bodyName,
      size: 11,
      color: { argb: EXCEL_COLORS.brandPrimary },
      underline: true,
    }
    const labelCell = ws.getCell(`A${row}`)
    labelCell.value = "Verify URL"
    labelCell.font = {
      bold: true,
      name: EXCEL_FONTS.bodyName,
      size: 11,
      color: { argb: EXCEL_COLORS.brandForeground },
    }
    labelCell.alignment = { vertical: "middle", indent: 1 }
    row++
  }

  applyWarmBackground(ws, row - 1, 2)
}
