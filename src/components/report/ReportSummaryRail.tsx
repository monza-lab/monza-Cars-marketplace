"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Download, MessageCircle, ChevronUp } from "lucide-react"
import { useState } from "react"

type Verdict = "buy" | "watch" | "walk" | "hold" | null

interface ReportSummaryRailProps {
  verdict: Verdict
  fairValueLow: number | null
  fairValueHigh: number | null
  fairValueMid: number | null
  askingPrice: number
  formatPrice: (n: number) => string
  riskScore: number | null
  signalsDetected: number
  signalsTotal: number
  hasAccess: boolean
  onDownload: () => void
  onAdvisor: () => void
  isGeneratingExports?: boolean
}

const VERDICT_STYLE: Record<NonNullable<Verdict>, { label: string; classes: string }> = {
  buy: {
    label: "BUY",
    classes: "bg-positive/15 text-positive border-positive/30",
  },
  watch: {
    label: "WATCH",
    classes: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  },
  walk: {
    label: "WALK",
    classes: "bg-destructive/15 text-destructive border-destructive/30",
  },
  hold: {
    label: "HOLD",
    classes:
      "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
  },
}

const PENDING_STYLE = {
  label: "PENDING",
  classes:
    "bg-muted/15 text-muted-foreground border-muted/30",
}

