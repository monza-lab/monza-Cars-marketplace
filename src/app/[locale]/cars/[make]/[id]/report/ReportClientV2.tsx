"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { CollectorCar } from "@/lib/curatedCars"
import type { SimilarCarResult } from "@/lib/similarCars"
import type { HausReport, HausReportV2 } from "@/lib/fairValue/types"
import type { ModelMarketStats } from "@/lib/reports/types"
import type { DbComparableRow } from "@/lib/db/queries"
import { adaptV1ReportToV2 } from "@/lib/fairValue/adaptV1ToV2"

import { ReportHeader } from "@/components/report/ReportHeader"
import { VerdictBlock } from "@/components/report/VerdictBlock"
import { SpecificCarFairValueBlock } from "@/components/report/SpecificCarFairValueBlock"
import { MarketIntelPanel } from "@/components/report/MarketIntelPanel"
import { WhatsRemarkableBlock } from "@/components/report/WhatsRemarkableBlock"
import { ValuationBreakdownBlock } from "@/components/report/ValuationBreakdownBlock"
import { ArbitrageSignalBlock } from "@/components/report/ArbitrageSignalBlock"
import { ComparablesAndPositioningBlock } from "@/components/report/ComparablesAndPositioningBlock"
import { MarketContextBlock } from "@/components/report/MarketContextBlock"
import { SignalsDetectedBlock } from "@/components/report/SignalsDetectedBlock"
import { QuestionsToAskBlock } from "@/components/report/QuestionsToAskBlock"
import { MethodologyLink } from "@/components/report/MethodologyLink"
import { ReportSourcesBlock } from "@/components/report/ReportSourcesBlock"
import { ReportMetadataFooter } from "@/components/report/ReportMetadataFooter"

interface ReportClientV2Props {
  car: CollectorCar
  similarCars: SimilarCarResult[]
  existingReport: HausReport | null
  marketStats: ModelMarketStats | null
  dbComparables?: DbComparableRow[]
}

