"use client"

import { Check } from "lucide-react"
import { track } from "@/lib/analytics/events"
import { PRICING_PLANS, type PlanId, type PricingPlan } from "@/lib/payments/plans"

export type { PlanId } from "@/lib/payments/plans"

function PricingCard({
  plan,
  onSelect,
}: {
  plan: PricingPlan
  onSelect: (planId: PlanId) => void
}) {
  // Only the subscription tier (Rennsport) is the conversion target.
  // Top-up packs can carry a "Best value" badge but stay visually quieter
  // — the Salon test: a single anchor, not three competing for attention.
  const isPrimary = plan.id === "rennsport"
  const isHighlighted = !!plan.badge

  return (
    <div
      className={`relative flex flex-col p-6 rounded-2xl border transition-all ${
        isPrimary
          ? "border-primary/60 bg-primary/[0.05] shadow-xl shadow-primary/10 md:scale-[1.03]"
          : isHighlighted
          ? "border-border bg-foreground/[0.02]"
          : "border-border bg-foreground/2 hover:border-border/80"
      }`}
    >
      {plan.badge && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.18em] px-3 py-1 rounded-full font-semibold ${
            isPrimary
              ? "uppercase bg-primary text-primary-foreground"
              : "bg-foreground/5 border border-border text-foreground/70"
          }`}
        >
          {plan.badge}
        </span>
      )}

      <h3 className="text-[15px] font-semibold text-foreground mb-4">{plan.name}</h3>

      <div className="mb-1">
        <span className="text-3xl font-bold text-foreground">${plan.price}</span>
        <span className="text-[13px] text-muted-foreground ml-1">
          {plan.period === "monthly" ? "/mo" : "one-time"}
        </span>
      </div>

      <span className="text-[11px] text-primary font-medium mb-4">{plan.perReport}</span>

      <p className="text-[12px] text-muted-foreground mb-6">
        {plan.reports === "unlimited"
          ? "Unlimited analysis every month"
          : plan.reports === 1
          ? "1 Report, never expires"
          : `${plan.reports} Reports, never expire`}
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
  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PricingCard plan={PRICING_PLANS.jerrycan} onSelect={onSelectPlan} />
        <PricingCard plan={PRICING_PLANS.fuel_cell} onSelect={onSelectPlan} />
        <PricingCard plan={PRICING_PLANS.rennsport} onSelect={onSelectPlan} />
      </div>
    </div>
  )
}
