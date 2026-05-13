import ExcelJS from "exceljs"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { CollectorCar } from "@/lib/curatedCars"
import type { DbComparableRow } from "@/lib/db/queries"
import type { RegionalMarketStats } from "@/lib/reports/types"
import type { HausReportV3 } from "@/lib/reports/types-v3"
import { buildSummarySheet } from "./sheets/summary"
import { buildAssumptionsSheet } from "./sheets/assumptions"
import { buildLiveModelSheet } from "./sheets/liveModel"
import { buildDataAndSourcesSheet } from "./sheets/dataAndSources"

export interface RenderExcelInput {
  report: HausReportV2
  car: CollectorCar
  regions: RegionalMarketStats[]
  comparables: DbComparableRow[]
  askingUsd: number
  verdict: "BUY" | "WATCH" | "WALK" | "PENDING"
  /** V3 multi-agent report. When present, its fair value range and
   *  verdict override the V2 calculation so the Excel stays consistent
   *  with the PDF. */
  v3Report?: HausReportV3 | null
}

/**
 * Parse a fair value range string like "$880K – $975K" or "$1.2M – $1.5M"
 * into numeric low/high.
 */
function parseFairRange(s: string | undefined | null): { low: number; high: number } | null {
  if (!s) return null
  const m = s.match(/\$?([\d.]+)\s*([KkMm]?)\s*[–-]\s*\$?([\d.]+)\s*([KkMm]?)/)
  if (!m) return null
  const parse = (n: string, u: string) => {
    const v = parseFloat(n)
    if (!Number.isFinite(v)) return null
    if (u.toLowerCase() === "k") return v * 1_000
    if (u.toLowerCase() === "m") return v * 1_000_000
    return v
  }
  const low = parse(m[1], m[2])
  const high = parse(m[3], m[4])
  if (low == null || high == null) return null
  return { low, high }
}

export async function renderReportToExcelBuffer(input: RenderExcelInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "MonzaHaus"
  wb.company = "Monza Lab LLC"
  wb.title = `Haus Report · ${input.car.year} ${input.car.make} ${input.car.model}`
  wb.created = new Date(input.report.generated_at)

  // When V3 is present, override the V2 fair value range and verdict so
  // the Excel agrees with the PDF (which also prefers V3 as the source
  // of truth). V2 calc remains the fallback for V3-less reports.
  let effectiveReport = input.report
  let effectiveVerdict = input.verdict
  let effectiveVersion = input.report.report_version
  if (input.v3Report) {
    const v3Exec = input.v3Report.finalSynthesis?.executiveSummary
    const v3Range = parseFairRange(v3Exec?.keyMetrics.fairValueRange)
    if (v3Range) {
      const mid = (v3Range.low + v3Range.high) / 2
      effectiveReport = {
        ...input.report,
        specific_car_fair_value_low: v3Range.low,
        specific_car_fair_value_mid: mid,
        specific_car_fair_value_high: v3Range.high,
      }
    }
    if (v3Exec?.keyMetrics.verdict) {
      effectiveVerdict = v3Exec.keyMetrics.verdict
    }
    effectiveVersion = 3
  }

  buildSummarySheet(wb, effectiveReport, input.car, input.askingUsd, effectiveVerdict, effectiveVersion)
  buildAssumptionsSheet(wb, effectiveReport)
  buildLiveModelSheet(wb, input.askingUsd)
  buildDataAndSourcesSheet(wb, effectiveReport, input.regions, input.comparables)

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer as ArrayBuffer)
}
