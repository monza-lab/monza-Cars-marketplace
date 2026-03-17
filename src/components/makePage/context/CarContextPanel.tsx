"use client"

import { Link } from "@/i18n/navigation"
import {
  Shield,
  Car,
  Globe,
  Wrench,
  MessageCircle,
  FileText,
  Clock,
} from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useCurrency } from "@/lib/CurrencyContext"
import { useTranslations } from "next-intl"
import { timeLeft } from "@/lib/makePageHelpers"
import { ownershipCosts, getPriceLabel, isAuctionPlatform, getStatusLabel, getPlatformName } from "@/lib/makePageConstants"
import { stripHtml } from "@/lib/stripHtml"

// ─── CAR CONTEXT PANEL (right panel for individual car view) ───
export function CarContextPanel({
  car,
  make,
  onOpenAdvisor,
}: {
  car: CollectorCar
  make: string
  onOpenAdvisor: () => void
}) {
  const tAuction = useTranslations("auctionDetail")
  const { formatPrice } = useCurrency()
  const grade = car.investmentGrade
  const isEndingSoon = car.status === "ENDING_SOON"

  const fallbackCosts = ownershipCosts[make] || ownershipCosts.default
  const priceRatio = car.currentBid > 0 ? Math.max(car.currentBid / 100000, 0.5) : 1
  const carOwnershipCosts = {
    insurance: Math.round(fallbackCosts.insurance * priceRatio),
    storage: fallbackCosts.storage,
    maintenance: Math.round(fallbackCosts.maintenance * priceRatio),
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* 1. CAR OVERVIEW */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Investment Analysis
            </span>
          </div>
          <h2 className="text-[14px] font-display font-normal text-foreground leading-tight">
            {car.year} {make} {car.model}
          </h2>
          {car.thesis && (
            <p className="text-[11px] leading-relaxed text-muted-foreground mt-2 whitespace-pre-line">
              {stripHtml(car.thesis)}
            </p>
          )}
        </div>

        {/* 2. KEY METRICS */}
        <div className="px-5 py-3 border-b border-border bg-primary/3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Grade</span>
              <p className={`text-[16px] font-bold ${
                grade === "AAA" ? "text-emerald-400"
                  : grade === "AA" ? "text-blue-400"
                    : grade === "A" ? "text-amber-400"
                      : "text-muted-foreground"
              }`}>{grade}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{getPriceLabel(car.platform, car.status)}</span>
              <p className="text-[13px] font-display font-medium text-primary">
                {formatPrice(car.currentBid)}
              </p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Status</span>
              <p className={`text-[13px] font-semibold ${
                isEndingSoon ? "text-orange-400" : car.status === "ACTIVE" ? "text-emerald-400" : "text-muted-foreground"
              }`}>
                {isEndingSoon ? "Ending Soon" : getStatusLabel(car.platform, car.status)}
              </p>
            </div>
          </div>
        </div>

        {/* 3. CAR DETAILS */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Car className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Specifications
            </span>
          </div>
          <div className="space-y-2">
            {car.mileage && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Mileage</span>
                <span className="text-[12px] font-mono font-semibold text-foreground">{car.mileage.toLocaleString()} mi</span>
              </div>
            )}
            {car.transmission && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Transmission</span>
                <span className="text-[12px] font-semibold text-foreground">{car.transmission}</span>
              </div>
            )}
            {car.exteriorColor && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Exterior</span>
                <span className="text-[12px] font-semibold text-foreground">{car.exteriorColor}</span>
              </div>
            )}
            {car.interiorColor && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Interior</span>
                <span className="text-[12px] font-semibold text-foreground">{car.interiorColor}</span>
              </div>
            )}
            {car.region && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Region</span>
                <span className="text-[12px] font-semibold text-foreground">{car.region}</span>
              </div>
            )}
            {car.endTime && isAuctionPlatform(car.platform) && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Time Left</span>
                <span className={`text-[12px] font-mono font-semibold ${isEndingSoon ? "text-orange-400" : "text-foreground"}`}>
                  {timeLeft(new Date(car.endTime), {
                    ended: tAuction("time.ended"),
                    day: tAuction("time.units.day"),
                    hour: tAuction("time.units.hour"),
                    minute: tAuction("time.units.minute"),
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4. PLATFORM */}
        <div className="px-5 py-4 border-b border-border bg-primary/3">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Listing Source
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Platform</span>
            <span className="text-[12px] font-semibold text-foreground">
              {getPlatformName(car.platform)}
            </span>
          </div>
          {car.category && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground">Category</span>
              <span className="text-[12px] font-semibold text-foreground">{car.category}</span>
            </div>
          )}
        </div>

        {/* 5. OWNERSHIP COST */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              Annual Ownership Cost
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Insurance", value: carOwnershipCosts.insurance },
              { label: "Storage", value: carOwnershipCosts.storage },
              { label: "Maintenance", value: carOwnershipCosts.maintenance },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span className="text-[11px] font-mono text-muted-foreground">{formatPrice(item.value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
              <span className="text-[11px] font-medium text-foreground">Total</span>
              <span className="text-[12px] font-display font-medium text-primary">{formatPrice(carOwnershipCosts.insurance + carOwnershipCosts.storage + carOwnershipCosts.maintenance)}/yr</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 px-5 py-3 border-t border-border space-y-2">
        <Link
          href={`/cars/${make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-all"
        >
          <FileText className="size-4" />
          View Full Report
        </Link>
        <button
          onClick={onOpenAdvisor}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary hover:bg-primary/6 transition-all"
        >
          <MessageCircle className="size-4" />
          Ask Advisor
        </button>
      </div>
    </div>
  )
}
