"use client"

import { useState } from "react"
import type { FinalSynthesis, Verdict } from "@/lib/reports/types-v3"
import { DataTrustBadge } from "../DataTrustBadge"
import { Info, Lightbulb, ChevronDown } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

interface ExecutiveSummarySectionProps {
  data: FinalSynthesis | null
}

const VERDICT_STYLE: Record<Verdict, string> = {
  BUY: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700",
  WATCH: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700",
  WALK: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700",
}

function RiskMeter({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100)
  const color =
    pct <= 30
      ? "bg-green-500"
      : pct <= 60
        ? "bg-amber-500"
        : "bg-red-500"

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold text-foreground">{score}/100</span>
    </div>
  )
}

export function ExecutiveSummarySection({ data }: ExecutiveSummarySectionProps) {
  const [thesisExpanded, setThesisExpanded] = useState(false)
  if (!data?.executiveSummary) return null

  const { executiveSummary, finalRecommendation } = data
  const { headline, keyMetrics, investmentThesis } = executiveSummary
  // A thesis under this length doesn't need an expand toggle — the user can
  // read it without scrolling. Threshold chosen so a typical 3-line block
  // stays inline and only longer paragraphs collapse.
  const thesisIsLong = investmentThesis.length > 260

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Executive Summary</h2>
        <DataTrustBadge level="verified_from_data" />
      </div>

      <p className="text-lg font-medium text-foreground">{headline}</p>

      {/* Key metrics grid */}
      <TooltipProvider>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fair Value</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="What is fair value?" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full">
                  <Info className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">
                Estimated price range a similar example should command on the open market today, based on recent sold comparables and adjusted for spec, condition, and region.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1 text-sm font-semibold font-mono text-foreground">{keyMetrics.fairValueRange}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Signals</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="What is signals coverage?" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full">
                  <Info className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">
                Number of investment-relevant attributes we identified vs the total we look for. Higher coverage means we had more facts to verify.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1 text-sm font-semibold font-mono text-foreground">{keyMetrics.signalsCoverage}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk Score</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="What is risk score?" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full">
                  <Info className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">
                Composite risk reading from 0 (low) to 100 (high). Higher scores mean more uncertainty: missing service records, modifications, or signals we couldn&apos;t verify.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="mt-1">
            <RiskMeter score={keyMetrics.riskScore} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Verdict</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="What is verdict?" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full">
                  <Info className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">
                Our acquisition recommendation based on price vs fair value and risk level. BUY = strong opportunity. WATCH = neutral. WALK = pass. PENDING = needs data.
              </TooltipContent>
            </Tooltip>
          </div>
          <span className={`mt-1 inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-bold tracking-wide ${VERDICT_STYLE[keyMetrics.verdict]}`}>
            {keyMetrics.verdict}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Market Position</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="What is market position?" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full">
                  <Info className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">
                Where the asking price sits inside the Fair Value range. 0% means at the bottom of the range; 100% at the top. Negative means below fair value (potential opportunity).
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">{keyMetrics.marketPosition}</p>
        </div>
      </div>
      </TooltipProvider>

      {/* Investment thesis - lavender-accented, collapsible for long copy */}
      <div className="rounded-lg bg-primary/8 dark:bg-primary/[0.07] border border-primary/25 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="size-3.5 text-primary" />
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Market Thesis
          </h3>
        </div>
        <p
          className={`text-[13px] leading-relaxed text-foreground/85 ${
            thesisIsLong && !thesisExpanded ? "line-clamp-3" : ""
          }`}
        >
          {investmentThesis}
        </p>
        {thesisIsLong && (
          <button
            type="button"
            onClick={() => setThesisExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
            aria-expanded={thesisExpanded}
          >
            {thesisExpanded ? "Show less" : "Read full thesis"}
            <ChevronDown
              className={`size-3 transition-transform ${thesisExpanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {/* Final recommendation */}
      {finalRecommendation && (
        <div className="flex items-center gap-4 pt-2 border-t border-border">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</p>
            <p className="text-2xl font-bold font-mono text-foreground">{finalRecommendation.score}<span className="text-sm text-muted-foreground">/100</span></p>
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Condition:</span> {finalRecommendation.conditionEstimate}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{finalRecommendation.verdict}</p>
          </div>
        </div>
      )}
    </section>
  )
}
