"use client"

import { useId } from "react"
import { useTranslations } from "next-intl"
import { MessageCircle, Search, Layers, FileText } from "lucide-react"

interface PistonsEconomyTableProps {
  /**
   * `full` is used inside /pricing — larger type, more breathing room.
   * `compact` is used inside the PistonsWalletModal — denser, single
   * line per row. Both render the same 4 rows so the user sees the
   * same mental model anywhere they look.
   */
  variant: "full" | "compact"
  className?: string
}

interface Row {
  icon: typeof MessageCircle
  labelKey: string
  cost: string
}

const ROWS: Row[] = [
  { icon: MessageCircle, labelKey: "pricing.economyChat",         cost: "1 Piston" },
  { icon: Search,        labelKey: "pricing.economyMarketplace",  cost: "~5 Pistons" },
  { icon: Layers,        labelKey: "pricing.economyDeepResearch", cost: "~25 Pistons" },
  { icon: FileText,      labelKey: "pricing.economyReport",       cost: "100 Pistons" },
]

export function PistonsEconomyTable({ variant, className = "" }: PistonsEconomyTableProps) {
  const t = useTranslations()
  const isFull = variant === "full"
  const headingId = useId()

  return (
    <section
      aria-labelledby={headingId}
      className={`${className} ${
        isFull
          ? "rounded-2xl border border-border bg-foreground/[0.02] p-5 md:p-6"
          : "rounded-xl border border-border bg-foreground/[0.02] p-3"
      }`}
    >
      <h3
        id={headingId}
        className={`font-semibold tracking-[0.22em] uppercase text-muted-foreground ${
          isFull ? "text-[11px] mb-4" : "text-[9px] mb-2"
        }`}
      >
        {t("pricing.economyTitle")}
      </h3>
      <ul className={isFull ? "space-y-3" : "space-y-1.5"}>
        {ROWS.map((row, i) => {
          const Icon = row.icon
          return (
            <li
              key={i}
              className={`flex items-center justify-between gap-3 ${
                isFull ? "text-[14px]" : "text-[11px]"
              }`}
            >
              <span className="flex items-center gap-2.5 text-foreground/85">
                <Icon
                  className={`${isFull ? "size-4" : "size-3"} text-primary shrink-0`}
                  aria-hidden="true"
                />
                {t(row.labelKey)}
              </span>
              <span
                className={`tabular-nums font-medium text-foreground ${
                  isFull ? "text-[13px]" : "text-[11px]"
                }`}
              >
                {row.cost}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
