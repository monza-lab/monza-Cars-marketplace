"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/navigation"
import {
  Shield,
  Clock,
  Gauge,
  Award,
  FileText,
  Lock,
  Car as CarIcon,
  Cog,
  DollarSign,
} from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useCurrency } from "@/lib/CurrencyContext"
import { useLocale } from "next-intl"
import { stripHtml } from "@/lib/stripHtml"
import { SafeImage } from "@/components/dashboard/cards/SafeImage"
import { extractSeries } from "@/lib/brandConfig"
import { REPORT_PISTON_COST } from "@/lib/reports/canAffordReport"

// ─── CAR CONTEXT PANEL (right panel for individual car view) ───
// Investment-intelligence layout focused on driving Report conversion:
//   1. Listing facts required before report generation
//   2. Signals row (chips)
//   3. Recent sales — 3 closed comps from same series
//   4. Report tease (locked bullets) + Unlock CTA
//
// The Ask Advisor button was also removed: the floating AdvisorFab is
// already visible globally; one entry-point is enough per viewport.

export function CarContextPanel({
  car,
  make,
  siblingCars,
}: {
  car: CollectorCar
  make: string
  /** All cars in the current series/family — used to derive recent comps. */
  siblingCars?: CollectorCar[]
  /** Kept for backward compat with call sites; the panel no longer renders
   *  an Ask Advisor button (the AdvisorFab already covers this entry point). */
  onOpenAdvisor?: () => void
}) {
  const { formatPrice } = useCurrency()
  const locale = useLocale()

  const listingPrice = car.askingPriceUsd ?? car.price ?? car.currentBid
  const mileage = car.mileage > 0
    ? `${car.mileage.toLocaleString(locale)} ${car.mileageUnit}`
    : "Mileage not listed"

  // Derive signal chips — only show what we can prove from data.
  const signals = useMemo(() => {
    const out: { label: string; tone: "neutral" | "positive" | "warning" }[] = []

    if (car.mileage > 0 && car.mileageUnit === "mi" && car.mileage < 30000) {
      out.push({ label: "Low miles", tone: "positive" })
    }
    if (car.mileage > 0 && car.mileageUnit === "mi" && car.mileage > 100000) {
      out.push({ label: "High miles", tone: "warning" })
    }
    if (car.status === "ENDING_SOON") {
      out.push({ label: "Ending soon", tone: "warning" })
    }
    if (car.status === "ACTIVE" && car.bidCount === 0) {
      out.push({ label: "No bids yet", tone: "neutral" })
    }
    if (car.status === "ACTIVE" && car.bidCount >= 20) {
      out.push({ label: "Active bidding", tone: "positive" })
    }
    if (car.category && car.category.trim()) {
      out.push({ label: car.category, tone: "neutral" })
    }

    return out
  }, [car])

  // Derive 3 recent closed comps from the same series — excluding the
  // active car. SOLD/ENDED status, sorted by recency.
  const recentSales = useMemo(() => {
    if (!siblingCars || siblingCars.length === 0) return []
    const activeSeries = extractSeries(car.model, car.year, make)
    return siblingCars
      .filter((c) => {
        if (c.id === car.id) return false
        // CollectorCar's AuctionStatus is "ACTIVE" | "ENDING_SOON" | "ENDED" —
        // ENDED covers both sold and unsold closed auctions/listings.
        if (c.status !== "ENDED") return false
        const series = extractSeries(c.model, c.year, make)
        return series === activeSeries
      })
      .sort((a, b) => {
        const aT = a.endTime ? new Date(a.endTime).getTime() : 0
        const bT = b.endTime ? new Date(b.endTime).getTime() : 0
        return bT - aT
      })
      .slice(0, 3)
  }, [siblingCars, car.id, car.model, car.year, make])

  const reportHref = `/cars/${make.toLowerCase().replace(/\s+/g, "-")}/${car.id}/report`

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">

        {/* 1. HEADER — Investment Intelligence */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <Shield className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Market Intelligence
            </span>
          </div>
          <h2 className="text-[14px] font-display font-normal text-foreground leading-tight">
            {car.year} {make} {car.model}
          </h2>
          {car.thesis && (
            <p className="text-[11px] leading-relaxed text-muted-foreground mt-2 line-clamp-4">
              {stripHtml(car.thesis)}
            </p>
          )}
        </div>

        {/* 2. LISTING FACTS - required before report generation */}
        <div className="px-5 py-4 border-b border-border bg-primary/3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Listing facts
            </span>
          </div>

          {/* Core listing facts */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/70 bg-card/70 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="size-3.5 text-primary" />
                <span className="text-[8px] uppercase tracking-wider">Price</span>
              </div>
              <p className="text-[15px] font-display font-medium text-foreground tabular-nums">
                {car.currentBid > 0 ? formatPrice(car.currentBid) : "POA"}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                <FileText className="size-3.5 text-primary" />
                <span className="text-[8px] uppercase tracking-wider">Listing price</span>
              </div>
              <p className="text-[15px] font-display font-medium text-foreground tabular-nums">
                {listingPrice > 0 ? formatPrice(listingPrice) : "POA"}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                <Gauge className="size-3.5 text-primary" />
                <span className="text-[8px] uppercase tracking-wider">Mileage</span>
              </div>
              <p className="text-[13px] font-medium text-foreground">{mileage}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                <Cog className="size-3.5 text-primary" />
                <span className="text-[8px] uppercase tracking-wider">Transmission</span>
              </div>
              <p className="text-[13px] font-medium text-foreground break-words">{car.transmission || "Not listed"}</p>
            </div>
          </div>

        </div>

        {/* 3. SIGNALS — quick visual cues */}
        {signals.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-2.5">
              <Gauge className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Signals
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {signals.map((s) => (
                <span
                  key={s.label}
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium border ${
                    s.tone === "positive"
                      ? "bg-positive/10 text-positive border-positive/20"
                      : s.tone === "warning"
                        ? "bg-negative/10 text-negative border-negative/20"
                        : "bg-foreground/[0.04] text-foreground border-border"
                  }`}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 4. RECENT SALES — closed comps from same series */}
        <div className="px-5 pt-4 pb-1 border-b border-border bg-primary/3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Award className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Recent sales
              </span>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {extractSeries(car.model, car.year, make) || "Series"}
            </span>
          </div>

          {recentSales.length === 0 ? (
            <div className="-mx-5 pb-1 border-t border-border/60">
              <div className="px-5 py-5 flex flex-col items-center text-center">
                <div className="size-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-2.5">
                  <Clock className="size-4 text-primary-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-[11.5px] font-medium text-foreground">
                  No closed auctions yet
                </p>
                <p className="text-[10.5px] text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
                  Recent sales of this series will populate here as auctions close.
                </p>
              </div>
            </div>
          ) : (
            <div className="-mx-5 border-t border-border/60">
              {recentSales.map((c) => {
                const makeSlug = c.make.toLowerCase().replace(/\s+/g, "-")
                const endedMonth = c.endTime
                  ? new Date(c.endTime).toLocaleDateString(undefined, {
                      month: "short",
                      year: "2-digit",
                    })
                  : null
                return (
                  <Link
                    key={c.id}
                    href={`/cars/${makeSlug}/${c.id}/report`}
                    className="group flex gap-3 px-5 py-2.5 border-b border-border/40 hover:bg-foreground/2 transition-colors"
                  >
                    <div className="relative w-14 h-11 rounded-lg overflow-hidden shrink-0 bg-card">
                      <SafeImage
                        src={c.image || c.images?.[0] || "/cars/placeholder.svg"}
                        alt={c.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        fallback={
                          <div className="absolute inset-0 flex items-center justify-center">
                            <CarIcon className="size-3.5 text-muted-foreground" />
                          </div>
                        }
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {c.year} {c.model?.replace(/^Porsche\s*/i, "")}
                      </p>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-[13px] font-display font-medium text-primary tabular-nums">
                          {formatPrice(c.currentBid)}
                        </span>
                        {endedMonth && (
                          <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                            <Clock className="size-2.5" />
                            {endedMonth}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {c.mileage > 0 &&
                          `${c.mileage.toLocaleString()} ${c.mileageUnit} · `}
                        {c.platform.replace(/_/g, " ")}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* 5. REPORT TEASE — locked preview that converts */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              What&apos;s inside the Report
            </span>
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] overflow-hidden">
            <ul className="divide-y divide-border/60">
              {[
                "Provenance trail · ownership history",
                "Reserve estimate · final sale projection",
                "12+ comparable sales last 6 months",
                "Risk score · maintenance red flags",
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-center gap-2.5 px-4 py-2.5"
                >
                  <Lock className="size-3 text-primary shrink-0" strokeWidth={2} />
                  <span className="text-[11.5px] text-foreground/85">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* CTA — Unlock report with pistons */}
      <div className="shrink-0 px-5 py-3 border-t border-border bg-card">
        <Link
          href={reportHref}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-all"
        >
          <FileText className="size-4" />
          Unlock for {REPORT_PISTON_COST} pistons
        </Link>
        <p className="mt-2 text-[10px] text-muted-foreground text-center">
          Full investment intelligence on this {car.year} {car.model}
        </p>
      </div>
    </div>
  )
}
