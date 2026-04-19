"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { PRICING_PLANS, type PlanId } from "./PricingCards"
import { Shield, Lock, Loader2 } from "lucide-react"
import { track } from "@/lib/analytics/events"

interface CheckoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: PlanId | null
  onSwitchPlan?: (planId: PlanId) => void
}

export function CheckoutModal({
  open,
  onOpenChange,
  planId,
  onSwitchPlan,
}: CheckoutModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plan = planId ? PRICING_PLANS[planId] : null
  const showPackUpsell = plan?.id === "pack"

  useEffect(() => {
    if (open && showPackUpsell) {
      track({
        event: "upsell_shown",
        payload: { context: "pack_modal", fromPlan: "pack", toPlan: "monthly" },
      })
    }
  }, [open, showPackUpsell])

  if (!plan) return null

  const goToStripe = async () => {
    setLoading(true)
    setError(null)
    track({
      event: "checkout_started",
      payload: { planId: plan.id, amount: plan.price, sessionId: "" },
    })
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: plan.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Failed to start checkout")
      }
      window.location.href = json.url
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  const handleSwitchToMonthly = () => {
    if (!onSwitchPlan) return
    track({
      event: "upsell_converted",
      payload: { context: "pack_modal", fromPlan: "pack", toPlan: "monthly" },
    })
    onSwitchPlan("monthly")
  }

  const priceSuffix = plan.period === "monthly" ? "/mo" : "USD"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold text-foreground">
            {plan.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">
            {plan.reports === "unlimited"
              ? "Unlimited Reports · Watchlist · Alerts · Export"
              : plan.reports === 1
              ? "1 Report · never expires"
              : `${plan.reports} Reports · never expire`}
          </DialogDescription>
        </DialogHeader>

        {showPackUpsell && onSwitchPlan && (
          <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4 mt-2">
            <p className="text-[12px] text-foreground mb-2">
              💡 By $20 more, <strong>Monthly ($59)</strong> gives you{" "}
              <strong>unlimited Reports + Watchlist + Alerts + Export</strong>.
              Two packs would cost you $78 — Monthly costs less.
            </p>
            <button
              onClick={handleSwitchToMonthly}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Switch to Monthly →
            </button>
          </div>
        )}

        <div className="rounded-xl border border-border bg-foreground/2 p-4 mt-1">
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-[12px] text-muted-foreground">Total</span>
            <div>
              <span className="text-xl font-bold text-foreground">${plan.price}</span>
              <span className="text-[11px] text-muted-foreground ml-1">{priceSuffix}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 mt-1">
            <p className="text-[12px] text-destructive">{error}</p>
          </div>
        )}

        <button
          onClick={goToStripe}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold hover:bg-primary/80 transition-colors mt-1 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Redirecting to Stripe…
            </>
          ) : (
            <>Continue to Payment — ${plan.price}</>
          )}
        </button>

        <div className="flex items-center justify-center gap-4 mt-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Lock className="size-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Secure · Stripe</span>
          </div>
          <div className="w-px h-3 bg-foreground/10" />
          <div className="flex items-center gap-1.5">
            <Shield className="size-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">30-day refund</span>
          </div>
          {plan.period === "monthly" && (
            <>
              <div className="w-px h-3 bg-foreground/10" />
              <span className="text-[10px] text-muted-foreground">Cancel anytime</span>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
