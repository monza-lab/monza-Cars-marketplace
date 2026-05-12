import type { DueDiligenceReport } from "@/lib/reports/types-v3"
import { DataTrustBadge } from "../DataTrustBadge"

interface DueDiligenceSectionProps {
  data: DueDiligenceReport | null
}

const CATEGORY_LABEL: Record<string, string> = {
  essential: "Essential",
  vehicle_specific: "Vehicle-Specific",
  history: "History",
  financial: "Financial",
}

const CATEGORY_STYLE: Record<string, string> = {
  essential: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  vehicle_specific: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  history: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  financial: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
}

const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  recommended: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  optional: "bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400",
}

function RiskBreakdownChart({ breakdown }: { breakdown: DueDiligenceReport["riskScore"]["breakdown"] }) {
  return (
    <div className="space-y-2">
      {breakdown.map((item, i) => {
        const pct = Math.min(Math.max(item.score, 0), 100)
        const barColor =
          pct <= 30
            ? "bg-green-500"
            : pct <= 60
              ? "bg-amber-500"
              : "bg-red-500"

        return (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">{item.category}</span>
              <span className="font-mono font-semibold text-foreground">{item.score}</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            {item.note && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.note}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function DueDiligenceSection({ data }: DueDiligenceSectionProps) {
  if (!data) return null

  // Group questions by category
  const questions = data.questions ?? []
  const grouped = questions.reduce<Record<string, typeof questions>>((acc, q) => {
    const key = q.category
    if (!acc[key]) acc[key] = []
    acc[key].push(q)
    return acc
  }, {})

  const overallRisk = data.riskScore?.overall ?? 50
  const riskColor =
    overallRisk <= 30
      ? "text-green-600 dark:text-green-400"
      : overallRisk <= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400"

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Due Diligence</h2>
        <DataTrustBadge level="ai_analysis" />
      </div>

      {/* Risk score */}
      <div className="rounded-lg border border-border bg-background/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Risk Assessment</h3>
          <div className="text-center">
            <span className={`text-2xl font-bold font-mono ${riskColor}`}>{overallRisk}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>
        <RiskBreakdownChart breakdown={data.riskScore?.breakdown ?? []} />
      </div>

      {/* Questions grouped by category */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Questions to Ask the Seller</h3>
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, questions]) => (
            <div key={category}>
              <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase mb-2 ${CATEGORY_STYLE[category] ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
                {CATEGORY_LABEL[category] ?? category}
              </span>
              <ul className="space-y-2 ml-1">
                {questions.map((q, i) => (
                  <li key={i} className="text-sm">
                    <p className="font-medium text-foreground">{q.question}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{q.whyItMatters}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* PPI checklist */}
      {(data.ppiChecklist?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Pre-Purchase Inspection Checklist</h3>
          <div className="space-y-2">
            {data.ppiChecklist.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase mt-0.5 ${PRIORITY_STYLE[item.priority] ?? ""}`}>
                  {item.priority}
                </span>
                <div className="flex-1">
                  <span className="font-medium text-foreground">{item.item}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{item.specificTo}</span>
                    {item.estimatedCost && (
                      <span className="text-xs font-mono text-muted-foreground">~{item.estimatedCost}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
