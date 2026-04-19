"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useCurrency } from "@/lib/CurrencyContext"
import { DollarSign, Calendar, Car, ChevronRight } from "lucide-react"
import { SafeImage } from "./SafeImage"
import type { PorscheFamily } from "../types"

export function FamilyCard({ family, index = 0 }: { family: PorscheFamily; index?: number }) {
  const t = useTranslations("dashboard")
  const tv = useTranslations("valuation")
  const { formatPrice } = useCurrency()

  const yearLabel = family.yearMin === family.yearMax
    ? `${family.yearMin}`
    : `${family.yearMin}–${family.yearMax}`

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <Link
        href={`/cars/porsche?family=${encodeURIComponent(family.slug)}`}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-card border border-border group cursor-pointer hover:border-primary/20 transition-all duration-300"
      >
        {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          <SafeImage
            src={family.representativeImage}
            alt={family.name}
            fill
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            sizes="50vw"
            priority={index === 0}
            loading={index === 0 ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            fallbackSrc={family.fallbackImage}
            fallback={
              <div className="absolute inset-0 bg-card flex items-center justify-center">
                <span className="text-muted-foreground text-lg">{family.name}</span>
              </div>
            }
          />

          {/* Vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent dark:from-card pointer-events-none" />

          {/* Car count badge */}
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-foreground">
              {family.carCount} {family.carCount === 1 ? "car" : "cars"}
            </span>
          </div>

          {/* Grade badge */}
          <div className="absolute top-4 left-4">
            <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
              family.topGrade === "AAA"
                ? "bg-positive/30 text-positive"
                : family.topGrade === "AA"
                ? "bg-primary/30 text-primary"
                : "bg-foreground/20 text-white"
            }`}>
              {family.topGrade}
            </span>
          </div>
        </div>

        {/* BOTTOM: FAMILY INFO */}
        <div className="flex-1 w-full bg-card p-6 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-primary mb-1">
              Porsche
            </p>
            <h2 className="text-3xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              {family.name}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              {family.representativeCar}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{tv("askingRange")}</span>
              </div>
              <p className="text-[13px] tabular-nums text-foreground">
                {formatPrice(family.priceMin)}–{formatPrice(family.priceMax)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Years</span>
              </div>
              <p className="text-[13px] tabular-nums text-foreground">{yearLabel}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.collection")}</span>
              </div>
              <p className="text-[13px] text-foreground">{family.carCount} listings</p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-[0.1em] uppercase text-muted-foreground group-hover:text-primary transition-colors">
              Explore {family.name}
            </span>
            <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>
    </div>
  )
}
