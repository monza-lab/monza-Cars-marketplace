import type { FinalSynthesis, Verdict } from "@/lib/reports/types-v3"
import { DataTrustBadge } from "../DataTrustBadge"

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
  if (!data?.executiveSummary) return null

  const { executiveSummary, finalRecommendation } = data
  const { headline, keyMetrics, investmentThesis } = executiveSummary

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Executive Summary</h2>
        <DataTrustBadge level="verified_from_data" />
      </div>

      <p className="text-lg font-medium text-foreground">{headline}</p>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fair Value</p>
          <p className="mt-1 text-sm font-semibold font-mono text-foreground">{keyMetrics.fairValueRange}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Signals</p>
          <p className="mt-1 text-sm font-semibold font-mono text-foreground">{keyMetrics.signalsCoverage}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk Score</p>
          <div className="mt-1">
            <RiskMeter score={keyMetrics.riskScore} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Verdict</p>
          <span className={`mt-1 inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-bold tracking-wide ${VERDICT_STYLE[keyMetrics.verdict]}`}>
            {keyMetrics.verdict}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Market Position</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{keyMetrics.marketPosition}</p>
        </div>
      </div>

      {/* Investment thesis */}
      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Investment Thesis</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{investmentThesis}</p>
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
