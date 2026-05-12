"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Lock, FileText } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { OutOfPistonsModal } from "@/components/payments/OutOfPistonsModal"
import type { CollectorCar } from "@/lib/curatedCars"
import type { SimilarCarResult } from "@/lib/similarCars"
import type { HausReport, HausReportV2, MarketIntelD2, ReportTier } from "@/lib/fairValue/types"
import type { ModelMarketStats } from "@/lib/reports/types"
import type { DbComparableRow } from "@/lib/db/queries"
import { adaptV1ReportToV2 } from "@/lib/fairValue/adaptV1ToV2"
import type {
  HausReportV3,
  PipelineProgress,
  StepStatus,
  ReportSectionKey,
} from "@/lib/reports/types-v3"

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
import { SeeSampleModal } from "@/components/report/SeeSampleModal"
import { DownloadSheet } from "@/components/report/DownloadSheet"
import { ColorIntelBlock } from "@/components/report/ColorIntelBlock"
import { VinIntelBlock } from "@/components/report/VinIntelBlock"
import { InvestmentStoryBlock } from "@/components/report/InvestmentStoryBlock"

// ─── V3 dedicated section components ─────────────────────────────────
import { ExecutiveSummarySection } from "@/components/report/v3/ExecutiveSummarySection"
import { TechnicalAnalysisSection } from "@/components/report/v3/TechnicalAnalysisSection"
import { InvestmentStrategySection } from "@/components/report/v3/InvestmentStrategySection"
import { DueDiligenceSection } from "@/components/report/v3/DueDiligenceSection"
import { MarketResearchSection } from "@/components/report/v3/MarketResearchSection"
import { BuyerServicesSection } from "@/components/report/v3/BuyerServicesSection"
import { OwnershipCostSection } from "@/components/report/v3/OwnershipCostSection"
import { ResaleTimelineSection } from "@/components/report/v3/ResaleTimelineSection"

// ─── V3 Step definitions (mirrors pipeline.ts STEP_DEFS) ─────────────
const V3_STEP_LABELS: { sectionKey: ReportSectionKey; label: string }[] = [
  { sectionKey: "listing_scrape", label: "Reading Listing" },
  { sectionKey: "vehicle_identity", label: "Identifying Vehicle" },
  { sectionKey: "market_data_bundle", label: "Analyzing Market Data" },
  { sectionKey: "fair_value", label: "Computing Fair Value" },
  { sectionKey: "technical_analysis", label: "Technical Deep-Dive" },
  { sectionKey: "investment_analysis", label: "Investment Analysis" },
  { sectionKey: "due_diligence", label: "Due Diligence" },
  { sectionKey: "market_research", label: "Market Research" },
  { sectionKey: "buyer_services", label: "Buyer Services" },
  { sectionKey: "final_synthesis", label: "Final Report" },
]

interface GenerationStep {
  sectionKey: ReportSectionKey
  label: string
  status: StepStatus
  durationMs?: number
  completionNote?: string
}

interface ReportClientV2Props {
  car: CollectorCar
  similarCars: SimilarCarResult[]
  existingReport: HausReport | null
  marketStats: ModelMarketStats | null
  dbComparables?: DbComparableRow[]
  d2Precomputed?: MarketIntelD2
  reportTier?: ReportTier | null
  reportHash?: string | null
  reportVersion?: number | null
  v3Report?: HausReportV3 | null
  userHasAccess?: boolean
}

