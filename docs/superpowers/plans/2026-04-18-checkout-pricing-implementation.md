# Checkout & Pricing MVP — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the complete frontend experience for checkout + pricing (4 tiers, pre-checkout modal, success/cancel pages, out-of-reports paywall, updated billing dashboard, header banner, analytics tracking). All backend work is **out of scope** — this plan documents the API contracts the backend must honor but does not implement them.

**Scope rule (from `CLAUDE.md`):** Frontend-only changes. **Do NOT** modify API routes, DB schema, or `src/lib/credits/index.ts`. Those are documented as backend contracts in Appendix A for a separate backend effort.

**Architecture:** Pricing page renders `PricingCards` (4-tier component with Monthly/Annual toggle). Clicking a plan opens `CheckoutModal` which POSTs to the create-session endpoint (to be built by backend) and redirects to Stripe's hosted checkout. Success/cancel routes handle post-payment state with profile polling. Out-of-reports paywall and header banner funnel free users to pricing. Analytics tracks the full funnel.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, existing `AuthProvider`, `lucide-react` icons, `@radix-ui/react-dialog`. **No** Stripe SDK on frontend — we only redirect to a URL returned by the backend.

**Spec:** `docs/superpowers/specs/2026-04-18-checkout-pricing-design.md` — read for context before starting.

**Graceful degradation:** Until the backend endpoints exist, clicking "Continue to Payment" or "Cancel Subscription" will show the error state we already handle (400/404/500 response). The frontend ships independently and is ready the moment the backend endpoints go live.

---

## Appendix A — Backend contracts (for separate backend work)

Documenting here so the frontend can code against stable interfaces. Backend to implement in a separate effort.

### Endpoints

**`POST /api/checkout/create-session`**
- Auth required (Supabase session).
- Request body: `{ plan: 'single' | 'pack' | 'monthly' | 'annual' }`
- Response 200: `{ url: string, sessionId: string }` where `url` is a Stripe Checkout URL.
- Response 400: `{ error: string, details?: unknown }`
- Response 401: `{ error: 'Unauthorized' }`
- Response 500: `{ error: string }`
- Side effects: creates a Stripe Customer if the user has none, stores `stripeCustomerId` on the app user.

**`POST /api/stripe/webhook`**
- Stripe-signed webhook. Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- Idempotent via `stripeEventId` / `stripePaymentId`.
- Grants `packCreditsBalance` on one-time purchases. Activates subscription + sets `creditsBalance = 10` on subscription start. Resets `creditsBalance = 10` on subscription renewal (Monthly fires each month; Annual requires a separate lazy-reset path on profile read).

**`POST /api/billing/cancel-subscription`**
- Auth required.
- No request body.
- Response 200: `{ ok: true }`
- Response 400: `{ error: 'No active subscription' }`
- Side effect: calls Stripe `subscriptions.update(subId, { cancel_at_period_end: true })`. Webhook handles the final state flip to `FREE`.

**`POST /api/analytics`**
- Auth optional (user_id nullable in stored event).
- Request body: `{ event: string, payload: Record<string, unknown> }`
- Response 200: `{ ok: true }`. Never fails UX — returns 200 even on internal error.

**`GET /api/user/profile` (existing — extend)**
- Add to response `profile`:
  - `packCreditsBalance: number`
  - `subscriptionPeriodEnd: string | null` (ISO date)
  - `tier` enum extended to `'FREE' | 'PACK_OWNER' | 'MONTHLY' | 'ANNUAL' | 'PRO'`

### DB schema (backend owns)

Extensions to existing `"User"` table:
- `packCreditsBalance integer NOT NULL DEFAULT 0`
- `stripeCustomerId text`
- `stripeSubscriptionId text`
- `subscriptionStatus text` (`active | past_due | canceled | incomplete | null`)
- `subscriptionPeriodEnd timestamptz`
- `annualLastMonthlyReset timestamptz` (lazy-reset tracker for Annual subscribers)
- `tier` CHECK expanded to include `PACK_OWNER | MONTHLY | ANNUAL` alongside `FREE | PRO`

Extensions to existing `"CreditTransaction"` table:
- `type` CHECK expanded: `STRIPE_PACK_PURCHASE | STRIPE_SUBSCRIPTION_ACTIVATION | STRIPE_MONTHLY_RESET | STRIPE_SUBSCRIPTION_CANCELED`
- UNIQUE index on `stripePaymentId` (webhook idempotency)

