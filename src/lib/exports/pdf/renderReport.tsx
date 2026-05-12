import { Document, renderToBuffer } from "@react-pdf/renderer"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { RegionalMarketStats } from "@/lib/reports/types"
import type { CollectorCar } from "@/lib/curatedCars"
import type { DbComparableRow } from "@/lib/db/queries"
import type { HausReportV3 } from "@/lib/reports/types-v3"
import { ensureBrandFontsRegistered } from "./fonts"
import { Cover } from "./templates/Cover"
import { RemarkableAndArbitragePage } from "./templates/RemarkableAndArbitragePage"
import { ValuationPage } from "./templates/ValuationPage"
import { ComparablesPage } from "./templates/ComparablesPage"
import { DueDiligencePage } from "./templates/DueDiligencePage"
import { ClosingPage } from "./templates/ClosingPage"
import { ExecutiveSummaryPage } from "./templates/v3/ExecutiveSummaryPage"
import { TechnicalAnalysisPage } from "./templates/v3/TechnicalAnalysisPage"
import { InvestmentStrategyPage } from "./templates/v3/InvestmentStrategyPage"
import { DueDiligenceV3Page } from "./templates/v3/DueDiligenceV3Page"
import { MarketResearchPage } from "./templates/v3/MarketResearchPage"
import { BuyerServicesPage } from "./templates/v3/BuyerServicesPage"

export interface RenderReportInput {
  report: HausReportV2
  car: CollectorCar
  regions: RegionalMarketStats[]
  comparables: DbComparableRow[]
  askingUsd: number
  v3Report?: HausReportV3 | null
}

export type Verdict = "BUY" | "WATCH" | "WALK" | "PENDING"

function deriveVerdict(askingUsd: number, fairMid: number | null): Verdict {
  if (fairMid === 0 || fairMid == null) return "PENDING"
  const delta = ((askingUsd - fairMid) / fairMid) * 100
  if (delta <= -5) return "BUY"
  if (delta >= 10) return "WALK"
  return "WATCH"
}

function composeOneLiner(report: HausReportV2, askingUsd: number): string {
  if (!report.specific_car_fair_value_mid) return "Fair value not yet computed"
  const delta =
    ((askingUsd - report.specific_car_fair_value_mid) / report.specific_car_fair_value_mid) * 100
  const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`
  return `Priced ${deltaStr} vs specific-car Fair Value · ${report.comparables_count} comparables · ${report.market_intel.d4.confidence_tier} confidence`
}

export async function renderReportToPdfBuffer(input: RenderReportInput): Promise<Buffer> {
  ensureBrandFontsRegistered()
  const verdict = deriveVerdict(input.askingUsd, input.report.specific_car_fair_value_mid)
  const verdictOneLiner = composeOneLiner(input.report, input.askingUsd)
  const v3 = input.v3Report ?? null
  const reportHash = input.report.report_hash || ""
  const generatedAt = input.report.generated_at

  // Count total pages
  const v3Count = v3 ? [
    v3.finalSynthesis?.executiveSummary,
    v3.technicalAnalysis,
    v3.investmentAnalysis?.strategy,
    v3.dueDiligence,
    v3.marketResearch,
    v3.buyerServices,
  ].filter(Boolean).length : 0
  const TOTAL_PAGES = 6 + v3Count

  // Assign sequential page numbers for V3 pages
  let pg = 7
  const pgExec = v3?.finalSynthesis?.executiveSummary ? pg++ : 0
  const pgTech = v3?.technicalAnalysis ? pg++ : 0
  const pgInvest = v3?.investmentAnalysis?.strategy ? pg++ : 0
  const pgDD = v3?.dueDiligence ? pg++ : 0
  const pgMarket = v3?.marketResearch ? pg++ : 0
  const pgBuyer = v3?.buyerServices ? pg++ : 0

  // V2-only: no V3 data available
  if (!v3) {
    const doc = (
      <Document
        title={`Haus Report ${input.car.year} ${input.car.make} ${input.car.model}`}
        author="Monza Haus"
        producer="Monza Haus"
        keywords={`porsche,valuation,haus-report,${input.report.tier}`}
      >
        <Cover report={input.report} car={input.car} verdict={verdict} askingUsd={input.askingUsd} totalPages={TOTAL_PAGES} />
        <RemarkableAndArbitragePage report={input.report} thisVinPriceUsd={input.askingUsd} pageNumber={2} totalPages={TOTAL_PAGES} />
        <ValuationPage report={input.report} askingUsd={input.askingUsd} verdictOneLiner={verdictOneLiner} pageNumber={3} totalPages={TOTAL_PAGES} />
        <ComparablesPage report={input.report} comparables={input.comparables} regions={input.regions} pageNumber={4} totalPages={TOTAL_PAGES} />
        <DueDiligencePage report={input.report} pageNumber={5} totalPages={TOTAL_PAGES} />
        <ClosingPage report={input.report} regions={input.regions} pageNumber={6} totalPages={TOTAL_PAGES} />
      </Document>
    )
    return renderToBuffer(doc)
  }

  // Full V2+V3 document — all V3 pages rendered unconditionally with their data
  // (sections are guaranteed non-null at this point due to the v3Count check)
  const doc = (
    <Document
      title={`Haus Report ${input.car.year} ${input.car.make} ${input.car.model}`}
      author="Monza Haus"
      producer="Monza Haus"
      keywords={`porsche,valuation,haus-report,${input.report.tier}`}
    >
      <Cover report={input.report} car={input.car} verdict={verdict} askingUsd={input.askingUsd} totalPages={TOTAL_PAGES} />
      <RemarkableAndArbitragePage report={input.report} thisVinPriceUsd={input.askingUsd} pageNumber={2} totalPages={TOTAL_PAGES} />
      <ValuationPage report={input.report} askingUsd={input.askingUsd} verdictOneLiner={verdictOneLiner} pageNumber={3} totalPages={TOTAL_PAGES} />
      <ComparablesPage report={input.report} comparables={input.comparables} regions={input.regions} pageNumber={4} totalPages={TOTAL_PAGES} />
      <DueDiligencePage report={input.report} pageNumber={5} totalPages={TOTAL_PAGES} />
      <ClosingPage report={input.report} regions={input.regions} pageNumber={6} totalPages={TOTAL_PAGES} />
      <ExecutiveSummaryPage data={v3.finalSynthesis!} reportHash={reportHash} generatedAt={generatedAt} pageNumber={pgExec || 7} totalPages={TOTAL_PAGES} />
      <TechnicalAnalysisPage data={v3.technicalAnalysis!} reportHash={reportHash} generatedAt={generatedAt} pageNumber={pgTech || 8} totalPages={TOTAL_PAGES} />
      <InvestmentStrategyPage data={v3.investmentAnalysis!} listingType={v3.vehicleIdentity?.listingType ?? "classified"} reportHash={reportHash} generatedAt={generatedAt} pageNumber={pgInvest || 9} totalPages={TOTAL_PAGES} />
      <DueDiligenceV3Page data={v3.dueDiligence!} reportHash={reportHash} generatedAt={generatedAt} pageNumber={pgDD || 10} totalPages={TOTAL_PAGES} />
      <MarketResearchPage data={v3.marketResearch!} reportHash={reportHash} generatedAt={generatedAt} pageNumber={pgMarket || 11} totalPages={TOTAL_PAGES} />
      <BuyerServicesPage data={v3.buyerServices!} reportHash={reportHash} generatedAt={generatedAt} pageNumber={pgBuyer || 12} totalPages={TOTAL_PAGES} />
    </Document>
  )
  return renderToBuffer(doc)
}