export function ReportClientV2({
  car,
  existingReport,
  marketStats,
  dbComparables = [],
  d2Precomputed,
  reportTier,
  reportHash,
  reportVersion,
  v3Report: initialV3Report,
  userHasAccess = false,
}: ReportClientV2Props) {
  const router = useRouter()
  const [downloadSheetOpen, setDownloadSheetOpen] = useState(false)
  const [seeSampleOpen, setSeeSampleOpen] = useState(false)

  // ─── V3 state ───────────────────────────────────────────────────────
  const [isGeneratingV3, setIsGeneratingV3] = useState(false)
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>(() =>
    V3_STEP_LABELS.map(s => ({ ...s, status: "pending" as StepStatus }))
  )
  const [v3Data, setV3Data] = useState<HausReportV3 | null>(initialV3Report ?? null)
  const [v3Error, setV3Error] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleGenerateV3 = useCallback(async (force = false) => {
    setIsGeneratingV3(true)
    setV3Error(null)
    setGenerationSteps(V3_STEP_LABELS.map(s => ({ ...s, status: "pending" as StepStatus })))

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/analyze/v3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: car.id, force }),
        signal: controller.signal,
      })

      // Non-stream responses (cached, error)
      if (res.headers.get("Content-Type")?.includes("application/json")) {
        const json = await res.json()
        if (!res.ok) {
          if (res.status === 402 || json.error === "Insufficient credits") {
            setOutOfReportsOpen(true)
          }
          setV3Error(json.error ?? "Generation failed")
          setIsGeneratingV3(false)
          return
        }
        if (json.cached) {
          // Reconstruct V3 report from cached sections
          const sections = json.sections as { key: ReportSectionKey; data: unknown }[]
          const assembled: HausReportV3 = {
            listingId: car.id,
            reportVersion: 3,
            listingScrape: sections.find(s => s.key === "listing_scrape")?.data as HausReportV3["listingScrape"] ?? null,
            vehicleIdentity: sections.find(s => s.key === "vehicle_identity")?.data as HausReportV3["vehicleIdentity"] ?? null,
            marketData: sections.find(s => s.key === "market_data_bundle")?.data as HausReportV3["marketData"] ?? null,
            technicalAnalysis: sections.find(s => s.key === "technical_analysis")?.data as HausReportV3["technicalAnalysis"] ?? null,
            investmentAnalysis: sections.find(s => s.key === "investment_analysis")?.data as HausReportV3["investmentAnalysis"] ?? null,
            dueDiligence: sections.find(s => s.key === "due_diligence")?.data as HausReportV3["dueDiligence"] ?? null,
            marketResearch: sections.find(s => s.key === "market_research")?.data as HausReportV3["marketResearch"] ?? null,
            buyerServices: sections.find(s => s.key === "buyer_services")?.data as HausReportV3["buyerServices"] ?? null,
            finalSynthesis: sections.find(s => s.key === "final_synthesis")?.data as HausReportV3["finalSynthesis"] ?? null,
            generatedAt: new Date().toISOString(),
            totalDurationMs: 0,
            stepsCompleted: sections.length,
            stepsFailed: 10 - sections.length,
          }
          setV3Data(assembled)
          setGenerationSteps(prev => prev.map(s => ({ ...s, status: "completed" as StepStatus })))
          setIsGeneratingV3(false)
          // Reload if user was on the paywall
          if (!userHasAccess && typeof window !== "undefined") {
            window.location.reload()
          }
          return
        }
      }

      // SSE stream
      const reader = res.body?.getReader()
      if (!reader) {
        setV3Error("No response stream")
        setIsGeneratingV3(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        let currentEvent = ""
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6))

              if (currentEvent === "progress") {
                const progress = data as PipelineProgress
                setGenerationSteps(prev =>
                  prev.map(s =>
                    s.sectionKey === progress.sectionKey
                      ? {
                          ...s,
                          status: progress.status,
                          durationMs: progress.durationMs,
                          completionNote: progress.completionNote,
                        }
                      : s
                  )
                )
              } else if (currentEvent === "complete") {
                setV3Data(data.report as HausReportV3)
                setIsGeneratingV3(false)
                // Reload if user was on the paywall — server will now see them as paid
                if (!userHasAccess && typeof window !== "undefined") {
                  window.location.reload()
                }
              } else if (currentEvent === "error") {
                setV3Error(data.message ?? "Pipeline failed")
                setIsGeneratingV3(false)
              }
            } catch {
              // Ignore malformed JSON lines
            }
            currentEvent = ""
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setV3Error(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setIsGeneratingV3(false)
      abortRef.current = null
    }
  }, [car.id])

  // Derive listing type from v3 vehicle identity
  const listingType = v3Data?.vehicleIdentity?.listingType ?? "classified"

  // ─── Auth helpers for paywall ──────────────────────────────────────
  const { profile: authProfile } = useAuth()
  const [outOfReportsOpen, setOutOfReportsOpen] = useState(false)

  // ─── PAYWALL: show locked preview if user hasn't paid ─────────────
  if (!userHasAccess) {
    const carTitle = composeCarTitle(car)
    const thumbUrl = car.images?.[0] ?? null

    const handleUnlock = () => {
      // If user is not logged in, redirect to auth
      if (!authProfile) {
        router.push("/auth/login")
        return
      }
      // Trigger generation via API (which handles credit deduction)
      handleGenerateV3()
    }

    return (
      <main className="flex min-h-screen flex-col bg-background pb-20 md:pb-0">
        <ReportHeader
          carTitle={carTitle}
          carThumbUrl={thumbUrl}
          generatedAt={new Date().toISOString()}
          reportVersion={3}
          tier="tier_1"
          onDownloadClick={() => {}}
        />

        <div className="mx-auto w-full max-w-3xl px-4 mt-8 space-y-6">
          {/* Locked report preview */}
          <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
            {/* Blurred teaser content */}
            <div className="p-6 space-y-4 blur-sm select-none pointer-events-none" aria-hidden>
              <div className="h-5 w-3/4 bg-muted-foreground/10 rounded" />
              <div className="h-4 w-full bg-muted-foreground/8 rounded" />
              <div className="h-4 w-5/6 bg-muted-foreground/8 rounded" />
              <div className="h-4 w-2/3 bg-muted-foreground/8 rounded" />
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="h-20 bg-muted-foreground/6 rounded-lg" />
                <div className="h-20 bg-muted-foreground/6 rounded-lg" />
                <div className="h-20 bg-muted-foreground/6 rounded-lg" />
              </div>
              <div className="h-4 w-full bg-muted-foreground/8 rounded" />
              <div className="h-4 w-4/5 bg-muted-foreground/8 rounded" />
            </div>

            {/* Overlay with unlock CTA */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
                <div className="rounded-full bg-primary/10 p-4">
                  <Lock className="size-8 text-primary" />
                </div>
                <h2 className="text-xl font-serif font-semibold text-foreground">
                  Investment Dossier
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This report includes fair value analysis, market positioning,
                  risk signals, and actionable buying intelligence for this vehicle.
                </p>
                <p className="text-xs text-muted-foreground">
                  100 Pistons per report
                </p>

                {/* V3 generation in progress */}
                {isGeneratingV3 && (
                  <div className="w-full mt-2">
                    <GenerationStepper steps={generationSteps} />
                  </div>
                )}

                {v3Error && !isGeneratingV3 && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-[13px] text-destructive w-full">
                    {v3Error}
                  </div>
                )}

                {!isGeneratingV3 && (
                  <button
                    type="button"
                    onClick={handleUnlock}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <FileText className="size-4" />
                    {authProfile ? "Unlock Report" : "Sign in to Unlock"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => router.back()}
                  className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                >
                  Back to listing
                </button>
              </div>
            </div>
          </div>
        </div>

        <OutOfPistonsModal
          open={outOfReportsOpen}
          onOpenChange={setOutOfReportsOpen}
          neededPistons={100}
          currentBalance={authProfile?.pistonsBalance ?? authProfile?.creditsBalance ?? 0}
        />
      </main>
    )
  }

  // ─── V3-only mode: no V2 report but V3 sections exist ──────────────
  if (!existingReport) {
    return (
      <main className="flex min-h-screen flex-col bg-background pb-20 md:pb-0">
        <ReportHeader
          carTitle={composeCarTitle(car)}
          carThumbUrl={car.images?.[0] ?? null}
          generatedAt={v3Data?.generatedAt ?? new Date().toISOString()}
          reportVersion={3}
          tier="tier_3"
          onDownloadClick={() => setDownloadSheetOpen(true)}
        />

        <div className="mx-auto w-full max-w-3xl px-4 space-y-6 mt-6">
          {/* V3 generation in progress */}
          {isGeneratingV3 && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-serif text-[18px] font-semibold mb-4">
                Generating Investment Dossier
              </h2>
              <GenerationStepper steps={generationSteps} />
            </div>
          )}

          {v3Error && !isGeneratingV3 && (
            <div className="rounded-lg bg-destructive/10 p-4 text-[13px] text-destructive">
              {v3Error}
              <button
                type="button"
                onClick={() => handleGenerateV3(true)}
                className="ml-3 underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* V3 sections — dedicated components */}
          {v3Data && !isGeneratingV3 && (
            <>
              <ExecutiveSummarySection data={v3Data.finalSynthesis} />
              <TechnicalAnalysisSection data={v3Data.technicalAnalysis} />
              <InvestmentStrategySection data={v3Data.investmentAnalysis} listingType={listingType} />
              <OwnershipCostSection data={v3Data.investmentAnalysis?.ownershipCosts ?? null} />
              <ResaleTimelineSection data={v3Data.investmentAnalysis?.resaleTimeline ?? null} />
              <DueDiligenceSection data={v3Data.dueDiligence} />
              <MarketResearchSection data={v3Data.marketResearch} />
              <BuyerServicesSection data={v3Data.buyerServices} />

              {/* V3 metadata footer */}
              <div className="border-t border-border pt-4 text-[11px] text-muted-foreground">
                <p>V3 Report generated at {new Date(v3Data.generatedAt).toLocaleString()}</p>
                <p>{v3Data.stepsCompleted}/10 steps completed in {(v3Data.totalDurationMs / 1000).toFixed(1)}s</p>
              </div>

              <div className="flex justify-center pb-8">
                <button
                  type="button"
                  onClick={() => handleGenerateV3(true)}
                  className="text-[12px] text-muted-foreground underline hover:text-foreground transition-colors"
                >
                  Regenerate Report
                </button>
              </div>
            </>
          )}
        </div>

        <DownloadSheet
          open={downloadSheetOpen}
          onClose={() => setDownloadSheetOpen(false)}
          listingId={car.id}
          reportHash={null}
        />
      </main>
    )
  }

  // ─── V2+V3 mode: existing V2 report with optional V3 sections ──────
  const thisVinPriceUsd = deriveAskingUsd(car)
  const v2: HausReportV2 = adaptV1ReportToV2({
    v1Report: existingReport,
    marketStats,
    dbComparables,
    thisVinPriceUsd,
    d2Precomputed,
    tier: reportTier ?? undefined,
    reportHash: reportHash ?? undefined,
    reportVersion: reportVersion ?? undefined,
  })

  const verdict = deriveVerdict(v2, thisVinPriceUsd)
  const verdictOneLiner = composeOneLiner(v2, thisVinPriceUsd)
  const deltaPercent = computeDelta(thisVinPriceUsd, v2.specific_car_fair_value_mid)

  const modifierCitationUrls = v2.modifiers_applied.map((m) => ({
    key: m.key,
    url: m.citation_url,
  }))

  const comparablesSources = deriveComparablesSources(marketStats, dbComparables)
  const comparablesCaptureDateRange = deriveComparablesCaptureDateRange(dbComparables, marketStats)

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

        <InvestmentStoryBlock narrative={v2.investment_narrative} />

        <ColorIntelBlock colorIntel={v2.color_intelligence} />

        <VinIntelBlock
          vinIntel={v2.vin_intelligence}
          vin={car.vin ?? null}
        />

        <SpecificCarFairValueBlock
          fairValueLowUsd={v2.specific_car_fair_value_low}
          fairValueMidUsd={v2.specific_car_fair_value_mid}
          fairValueHighUsd={v2.specific_car_fair_value_high}
          askingUsd={thisVinPriceUsd}
          comparablesCount={v2.comparables_count}
          comparableLayer={v2.comparable_layer_used}
          comparablesSources={comparablesSources}
        />

        <WhatsRemarkableBlock
          claims={v2.remarkable_claims}
          tier={v2.tier}
          onUpgradeClick={() => router.push("/pricing")}
          onSeeSampleClick={() => setSeeSampleOpen(true)}
        />

        <ValuationBreakdownBlock
          baselineMedianUsd={v2.median_price}
          aggregateModifierPercent={v2.modifiers_total_percent}
          specificCarFairValueMidUsd={v2.specific_car_fair_value_mid ?? 0}
          modifiers={v2.modifiers_applied}
        />

        {v2.market_intel.d2.by_region.length > 0 && (
          <ArbitrageSignalBlock
            d2={v2.market_intel.d2}
            thisListingPriceUsd={thisVinPriceUsd}
            landedCostMethodologyHref="/methodology#landed-cost"
          />
        )}

        <ComparablesAndPositioningBlock
          d3={v2.market_intel.d3}
          thisVinPriceUsd={thisVinPriceUsd}
          comparables={dbComparables}
          captureDateRange={comparablesCaptureDateRange}
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
          extractionVersion={v2.extraction_version ?? undefined}
        />

        <ReportMetadataFooter
          generatedAt={v2.generated_at}
          reportHash={v2.report_hash || null}
          modifierVersion="v1.0"
          extractionVersion={v2.extraction_version ?? "—"}
        />

        {/* ─── V3 Sections (dedicated components) ─────────────────── */}
        {isGeneratingV3 && (
          <div className="mt-10 border-t border-border pt-8">
            <h2 className="font-serif text-[18px] font-semibold mb-4">
              Generating V3 Dossier
            </h2>
            <GenerationStepper steps={generationSteps} />
          </div>
        )}

        {v3Error && !isGeneratingV3 && (
          <div className="mt-6 rounded-lg bg-destructive/10 p-4 text-[13px] text-destructive">
            {v3Error}
          </div>
        )}

        {v3Data && !isGeneratingV3 && (
          <div className="mt-10 border-t border-border pt-8 space-y-6">
            <ExecutiveSummarySection data={v3Data.finalSynthesis} />
            <TechnicalAnalysisSection data={v3Data.technicalAnalysis} />
            <InvestmentStrategySection data={v3Data.investmentAnalysis} listingType={listingType} />
            <OwnershipCostSection data={v3Data.investmentAnalysis?.ownershipCosts ?? null} />
            <ResaleTimelineSection data={v3Data.investmentAnalysis?.resaleTimeline ?? null} />
            <DueDiligenceSection data={v3Data.dueDiligence} />
            <MarketResearchSection data={v3Data.marketResearch} />
            <BuyerServicesSection data={v3Data.buyerServices} />

            {/* V3 metadata footer */}
            <div className="border-t border-border pt-4 text-[11px] text-muted-foreground">
              <p>V3 Report generated at {new Date(v3Data.generatedAt).toLocaleString()}</p>
              <p>{v3Data.stepsCompleted}/10 steps completed in {(v3Data.totalDurationMs / 1000).toFixed(1)}s</p>
            </div>
          </div>
        )}

        {!isGeneratingV3 && !v3Data && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => handleGenerateV3()}
              className="rounded-lg bg-primary/10 px-5 py-2.5 text-[13px] font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              Generate V3 Investment Dossier
            </button>
          </div>
        )}

        {v3Data && !isGeneratingV3 && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => handleGenerateV3(true)}
              className="text-[12px] text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Regenerate V3 Report
            </button>
          </div>
        )}
      </div>

      <DownloadSheet
        open={downloadSheetOpen}
        onClose={() => setDownloadSheetOpen(false)}
        listingId={car.id}
        reportHash={v2.report_hash || null}
        verifyHref={v2.report_hash ? `/verify/${v2.report_hash}` : undefined}
      />

      <SeeSampleModal
        open={seeSampleOpen}
        onClose={() => setSeeSampleOpen(false)}
        onUpgradeClick={() => {
          setSeeSampleOpen(false)
          router.push("/pricing")
        }}
      />
    </main>
  )
}

