# Stripe & Pistons Payment Flow — QA Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End-to-end QA of the full Stripe payment flow in sandbox mode — from zero pistons through purchase, webhook processing, piston crediting, consumption, and edge cases (declines, duplicates, cancellations).

**Architecture:** Next.js API routes create Stripe checkout sessions → Stripe hosted checkout → Stripe fires webhooks back to `/api/stripe/webhook` → webhook handler credits pistons to `user_credits` table in Supabase → UI polls and reflects updated balance.

**Tech Stack:** Stripe (test mode), Supabase (user_credits + credit_transactions tables), Next.js API routes, Stripe CLI (for local webhook forwarding)

---

## CRITICAL BUGS FOUND DURING REVIEW (Fix Before Testing)

### Bug 1: userId Mismatch — Webhook Will Fail (BLOCKER)

**Location:** `src/app/api/stripe/webhook/route.ts` → `src/lib/reports/queries.ts`

**Problem:** The `create-session` route stores `metadata.appUserId = user.id` (Supabase auth UUID). The webhook passes this to `grantStripePurchase(appUserId, ...)` and `activateStripeSubscription(appUserId, ...)`. These functions query `.eq("id", userId)` — but `user_credits.id` is an **auto-generated UUID** (from `gen_random_uuid()`), NOT the same as `supabase_user_id`.

**Impact:** Every webhook will fail with "User not found". No pistons will ever be credited.

**Fix:** In `grantStripePurchase()` and `activateStripeSubscription()`, change:
```typescript
.eq("id", userId)  // WRONG — userId is supabase auth UUID
```
to:
```typescript
.eq("supabase_user_id", userId)  // CORRECT
```

Same fix needed in `deactivateStripeSubscription()` and `updateStripeSubscriptionStatus()`.

---

### Bug 2: Success Page Doesn't Detect PRO Tier

**Location:** `src/app/[locale]/checkout/success/page.tsx:14-17`

**Problem:**
```typescript
const profileLoaded =
  profile?.tier === "MONTHLY" ||
  profile?.tier === "ANNUAL" ||
  profile?.tier === "PACK_OWNER"
```

But `activateStripeSubscription()` sets `tier: "PRO"`. Since "PRO" is not checked, the success page will always wait the full 10 seconds (timeout) for subscription purchases, and `isSubscription` ("Watchlist is unlocked") will never display.

**Fix:** Add `"PRO"` to both checks:
```typescript
const profileLoaded =
  profile?.tier === "MONTHLY" ||
  profile?.tier === "ANNUAL" ||
  profile?.tier === "PRO" ||
  profile?.tier === "PACK_OWNER"

const isSubscription = profile?.tier === "MONTHLY" || profile?.tier === "ANNUAL" || profile?.tier === "PRO"
```

---

### Bug 3: No Subscription Renewal Handler

**Location:** `src/app/api/stripe/webhook/route.ts`

**Problem:** The webhook only handles `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`. There is NO `invoice.paid` handler. When a subscription renews (month 2+), Stripe fires `invoice.paid` — but the app never resets `credits_balance` back to the monthly allowance.

**Impact:** After month 1, subscriber pistons never replenish automatically.

**Fix:** Add `invoice.paid` handler that resets `credits_balance = monthly_allowance_pistons` when the invoice belongs to a recurring subscription (not the first invoice).

---

## Prerequisites — Environment Setup

These must be completed before any test case can run.

### Task 0: Configure Stripe Test Environment

**Files:**
- Modify: `.env.local`

- [ ] **Step 0.1: Add Stripe test keys to `.env.local`**

Get keys from [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/test/apikeys) (ensure "Test mode" toggle is ON).

Add to `.env.local`:
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # Will be set in Step 0.3
```

- [ ] **Step 0.2: Install Stripe CLI**

```bash
# Windows (scoop)
scoop install stripe

# Or download from https://docs.stripe.com/stripe-cli
```

Verify:
```bash
stripe --version
```

- [ ] **Step 0.3: Authenticate Stripe CLI and start webhook forwarding**

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI will print: `Ready! Your webhook signing secret is whsec_...`
Copy that `whsec_...` value into `.env.local` as `STRIPE_WEBHOOK_SECRET`.

- [ ] **Step 0.4: Restart dev server to pick up new env vars**

```bash
# Kill existing server, then:
npm run dev
```

- [ ] **Step 0.5: Verify baseline — check current user state in Supabase**

Query the `user_credits` table for the test user:
```sql
SELECT id, supabase_user_id, email, tier, credits_balance, pack_credits_balance,
       monthly_allowance_pistons, stripe_customer_id, stripe_subscription_id,
       subscription_status, subscription_plan_key, unlimited_reports
