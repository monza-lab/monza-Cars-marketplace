"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Piston } from "@/components/icons/Piston"
import { CheckoutModal } from "./CheckoutModal"
import { Link } from "@/i18n/navigation"
import { PRICING_PLANS, type PlanId } from "@/lib/payments/plans"

interface OutOfPistonsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** How many Pistons the action requires (e.g. 1,000 for a report). */
  neededPistons: number
  /** Current Pistons balance of the user. */
  currentBalance: number
}

function formatPistons(n: number): string {
  return n.toLocaleString("en-US")
}

export function OutOfPistonsModal({
  open,
  onOpenChange,
  neededPistons,
  currentBalance,
}: OutOfPistonsModalProps) {
  const t = useTranslations("outOfPistons")
  // Pre-select the smallest top-up as the "buy now" path.
  const defaultTopUp = PRICING_PLANS.topup_entry
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border text-foreground max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3">
            <div className="inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 mb-3">
              <Piston className="size-5 text-primary" />
            </div>
            <DialogTitle className="text-[17px] font-bold text-foreground leading-snug">
              {t("title", { needed: neededPistons, have: currentBalance })}
            </DialogTitle>
            <DialogDescription className="sr-only">
              You need more Pistons to continue. Quick top-up below or see all plans.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-3">
            <button
              type="button"
              onClick={() => setCheckoutPlan(defaultTopUp.id)}
              className="w-full text-left rounded-2xl border border-primary/40 bg-primary/[0.04] p-4 hover:bg-primary/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[18px] font-medium text-foreground">
                    {t("topupTitle", { pistons: formatPistons(defaultTopUp.pistons) })}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t("topupHint", { price: defaultTopUp.price })}
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center justify-center h-9 px-4 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold">
                  {t("topupCta")} →
                </span>
              </div>
            </button>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/80">{t("tipPrefix")}</span>{" "}
              {t("tipBody")}{" "}
              <Link
                href="/pricing"
                onClick={() => onOpenChange(false)}
                className="text-primary underline underline-offset-2"
              >
                {t("seePlans")} →
              </Link>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Checkout — opens inside the same flow so the user
          isn't redirected to /pricing. After payment success the
          dialog auto-closes and the parent re-checks balance. */}
      <CheckoutModal
        open={checkoutPlan !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCheckoutPlan(null)
            onOpenChange(false)
          }
        }}
        planId={checkoutPlan}
        onSwitchPlan={(p) => setCheckoutPlan(p)}
      />
    </>
  )
}
