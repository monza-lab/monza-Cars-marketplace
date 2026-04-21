import ExcelJS from "exceljs"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { CollectorCar } from "@/lib/curatedCars"
import type { DbComparableRow } from "@/lib/db/queries"
import type { RegionalMarketStats } from "@/lib/reports/types"
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
  verdict: "BUY" | "WATCH" | "WALK"
}

export async function renderReportToExcelBuffer(input: RenderExcelInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Monza Haus"
  wb.company = "Monza Lab LLC"
  wb.title = `Haus Report · ${input.car.year} ${input.car.make} ${input.car.model}`
  wb.created = new Date(input.report.generated_at)

  buildSummarySheet(wb, input.report, input.car, input.askingUsd, input.verdict)
  buildAssumptionsSheet(wb, input.report)
  buildLiveModelSheet(wb, input.askingUsd)
  buildDataAndSourcesSheet(wb, input.report, input.regions, input.comparables)

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer as ArrayBuffer)
}
