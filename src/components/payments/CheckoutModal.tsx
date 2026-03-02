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
      <DialogContent className="bg-[#0F1012] border-white/10 text-[#FFFCF7] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold text-[#FFFCF7]">
            Checkout
          </DialogTitle>
          <DialogDescription className="text-[#6B7280] text-[13px]">
            Complete your purchase to unlock analysis reports
          </DialogDescription>
        </DialogHeader>

        {/* Plan summary */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[14px] font-semibold text-[#FFFCF7]">
              {plan.name}
            </h4>
            {plan.badge && (
              <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 bg-[#F8B4D9] text-[#0b0b10] rounded-full font-bold">
                {plan.badge}
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#9CA3AF] mb-3">
            {plan.credits === "unlimited"
              ? "Unlimited analysis reports"
              : `${plan.credits} analysis credits`}
          </p>
          <div className="flex items-baseline justify-between pt-3 border-t border-white/5">
            <span className="text-[12px] text-[#6B7280]">Total</span>
            <div>
              <span className="text-xl font-bold text-[#FFFCF7]">
                ${plan.price}
              </span>
              <span className="text-[11px] text-[#6B7280] ml-1">
                {plan.period === "monthly" ? "/mo" : " USD"}
              </span>
            </div>
          </div>
        </div>

        {/* Payment method placeholder */}
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-5 mt-1">
          <div className="flex items-center gap-3 mb-3">
            <CreditCard className="size-5 text-[#6B7280]" />
            <span className="text-[13px] font-medium text-[#9CA3AF]">
              Payment Method
            </span>
          </div>
          <div className="flex items-center justify-center py-4 rounded-lg bg-white/[0.02] border border-white/5">
            <Lock className="size-4 text-[#4B5563] mr-2" />
            <span className="text-[12px] text-[#4B5563]">
              Stripe integration — coming soon
            </span>
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={() => onConfirm(plan.id)}
          className="w-full py-3.5 rounded-xl bg-[#F8B4D9] text-[#0b0b10] text-[14px] font-semibold hover:bg-[#f4cbde] transition-colors mt-1"
        >
          Complete Purchase — ${plan.price}
        </button>

        {/* Trust signals */}
        <div className="flex items-center justify-center gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <Shield className="size-3 text-[#4B5563]" />
            <span className="text-[10px] text-[#4B5563]">Secure checkout</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <span className="text-[10px] text-[#4B5563]">
            30-day money-back guarantee
          </span>
          {plan.period === "monthly" && (
            <>
              <div className="w-px h-3 bg-white/10" />
              <span className="text-[10px] text-[#4B5563]">Cancel anytime</span>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
