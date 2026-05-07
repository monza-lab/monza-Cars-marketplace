"use client"

import { ChevronDown } from "lucide-react"
import type { MarketIntelD1, MarketIntelD4 } from "@/lib/fairValue/types"
import { ConfidenceDot } from "./primitives/ConfidenceDot"

interface MarketIntelPanelProps {
  d1: MarketIntelD1
  d4: MarketIntelD4
  onExpandD1?: () => void
  onExpandD4?: () => void
}

function Sparkline({ points }: { points: Array<{ median_usd: number }> }) {
  if (points.length < 2) return null
  const w = 72
  const h = 24
  const max = Math.max(...points.map((p) => p.median_usd))
  const min = Math.min(...points.map((p) => p.median_usd))
  const range = max - min || 1
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p.median_usd - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-primary"
      />
    </svg>
  )
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  return `${s.toLocaleDateString("en-US", opts)}–${e.toLocaleDateString("en-US", opts)}`
}

export function MarketIntelPanel({
  d1,
  d4,
  onExpandD1,
  onExpandD4,
}: MarketIntelPanelProps) {
  const trendLabel =
    d1.trend_12m_direction === "stable"
      ? "Stable" // [HARDCODED]
      : `${d1.trend_12m_direction === "up" ? "↑" : "↓"} ${Math.abs(d1.trend_12m_percent).toFixed(1)}%`

  return (
    <aside
      aria-label="Market Intel Panel" /* [HARDCODED] */
      className="sticky top-[56px] z-20 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md md:static md:rounded-xl md:border md:py-4"
    >
      <div className="grid grid-cols-3 gap-3 md:grid-cols-1 md:gap-4">
        <button
          type="button"
          onClick={onExpandD1}
          disabled={!onExpandD1}
          className="flex items-center gap-2 text-left enabled:hover:opacity-80 md:flex-col md:items-start"
        >
          <Sparkline points={d1.sold_trajectory} />
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">{/* [HARDCODED] */}12m trend</p>
            <p className="text-[12px] font-semibold">{trendLabel}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onExpandD4}
          disabled={!onExpandD4}
          className="flex items-center gap-2 text-left enabled:hover:opacity-80 md:flex-col md:items-start"
        >
          <ConfidenceDot level={d4.confidence_tier} />
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">{/* [HARDCODED] */}Confidence</p>
            <p className="text-[12px] font-semibold capitalize">
              {d4.confidence_tier} · {d4.sample_size}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 md:flex-col md:items-start">
          <div className="size-2" aria-hidden />
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">{/* [HARDCODED] */}Captured</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDateRange(d4.capture_date_start, d4.capture_date_end)}
            </p>
          </div>
        </div>
      </div>
      {(onExpandD1 || onExpandD4) && (
        <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground md:hidden">
          <ChevronDown className="size-3" /> {/* [HARDCODED] */}Tap to expand
        </p>
      )}
    </aside>
  )
}