New table `analytics_events`: `id uuid, user_id uuid nullable, event_name text, payload jsonb, created_at timestamptz`.

Consumption order when generating a report: consume from `packCreditsBalance` FIRST (never expires), then from `creditsBalance` (the monthly/free pool). Never mix.

### Stripe Dashboard setup (manual)

Backend/ops task: create Products + Prices in Stripe, set env vars `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SINGLE`, `STRIPE_PRICE_PACK`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`. Frontend does not read any Stripe env vars.

---

## Task 1: Extend `UserProfile` type for new tier + fields

**Files:**
- Modify: `src/lib/auth/AuthProvider.tsx`

- [ ] **Step 1: Update the `UserProfile` interface**

Find the `UserProfile` interface (starts around line 7) and replace with:

```typescript
export interface UserProfile {
  id: string
  supabaseId: string
  email: string
  name: string | null
  avatarUrl: string | null
  creditsBalance: number
  packCreditsBalance: number
  freeCreditsUsed: number
  tier: 'FREE' | 'PACK_OWNER' | 'MONTHLY' | 'ANNUAL' | 'PRO'
  creditResetDate: string
  subscriptionPeriodEnd: string | null
}
```

These fields are optional on the backend response for now (backend adds them later). Frontend reads them defensively with `??` fallbacks — see Task 7 for the pattern.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/AuthProvider.tsx
git commit -m "types(auth): extend UserProfile for subscription fields"
```

---

## Task 2: Rewrite `PricingCards` — 4 tiers with Monthly/Annual toggle

**Files:**
- Modify: `src/components/payments/PricingCards.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the ENTIRE contents of `src/components/payments/PricingCards.tsx` with:

```typescript
"use client"

import { useState } from "react"
import { Check } from "lucide-react"

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
        onClick={() => onSelect(plan.id)}
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
```

- [ ] **Step 2: Fix consumers of the old `PlanId` enum**

Search for old plan IDs:
```bash
grep -rn "\"starter\"\|\"collector\"\|\"pro\"" src/components src/app --include="*.tsx" --include="*.ts"
```

Update each hit:
- `src/app/[locale]/pricing/page.tsx` — keep the `checkoutPlan` state + `<CheckoutModal>` but the type is now `PlanId | null`; remove the old `handleConfirmPurchase` stub (Task 3's modal handles the call directly).
- `src/components/payments/BillingDashboard.tsx` — Task 6 rewrites this file entirely, so no intermediate fix needed; just ensure it still compiles by temporarily changing `"starter"` → `"pack"` in the one button that references it.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no errors related to changed files.

- [ ] **Step 4: Commit**

```bash
git add src/components/payments/PricingCards.tsx src/app/[locale]/pricing/page.tsx src/components/payments/BillingDashboard.tsx
git commit -m "feat(pricing): 4-tier card layout with monthly/annual toggle"
```

---

## Task 3: Rewrite `CheckoutModal` — pre-checkout + upsell + Stripe redirect

**Files:**
- Modify: `src/components/payments/CheckoutModal.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the ENTIRE contents of `src/components/payments/CheckoutModal.tsx` with:

