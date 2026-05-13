import type { Workbook } from "exceljs"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { CollectorCar } from "@/lib/curatedCars"
import {
  EXCEL_COLORS,
  EXCEL_FONTS,
  NUMBER_FMT,
  applyWarmBackground,
  headerCell,
  sectionLabelCell,
  titleCell,
} from "../styles"

/** Title-case make/model so "porsche" → "Porsche" without breaking
 *  uppercase acronyms with digits ("GT3", "S/T", "911"). */
function titleCase(raw: string | null | undefined): string {
  if (!raw) return ""
  return raw
    .split(" ")
    .map((w) => {
      if (!w) return w
      // All-digit (e.g. "911", "992") — keep as-is.
      if (/^\d+$/.test(w)) return w
      // All uppercase letters and/or digits with at least one letter
      // ("GT3", "RS", "S/T", "TDF") — keep as-is.
      if (w.length >= 2 && /^[A-Z0-9/]+$/.test(w) && /[A-Z]/.test(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(" ")
}

export function buildSummarySheet(
  wb: Workbook,
  report: HausReportV2,
  car: CollectorCar,
  askingUsd: number,
  verdict: "BUY" | "WATCH" | "WALK" | "PENDING",
  reportVersion?: number,
): void {
  const ws = wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: EXCEL_COLORS.brandRose } },
    views: [{ showGridLines: false, state: "normal" }],
  })

  ws.columns = [{ width: 32 }, { width: 38 }]

  let row = 1

  // Wordmark + tagline
  ws.getCell(`A${row}`).value = "MONZAHAUS"
  Object.assign(ws.getCell(`A${row}`), titleCell())
  ws.mergeCells(`A${row}:B${row}`)
  row++
  ws.getCell(`A${row}`).value = "Haus Report · The Porsche Collector Platform"
  Object.assign(ws.getCell(`A${row}`), sectionLabelCell())
  ws.mergeCells(`A${row}:B${row}`)
  row += 2

  const put = (label: string, value: string | number, numFmt?: string) => {
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
    if (numFmt) valueCell.numFmt = numFmt
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
  const make = titleCase(car.make)
  const model = titleCase(car.model)
  put(
    "Full Title",
    `${car.year} ${make} ${model}${
      car.trim && car.trim !== "—" && car.trim !== car.model ? " " + car.trim : ""
    }`,
  )
  put("Year", car.year)
  put("Make", make)
  put("Model", model)
  if (car.trim) put("Trim", car.trim)
  if (car.mileage != null) {
    const unit = car.mileageUnit || "mi"
    put("Mileage", `${car.mileage.toLocaleString()} ${unit}`)
  }

  row++
  section("Verdict")
  put("Verdict", verdict)
  put("Asking (USD)", askingUsd, NUMBER_FMT.usd)
  put(
    "Fair Value mid (USD)",
    report.specific_car_fair_value_mid ?? "Pending",
    report.specific_car_fair_value_mid != null ? NUMBER_FMT.usd : undefined,
  )
  // Delta as a decimal (0.749) so Excel's percent format displays "74.9%".
  // Previously we wrote 174.9 with no format, which displayed as a raw
  // number — the Fair Value formula "salía mal" in the user-visible output.
  const fairMid = report.specific_car_fair_value_mid
  const deltaDecimal =
    fairMid == null || fairMid === 0 ? 0 : (askingUsd - fairMid) / fairMid
  put("Δ Asking vs Fair Value (%)", deltaDecimal, NUMBER_FMT.percent)

  // Color the verdict value per brand rules (never red; use burnt orange).
  const verdictRow = row - 4 // first put after section("Verdict")
  const vCell = ws.getCell(`B${verdictRow}`)
  vCell.font = {
    name: EXCEL_FONTS.bodyName,
    bold: true,
    size: 14,
    color: {
      argb:
        verdict === "BUY"
          ? "FF34D399" // Emerald Mint
          : verdict === "WALK"
            ? "FFFB923C" // Burnt Orange (never red)
            : verdict === "PENDING"
              ? "FF8B8386" // Muted stone
              : "FFFBBF24", // Amber for WATCH
    },
  }
  vCell.alignment = { vertical: "middle", horizontal: "right" }

  // Color the delta cell red/green per direction
  const deltaRow = row - 1
  const dCell = ws.getCell(`B${deltaRow}`)
  dCell.font = {
    name: EXCEL_FONTS.monoName,
    bold: true,
    size: 11,
    color: {
      argb:
        deltaDecimal > 0.1
          ? "FFFB923C" // Burnt Orange — meaningfully above fair
          : deltaDecimal < -0.05
            ? "FF34D399" // Emerald Mint — meaningfully below fair (bargain)
            : EXCEL_COLORS.brandForeground,
    },
  }

  row++
  section("Fair Value range")
  put(
    "Low (USD)",
    report.specific_car_fair_value_low ?? "Pending",
    report.specific_car_fair_value_low != null ? NUMBER_FMT.usd : undefined,
  )
  put(
    "Mid (USD)",
    report.specific_car_fair_value_mid ?? "Pending",
    report.specific_car_fair_value_mid != null ? NUMBER_FMT.usd : undefined,
  )
  put(
    "High (USD)",
    report.specific_car_fair_value_high ?? "Pending",
    report.specific_car_fair_value_high != null ? NUMBER_FMT.usd : undefined,
  )
  put("Comparables count", report.comparables_count, NUMBER_FMT.plain)
  put("Comparable layer", report.comparable_layer_used ?? "unknown")

  row++
  section("Color Intelligence")
  put("Exterior Color", report.color_intelligence?.exteriorColorName ?? "Not analyzed")
  const rarityRaw = report.color_intelligence?.exteriorRarity
  const rarityHuman = rarityRaw
    ? rarityRaw.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
    : "Unknown"
  put("Rarity", rarityHuman)
  put("PTS", report.color_intelligence?.isPTS ? "Yes" : "No")

  row++
  section("VIN Intelligence")
  put("VIN Decoded", report.vin_intelligence?.vinDecoded ? "Yes" : "No")
  put("Plant", report.vin_intelligence?.plant ?? "Unknown")
  put("Warnings", report.vin_intelligence?.warnings?.join(", ") || "None")

  row++
  section("Investment Narrative")
  put("Narrative", report.investment_narrative?.story
    ? report.investment_narrative.story.substring(0, 200) + "…"
    : "Not generated")

  row++
  section("Provenance")
  put("Generated at", report.generated_at)
  put("Report tier", report.tier)
  put("Report version", reportVersion ?? report.report_version)
  put("Report hash", report.report_hash || "—")
  put("Extraction version", report.extraction_version ?? "—")
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