export function ReportClientV2({
  car,
  existingReport,
  marketStats,
  dbComparables = [],
}: ReportClientV2Props) {
  const router = useRouter()
  const [downloadSheetOpen, setDownloadSheetOpen] = useState(false)

  // Not-yet-generated state: inform the user to generate first. We intentionally
  // don't gate the new UI behind a full generation flow here — that lives in V1.
  // Phase 3's orchestrator re-integrates generation into V2.
  if (!existingReport) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="font-serif text-[22px] font-semibold">
          No Haus Report generated for this listing yet
        </h1>
        <p className="mt-2 max-w-md text-[13px] text-muted-foreground">
          Return to the classic report view to generate one, then come back here
          to see the new layout.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground"
        >
          Go back
        </button>
      </main>
    )
  }

  // Adapt the v1 report shape into a v2 HausReportV2 for the new blocks.
  const thisVinPriceUsd = deriveAskingUsd(car)
  const v2: HausReportV2 = adaptV1ReportToV2({
    v1Report: existingReport,
    marketStats,
    dbComparables,
    thisVinPriceUsd,
  })

  const verdict = deriveVerdict(v2, thisVinPriceUsd)
  const verdictOneLiner = composeOneLiner(v2, thisVinPriceUsd)
  const deltaPercent = computeDelta(thisVinPriceUsd, v2.specific_car_fair_value_mid)

  const modifierCitationUrls = v2.modifiers_applied.map((m) => ({
    key: m.key,
    url: m.citation_url,
  }))

  return (
    <main className="flex min-h-screen flex-col bg-background pb-20 md:pb-0">
      <ReportHeader
        carTitle={composeCarTitle(car)}
        carThumbUrl={car.images?.[0] ?? null}
        generatedAt={v2.generated_at}
        reportVersion={v2.report_version}
        tier={v2.tier}
        onDownloadClick={() => setDownloadSheetOpen(true)}
      />

      <MarketIntelPanel d1={v2.market_intel.d1} d4={v2.market_intel.d4} />

      <div className="mx-auto w-full max-w-3xl">
        <VerdictBlock
          verdict={verdict}
          oneLiner={verdictOneLiner}
          askingUsd={thisVinPriceUsd}
          fairValueMidUsd={v2.specific_car_fair_value_mid}
          deltaPercent={deltaPercent}
        />

        <SpecificCarFairValueBlock
          fairValueLowUsd={v2.specific_car_fair_value_low}
          fairValueMidUsd={v2.specific_car_fair_value_mid}
          fairValueHighUsd={v2.specific_car_fair_value_high}
          askingUsd={thisVinPriceUsd}
          comparablesCount={v2.comparables_count}
          comparableLayer={v2.comparable_layer_used}
        />

        <WhatsRemarkableBlock
          claims={v2.remarkable_claims}
          tier={v2.tier}
          onUpgradeClick={() => router.push("/pricing")}
        />

        <ValuationBreakdownBlock
          baselineMedianUsd={v2.median_price}
          aggregateModifierPercent={v2.modifiers_total_percent}
          specificCarFairValueMidUsd={v2.specific_car_fair_value_mid}
          modifiers={v2.modifiers_applied}
        />

        {v2.market_intel.d2.by_region.length > 0 && (
          <ArbitrageSignalBlock d2={v2.market_intel.d2} thisListingPriceUsd={thisVinPriceUsd} />
        )}

        <ComparablesAndPositioningBlock
          d3={v2.market_intel.d3}
          thisVinPriceUsd={thisVinPriceUsd}
          comparables={dbComparables}
        />

        <MarketContextBlock regions={marketStats?.regions ?? []} />

        <SignalsDetectedBlock signals={v2.signals_detected} />

        <QuestionsToAskBlock missingSignals={v2.signals_missing} />

        <MethodologyLink />

        <ReportSourcesBlock
          regions={marketStats?.regions ?? []}
          remarkableClaims={v2.remarkable_claims}
          modifierCitationUrls={modifierCitationUrls}
          signalsExtractedAt={v2.signals_extracted_at}
          extractionVersion={v2.extraction_version}
        />

        <ReportMetadataFooter
          generatedAt={v2.generated_at}
          reportHash={v2.report_hash || null}
          modifierVersion="v1.0"
          extractionVersion={v2.extraction_version}
        />
      </div>

      {downloadSheetOpen && (
        <DownloadSheetStub
          onClose={() => setDownloadSheetOpen(false)}
          report={v2}
        />
      )}
    </main>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function composeCarTitle(car: CollectorCar): string {
  const trim = car.trim && car.trim !== "—" && car.trim !== car.model ? ` ${car.trim}` : ""
  return `${car.year} ${car.make} ${car.model}${trim}`
}

function deriveAskingUsd(car: CollectorCar): number {
  // Best-effort — use the highest-confidence USD price we have.
  // Order: soldPriceUsd (verified transaction) → askingPriceUsd (classified)
  // → currentBid / price (native, assume USD for now; Phase 3 resolves currency).
  const candidates = [
    car.soldPriceUsd,
    car.askingPriceUsd,
    car.currentBid,
    car.price,
  ].filter((v): v is number => typeof v === "number" && v > 0)
  return candidates[0] ?? 0
}

function deriveVerdict(report: HausReportV2, askingUsd: number): "BUY" | "WATCH" | "WALK" {
  const delta = computeDelta(askingUsd, report.specific_car_fair_value_mid)
  if (delta <= -5) return "BUY"
  if (delta >= 10) return "WALK"
  return "WATCH"
}

function composeOneLiner(report: HausReportV2, askingUsd: number): string {
  const delta = computeDelta(askingUsd, report.specific_car_fair_value_mid)
  const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`
  return `Priced ${deltaStr} vs specific-car Fair Value · ${report.comparables_count} comparables · ${report.market_intel.d4.confidence_tier} confidence`
}

function computeDelta(askingUsd: number, fairMidUsd: number): number {
  if (!askingUsd || fairMidUsd === 0) return 0
  return ((askingUsd - fairMidUsd) / fairMidUsd) * 100
}

function DownloadSheetStub({
  onClose,
  report,
}: {
  onClose: () => void
  report: HausReportV2
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-card p-6 md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-semibold">Download Report</h3>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Server-side PDF and Excel export arrives in Phase 4/5. For now, use the
          classic report page to download.
        </p>
        <p className="mt-2 text-[11px] font-mono text-muted-foreground">
          Report: {report.report_id}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 block w-full rounded-lg bg-primary px-4 py-2 text-center font-semibold text-primary-foreground"
        >
          Close
        </button>
      </div>
    </div>
  )
}
