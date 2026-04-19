"use client"

import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { Clock, Gavel, ChevronRight } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useCurrency } from "@/lib/CurrencyContext"
import { useTranslations } from "next-intl"
import { timeLeft } from "@/lib/makePageHelpers"
import { platformLabels, getPriceLabel, isAuctionPlatform, getStatusLabel } from "@/lib/makePageConstants"
import { MarketDeltaPill } from "@/components/report/MarketDeltaPill"

// ─── CAR FEED CARD (Full-height card for individual cars) ───
export function CarFeedCard({ car, make }: { car: CollectorCar; make: string }) {
  const tAuction = useTranslations("auctionDetail")
  const { formatPrice } = useCurrency()
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")

  const isEndingSoon = car.status === "ENDING_SOON"

  return (
    <div className="h-[calc(100dvh-140px)] w-full flex flex-col snap-start p-4">
      <Link
        href={`/cars/${makeSlug}/${car.id}`}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-card border border-border group cursor-pointer hover:border-primary/20 transition-all duration-300"
      >
        {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[2/1] w-full shrink-0 overflow-hidden">
          {car.image ? (
            <Image
              src={car.image}
              alt={car.title}
              fill
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
              sizes="50vw"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 bg-card flex items-center justify-center">
              <span className="text-muted-foreground text-lg">{car.year} {car.model}</span>
            </div>
          )}

          {/* Vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent dark:from-card pointer-events-none" />

          {/* Market delta pill — top left */}
          <div className="absolute top-4 left-4">
            <MarketDeltaPill priceUsd={car.currentBid} medianUsd={null} className="text-[10px] font-bold tracking-[0.1em]" />
          </div>

          {/* Status badge — top right */}
          <div className="absolute top-4 right-4">
            {isEndingSoon && (
              <span className="flex items-center gap-1.5 rounded-full bg-destructive/30 backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold text-destructive">
                <Clock className="size-3 animate-pulse" />
                Ending Soon
              </span>
            )}
            {car.status === "ACTIVE" && (
              <span className="flex items-center gap-1.5 rounded-full bg-positive/30 backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold text-positive">
                <span className="size-1.5 rounded-full bg-positive animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>

        {/* BOTTOM: CAR INFO */}
        <div className="flex-1 w-full bg-card px-5 pt-4 pb-3 flex flex-col min-h-0">
          {/* Car title */}
          <div>
            <h2 className="text-2xl font-display font-light text-foreground tracking-tight group-hover:text-primary transition-colors">
              {car.year} {car.model}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {car.mileage?.toLocaleString()} miles
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
            {/* Price / Current Bid */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Gavel className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{getPriceLabel(car.platform, car.status)}</span>
              </div>
              <p className="text-[14px] font-display font-medium text-primary">
                {formatPrice(car.currentBid)}
              </p>
            </div>

            {/* Platform + Status */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">
                  {platformLabels[car.platform]?.short || car.platform.replace(/_/g, " ")}
                </span>
              </div>
              <p className={`text-[13px] font-medium ${isEndingSoon ? "text-destructive" : "text-foreground"}`}>
                {isAuctionPlatform(car.platform)
                  ? timeLeft(new Date(car.endTime), {
                      ended: tAuction("time.ended"),
                      day: tAuction("time.units.day"),
                      hour: tAuction("time.units.hour"),
                      minute: tAuction("time.units.minute"),
                    })
                  : getStatusLabel(car.platform, car.status)}
              </p>
            </div>

          </div>

          {/* Category */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="px-2.5 py-0.5 rounded-full bg-foreground/5 text-[10px] text-muted-foreground">
              {car.category}
            </span>
            {car.region && (
              <span className="px-2.5 py-0.5 rounded-full bg-foreground/5 text-[10px] text-muted-foreground">
                {car.region}
              </span>
            )}
          </div>

          {/* CTA — always visible at bottom */}
          <div className="mt-auto pt-3 flex items-center justify-center rounded-xl bg-primary py-2.5 group-hover:bg-primary/80 transition-colors">
            <span className="text-[12px] font-semibold tracking-[0.1em] uppercase text-primary-foreground">
              View Investment Report
            </span>
            <ChevronRight className="size-4 text-primary-foreground ml-1" />
          </div>
        </div>
      </Link>
    </div>
  )
}
