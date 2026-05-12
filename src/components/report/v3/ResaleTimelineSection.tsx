import type { ResaleProjection } from "@/lib/reports/types-v3"
import { DataTrustBadge } from "../DataTrustBadge"

interface ResaleTimelineSectionProps {
  data: {
    year1: ResaleProjection
    year3: ResaleProjection
    year5: ResaleProjection
    year10: ResaleProjection
  } | null
}

function fmtUsd(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v)
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "text-green-600 dark:text-green-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-red-600 dark:text-red-400",
}

function TimelineCard({ label, projection }: { label: string; projection: ResaleProjection }) {
  const isPositive = projection.percentChange >= 0
  const changeColor = isPositive
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400"

  return (
    <div className="rounded-lg border border-border bg-background/50 p-4 flex flex-col">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">{label}</p>

      <div className="flex-1">
        <p className="text-sm font-mono text-foreground">
          {fmtUsd(projection.estimatedRange.low)} — {fmtUsd(projection.estimatedRange.high)}
        </p>
        <p className={`text-lg font-bold font-mono mt-1 ${changeColor}`}>
          {isPositive ? "+" : ""}{projection.percentChange.toFixed(1)}%
        </p>
      </div>

      <div className="mt-3 pt-2 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground mb-1">
          Confidence:{" "}
          <span className={`font-medium capitalize ${CONFIDENCE_STYLE[projection.confidence] ?? ""}`}>
            {projection.confidence}
          </span>
        </p>
        {projection.keyFactors.length > 0 && (
          <ul className="space-y-0.5">
            {projection.keyFactors.map((factor, i) => (
              <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                <span className="shrink-0 mt-0.5">&#8226;</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function ResaleTimelineSection({ data }: ResaleTimelineSectionProps) {
  if (!data) return null

  const entries: { label: string; projection: ResaleProjection }[] = [
    { label: "1 Year", projection: data.year1 },
    { label: "3 Years", projection: data.year3 },
    { label: "5 Years", projection: data.year5 },
    { label: "10 Years", projection: data.year10 },
  ]

  // Visual timeline bar
  const minPct = Math.min(...entries.map((e) => e.projection.percentChange))
  const maxPct = Math.max(...entries.map((e) => e.projection.percentChange))
  const range = Math.max(Math.abs(minPct), Math.abs(maxPct), 1)

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Resale Timeline</h2>
        <DataTrustBadge level="ai_estimated" />
      </div>

      {/* Visual timeline */}
      <div className="space-y-2">
        {entries.map((entry) => {
          const pct = entry.projection.percentChange
          const isPositive = pct >= 0
          const barWidth = Math.max(Math.abs(pct) / range * 50, 2)
          const barColor = isPositive ? "bg-green-500" : "bg-red-500"

          return (
            <div key={entry.label} className="flex items-center gap-3 text-sm">
              <span className="w-16 text-xs font-medium text-muted-foreground shrink-0">{entry.label}</span>
              <div className="flex-1 flex items-center h-5">
                <div className="w-full relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  {isPositive ? (
                    <div
                      className={`absolute left-1/2 h-full rounded-r-full ${barColor}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  ) : (
                    <div
                      className={`absolute right-1/2 h-full rounded-l-full ${barColor}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  )}
                  <div className="absolute left-1/2 top-0 w-px h-full bg-gray-400 dark:bg-gray-500" />
                </div>
              </div>
              <span className={`w-16 text-right font-mono text-xs font-semibold ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {isPositive ? "+" : ""}{pct.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {entries.map((entry) => (
          <TimelineCard key={entry.label} label={entry.label} projection={entry.projection} />
        ))}
      </div>
    </section>
  )
}
