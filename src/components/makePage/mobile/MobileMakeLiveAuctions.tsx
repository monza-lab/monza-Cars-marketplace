"use client"

import { useMemo } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { Clock, Gavel, ChevronRight, ExternalLink, Car } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useCurrency } from "@/lib/CurrencyContext"
import { useTranslations } from "next-intl"
import { timeLeft } from "@/lib/makePageHelpers"
import { isAuctionPlatform, platformLabels } from "@/lib/makePageConstants"

// ─── MOBILE: ACTIVE LISTINGS — VERTICAL STACK (data-first) ───
export function MobileMakeLiveAuctions({ cars, totalLiveCount }: { cars: CollectorCar[]; totalLiveCount: number }) {
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const { formatPrice } = useCurrency()

  const liveListings = useMemo(() => {
    return cars
      .filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON")
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
      .slice(0, 12)
  }, [cars])

  if (liveListings.length === 0) return null

  const timeLabels = {
    ended: tAuction("time.ended"),
    day: tAuction("time.units.day"),
    hour: tAuction("time.units.hour"),
    minute: tAuction("time.units.minute"),
  }

  return (
    <div className="mt-4">
      {/* Section header — sober editorial */}
      <div className="px-4 py-3 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {/* [HARDCODED] */}Latest reports
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {totalLiveCount.toLocaleString()} {/* [HARDCODED] */}tracked
        </span>
      </div>

      {/* Vertical card stack */}
      <div className="space-y-3 px-4">
        {liveListings.map((car) => (
          <MobileMakeReportCard
            key={car.id}
            car={car}
            timeLabels={timeLabels}
            formatPrice={formatPrice}
          />
        ))}
      </div>
    </div>
  )
}

// ─── MOBILE: REPORT CARD (honest-by-data) ───
function MobileMakeReportCard({
  car,
  timeLabels,
  formatPrice,
}: {
  car: CollectorCar
  timeLabels: { ended: string; day: string; hour: string; minute: string }
  formatPrice: (n: number) => string
}) {
  const makeSlug = car.make.toLowerCase().replace(/\s+/g, "-")
  const reportHref = `/cars/${makeSlug}/${car.id}`
  const platform = car.platform ? platformLabels[car.platform] : null
  const platformLabel = platform?.short ?? car.platform
  const sourceUrl = (car as CollectorCar & { sourceUrl?: string | null }).sourceUrl
  const isAuction = isAuctionPlatform(car.platform)
  const endMs = car.endTime ? new Date(car.endTime).getTime() : NaN
  const showCountdown =
    isAuction &&
    car.bidCount > 0 &&
    Number.isFinite(endMs) &&
    endMs > Date.now()
  const remaining = showCountdown
    ? timeLeft(new Date(car.endTime), { ...timeLabels, ended: "" })
    : null

  return (
    <Link
      href={reportHref}
      aria-label={`View MonzaHaus report — ${car.title}`}
      className="group flex items-stretch gap-3 rounded-xl bg-card border border-border overflow-hidden active:border-primary/30 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Thumbnail with platform pill */}
      <div className="relative w-28 h-28 shrink-0 bg-muted overflow-hidden">
        <Image
          src={car.image || car.images?.[0] || "/cars/placeholder.svg"}
          alt={car.title}
          fill
          className="object-cover"
          sizes="112px"
          loading="lazy"
        />
        {platformLabel && (
          <div className="absolute top-1.5 left-1.5">
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-background/85 text-foreground/90 border border-border backdrop-blur-md">
              {platformLabel}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 py-2.5 pr-3 flex flex-col">
        <h3 className="text-[13px] font-display font-medium text-foreground line-clamp-1">
          {car.title}
        </h3>

        <div className="mt-1 flex items-baseline gap-2">
          {car.currentBid > 0 ? (
            <span className="text-[15px] font-display font-medium text-primary tabular-nums leading-tight">
              {formatPrice(car.currentBid)}
            </span>
          ) : (
            <span className="text-[12px] text-muted-foreground italic">
              {/* [HARDCODED] */}Price on request
            </span>
          )}
          {typeof car.mileage === "number" && car.mileage > 0 ? (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {car.mileage.toLocaleString()} {car.mileageUnit || "mi"}
            </span>
          ) : null}
        </div>

        <div className="mt-auto pt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-[10px] text-muted-foreground">
            {showCountdown && remaining && (
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="size-3" />
                {remaining}
              </span>
            )}
            {isAuction && car.bidCount > 0 && (
              <span className="flex items-center gap-1 shrink-0">
                <Gavel className="size-3" />
                {car.bidCount}
              </span>
            )}
            {car.region && (
              <span className="font-medium tracking-wider shrink-0">
                {car.region}
              </span>
            )}
          </div>
          {sourceUrl ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                window.open(sourceUrl, "_blank", "noopener,noreferrer")
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-foreground/80 active:border-primary/40 active:text-primary transition-colors shrink-0"
              title={`View original listing on ${platformLabel}`}
            >
              {/* [HARDCODED] */}View on {platformLabel}
              <ExternalLink className="size-2.5" />
            </button>
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
          )}
        </div>
      </div>
    </Link>
  )
}
