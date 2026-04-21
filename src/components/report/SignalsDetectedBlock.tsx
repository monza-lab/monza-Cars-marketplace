"use client"

import { AlertTriangle, CheckCircle2 } from "lucide-react"
import type { DetectedSignal } from "@/lib/fairValue/types"
import { CollapsibleList } from "./primitives/CollapsibleList"

// Signal keys that represent a negative/risk signal (modifier with negative delta).
// Derived from MODIFIER_LIBRARY where base_percent < 0.
const RISK_SIGNAL_KEYS = new Set([
  "accident_history",
  "modifications",
  "repaint_disclosed",
])

interface SignalsDetectedBlockProps {
  signals: DetectedSignal[]
  onEvidenceClick?: (signal: DetectedSignal) => void
}

function prettyKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function SignalsDetectedBlock({ signals, onEvidenceClick }: SignalsDetectedBlockProps) {
  const riskSignals = signals.filter((s) => RISK_SIGNAL_KEYS.has(s.key))
  const positiveSignals = signals.filter((s) => !RISK_SIGNAL_KEYS.has(s.key))

  return (
    <section className="px-4 py-6" aria-labelledby="signals-heading">
      <h2
        id="signals-heading"
        className="font-serif text-[20px] font-semibold md:text-[24px]"
      >
        What we found in this listing
      </h2>

      {riskSignals.length > 0 && (
        <div className="mt-4 space-y-2">
          {riskSignals.map((signal) => (
            <button
              type="button"
              key={signal.key}
              onClick={onEvidenceClick ? () => onEvidenceClick(signal) : undefined}
              disabled={!onEvidenceClick}
              className="flex w-full items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left enabled:hover:bg-destructive/10"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-destructive">
                  {prettyKey(signal.key)}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{signal.value_display}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {positiveSignals.length > 0 && (
        <CollapsibleList
          items={positiveSignals}
          initialCount={5}
          moreLabel={(hidden) =>
            `Show all ${positiveSignals.length} signals (+${hidden} more) →`
          }
          render={(signal) => (
            <button
              type="button"
              key={signal.key}
              onClick={onEvidenceClick ? () => onEvidenceClick(signal) : undefined}
              disabled={!onEvidenceClick}
              className="flex w-full items-start gap-2 rounded-lg border border-border bg-card/30 p-3 text-left enabled:hover:bg-card/50"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" />
              <div className="flex-1">
                <p className="text-[13px] font-semibold">{prettyKey(signal.key)}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{signal.value_display}</p>
              </div>
            </button>
          )}
          className="mt-3"
        />
      )}

      {signals.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-card/30 p-4 text-[13px] text-muted-foreground">
          No objective signals were extracted from this listing yet.
        </p>
      )}
    </section>
  )
}
