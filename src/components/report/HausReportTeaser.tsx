"use client"
import { useTranslations } from "next-intl"
import { FileText } from "lucide-react"

interface Props {
  reportExists: boolean
  userAlreadyPaid: boolean
  fairValueLowUsd?: number | null
  fairValueHighUsd?: number | null
  comparablesCount?: number | null
  onClick: () => void
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function HausReportTeaser({
  reportExists,
  userAlreadyPaid,
  fairValueLowUsd,
  fairValueHighUsd,
  comparablesCount,
  onClick,
}: Props) {
  const t = useTranslations("report.hausReport")
  const cta = userAlreadyPaid ? t("ctaView") : t("ctaGenerate")
  const hasFairValue = Boolean(
    reportExists
      && fairValueLowUsd
      && fairValueHighUsd
      && fairValueLowUsd > 0
      && fairValueHighUsd >= fairValueLowUsd,
  )

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 flex items-start gap-4">
      <div className="shrink-0 rounded-lg bg-primary/10 p-2">
        <FileText className="size-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{t("available")}</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t("teaserBody")}</p>
        {reportExists && !userAlreadyPaid && (
          <p className="mt-2 text-[10px] text-muted-foreground uppercase tracking-wider">{t("cached")}</p>
        )}
        {hasFairValue && (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fair value</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                {formatUsd(fairValueLowUsd!)}–{formatUsd(fairValueHighUsd!)}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Evidence</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {(comparablesCount ?? 0).toLocaleString("en-US")} verified comparables
              </p>
            </div>
          </div>
        )}
        <button
          onClick={onClick}
          className="mt-3 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {cta}
        </button>
      </div>
    </div>
  )
}
