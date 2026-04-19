"use client"
import { useTranslations } from "next-intl"
import { CheckCircle2, FileText, Database, User, ExternalLink } from "lucide-react"
import type { DetectedSignal, SignalSourceType } from "@/lib/fairValue/types"

interface Props {
  signals: DetectedSignal[]
}

const SOURCE_ICON: Record<SignalSourceType, typeof FileText> = {
  listing_text: FileText,
  structured_field: Database,
  seller_context: User,
  external: ExternalLink,
}

const SOURCE_LABEL: Record<SignalSourceType, string> = {
  listing_text: "Listing text",
  structured_field: "Structured field",
  seller_context: "Seller context",
  external: "External data",
}

export function SignalsDetectedSection({ signals }: Props) {
  const t = useTranslations("report.signalsDetected")

  if (signals.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-2">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold mb-4">{t("title")}</h2>
      <ul className="space-y-3">
        {signals.map((s) => {
          const Icon = SOURCE_ICON[s.evidence.source_type]
          return (
            <li key={s.key} className="flex items-start gap-3">
              <CheckCircle2 className="size-4 text-positive mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{s.value_display}</p>
                {s.evidence.raw_excerpt && (
                  <p className="mt-1 text-xs text-muted-foreground italic">
                    &quot;{s.evidence.raw_excerpt}&quot;
                  </p>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Icon className="size-3" />
                  <span>{SOURCE_LABEL[s.evidence.source_type]}</span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
