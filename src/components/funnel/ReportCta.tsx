"use client"

import { Link } from "@/i18n/navigation"
import { FileText, ChevronRight } from "lucide-react"

/**
 * "Get the Report" call-to-action.
 *
 * The primary funnel action across the product: cards → detail → report.
 * Heritage Lavender accent, light shadow, on-brand. Use the right variant
 * for each placement.
 *
 *  - `pill`   : compact pill for card overlays
 *  - `inline` : medium card for sidebars
 *  - `hero`   : prominent card with sub-text (top of detail / sticky CTA)
 *  - `sticky` : full-width button strip (bottom mobile / fixed bar)
 */

interface ReportCtaProps {
  /** Canonical car id (e.g. `live-abcd...` or curated id). */
  carId: string
  /** Lower-cased, hyphenated make slug (e.g. "porsche"). */
  makeSlug: string
  /** Custom label override. Defaults vary by variant. */
  label?: string
  /** Sub-line shown only in `hero` / `inline` variants. */
  subline?: string
  variant?: "pill" | "inline" | "hero" | "sticky"
  className?: string
}

export function ReportCta({
  carId,
  makeSlug,
  label,
  subline,
  variant = "inline",
  className = "",
}: ReportCtaProps) {
  const href = `/cars/${makeSlug}/${carId}/report`

  if (variant === "pill") {
    return (
      <Link
        href={href}
        className={`inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold tracking-wide text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm ${className}`}
      >
        <FileText className="size-3" />
        {label ?? "Get the Report"}
      </Link>
    )
  }

  if (variant === "sticky") {
    return (
      <Link
        href={href}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-[12px] font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/85 transition-colors shadow-[0_8px_24px_rgba(94,63,102,0.25)] ${className}`}
      >
        <FileText className="size-4" />
        {label ?? "Get the Investment Report"}
      </Link>
    )
  }

  if (variant === "hero") {
    return (
      <Link
        href={href}
        className={`group flex items-center gap-4 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-primary/5 p-5 hover:border-primary/40 hover:from-primary/14 hover:to-primary/8 transition-colors ${className}`}
      >
        <div className="size-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <FileText className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary/80 mb-0.5">
            MonzaHaus
          </p>
          <p className="text-[15px] font-semibold text-foreground leading-tight">
            {label ?? "Get the Investment Report"}
          </p>
          {subline ? (
            <p className="text-[11px] text-muted-foreground mt-1">{subline}</p>
          ) : null}
        </div>
        <ChevronRight className="size-5 text-primary group-hover:translate-x-0.5 transition-transform shrink-0" />
      </Link>
    )
  }

  // inline (default) — sidebar card style, matches existing layout
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/6 p-4 hover:bg-primary/10 hover:border-primary/40 transition-colors ${className}`}
    >
      <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
        <FileText className="size-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-foreground">
          {label ?? "Investment Report"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {subline ?? "Valuation, risks, comps & costs"}
        </p>
      </div>
      <ChevronRight className="size-4 text-primary group-hover:translate-x-0.5 transition-transform" />
    </Link>
  )
}
