"use client"

import { ExternalLink } from "lucide-react"

/**
 * "View on [Platform]" call-to-action.
 *
 * Lives in the funnel where a user is studying a specific car: report
 * pages, detail pages, and feed cards. The goal is to remind the reader
 * *where the car is for sale right now*, so they can flip back to the
 * source platform once we've earned their trust with the report.
 *
 * Variants:
 *  - `pill`   : compact inline pill (cards / inline contexts)
 *  - `inline` : medium card with label + icon (sidebars, hero rails)
 *  - `sticky` : prominent button strip (report headers, mobile pinned bar)
 */

const PLATFORM_LABELS: Record<string, string> = {
  BRING_A_TRAILER: "Bring a Trailer",
  CARS_AND_BIDS: "Cars & Bids",
  COLLECTING_CARS: "Collecting Cars",
  AUTO_SCOUT_24: "AutoScout24",
  ELFERSPOT: "Elferspot",
  CLASSIC_COM: "Classic.com",
  BEFORWARD: "BeForward",
  AUTO_TRADER: "AutoTrader",
}

function humanPlatform(raw: string | null | undefined): string {
  if (!raw) return "the original listing"
  return PLATFORM_LABELS[raw] ?? raw.replace(/_/g, " ")
}

interface SourceListingCtaProps {
  sourceUrl: string | null | undefined
  platform: string | null | undefined
  variant?: "pill" | "inline" | "sticky"
  className?: string
}

export function SourceListingCta({
  sourceUrl,
  platform,
  variant = "inline",
  className = "",
}: SourceListingCtaProps) {
  if (!sourceUrl) return null
  const platformName = humanPlatform(platform)
  const label = `View on ${platformName}`

  if (variant === "pill") {
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-medium text-foreground/80 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors ${className}`}
      >
        {label}
        <ExternalLink className="size-3" />
      </a>
    )
  }

  if (variant === "sticky") {
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary/35 bg-primary/8 px-5 py-3 text-[12px] font-semibold uppercase tracking-wider text-primary hover:bg-primary/15 hover:border-primary/55 transition-colors ${className}`}
      >
        {label}
        <ExternalLink className="size-3.5" />
      </a>
    )
  }

  // inline (default) — sidebar card style
  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors ${className}`}
    >
      <div className="size-9 rounded-lg bg-primary/12 flex items-center justify-center shrink-0">
        <ExternalLink className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">
          Listed at
        </p>
        <p className="text-[13px] font-semibold text-foreground truncate">
          {platformName}
        </p>
      </div>
      <span className="text-[10px] text-primary/80 group-hover:text-primary font-medium tracking-wider uppercase shrink-0">
        Open ↗
      </span>
    </a>
  )
}
