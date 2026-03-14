"use client"

import Image from "next/image"
import { Link, useRouter } from "@/i18n/navigation"
import { ArrowLeft } from "lucide-react"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { useTranslations } from "next-intl"
import { getSeriesConfig } from "@/lib/brandConfig"
import type { Model } from "@/lib/makePageHelpers"

// ─── MOBILE: HERO MODEL (first model) ───
export function MobileHeroModel({ model, make }: { model: Model; make: string }) {
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")
  const t = useTranslations("makePage")
  const { selectedRegion } = useRegion()
  const router = useRouter()

  return (
    <Link href={`/cars/${makeSlug}/${model.representativeCar.id}`} className="block relative">
      <div className="relative h-[40dvh] min-h-[280px] w-full overflow-hidden">
        <Image
          src={model.representativeImage}
          alt={model.name}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent dark:from-background dark:via-background/40" />

        {/* Back link */}
        <div className="absolute top-4 left-4">
          <button onClick={() => router.push("/")} className="flex items-center gap-1.5 text-[11px] text-[rgba(232,226,222,0.5)] hover:text-[rgba(232,226,222,0.8)] transition-colors cursor-pointer">
            <ArrowLeft className="size-3.5" />
            {t("hero.backToCollection")}
          </button>
        </div>

        {/* Grade badge */}
        <div className="absolute top-4 right-4">
          <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${model.representativeCar.investmentGrade === "AAA"
              ? "bg-emerald-500/30 text-emerald-300"
              : model.representativeCar.investmentGrade === "AA"
                ? "bg-primary/30 text-primary"
                : "bg-foreground/20 text-white"
            }`}>
            {model.representativeCar.investmentGrade}
          </span>
        </div>

        {/* Live badge */}
        {model.liveCount > 0 && (
          <div className="absolute top-12 right-4 flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur-md px-2.5 py-1">
            <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-emerald-400">{model.liveCount} LIVE</span>
          </div>
        )}

        {/* Overlaid info */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
          <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-primary">
            {t("hero.brandCollection")}
          </span>
          <h1 className="text-3xl font-bold text-foreground mt-1">
            {make} {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}
          </h1>
          <p className="text-[12px] text-[rgba(232,226,222,0.5)] mt-0.5">
            {model.years} · {model.carCount} {model.carCount === 1 ? "car" : "cars"}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[16px] font-display font-medium text-primary">
              {formatPriceForRegion(model.priceMin, selectedRegion)} – {formatPriceForRegion(model.priceMax, selectedRegion)}
            </span>
          </div>
          {/* Categories */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {model.categories.slice(0, 3).map((cat) => (
              <span key={cat} className="px-2.5 py-1 rounded-full bg-foreground/10 backdrop-blur-sm text-[10px] text-foreground/70">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}
