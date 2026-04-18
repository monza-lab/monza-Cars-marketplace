"use client"

import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { motion } from "framer-motion"
import { Clock, Gavel, ChevronRight } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useCurrency } from "@/lib/CurrencyContext"
import { useLocale, useTranslations } from "next-intl"
import { timeLeft } from "@/lib/makePageHelpers"

// ─── CAR CARD IN GRID ───
export function CarCard({ car, index }: { car: CollectorCar; index: number }) {
  const locale = useLocale()
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const tStatus = useTranslations("status")
  const { formatPrice } = useCurrency()

  const isLive = car.status === "ACTIVE" || car.status === "ENDING_SOON"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      layout
    >
      <Link
        href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
        className="group block rounded-2xl bg-card border border-primary/8 overflow-hidden hover:border-primary/20 transition-all duration-300"
      >
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <Image
            src={car.image || car.images?.[0] || "/cars/placeholder.svg"}
            alt={car.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent dark:from-background" />

          {/* Status badge */}
          {isLive && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-md px-2.5 py-1">
              <div className="size-1.5 rounded-full bg-positive animate-pulse" />
              <span className="text-[10px] font-medium text-positive">{tStatus("live")}</span>
            </div>
          )}

          {/* Platform badge - real data source */}
          <div className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-medium bg-foreground/10 text-foreground/70 border border-border/80">
            {car.platform === "BRING_A_TRAILER" ? "BaT" :
              car.platform === "CARS_AND_BIDS" ? "C&B" :
                car.platform === "COLLECTING_CARS" ? "CC" :
                  car.platform === "AUTO_SCOUT_24" ? "AS24" : car.platform}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-[15px] font-display font-normal text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {car.title}
          </h3>

          {/* Stats row - real data only */}
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
                {isLive ? t("card.currentBid") : t("card.soldFor")}
              </p>
              <p className="text-[18px] font-display font-medium text-primary">
                {formatPrice(car.currentBid)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
                {tAuction("specs.mileage")}
              </p>
              <p className="text-[13px] font-medium text-muted-foreground">
                {car.mileage.toLocaleString(locale)} {car.mileageUnit}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              {isLive && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {timeLeft(new Date(car.endTime), {
                    ended: tAuction("time.ended"),
                    day: tAuction("time.units.day"),
                    hour: tAuction("time.units.hour"),
                    minute: tAuction("time.units.minute"),
                  })}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Gavel className="size-3" />
                {tAuction("bids.count", { count: car.bidCount })}
              </span>
            </div>
            <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
