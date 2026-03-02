"use client"

import { useState } from "react"
import { PricingCards, type PlanId } from "@/components/payments/PricingCards"
import { CheckoutModal } from "@/components/payments/CheckoutModal"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Shield, BarChart3, Globe, TrendingUp, Coins, FileBarChart } from "lucide-react"

// ─── REPORT FEATURES ───

const REPORT_FEATURES = [
  {
    icon: BarChart3,
    title: "Investment Grade Rating",
    description: "AAA to C scoring based on collectibility, rarity, and market trends",
  },
  {
    icon: TrendingUp,
    title: "Price Trend Analysis",
    description: "Historical price data and 5-year appreciation forecasts",
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
    q: "Do credits expire?",
    a: "One-time credit packs never expire. Free monthly credits reset on the 1st of each month. Pro Unlimited is active as long as your subscription is active.",
  },
  {
    q: "What's included in each report?",
    a: "Every report includes a 10-section investment dossier: investment grade, price trends, regional arbitrage, comparable sales, risk assessment, bid targets, ownership costs, market depth, and more.",
  },
  {
    q: "Can I cancel my Pro subscription?",
    a: "Yes, cancel anytime. You'll keep access until the end of your billing period. No questions asked.",
  },
  {
    q: "Is there a money-back guarantee?",
    a: "Yes. If you're not satisfied with your purchase, contact us within 30 days for a full refund.",
  },
]

// ─── PAGE ───

export default function PricingPage() {
  const { profile } = useAuth()
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)

  const handleSelectPlan = (planId: PlanId) => {
    setCheckoutPlan(planId)
  }

  const handleConfirmPurchase = (planId: PlanId) => {
    // TODO: Backend replaces with Stripe createCheckoutSession()
    console.log("[Checkout] Plan selected:", planId)
    setCheckoutPlan(null)
  }

  return (
    <div className="min-h-screen bg-[#0b0b10] pt-24 pb-16">
      {/* Hero */}
      <div className="text-center px-4 mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F8B4D9]/10 border border-[#F8B4D9]/20 mb-4">
          <Coins className="size-3 text-[#F8B4D9]" />
          <span className="text-[11px] font-medium text-[#F8B4D9]">
            3 free reports every month
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-[#FFFCF7] mb-3">
          Choose Your Plan
        </h1>
        <p className="text-[15px] text-[#6B7280] max-w-lg mx-auto">
          Unlock comprehensive investment analysis for smarter buying decisions.
          Every report is a 10-section dossier powered by real auction data.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="px-4 mb-16">
        <PricingCards onSelectPlan={handleSelectPlan} />
      </div>

      {/* What's included */}
      <div className="max-w-4xl mx-auto px-4 mb-16">
        <h2 className="text-xl font-bold text-[#FFFCF7] text-center mb-8">
          What&apos;s Included in Every Report
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {REPORT_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="p-5 rounded-xl border border-white/10 bg-white/[0.02]"
            >
              <div className="flex items-center justify-center size-9 rounded-lg bg-[#F8B4D9]/10 mb-3">
                <feature.icon className="size-4 text-[#F8B4D9]" />
              </div>
              <h3 className="text-[13px] font-semibold text-[#FFFCF7] mb-1">
                {feature.title}
              </h3>
              <p className="text-[11px] text-[#6B7280] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-4 mb-16">
        <h2 className="text-xl font-bold text-[#FFFCF7] text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <div
              key={item.q}
              className="p-5 rounded-xl border border-white/10 bg-white/[0.02]"
            >
              <h3 className="text-[13px] font-semibold text-[#FFFCF7] mb-2">
                {item.q}
              </h3>
              <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center px-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Shield className="size-4 text-[#4B5563]" />
          <span className="text-[12px] text-[#4B5563]">
            30-day money-back guarantee
          </span>
        </div>
        {profile && (
          <p className="text-[11px] text-[#4B5563]">
            Current balance:{" "}
            <span className="text-[#F8B4D9] font-semibold">
              {profile.creditsBalance} credits
            </span>
          </p>
        )}
      </div>

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
