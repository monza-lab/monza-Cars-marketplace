"use client"

import { Check } from "lucide-react"

// ─── PLAN DEFINITIONS ───

export type PlanId = "starter" | "collector" | "pro"

export interface PricingPlan {
  id: PlanId
  name: string
  price: number
  period: "one-time" | "monthly"
  credits: number | "unlimited"
  perReport?: string
  badge?: string
  features: string[]
  cta: string
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter Pack",
    price: 12.99,
    period: "one-time",
    credits: 5,
    features: [
      "5 full analysis reports",
      "Credits never expire",
      "10-section investment dossier",
      "Regional arbitrage alerts",
      "Comparable sales data",
    ],
    cta: "Get 5 Reports",
  },
  {
    id: "collector",
    name: "Collector Pack",
    price: 49.99,
    period: "one-time",
    credits: 25,
    perReport: "$2/report",
    badge: "BEST VALUE",
    features: [
      "25 full analysis reports",
      "Credits never expire",
      "Everything in Starter",
      "Side-by-side comparison",
      "Priority support",
    ],
    cta: "Get 25 Reports",
  },
  {
    id: "pro",
    name: "Pro Unlimited",
    price: 59.99,
    period: "monthly",
    credits: "unlimited",
    features: [
      "Unlimited reports",
      "Everything in Collector",
      "Early access to new data",
      "Dedicated advisor line",
      "Cancel anytime",
    ],
    cta: "Go Unlimited",
  },
]

// ─── PRICING CARD COMPONENT ───

function PricingCard({
  plan,
  onSelect,
}: {
  plan: PricingPlan
  onSelect: (planId: PlanId) => void
}) {
  const isPopular = !!plan.badge

  return (
    <div
      className={`relative flex flex-col p-6 rounded-2xl border transition-all ${
        isPopular
          ? "border-primary/50 bg-primary/[0.03] shadow-lg shadow-primary/5"
          : "border-border bg-foreground/2 hover:border-border/80"
      }`}
    >
      {/* Badge */}
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest px-3 py-1 bg-primary text-primary-foreground rounded-full font-bold">
          {plan.badge}
        </span>
      )}

      {/* Plan name */}
      <h3 className="text-[15px] font-semibold text-foreground mb-4">
        {plan.name}
      </h3>

      {/* Price */}
      <div className="mb-1">
        <span className="text-3xl font-bold text-foreground">
          ${plan.price}
        </span>
        <span className="text-[13px] text-muted-foreground ml-1">
          {plan.period === "monthly" ? "/mo" : "one-time"}
        </span>
      </div>

      {/* Per report */}
      {plan.perReport && (
        <span className="text-[11px] text-primary font-medium mb-4">
          {plan.perReport}
        </span>
      )}
      {!plan.perReport && <div className="mb-4" />}

      {/* Credits summary */}
      <p className="text-[12px] text-muted-foreground mb-6">
        {plan.credits === "unlimited"
          ? "Unlimited reports per month"
          : `${plan.credits} reports, never expire`}
      </p>

      {/* Features */}
      <ul className="flex-1 space-y-3 mb-6">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check
              className={`size-4 mt-0.5 shrink-0 ${
                isPopular ? "text-primary" : "text-[#34D399]"
              }`}
            />
            <span className="text-[12px] text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA button */}
      <button
        onClick={() => onSelect(plan.id)}
        className={`w-full py-3 rounded-xl text-[13px] font-semibold transition-all ${
          isPopular
            ? "bg-primary text-primary-foreground hover:bg-primary/80"
            : "bg-foreground/6 text-foreground border border-border hover:bg-foreground/10"
        }`}
      >
        {plan.cta}
      </button>
    </div>
  )
}

// ─── PRICING CARDS GRID ───

export function PricingCards({
  onSelectPlan,
}: {
  onSelectPlan: (planId: PlanId) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
      {PRICING_PLANS.map((plan) => (
        <PricingCard key={plan.id} plan={plan} onSelect={onSelectPlan} />
      ))}
    </div>
  )
}
