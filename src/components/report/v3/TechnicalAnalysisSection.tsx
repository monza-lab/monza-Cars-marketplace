import type { TechnicalAnalysis } from "@/lib/reports/types-v3"
import { DataTrustBadge } from "../DataTrustBadge"
import { Info } from "lucide-react"

interface TechnicalAnalysisSectionProps {
  data: TechnicalAnalysis | null
}

const STRENGTHS_AND_ISSUES_TITLE =
  "Key Strengths of This specific car and common issues of this model generation"

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  moderate: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  minor: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
}

const RARITY_LABEL: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  very_rare: "Very Rare",
  unique: "Unique",
}

const RARITY_STYLE: Record<string, string> = {
  common: "text-gray-600 dark:text-gray-400",
  uncommon: "text-blue-600 dark:text-blue-400",
  rare: "text-purple-600 dark:text-purple-400",
  very_rare: "text-amber-600 dark:text-amber-400",
  unique: "text-red-600 dark:text-red-400",
}

const RELIABILITY_LABEL: Record<string, string> = {
  excellent: "Excellent",
  above_average: "Above Average",
  average: "Average",
  below_average: "Below Average",
  poor: "Poor",
}

const INVESTMENT_GRADE_LABEL: Record<string, string> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
  speculative: "Speculative",
}

const DEMAND_LABEL: Record<string, string> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
}

export function TechnicalAnalysisSection({ data }: TechnicalAnalysisSectionProps) {
  if (!data) return null

  const hasStrengths = (data.keyStrengths?.length ?? 0) > 0
  const hasCommonIssues = (data.commonIssues?.length ?? 0) > 0
  const reliabilityMethodology =
    "Why this reliability rating: the rating weighs model-generation reliability, known failure patterns, expected maintenance cost level, severity of common issues, and whether the common problems listed here materially affect this specific car."

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Technical Analysis</h2>
        <DataTrustBadge level="ai_analysis" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Model History</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{data.modelHistory}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">What Makes This Spec Special</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{data.whatMakesThisSpecSpecial}</p>
      </div>

      {data.productionData && (
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Production Data</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {data.productionData.totalProduction && (
              <div>
                <span className="text-muted-foreground">Total Production:</span>{" "}
                <span className="font-medium text-foreground">{data.productionData.totalProduction}</span>
              </div>
            )}
            {data.productionData.thisConfigEstimate && (
              <div>
                <span className="text-muted-foreground">This Config:</span>{" "}
                <span className="font-medium text-foreground">{data.productionData.thisConfigEstimate}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Rarity:</span>{" "}
              <span className={`font-semibold ${RARITY_STYLE[data.productionData.rarityAssessment] ?? ""}`}>
                {RARITY_LABEL[data.productionData.rarityAssessment] ?? data.productionData.rarityAssessment}
              </span>
            </div>
          </div>
          {data.productionData.rarityNote && (
            <p className="mt-2 text-xs text-muted-foreground italic">{data.productionData.rarityNote}</p>
          )}
        </div>
      )}

      {(hasStrengths || hasCommonIssues) && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">{STRENGTHS_AND_ISSUES_TITLE}</h3>
          {hasStrengths && (
            <ul className="space-y-2">
              {data.keyStrengths.map((strength, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500 mt-0.5 shrink-0">&#10003;</span>
                  <div>
                    <span className="font-medium text-foreground">{strength.point}</span>
                    {strength.detail && <span className="text-muted-foreground"> - {strength.detail}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {hasCommonIssues && (
            <div className="mt-3 space-y-2">
              {data.commonIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_STYLE[issue.severity] ?? ""}`}>
                    {issue.severity}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{issue.issue}</span>
                    {issue.typicalCost && (
                      <span className="text-muted-foreground"> - typical cost: {issue.typicalCost}</span>
                    )}
                    <p className="text-xs text-muted-foreground">{issue.appliesTo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data.reliability && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-background/50 p-3">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reliability</p>
              <button
                type="button"
                aria-label="Why this reliability rating"
                title={reliabilityMethodology}
                className="text-muted-foreground/70 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full"
              >
                <Info className="size-3" aria-hidden="true" />
                <span className="sr-only">{reliabilityMethodology}</span>
              </button>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {RELIABILITY_LABEL[data.reliability.rating] ?? data.reliability.rating}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Maintenance: {data.reliability.maintenanceCostLevel}
            </p>
          </div>
          {(data.reliability?.commonProblems?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Known Problems</p>
              <ul className="mt-1 space-y-0.5">
                {data.reliability.commonProblems.map((problem, i) => (
                  <li key={i} className="text-xs text-muted-foreground">- {problem}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {data.collectorOutlook && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Collector Outlook</h3>
          <div className="flex gap-4 text-sm mb-2">
            <div>
              <span className="text-muted-foreground">Investment Grade:</span>{" "}
              <span className="font-semibold text-foreground">
                {INVESTMENT_GRADE_LABEL[data.collectorOutlook.investmentGrade] ?? data.collectorOutlook.investmentGrade}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Demand:</span>{" "}
              <span className="font-semibold text-foreground">
                {DEMAND_LABEL[data.collectorOutlook.demandLevel] ?? data.collectorOutlook.demandLevel}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{data.collectorOutlook.futureOutlook}</p>
        </div>
      )}
    </section>
  )
}
