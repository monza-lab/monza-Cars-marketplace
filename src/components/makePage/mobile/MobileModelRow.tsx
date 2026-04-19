"use client"

import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { FileText, Info } from "lucide-react"
import { useCurrency } from "@/lib/CurrencyContext"
import { getSeriesConfig } from "@/lib/brandConfig"
import { platformLabels } from "@/lib/makePageConstants"
import type { Model } from "@/lib/makePageHelpers"

// ─── MOBILE: MODEL ROW (compact) ───
export function MobileModelRow({
  model,
  make,
  onTap,
}: {
  model: Model
  make: string
  onTap: () => void
}) {
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-")
  const { formatPrice } = useCurrency()

  const gradeColor = (g: string) => {
    switch (g) {
      case "AAA": return "text-positive"
      case "AA": return "text-primary"
      default: return "text-muted-foreground"
    }
  }

  // Get platform badge from representative car
  const carPlatform = model.representativeCar.platform
  const platformBadge = carPlatform ? platformLabels[carPlatform] : null

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {/* Thumbnail — links to car detail */}
      <Link
        href={`/cars/${makeSlug}/${model.representativeCar.id}`}
        className="relative w-20 h-14 rounded-xl overflow-hidden shrink-0 bg-card"
      >
        <Image
          src={model.representativeImage}
          alt={model.name}
          fill
          className="object-cover"
          sizes="80px"
        />
        {model.liveCount > 0 && (
          <div className="absolute top-1 left-1 flex items-center gap-1 rounded-full bg-background/80 px-1.5 py-0.5">
            <div className="size-1.5 rounded-full bg-positive animate-pulse" />
            <span className="text-[8px] font-bold text-positive">{model.liveCount}</span>
          </div>
        )}
      </Link>

      {/* Info — links to car detail */}
      <Link
        href={`/cars/${makeSlug}/${model.representativeCar.id}`}
        className="flex-1 min-w-0"
      >
        <p className="text-[14px] font-semibold text-foreground truncate">
          {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {model.years} · {model.carCount} {model.carCount === 1 ? "car" : "cars"}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] tabular-nums text-primary">
            {formatPrice(model.priceMin)} – {formatPrice(model.priceMax)}
          </span>
          {platformBadge && (
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${platformBadge.color}`}>
              {platformBadge.short}
            </span>
          )}
        </div>
      </Link>

      {/* Right — grade + report CTA + context */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10px] font-bold ${gradeColor(model.representativeCar.investmentGrade)}`}>
          {model.representativeCar.investmentGrade}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={`/cars/${makeSlug}/${model.representativeCar.id}/report`}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 active:bg-primary/20 transition-colors"
          >
            <FileText className="size-3 text-primary" />
            <span className="text-[9px] font-semibold text-primary">Report</span>
          </Link>
          <button
            onClick={onTap}
            className="flex items-center gap-1 text-[10px] text-muted-foreground active:text-primary"
          >
            <Info className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
