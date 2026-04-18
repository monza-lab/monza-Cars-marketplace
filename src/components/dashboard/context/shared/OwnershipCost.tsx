"use client"

import { Wrench } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCurrency } from "@/lib/CurrencyContext"

interface OwnershipCostProps {
  ownershipCost: {
    insurance: number
    storage: number
    maintenance: number
  }
}

export function OwnershipCostSection({ ownershipCost }: OwnershipCostProps) {
  const t = useTranslations("dashboard")
  const { formatPrice } = useCurrency()

  const totalAnnualCost = ownershipCost.insurance + ownershipCost.storage + ownershipCost.maintenance

  return (
    <div className="px-5 py-4 border-b border-border">
      <div className="flex items-center gap-2 mb-3">
        <Wrench className="size-4 text-primary" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {t("brandContext.annualOwnership")}
        </span>
      </div>
      <div className="space-y-2">
        {[
          { label: t("brandContext.insurance"), value: ownershipCost.insurance },
          { label: t("brandContext.storage"), value: ownershipCost.storage },
          { label: t("brandContext.maintenance"), value: ownershipCost.maintenance },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{item.label}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{formatPrice(item.value)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
          <span className="text-[11px] font-medium text-foreground">{t("brandContext.total")}</span>
          <span className="text-[12px] font-display font-medium text-primary">{formatPrice(totalAnnualCost)}{t("brandContext.perYear")}</span>
        </div>
      </div>
    </div>
  )
}
