"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { CheckoutModal } from "@/components/payments/CheckoutModal"
import { PistonsEconomyTable } from "@/components/payments/PistonsEconomyTable"
import { TopUpPresets } from "@/components/payments/TopUpPresets"
import { SubRecommendationCard } from "@/components/payments/SubRecommendationCard"
import { useAuth } from "@/lib/auth/AuthProvider"
import type { PlanId } from "@/lib/payments/plans"
import { ChevronDown } from "lucide-react"
import { track } from "@/lib/analytics/events"

// FAQ stays — content is independent from the pricing model.
// Re-translated to the new wallet vocabulary where helpful.
const FAQ_ITEMS = [
  {
    q: "Do Pistons expire?",
    a: "Top-up Pistons never expire. Genshpod keeps reports unlimited while the subscription is active.",
  },
  {
    q: "What can I do with Pistons?",
    a: "Pistons are your in-app currency: chat with the advisor (1 Piston), run marketplace queries (~5), deep research (~25), or generate a full Haus Report (1,000).",
  },
  {
    q: "What's the difference between top-up and subscription?",
    a: "Top-ups are one-time purchases that never expire; great if you research occasionally. Genshpod ($59/mo) gives unlimited reports plus pro features and is the most cost-effective if you use the platform regularly.",
  },
  {
    q: "How does cancellation work?",
    a: "Cancel anytime from your account. You keep access through the end of your billing period, and any top-up Pistons stay in your wallet forever.",
  },
  {
    q: "Can I get a refund?",
    a: "30-day money-back guarantee on first-time subscriptions and top-ups. Email legal@monzalab.com within 30 days of purchase.",
  },
]

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full py-3 flex items-center justify-between text-left gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
        aria-expanded={open}
      >
        <span className="text-[13px] font-medium text-foreground">{q}</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <p className="pb-4 text-[12px] text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export default function PricingPage() {
  const t = useTranslations("pricing")
  const { profile } = useAuth()
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)

  useEffect(() => {
    track({ event: "pricing_page_viewed", payload: { source: "direct" } })
  }, [])

  const handleSelectTopUp = (planId: PlanId) => {
    track({ event: "plan_clicked", payload: { planId } })
    setCheckoutPlan(planId)
  }

  const handleSubscribe = () => {
    track({ event: "plan_clicked", payload: { planId: "rennsport" } })
    setCheckoutPlan("rennsport")
  }

  const balance = profile?.pistonsBalance ?? profile?.creditsBalance ?? 0

  return (
    <div className="min-h-screen bg-background pt-[var(--app-header-h,3.5rem)] md:pt-24 pb-32 md:pb-16">
      {/* Hero */}
      <section className="px-4 pt-6 md:pt-4 pb-8 md:pb-12 text-center max-w-2xl mx-auto">
        <p className="text-[11px] font-medium tracking-wide text-primary/80">
          {t("heroEyebrow")}
        </p>
        <h1 className="mt-3 font-display text-[28px] md:text-[40px] leading-tight font-medium text-foreground">
          {t("heroTitle")}
        </h1>
        <p className="mt-3 text-[13px] md:text-[15px] text-muted-foreground leading-relaxed">
          {t("heroSubtitle")}
        </p>
      </section>

      {/* Pistons Economy Table */}
      <section className="px-4 max-w-2xl mx-auto mb-10 md:mb-12">
        <PistonsEconomyTable variant="full" />
      </section>

      {/* Top-up presets */}
      <section className="px-4 max-w-3xl mx-auto mb-10 md:mb-14">
        <TopUpPresets onSelect={handleSelectTopUp} />
      </section>

      {/* Balance pill (auth users only) */}
      {profile && (
        <section className="px-4 mb-10 md:mb-12 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/[0.04] border border-border">
            <span className="text-[11px] text-muted-foreground">
              {t("currentBalance")}
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-foreground">
              {balance.toLocaleString()} {t("pistonsLabel")}
            </span>
          </div>
        </section>
      )}

      {/* Subscription recommendation */}
      <section className="px-4 max-w-3xl mx-auto mb-12 md:mb-16">
        <SubRecommendationCard onSubscribe={handleSubscribe} />
      </section>

      {/* Anchor narrative — italic, small, muted */}
      <section className="px-4 max-w-xl mx-auto mb-12 md:mb-16 text-center">
        <p className="text-[11px] md:text-[12px] text-muted-foreground/80 italic leading-relaxed">
          {t("anchorNarrative")}
        </p>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-4 mb-10">
        <h2 className="font-display text-[20px] md:text-[24px] font-medium text-foreground text-center mb-4 md:mb-6">
          {t("faqTitle")}
        </h2>
        <div className="rounded-2xl border border-border bg-foreground/[0.02] px-5">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={item.q} q={item.q} a={item.a} defaultOpen={i === 0} />
          ))}
        </div>
      </section>

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
