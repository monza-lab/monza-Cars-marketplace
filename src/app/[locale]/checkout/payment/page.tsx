"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { CreditCard, Lock, ArrowLeft, Loader2 } from "lucide-react"
import { PRICING_PLANS, type PlanId } from "@/components/payments/PricingCards"

function PaymentForm() {
  const router = useRouter()
  const params = useSearchParams()
  const planId = (params.get("plan") as PlanId) ?? "monthly"
  const plan = PRICING_PLANS[planId]

  const [email, setEmail] = useState("")
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242")
  const [expiry, setExpiry] = useState("12 / 28")
  const [cvc, setCvc] = useState("123")
  const [name, setName] = useState("")
  const [country, setCountry] = useState("United States")
  const [loading, setLoading] = useState(false)

  if (!plan) {
    return (
      <div className="text-center text-muted-foreground text-[13px]">
        Invalid plan.{" "}
        <Link href="/pricing" className="text-primary hover:underline">
          Go to pricing
        </Link>
      </div>
    )
  }

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      router.push("/checkout/success?session_id=dev-mock")
    }, 1200)
  }

  const priceSuffix = plan.period === "monthly" ? "/month" : "one-time"

  return (
    <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl border border-border bg-card overflow-hidden">
      {/* Left — plan summary */}
      <div className="bg-foreground/2 p-8 border-b md:border-b-0 md:border-r border-border">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3" />
          Back to pricing
        </Link>

        <div className="mb-6">
          <p className="text-[11px] text-muted-foreground mb-1">Subscribe to</p>
          <h1 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h1>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-foreground">${plan.price}</span>
            <span className="text-[13px] text-muted-foreground">{priceSuffix}</span>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {plan.features.map((feature) => (
            <div key={feature} className="flex items-start gap-2">
              <div className="size-1 rounded-full bg-primary mt-2 shrink-0" />
              <span className="text-[12px] text-muted-foreground">{feature}</span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">Subtotal</span>
            <span className="text-[12px] text-foreground tabular-nums">${plan.price.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">Tax</span>
            <span className="text-[12px] text-muted-foreground">—</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-[13px] font-semibold text-foreground">Total due today</span>
            <span className="text-[14px] font-bold text-foreground tabular-nums">
              ${plan.price.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Right — payment form */}
      <div className="p-8">
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-foreground/5 border border-border mb-5">
          <Lock className="size-2.5 text-muted-foreground" />
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
            Preview · not connected
          </span>
        </div>

        <form onSubmit={handlePay} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
              Card information
            </label>
            <div className="flex flex-col border border-border rounded-lg overflow-hidden focus-within:border-primary/50 transition-colors">
              <div className="flex items-center px-3 border-b border-border">
                <CreditCard className="size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-2.5 text-[14px] tabular-nums text-foreground focus:outline-none"
                  placeholder="1234 1234 1234 1234"
                />
              </div>
              <div className="grid grid-cols-2 divide-x divide-border">
                <input
                  type="text"
                  required
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="MM / YY"
                  className="bg-transparent px-3 py-2.5 text-[14px] tabular-nums text-foreground focus:outline-none"
                />
                <input
                  type="text"
                  required
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value)}
                  placeholder="CVC"
                  className="bg-transparent px-3 py-2.5 text-[14px] tabular-nums text-foreground focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
              Cardholder name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name on card"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
              Country or region
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-[14px] text-foreground focus:outline-none focus:border-primary/50 transition-colors"
            >
              <option>United States</option>
              <option>Mexico</option>
              <option>Spain</option>
              <option>Germany</option>
              <option>United Kingdom</option>
              <option>Japan</option>
              <option>Colombia</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-[14px] font-semibold hover:bg-primary/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>Pay ${plan.price.toFixed(2)}</>
            )}
          </button>

          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            By confirming your subscription, you allow Monza Haus to charge your card for
            this payment and future payments in accordance with their terms.
          </p>
        </form>

        <div className="flex items-center justify-center gap-2 pt-5 mt-5 border-t border-border">
          <Lock className="size-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Powered by <strong className="text-foreground">Stripe</strong>
          </span>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground text-[13px]">Loading payment form…</div>
      }
    >
      <PaymentForm />
    </Suspense>
  )
}
