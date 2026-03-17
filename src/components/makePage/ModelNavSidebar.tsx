"use client"

import { useMemo } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { ArrowLeft, Clock } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useCurrency } from "@/lib/CurrencyContext"
import { useTranslations } from "next-intl"
import { getSeriesConfig } from "@/lib/brandConfig"
import { timeLeft, type Model } from "@/lib/makePageHelpers"

// ─── MODEL NAV SIDEBAR (Left column) ───
export function ModelNavSidebar({
  make,
  cars,
  models,
  currentModelIndex,
  onSelectModel,
}: {
  make: string
  cars: CollectorCar[]
  models: Model[]
  currentModelIndex: number
  onSelectModel: (index: number) => void
}) {
  const tAuction = useTranslations("auctionDetail")
  const { formatPrice } = useCurrency()
  const minPrice = cars.length > 0 ? Math.min(...cars.map(c => c.currentBid)) : 0
  const maxPrice = cars.length > 0 ? Math.max(...cars.map(c => c.currentBid)) : 0
  const liveCount = cars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length

  // Live auction cars for the bottom half
  const liveCars = useMemo(() =>
    cars
      .filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON")
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime()),
    [cars]
  )

  // Grade color helper
  const gradeColor = (g: string) => {
    switch (g) {
      case "AAA": return "text-emerald-400"
      case "AA": return "text-blue-400"
      case "A": return "text-amber-400"
      default: return "text-muted-foreground"
    }
  }

  return (
    <div className="h-full flex flex-col border-r border-border overflow-hidden">
      {/* Compact brand header */}
      <div className="shrink-0 px-3 pt-2.5 pb-2 border-b border-border">
        <div className="flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <ArrowLeft className="size-3 text-muted-foreground" />
            <h1 className="text-[13px] font-bold text-foreground tracking-wide uppercase hover:text-primary transition-colors">{make}</h1>
          </a>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-primary">{cars.length}</span>
            {liveCount > 0 && (
              <span className="flex items-center gap-1">
                <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-400">{liveCount}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 50/50 SPLIT: MODELS + LIVE BIDS */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* TOP HALF: MODELS LIST */}
        <div className="h-1/2 flex flex-col border-b border-border overflow-hidden">
          {/* Models header */}
          <div className="shrink-0 px-3 py-1.5 flex items-center justify-between bg-background/40">
            <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">
              MODELS
            </span>
            <span className="text-[9px] text-muted-foreground">
              {models.length}
            </span>
          </div>

          {/* Scrollable models */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {models.map((model, index) => (
              <button
                key={model.slug}
                onClick={() => onSelectModel(index)}
                className={`w-full text-left flex gap-2.5 px-3 py-2 border-b border-border/50 transition-all ${index === currentModelIndex
                    ? "bg-primary/8 border-l-2 border-l-primary"
                    : "hover:bg-foreground/2"
                  }`}
              >
                {/* Mini thumbnail */}
                <div className="relative w-14 h-10 rounded-lg overflow-hidden shrink-0 bg-card">
                  <Image
                    src={model.representativeImage}
                    alt={model.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                  {model.liveCount > 0 && (
                    <div className="absolute top-0.5 right-0.5 size-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
                {/* Model info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-[12px] font-semibold truncate ${index === currentModelIndex ? "text-primary" : "text-foreground"
                      }`}>
                      {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}
                    </p>
                    <span className={`text-[10px] font-bold shrink-0 ${gradeColor(model.representativeCar.investmentGrade)}`}>
                      {model.representativeCar.investmentGrade}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{model.years}</span>
                    <span className="text-[10px] text-muted-foreground">{model.carCount} cars</span>
                  </div>
                  <span className="text-[11px] font-mono text-primary mt-0.5 block">
                    {formatPrice(model.priceMin)}-{formatPrice(model.priceMax)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* BOTTOM HALF: LIVE BIDS */}
        <div className="h-1/2 flex flex-col overflow-hidden">
          {/* Live header */}
          <div className="shrink-0 px-3 py-1.5 flex items-center gap-2 bg-background/40">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-emerald-400">
              LATEST LISTINGS
            </span>
            {liveCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-[9px] font-bold text-emerald-400">
                {liveCount}
              </span>
            )}
          </div>

          {/* Scrollable live bids */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {liveCars.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <span className="text-[11px] text-muted-foreground">No live auctions</span>
              </div>
            ) : (
              liveCars.map((car) => {
                const isEndingSoon = car.status === "ENDING_SOON"
                const makeSlug = car.make.toLowerCase().replace(/\s+/g, "-")
                return (
                  <Link
                    key={car.id}
                    href={`/cars/${makeSlug}/${car.id}`}
                    className="group flex gap-2.5 px-3 py-2 border-b border-border/50 hover:bg-foreground/2 transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-14 h-11 rounded-lg overflow-hidden shrink-0 bg-card">
                      <Image
                        src={car.image || car.images?.[0] || "/cars/placeholder.svg"}
                        alt={car.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                      <div className="absolute top-0.5 right-0.5 size-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {car.year} {car.model}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-display font-medium text-primary">
                          {formatPrice(car.currentBid)}
                        </span>
                        <span className={`flex items-center gap-1 text-[9px] ${isEndingSoon ? "text-orange-400" : "text-muted-foreground"}`}>
                          <Clock className="size-2.5" />
                          {timeLeft(new Date(car.endTime), {
                            ended: tAuction("time.ended"),
                            day: tAuction("time.units.day"),
                            hour: tAuction("time.units.hour"),
                            minute: tAuction("time.units.minute"),
                          })}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