FROM user_credits
WHERE email = '<your-test-user-email>';
```

Record baseline values. If no row exists, the system will auto-create one on first checkout.

---

## Chunk 1: One-Time Purchase Flow (Pistons Top-Up)

Tests the `billingMode: "payment"` path — buying a Jerrycan/Fuel Cell/Boxenstopp pack.

### Task 1: Happy Path — Buy a Jerrycan ($9.99 / 600 Pistons)

**Files involved (read-only for QA):**
- `src/components/payments/PricingCards.tsx` — UI trigger
- `src/components/payments/CheckoutModal.tsx` — modal + API call
- `src/app/api/checkout/create-session/route.ts` — creates Stripe session
- `src/app/api/stripe/webhook/route.ts` — processes `checkout.session.completed`
- `src/lib/reports/queries.ts:526-590` — `grantStripePurchase()`
- `src/app/[locale]/checkout/success/page.tsx` — success page

- [ ] **Step 1.1: Record pre-purchase balances**

Query Supabase:
```sql
SELECT credits_balance, pack_credits_balance, tier, stripe_customer_id
FROM user_credits WHERE email = '<test-user>';
```

Note: `pack_credits_balance` = X (this is what should increase by 600).

- [ ] **Step 1.2: Navigate to pricing page**

Open `http://localhost:3000/en/pricing` in browser.
Verify all 6 plan cards render (3 subscriptions + 3 one-time packs).

- [ ] **Step 1.3: Click "Buy Jerrycan" button**

Expected: `CheckoutModal` opens showing:
- Title: "Jerrycan"
- Description: "6 reports · never expire"
- Total: $9.99 USD
- "Continue to Payment — $9.99" button

- [ ] **Step 1.4: Click "Continue to Payment"**

Expected:
- Button shows spinner + "Redirecting to Stripe…"
- Browser redirects to `checkout.stripe.com/...` (Stripe hosted page)
- Console in `stripe listen` terminal shows: `checkout.session.created`

If redirect fails and goes to `/checkout/payment?plan=jerrycan` → Stripe keys are not configured correctly. Check `.env.local`.

- [ ] **Step 1.5: Complete payment on Stripe checkout page**

Enter test card details:
- Card: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., `12/30`)
- CVC: `123`
- Name: Any
- Country: US (or any)

Click "Pay $9.99".

- [ ] **Step 1.6: Verify redirect to success page**

Expected: Browser redirects to `http://localhost:3000/en/checkout/success?session_id=cs_test_...`

Page should show:
1. First: Spinner + "Processing payment" + "Hang on — Stripe is confirming your purchase"
2. After webhook processes (1-5 seconds): Green checkmark + "You're all set" + "Your Reports are ready."

- [ ] **Step 1.7: Verify webhook received in Stripe CLI terminal**

Expected output in `stripe listen` terminal:
```
  --> checkout.session.completed [evt_...]
  <-- [200] POST http://localhost:3000/api/stripe/webhook
```

If `[500]` or `[400]` → check Next.js server logs for errors.

- [ ] **Step 1.8: Verify database state**

**⚠️ BLOCKER (Bug 1):** If Bug 1 is NOT fixed, this step will FAIL. The webhook handler will error with "User not found" because it queries `user_credits.id` with a `supabase_user_id` value. Fix Bug 1 first.

```sql
SELECT credits_balance, pack_credits_balance, tier, stripe_customer_id
FROM user_credits WHERE email = '<test-user>';
```

Expected (after Bug 1 fix):
- `pack_credits_balance` = X + 600 (increased by 600)
- `tier` = 'PACK_OWNER' (if was 'FREE' before) or unchanged (if already subscribed)
- `stripe_customer_id` is now set (e.g., `cus_test_...`)

- [ ] **Step 1.9: Verify transaction logged**

```sql
SELECT amount, type, stripe_payment_id, description, created_at
FROM credit_transactions
WHERE user_id = '<user_credits_id>'
ORDER BY created_at DESC LIMIT 5;
```

Expected: Row with `type = 'STRIPE_PACK_PURCHASE'`, `amount = 600`, `stripe_payment_id = 'cs_test_...'`

