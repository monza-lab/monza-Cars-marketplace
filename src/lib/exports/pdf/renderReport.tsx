import { Document, renderToBuffer } from "@react-pdf/renderer"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { RegionalMarketStats } from "@/lib/reports/types"
import type { CollectorCar } from "@/lib/curatedCars"
import type { DbComparableRow } from "@/lib/db/queries"
import type { HausReportV3 } from "@/lib/reports/types-v3"
import { ensureBrandFontsRegistered } from "./fonts"
import type { PdfTheme } from "./theme"
import { Cover } from "./templates/Cover"
import { TableOfContents } from "./templates/TableOfContents"
import { CitationsPage, gatherCitations } from "./templates/CitationsPage"
import { DisclaimerPage } from "./templates/DisclaimerPage"
// Legacy V2 templates — kept for the no-V3 fallback path only
import { RemarkableAndArbitragePage } from "./templates/RemarkableAndArbitragePage"
import { ValuationPage } from "./templates/ValuationPage"
import { ComparablesPage } from "./templates/ComparablesPage"
import { DueDiligencePage } from "./templates/DueDiligencePage"
import { ClosingPage } from "./templates/ClosingPage"
// V3 editorial sections — primary experience
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
  /** Visual theme — defaults to dark editorial. */
  theme?: PdfTheme
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
  const theme: PdfTheme = input.theme ?? "dark"
  const v3 = input.v3Report ?? null
  const reportHash = input.report.report_hash || null
  const generatedAt = input.report.generated_at

  // ──────────────────────────────────────────────────────────────
  // V3 path (primary) — Cover · TOC · 6 V3 sections · Citations · Disclaimer
  // ──────────────────────────────────────────────────────────────
  if (v3) {
    // V3 verdict & fair value override V2 when available (single source of truth)
    const v3Verdict: Verdict = v3.finalSynthesis?.executiveSummary?.keyMetrics?.verdict ?? "PENDING"
    const v3FairRange = v3.finalSynthesis?.executiveSummary?.keyMetrics?.fairValueRange ?? ""
    const parsedRange = parseFairValueRange(v3FairRange)
    const fairLow = parsedRange?.low ?? input.report.specific_car_fair_value_low ?? null
    const fairHigh = parsedRange?.high ?? input.report.specific_car_fair_value_high ?? null
    const fairMid =
      input.report.specific_car_fair_value_mid ??
      (parsedRange ? (parsedRange.low + parsedRange.high) / 2 : null)
    const headline = v3.finalSynthesis?.executiveSummary?.headline ?? null

    // Page numbering — V3 flow has 10 pages total
    const PG_COVER = 1
    const PG_TOC = 2
    const PG_EXEC = 3
    const PG_TECH = 4
    const PG_INVEST = 5
    const PG_DD = 6
    const PG_MARKET = 7
    const PG_BUYER = 8
    const PG_CITATIONS = 9
    const PG_DISCLAIMER = 10
    const TOTAL = 10

    const tocEntries = [
      { number: "01", title: "Executive Summary", summary: "The verdict, the thesis, the score.", page: PG_EXEC },
      { number: "02", title: "Technical Deep-Dive", summary: "Model history, what makes this spec special, known issues.", page: PG_TECH },
      { number: "03", title: "Investment Strategy", summary: "Bid ceiling, ownership costs, resale timeline.", page: PG_INVEST },
      { number: "04", title: "Due Diligence", summary: "Risk score, questions to ask, pre-purchase checklist.", page: PG_DD },
      { number: "05", title: "Market Research", summary: "Expert consensus, owner sentiment, heritage.", page: PG_MARKET },
      { number: "06", title: "Buyer Services & Logistics", summary: "Parts, insurance, regional markets, transport.", page: PG_BUYER },
      { number: "07", title: "Sources", summary: "Every citation in this dossier.", page: PG_CITATIONS },
      { number: "08", title: "The Fine Print", summary: "Disclaimer, methodology, independence.", page: PG_DISCLAIMER },
    ]

    // Gather citations from V2 modifiers (have URLs) + V3 generic refs.
    // AppliedModifier uses `key` (snake_case ID) and `citation_url` per types.ts.
    const modifierCitations = (input.report.modifiers_applied || []).map((m) => ({
      label: m.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      sourceUrl: m.citation_url,
    }))
    const citations = gatherCitations(modifierCitations, v3.marketResearch?.expertConsensus?.compiledAnalysis ?? null)

    const doc = (
      <Document
        title={`Haus Report ${input.car.year} ${input.car.make} ${input.car.model}`}
        author="MonzaHaus"
        producer="MonzaHaus"
        keywords={`porsche,valuation,haus-report,${input.report.tier}`}
      >
        <Cover
          report={input.report}
          car={input.car}
          verdict={v3Verdict}
          fairValueLow={fairLow}
          fairValueHigh={fairHigh}
          fairValueMid={fairMid}
          askingUsd={input.askingUsd}
          totalPages={TOTAL}
          headline={headline}
          reportVersionLabel={3}
          theme={theme}
        />
        <TableOfContents
          entries={tocEntries}
          reportHash={reportHash}
          generatedAt={generatedAt}
          pageNumber={PG_TOC}
          totalPages={TOTAL}
          theme={theme}
        />
        <ExecutiveSummaryPage
          data={v3.finalSynthesis!}
          reportHash={reportHash}
          generatedAt={generatedAt}
          pageNumber={PG_EXEC}
          totalPages={TOTAL}
          theme={theme}
        />
        <TechnicalAnalysisPage
          data={v3.technicalAnalysis!}
          reportHash={reportHash}
          generatedAt={generatedAt}
          pageNumber={PG_TECH}
          totalPages={TOTAL}
          theme={theme}
        />
        <InvestmentStrategyPage
          data={v3.investmentAnalysis!}
          listingType={v3.vehicleIdentity?.listingType ?? "classified"}
          reportHash={reportHash}
          generatedAt={generatedAt}
          pageNumber={PG_INVEST}
          totalPages={TOTAL}
          theme={theme}
        />
        <DueDiligenceV3Page
          data={v3.dueDiligence!}
          reportHash={reportHash}
          generatedAt={generatedAt}
          pageNumber={PG_DD}
          totalPages={TOTAL}
          theme={theme}
        />
        <MarketResearchPage
          data={v3.marketResearch!}
          reportHash={reportHash}
          generatedAt={generatedAt}
          pageNumber={PG_MARKET}
          totalPages={TOTAL}
          theme={theme}
        />
        <BuyerServicesPage
          data={v3.buyerServices!}
          reportHash={reportHash}
          generatedAt={generatedAt}
          pageNumber={PG_BUYER}
          totalPages={TOTAL}
          theme={theme}
        />
        <CitationsPage
          citations={citations}
          reportHash={reportHash}
          generatedAt={generatedAt}
          pageNumber={PG_CITATIONS}
          totalPages={TOTAL}
          theme={theme}
        />
        <DisclaimerPage
          reportHash={reportHash}
          generatedAt={generatedAt}
          pageNumber={PG_DISCLAIMER}
          totalPages={TOTAL}
          theme={theme}
        />
      </Document>
    )
    return renderToBuffer(doc)
  }

  // ──────────────────────────────────────────────────────────────
  // V2-only fallback — used when no V3 sections exist yet.
  // Keeps the legacy flow for back-compat.
  // ──────────────────────────────────────────────────────────────
  const verdict = deriveVerdict(input.askingUsd, input.report.specific_car_fair_value_mid)
  const verdictOneLiner = composeOneLiner(input.report, input.askingUsd)
  const TOTAL_PAGES_V2 = 6
  const doc = (
    <Document
      title={`Haus Report ${input.car.year} ${input.car.make} ${input.car.model}`}
      author="MonzaHaus"
      producer="MonzaHaus"
      keywords={`porsche,valuation,haus-report,${input.report.tier}`}
    >
      <Cover
        report={input.report}
        car={input.car}
        verdict={verdict}
        fairValueLow={input.report.specific_car_fair_value_low ?? null}
        fairValueHigh={input.report.specific_car_fair_value_high ?? null}
        fairValueMid={input.report.specific_car_fair_value_mid ?? null}
        askingUsd={input.askingUsd}
        totalPages={TOTAL_PAGES_V2}
        headline={null}
        theme={theme}
      />
      <RemarkableAndArbitragePage
        report={input.report}
        thisVinPriceUsd={input.askingUsd}
        pageNumber={2}
        totalPages={TOTAL_PAGES_V2}
      />
      <ValuationPage
        report={input.report}
        askingUsd={input.askingUsd}
        verdictOneLiner={verdictOneLiner}
        pageNumber={3}
        totalPages={TOTAL_PAGES_V2}
      />
      <ComparablesPage
        report={input.report}
        comparables={input.comparables}
        regions={input.regions}
        pageNumber={4}
        totalPages={TOTAL_PAGES_V2}
      />
      <DueDiligencePage report={input.report} pageNumber={5} totalPages={TOTAL_PAGES_V2} />
      <ClosingPage
        report={input.report}
        regions={input.regions}
        pageNumber={6}
        totalPages={TOTAL_PAGES_V2}
      />
    </Document>
  )
  return renderToBuffer(doc)
}

/**
 * Parse a fair value range string like "$880K – $975K" into numeric low/high.
 * Returns null if parsing fails.
 */
function parseFairValueRange(s: string): { low: number; high: number } | null {
  if (!s) return null
  const matches = s.match(/\$?([\d.]+)\s*([KkMm]?)\s*[–-]\s*\$?([\d.]+)\s*([KkMm]?)/)
  if (!matches) return null
  const parse = (n: string, unit: string) => {
    const base = parseFloat(n)
    if (!Number.isFinite(base)) return null
    if (unit.toLowerCase() === "k") return base * 1_000
    if (unit.toLowerCase() === "m") return base * 1_000_000
    return base
  }
  const low = parse(matches[1], matches[2])
  const high = parse(matches[3], matches[4])
  if (low == null || high == null) return null
  return { low, high }
}
