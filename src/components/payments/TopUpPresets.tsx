"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { getVisibleTopUps, type PlanId } from "@/lib/payments/plans"

interface TopUpPresetsProps {
  /**
   * Called when the user clicks the primary CTA. The selected plan
   * id is one of the visible top-ups. Parent component is
   * responsible for opening CheckoutModal with this id.
   */
  onSelect: (planId: PlanId) => void
  className?: string
}

// Pistons-cost-per-action — must mirror the Pistons Economy Table.
// If you change one, change the other.
// Calibrated so the largest preset (10,000 Pistons / $99) caps at
// 10 reports max — anyone needing more is steered to Rennsport sub.
const PISTONS_PER_REPORT = 1000
const PISTONS_PER_MARKETPLACE = 50
const PISTONS_PER_DEEP_RESEARCH = 250

function formatPistons(n: number): string {
  return n.toLocaleString("en-US")
}

export function TopUpPresets({ onSelect, className = "" }: TopUpPresetsProps) {
  const t = useTranslations()
  const presets = getVisibleTopUps()
  const [selectedId, setSelectedId] = useState<PlanId>(presets[0]?.id ?? "topup_entry")

  const selected = presets.find(p => p.id === selectedId) ?? presets[0]
  if (!selected) return null

  const reports = Math.floor(selected.pistons / PISTONS_PER_REPORT)
  const marketplace = Math.floor(selected.pistons / PISTONS_PER_MARKETPLACE)
  const deepResearch = Math.floor(selected.pistons / PISTONS_PER_DEEP_RESEARCH)

  return (
    <section className={`space-y-4 ${className}`} aria-labelledby="topup-section-title">
      <h2
        id="topup-section-title"
        className="font-display text-[22px] md:text-[28px] font-medium text-foreground"
      >
        {t("pricing.topupSectionTitle")}
      </h2>

      {/* Preset buttons — 1 col mobile, 3 cols desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {presets.map(preset => {
          const isActive = preset.id === selectedId
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={isActive}
              aria-label={`${formatPistons(preset.pistons)} Pistons for $${preset.price}`}
              onClick={() => setSelectedId(preset.id)}
              className={`rounded-2xl border p-4 md:p-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isActive
                  ? "border-primary/60 bg-primary/[0.06] shadow-md shadow-primary/5"
                  : "border-border bg-foreground/[0.02] hover:border-border/80"
              }`}
            >
              {preset.badge && (
                <span className="inline-block text-[9px] font-semibold tracking-[0.18em] uppercase text-primary/85 mb-2">
                  {preset.badge}
                </span>
              )}
              <p className="font-display text-[28px] md:text-[32px] font-medium text-foreground tabular-nums leading-none">
                {formatPistons(preset.pistons)}
              </p>
              <p className="text-[11px] tracking-wide text-muted-foreground mt-1">
                Pistons
              </p>
              <p className="mt-3 font-display text-[20px] font-medium text-primary tabular-nums">
                ${preset.price}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t("pricing.topupNeverExpire")}
              </p>
            </button>
          )
        })}
      </div>

      {/* Equivalence + CTA */}
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-3">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
          {t("pricing.topupSelected")}
        </p>
        <p className="font-display text-[20px] md:text-[24px] font-medium text-foreground">
          {formatPistons(selected.pistons)} Pistons · ${selected.price}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {t("pricing.topupEquivalence", {
            reports: reports,
            marketplace: marketplace,
            deep: deepResearch,
          })}
        </p>
        <button
          type="button"
          onClick={() => onSelect(selected.id)}
          className="w-full h-11 rounded-full bg-primary text-primary-foreground text-[14px] font-semibold hover:bg-primary/85 active:bg-primary/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
        >
          {t("pricing.topupCta")} →
        </button>
      </div>
    </section>
  )
}
