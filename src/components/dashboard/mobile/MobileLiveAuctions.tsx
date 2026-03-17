"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useCurrency } from "@/lib/CurrencyContext"
import { Clock, Car } from "lucide-react"
import { SafeImage } from "../cards/SafeImage"
import { timeLeft } from "../utils/timeLeft"
import type { Auction } from "../types"

export function MobileLiveAuctions({ auctions, totalLiveCount }: { auctions: Auction[]; totalLiveCount: number }) {
  const t = useTranslations("dashboard")
  const tAuction = useTranslations("auctionDetail")
  const { formatPrice } = useCurrency()

  const timeLabels = {
    ended: t("asset.ended"),
    day: t("asset.timeDay"),
    hour: t("asset.timeHour"),
    minute: t("asset.timeMin"),
  }

  const liveAuctions = useMemo(() => {
    const now = Date.now()
    return auctions
      .filter(a => ["ACTIVE", "ENDING_SOON", "LIVE"].includes(a.status) && new Date(a.endTime).getTime() > now)
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
      .slice(0, 8)
  }, [auctions])

  if (liveAuctions.length === 0) return null

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {t("mobileFeed.liveAuctions")}
        </span>
        <span className="text-[10px] font-display font-medium text-primary">
          {totalLiveCount}
        </span>
      </div>

      {/* Auction rows */}
      <div className="divide-y divide-border">
        {liveAuctions.map((auction) => {
          const isEndingSoon = auction.status === "ENDING_SOON"
          const remaining = timeLeft(auction.endTime, timeLabels)

          return (
            <Link
              key={auction.id}
              href={`/cars/${auction.make.toLowerCase().replace(/\s+/g, "-")}/${auction.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-foreground/3 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-card">
                <SafeImage
                  src={auction.images[0]}
                  alt={auction.title}
                  fill
                  className="object-cover"
                  sizes="64px"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  unoptimized
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Car className="size-3.5 text-muted-foreground" />
                    </div>
                  }
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground truncate">
                  {auction.year} {auction.make} {auction.model}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] font-display font-medium text-primary">
                    {formatPrice(auction.currentBid)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {tAuction("bids.count", { count: auction.bidCount })}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center gap-1 shrink-0">
                <Clock className={`size-3 ${isEndingSoon ? "text-[#FB923C]" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-mono font-medium ${
                  isEndingSoon ? "text-[#FB923C]" : "text-muted-foreground"
                }`}>
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
