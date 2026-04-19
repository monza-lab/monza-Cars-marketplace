"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { track } from "@/lib/analytics/events"

export type PlanId = "single" | "pack" | "monthly" | "annual"
export type BillingCycle = "monthly" | "annual"

export interface PricingPlan {
  id: PlanId
  name: string
  price: number
  period: "one-time" | "monthly" | "annual"
  reports: number
  perReport: string
  badge?: string
  features: string[]
  cta: string
}

export const PRICING_PLANS: Record<PlanId, PricingPlan> = {
  single: {
    id: "single",
    name: "Single Report",
    price: 29,
    period: "one-time",
    reports: 1,
    perReport: "$29/report",
    features: [
      "1 full investment dossier",
      "10-section analysis",
      "Regional fair value",
      "Never expires",
    ],
    cta: "Buy 1 Report",
  },
  pack: {
    id: "pack",
    name: "Reports Pack",
    price: 99,
    period: "one-time",
    reports: 5,
    perReport: "$19.80/report",
    features: [
      "5 full investment dossiers",
      "Never expires",
      "No Watchlist or Alerts",
    ],
    cta: "Buy 5 Reports",
  },
  monthly: {
    id: "monthly",
    name: "Monthly",
    price: 19,
    period: "monthly",
    reports: 10,
    perReport: "$1.90/report",
    badge: "BEST VALUE",
    features: [
      "10 Reports every month",
      "Watchlist (unlimited saves)",
      "Email Alerts",
      "Saved Searches",
      "Cancel anytime",
    ],
    cta: "Go Monthly",
  },
  annual: {
    id: "annual",
    name: "Annual",
    price: 179,
    period: "annual",
    reports: 10,
    perReport: "$1.49/report",
    features: [
      "Everything in Monthly",
      "Save $49 vs monthly",
      "≈ 2 months free",
      "Cancel anytime",
    ],
    cta: "Go Annual",
  },
}

function PricingCard({
  plan,
  onSelect,
}: {
  plan: PricingPlan
  onSelect: (planId: PlanId) => void
}) {
  const isHighlighted = !!plan.badge

  return (
    <div
      className={`relative flex flex-col p-6 rounded-2xl border transition-all ${
        isHighlighted
          ? "border-primary/50 bg-primary/[0.03] shadow-lg shadow-primary/5"
          : "border-border bg-foreground/2 hover:border-border/80"
      }`}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest px-3 py-1 bg-primary text-primary-foreground rounded-full font-bold">
          {plan.badge}
        </span>
      )}

      <h3 className="text-[15px] font-semibold text-foreground mb-4">{plan.name}</h3>

      <div className="mb-1">
        <span className="text-3xl font-bold text-foreground">${plan.price}</span>
        <span className="text-[13px] text-muted-foreground ml-1">
          {plan.period === "monthly" ? "/mo" : plan.period === "annual" ? "/yr" : "one-time"}
        </span>
      </div>

      <span className="text-[11px] text-primary font-medium mb-4">{plan.perReport}</span>

      <p className="text-[12px] text-muted-foreground mb-6">
        {plan.period === "one-time"
          ? `${plan.reports} Reports, never expire`
          : `${plan.reports} Reports per month`}
      </p>

      <ul className="flex-1 space-y-3 mb-6">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check
              className={`size-4 mt-0.5 shrink-0 ${
                isHighlighted ? "text-primary" : "text-positive"
              }`}
            />
            <span className="text-[12px] text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => {
          track({ event: "plan_clicked", payload: { planId: plan.id } })
          onSelect(plan.id)
        }}
        className={`w-full py-3 rounded-xl text-[13px] font-semibold transition-all ${
          isHighlighted
            ? "bg-primary text-primary-foreground hover:bg-primary/80"
            : "bg-foreground/6 text-foreground border border-border hover:bg-foreground/10"
        }`}
      >
        {plan.cta}
      </button>
    </div>
  )
}

export function PricingCards({
  onSelectPlan,
}: {
  onSelectPlan: (planId: PlanId) => void
}) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly")

  const subscriptionPlan = cycle === "monthly" ? PRICING_PLANS.monthly : PRICING_PLANS.annual

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-8">
        <button
          onClick={() => setCycle("monthly")}
          className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-colors ${
            cycle === "monthly"
              ? "bg-primary text-primary-foreground"
              : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setCycle("annual")}
          className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-colors ${
            cycle === "annual"
              ? "bg-primary text-primary-foreground"
              : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
          }`}
        >
          Annual <span className="text-[10px] opacity-70 ml-1">(save $49)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PricingCard plan={PRICING_PLANS.single} onSelect={onSelectPlan} />
        <PricingCard plan={PRICING_PLANS.pack} onSelect={onSelectPlan} />
        <PricingCard plan={subscriptionPlan} onSelect={onSelectPlan} />
      </div>
    </div>
  )
}
