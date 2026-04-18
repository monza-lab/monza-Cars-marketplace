# Checkout & Pricing — MVP Reports

**Status:** Approved 2026-04-18
**Author:** Edgar Navarro + Claude (brainstorming session)
**Related skill:** `monzahaus-monetization`
**Scope:** Frontend flow + Stripe Checkout integration for the MVP Reports monetization (Phase 1). Salon membership is explicitly out of scope.

---

## 1. Context & Goals

### What we're building

The complete pricing + checkout flow for MonzaHaus MVP monetization, replacing the current mock (`PricingCards.tsx` with 3 tiers, `CheckoutModal.tsx` with "Stripe integration coming soon").

### Why now

The product has Reports generation, Free tier (3/month), and scraping infrastructure live. What's missing is the money loop — no way for a user to pay, no subscription, no retention mechanism. Without this, growth is capped at free-tier usage.

### Success criteria

1. A Free user can pay and immediately use a paid Report.
2. A user can subscribe to Monthly and have credits reset each month (no rollover).
3. A subscriber can cancel from the billing dashboard and retain access until period end.
4. At least 3 of 5 defined entry points to checkout are live.
5. Webhook handles `checkout.session.completed` idempotently — no duplicate credit grants.
6. Analytics events are firing so we can iterate pricing after 30 days of data.

### Non-goals (explicitly out of scope)

- Salon membership (Watchlist/Arbitrage Feed/Garage/Early Access as a premium tier above Monthly)
- Dealer-specific pricing or multi-seat accounts
- Gift cards / referral program / promo codes
- Multi-currency display (USD only for MVP)
- Invoice/receipt customization beyond Stripe's default
- Tax handling beyond Stripe Tax defaults
- Refund self-service UI (handled via support for MVP)

---

## 2. Pricing Strategy — the tiers

### Final approved tiers

| Tier | Price | Units / Features | Per-report | Role |
|------|-------|------------------|------------|------|
| **Free** | $0 | 3 Reports/month perpetual | — | Funnel (already built) |
| **Single Report** | $29 | 1 Report one-time | $29 | Honest anchor, "try before subscribing" |
| **Reports Pack** | $99 | 5 Reports one-time, never expire, NO features | $19.80 | **Decoy** — dominated by Monthly in 4 of 5 dimensions |
| **Monthly** ⭐ | $19/mo | 10 Reports/mo (no rollover) + Watchlist + Alerts + Saved Searches | $1.90 | Target conversion tier |
| **Annual** | $179/year | Same as Monthly | $1.49 | Lock-in, 17% off = "2 months free" |

### Anchor narrative

Not BidBetter ($2/report). Not Carfax ($45/single). The competitive anchor is Porsche due diligence:

| Service | Price | What |
|---------|-------|------|
| Porsche PPS (factory docs) | $150 one-time | Production Specification |
| Porsche CTC | $500+ one-time | Numbers matching |
| Porsche Kardex | $235 one-time | Factory kardex copy |
| Pre-Purchase Inspection (PPI) | $200–500 one-time | Physical inspection |
| Hagerty Drivers Club | $70/year | Unlimited valuations |

**Canonical copy on pricing page:**
> A PPI costs $300. An official Porsche PPS, $150. Paying $19/month to know whether a $180k deal is fair is due diligence, not an expense.

### Why this specific tier structure (decisions captured)

- **Round pricing (no charm):** $29 / $99 / $19 / $179 — not $X.99. Porsche audience reads charm as mass-market.
- **Pack is decoy dominated:** loses to Monthly in per-rep (10×), monthly volume (0 vs 10), features (none vs 3), continuous access (no). Only "wins" on no-commitment.
- **Monthly includes feature bundle, not just volume:** Research (Compass LTV study) shows sub LTV drops below one-time LTV at AOV >$75 if sub is only "more units cheaper". Watchlist + Alerts + Saved Searches defend the sub's LTV.
- **Annual at 17% off = "2 months free":** standard industry framing. Reduces churn 40–60% vs monthly-only per Recurly benchmarks.
- **No unlimited in Monthly MVP:** reserved for Salon. 10/month limit forces natural upgrade path when Salon launches.

---

## 3. Architecture — Stripe Checkout Hosted

### Decision: Stripe Checkout (hosted), NOT Stripe Elements (embedded)

Rationale: for MVP, hosted Checkout is ~10× less engineering, PCI scope is Stripe's, Apple Pay / Google Pay / Link work out of the box, and testing is trivial. The redirect to Stripe is 2 seconds with the MonzaHaus logo applied — collector audience already trusts Stripe. Elements can be a Phase 2 decision if data shows the redirect hurts conversion.

### End-to-end flow

