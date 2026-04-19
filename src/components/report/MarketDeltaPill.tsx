interface MarketDeltaPillProps {
  priceUsd: number | null | undefined
  medianUsd: number | null | undefined
  className?: string
}

export function MarketDeltaPill({ priceUsd, medianUsd, className }: MarketDeltaPillProps) {
  if (!priceUsd || !medianUsd || medianUsd <= 0) return null

  const deltaPct = ((priceUsd - medianUsd) / medianUsd) * 100
  const rounded = Math.round(deltaPct)

  if (Math.abs(rounded) <= 2) {
    return (
      <span
        className={`inline-flex items-center rounded-full backdrop-blur-md bg-foreground/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ${className ?? ""}`}
      >
        at median
      </span>
    )
  }

  const isBelow = rounded < 0
  const toneClass = isBelow
    ? "bg-positive/20 text-positive"
    : "bg-amber-500/15 text-amber-600 dark:text-amber-300"

  return (
    <span
      className={`inline-flex items-center rounded-full backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold ${toneClass} ${className ?? ""}`}
    >
      {isBelow ? "" : "+"}
      {rounded}%
    </span>
  )
}
