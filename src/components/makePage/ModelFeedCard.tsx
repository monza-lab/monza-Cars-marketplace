"use client"

import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { DollarSign, Car, Shield, ChevronRight } from "lucide-react"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { useTranslations } from "next-intl"
import { getSeriesConfig } from "@/lib/brandConfig"
import type { Model } from "@/lib/makePageHelpers"

// ─── MODEL FEED CARD (Full-height card for center column) ───
export function ModelFeedCard({ model, make, onClick, index = 0 }: { model: Model; make: string; onClick?: () => void; index?: number }) {
  const t = useTranslations("makePage")
  const { selectedRegion } = useRegion()
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")

  // Investment grade from representative car
  const grade = model.representativeCar.investmentGrade

  const cardContent = (
    <>
      {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          {model.representativeImage ? (
            <Image
              src={model.representativeImage}
              alt={`${make} ${model.name}`}
              fill
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
              sizes="50vw"
              priority={index === 0}
              loading={index === 0 ? "eager" : "lazy"}
              referrerPolicy="no-referrer"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-card flex items-center justify-center">
              <span className="text-muted-foreground text-lg">{make} {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}</span>
            </div>
          )}

          {/* Vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent dark:from-card pointer-events-none" />

          {/* Grade badge — top left */}
          <div className="absolute top-4 left-4">
            <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${grade === "AAA"
                ? "bg-emerald-500/30 text-emerald-300"
                : grade === "AA"
                  ? "bg-primary/30 text-primary"
                  : "bg-foreground/20 text-white"
              }`}>
              {grade}
            </span>
          </div>

          {/* Car count badge — top right */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {model.liveCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t("hero.liveCount", { count: model.liveCount })}
              </span>
            )}
            <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-foreground">
              {model.carCount} {t("hero.listings")}
            </span>
          </div>
        </div>

        {/* BOTTOM: MODEL INFO */}
        <div className="flex-1 w-full bg-card p-6 flex flex-col justify-between">
          {/* Model name + subtitle */}
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              {make} {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              {model.years}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
            {/* Price Range */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("model.priceRange")}</span>
              </div>
              <p className="text-[13px] font-mono text-foreground">
                {formatPriceForRegion(model.priceMin, selectedRegion)}&ndash;{formatPriceForRegion(model.priceMax, selectedRegion)}
              </p>
            </div>

            {/* Listed */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("hero.listings")}</span>
              </div>
              <p className="text-[13px] text-foreground">{model.carCount} vehicles</p>
            </div>

            {/* Grade */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Shield className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("sidebar.grade")}</span>
              </div>
              <p className={`text-[13px] font-semibold ${grade === "AAA" ? "text-emerald-400"
                  : grade === "AA" ? "text-blue-400"
                    : grade === "A" ? "text-amber-400"
                      : "text-muted-foreground"
                }`}>{grade}</p>
            </div>
          </div>

          {/* Categories */}
          {model.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {model.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="px-3 py-1 rounded-full bg-foreground/5 text-[10px] text-muted-foreground"
                >
                  {cat}
                </span>
              ))}
              {model.categories.length > 3 && (
                <span className="px-3 py-1 rounded-full bg-foreground/5 text-[10px] text-muted-foreground">
                  +{model.categories.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-[0.1em] uppercase text-muted-foreground group-hover:text-primary transition-colors">
              {t("model.viewCollection")}
            </span>
            <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
    </>
  )

  const containerClass = "flex-1 flex flex-col rounded-[32px] overflow-hidden bg-card border border-border group cursor-pointer hover:border-primary/20 transition-all duration-300"

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      {onClick ? (
        <button onClick={onClick} className={containerClass}>
          {cardContent}
        </button>
      ) : (
        <Link href={`/cars/${makeSlug}/${model.representativeCar.id}`} className={containerClass}>
          {cardContent}
        </Link>
      )}
    </div>
  )
}