```typescript
"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { PRICING_PLANS, type PlanId } from "./PricingCards"
import { Shield, Lock, Loader2 } from "lucide-react"
import { track } from "@/lib/analytics/events"

interface CheckoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: PlanId | null
  onSwitchPlan?: (planId: PlanId) => void
}

export function CheckoutModal({
  open,
  onOpenChange,
  planId,
  onSwitchPlan,
}: CheckoutModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plan = planId ? PRICING_PLANS[planId] : null
  const showPackUpsell = plan?.id === "pack"

  // Fire upsell_shown when the pack upsell block is rendered
  useEffect(() => {
    if (open && showPackUpsell) {
      track({
        event: "upsell_shown",
        payload: { context: "pack_modal", fromPlan: "pack", toPlan: "monthly" },
      })
    }
  }, [open, showPackUpsell])

  if (!plan) return null

  const goToStripe = async () => {
    setLoading(true)
    setError(null)
    track({
      event: "checkout_started",
      payload: { planId: plan.id, amount: plan.price, sessionId: "" },
    })
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: plan.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Failed to start checkout")
      }
      window.location.href = json.url
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  const handleSwitchToMonthly = () => {
    if (!onSwitchPlan) return
    track({
      event: "upsell_converted",
      payload: { context: "pack_modal", fromPlan: "pack", toPlan: "monthly" },
    })
    onSwitchPlan("monthly")
  }

  const priceSuffix =
    plan.period === "monthly" ? "/mo" : plan.period === "annual" ? "/yr" : "USD"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold text-foreground">
            {plan.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">
            {plan.period === "one-time"
              ? `${plan.reports} Reports · never expire`
              : `${plan.reports} Reports/month · ${plan.perReport}`}
          </DialogDescription>
        </DialogHeader>

        {showPackUpsell && onSwitchPlan && (
          <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4 mt-2">
            <p className="text-[12px] text-foreground mb-2">
              💡 Monthly at <strong>$19/mo</strong> gives you{" "}
              <strong>10 Reports + Watchlist + Alerts</strong> for 81% less than this pack.
            </p>
            <button
              onClick={handleSwitchToMonthly}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Switch to Monthly →
            </button>
          </div>
        )}

        <div className="rounded-xl border border-border bg-foreground/2 p-4 mt-1">
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-[12px] text-muted-foreground">Total</span>
            <div>
              <span className="text-xl font-bold text-foreground">${plan.price}</span>
              <span className="text-[11px] text-muted-foreground ml-1">{priceSuffix}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 mt-1">
            <p className="text-[12px] text-destructive">{error}</p>
          </div>
        )}

        <button
          onClick={goToStripe}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold hover:bg-primary/80 transition-colors mt-1 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Redirecting to Stripe…
            </>
          ) : (
            <>Continue to Payment — ${plan.price}</>
          )}
        </button>

        <div className="flex items-center justify-center gap-4 mt-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Lock className="size-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Secure · Stripe</span>
          </div>
          <div className="w-px h-3 bg-foreground/10" />
          <div className="flex items-center gap-1.5">
            <Shield className="size-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">30-day refund</span>
          </div>
          {(plan.period === "monthly" || plan.period === "annual") && (
            <>
              <div className="w-px h-3 bg-foreground/10" />
              <span className="text-[10px] text-muted-foreground">Cancel anytime</span>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Update `pricing/page.tsx` to pass `onSwitchPlan`**

In `src/app/[locale]/pricing/page.tsx`, replace the existing `<CheckoutModal ...>` usage with:

```tsx
<CheckoutModal
  open={checkoutPlan !== null}
  onOpenChange={(open) => !open && setCheckoutPlan(null)}
  planId={checkoutPlan}
  onSwitchPlan={(newPlan) => setCheckoutPlan(newPlan)}
/>
```

Remove the unused `handleConfirmPurchase` function and its import if any.

- [ ] **Step 3: Commit**

```bash
git add src/components/payments/CheckoutModal.tsx src/app/[locale]/pricing/page.tsx
git commit -m "feat(checkout): pre-checkout modal with upsell + Stripe redirect"
```

**NOTE:** Clicking "Continue to Payment" will fail until backend ships `/api/checkout/create-session`. That is expected — the modal will show the error state. Ship-ready.

---

## Task 4: `/checkout/success` and `/checkout/cancel` pages

**Files:**
- Create: `src/app/[locale]/checkout/layout.tsx`
- Create: `src/app/[locale]/checkout/success/page.tsx`
- Create: `src/app/[locale]/checkout/cancel/page.tsx`

- [ ] **Step 1: Create the layout**

Create `src/app/[locale]/checkout/layout.tsx`:

```typescript
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create the success page**

Create `src/app/[locale]/checkout/success/page.tsx`:

