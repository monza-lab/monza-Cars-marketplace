"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Zap, RefreshCw } from "lucide-react"
import { PricingCards, type PlanId, PRICING_PLANS } from "./PricingCards"
import { CheckoutModal } from "./CheckoutModal"
import { TransactionHistory } from "./TransactionHistory"

export function BillingDashboard() {
  const { profile, refreshProfile } = useAuth()
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const credits = profile?.creditsBalance ?? 0
  const tier = profile?.tier ?? "FREE"
  const freeUsed = profile?.freeCreditsUsed ?? 0

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshProfile()
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleSelectPlan = (planId: PlanId) => {
    setCheckoutPlan(planId)
  }

  const handleConfirmPurchase = (planId: PlanId) => {
    // TODO: Backend will replace with Stripe createCheckoutSession()
    console.log("[Checkout] Plan selected:", planId)
    setCheckoutPlan(null)
  }

  return (
    <div className="space-y-6">
      {/* Credit Balance Card */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center size-8 rounded-lg bg-[#F8B4D9]/10">
            <Zap className="size-4 text-[#F8B4D9]" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#FFFCF7]">
              Credit Balance
            </h3>
            <p className="text-[11px] text-[#6B7280]">
              Your available report credits
            </p>
          </div>
        </div>

        {/* Big credit number */}
        <div className="mb-5">
          <span
            className={`text-4xl font-bold ${
              credits > 0 ? "text-[#F8B4D9]" : "text-[#FB923C]"
            }`}
          >
            {credits}
          </span>
          <span className="text-[15px] text-[#6B7280] ml-2">credits</span>
        </div>

        {/* Breakdown */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-[12px] text-[#9CA3AF]">Free Reports</span>
            <span className="text-[12px] text-[#D1D5DB]">
              {freeUsed} of 3 used
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-[12px] text-[#9CA3AF]">
              Purchased Credits
            </span>
            <span className="text-[12px] text-[#D1D5DB]">
              {Math.max(0, credits - (3 - freeUsed))} credits
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[12px] text-[#9CA3AF]">Current Plan</span>
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                tier === "PRO"
                  ? "bg-[#F8B4D9]/10 text-[#F8B4D9]"
                  : "bg-white/5 text-[#6B7280]"
              }`}
            >
              {tier}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-[12px] font-medium text-[#D1D5DB] hover:bg-white/[0.08] transition-colors"
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => handleSelectPlan("starter")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F8B4D9] text-[#0b0b10] text-[12px] font-semibold hover:bg-[#f4cbde] transition-colors"
          >
            <Zap className="size-3.5" />
            Buy Credits — $12.99
          </button>
        </div>
      </div>

      {/* Upgrade Section */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h3 className="text-[14px] font-semibold text-[#FFFCF7] mb-1">
          Upgrade Your Plan
        </h3>
        <p className="text-[12px] text-[#6B7280] mb-6">
          Get more reports with a credit pack or unlimited subscription
        </p>

        {/* Only show Collector + Pro (skip Starter since it's in the buy button above) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRICING_PLANS.filter((p) => p.id !== "starter").map((plan) => (
            <div
              key={plan.id}
              className={`relative p-5 rounded-xl border transition-all ${
                plan.badge
                  ? "border-[#F8B4D9]/50 bg-[#F8B4D9]/[0.03]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-2.5 right-4 text-[9px] uppercase tracking-wider px-2 py-0.5 bg-[#F8B4D9] text-[#0b0b10] rounded-full font-bold">
                  {plan.badge}
                </span>
              )}
              <h4 className="text-[13px] font-semibold text-[#FFFCF7] mb-1">
                {plan.name}
              </h4>
              <div className="mb-1">
                <span className="text-2xl font-bold text-[#FFFCF7]">
                  ${plan.price}
                </span>
                <span className="text-[11px] text-[#6B7280] ml-1">
                  {plan.period === "monthly" ? "/mo" : "one-time"}
                </span>
              </div>
              <p className="text-[11px] text-[#9CA3AF] mb-4">
                {plan.credits === "unlimited"
                  ? "Unlimited reports/month"
                  : `${plan.credits} reports, never expire`}
              </p>
              <button
                onClick={() => handleSelectPlan(plan.id)}
                className={`w-full py-2.5 rounded-lg text-[12px] font-semibold transition-colors ${
                  plan.badge
                    ? "bg-[#F8B4D9] text-[#0b0b10] hover:bg-[#f4cbde]"
                    : "bg-white/[0.06] text-[#FFFCF7] border border-white/10 hover:bg-white/10"
                }`}
              >
                {plan.id === "pro" ? "Subscribe" : "Buy Now"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <TransactionHistory />

      {/* Checkout Modal */}
      <CheckoutModal
        open={checkoutPlan !== null}
        onOpenChange={(open) => !open && setCheckoutPlan(null)}
        planId={checkoutPlan}
        onConfirm={handleConfirmPurchase}
      />
    </div>
  )
}
