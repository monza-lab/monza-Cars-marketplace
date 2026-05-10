"use client"

import { useEffect, useState } from "react"
import { PricingCards, type PlanId } from "@/components/payments/PricingCards"
import { CheckoutModal } from "@/components/payments/CheckoutModal"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Shield, BarChart3, Globe, TrendingUp, Coins, FileBarChart, ChevronDown } from "lucide-react"
import { track } from "@/lib/analytics/events"

const REPORT_FEATURES = [
  {
    icon: BarChart3,
    title: "Investment Grade Rating",
    description: "AAA to C scoring based on collectibility, rarity, and market trends",
  },
  {
    icon: TrendingUp,
    title: "Market Valuation",
    description: "Current market pricing and fair value analysis across regions",
  },
  {
    icon: Globe,
    title: "Regional Arbitrage",
    description: "Fair value comparison across US, EU, UK, and JP markets",
  },
  {
    icon: FileBarChart,
    title: "Comparable Sales",
    description: "Recent auction results for identical and similar models",
  },
  {
    icon: Shield,
    title: "Risk Assessment",
    description: "Red flags, market risks, and key strengths analysis",
  },
  {
    icon: Coins,
    title: "Bid Targets",
    description: "Data-driven low and high bid recommendations",
  },
]

const FAQ_ITEMS = [
  {
    q: "Do reports expire?",
    a: "Top-ups never expire. Subscription Pistons reset each billing cycle, and Rennsport keeps reports unlimited while active.",
  },
  {
    q: "What's included in each report?",
    a: "Every Monza Haus Report is a 10-section investment dossier: investment grade (AAA to C), regional fair value across US/EU/UK/JP markets, comparable sales, risk assessment, bid targets, ownership costs, market depth, and more.",
  },
  {
    q: "What's the difference between Pack and Monthly?",
    a: "Fuel Cell is a top-up bucket that never expires. Rennsport is the unlimited monthly plan with the largest Pistons allowance.",
  },
  {
    q: "Why is Monthly the obvious choice?",
    a: "If you use reports often, Rennsport keeps the flow simple: one monthly charge, unlimited reports, and the largest Pistons allowance.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes — cancel anytime from Billing. You'll keep access until the end of your current billing period. No questions asked.",
  },
  {
    q: "Is there a money-back guarantee?",
    a: "Yes. If you're not satisfied, contact us within 30 days for a full refund.",
  },
]

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-[13px] font-medium text-foreground">{q}</span>
        <ChevronDown
          className={`size-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="text-[12px] text-muted-foreground leading-relaxed pb-4 pr-6">
          {a}
        </p>
      )}
    </div>
  )
}

export default function PricingPage() {
  const { profile } = useAuth()
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)

  useEffect(() => {
    track({ event: "pricing_page_viewed", payload: { source: "direct" } })
  }, [])

  const handleSelectPlan = (planId: PlanId) => {
    setCheckoutPlan(planId)
  }

  const balance = profile?.pistonsBalance ?? profile?.creditsBalance ?? 0

  return (
    <div className="min-h-screen bg-background pt-[var(--app-header-h,3.5rem)] md:pt-24 pb-32 md:pb-16">
      {/* Hero — compact mobile */}
      <div className="px-4 pt-6 md:pt-4 pb-8 md:pb-12 text-center max-w-2xl mx-auto">
        <p className="text-[11px] font-medium tracking-wide text-primary/80">
          {/* [HARDCODED] */}300 free Pistons each month — no card required
        </p>
        <h1 className="mt-3 font-display text-[28px] md:text-[40px] leading-tight font-medium text-foreground">
          {/* [HARDCODED] */}Due diligence for Porsche buyers
        </h1>
        <p className="mt-3 text-[13px] md:text-[15px] text-muted-foreground leading-relaxed">
          {/* [HARDCODED] */}One report costs 100 Pistons. Higher plans unlock more
          monthly Pistons. Top-ups never expire.
        </p>

        {/* Anchor — due diligence stack */}
        <p className="mt-5 text-[11px] text-muted-foreground/80 italic max-w-md mx-auto">
          {/* [HARDCODED] */}A PPI costs $400. A Porsche PPS, $250. Paying $59/mo
          to know if the deal is worth it is due diligence, not expense.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="px-4 mb-12 md:mb-16">
        <PricingCards onSelectPlan={handleSelectPlan} />
      </div>

      {/* Balance pill (auth users) */}
      {profile && (
        <div className="px-4 mb-10 md:mb-12 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/[0.04] border border-border">
            <Coins className="size-3 text-primary" />
            <span className="text-[11px] text-muted-foreground">
              {/* [HARDCODED] */}Current balance
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-foreground">
              {balance.toLocaleString()} {/* [HARDCODED] */}Pistons
            </span>
          </div>
        </div>
      )}

      {/* What's included */}
      <div className="max-w-4xl mx-auto px-4 mb-12 md:mb-16">
        <h2 className="font-display text-[20px] md:text-[24px] font-medium text-foreground text-center mb-6 md:mb-8">
          {/* [HARDCODED] */}What&apos;s in every report
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
          {REPORT_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="p-4 md:p-5 rounded-xl border border-border bg-foreground/[0.02]"
            >
              <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 mb-3">
                <feature.icon className="size-4 text-primary" />
              </div>
              <h3 className="text-[13px] font-semibold text-foreground mb-1">
                {feature.title}
              </h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ — accordion */}
      <div className="max-w-2xl mx-auto px-4 mb-10">
        <h2 className="font-display text-[20px] md:text-[24px] font-medium text-foreground text-center mb-4 md:mb-6">
          {/* [HARDCODED] */}Frequently asked
        </h2>
        <div className="rounded-2xl border border-border bg-foreground/[0.02] px-5">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={item.q} q={item.q} a={item.a} defaultOpen={i === 0} />
          ))}
        </div>
      </div>

      {/* Trust footer */}
      <div className="text-center px-4 mb-6">
        <div className="inline-flex items-center gap-2.5">
          <Shield className="size-3.5 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground">
            {/* [HARDCODED] */}30-day money-back guarantee
          </span>
        </div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        open={checkoutPlan !== null}
        onOpenChange={(open) => !open && setCheckoutPlan(null)}
        planId={checkoutPlan}
        onSwitchPlan={(newPlan) => setCheckoutPlan(newPlan)}
      />
    </div>
  )
}
