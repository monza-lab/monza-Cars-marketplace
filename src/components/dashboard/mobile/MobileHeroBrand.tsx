"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useCurrency } from "@/lib/CurrencyContext"
import { ChevronRight } from "lucide-react"
import { SafeImage } from "../cards/SafeImage"
import { MarketDeltaPill } from "@/components/report/MarketDeltaPill"
import type { Brand } from "../types"

export function MobileHeroBrand({ brand }: { brand: Brand }) {
  const t = useTranslations("dashboard")
  const { formatPrice } = useCurrency()

  return (
    <Link href={`/cars/${brand.slug}`} className="block relative">
      {/* Hero image */}
      <div className="relative h-[45dvh] w-full overflow-hidden">
        <SafeImage
          src={brand.representativeImage}
          alt={brand.name}
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
          referrerPolicy="no-referrer"
          fallback={
            <div className="absolute inset-0 bg-card flex items-center justify-center">
              <span className="text-muted-foreground text-2xl font-bold">{brand.name}</span>
            </div>
          }
        />

        {/* Gradient overlay — always dark for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10 pointer-events-none" />

        {/* Market delta pill */}
        <div className="absolute top-4 left-4">
          <MarketDeltaPill priceUsd={null} medianUsd={null} />
        </div>

        {/* Car count */}
        <div className="absolute top-4 right-4">
          <span className="rounded-full bg-black/40 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium text-white/80">
            {t("brandCard.carsCount", { count: brand.carCount })}
          </span>
        </div>

        {/* Overlaid info at bottom — white text over dark gradient */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
          <h2 className="text-3xl font-bold text-white tracking-tight">
            {brand.name}
          </h2>
          <p className="text-[13px] text-white/50 mt-0.5">
            {brand.representativeCar}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[16px] font-display font-medium text-primary">
              {formatPrice(brand.priceMin)} – {formatPrice(brand.priceMax)}
            </span>
            <span className="text-[12px] text-positive font-medium">{brand.avgTrend}</span>
          </div>
          {/* Categories */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {brand.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm text-[10px] text-white/70"
              >
                {cat}
              </span>
            ))}
          </div>
          {/* Inline CTA */}
          <div className="flex items-center gap-1.5 mt-3 text-primary">
            <span className="text-[12px] font-semibold tracking-[0.1em] uppercase">
              {t("mobileFeed.viewCollection")}
            </span>
            <ChevronRight className="size-4" />
          </div>
        </div>
      </div>
    </Link>
  )
}
