"use client"

import { useState } from "react"
import { AuthModal } from "@/components/auth/AuthModal"
import { useAuth } from "@/lib/auth/AuthProvider"
import { useRouter, useParams } from "next/navigation"
import {
  BarChart3,
  Globe,
  TrendingUp,
  ChevronRight,
} from "lucide-react"

const STEPS = [
  {
    icon: ChevronRight,
    title: "Pick a Porsche",
    description: "Paste any listing URL or search by model, year, and spec.",
  },
  {
    icon: BarChart3,
    title: "Get your AI report",
    description:
      "Investment grade, regional fair value, comparable sales, bid targets — all in one dossier.",
  },
  {
    icon: TrendingUp,
    title: "Make a smarter offer",
    description:
      "Know exactly what to pay based on real auction data across US, EU, UK, and JP markets.",
  },
]

const DATA_SOURCES = [
  "Bring a Trailer",
  "Cars & Bids",
  "AutoScout24",
  "Elferspot",
  "Classic.com",
]

export default function GetStartedPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) ?? "en"
  const [authOpen, setAuthOpen] = useState(false)

  const handleCTA = () => {
    if (user) {
      router.push(`/${locale}/advisor`)
    } else {
      setAuthOpen(true)
    }
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Globe className="size-3 text-primary" />
              <span className="text-[11px] font-medium text-primary tracking-wide uppercase">
                Free first report — no card required
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-5 font-serif">
              Know what any Porsche is actually worth
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              MonzaHaus analyzes thousands of auction results to give you
              investment-grade intelligence — so you never overpay.
            </p>

            <button
              onClick={handleCTA}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground text-[15px] font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Generate your first Porsche report — free
              <ChevronRight className="size-4" />
            </button>
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-y border-border bg-foreground/[0.02] py-6 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
              Powered by real auction data from
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {DATA_SOURCES.map((source) => (
                <span
                  key={source}
                  className="text-[13px] font-medium text-foreground/70"
                >
                  {source}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-12 font-serif">
              Three steps to a smarter deal
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STEPS.map((step, i) => (
                <div key={step.title} className="text-center">
                  <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 border border-primary/20 mx-auto mb-4">
                    <span className="text-[16px] font-bold text-primary">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="pb-24 px-4">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4 font-serif">
              Stop guessing. Start knowing.
            </h2>
            <p className="text-[14px] text-muted-foreground mb-8">
              Join collectors who use MonzaHaus to make data-driven decisions on
              Porsche purchases.
            </p>
            <button
              onClick={handleCTA}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground text-[15px] font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Generate your first Porsche report — free
              <ChevronRight className="size-4" />
            </button>
          </div>
        </section>
      </div>

      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultMode="signup"
      />
    </>
  )
}
