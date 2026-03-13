"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { PRICING_PLANS, type PlanId } from "./PricingCards"
import { Shield, Lock, CreditCard } from "lucide-react"

interface CheckoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: PlanId | null
  onConfirm: (planId: PlanId) => void
}

export function CheckoutModal({
  open,
  onOpenChange,
  planId,
  onConfirm,
}: CheckoutModalProps) {
  const plan = PRICING_PLANS.find((p) => p.id === planId)

  if (!plan) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold text-foreground">
            Checkout
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">
            Complete your purchase to unlock analysis reports
          </DialogDescription>
        </DialogHeader>

        {/* Plan summary */}
        <div className="rounded-xl border border-border bg-foreground/2 p-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[14px] font-semibold text-foreground">
              {plan.name}
            </h4>
            {plan.badge && (
              <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-bold">
                {plan.badge}
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground mb-3">
            {plan.credits === "unlimited"
              ? "Unlimited analysis reports"
              : `${plan.credits} analysis credits`}
          </p>
          <div className="flex items-baseline justify-between pt-3 border-t border-border">
            <span className="text-[12px] text-muted-foreground">Total</span>
            <div>
              <span className="text-xl font-bold text-foreground">
                ${plan.price}
              </span>
              <span className="text-[11px] text-muted-foreground ml-1">
                {plan.period === "monthly" ? "/mo" : " USD"}
              </span>
            </div>
          </div>
        </div>

        {/* Payment method placeholder */}
        <div className="rounded-xl border border-dashed border-border bg-white/[0.01] p-5 mt-1">
          <div className="flex items-center gap-3 mb-3">
            <CreditCard className="size-5 text-muted-foreground" />
            <span className="text-[13px] font-medium text-muted-foreground">
              Payment Method
            </span>
          </div>
          <div className="flex items-center justify-center py-4 rounded-lg bg-foreground/2 border border-border">
            <Lock className="size-4 text-muted-foreground mr-2" />
            <span className="text-[12px] text-muted-foreground">
              Stripe integration — coming soon
            </span>
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={() => onConfirm(plan.id)}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold hover:bg-primary/80 transition-colors mt-1"
        >
          Complete Purchase — ${plan.price}
        </button>

        {/* Trust signals */}
        <div className="flex items-center justify-center gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <Shield className="size-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Secure checkout</span>
          </div>
          <div className="w-px h-3 bg-foreground/10" />
          <span className="text-[10px] text-muted-foreground">
            30-day money-back guarantee
          </span>
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
