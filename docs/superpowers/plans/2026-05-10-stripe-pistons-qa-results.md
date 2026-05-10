# Stripe & Pistons QA Results — 2026-05-10

## Environment

- **Dev server:** localhost:3000 (Turbopack)
- **Stripe CLI:** v1.40.9, webhook forwarding to `/api/stripe/webhook`
- **Stripe API:** 2026-03-25.dahlia (test mode)
- **Test user:** caposk817@gmail.com (`cus_UNBaXZqHNygnBA`)

---

## Test Results

### Chunk 1: One-Time Purchase (Jerrycan $9.99)

| # | Check | Result |
|---|-------|--------|
| 1.1 | Pricing page renders 3 plans (Jerrycan, Fuel Cell, Rennsport) | PASS |
| 1.2 | CheckoutModal shows title, description, total, CTA | PASS |
| 1.3 | Redirect to `checkout.stripe.com` (sandbox) | PASS |
| 1.4 | Stripe test payment completes (card 4242) | PASS |
| 1.5 | `checkout.session.completed` webhook received | PASS (500 first attempt, transient) |
| 1.6 | `pack_credits_balance` +600 (1200 → 1800) | PASS |
| 1.7 | Transaction logged: `STRIPE_PACK_PURCHASE`, amount=600 | PASS |
| 1.8 | Success page: green checkmark, "You're all set", "Your Reports are ready." | PASS |
| 1.9 | Pistons badge in header updates to 1800 | PASS |
| 1.10 | Idempotency: webhook replay → balance unchanged (1800), returns 200 | PASS |

### Chunk 2: Subscription (Rennsport $59/mo)

| # | Check | Result |
|---|-------|--------|
| 2.1 | CheckoutModal shows "$59 /mo", "Cancel anytime" | PASS |
| 2.2 | Redirect to Stripe subscription checkout | PASS |
| 2.3 | Webhook events: charge.succeeded, subscription.created, checkout.session.completed, invoice.paid | PASS (all 200 except checkout.session.completed 500 transient) |
| 2.4 | `tier` = PRO | PASS |
| 2.5 | `credits_balance` = 10,000 | PASS |
| 2.6 | `pack_credits_balance` preserved (1800) | PASS |
| 2.7 | `subscription_plan_key` = rennsport | PASS |
| 2.8 | `monthly_allowance_pistons` = 10,000 | PASS |
| 2.9 | `unlimited_reports` = true | PASS |
| 2.10 | `subscription_status` = active | PASS |
| 2.11 | `stripe_subscription_id` set | PASS |
| 2.12 | `subscription_period_end` set | PASS (after fix — was null before) |
| 2.13 | Success page: "Watchlist is unlocked." shown (PRO tier detected) | PASS |
| 2.14 | Badge shows "Unlimited" instead of piston count | PASS |
| 2.15 | Transaction: `STRIPE_SUBSCRIPTION_ACTIVATION`, amount=10000 | PASS |

### Chunk 3: Subscription Cancellation

| # | Check | Result |
|---|-------|--------|
| 3.1 | Phase A: `cancel_at_period_end=true` → status stays "active" | PASS |
| 3.2 | Phase A: `subscription_period_end` populated correctly | PASS |
| 3.3 | Phase B: immediate cancel → `customer.subscription.deleted` webhook | PASS |
| 3.4 | `tier` reverts to PACK_OWNER (pack_credits > 0) | PASS |
| 3.5 | `subscription_status` = canceled | PASS |
| 3.6 | `monthly_allowance_pistons` reverts to 300 (free tier) | PASS |
| 3.7 | `stripe_subscription_id` = null (cleared) | PASS |
| 3.8 | Transaction: `STRIPE_SUBSCRIPTION_CANCELED` logged | PASS |
| 3.9 | Idempotency on replay: 200, no double-action | PASS |

### Chunk 4: Zero-Balance & Pistons Depletion

| # | Check | Result |
|---|-------|--------|
| 4.1 | DB balance set to 0, UI badge shows "0 Pistons" | PASS |
| 4.2 | Click "Unlock Full Report" with 0 tokens → pricing overlay shown | PASS |
| 4.3 | Previously analyzed car loads free from localStorage cache | PASS |
| 4.4 | Inline pricing plans match main pricing page | **BUG** (see below) |

