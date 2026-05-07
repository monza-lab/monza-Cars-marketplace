"use client"

import type { ColorIntelligence } from "@/lib/fairValue/types"

interface ColorIntelBlockProps {
  colorIntel: ColorIntelligence | null | undefined
}

// [HARDCODED] all rarity labels below
const RARITY_LABELS: Record<string, { label: string; color: string }> = {
  common: { label: "Common", color: "text-muted-foreground" },
  uncommon: { label: "Uncommon", color: "text-amber-600" },
  rare: { label: "Rare", color: "text-orange-500" },
  very_rare: { label: "Very Rare", color: "text-red-500" },
  unique: { label: "Unique", color: "text-purple-500" },
  unknown: { label: "Unknown", color: "text-muted-foreground" },
}

export function ColorIntelBlock({ colorIntel }: ColorIntelBlockProps) {
  if (!colorIntel || !colorIntel.exteriorColorName) return null

  const rarity = RARITY_LABELS[colorIntel.exteriorRarity] ?? RARITY_LABELS.unknown

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-serif text-[15px] font-semibold">{/* [HARDCODED] */}Color Intelligence</h3>

      <div className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <p className="text-muted-foreground">{/* [HARDCODED] */}Exterior</p>
          <p className="font-medium">
            {colorIntel.exteriorColorName}
            {colorIntel.exteriorColorCode && (
              <span className="ml-1 text-muted-foreground">({colorIntel.exteriorColorCode})</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{/* [HARDCODED] */}Interior</p>
          <p className="font-medium">{colorIntel.interiorColorName ?? "Not specified" /* [HARDCODED] */}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[13px]">
        <span className={`font-semibold ${rarity.color}`}>{rarity.label}</span>
        {colorIntel.isPTS && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            {/* [HARDCODED] */}Paint-to-Sample
          </span>
        )}
        {colorIntel.exteriorValuePremiumPercent > 0 && (
          <span className="text-green-600 dark:text-green-400 font-medium">
            {/* [HARDCODED] */}+{colorIntel.exteriorValuePremiumPercent}% color premium
          </span>
        )}
      </div>

      {colorIntel.combinationNote && (
        <p className="text-[12px] text-muted-foreground italic">{colorIntel.combinationNote}</p>
      )}
    </section>
  )
}
