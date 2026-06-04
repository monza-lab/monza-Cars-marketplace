"use client"

import { useTranslations } from "next-intl"
import { Sparkles } from "lucide-react"
import { getVisibleSubs } from "@/lib/payments/plans"

interface SubRecommendationCardProps {
  onSubscribe: () => void
  className?: string
}

// We intentionally show only the cheapest visible sub. Today that's
// Genshpod; if Edgar later flips Weissach back on, the math still
// surfaces the right card (cheapest first) — but the badge/copy
// assumes Genshpod's value prop (unlimited credits + bundle), so
// flipping more subs visible will need a follow-up.
export function SubRecommendationCard({ onSubscribe, className = "" }: SubRecommendationCardProps) {
  const t = useTranslations()
  const subs = getVisibleSubs()
  const sub = subs[0]
  if (!sub) return null

  return (
    <section className={`space-y-4 ${className}`} aria-labelledby="sub-section-title">
      <h2
        id="sub-section-title"
        className="font-display text-[20px] md:text-[24px] font-medium text-foreground"
      >
        {t("pricing.subSectionTitle")}
      </h2>

      <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/[0.06] to-transparent p-5 md:p-6 shadow-lg shadow-primary/5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <p className="font-display text-[22px] md:text-[26px] font-medium text-foreground">
                {sub.name}
              </p>
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.18em] uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                <Sparkles className="size-2.5" aria-hidden="true" />
                {t("pricing.subBadgeMostPopular")}
              </span>
            </div>
            <p className="font-display text-[28px] md:text-[32px] font-medium text-primary tabular-nums leading-none">
              ${sub.price}
              <span className="text-[14px] text-muted-foreground ml-1">/mo</span>
            </p>
            <p className="text-[13px] text-foreground/85 mt-3">
              {t("pricing.subFeatures")}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("pricing.subCancelAnytime")}
            </p>
          </div>
          <button
            type="button"
            onClick={onSubscribe}
            className="shrink-0 h-11 px-6 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/85 active:bg-primary/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
          >
            {t("pricing.subCta")} →
          </button>
        </div>
      </div>
    </section>
  )
}
