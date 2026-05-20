"use client"

import { Link } from "@/i18n/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronUp, ChevronRight } from "lucide-react"
import { useState } from "react"
import { SafeImage } from "@/components/dashboard/cards/SafeImage"
import type { SimilarCarResult } from "@/lib/similarCars"
import type { CollectorCar } from "@/lib/curatedCars"
import { extractSeries } from "@/lib/brandConfig"

type Verdict = "buy" | "watch" | "walk" | "hold" | null

interface ReportSummaryRailProps {
  car: CollectorCar
  verdict: Verdict
  fairValueLow: number | null
  fairValueHigh: number | null
  fairValueMid: number | null
  askingPrice: number
  formatPrice: (n: number) => string
  similarCars: SimilarCarResult[]
  makeSlug: string
}

const VERDICT_STYLE: Record<NonNullable<Verdict>, { label: string; classes: string; dot: string }> = {
  buy: {
    label: "BUY",
    classes: "bg-positive/15 text-positive border-positive/30",
    dot: "bg-positive",
  },
  watch: {
    label: "WATCH",
    classes: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    dot: "bg-amber-500",
  },
  walk: {
    label: "WALK",
    classes: "bg-destructive/15 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
  hold: {
    label: "HOLD",
    classes:
      "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
    dot: "bg-muted-foreground",
  },
}

const PENDING_STYLE = {
  label: "PENDING",
  classes: "bg-muted/15 text-muted-foreground border-muted/30",
  dot: "bg-muted-foreground/50",
}

export function ReportSummaryRail({
  car,
  verdict,
  fairValueLow,
  fairValueHigh,
  fairValueMid,
  askingPrice,
  formatPrice,
  similarCars,
  makeSlug,
}: ReportSummaryRailProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const verdictMeta =
    verdict && VERDICT_STYLE[verdict] ? VERDICT_STYLE[verdict] : PENDING_STYLE
  const hasFair = fairValueLow != null && fairValueHigh != null
  const hasAsking = askingPrice > 0

  // Build the "View all similar" deep link into Classic view (/browse).
  // Series narrows the pool to this car's generation; price ±20% catches
  // the band where peer comparables actually live. Falls back to bare
  // /browse if we can't infer a series, so the CTA still navigates.
  const browseAllHref = (() => {
    const params = new URLSearchParams()
    const series = extractSeries(car.model, car.year, car.make, car.title)
    if (series) params.set("series", series)
    if (hasAsking) {
      const min = Math.floor(askingPrice * 0.8)
      const max = Math.ceil(askingPrice * 1.2)
      params.set("priceMin", String(min))
      params.set("priceMax", String(max))
    }
    const qs = params.toString()
    return qs ? `/browse?${qs}` : "/browse"
  })()

  const midForDelta =
    fairValueMid ?? (hasFair ? (fairValueLow! + fairValueHigh!) / 2 : null)

  const deltaPercent =
    hasAsking && midForDelta && midForDelta > 0
      ? Math.round(((askingPrice - midForDelta) / midForDelta) * 100)
      : null

  // Top peers (cap at 4 on desktop, 3 on mobile scroll)
  const peers = similarCars.slice(0, 4)

  return (
    <>
      {/* ── DESKTOP rail — sticky right column at xl+ ───────────────── */}
      <aside
        aria-label="Report summary"
        className="hidden xl:flex fixed right-0 top-0 bottom-0 w-[260px] flex-col bg-background border-l border-border z-30 pt-[var(--app-header-h,80px)]"
      >
        {/* Verdict + Fair/Asking — slim header */}
        <div className="px-4 py-4 border-b border-border space-y-3">
          {/* Verdict pill — slim inline */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Verdict
            </span>
            <div
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 ${verdictMeta.classes}`}
            >
              <span className={`size-1.5 rounded-full ${verdictMeta.dot}`} />
              <span className="text-[10px] font-bold tracking-wider">
                {verdictMeta.label}
              </span>
            </div>
          </div>

          {/* Fair value */}
          <div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Fair Value
            </span>
            {hasFair ? (
              <p className="text-[13px] font-bold tabular-nums text-foreground leading-tight mt-1">
                {formatPrice(fairValueLow!)} – {formatPrice(fairValueHigh!)}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">
                Awaiting analysis
              </p>
            )}
          </div>

          {/* Asking + delta */}
          {hasAsking && (
            <div>
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Asking
              </span>
              <div className="flex items-baseline gap-2 flex-wrap mt-1">
                <p className="text-[18px] font-bold tabular-nums text-foreground leading-none">
                  {formatPrice(askingPrice)}
                </p>
                {deltaPercent !== null && (
                  <span
                    className={`text-[10px] font-semibold ${
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
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {deltaPercent > 5
                    ? "above fair value"
                    : deltaPercent < -5
                      ? "below fair value"
                      : "at fair value"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Peer comps — the substance of the rail */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Similar at this price
            </span>
          </div>

          {peers.length === 0 ? (
            <div className="mx-4 mb-3 rounded-xl border border-dashed border-border bg-card/40 p-4 text-center">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Peer comparables surface during the full analysis.
              </p>
            </div>
          ) : (
            <div className="px-2 pb-3 space-y-1">
              {peers.map((peer) => {
                const peerCar = peer.car
                const peerAsking =
                  peerCar.currentBid > 0
                    ? peerCar.currentBid
                    : (peerCar.price ?? 0)
                const peerDelta =
                  peerAsking > 0 && askingPrice > 0
                    ? Math.round(((peerAsking - askingPrice) / askingPrice) * 100)
                    : null
                return (
                  <Link
                    key={peerCar.id}
                    href={`/cars/${makeSlug}/${peerCar.id}/report`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-foreground/[0.03] transition-colors"
                  >
                    <div className="shrink-0 size-12 rounded-md overflow-hidden bg-card border border-border">
                      <SafeImage
                        src={peerCar.image || "/cars/placeholder.svg"}
                        alt={peerCar.title}
                        width={48}
                        height={48}
                        className="size-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        fallback={
                          <div className="size-full flex items-center justify-center text-[8px] text-muted-foreground">
                            {peerCar.year}
                          </div>
                        }
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                        {peerCar.year} {peerCar.model}
                      </p>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-[11px] tabular-nums font-semibold text-foreground">
                          {formatPrice(peerAsking)}
                        </span>
                        {peerDelta !== null && (
                          <span
                            className={`text-[9px] font-semibold ${
                              peerDelta > 5
                                ? "text-destructive"
                                : peerDelta < -5
                                  ? "text-positive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {peerDelta > 0 ? "+" : ""}
                            {peerDelta}%
                          </span>
                        )}
                      </div>
                      {peerCar.mileage > 0 && (
                        <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                          {peerCar.mileage.toLocaleString()} {peerCar.mileageUnit}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="shrink-0 size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </Link>
                )
              })}
              {similarCars.length > peers.length && (
                <Link
                  href={browseAllHref}
                  className="mt-2 mx-2 flex items-center justify-center gap-1 rounded-lg border border-border bg-card hover:border-primary/30 px-3 py-2 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  View all in same range
                  <ChevronRight className="size-3" />
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── MOBILE rail — sticky bottom bar ─────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border">
        <div className="px-3 py-2.5 flex items-center gap-2.5">
          <div
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${verdictMeta.classes}`}
          >
            <span className={`size-1.5 rounded-full ${verdictMeta.dot}`} />
            <span className="text-[10px] font-bold tracking-wider">
              {verdictMeta.label}
            </span>
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
          <button
            onClick={() => setMobileExpanded((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-medium text-foreground"
            aria-label={mobileExpanded ? "Hide peers" : "Show peers"}
          >
            <span>{peers.length} peers</span>
            <motion.span
              animate={{ rotate: mobileExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: "inline-block" }}
            >
              <ChevronUp className="size-3.5" />
            </motion.span>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {mobileExpanded && peers.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="px-3 py-2 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {peers.map((peer) => {
                    const peerCar = peer.car
                    const peerAsking =
                      peerCar.currentBid > 0
                        ? peerCar.currentBid
                        : (peerCar.price ?? 0)
                    return (
                      <Link
                        key={peerCar.id}
                        href={`/cars/${makeSlug}/${peerCar.id}/report`}
                        className="shrink-0 w-[140px] rounded-lg border border-border bg-card overflow-hidden"
                        onClick={() => setMobileExpanded(false)}
                      >
                        <div className="relative aspect-[16/9] bg-card">
                          <SafeImage
                            src={peerCar.image || "/cars/placeholder.svg"}
                            alt={peerCar.title}
                            fill
                            className="object-cover"
                            sizes="140px"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            fallback={
                              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                                {peerCar.year}
                              </div>
                            }
                          />
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="text-[10px] font-medium text-foreground leading-tight truncate">
                            {peerCar.year} {peerCar.model}
                          </p>
                          <p className="text-[10px] tabular-nums font-semibold text-foreground mt-0.5">
                            {formatPrice(peerAsking)}
                          </p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
