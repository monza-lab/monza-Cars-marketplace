"use client"

import { ArrowRight, Info } from "lucide-react"
import { SourceBadge } from "./primitives/SourceBadge"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

export interface ComparablesSourceInfo {
  platforms: string[]
  captureDateRange?: { start: string; end: string } | null
  onSourceClick?: () => void
}

interface SpecificCarFairValueBlockProps {
  fairValueLowUsd: number | null
  fairValueMidUsd: number | null
  fairValueHighUsd: number | null
  askingUsd: number
  comparablesCount: number
  comparableLayer: "strict" | "series" | "family" | null
  comparablesSources?: ComparablesSourceInfo
  onExplainClick?: () => void
}

function formatShortDate(iso: string): string {
  // Expect "YYYY-MM-DD"; gracefully handle partials.
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatPlatformsLabel(platforms: string[]): string {
  if (platforms.length === 0) return "Market comparables" // [HARDCODED]
  if (platforms.length <= 3) return platforms.join(" · ")
  return `${platforms.slice(0, 3).join(" · ")} +${platforms.length - 3}`
}

function fmtK(v: number | null): string {
  if (v == null) return "—"
  return `$${Math.round(v / 1000)}K`
}

export function SpecificCarFairValueBlock({
  fairValueLowUsd,
  fairValueMidUsd,
  fairValueHighUsd,
  askingUsd,
  comparablesCount,
  comparableLayer,
  comparablesSources,
  onExplainClick,
}: SpecificCarFairValueBlockProps) {
  if (!fairValueMidUsd) {
    return (
      <div className="rounded-lg border border-dashed border-muted p-6 text-center text-muted-foreground">
        <p className="text-sm">Generate report to see specific-car fair value</p>
      </div>
    )
  }

  const range = (fairValueHighUsd ?? 0) - (fairValueLowUsd ?? 0)
  const clampedMarker =
    range <= 0
      ? 50
      : Math.max(0, Math.min(100, ((askingUsd - (fairValueLowUsd ?? 0)) / range) * 100))

  return (
    <section className="px-4 py-6" aria-labelledby="fair-value-heading">
      <TooltipProvider>
      <div className="flex items-center gap-1.5">
        <h2
          id="fair-value-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {/* [HARDCODED] */}Specific-Car Fair Value
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label="What is specific-car fair value?" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full">
              <Info className="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">
            Estimated price range a similar example should command on the open market today, based on recent sold comparables and adjusted for spec, condition, and region.
          </TooltipContent>
        </Tooltip>
      </div>
      </TooltipProvider>
      <p className="mt-2 font-mono text-[28px] font-bold leading-none tracking-tight md:text-[36px]">
        {fmtK(fairValueLowUsd)} – {fmtK(fairValueHighUsd)}
      </p>
      <p className="mt-2 text-[12px] text-muted-foreground">
        {/* [HARDCODED] */}Mid {fmtK(fairValueMidUsd)} · Layer: {comparableLayer ?? "unknown"} · {comparablesCount} comparables
      </p>

      {comparablesSources && (comparablesSources.platforms.length > 0 || comparablesSources.captureDateRange) && (
        <div className="mt-2">
          <SourceBadge
            name={formatPlatformsLabel(comparablesSources.platforms)}
            count={comparablesCount}
            captureDate={
              comparablesSources.captureDateRange
                ? `captured ${formatShortDate(comparablesSources.captureDateRange.start)} – ${formatShortDate(comparablesSources.captureDateRange.end)}` // [HARDCODED] "captured"
                : undefined
            }
            onClick={comparablesSources.onSourceClick}
          />
        </div>
      )}

      <div className="mt-4 space-y-2">
        <div className="relative h-2 rounded-full bg-foreground/10">
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary"
            style={{ left: `${clampedMarker}%` }}
            aria-label={`Asking price position: ${clampedMarker.toFixed(0)}% within range`} /* [HARDCODED] */
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{fmtK(fairValueLowUsd)}</span>
          <span className="font-medium text-foreground">{/* [HARDCODED] */}Asking {fmtK(askingUsd)}</span>
          <span>{fmtK(fairValueHighUsd)}</span>
        </div>
      </div>

      {onExplainClick && (
        <button
          type="button"
          onClick={onExplainClick}
          className="mt-4 inline-flex items-center gap-1 text-[12px] text-primary hover:underline"
        >
          {/* [HARDCODED] */}See how this was computed <ArrowRight className="size-3" />
        </button>
      )}
    </section>
  )
}
