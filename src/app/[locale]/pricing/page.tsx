"use client"

import { useEffect, useState } from "react"
import { PricingCards, type PlanId } from "@/components/payments/PricingCards"
import { CheckoutModal } from "@/components/payments/CheckoutModal"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Shield, BarChart3, Globe, TrendingUp, Coins, FileBarChart } from "lucide-react"
import { track } from "@/lib/analytics/events"

// ─── REPORT FEATURES ───

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

// ─── FAQ ───

const FAQ_ITEMS = [
  {
    q: "Do reports expire?",
    a: "Single and Pack purchases never expire — use them whenever you want. Monthly is an unlimited subscription as long as it's active.",
  },
  {
    q: "What's included in each report?",
    a: "Every Monza Haus Report is a 10-section investment dossier: investment grade (AAA to C), regional fair value across US/EU/UK/JP markets, comparable sales, risk assessment, bid targets, ownership costs, market depth, and more.",
  },
  {
    q: "What's the difference between Pack and Monthly?",
    a: "The Reports Pack gives you 5 reports to use at your own pace, forever. Monthly gives you unlimited Reports, plus Watchlist, Email Alerts on matching cars, Saved Searches, priority report generation, and PDF + CSV export. Monthly is for active hunters; Pack is for pausing between purchases.",
  },
  {
    q: "Why is Monthly the obvious choice?",
    a: "Two Reports Packs cost $78 combined. Monthly is $59 — cheaper than two packs, and you get unlimited reports instead of 10, plus Watchlist and Alerts on top.",
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

// ─── PAGE ───

export default function PricingPage() {
  const { profile } = useAuth()
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)

  useEffect(() => {
    track({ event: "pricing_page_viewed", payload: { source: "direct" } })
  }, [])

  const handleSelectPlan = (planId: PlanId) => {
    setCheckoutPlan(planId)
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      {/* Hero */}
      <div className="text-center px-4 mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
          <Coins className="size-3 text-primary" />
          <span className="text-[11px] font-medium text-primary">
            3 free reports every month
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          Due Diligence for Porsche Buyers
        </h1>
        <p className="text-[15px] text-muted-foreground max-w-xl mx-auto">
          A PPI costs $300. An official Porsche PPS, $150. Unlimited investment
          analyses for $59 a month is due diligence, not an expense.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="px-4 mb-16">
        <PricingCards onSelectPlan={handleSelectPlan} />
      </div>

      {/* What's included */}
      <div className="max-w-4xl mx-auto px-4 mb-16">
        <h2 className="text-xl font-bold text-foreground text-center mb-8">
          What&apos;s Included in Every Report
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {REPORT_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="p-5 rounded-xl border border-border bg-foreground/2"
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

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-4 mb-16">
        <h2 className="text-xl font-bold text-foreground text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <div
              key={item.q}
              className="p-5 rounded-xl border border-border bg-foreground/2"
            >
              <h3 className="text-[13px] font-semibold text-foreground mb-2">
                {item.q}
              </h3>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center px-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Shield className="size-4 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground">
            30-day money-back guarantee
          </span>
        </div>
        {profile && (
          <p className="text-[11px] text-muted-foreground">
            Current balance:{" "}
            <span className="text-primary font-semibold">
              {profile.creditsBalance} Reports
            </span>
          </p>
        )}
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