export function ReportSummaryRail({
  verdict,
  fairValueLow,
  fairValueHigh,
  fairValueMid,
  askingPrice,
  formatPrice,
  riskScore,
  signalsDetected,
  signalsTotal,
  hasAccess,
  onDownload,
  onAdvisor,
  isGeneratingExports,
}: ReportSummaryRailProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const verdictMeta =
    verdict && VERDICT_STYLE[verdict] ? VERDICT_STYLE[verdict] : PENDING_STYLE
  const hasFair = fairValueLow != null && fairValueHigh != null
  const hasAsking = askingPrice > 0

  const midForDelta =
    fairValueMid ?? (hasFair ? ((fairValueLow! + fairValueHigh!) / 2) : null)

  const deltaPercent =
    hasAsking && midForDelta && midForDelta > 0
      ? Math.round(((askingPrice - midForDelta) / midForDelta) * 100)
      : null

  // Position of asking inside the fair-value band on a 0–100 scale.
  // Anchors: 25% = fair low, 75% = fair high, 50% = mid.
  // Beyond the band, clamp to 0–100 so the marker still shows direction.
  const deltaBarPosition = (() => {
    if (!hasAsking || !hasFair) return 50
    const low = fairValueLow!
    const high = fairValueHigh!
    const span = high - low
    if (span <= 0) return 50
    const ratio = (askingPrice - low) / span // 0 = at low, 1 = at high
    const positioned = 25 + ratio * 50 // map 0..1 → 25..75
    return Math.max(2, Math.min(98, positioned))
  })()

  return (
    <>
      {/* ── DESKTOP rail — sticky right column at xl+ ───────────────── */}
      <aside
        aria-label="Report summary"
        className="hidden xl:flex fixed right-0 top-0 bottom-0 w-[240px] flex-col bg-background border-l border-border z-30 pt-[var(--app-header-h,80px)]"
      >
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {/* TIER 1 — Verdict */}
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Verdict
            </p>
            <div
              className={`flex items-center justify-center rounded-xl border px-4 py-3 ${verdictMeta.classes}`}
            >
              <span className="text-[18px] font-bold tracking-wider">
                {verdictMeta.label}
              </span>
            </div>
            {!hasAccess && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Awaiting full analysis
              </p>
            )}
          </div>

          {/* TIER 1 — Fair value + Asking + Delta */}
          <div className="border-t border-border pt-5">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Fair Value
            </p>
            {hasFair ? (
              <p className="text-[15px] font-bold tabular-nums text-foreground leading-tight">
                {formatPrice(fairValueLow!)} – {formatPrice(fairValueHigh!)}
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                Awaiting analysis
              </p>
            )}

            {hasAsking && (
              <>
                <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-4 mb-1">
                  Asking
                </p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-[18px] font-bold tabular-nums text-foreground">
                    {formatPrice(askingPrice)}
                  </p>
                  {deltaPercent !== null && (
                    <span
                      className={`text-[11px] font-semibold ${
                        deltaPercent > 5
                          ? "text-destructive"
                          : deltaPercent < -5
                            ? "text-positive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {deltaPercent > 0 ? "+" : ""}
                      {deltaPercent}%
                    </span>
                  )}
                </div>
                {deltaPercent !== null && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {deltaPercent > 5
                      ? "above fair value"
                      : deltaPercent < -5
                        ? "below fair value"
                        : "at fair value"}
                  </p>
                )}

                {/* Delta bar — fair value band + asking marker */}
                {hasFair && (
                  <div className="mt-4">
                    <div className="relative h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
                      {/* Fair value range band */}
                      <div className="absolute inset-y-0 left-[25%] right-[25%] bg-positive/35 rounded-full" />
                      {/* Asking marker */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 size-3 rounded-full bg-foreground border-2 border-background shadow-sm"
                        style={{ left: `calc(${deltaBarPosition}% - 6px)` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] tabular-nums text-muted-foreground mt-1.5 uppercase tracking-wider">
                      <span>low</span>
                      <span>fair</span>
                      <span>high</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* TIER 2 — Confidence */}
          {(riskScore !== null || signalsTotal > 0) && (
            <div className="border-t border-border pt-5 space-y-4">
              {riskScore !== null && (
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Risk
                    </span>
                    <span className="text-[12px] tabular-nums font-bold text-foreground">
                      {riskScore}
                      <span className="text-muted-foreground font-normal">
                        /100
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        riskScore <= 30
                          ? "bg-positive"
                          : riskScore <= 60
                            ? "bg-amber-500"
                            : "bg-destructive"
                      }`}
                      style={{ width: `${riskScore}%` }}
                    />
                  </div>
                </div>
              )}
              {signalsTotal > 0 && (
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Signals
                    </span>
                    <span className="text-[12px] tabular-nums font-bold text-foreground">
                      {signalsDetected}
                      <span className="text-muted-foreground font-normal">
                        /{signalsTotal}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${(signalsDetected / signalsTotal) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TIER 3 — Actions */}
        {hasAccess && (
          <div className="border-t border-border p-3 space-y-2">
            <button
              onClick={onDownload}
              disabled={isGeneratingExports}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-background hover:bg-primary/85 active:scale-[0.97] transition-all px-3 py-2.5 text-[12px] font-semibold disabled:opacity-50"
            >
              {isGeneratingExports ? (
                <>
                  <div className="size-3.5 rounded-full border-2 border-background/30 border-t-background animate-spin" />
                  Preparing
                </>
              ) : (
                <>
                  <Download className="size-3.5" />
                  Download Report
                </>
              )}
            </button>
            <button
              onClick={onAdvisor}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-colors px-3 py-2 text-[11px] font-medium text-foreground"
            >
              <MessageCircle className="size-3.5 text-primary" />
              Ask Advisor
            </button>
          </div>
        )}
      </aside>

      {/* ── MOBILE rail — sticky bottom bar ─────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border">
        <div className="px-3 py-2.5 flex items-center gap-2.5">
          <div
            className={`shrink-0 px-2.5 py-1 rounded-md border text-[10px] font-bold tracking-wider ${verdictMeta.classes}`}
          >
            {verdictMeta.label}
          </div>
          {hasFair && (
            <div className="flex-1 min-w-0">
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">
                Fair · Asking
              </p>
              <p className="text-[10px] tabular-nums text-foreground leading-tight truncate mt-0.5">
                {formatPrice(fairValueLow!)}–{formatPrice(fairValueHigh!)}
                <span className="text-muted-foreground"> · </span>
                <span className="font-semibold">
                  {formatPrice(askingPrice)}
                </span>
                {deltaPercent !== null && (
                  <span
                    className={`ml-1 font-semibold ${
                      deltaPercent > 5
                        ? "text-destructive"
                        : deltaPercent < -5
                          ? "text-positive"
                          : "text-muted-foreground"
                    }`}
                  >
                    ({deltaPercent > 0 ? "+" : ""}
                    {deltaPercent}%)
                  </span>
                )}
              </p>
            </div>
          )}
          {hasAccess && (
            <button
              onClick={onDownload}
              disabled={isGeneratingExports}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary text-background px-2.5 py-2 text-[11px] font-semibold disabled:opacity-50"
              aria-label="Download report"
            >
              <Download className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => setMobileExpanded((v) => !v)}
            className="shrink-0 p-2 text-muted-foreground"
            aria-label={mobileExpanded ? "Collapse summary" : "Expand summary"}
          >
            <motion.span
              animate={{ rotate: mobileExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: "inline-block" }}
            >
              <ChevronUp className="size-4" />
            </motion.span>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {mobileExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-border">
                {riskScore !== null && (
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground w-14">
                      Risk
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                      <div
                        className={`h-full ${
                          riskScore <= 30
                            ? "bg-positive"
                            : riskScore <= 60
                              ? "bg-amber-500"
                              : "bg-destructive"
                        }`}
                        style={{ width: `${riskScore}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums font-bold text-foreground w-12 text-right">
                      {riskScore}/100
                    </span>
                  </div>
                )}
                {signalsTotal > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground w-14">
                      Signals
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${(signalsDetected / signalsTotal) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums font-bold text-foreground w-12 text-right">
                      {signalsDetected}/{signalsTotal}
                    </span>
                  </div>
                )}
                <button
                  onClick={onAdvisor}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-foreground mt-1.5"
                >
                  <MessageCircle className="size-3.5 text-primary" />
                  Ask Advisor
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
