import type { CostProjection } from "@/lib/reports/types-v3"
import { DataTrustBadge } from "../DataTrustBadge"

interface OwnershipCostSectionProps {
  data: {
    year1: CostProjection
    year3: CostProjection
    year5: CostProjection
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

function CostRow({ label, projection }: { label: string; projection: CostProjection }) {
  const { breakdown } = projection
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2.5 font-medium text-foreground">{label}</td>
      <td className="py-2.5 text-right font-mono text-muted-foreground">{fmtUsd(breakdown.valueChange)}</td>
      <td className="py-2.5 text-right font-mono text-muted-foreground">{fmtUsd(breakdown.insurance)}</td>
      <td className="py-2.5 text-right font-mono text-muted-foreground">{fmtUsd(breakdown.maintenance)}</td>
      <td className="py-2.5 text-right font-mono text-muted-foreground">
        {breakdown.majorWork != null ? fmtUsd(breakdown.majorWork) : "—"}
      </td>
      <td className="py-2.5 text-right font-mono font-semibold text-foreground">{fmtUsd(projection.totalCost)}</td>
      <td className="py-2.5 text-right">
        <span className={`text-xs font-medium capitalize ${CONFIDENCE_STYLE[projection.confidence] ?? ""}`}>
          {projection.confidence}
        </span>
      </td>
    </tr>
  )
}

export function OwnershipCostSection({ data }: OwnershipCostSectionProps) {
  if (!data) return null

  const rows: { label: string; projection: CostProjection }[] = [
    { label: "Year 1", projection: data.year1 },
    { label: "Year 3", projection: data.year3 },
    { label: "Year 5", projection: data.year5 },
  ]

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Ownership Costs</h2>
        <DataTrustBadge level="ai_estimated" />
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
              <th className="text-left pb-2 font-medium">Period</th>
              <th className="text-right pb-2 font-medium">Value Change</th>
              <th className="text-right pb-2 font-medium">Insurance</th>
              <th className="text-right pb-2 font-medium">Maintenance</th>
              <th className="text-right pb-2 font-medium">Major Work</th>
              <th className="text-right pb-2 font-medium">Total</th>
              <th className="text-right pb-2 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <CostRow key={row.label} label={row.label} projection={row.projection} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="space-y-1.5 border-t border-border pt-3">
        {rows.map((row) =>
          row.projection.notes ? (
            <p key={row.label} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{row.label}:</span> {row.projection.notes}
            </p>
          ) : null
        )}
      </div>
    </section>
  )
}
