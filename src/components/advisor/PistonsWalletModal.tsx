"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { Piston } from "@/components/icons/Piston"
import { useTranslations } from "next-intl"

export type UserTier = "FREE" | "PRO"

export interface PistonsWalletDebit {
  amount: number
  label: string
  surface: "chat" | "oracle" | "report" | "deep_research"
  conversationHref?: string
  timestamp: Date
}

export interface GraceUsage {
  instantUsed: number
  instantTotal: number
  marketplaceUsed: number
  marketplaceTotal: number
}

export interface PistonsWalletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: number
  tier: UserTier
  nextResetDate: Date
  todayUsage: { chat: number; oracle: number; report: number }
  graceUsage: GraceUsage | null
  recentDebits: PistonsWalletDebit[]
  onClose: () => void
  onUpgrade?: () => void
  onTopUp?: () => void
}

export function PistonsWalletModal(props: PistonsWalletModalProps) {
  const t = useTranslations("auth.pistons")
  if (!props.open) return null
  const isFree = props.tier === "FREE"

  return (
    <AnimatePresence>
      <motion.div
        key="pistons-wallet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={props.onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
      />
      <motion.div
        key="pistons-wallet-panel"
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        className="fixed top-20 right-6 w-[360px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl z-[9999] overflow-hidden"
        role="dialog"
        aria-label={t("walletTitle")}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-[13px] font-semibold">{t("walletTitle")}</h3>
          <button onClick={props.onClose} className="size-7 rounded-md hover:bg-foreground/5 flex items-center justify-center">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-1">
            <Piston className="size-5 text-primary" />
            <span className="text-[22px] font-display text-foreground">{props.balance.toLocaleString()}</span>
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground">{props.tier}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("nextReset", { date: props.nextResetDate.toLocaleDateString() })}</p>
        </div>

        <div className="px-5 pb-4 border-t border-border/60 pt-3">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-2">{t("todayUsage")}</p>
          <div className="space-y-1 text-[12px]">
            <div className="flex justify-between"><span>Advisor chat</span><span className="tabular-nums">{props.todayUsage.chat}</span></div>
            <div className="flex justify-between"><span>Oracle answers</span><span className="tabular-nums">{props.todayUsage.oracle}</span></div>
            <div className="flex justify-between"><span>Reports</span><span className="tabular-nums">{props.todayUsage.report}</span></div>
          </div>
        </div>

        {isFree && props.graceUsage && (
          <div className="px-5 pb-4 text-[11px] text-muted-foreground">
            {t("graceRemaining", { used: props.graceUsage.instantUsed, total: props.graceUsage.instantTotal, tier: "Instant" })} ·{" "}
            {t("graceRemaining", { used: props.graceUsage.marketplaceUsed, total: props.graceUsage.marketplaceTotal, tier: "Marketplace" })}
          </div>
        )}

        {props.recentDebits.length > 0 && (
          <div className="px-5 pb-4 border-t border-border/60 pt-3">
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-2">{t("recentDebits")}</p>
            <ul className="space-y-1.5 text-[12px]">
              {props.recentDebits.slice(0, 10).map((d, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate text-foreground/80">-{d.amount} · {d.label}</span>
                  {d.conversationHref
                    ? <a href={d.conversationHref} className="text-primary text-[10px] shrink-0">open</a>
                    : <span className="text-[10px] text-muted-foreground shrink-0">{d.surface}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="px-5 py-3 border-t border-border/60 flex items-center gap-2">
          {isFree
            ? <button onClick={props.onUpgrade} className="flex-1 rounded-lg bg-primary/15 border border-primary/25 px-3 py-2 text-[12px] font-medium text-primary hover:bg-primary/25">{t("upgradeCta")}</button>
            : <button onClick={props.onTopUp} className="flex-1 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-[12px] font-medium text-primary hover:bg-primary/20">{t("topUp")}</button>}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
