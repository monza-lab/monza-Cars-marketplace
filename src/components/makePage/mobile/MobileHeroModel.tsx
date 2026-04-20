"use client"

import Image from "next/image"
import { Link, useRouter } from "@/i18n/navigation"
import { ArrowLeft } from "lucide-react"
import { useCurrency } from "@/lib/CurrencyContext"
import { useLocale, useTranslations } from "next-intl"
import { getSeriesConfig } from "@/lib/brandConfig"
import { MarketDeltaPill } from "@/components/report/MarketDeltaPill"
import type { Model } from "@/lib/makePageHelpers"

// ─── MOBILE: HERO MODEL (first model) ───
export function MobileHeroModel({ model, make }: { model: Model; make: string }) {
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")
  const t = useTranslations("makePage")
  const { formatPrice } = useCurrency()
  const router = useRouter()
  const locale = useLocale()
  const homeHref = "/"

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
        {/* Gradient overlay — always dark since text sits over photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

        {/* Back link */}
        <div className="absolute top-4 left-4">
          <button onClick={() => router.push(homeHref)} className="flex items-center gap-1.5 text-[11px] text-white/60 hover:text-white/90 transition-colors cursor-pointer">
            <ArrowLeft className="size-3.5" />
            {t("hero.backToCollection")}
          </button>
        </div>

        {/* Market delta pill */}
        <div className="absolute top-4 right-4">
          <MarketDeltaPill priceUsd={model.representativeCar.currentBid} medianUsd={null} />
        </div>

        {/* Live badge */}
        {model.liveCount > 0 && (
          <div className="absolute top-12 right-4 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md px-2.5 py-1">
            <div className="size-1.5 rounded-full bg-positive animate-pulse" />
            <span className="text-[10px] font-semibold text-positive">{model.liveCount} LIVE</span>
          </div>
        )}

        {/* Overlaid info — always light text over dark gradient */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
          <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-primary">
            {t("hero.brandCollection")}
          </span>
          <h1 className="text-3xl font-bold text-white mt-1">
            {make} {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}
          </h1>
          <p className="text-[12px] text-white/50 mt-0.5">
            {model.years} · {model.carCount} {model.carCount === 1 ? "car" : "cars"}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[16px] font-display font-medium text-primary">
              {formatPrice(model.priceMin)} – {formatPrice(model.priceMax)}
            </span>
          </div>
          {/* Categories */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {model.categories.slice(0, 3).map((cat) => (
              <span key={cat} className="px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm text-[10px] text-white/70">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}
