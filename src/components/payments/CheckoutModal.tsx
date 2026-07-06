"use client"

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { getPricingPlan, type PlanId } from "@/lib/payments/plans"
import { Shield, Lock, Loader2, Check } from "lucide-react"
import { track } from "@/lib/analytics/events"
import { fireMetaEvent } from "@/lib/marketing/metaPixel"
import { useConsent } from "@/components/legal/ConsentProvider"

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
  const { consent } = useConsent()

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
      consent,
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
      <DialogContent
        showCloseButton={false}
        className={[
          "p-0 gap-0 border-border bg-card overflow-hidden flex flex-col",
          "!left-0 !right-0 !bottom-0 !top-auto !translate-x-0 !translate-y-0 !max-w-none !rounded-t-3xl !rounded-b-none max-h-[92dvh]",
          "sm:!left-[50%] sm:!top-[50%] sm:!bottom-auto sm:!right-auto sm:!translate-x-[-50%] sm:!translate-y-[-50%]",
          "sm:!max-w-[460px] sm:!rounded-2xl sm:max-h-[90vh]",
        ].join(" ")}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-foreground/15" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pt-3 sm:pt-7 pb-2">
          {/* Header */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary/80">
              {/* [HARDCODED] */}Checkout
            </p>
            <h2 className="font-display text-[24px] leading-tight font-medium text-foreground mt-1">
              {plan.name}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {plan.reports === "unlimited"
                ? /* [HARDCODED] */ "Unlimited reports · monthly subscription · export"
                : plan.reports === 1
                ? /* [HARDCODED] */ "1 report · never expires"
                : /* [HARDCODED] */ `${plan.reports} reports · never expire`}
            </p>
          </div>

          {/* Upsell box (Pack only) */}
          {showPackUpsell && onSwitchPlan && (
            <div className="mt-5 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary/80 mb-1.5">
                {/* [HARDCODED] */}Better value
              </p>
              <p className="text-[12px] text-foreground leading-relaxed">
                {/* [HARDCODED] */}For less than the heavy reload, <strong>Genshpod ($59/mo)</strong> gives you{" "}
                <strong>unlimited reports</strong> while your subscription is active.
              </p>
              <button
                onClick={handleSwitchToMonthly}
                className="mt-3 text-[12px] font-semibold text-primary hover:underline"
              >
                {/* [HARDCODED] */}Switch to Genshpod →
              </button>
            </div>
          )}

          {/* What's included */}
          <div className="mt-5 rounded-xl border border-border bg-foreground/[0.02] p-4">
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-3">
              {/* [HARDCODED] */}Included
            </p>
            <ul className="space-y-2.5">
              {plan.features.slice(0, 5).map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-[12px] text-foreground/85">
                  <Check className="size-3.5 mt-0.5 shrink-0 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3">
              <p className="text-[12px] text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Sticky footer with total + CTA */}
        <div className="shrink-0 border-t border-border bg-card px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] tracking-[0.15em] uppercase text-muted-foreground">
              {/* [HARDCODED] */}Total
            </span>
            <div>
              <span className="font-display text-[28px] font-medium text-foreground tabular-nums">
                ${plan.price}
              </span>
              <span className="text-[11px] text-muted-foreground ml-1">{priceSuffix}</span>
            </div>
          </div>

          <button
            onClick={goToStripe}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold active:bg-primary/85 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {/* [HARDCODED] */}Redirecting…
              </>
            ) : (
              /* [HARDCODED] */ <>Continue — ${plan.price}{plan.period === "monthly" ? "/mo" : ""}</>
            )}
          </button>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Lock className="size-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {/* [HARDCODED] */}Stripe · Secure
              </span>
            </div>
            <div className="w-px h-3 bg-foreground/10" />
            <div className="flex items-center gap-1.5">
              <Shield className="size-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {/* [HARDCODED] */}30-day refund
              </span>
            </div>
            {plan.period === "monthly" && (
              <>
                <div className="w-px h-3 bg-foreground/10" />
                <span className="text-[10px] text-muted-foreground">
                  {/* [HARDCODED] */}Cancel anytime
                </span>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
