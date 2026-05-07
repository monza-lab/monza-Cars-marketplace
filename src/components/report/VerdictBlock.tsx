interface VerdictBlockProps {
  verdict: "BUY" | "WATCH" | "WALK"
  oneLiner: string
  askingUsd: number
  fairValueMidUsd: number
  deltaPercent: number
}

const VERDICT_STYLE: Record<VerdictBlockProps["verdict"], string> = {
  BUY: "bg-positive/15 text-positive border-positive/30",
  WATCH: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  WALK: "bg-destructive/15 text-destructive border-destructive/30",
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`
  return `$${v}`
}

export function VerdictBlock({
  verdict,
  oneLiner,
  askingUsd,
  fairValueMidUsd,
  deltaPercent,
}: VerdictBlockProps) {
  const deltaStr =
    Math.abs(deltaPercent) < 0.5
      ? "at fair" // [HARDCODED]
      : `${deltaPercent > 0 ? "+" : ""}${deltaPercent.toFixed(1)}%`

  return (
    <section aria-labelledby="verdict-label" className="px-4 py-6 md:py-8">
      <div className="flex flex-col items-center text-center">
        <span id="verdict-label" className="sr-only">
          {/* [HARDCODED] */}Verdict
        </span>
        <span
          className={`inline-flex items-center rounded-full border-2 px-6 py-2 text-[18px] font-bold tracking-wider md:text-[22px] ${VERDICT_STYLE[verdict]}`}
        >
          {verdict}
        </span>
        <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground md:text-[14px]">
          {oneLiner}
        </p>
      </div>

      <dl className="mx-auto mt-6 grid max-w-lg grid-cols-3 gap-2 border-t border-border pt-4 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{/* [HARDCODED] */}Asking</dt>
          <dd className="mt-1 font-mono text-[14px] font-semibold md:text-[16px]">
            {fmtUsd(askingUsd)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{/* [HARDCODED] */}Fair Value</dt>
          <dd className="mt-1 font-mono text-[14px] font-semibold md:text-[16px]">
            {fmtUsd(fairValueMidUsd)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{/* [HARDCODED] */}Delta</dt>
          <dd className="mt-1 font-mono text-[14px] font-semibold md:text-[16px]">{deltaStr}</dd>
        </div>
      </dl>
    </section>
  )
}
