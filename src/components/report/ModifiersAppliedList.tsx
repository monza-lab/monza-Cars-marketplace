"use client"
import { useTranslations } from "next-intl"
import { ExternalLink } from "lucide-react"
import type { AppliedModifier } from "@/lib/fairValue/types"

interface Props {
  modifiers: AppliedModifier[]
}

export function ModifiersAppliedList({ modifiers }: Props) {
  const t = useTranslations("report.fairValue")
  const tMod = useTranslations("report.modifiers")

  if (modifiers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground italic">{t("noModifiers")}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border">
      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t("modifiersTitle")}
      </div>
      {modifiers.map((m) => {
        const sign = m.delta_percent > 0 ? "+" : ""
        const tone = m.delta_percent > 0 ? "text-positive" : "text-destructive"
        return (
          <div key={m.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {tMod(`${m.key}.name`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {tMod(`${m.key}.description`)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className={`text-sm font-bold ${tone}`}>
                {sign}{m.delta_percent}%
              </span>
              {m.citation_url && (
                <a
                  href={m.citation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                >
                  source <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
