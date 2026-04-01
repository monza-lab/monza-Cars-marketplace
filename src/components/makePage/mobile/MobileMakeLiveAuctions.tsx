"use client"

import { useMemo } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { Clock, FileText } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useCurrency } from "@/lib/CurrencyContext"
import { useTranslations } from "next-intl"
import { timeLeft } from "@/lib/makePageHelpers"
import { isAuctionPlatform, platformLabels } from "@/lib/makePageConstants"

// ─── MOBILE: ACTIVE LISTINGS — HORIZONTAL SWIPE CAROUSEL ───
export function MobileMakeLiveAuctions({ cars, totalLiveCount }: { cars: CollectorCar[]; totalLiveCount: number }) {
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const { formatPrice } = useCurrency()

  const liveListings = useMemo(() => {
    return cars
      .filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON")
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
      .slice(0, 10)
  }, [cars])

  if (liveListings.length === 0) return null

  const timeLabels = {
    ended: tAuction("time.ended"),
    day: tAuction("time.units.day"),
    hour: tAuction("time.units.hour"),
    minute: tAuction("time.units.minute"),
  }

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {t("mobileContext.liveListings")}
        </span>
        <span className="text-[10px] font-display font-medium text-primary">{totalLiveCount}</span>
      </div>

      {/* Horizontal scroll carousel */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-2 snap-x snap-mandatory">
        {liveListings.map((car) => {
          const isEndingSoon = car.status === "ENDING_SOON"
          const remaining = timeLeft(new Date(car.endTime), timeLabels)
          const isAuction = isAuctionPlatform(car.platform)
          const badge = platformLabels[car.platform]
          const makeSlug = car.make.toLowerCase().replace(/\s+/g, "-")

          return (
            <div
              key={car.id}
              className="snap-start shrink-0 w-[260px] rounded-2xl border border-border bg-card overflow-hidden"
            >
              {/* Image */}
              <Link href={`/cars/${makeSlug}/${car.id}`} className="block relative h-36 w-full">
                <Image
                  src={car.image || car.images?.[0] || "/cars/placeholder.svg"}
                  alt={car.title}
                  fill
                  className="object-cover"
                  sizes="260px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                {/* Platform + status badges */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  {badge && (
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold backdrop-blur-md ${badge.color}`}>
                      {badge.short}
                    </span>
                  )}
                  {isAuction ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 backdrop-blur-md">
                      <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[8px] font-bold text-emerald-400">LIVE</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 backdrop-blur-md text-[8px] font-bold text-emerald-400">
                      For Sale
                    </span>
                  )}
                </div>

                {/* Time left (auctions only) */}
                {isAuction && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/70 backdrop-blur-md">
                    <Clock className={`size-3 ${isEndingSoon ? "text-[#FB923C]" : "text-muted-foreground"}`} />
                    <span className={`text-[9px] font-mono font-medium ${isEndingSoon ? "text-[#FB923C]" : "text-muted-foreground"}`}>
                      {remaining}
                    </span>
                  </div>
                )}
              </Link>

              {/* Info */}
              <div className="p-3">
                <Link href={`/cars/${makeSlug}/${car.id}`} className="block">
                  <p className="text-[12px] font-semibold text-foreground truncate">{car.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[14px] font-display font-medium text-primary">
                      {formatPrice(car.currentBid)}
                    </span>
                    {isAuction && car.bidCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {car.bidCount} bids
                      </span>
                    )}
                  </div>
                </Link>

                {/* Report CTA */}
                <Link
                  href={`/cars/${makeSlug}/${car.id}/report`}
                  className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-primary/10 border border-primary/20 active:bg-primary/20 transition-colors"
                >
                  <FileText className="size-3.5 text-primary" />
                  <span className="text-[11px] font-semibold text-primary">View Report</span>
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