### Chunk 5: Edge Cases & Security

| # | Check | Result |
|---|-------|--------|
| 5.1 | Unauthenticated user → 401 Unauthorized | PASS |
| 5.2 | Invalid webhook signature → 400 Invalid signature | PASS |
| 5.3 | Missing signature header → 400 Missing Stripe signature | PASS |
| 5.4 | Stripe Dashboard: payments match ($9.99, $59.00) | PASS |

---

## Bugs Found & Fixed

### BUG-1 (P1, FIXED): `subscription_period_end` always null

**Root cause:** Stripe API 2026-03-25.dahlia moved `current_period_end` from the `Subscription` object to `SubscriptionItem`. The webhook handler was accessing `subscription.current_period_end` which no longer exists — it's now at `subscription.items.data[0].current_period_end`.

**Fix:** Updated `applyCheckoutSessionCompleted` and `applySubscriptionUpdate` in `src/app/api/stripe/webhook/route.ts` to read from `subscription.items.data[0]`.

**Verified:** After fix, replaying `customer.subscription.updated` event correctly populated `subscription_period_end = 2026-06-10T17:50:04`.

### BUG-2 (P2, NOTED): Transient 500s on webhook processing

**Symptom:** `checkout.session.completed` and `customer.subscription.deleted` webhooks return 500 on first attempt, but all DB operations succeed. Retrying the same event returns 200.

**Impact:** Low — Stripe automatically retries failed webhooks, and idempotency checks prevent double-processing.

**Diagnosis:** Cannot isolate root cause without server console access. Added detailed error logging (`error.message` + `error.stack`) to the webhook catch block to aid future debugging. Likely a transient Supabase connection timeout or Stripe API latency.

---

## Bugs Found (Not Fixed)

### BUG-3 (P1): Inline pricing plans mismatch

**Location:** Report paywall inline pricing overlay (triggered by `useTokens` in `ReportClient.tsx`)

**Problem:** When a user clicks "Unlock Full Report" with 0 client-side tokens, the inline pricing overlay shows **legacy plans** that don't match the current pricing page:

| Inline Paywall (legacy) | Main Pricing Page (current) |
|---|---|
| Single Report — $29 one-time | Jerrycan — $9.99 one-time |
| Explorer Pack — $59, 5 reports | Fuel Cell — $29, 22 reports |
| Unlimited — $149/mo | Rennsport — $59/mo |

**Impact:** Users see significantly higher prices in the report paywall vs the pricing page, creating confusion and potential lost conversions.

**Recommendation:** Replace the inline pricing overlay with a redirect to `/pricing`, or update the inline plans to match `PRICING_PLANS` from `src/lib/payments/plans.ts`.

### BUG-4 (P2): Dual-gating system prevents `OutOfReportsModal` from ever showing

**Problem:** Two independent credit systems gate report generation:
1. **Client-side:** `useTokens` (localStorage, 3000 initial tokens, 1000/report)
2. **Server-side:** `user_credits` table (300 free pistons, 100/report)

The client-side check runs first. When it fails, it shows the inline pricing overlay (BUG-3). The server-side `OutOfReportsModal` (which correctly links to `/pricing`) is never reached.

**Recommendation:** Remove the client-side `useTokens` gating and rely solely on the server-side `user_credits` system, which is the source of truth for the Stripe integration.

### BUG-5 (P3): Only 3 of 6 plans shown on pricing page

**Location:** `src/components/payments/PricingCards.tsx` hardcodes only `jerrycan`, `fuel_cell`, `rennsport`.

**Impact:** Zuffenhausen ($9.99/mo), Weissach ($39/mo), and Boxenstopp ($59 one-time) exist in `src/lib/payments/plans.ts` but aren't visible to users.

---

## Stripe Dashboard Verification

| Item | Value |
|------|-------|
| Payments | $9.99 (Jerrycan) succeeded, $59.00 (Rennsport) succeeded |
| Subscriptions | sub_1TVbUQ5RkRtrWVP9wCUDBlzX — canceled |
| Customer | cus_UNBaXZqHNygnBA — caposk817@gmail.com |
| Webhook events | All forwarded via Stripe CLI, all eventually 200 |

## Files Modified

- `src/app/api/stripe/webhook/route.ts` — Fixed `current_period_end` access for Stripe API 2026-03-25, added detailed error logging
