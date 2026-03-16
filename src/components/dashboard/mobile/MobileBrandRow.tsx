"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { Car, ChevronRight } from "lucide-react"
import { SafeImage } from "../cards/SafeImage"
import type { Brand } from "../types"

export function MobileBrandRow({ brand }: { brand: Brand }) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  return (
    <Link
      href={`/cars/${brand.slug}`}
      className="flex items-center gap-4 px-4 py-3.5 active:bg-foreground/3 transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-14 rounded-xl overflow-hidden shrink-0 bg-card">
        <SafeImage
          src={brand.representativeImage}
          alt={brand.name}
          fill
          className="object-cover"
          sizes="80px"
          loading="lazy"
          referrerPolicy="no-referrer"
          unoptimized
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <Car className="size-5 text-muted-foreground" />
            </div>
          }
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-foreground truncate">
          {brand.name}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {t("mobileFeed.vehicles", { count: brand.carCount })}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] font-mono text-primary">
            {formatPriceForRegion(brand.priceMin, selectedRegion)} – {formatPriceForRegion(brand.priceMax, selectedRegion)}
          </span>
          <span className="text-[10px] text-positive font-medium">{brand.avgTrend}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10px] font-bold ${
          brand.topGrade === "AAA"
            ? "text-emerald-400"
            : brand.topGrade === "AA"
              ? "text-primary"
              : "text-muted-foreground"
        }`}>
          {brand.topGrade}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  )
}
