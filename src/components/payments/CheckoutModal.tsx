"use client"

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { getPricingPlan, type PlanId } from "@/lib/payments/plans"
import { Shield, Lock, Loader2 } from "lucide-react"
import { track } from "@/lib/analytics/events"
import { fireMetaEvent } from "@/lib/marketing/metaPixel"

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
  const locale = useLocale()

  const plan = planId ? getPricingPlan(planId) : null
  const showPackUpsell = plan?.id === "fuel_cell"

  useEffect(() => {
    if (open && showPackUpsell) {
        track({
          event: "upsell_shown",
          payload: { context: "pack_modal", fromPlan: "fuel_cell", toPlan: "rennsport" },
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
    fireMetaEvent("InitiateCheckout", {
      pixelParams: {
        value: plan.price,
        currency: "USD",
        content_ids: [plan.id],
        content_type: "product",
        content_name: plan.name,
      },
      customData: {
        value: plan.price,
        currency: "USD",
        content_ids: [plan.id],
      },
    })
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: plan.id, locale }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) {
        // Dev-mode fallback: when the backend endpoint is not yet implemented
        // (or returns an error), navigate to a local preview of the Stripe-style
        // card form so the full checkout UX can be reviewed end-to-end.
        const isLocal =
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1")
        if (isLocal) {
          const prefix = locale === "en" ? "" : `/${locale}`
          window.location.href = `${prefix}/checkout/payment?plan=${plan.id}`
          return
        }
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
      payload: { context: "pack_modal", fromPlan: "fuel_cell", toPlan: "rennsport" },
    })
    onSwitchPlan("rennsport")
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
              ? "Unlimited reports · deep research reserve · export"
              : plan.reports === 1
              ? "1 report · never expires"
              : `${plan.reports} reports · never expire`}
          </DialogDescription>
        </DialogHeader>

        {showPackUpsell && onSwitchPlan && (
          <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4 mt-2">
            <p className="text-[12px] text-foreground mb-2">
              💡 By $30 more, <strong>Rennsport ($59)</strong> gives you{" "}
              <strong>unlimited reports + a 10,000 Pistons allowance</strong>.
              Two Fuel Cells cost more than the monthly plan.
            </p>
            <button
              onClick={handleSwitchToMonthly}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Switch to Rennsport →
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
