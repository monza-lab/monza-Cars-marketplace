"use client"

import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { Clock, Gavel, Shield, ChevronRight } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { useTranslations } from "next-intl"
import { timeLeft } from "@/lib/makePageHelpers"
import { platformLabels } from "@/lib/makePageConstants"

// ─── CAR FEED CARD (Full-height card for individual cars) ───
export function CarFeedCard({ car, make }: { car: CollectorCar; make: string }) {
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const { selectedRegion } = useRegion()
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")

  const isEndingSoon = car.status === "ENDING_SOON"
  const grade = car.investmentGrade

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
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-card flex items-center justify-center">
              <span className="text-muted-foreground text-lg">{car.year} {car.model}</span>
            </div>
          )}

          {/* Vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent dark:from-card pointer-events-none" />

          {/* Grade badge — top left */}
          <div className="absolute top-4 left-4">
            <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
              grade === "AAA"
                ? "bg-emerald-500/30 text-emerald-300"
                : grade === "AA"
                  ? "bg-primary/30 text-primary"
                  : "bg-foreground/20 text-white"
            }`}>
              {grade}
            </span>
          </div>

          {/* Status badge — top right */}
          <div className="absolute top-4 right-4">
            {isEndingSoon && (
              <span className="flex items-center gap-1.5 rounded-full bg-orange-500/30 backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold text-orange-300">
                <Clock className="size-3 animate-pulse" />
                Ending Soon
              </span>
            )}
            {car.status === "ACTIVE" && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/30 backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
            {/* Current Bid */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Gavel className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Current Bid</span>
              </div>
              <p className="text-[14px] font-display font-medium text-primary">
                {formatPriceForRegion(car.currentBid, selectedRegion)}
              </p>
            </div>

            {/* Platform + Time Left */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">
                  {platformLabels[car.platform]?.short || car.platform.replace(/_/g, " ")}
                </span>
              </div>
              <p className={`text-[13px] font-medium ${isEndingSoon ? "text-orange-400" : "text-foreground"}`}>
                {timeLeft(new Date(car.endTime), {
                  ended: tAuction("time.ended"),
                  day: tAuction("time.units.day"),
                  hour: tAuction("time.units.hour"),
                  minute: tAuction("time.units.minute"),
                })}
              </p>
            </div>

            {/* Grade */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Shield className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("sidebar.grade")}</span>
              </div>
              <p className={`text-[13px] font-semibold ${
                grade === "AAA" ? "text-emerald-400"
                  : grade === "AA" ? "text-blue-400"
                    : grade === "A" ? "text-amber-400"
                      : "text-muted-foreground"
              }`}>{grade}</p>
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
