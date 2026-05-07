"use client"

import type { AppliedModifier } from "@/lib/fairValue/types"
import { CollapsibleList } from "./primitives/CollapsibleList"
import { SourceBadge } from "./primitives/SourceBadge"

interface ValuationBreakdownBlockProps {
  baselineMedianUsd: number
  aggregateModifierPercent: number
  specificCarFairValueMidUsd: number
  modifiers: AppliedModifier[]
  onSourceClick?: (modifierKey: string, citationUrl: string | null) => void
}

function fmtK(v: number): string {
  return `$${Math.round(Math.abs(v) / 1000)}K`
}

function prettyKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function ValuationBreakdownBlock({
  baselineMedianUsd,
  aggregateModifierPercent,
  specificCarFairValueMidUsd,
  modifiers,
  onSourceClick,
}: ValuationBreakdownBlockProps) {
  const sorted = [...modifiers].sort(
    (a, b) => Math.abs(b.baseline_contribution_usd) - Math.abs(a.baseline_contribution_usd)
  )

  const aggregateClass =
    aggregateModifierPercent > 0
      ? "text-positive"
      : aggregateModifierPercent < 0
        ? "text-destructive"
        : "text-muted-foreground"

  return (
    <section className="px-4 py-6" aria-labelledby="valuation-heading">
      <h2
        id="valuation-heading"
        className="font-serif text-[20px] font-semibold md:text-[24px]"
      >
        {/* [HARDCODED] */}How we arrived at {fmtK(specificCarFairValueMidUsd)}
      </h2>

      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-card/30 p-4 text-[13px] md:flex-row md:items-center md:justify-between">
        <span>
          {/* [HARDCODED] */}Baseline median{" "}
          <strong className="font-mono">{fmtK(baselineMedianUsd)}</strong>
        </span>
        <span className="text-muted-foreground" aria-hidden>
          →
        </span>
        <span>
          {/* [HARDCODED] */}Modifiers{" "}
          <strong className={`font-mono ${aggregateClass}`}>
            {aggregateModifierPercent >= 0 ? "+" : ""}
            {aggregateModifierPercent.toFixed(1)}%
          </strong>
        </span>
        <span className="text-muted-foreground" aria-hidden>
          =
        </span>
        <span>
          {/* [HARDCODED] */}Fair Value{" "}
          <strong className="font-mono">{fmtK(specificCarFairValueMidUsd)}</strong>
        </span>
      </div>

      {sorted.length > 0 && (
        <>
          <h3 className="mt-5 text-[13px] font-semibold text-muted-foreground">
            {/* [HARDCODED] */}Top modifiers applied
          </h3>
          <CollapsibleList
            items={sorted}
            initialCount={3}
            moreLabel={(hidden) =>
              `Show all ${sorted.length} modifiers applied (+${hidden} more) →` // [HARDCODED]
            }
            render={(m) => {
              const sign = m.baseline_contribution_usd >= 0 ? "+" : "−"
              const verb = m.baseline_contribution_usd >= 0 ? "added" : "subtracted" // [HARDCODED]
              return (
                <div
                  key={m.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/30 p-3"
                >
                  <div>
                    <p className="text-[13px] font-medium">{prettyKey(m.key)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {sign}
                      {Math.abs(m.delta_percent)}% · {fmtK(m.baseline_contribution_usd)}{" "}
                      {verb}{/* [HARDCODED] "added"/"subtracted" */}
                    </p>
                  </div>
                  {m.citation_url && (
                    <SourceBadge
                      name="Source" /* [HARDCODED] */
                      onClick={
                        onSourceClick
                          ? () => onSourceClick(m.key, m.citation_url)
                          : undefined
                      }
                    />
                  )}
                </div>
              )
            }}
            className="mt-3"
          />
        </>
      )}
    </section>
  )
}
