"use client"
import { useTranslations } from "next-intl"
import { HelpCircle } from "lucide-react"
import type { MissingSignal } from "@/lib/fairValue/types"

interface Props {
  signals: MissingSignal[]
}

export function SignalsMissingSection({ signals }: Props) {
  const t = useTranslations("report.signalsMissing")
  const tQuestions = useTranslations("report.questions")

  if (signals.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-2">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
      <h2 className="text-lg font-semibold mb-1">{t("title")}</h2>
      <p className="text-xs text-muted-foreground mb-4">{t("subtitle")}</p>
      <ul className="space-y-2">
        {signals.map((s) => {
          // question_for_seller_i18n_key is "report.questions.<key>" — strip prefix
          const qKey = s.question_for_seller_i18n_key.replace(/^report\.questions\./, "")
          return (
            <li key={s.key} className="flex items-start gap-3">
              <HelpCircle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">{tQuestions(qKey)}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