```typescript
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { track } from "@/lib/analytics/events"

export default function CheckoutSuccessPage() {
  const { profile, refreshProfile } = useAuth()
  const [ready, setReady] = useState(false)
  const [trackedCompletion, setTrackedCompletion] = useState(false)

  useEffect(() => {
    // Stripe webhook may land before or after the user returns.
    // Poll profile up to 10 seconds, then give up and show the success view anyway.
    const interval = setInterval(async () => {
      await refreshProfile()
    }, 1500)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      setReady(true)
    }, 10_000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [refreshProfile])

  useEffect(() => {
    if (!profile) return
    if (
      profile.tier === "MONTHLY" ||
      profile.tier === "ANNUAL" ||
      profile.tier === "PACK_OWNER"
    ) {
      setReady(true)
    }
  }, [profile])

  useEffect(() => {
    if (!ready || trackedCompletion) return
    const sessionId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("session_id") ?? ""
        : ""
    track({
      event: "checkout_completed",
      payload: { planId: profile?.tier ?? "unknown", amount: 0, sessionId },
    })
    setTrackedCompletion(true)
  }, [ready, profile, trackedCompletion])

  const isSubscription = profile?.tier === "MONTHLY" || profile?.tier === "ANNUAL"

  return (
    <div className="max-w-md w-full rounded-2xl border border-border bg-foreground/2 p-8 text-center">
      {ready ? (
        <>
          <div className="inline-flex items-center justify-center size-12 rounded-full bg-positive/10 mb-4">
            <CheckCircle2 className="size-6 text-positive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">You&apos;re all set</h1>
          <p className="text-[13px] text-muted-foreground mb-6">
            Your Reports are ready.
            {isSubscription ? " Watchlist is unlocked." : ""}
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/80 transition-colors"
            >
              Generate your first report →
            </Link>
            <Link
              href="/account"
              className="w-full py-3 rounded-xl bg-foreground/6 border border-border text-[13px] font-medium hover:bg-foreground/10 transition-colors"
            >
              View billing details
            </Link>
          </div>
        </>
      ) : (
        <>
          <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground mb-4" />
          <h1 className="text-lg font-semibold text-foreground mb-1">Processing payment</h1>
          <p className="text-[12px] text-muted-foreground">
            Hang on — Stripe is confirming your purchase. This usually takes a few seconds.
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create the cancel page**

Create `src/app/[locale]/checkout/cancel/page.tsx`:

```typescript
"use client"

import { useEffect } from "react"
import Link from "next/link"
import { XCircle } from "lucide-react"
import { track } from "@/lib/analytics/events"