```
1. /pricing (4 cards + Monthly/Annual toggle)
   → user clicks a tier
                 ↓
2. Pre-checkout modal
   - Plan summary
   - Billing toggle (if Monthly: Monthly vs Annual)
   - Upsell nudge (if Pack: "Switch to Monthly" CTA)
   - [ Continue to Payment → ]
                 ↓
3. POST /api/checkout/create-session
   - Returns Stripe Checkout session URL
                 ↓
4. Redirect to Stripe Checkout hosted (MonzaHaus branded)
   - User enters card or uses Apple/Google Pay
                 ↓
5. Stripe redirects to /checkout/success?session_id=...
   - Meanwhile, Stripe webhook hits /api/stripe/webhook
   - Webhook activates credits / subscription in DB
                 ↓
6. /checkout/success (confirmation + CTA "Generate your first report")
   OR
   /checkout/cancel (if user backed out — no charge, try again)
```

### Stripe objects to create

- **Products:** "Single Report", "Reports Pack", "Monza Haus Monthly", "Monza Haus Annual"
- **Prices:**
  - `price_single_29` — one-time $29
  - `price_pack_99` — one-time $99
  - `price_monthly_19` — recurring $19/mo
  - `price_annual_179` — recurring $179/year
- **Webhook endpoint:** `/api/stripe/webhook` — subscribe to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

