"use client"

import { useMemo } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { Clock } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { useTranslations } from "next-intl"
import { timeLeft } from "@/lib/makePageHelpers"

// ─── MOBILE: LIVE AUCTIONS FOR MAKE PAGE ───
export function MobileMakeLiveAuctions({ cars, totalLiveCount }: { cars: CollectorCar[]; totalLiveCount: number }) {
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const { selectedRegion } = useRegion()

  const liveAuctions = useMemo(() => {
    return cars
      .filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON")
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
      .slice(0, 6)
  }, [cars])

  if (liveAuctions.length === 0) return null

  const timeLabels = {
    ended: tAuction("time.ended"),
    day: tAuction("time.units.day"),
    hour: tAuction("time.units.hour"),
    minute: tAuction("time.units.minute"),
  }

  return (
    <div className="mt-6">
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {t("mobileContext.liveAuctions")}
        </span>
        <span className="text-[10px] font-display font-medium text-primary">{totalLiveCount}</span>
      </div>
      <div className="divide-y divide-border">
        {liveAuctions.map((car) => {
          const isEndingSoon = car.status === "ENDING_SOON"
          const remaining = timeLeft(new Date(car.endTime), timeLabels)
          return (
            <Link
              key={car.id}
              href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-foreground/3 transition-colors"
            >
              <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-card">
                <Image src={car.image || car.images?.[0] || "/cars/placeholder.svg"} alt={car.title} fill className="object-cover" sizes="64px" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground truncate">{car.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] font-display font-medium text-primary">
                    {formatPriceForRegion(car.currentBid, selectedRegion)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {tAuction("bids.count", { count: car.bidCount })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Clock className={`size-3 ${isEndingSoon ? "text-[#FB923C]" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-mono font-medium ${isEndingSoon ? "text-[#FB923C]" : "text-muted-foreground"}`}>
                  {remaining}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
