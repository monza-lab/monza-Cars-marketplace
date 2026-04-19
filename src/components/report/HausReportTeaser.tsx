"use client"
import { useTranslations } from "next-intl"
import { FileText } from "lucide-react"

interface Props {
  reportExists: boolean
  userAlreadyPaid: boolean
  onClick: () => void
}

export function HausReportTeaser({ reportExists, userAlreadyPaid, onClick }: Props) {
  const t = useTranslations("report.hausReport")
  const cta = reportExists ? t("ctaView") : t("ctaGenerate")

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