Stripe Price IDs get loaded via env vars:
- `STRIPE_PRICE_SINGLE`
- `STRIPE_PRICE_PACK`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_ANNUAL`

---

## 4. Entry Points — where users hit checkout

| # | Entry point | Location | Trigger |
|---|-------------|----------|---------|
| 1 | **`/pricing` page** | Main CTA per card | Direct navigation |
| 2 | **Out-of-Reports modal** | Free user tries to generate Report #4 of the month | Paywall on action |
| 3 | **Header banner** | "X Reports left this month — Upgrade" | Free user with ≤3 remaining |
| 4 | **Report detail inline CTA** | Below report content | Any report viewed — "Save to Watchlist → Activate Monthly" |
| 5 | **Account / Billing page** | Upgrade button | Existing free user or pack-only user |

MVP must ship #1, #2, and #5. Entry points #3 and #4 are nice-to-have for the initial release.

---

## 5. Components — what to build / modify

### New components

| Component | Purpose |
|-----------|---------|
| `src/app/api/checkout/create-session/route.ts` | POST endpoint: receives `planId`, returns Stripe Checkout session URL |
| `src/app/api/stripe/webhook/route.ts` | Stripe webhook handler with signature verification + idempotency |
| `src/app/[locale]/checkout/success/page.tsx` | Post-payment confirmation + CTA to first action |
| `src/app/[locale]/checkout/cancel/page.tsx` | Cancel state — "no charge, try again" |
| `src/components/payments/OutOfReportsModal.tsx` | Paywall modal when Free user hits their monthly cap |
| `src/lib/stripe/client.ts` | Stripe SDK initialization + price ID mapping |
| `src/lib/stripe/webhook-handlers.ts` | Pure functions for each event type, easier to test |

### Modified components

| Component | Current | Change |
|-----------|---------|--------|
| `PricingCards.tsx` | 3 mock tiers, no toggle | Rewrite: 4 tiers (Free / Single / Pack / Monthly), Monthly/Annual toggle |
| `CheckoutModal.tsx` | "Coming soon" mock | Rewrite: plan summary + upsell nudge + "Continue to Payment" that calls `/api/checkout/create-session` |
| `BillingDashboard.tsx` | Mock | Show current tier, next reset date, cancel subscription button, packs remaining, transaction history |
| `Header.tsx` | No banner | Add conditional "X Reports left — Upgrade" banner for Free users |
| `src/lib/credits/index.ts` | `creditsBalance` + `tier: FREE|PRO` | Extend tier to `FREE|PACK_OWNER|MONTHLY|ANNUAL`, add `monthlyResetDate` for subscribers (distinct from Free tier reset), add separate `packCreditsBalance` so Monthly resets don't wipe pack credits |

### Database changes

- Extend `User.tier` enum: `FREE | PACK_OWNER | MONTHLY | ANNUAL`
- Add `User.packCreditsBalance` (nullable, default 0) — packs are separate from Free/Monthly balance
- Add `User.stripeCustomerId` (nullable)
- Add `User.stripeSubscriptionId` (nullable)
- Add `User.subscriptionStatus` (`active | past_due | canceled | null`)
- Add `User.subscriptionPeriodEnd` (timestamp, when current billing period ends)
- Consumption order when generating a report: `packCreditsBalance` first (never expires), then the regular `creditsBalance` (Free/Monthly pool)
- `CreditTransaction` table already exists — extend `type` enum to include `STRIPE_PACK_PURCHASE`, `STRIPE_SUBSCRIPTION_ACTIVATION`, `STRIPE_MONTHLY_RESET`, `STRIPE_SUBSCRIPTION_CANCELED`

---

## 6. Pre-Checkout Modal — detailed UX

### Monthly plan selected

```
┌──────────────────────────────────────┐
│  Monza Haus Monthly                  │
│  10 Reports/month + Watchlist        │
├──────────────────────────────────────┤
│  Choose billing:                     │
│  ● Monthly  $19/mo                   │
│  ○ Annual   $179/year  (save $49)    │
│     ≈ 2 months free                  │
├──────────────────────────────────────┤
│  Included:                           │
│  ✓ 10 Reports per month              │
│  ✓ Watchlist (unlimited saves)       │
│  ✓ Email Alerts on watched cars      │
│  ✓ Saved Searches                    │
│  ✓ Cancel anytime                    │
├──────────────────────────────────────┤
│  [ Continue to Payment → ]           │
│  🔒 Secure · Stripe · 30-day refund  │
└──────────────────────────────────────┘
```

### Pack plan selected — shows upsell nudge

```
┌──────────────────────────────────────┐
│  Reports Pack                        │
│  5 Reports · never expire            │
├──────────────────────────────────────┤
│  💡 Monthly at $19/mo gives you 10   │
│     Reports + Watchlist + Alerts     │
│     for 81% less than this pack.     │
│     [ Switch to Monthly → ]          │
├──────────────────────────────────────┤
│  Total:  $99  one-time               │
│  [ Continue to Payment → ]           │
│  🔒 Secure · Stripe · 30-day refund  │
└──────────────────────────────────────┘
```

### Single Report selected — minimal friction

```
┌──────────────────────────────────────┐
│  Single Report  —  $29               │
│  1 Porsche investment analysis       │
├──────────────────────────────────────┤
│  [ Continue to Payment → ]           │
│  🔒 Secure · Stripe · 30-day refund  │
└──────────────────────────────────────┘
```

---

## 7. Webhook Handlers — what each event triggers

### `checkout.session.completed`

Primary event. Idempotent via `session.id` stored in `CreditTransaction.stripePaymentId` (unique constraint).

- **One-time (Single or Pack):** add credits to `packCreditsBalance`, set tier to `PACK_OWNER` if user was Free, write `CreditTransaction` with `STRIPE_PACK_PURCHASE`.
- **Subscription activation (Monthly or Annual):** set tier to `MONTHLY` or `ANNUAL`, store `stripeCustomerId` + `stripeSubscriptionId` + `subscriptionPeriodEnd`, set `creditsBalance = 10`, write `CreditTransaction` with `STRIPE_SUBSCRIPTION_ACTIVATION`.

### `customer.subscription.updated`

Update `subscriptionStatus` and `subscriptionPeriodEnd`. If billing period renewed (Monthly = new month, Annual = new year), reset `creditsBalance = 10` for `MONTHLY`, or `= 10` for `ANNUAL` (because annual is still 10/month allowance, delivered monthly). Write `CreditTransaction` with `STRIPE_MONTHLY_RESET`.

### `customer.subscription.deleted`

Set tier back to `FREE`, clear `stripeSubscriptionId`, keep `packCreditsBalance` intact (never expires). `creditsBalance` drops to Free monthly reset schedule. Write `CreditTransaction` with `STRIPE_SUBSCRIPTION_CANCELED`.

### `invoice.payment_failed`

Set `subscriptionStatus = past_due`. User retains access until period end (Stripe's default dunning handles retries). Email the user (later — out of scope for MVP; Stripe sends its own).

### Idempotency

Every webhook handler checks if `CreditTransaction` with the same `stripePaymentId` / `stripeEventId` already exists. If yes, return 200 immediately — no double-grant.

---

## 8. States to handle

| State | Trigger | Handling |
|-------|---------|----------|
| Card declined | Stripe returns failure | User stays in Stripe UI, sees Stripe's error; if backs out → `/checkout/cancel` |
| User closes Stripe tab | Session abandoned | Stripe session expires in 24h (default); treated as cancel |
| Webhook arrives before redirect | Race condition | `/checkout/success` polls `/api/user/profile` for up to 10s; if webhook wins first, success page shows credits; if not yet, shows "processing" state with retry |
| Webhook duplicate | Stripe retries | Idempotent by `stripeEventId` — second call is 200 no-op |
| User already has Monthly, clicks Monthly again | Duplicate subscription attempt | Before calling `create-session`, check user's current tier; if already subscribed, show "You're already on Monthly" + link to Billing |
| User has Pack credits AND buys Monthly | Valid coexistence | Consume packs first (never expire), then Monthly pool |
| User cancels sub | Clicks "Cancel" in Billing | Call Stripe cancel-at-period-end; UI shows "Canceling — access until [date]"; webhook finalizes when period ends |
| User's card fails at renewal | `invoice.payment_failed` | Stripe dunning handles; user stays active until final failure; then `subscription.deleted` fires |

---

## 9. Analytics Events

Fired from the frontend (or via `/api/analytics` endpoint) for pricing iteration:

| Event | Payload |
|-------|---------|
| `pricing_page_viewed` | `{ source: 'direct' | 'out_of_reports' | 'header' | 'report_cta' | 'billing' }` |
| `plan_clicked` | `{ planId, billingCycle?: 'monthly' | 'annual' }` |
| `checkout_started` | `{ planId, amount, sessionId }` |
| `checkout_completed` | `{ planId, amount, sessionId }` |
| `checkout_cancelled` | `{ planId, reason?: 'user_back' | 'card_declined' | 'timeout' }` |
| `upsell_shown` | `{ context: 'pack_modal', fromPlan: 'pack', toPlan: 'monthly' }` |
| `upsell_converted` | `{ context, fromPlan, toPlan }` |
| `subscription_canceled` | `{ tier, monthsSubscribed }` |

MVP can log to Supabase `analytics_events` table (schema: `id, user_id, event_name, payload jsonb, created_at`). Proper product analytics tool (PostHog / Mixpanel) is Phase 2.

---

## 10. Implementation Order

1. **Stripe setup:** create Products + Prices in Stripe Dashboard (test mode first), store price IDs in env
2. **`PricingCards.tsx` rewrite:** 4 tiers + Monthly/Annual toggle
3. **`/api/checkout/create-session`:** takes planId, creates Stripe session, returns URL
4. **`CheckoutModal.tsx` rewrite:** pre-checkout summary + upsell + call to API
5. **`/api/stripe/webhook`:** handlers for all 4 events, idempotent
6. **DB migrations:** add columns on User + transaction types
7. **`/checkout/success` + `/checkout/cancel` pages**
8. **`OutOfReportsModal.tsx` + integrate into report generation flow**
9. **`BillingDashboard.tsx` update:** current tier, cancel button, pack balance, transaction history
10. **`Header.tsx` banner for Free users**
11. **Analytics events**
12. **End-to-end test with Stripe CLI webhook forwarding**

Each step is independently testable. Steps 1–4 unblock the happy path for one-time purchases. Steps 5–8 close the subscription loop.

---

## 11. Testing Strategy

- **Stripe Test Mode** end-to-end before any live switch.
- **Stripe CLI webhook forwarding** (`stripe listen --forward-to localhost:3000/api/stripe/webhook`) during local dev.
- **Playwright E2E tests** for: free user hits paywall → checkout → success → report generation works.
- **Unit tests** for webhook handlers (idempotency, credit math, tier transitions).
- **Manual QA matrix:** Free → Single, Free → Pack, Free → Monthly, Monthly → cancel, Monthly → Annual upgrade, Pack + Monthly coexistence.

---

## 12. Copy & Positioning

Every user-facing string is finalized in this spec. No placeholder copy. Pricing page hero follows the skill `monzahaus-monetization` canonical copy. Pre-checkout upsell uses the exact wording in Section 6. Out-of-Reports modal uses:

> You've used your 3 Free Reports this month. Your next reset is [date]. Upgrade to Monthly ($19/mo, 10 reports + Watchlist + Alerts) or buy a Pack that never expires.

Success page (Monthly):
> ✓ Welcome to Monza Haus Monthly. 10 Reports loaded. Watchlist unlocked. [ Generate your first report → ] [ Set up your first Watchlist → ]

Success page (Pack or Single):
> ✓ Your Reports are ready. [count] Reports added to your balance — never expire. [ Generate your first report → ]

Cancel page:
> No charge was made. Pick up where you left off? [ Back to Pricing → ]

---

## 13. Open items for Phase 2 (post-MVP, tracked separately)

- Salon tier launch (Watchlist expands to Arbitrage Feed, adds Garage, Early Access, Pre-auction Briefs)
- Dealer pricing (inventory-based, following Carfax precedent)
- Promo codes / referral program
- Annual plan framing A/B test ("2 months free" vs "17% off")
- Stripe Elements evaluation if Checkout redirect hurts conversion
- Multi-currency display based on visitor geo
- PostHog / Mixpanel migration for analytics
- Per-report tier variation (some reports cost 2 units for premium analysis)
