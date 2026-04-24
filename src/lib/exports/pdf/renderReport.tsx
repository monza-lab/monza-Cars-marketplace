import { Document, renderToBuffer } from "@react-pdf/renderer"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { RegionalMarketStats } from "@/lib/reports/types"
import type { CollectorCar } from "@/lib/curatedCars"
import type { DbComparableRow } from "@/lib/db/queries"
import { ensureBrandFontsRegistered } from "./fonts"
import { Cover } from "./templates/Cover"
import { RemarkableAndArbitragePage } from "./templates/RemarkableAndArbitragePage"
import { ValuationPage } from "./templates/ValuationPage"
import { ComparablesPage } from "./templates/ComparablesPage"
import { DueDiligencePage } from "./templates/DueDiligencePage"
import { ClosingPage } from "./templates/ClosingPage"

export interface RenderReportInput {
  report: HausReportV2
  car: CollectorCar
  regions: RegionalMarketStats[]
  comparables: DbComparableRow[]
  askingUsd: number
}

const TOTAL_PAGES = 6

function deriveVerdict(askingUsd: number, fairMid: number): "BUY" | "WATCH" | "WALK" {
  if (fairMid === 0) return "WATCH"
  const delta = ((askingUsd - fairMid) / fairMid) * 100
  if (delta <= -5) return "BUY"
  if (delta >= 10) return "WALK"
  return "WATCH"
}

function composeOneLiner(report: HausReportV2, askingUsd: number): string {
  if (report.specific_car_fair_value_mid === 0) return "Fair value not yet computed"
  const delta =
    ((askingUsd - report.specific_car_fair_value_mid) / report.specific_car_fair_value_mid) * 100
  const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`
  return `Priced ${deltaStr} vs specific-car Fair Value · ${report.comparables_count} comparables · ${report.market_intel.d4.confidence_tier} confidence`
}

export async function renderReportToPdfBuffer(input: RenderReportInput): Promise<Buffer> {
  ensureBrandFontsRegistered()
  const verdict = deriveVerdict(input.askingUsd, input.report.specific_car_fair_value_mid)
  const verdictOneLiner = composeOneLiner(input.report, input.askingUsd)

  const doc = (
    <Document
      title={`Haus Report ${input.car.year} ${input.car.make} ${input.car.model}`}
      author="Monza Haus"
      producer="Monza Haus"
      keywords={`porsche,valuation,haus-report,${input.report.tier}`}
    >
      <Cover
        report={input.report}
        car={input.car}
        verdict={verdict}
        askingUsd={input.askingUsd}
        totalPages={TOTAL_PAGES}
      />
      <RemarkableAndArbitragePage
        report={input.report}
        thisVinPriceUsd={input.askingUsd}
        pageNumber={2}
        totalPages={TOTAL_PAGES}
      />
      <ValuationPage
        report={input.report}
        askingUsd={input.askingUsd}
        verdictOneLiner={verdictOneLiner}
        pageNumber={3}
        totalPages={TOTAL_PAGES}
      />
      <ComparablesPage
        report={input.report}
        comparables={input.comparables}
        regions={input.regions}
        pageNumber={4}
        totalPages={TOTAL_PAGES}
      />
      <DueDiligencePage report={input.report} pageNumber={5} totalPages={TOTAL_PAGES} />
      <ClosingPage
        report={input.report}
        regions={input.regions}
        pageNumber={6}
        totalPages={TOTAL_PAGES}
      />
    </Document>
  )

  return renderToBuffer(doc)
}