export default function CheckoutCancelPage() {
  useEffect(() => {
    track({
      event: "checkout_cancelled",
      payload: { planId: "", reason: "user_back" },
    })
  }, [])

  return (
    <div className="max-w-md w-full rounded-2xl border border-border bg-foreground/2 p-8 text-center">
      <div className="inline-flex items-center justify-center size-12 rounded-full bg-muted/30 mb-4">
        <XCircle className="size-6 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-2">No charge was made</h1>
      <p className="text-[13px] text-muted-foreground mb-6">
        You backed out of checkout. Pick up where you left off?
      </p>
      <Link
        href="/pricing"
        className="inline-block py-3 px-5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/80 transition-colors"
      >
        Back to Pricing →
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/checkout/
git commit -m "feat(checkout): success page with profile polling + cancel page"
```

---

## Task 5: `OutOfReportsModal` — paywall when Free user hits cap

**Files:**
- Create: `src/components/payments/OutOfReportsModal.tsx`

- [ ] **Step 1: Implement the modal**

Create `src/components/payments/OutOfReportsModal.tsx`:

```typescript
"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Coins } from "lucide-react"
import Link from "next/link"

interface OutOfReportsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nextResetDate?: string | null
}

export function OutOfReportsModal({
  open,
  onOpenChange,
  nextResetDate,
}: OutOfReportsModalProps) {
  const formattedDate = nextResetDate
    ? new Date(nextResetDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : "the 1st of next month"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <div className="inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 mb-3">
            <Coins className="size-5 text-primary" />
          </div>
          <DialogTitle className="text-[17px] font-bold text-foreground">
            You&apos;ve used your 3 Free Reports this month
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">
            Your next reset is {formattedDate}. Upgrade now to keep analyzing Porsches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <Link
            href="/pricing"
            onClick={() => onOpenChange(false)}
            className="block w-full py-3 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/80 transition-colors text-center"
          >
            Go Monthly — $19/mo · 10 Reports + Watchlist
          </Link>
          <Link
            href="/pricing"
            onClick={() => onOpenChange(false)}
            className="block w-full py-3 rounded-xl bg-foreground/6 border border-border text-[13px] font-medium hover:bg-foreground/10 transition-colors text-center"
          >
            Or buy a Pack that never expires
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Wire into report generation flow**

Find the spot that currently handles `INSUFFICIENT_CREDITS`:

```bash
grep -rn "INSUFFICIENT_CREDITS" src --include="*.tsx" --include="*.ts"
```

Likely hits include `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`. In each UI caller (not the API route itself), import the modal, add state, and show it when the error surfaces.

Example pattern (adapt to the actual file):

```tsx
"use client"

import { useState } from "react"
import { OutOfReportsModal } from "@/components/payments/OutOfReportsModal"
import { useAuth } from "@/lib/auth/AuthProvider"

// inside the component:
const { profile } = useAuth()
const [outOfReportsOpen, setOutOfReportsOpen] = useState(false)

const generateReport = async () => {
  const res = await fetch(`/api/analyze`, { /* existing body */ })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (body.error === "INSUFFICIENT_CREDITS") {
      setOutOfReportsOpen(true)
      return
    }
    // keep existing error handling for other cases
  }
  // ...rest of existing success flow
}

// render:
<OutOfReportsModal
  open={outOfReportsOpen}
  onOpenChange={setOutOfReportsOpen}
  nextResetDate={profile?.creditResetDate}
/>
```

If the existing code uses a toast / inline error, REPLACE that path for `INSUFFICIENT_CREDITS` with the modal. Keep other errors as they were.

- [ ] **Step 3: Commit**

```bash
git add src/components/payments/OutOfReportsModal.tsx src/app/[locale]/cars
git commit -m "feat(paywall): out-of-reports modal on INSUFFICIENT_CREDITS"
```

---

## Task 6: Update `BillingDashboard` — show tier, packs, cancel button

**Files:**
- Modify: `src/components/payments/BillingDashboard.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the ENTIRE contents of `src/components/payments/BillingDashboard.tsx` with:

```typescript
"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Coins, RefreshCw, FileText, CreditCard } from "lucide-react"
import { TransactionHistory } from "./TransactionHistory"
import { track } from "@/lib/analytics/events"

export function BillingDashboard() {
  const { profile, refreshProfile } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const credits = profile?.creditsBalance ?? 0
  const packCredits = profile?.packCreditsBalance ?? 0
  const tier = profile?.tier ?? "FREE"
  const isSubscribed = tier === "MONTHLY" || tier === "ANNUAL"
  const periodEnd = profile?.subscriptionPeriodEnd
    ? new Date(profile.subscriptionPeriodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshProfile()
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleCancel = async () => {
    if (
      !confirm(
        "Cancel subscription? You'll keep access until the end of your current billing period.",
      )
    )
      return
    setCanceling(true)
    setCancelError(null)
    try {
      const res = await fetch("/api/billing/cancel-subscription", { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to cancel")
      }
      track({ event: "subscription_canceled", payload: { tier } })
      await refreshProfile()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel")
    } finally {
      setCanceling(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-foreground/2 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
            <Coins className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">Reports Balance</h3>
            <p className="text-[11px] text-muted-foreground">Your available Reports</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl border border-border bg-foreground/2 p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                {isSubscribed ? "This month" : "Free monthly"}
              </span>
            </div>
            <span
              className={`text-2xl font-bold ${
                credits > 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {credits}
            </span>
          </div>
          <div className="rounded-xl border border-border bg-foreground/2 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Pack (never expire)</span>
            </div>
            <span
              className={`text-2xl font-bold ${
                packCredits > 0 ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {packCredits}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-border pt-3 mb-4">
          <span className="text-[12px] text-muted-foreground">Current Plan</span>
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              isSubscribed
                ? "bg-primary/10 text-primary"
                : "bg-foreground/5 text-muted-foreground"
            }`}
          >
            {tier}
          </span>
        </div>

        {isSubscribed && periodEnd && (
          <p className="text-[11px] text-muted-foreground mb-4">
            Renews on <strong>{periodEnd}</strong>
          </p>
        )}

        {cancelError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 mb-3">
            <p className="text-[12px] text-destructive">{cancelError}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground/4 border border-border text-[12px] font-medium text-muted-foreground hover:bg-foreground/8 transition-colors"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {isSubscribed ? (
            <button
              onClick={handleCancel}
              disabled={canceling}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground/4 border border-border text-[12px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-60"
            >
              {canceling ? "Canceling…" : "Cancel Subscription"}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/80 transition-colors"
            >
              <Coins className="size-3.5" />
              Upgrade
            </Link>
          )}
        </div>
      </div>

      <TransactionHistory />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/payments/BillingDashboard.tsx
git commit -m "feat(billing): dashboard with pack balance + cancel subscription UI"
```

**NOTE:** Clicking "Cancel Subscription" fails until backend ships `/api/billing/cancel-subscription`. Error state surfaces to user. Ship-ready.

---

## Task 7: Header banner for Free users with reports left

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Read the current Header**

```bash
cat src/components/layout/Header.tsx | head -30
```

Identify where imports end and the component's return statement begins. The banner goes at the TOP of the returned JSX, before the main nav.

- [ ] **Step 2: Add imports if missing**

At the top of `Header.tsx`, ensure these imports exist (add any that are missing):

```typescript
import Link from "next/link"
import { useAuth } from "@/lib/auth/AuthProvider"
```

- [ ] **Step 3: Add the banner JSX**

Find the top of the component's returned JSX (typically `return (` followed by a root `<header>` or `<div>`). Add this AT THE TOP of the root element, before any existing nav:

```tsx
{profile && profile.tier === "FREE" && profile.creditsBalance <= 3 && (
  <div className="bg-primary/[0.06] border-b border-primary/20 px-4 py-2 text-center">
    <span className="text-[11px] text-foreground">
      <strong>{profile.creditsBalance}</strong>{" "}
      Free Reports left this month ·{" "}
      <Link
        href="/pricing"
        className="text-primary font-semibold hover:underline"
      >
        Upgrade to Monthly →
      </Link>
    </span>
  </div>
)}
```

Ensure `profile` is destructured from `useAuth()` inside the component:

```typescript
const { profile } = useAuth()
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): banner for free users with reports left"
```

---

## Task 8: Analytics client

**Files:**
- Create: `src/lib/analytics/events.ts`

- [ ] **Step 1: Create the analytics client**

Create `src/lib/analytics/events.ts`:

```typescript
export type AnalyticsEvent =
  | { event: "pricing_page_viewed"; payload: { source: string } }
  | { event: "plan_clicked"; payload: { planId: string; billingCycle?: string } }
  | { event: "checkout_started"; payload: { planId: string; amount: number; sessionId: string } }
  | { event: "checkout_completed"; payload: { planId: string; amount: number; sessionId: string } }
  | { event: "checkout_cancelled"; payload: { planId: string; reason?: string } }
  | { event: "upsell_shown"; payload: { context: string; fromPlan: string; toPlan: string } }
  | { event: "upsell_converted"; payload: { context: string; fromPlan: string; toPlan: string } }
  | { event: "subscription_canceled"; payload: { tier: string } }

export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    })
  } catch {
    // Swallow — analytics must never break the app
  }
}
```

- [ ] **Step 2: Add `track()` calls to the remaining locations**

Two places still need to fire analytics — the other call sites are already wired in Tasks 3, 4, 6.

**A. `PricingCards.tsx` — fire `plan_clicked` on card selection**

In `src/components/payments/PricingCards.tsx`, at the top add:

```typescript
import { track } from "@/lib/analytics/events"
```

Then modify the `PricingCard` button's `onClick` from:

```typescript
onClick={() => onSelect(plan.id)}
```

to:

```typescript
onClick={() => {
  track({ event: "plan_clicked", payload: { planId: plan.id } })
  onSelect(plan.id)
}}
```

**B. `pricing/page.tsx` — fire `pricing_page_viewed` on mount**

In `src/app/[locale]/pricing/page.tsx`, add:

```typescript
import { useEffect } from "react"
import { track } from "@/lib/analytics/events"
```

Inside the component, add:

```typescript
useEffect(() => {
  track({ event: "pricing_page_viewed", payload: { source: "direct" } })
}, [])
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics src/components/payments/PricingCards.tsx src/app/[locale]/pricing/page.tsx
git commit -m "feat(analytics): track pricing page views and plan clicks"
```

**NOTE:** All `track()` calls POST to `/api/analytics` (backend contract in Appendix A). Until backend ships that endpoint, calls 404 silently — the `try/catch` swallows errors. No UX impact.

---

## Task 9: Update pricing page hero copy + FAQ

**Files:**
- Modify: `src/app/[locale]/pricing/page.tsx`

- [ ] **Step 1: Update the hero block**

Find the hero block (the element with the `/* Hero */` comment) and REPLACE it with:

```tsx
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
    A PPI costs $300. An official Porsche PPS, $150. Paying $19 a month
    to know whether a $180k deal is fair is due diligence, not an expense.
  </p>
</div>
```

- [ ] **Step 2: Replace the FAQ items**

Find the `FAQ_ITEMS` constant and REPLACE its contents with:

```typescript
const FAQ_ITEMS = [
  {
    q: "Do reports expire?",
    a: "One-time Pack and Single purchases never expire. Monthly reports reset each billing period (no rollover). Annual plans follow the same pattern — 10 reports added every month for 12 months.",
  },
  {
    q: "What's included in each report?",
    a: "Every Monza Haus Report is a 10-section investment dossier: investment grade (AAA to C), regional fair value across US/EU/UK/JP markets, comparable sales, risk assessment, bid targets, ownership costs, market depth, and more.",
  },
  {
    q: "What's the difference between Pack and Monthly?",
    a: "The Reports Pack is 5 reports you can use any time, forever. Monthly gives you 10 reports per month plus Watchlist, Alerts, and Saved Searches — effectively the tools to hunt actively, not just analyze one-offs.",
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
```

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/pricing/page.tsx
git commit -m "copy(pricing): due-diligence narrative with PPI/PPS anchors"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests PASS. No tests were added in this frontend-only plan, so all existing tests should still pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run type check / build**

Run: `npm run build`
Expected: build succeeds. If it fails, usually it's a stale reference to `"starter"` / `"collector"` / `"pro"` plan IDs — fix per Task 2 Step 2.

- [ ] **Step 4: Smoke test with backend NOT yet implemented**

Run: `npm run dev`

Verify each user-facing surface renders and degrades gracefully:

- [ ] `/pricing` → 4 cards render (Free visible via existing copy, Single/Pack/Monthly+Annual toggle visible)
- [ ] Click any plan → `CheckoutModal` opens → click "Continue to Payment" → modal shows error (backend 404 is expected)
- [ ] Click Pack in pricing → modal shows upsell block → click "Switch to Monthly" → modal swaps to Monthly view
- [ ] Visit `/checkout/success` directly → shows "Processing payment" → after 10s shows success state
- [ ] Visit `/checkout/cancel` directly → shows "No charge was made" + back link
- [ ] `/account` (Billing Dashboard) → renders tier, pack count, monthly count, Upgrade button (if FREE) — no crashes even though `packCreditsBalance` is undefined on response
- [ ] Header banner shows for Free users with `creditsBalance <= 3`
- [ ] Try to generate a report with 0 credits → `OutOfReportsModal` appears

- [ ] **Step 5: Smoke test once backend ships**

(Gate to satisfy before calling the work complete — run after the backend effort lands)

- [ ] Free user buys Single → redirects to Stripe → pays → success page shows balance
- [ ] User subscribes Monthly → tier flips to `MONTHLY` on profile refresh
- [ ] Cancel Subscription button works and refreshes profile
- [ ] Analytics events appear in the backend's events table

- [ ] **Step 6: Final commit (if anything changed)**

```bash
git add -A
git commit -m "chore(checkout): final polish from smoke test"
```

---

## Summary

### Files created (8)
- `src/app/[locale]/checkout/layout.tsx`
- `src/app/[locale]/checkout/success/page.tsx`
- `src/app/[locale]/checkout/cancel/page.tsx`
- `src/components/payments/OutOfReportsModal.tsx`
- `src/lib/analytics/events.ts`

### Files modified (6)
- `src/lib/auth/AuthProvider.tsx` — extend `UserProfile`
- `src/components/payments/PricingCards.tsx` — 4 tiers + toggle
- `src/components/payments/CheckoutModal.tsx` — Stripe redirect + upsell
- `src/components/payments/BillingDashboard.tsx` — pack balance + cancel
- `src/components/layout/Header.tsx` — free banner
- `src/app/[locale]/pricing/page.tsx` — hero, FAQ, analytics on mount

### Commits expected: ~10

### NOT touched (backend owns these — see Appendix A)
- DB migrations
- `src/lib/credits/index.ts`
- Any `/api/**` route
- Stripe SDK integration
- Webhook handlers

### Ready to ship when
All 10 tasks complete + Task 10 smoke test #4 passes (which it will without backend). Full functionality unlocks the moment backend endpoints in Appendix A go live.