// ─── V3 Generation Stepper ───────────────────────────────────────────

function GenerationStepper({ steps }: { steps: GenerationStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div
          key={step.sectionKey}
          className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-2.5"
        >
          <StepStatusIcon status={step.status} />
          <span className="flex-1 text-[13px] font-medium">
            {step.label}
          </span>
          {step.durationMs != null && step.status === "completed" && (
            <span className="text-[11px] text-muted-foreground">
              {(step.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {step.status === "failed" && step.completionNote && (
            <span className="text-[11px] text-destructive truncate max-w-[200px]">
              {step.completionNote}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "pending":
      return <div className="h-4 w-4 rounded-full border-2 border-border" />
    case "in_progress":
      return (
        <div className="relative h-4 w-4">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )
    case "completed":
      return (
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )
    case "failed":
      return (
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive">
          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )
  }
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

type Verdict = "BUY" | "WATCH" | "WALK" | "PENDING"

function deriveVerdict(report: HausReportV2, askingUsd: number): Verdict {
  if (!report.specific_car_fair_value_mid) return "PENDING"
  const delta = computeDelta(askingUsd, report.specific_car_fair_value_mid)
  if (delta <= -5) return "BUY"
  if (delta >= 10) return "WALK"
  return "WATCH"
}

function composeOneLiner(report: HausReportV2, askingUsd: number): string {
  const delta = computeDelta(askingUsd, report.specific_car_fair_value_mid)
  const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`
  return `Priced ${deltaStr} vs specific-car Fair Value · ${report.comparables_count} comparables · ${report.market_intel.d4.confidence_tier} confidence` // [HARDCODED]
}

function computeDelta(askingUsd: number, fairMidUsd: number | null): number {
  if (!askingUsd || !fairMidUsd) return 0
  return ((askingUsd - fairMidUsd) / fairMidUsd) * 100
}

// ─── Source derivation helpers ──────────────────────────────────────

function deriveComparablesSources(
  marketStats: ModelMarketStats | null,
  dbComparables: DbComparableRow[],
) {
  const platforms = new Set<string>()

  for (const r of marketStats?.regions ?? []) {
    for (const s of r.sources ?? []) {
      if (s?.trim()) platforms.add(s.trim())
    }
  }

  for (const c of dbComparables) {
    if (c.platform?.trim()) platforms.add(c.platform.trim())
  }

  const ordered = Array.from(platforms)
  const range = aggregateCaptureRange(marketStats, dbComparables)

  if (ordered.length === 0 && !range) return undefined

  return {
    platforms: ordered,
    captureDateRange: range,
  }
}

function deriveComparablesCaptureDateRange(
  dbComparables: DbComparableRow[],
  marketStats: ModelMarketStats | null,
) {
  return aggregateCaptureRange(marketStats, dbComparables)
}

function aggregateCaptureRange(
  marketStats: ModelMarketStats | null,
  dbComparables: DbComparableRow[],
): { start: string; end: string } | null {
  const dates: string[] = []

  for (const r of marketStats?.regions ?? []) {
    if (r.oldestDate) dates.push(r.oldestDate)
    if (r.newestDate) dates.push(r.newestDate)
  }

  for (const c of dbComparables) {
    if (c.soldDate) dates.push(c.soldDate)
  }

  if (dates.length === 0) return null

  const sorted = [...dates].sort()
  return { start: sorted[0], end: sorted[sorted.length - 1] }
}
