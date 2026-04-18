"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Coins, RefreshCw } from "lucide-react"
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
      <div className="rounded-2xl border border-border bg-foreground/2 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
            <Coins className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">
              Credit Balance
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Your available report credits
            </p>
          </div>
        </div>

        {/* Big credit number */}
        <div className="mb-5">
          <span
            className={`text-4xl font-bold ${
              credits > 0 ? "text-primary" : "text-destructive"
            }`}
          >
            {credits}
          </span>
          <span className="text-[15px] text-muted-foreground ml-2">credits</span>
        </div>

        {/* Breakdown */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-[12px] text-muted-foreground">Free Reports</span>
            <span className="text-[12px] text-muted-foreground">
              {freeUsed} of 3 used
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-[12px] text-muted-foreground">
              Purchased Credits
            </span>
            <span className="text-[12px] text-muted-foreground">
              {Math.max(0, credits - (3 - freeUsed))} credits
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[12px] text-muted-foreground">Current Plan</span>
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                tier === "PRO"
                  ? "bg-primary/10 text-primary"
                  : "bg-foreground/5 text-muted-foreground"
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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground/4 border border-border text-[12px] font-medium text-muted-foreground hover:bg-foreground/8 transition-colors"
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => handleSelectPlan("starter")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/80 transition-colors"
          >
            <Coins className="size-3.5" />
            Buy Credits — $12.99
          </button>
        </div>
      </div>

      {/* Upgrade Section */}
      <div className="rounded-2xl border border-border bg-foreground/2 p-6">
        <h3 className="text-[14px] font-semibold text-foreground mb-1">
          Upgrade Your Plan
        </h3>
        <p className="text-[12px] text-muted-foreground mb-6">
          Get more reports with a credit pack or unlimited subscription
        </p>

        {/* Only show Collector + Pro (skip Starter since it's in the buy button above) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRICING_PLANS.filter((p) => p.id !== "starter").map((plan) => (
            <div
              key={plan.id}
              className={`relative p-5 rounded-xl border transition-all ${
                plan.badge
                  ? "border-primary/50 bg-primary/[0.03]"
                  : "border-border bg-foreground/2"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-2.5 right-4 text-[9px] uppercase tracking-wider px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-bold">
                  {plan.badge}
                </span>
              )}
              <h4 className="text-[13px] font-semibold text-foreground mb-1">
                {plan.name}
              </h4>
              <div className="mb-1">
                <span className="text-2xl font-bold text-foreground">
                  ${plan.price}
                </span>
                <span className="text-[11px] text-muted-foreground ml-1">
                  {plan.period === "monthly" ? "/mo" : "one-time"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-4">
                {plan.credits === "unlimited"
                  ? "Unlimited reports/month"
                  : `${plan.credits} reports, never expire`}
              </p>
              <button
                onClick={() => handleSelectPlan(plan.id)}
                className={`w-full py-2.5 rounded-lg text-[12px] font-semibold transition-colors ${
                  plan.badge
                    ? "bg-primary text-primary-foreground hover:bg-primary/80"
                    : "bg-foreground/6 text-foreground border border-border hover:bg-foreground/10"
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
