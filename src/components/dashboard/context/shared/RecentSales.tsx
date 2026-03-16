"use client"

import { DollarSign } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"

export type SaleEntry = {
  title: string
  price: number
  platform: string
  date: string
}

interface RecentSalesProps {
  sales: SaleEntry[]
}

export function RecentSalesSection({ sales }: RecentSalesProps) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  if (sales.length === 0) return null

  return (
    <div className="px-5 py-4 border-b border-border">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="size-4 text-primary" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {t("brandContext.recentSales")}
        </span>
      </div>
      <div className="space-y-2">
        {sales.map((sale, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground truncate">{sale.title}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{sale.platform} · {sale.date}</p>
            </div>
            <span className="text-[12px] font-mono font-semibold text-foreground shrink-0">
              {formatPriceForRegion(sale.price, selectedRegion)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