- [ ] **Step 1.10: Verify Stripe Dashboard**

Open [Stripe Dashboard → Payments](https://dashboard.stripe.com/test/payments).
Confirm a $9.99 succeeded payment appears with metadata: `appUserId`, `planId: jerrycan`.

---

### Task 2: Idempotency — Double Webhook Delivery

Verifies that replaying the same webhook event doesn't double-credit pistons.

- [ ] **Step 2.1: Record current pack_credits_balance**

```sql
SELECT pack_credits_balance FROM user_credits WHERE email = '<test-user>';
```

Note value Y.

- [ ] **Step 2.2: Replay the last webhook event**

In Stripe CLI, use:
```bash
stripe events resend evt_<id-from-step-1.7>
```

Or from Stripe Dashboard → Developers → Events → Find the `checkout.session.completed` → "Resend".

- [ ] **Step 2.3: Verify balance unchanged**

```sql
SELECT pack_credits_balance FROM user_credits WHERE email = '<test-user>';
```

Expected: Still Y (not Y + 600). The `grantStripePurchase()` function checks `credit_transactions.stripe_payment_id` for duplicates (line 534-548 in `queries.ts`).

---

### Task 3: Declined Payment — Card Failure

- [ ] **Step 3.1: Navigate to pricing → Select Fuel Cell → Continue to Payment**

Same flow as Task 1 steps 1.2-1.4, but choose "Fuel Cell" ($29).

- [ ] **Step 3.2: Use declined test card**

Enter:
- Card: `4000 0000 0000 0002` (generic decline)
- Expiry: `12/30`, CVC: `123`

Click Pay.

- [ ] **Step 3.3: Verify Stripe shows decline error**

Expected: Stripe checkout page shows red error "Your card was declined."
User stays on Stripe page — NOT redirected to success.

- [ ] **Step 3.4: Verify no webhook fired / no DB change**

Check `stripe listen` terminal: No `checkout.session.completed` event.
Check DB: `pack_credits_balance` unchanged.

- [ ] **Step 3.5: Test insufficient funds card**

Repeat with card `4000 0000 0000 9995` (insufficient funds).
Expected: Error "Your card has insufficient funds."

---

### Task 4: Unauthenticated User — Access Control

- [ ] **Step 4.1: Open pricing page in incognito/logged-out browser**

Navigate to `http://localhost:3000/en/pricing`.

- [ ] **Step 4.2: Click any plan's buy button**

Expected: User is either redirected to login or the CheckoutModal's `goToStripe()` call receives a 401 from `/api/checkout/create-session` (the route checks `supabase.auth.getUser()`).

Verify the error is shown in the modal (not a crash).

---

## Chunk 2: Subscription Flow

Tests the `billingMode: "subscription"` path — Zuffenhausen/Weissach/Rennsport plans.

### Task 5: Happy Path — Subscribe to Weissach ($39/mo / 5,000 Pistons)

- [ ] **Step 5.1: Record pre-subscription state**

```sql
SELECT credits_balance, pack_credits_balance, tier, subscription_status,
       subscription_plan_key, monthly_allowance_pistons, unlimited_reports,
       stripe_subscription_id
FROM user_credits WHERE email = '<test-user>';
```

- [ ] **Step 5.2: Navigate to pricing → Click "Choose Weissach"**

CheckoutModal should show:
- Title: "Weissach"
- "$39/mo"
- "Continue to Payment — $39"

- [ ] **Step 5.3: Complete Stripe checkout with test card 4242...**

Same as Task 1, Step 1.5. Pay $39.

- [ ] **Step 5.4: Verify success page and webhook**

Same checks as Task 1 Steps 1.6-1.7.

**KNOWN BUG (Bug 2):** Success page checks for `MONTHLY`/`ANNUAL`/`PACK_OWNER` tiers but NOT `PRO`. Since `activateStripeSubscription()` sets tier to `PRO`, the success page will wait the full 10-second timeout before showing "You're all set". The "Watchlist is unlocked" text will NOT appear. Fix Bug 2 first, then re-test.

- [ ] **Step 5.5: Verify database state**

```sql
SELECT credits_balance, pack_credits_balance, tier, subscription_status,
       subscription_plan_key, monthly_allowance_pistons, unlimited_reports,
       stripe_subscription_id, subscription_period_end
FROM user_credits WHERE email = '<test-user>';
```

Expected:
- `tier` = 'PRO'
- `credits_balance` = 5000 (monthly allowance)
- `subscription_plan_key` = 'weissach'
- `monthly_allowance_pistons` = 5000
- `unlimited_reports` = false
- `subscription_status` = 'active'
- `stripe_subscription_id` = 'sub_test_...'
- `subscription_period_end` = ~30 days from now
- `pack_credits_balance` = unchanged (pack credits preserved separately)

- [ ] **Step 5.6: Verify transaction logged**

```sql
SELECT amount, type, stripe_payment_id
FROM credit_transactions
WHERE user_id = '<user_credits_id>'
ORDER BY created_at DESC LIMIT 1;
```

Expected: `type = 'STRIPE_SUBSCRIPTION_ACTIVATION'`, `stripe_payment_id = 'cs_test_...'`

- [ ] **Step 5.7: Verify in Stripe Dashboard**

Check [Subscriptions](https://dashboard.stripe.com/test/subscriptions):
- Active subscription for the test customer
- $39/month, status: active
- Metadata: `appUserId`, `planId: weissach`

---

### Task 6: Subscription Cancellation

**Note:** The app uses `cancel_at_period_end: true` — this does NOT immediately cancel. The subscription stays `active` until the billing period ends. Two-phase behavior:

**Phase A — Immediate (cancel request):**

- [ ] **Step 6.1: Cancel subscription via API**

```bash
curl -X POST http://localhost:3000/api/billing/cancel-subscription \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie>"
```

- [ ] **Step 6.2: Verify immediate webhook**

Stripe CLI should show:
```
  --> customer.subscription.updated [evt_...]  (status still "active", cancel_at_period_end=true)
```

NOTE: `customer.subscription.deleted` will NOT fire now — only at period end.

- [ ] **Step 6.3: Verify database state (immediate)**

```sql
SELECT tier, subscription_status, subscription_period_end
FROM user_credits WHERE email = '<test-user>';
```

Expected:
- `subscription_status` = 'active' (unchanged — still active until period end)
- `tier` = 'PRO' (unchanged)
- User keeps pistons until period ends

**Phase B — At period end (deactivation):**

To simulate period end, cancel immediately from Stripe Dashboard (Subscriptions → Cancel immediately) instead of at period end.

- [ ] **Step 6.4: Force immediate cancellation via Stripe Dashboard**

In Stripe Dashboard → Subscriptions → find the test sub → "Cancel subscription" → "Cancel immediately".

- [ ] **Step 6.5: Verify deleted webhook**

```
  --> customer.subscription.deleted [evt_...]
```

- [ ] **Step 6.6: Verify database state after full cancellation**

```sql
SELECT tier, subscription_status, monthly_allowance_pistons, credits_balance
FROM user_credits WHERE email = '<test-user>';
```

Expected per `deactivateStripeSubscription()`:
- `tier` = 'PACK_OWNER' (if pack_credits_balance > 0) or 'FREE' (if pack = 0)
- `monthly_allowance_pistons` = 300 (reverted to free tier default)
- `subscription_status` = 'canceled'

---

### Task 6B: Subscription Renewal (Month 2+)

**KNOWN BUG (Bug 3):** No `invoice.paid` handler exists. This test documents the gap.

- [ ] **Step 6B.1: Simulate renewal via Stripe Dashboard**

After subscribing, use Stripe Dashboard → Subscriptions → test subscription → "Create upcoming invoice" or use Stripe Test Clocks to advance time by 1 month.

- [ ] **Step 6B.2: Verify invoice.paid webhook**

Stripe CLI should show:
```
  --> invoice.paid [evt_...]
```

- [ ] **Step 6B.3: Verify credits NOT reset (BUG)**

```sql
SELECT credits_balance, monthly_allowance_pistons FROM user_credits WHERE email = '<test-user>';
```

Expected (current buggy behavior): `credits_balance` is NOT reset to `monthly_allowance_pistons`. It stays at whatever value it was depleted to.

**After Bug 3 is fixed:** `credits_balance` should reset to `monthly_allowance_pistons` (e.g., 5000 for Weissach).

---

## Chunk 3: Pistons Consumption & Zero-Balance Flow

Tests the debit side — using pistons for reports and the Advisor, then hitting zero.

### Task 7: Consume Pistons via Report Generation

- [ ] **Step 7.1: Record current total balance**

```sql
SELECT credits_balance, pack_credits_balance,
       (credits_balance + pack_credits_balance) as total
FROM user_credits WHERE email = '<test-user>';
```

- [ ] **Step 7.2: Generate a report**

Navigate to any car listing and generate a report (costs 100 pistons per `REPORT_PISTON_COST`).

- [ ] **Step 7.3: Verify debit**

```sql
SELECT credits_balance, pack_credits_balance
FROM user_credits WHERE email = '<test-user>';
```

Expected: Total decreased by 100. `credits_balance` decreases first; only when it hits 0 does `pack_credits_balance` decrease (see `debit_user_credits()` RPC logic: `v_from_subscription := LEAST(v_subscription_balance, p_amount)`).

- [ ] **Step 7.4: Verify transaction logged**

```sql
SELECT amount, type FROM credit_transactions
WHERE user_id = '<id>' ORDER BY created_at DESC LIMIT 1;
```

Expected: `type = 'REPORT_USED'`, `amount = -100`

---

### Task 8: Zero-Balance → OutOfReportsModal → Purchase → Resume

This is the critical end-to-end "replenishing" flow.

- [ ] **Step 8.1: Drain pistons to zero (or use Supabase to set balance)**

If balance is high, manually set it to 0 for testing:
```sql
UPDATE user_credits
SET credits_balance = 0, pack_credits_balance = 0
WHERE email = '<test-user>';
```

- [ ] **Step 8.2: Attempt to generate a report**

Expected: The system should show `OutOfReportsModal` — "You've used your 300 Free Pistons this month" with two CTAs:
1. "Go Unlimited — $59/mo" → links to `/pricing`
2. "Or buy Pistons that never expire — from $9.99" → links to `/pricing`

- [ ] **Step 8.3: Click through to pricing and buy Jerrycan**

Follow the full purchase flow (Task 1, Steps 1.2-1.6).

- [ ] **Step 8.4: Verify pistons credited**

```sql
SELECT credits_balance, pack_credits_balance FROM user_credits WHERE email = '<test-user>';
```

Expected: `pack_credits_balance = 600` (Jerrycan).

- [ ] **Step 8.5: Generate a report successfully**

Now generate the same report that was blocked in Step 8.2.
Expected: Report generates. Debit of 100 from `pack_credits_balance`.

```sql
SELECT pack_credits_balance FROM user_credits WHERE email = '<test-user>';
```

Expected: 500 (600 - 100).

---

### Task 9: Advisor Piston Costs

- [ ] **Step 9.1: Test Advisor Instant (1 piston)**

Use the Advisor in "Instant" mode. Check that a `credit_transactions` row with `type = 'ADVISOR_INSTANT'` is created.

Note: The current `debit_user_credits()` RPC sets `v_signed_amount := 0` for Advisor types (lines 88-90 in migration), meaning the DB balance does NOT actually decrease for advisor usage. Verify this is the intended behavior or a bug.

- [ ] **Step 9.2: Test Advisor Deep Research (25 pistons)**

Same as above but for Deep Research tier. Verify transaction is logged.

---

## Chunk 4: Edge Cases & Error Handling

### Task 10: 3D Secure Authentication

- [ ] **Step 10.1: Purchase with 3DS-required card**

Use card `4000 0000 0000 3220` (always requires 3DS, then succeeds).

Expected:
1. Stripe checkout shows 3D Secure modal/iframe
2. Complete authentication
3. Payment succeeds → webhook fires → pistons credited

- [ ] **Step 10.2: Purchase with 3DS-fail card**

Use card `4000 0000 0000 3063` (3DS always fails).

Expected: Payment fails on Stripe page. No webhook. No DB changes.

---

### Task 11: Stacking Pack Credits with Subscription

- [ ] **Step 11.1: Subscribe to Zuffenhausen (if not already subscribed)**

Expected: `credits_balance = 1000`, `pack_credits_balance` unchanged.

- [ ] **Step 11.2: Buy a Jerrycan on top of active subscription**

Expected: `pack_credits_balance += 600`, `credits_balance` unchanged.

- [ ] **Step 11.3: Generate reports and verify debit order**

Generate 11 reports (1,100 pistons total).
Expected: First 1,000 from `credits_balance` (subscription), last 100 from `pack_credits_balance` (pack).

```sql
SELECT credits_balance, pack_credits_balance FROM user_credits WHERE email = '<test-user>';
```

Expected: `credits_balance = 0`, `pack_credits_balance = 500` (600 - 100).

---

### Task 12: Webhook Secret Mismatch / Invalid Signature

- [ ] **Step 12.1: Temporarily change STRIPE_WEBHOOK_SECRET to a wrong value**

Set `STRIPE_WEBHOOK_SECRET=whsec_invalid_value_for_testing` in `.env.local`, restart server.

- [ ] **Step 12.2: Trigger a purchase**

Complete a checkout. When webhook arrives:

Expected: Server returns `400 Invalid signature` (line 138 in webhook route).
The `stripe listen` terminal shows `<-- [400]`.
No DB changes.

- [ ] **Step 12.3: Restore correct webhook secret and restart**

Ensure system recovers. Stripe will retry the webhook — verify it processes correctly on retry.

---

### Task 13: Concurrent Purchases

- [ ] **Step 13.1: Open two browser tabs on pricing page**

- [ ] **Step 13.2: Click buy on both tabs rapidly**

Two checkout sessions will be created. Complete payment on both.

Expected: Each payment gets its own `stripe_payment_id`, each creates a separate `credit_transactions` row, and `pack_credits_balance` increases by the sum of both.

---

## Chunk 5: UI & UX Verification

### Task 14: Visual & Interaction Checks

- [ ] **Step 14.1: Verify PricingCards responsive layout**

Check `http://localhost:3000/en/pricing` on:
- Desktop (>1024px) — cards in grid
- Tablet (768px) — cards wrap
- Mobile (375px) — cards stack vertically

- [ ] **Step 14.2: Verify CheckoutModal error state**

Disconnect Stripe keys (comment out `STRIPE_SECRET_KEY`) and try to check out.
Expected: Modal shows error text "Failed to create checkout session" (not crash/blank screen).
On localhost, it should fallback to `/checkout/payment?plan=...` (dev mock page).

- [ ] **Step 14.3: Verify upsell in Fuel Cell modal**

Click "Buy Fuel Cell" ($29).
Expected: CheckoutModal shows upsell banner:
"By $30 more, Rennsport ($59) gives you unlimited reports + a 10,000 Pistons allowance"
with "Switch to Rennsport →" link.

Click "Switch to Rennsport →" — modal should switch to Rennsport plan.

- [ ] **Step 14.4: Verify BillingDashboard on account page**

Navigate to `/account` (or wherever BillingDashboard renders).
Verify it shows:
- Current tier/plan
- Pistons balance
- Subscription status (if subscribed)
- Transaction history

- [ ] **Step 14.5: Verify TransactionHistory**

After running several tests, check transaction history shows all credit/debit events in correct chronological order with amounts and types.

---

## Test Matrix Summary

| # | Test Case | Plan | Card | Expected | Priority |
|---|-----------|------|------|----------|----------|
| 1 | One-time purchase happy path | Jerrycan | 4242... | +600 pack pistons | P0 |
| 2 | Idempotency (webhook replay) | — | — | No double credit | P0 |
| 3 | Declined card | Fuel Cell | 4000...0002 | Error, no charge | P0 |
| 4 | Insufficient funds | Any | 4000...9995 | Error, no charge | P1 |
| 5 | Unauthenticated user | Any | — | 401, no crash | P0 |
| 6 | Subscription happy path | Weissach | 4242... | +5000 sub pistons, PRO tier | P0 |
| 7 | Subscription cancellation | — | — | Status canceled, allowance → 300 | P0 |
| 8 | Report generation debit | — | — | -100 pistons | P0 |
| 9 | Zero balance → modal → purchase → resume | Jerrycan | 4242... | Full replenish flow | P0 |
| 10 | 3DS authentication | Any | 4000...3220 | Auth modal → success | P1 |
| 11 | 3DS failure | Any | 4000...3063 | Auth fails → no charge | P1 |
| 12 | Pack + Subscription stacking | Zuffenhausen + Jerrycan | 4242... | Correct debit order | P1 |
| 13 | Invalid webhook signature | — | — | 400, no DB change | P1 |
| 14 | Concurrent purchases | 2x Jerrycan | 4242... | Both credited | P2 |
| 15 | Responsive UI | — | — | Cards layout correct | P2 |
| 16 | Fuel Cell upsell | Fuel Cell | — | Modal shows upsell | P2 |
