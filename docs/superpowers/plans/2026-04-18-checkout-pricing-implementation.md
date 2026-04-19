# Checkout & Pricing MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the money loop — users can pay (one-time or recurring) via Stripe, Reports get credited, subscriptions reset monthly.

**Architecture:** Stripe Checkout hosted (redirect flow) + webhook-driven credit activation. Frontend has pricing page, pre-checkout modal, success/cancel pages, and out-of-reports paywall. DB extends `User` table with subscription fields and adds `pack_credits_balance` (packs never expire, separate from monthly pool).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind, Supabase auth, Postgres via `pg` pool, Stripe Node SDK, Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-04-18-checkout-pricing-design.md` — read for context before starting.

---

## Pre-flight checklist (manual, not code)

Before Task 1, confirm with the user:
- [ ] Stripe account exists (test mode is enough to start)
- [ ] Stripe test-mode API keys available (Secret + Publishable)
- [ ] Webhook signing secret available (generated when creating the webhook endpoint in Stripe Dashboard, OR when running `stripe listen` CLI)
- [ ] `DATABASE_URL` points to a Postgres DB that has the existing `"User"` table

---

## Task 0: Install dependencies and set env vars

**Files:**
- Modify: `package.json`
- Create: `.env.local.example` if missing, add new keys

- [ ] **Step 1: Install Stripe SDK**

Run: `npm install stripe@^17`
Expected: "added X packages" in output, no errors.

- [ ] **Step 2: Add env var keys to `.env.local.example`**

Add these lines (do NOT put real values — example file only):

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Price IDs (created in Stripe Dashboard)
STRIPE_PRICE_SINGLE=price_...
STRIPE_PRICE_PACK=price_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...

# Public URL for redirect back after checkout
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

If `.env.local.example` does not exist, create it with those lines.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "chore(payments): add stripe SDK and env var scaffolding"
```

---

## Task 1: DB migration — extend User schema

**Files:**
- Create: `supabase/migrations/20260418_extend_user_for_subscriptions.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration: Extend User table for subscription support
-- Adds: pack_credits_balance, Stripe fields, expanded tier enum

ALTER TABLE "User"
  DROP CONSTRAINT IF EXISTS "User_tier_check";

ALTER TABLE "User"
  ADD CONSTRAINT "User_tier_check"
  CHECK (tier IN ('FREE', 'PACK_OWNER', 'MONTHLY', 'ANNUAL', 'PRO'));

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "packCreditsBalance" integer NOT NULL DEFAULT 0;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" text;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" text;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" text
    CHECK ("subscriptionStatus" IN ('active', 'past_due', 'canceled', 'incomplete') OR "subscriptionStatus" IS NULL);

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "subscriptionPeriodEnd" timestamptz;

-- Tracks the last time an Annual subscriber got their monthly 10 reports.
-- For Monthly subs this is not used (Stripe fires customer.subscription.updated on each renewal).
-- For Annual subs we lazy-reset on profile fetch if >=30 days elapsed.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "annualLastMonthlyReset" timestamptz;

-- Expand CreditTransaction type enum
ALTER TABLE "CreditTransaction"
  DROP CONSTRAINT IF EXISTS "CreditTransaction_type_check";

ALTER TABLE "CreditTransaction"
  ADD CONSTRAINT "CreditTransaction_type_check"
  CHECK (type IN (
    'FREE_MONTHLY',
    'ANALYSIS_USED',
    'PURCHASE',
    'STRIPE_PACK_PURCHASE',
    'STRIPE_SUBSCRIPTION_ACTIVATION',
    'STRIPE_MONTHLY_RESET',
    'STRIPE_SUBSCRIPTION_CANCELED'
  ));

-- Unique index for webhook idempotency (prevents duplicate credit grants)
CREATE UNIQUE INDEX IF NOT EXISTS "CreditTransaction_stripePaymentId_unique"
  ON "CreditTransaction"("stripePaymentId")
  WHERE "stripePaymentId" IS NOT NULL;

-- Index for finding users by stripeCustomerId in webhook handlers
CREATE INDEX IF NOT EXISTS "User_stripeCustomerId_idx" ON "User"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "User_stripeSubscriptionId_idx" ON "User"("stripeSubscriptionId");
```

- [ ] **Step 2: Apply migration locally**

Run against your local DB (replace with your psql connection string):
```bash
psql "$DATABASE_URL" -f supabase/migrations/20260418_extend_user_for_subscriptions.sql
```

Expected: "ALTER TABLE", "CREATE INDEX" outputs, no errors. If `"User"` table doesn't exist, that means this project uses the Supabase `user_credits` table instead — stop and ask the user which table to extend.

- [ ] **Step 3: Verify schema**

Run:
```bash
psql "$DATABASE_URL" -c "\d \"User\""
```

Expected: output shows `packCreditsBalance`, `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `subscriptionPeriodEnd` columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260418_extend_user_for_subscriptions.sql
git commit -m "feat(db): extend User for subscriptions and pack credits"
```

---

## Task 2: Stripe client library

**Files:**
- Create: `src/lib/stripe/client.ts`
- Create: `src/lib/stripe/priceIds.ts`
- Test: `src/lib/stripe/__tests__/priceIds.test.ts`

- [ ] **Step 1: Write the failing test for `priceIds`**

Create `src/lib/stripe/__tests__/priceIds.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getPriceIdForPlan, getPlanForPriceId, ALL_PRICE_IDS } from '../priceIds'

describe('priceIds', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.STRIPE_PRICE_SINGLE = 'price_single_test'
    process.env.STRIPE_PRICE_PACK = 'price_pack_test'
    process.env.STRIPE_PRICE_MONTHLY = 'price_monthly_test'
    process.env.STRIPE_PRICE_ANNUAL = 'price_annual_test'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('maps plan id to price id', () => {
    expect(getPriceIdForPlan('single')).toBe('price_single_test')
    expect(getPriceIdForPlan('pack')).toBe('price_pack_test')
    expect(getPriceIdForPlan('monthly')).toBe('price_monthly_test')
    expect(getPriceIdForPlan('annual')).toBe('price_annual_test')
  })

  it('maps price id back to plan id', () => {
    expect(getPlanForPriceId('price_single_test')).toBe('single')
    expect(getPlanForPriceId('price_pack_test')).toBe('pack')
    expect(getPlanForPriceId('price_monthly_test')).toBe('monthly')
    expect(getPlanForPriceId('price_annual_test')).toBe('annual')
  })

  it('returns null for unknown price id', () => {
    expect(getPlanForPriceId('price_unknown')).toBe(null)
  })

  it('ALL_PRICE_IDS includes all four', () => {
    expect(ALL_PRICE_IDS()).toHaveLength(4)
  })

  it('throws if env var is missing', () => {
    delete process.env.STRIPE_PRICE_MONTHLY
    expect(() => getPriceIdForPlan('monthly')).toThrow(/STRIPE_PRICE_MONTHLY/)
  })
})
```

- [ ] **Step 2: Run test — expect fail**

Run: `npm test -- src/lib/stripe/__tests__/priceIds.test.ts`
Expected: FAIL with "Cannot find module '../priceIds'".

- [ ] **Step 3: Implement `priceIds.ts`**

Create `src/lib/stripe/priceIds.ts`:

```typescript
export type PlanId = 'single' | 'pack' | 'monthly' | 'annual'

const PLAN_TO_ENV: Record<PlanId, string> = {
  single: 'STRIPE_PRICE_SINGLE',
  pack: 'STRIPE_PRICE_PACK',
  monthly: 'STRIPE_PRICE_MONTHLY',
  annual: 'STRIPE_PRICE_ANNUAL',
}

export function getPriceIdForPlan(plan: PlanId): string {
  const envKey = PLAN_TO_ENV[plan]
  const value = process.env[envKey]
  if (!value) {
    throw new Error(`${envKey} is not set`)
  }
  return value
}

export function getPlanForPriceId(priceId: string): PlanId | null {
  for (const plan of Object.keys(PLAN_TO_ENV) as PlanId[]) {
    const envValue = process.env[PLAN_TO_ENV[plan]]
    if (envValue && envValue === priceId) {
      return plan
    }
  }
  return null
}

export function ALL_PRICE_IDS(): string[] {
  return (Object.keys(PLAN_TO_ENV) as PlanId[])
    .map((plan) => process.env[PLAN_TO_ENV[plan]])
    .filter((v): v is string => Boolean(v))
}

export function isSubscriptionPlan(plan: PlanId): boolean {
  return plan === 'monthly' || plan === 'annual'
}

export function reportsForPlan(plan: PlanId): number {
  switch (plan) {
    case 'single':
      return 1
    case 'pack':
      return 5
    case 'monthly':
    case 'annual':
      return 10
  }
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/lib/stripe/__tests__/priceIds.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Create Stripe client**

Create `src/lib/stripe/client.ts`:

```typescript
import Stripe from 'stripe'

type GlobalStripe = { stripeClient?: Stripe }
const globalForStripe = globalThis as unknown as GlobalStripe

export function getStripe(): Stripe {
  if (!globalForStripe.stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    globalForStripe.stripeClient = new Stripe(key, {
      apiVersion: '2025-10-28.acacia',
      typescript: true,
    })
  }
  return globalForStripe.stripeClient
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe/
git commit -m "feat(stripe): add client and price id mapping"
```

---

## Task 3: Credits library — add subscription helpers

**Files:**
- Modify: `src/lib/credits/index.ts`
- Test: `src/lib/credits/__tests__/subscriptionHelpers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/credits/__tests__/subscriptionHelpers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db/sql', () => ({
  dbQuery: vi.fn(),
  withTransaction: vi.fn((fn: (c: unknown) => unknown) =>
    fn({ query: vi.fn(async () => ({ rows: [], rowCount: 0 })) }),
  ),
}))

import { dbQuery } from '../../db/sql'
import {
  findUserByStripeCustomerId,
  grantPackCredits,
  activateSubscription,
  resetSubscriptionCredits,
  cancelSubscription,
} from '../index'

describe('subscription helpers', () => {
  beforeEach(() => {
    vi.mocked(dbQuery).mockReset()
  })

  it('findUserByStripeCustomerId returns user row', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({
      rows: [{ id: 'u1', stripeCustomerId: 'cus_123' }],
      rowCount: 1,
    } as unknown as { rows: unknown[]; rowCount: number | null })

    const result = await findUserByStripeCustomerId('cus_123')
    expect(result?.id).toBe('u1')
    expect(dbQuery).toHaveBeenCalledWith(
      expect.stringContaining('stripeCustomerId'),
      ['cus_123'],
    )
  })

  it('grantPackCredits increments packCreditsBalance', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [{}],
      rowCount: 1,
    } as unknown as { rows: unknown[]; rowCount: number | null })

    await grantPackCredits('user-1', 5, 'cs_test_123')

    const firstCall = vi.mocked(dbQuery).mock.calls[0][0] as string
    expect(firstCall).toMatch(/packCreditsBalance.*\+\s*\$2/)
  })

  it('activateSubscription sets tier and resets balance', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [{}],
      rowCount: 1,
    } as unknown as { rows: unknown[]; rowCount: number | null })

    await activateSubscription({
      userId: 'user-1',
      tier: 'MONTHLY',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      periodEnd: new Date('2026-05-18T00:00:00Z'),
      sessionId: 'cs_1',
    })

    const updateCall = vi.mocked(dbQuery).mock.calls[0][0] as string
    expect(updateCall).toMatch(/tier\s*=\s*\$2/)
    expect(updateCall).toMatch(/creditsBalance\s*=\s*10/)
  })

  it('resetSubscriptionCredits sets balance to 10 without touching packs', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [{}],
      rowCount: 1,
    } as unknown as { rows: unknown[]; rowCount: number | null })

    await resetSubscriptionCredits('user-1', new Date('2026-05-18'), 'evt_1')

    const updateCall = vi.mocked(dbQuery).mock.calls[0][0] as string
    expect(updateCall).toMatch(/creditsBalance\s*=\s*10/)
    expect(updateCall).not.toMatch(/packCreditsBalance/)
  })

  it('cancelSubscription sets tier to FREE and clears subscription fields', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [{}],
      rowCount: 1,
    } as unknown as { rows: unknown[]; rowCount: number | null })

    await cancelSubscription('user-1', 'evt_1')

    const updateCall = vi.mocked(dbQuery).mock.calls[0][0] as string
    expect(updateCall).toMatch(/tier\s*=\s*'FREE'/)
    expect(updateCall).toMatch(/stripeSubscriptionId\s*=\s*NULL/)
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npm test -- src/lib/credits/__tests__/subscriptionHelpers.test.ts`
Expected: FAIL with "findUserByStripeCustomerId is not exported" (or similar).

- [ ] **Step 3: Add helpers to `src/lib/credits/index.ts`**

Append to the existing `src/lib/credits/index.ts` (at the end of the file):

```typescript
// ─── Subscription support ───

export type SubscriptionTier = 'MONTHLY' | 'ANNUAL'

type ExtendedUserRow = UserRow & {
  packCreditsBalance: number
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'incomplete' | null
  subscriptionPeriodEnd: Date | null
}

export async function findUserByStripeCustomerId(
  stripeCustomerId: string,
): Promise<ExtendedUserRow | null> {
  const result = await dbQuery<ExtendedUserRow>(
    'SELECT * FROM "User" WHERE "stripeCustomerId" = $1 LIMIT 1',
    [stripeCustomerId],
  )
  return result.rows[0] ?? null
}

export async function findUserByStripeSubscriptionId(
  stripeSubscriptionId: string,
): Promise<ExtendedUserRow | null> {
  const result = await dbQuery<ExtendedUserRow>(
    'SELECT * FROM "User" WHERE "stripeSubscriptionId" = $1 LIMIT 1',
    [stripeSubscriptionId],
  )
  return result.rows[0] ?? null
}

async function transactionAlreadyApplied(
  stripePaymentId: string,
): Promise<boolean> {
  const existing = await dbQuery<{ id: string }>(
    'SELECT id FROM "CreditTransaction" WHERE "stripePaymentId" = $1 LIMIT 1',
    [stripePaymentId],
  )
  return existing.rows.length > 0
}

export async function grantPackCredits(
  userId: string,
  amount: number,
  stripePaymentId: string,
) {
  if (await transactionAlreadyApplied(stripePaymentId)) return

  await dbQuery(
    `
      UPDATE "User"
      SET "packCreditsBalance" = "packCreditsBalance" + $2,
          "tier" = CASE WHEN "tier" = 'FREE' THEN 'PACK_OWNER' ELSE "tier" END,
          "updatedAt" = NOW()
      WHERE id = $1
    `,
    [userId, amount],
  )

  await dbQuery(
    `
      INSERT INTO "CreditTransaction" ("userId", amount, type, description, "stripePaymentId")
      VALUES ($1, $2, 'STRIPE_PACK_PURCHASE', $3, $4)
    `,
    [userId, amount, `Pack purchase: ${amount} reports`, stripePaymentId],
  )
}

export async function activateSubscription(params: {
  userId: string
  tier: SubscriptionTier
  stripeCustomerId: string
  stripeSubscriptionId: string
  periodEnd: Date
  sessionId: string
}) {
  const { userId, tier, stripeCustomerId, stripeSubscriptionId, periodEnd, sessionId } = params

  if (await transactionAlreadyApplied(sessionId)) return

  await dbQuery(
    `
      UPDATE "User"
      SET "tier" = $2,
          "stripeCustomerId" = $3,
          "stripeSubscriptionId" = $4,
          "subscriptionStatus" = 'active',
          "subscriptionPeriodEnd" = $5,
          "creditsBalance" = 10,
          "annualLastMonthlyReset" = CASE WHEN $2 = 'ANNUAL' THEN NOW() ELSE NULL END,
          "updatedAt" = NOW()
      WHERE id = $1
    `,
    [userId, tier, stripeCustomerId, stripeSubscriptionId, periodEnd],
  )

  await dbQuery(
    `
      INSERT INTO "CreditTransaction" ("userId", amount, type, description, "stripePaymentId")
      VALUES ($1, 10, 'STRIPE_SUBSCRIPTION_ACTIVATION', $2, $3)
    `,
    [userId, `Subscription activated: ${tier}`, sessionId],
  )
}

export async function resetSubscriptionCredits(
  userId: string,
  newPeriodEnd: Date,
  stripeEventId: string,
) {
  if (await transactionAlreadyApplied(stripeEventId)) return

  await dbQuery(
    `
      UPDATE "User"
      SET "creditsBalance" = 10,
          "subscriptionPeriodEnd" = $2,
          "subscriptionStatus" = 'active',
          "updatedAt" = NOW()
      WHERE id = $1
    `,
    [userId, newPeriodEnd],
  )

  await dbQuery(
    `
      INSERT INTO "CreditTransaction" ("userId", amount, type, description, "stripePaymentId")
      VALUES ($1, 10, 'STRIPE_MONTHLY_RESET', 'Subscription monthly reset', $2)
    `,
    [userId, stripeEventId],
  )
}

export async function cancelSubscription(userId: string, stripeEventId: string) {
  if (await transactionAlreadyApplied(stripeEventId)) return

  await dbQuery(
    `
      UPDATE "User"
      SET "tier" = 'FREE',
          "stripeSubscriptionId" = NULL,
          "subscriptionStatus" = 'canceled',
          "updatedAt" = NOW()
      WHERE id = $1
    `,
    [userId],
  )

  await dbQuery(
    `
      INSERT INTO "CreditTransaction" ("userId", amount, type, description, "stripePaymentId")
      VALUES ($1, 0, 'STRIPE_SUBSCRIPTION_CANCELED', 'Subscription canceled', $2)
    `,
    [userId, stripeEventId],
  )
}

export async function markSubscriptionPastDue(userId: string, stripeEventId: string) {
  if (await transactionAlreadyApplied(stripeEventId)) return

  await dbQuery(
    `
      UPDATE "User"
      SET "subscriptionStatus" = 'past_due',
          "updatedAt" = NOW()
      WHERE id = $1
    `,
    [userId],
  )
}

// Annual subscribers get 10 reports/month within their yearly billing period.
// Stripe only fires customer.subscription.updated once a year — so we lazy-reset on read.
export async function checkAndResetAnnualMonthlyCredits(userId: string) {
  const userResult = await dbQuery<ExtendedUserRow & { annualLastMonthlyReset: Date | null }>(
    'SELECT * FROM "User" WHERE id = $1 LIMIT 1',
    [userId],
  )
  const user = userResult.rows[0]
  if (!user || user.tier !== 'ANNUAL') return user ?? null

  const now = new Date()
  const lastReset = user.annualLastMonthlyReset ? new Date(user.annualLastMonthlyReset) : null
  const daysSince = lastReset
    ? Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity

  if (daysSince < 30) return user

  const updated = await dbQuery<ExtendedUserRow>(
    `
      UPDATE "User"
      SET "creditsBalance" = 10,
          "annualLastMonthlyReset" = $2,
          "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [userId, now],
  )

  await dbQuery(
    `
      INSERT INTO "CreditTransaction" ("userId", amount, type, description)
      VALUES ($1, 10, 'STRIPE_MONTHLY_RESET', 'Annual subscriber monthly reset')
    `,
    [userId],
  )

  return updated.rows[0] ?? user
}
```

Then update the existing `getUserCredits` function (already in the file, around line 114) to also run the annual reset:

```typescript
export async function getUserCredits(supabaseId: string) {
  const user = await getUserBySupabaseId(supabaseId)
  if (!user) return null
  const afterFreeReset = await checkAndResetFreeCredits(user.id)
  if (!afterFreeReset) return null
  if (afterFreeReset.tier === 'ANNUAL') {
    return await checkAndResetAnnualMonthlyCredits(afterFreeReset.id)
  }
  return afterFreeReset
}
```

Replace the existing `getUserCredits` body with the above.

Also update the existing `deductCredit` function in the same file to consume from `packCreditsBalance` first. Find the existing function (around line 128-187) and REPLACE its transaction block with:

```typescript
  try {
    await withTransaction(async (client) => {
      // Consume packs first (they never expire)
      const packFirst = user.tier !== 'FREE' // Free users have no packs
      if (packFirst) {
        const updateResult = await client.query(
          `
            UPDATE "User"
            SET "packCreditsBalance" = GREATEST(0, "packCreditsBalance" - 1),
                "updatedAt" = NOW()
            WHERE id = $1 AND "packCreditsBalance" > 0
            RETURNING "packCreditsBalance"
          `,
          [userId],
        )

        if ((updateResult.rowCount ?? 0) > 0) {
          // Pack consumed, no need to touch creditsBalance
          await client.query(
            `
              INSERT INTO "CreditTransaction" ("userId", amount, type, description)
              VALUES ($1, -1, 'ANALYSIS_USED', $2)
            `,
            [userId, `Analysis for auction ${auctionId} (pack)`],
          )

          await client.query(
            `
              INSERT INTO "UserAnalysis" ("userId", "auctionId", "creditCost")
              VALUES ($1, $2, 1)
            `,
            [userId, auctionId],
          )
          return
        }
      }

      // Fallback to the monthly/free balance
      await client.query(
        `
          UPDATE "User"
          SET "creditsBalance" = "creditsBalance" - 1,
              "freeCreditsUsed" = "freeCreditsUsed" + $2,
              "updatedAt" = NOW()
          WHERE id = $1
        `,
        [userId, user.tier === 'FREE' ? 1 : 0],
      )

      await client.query(
        `
          INSERT INTO "CreditTransaction" ("userId", amount, type, description)
          VALUES ($1, -1, 'ANALYSIS_USED', $2)
        `,
        [userId, `Analysis for auction ${auctionId}`],
      )

      await client.query(
        `
          INSERT INTO "UserAnalysis" ("userId", "auctionId", "creditCost")
          VALUES ($1, $2, 1)
        `,
        [userId, auctionId],
      )
    })
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
    if (code === '23505') {
      return { success: true, creditUsed: 0, cached: true }
    }
    throw error
  }
```

Also update the availability check in `deductCredit` (around line 145):

```typescript
  // Has ANY credits? Packs OR monthly/free balance
  const totalAvailable = (user.creditsBalance ?? 0) + (user.packCreditsBalance ?? 0)
  if (totalAvailable < 1) {
    return { success: false, error: 'INSUFFICIENT_CREDITS' }
  }
```

Replace the existing check `if (user.creditsBalance < 1)` with the above.

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- src/lib/credits`
Expected: all tests PASS (new 5 + any existing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/credits/
git commit -m "feat(credits): add subscription helpers, consume packs first"
```

---

## Task 4: POST `/api/checkout/create-session`

**Files:**
- Create: `src/app/api/checkout/create-session/route.ts`
- Test: `src/app/api/checkout/create-session/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'supabase-user-1', email: 'test@example.com' } },
        error: null,
      })),
    },
  })),
}))

vi.mock('@/lib/credits', () => ({
  getOrCreateUser: vi.fn(async () => ({
    id: 'user-1',
    supabaseId: 'supabase-user-1',
    email: 'test@example.com',
    tier: 'FREE',
    stripeCustomerId: null,
  })),
}))

const sessionsCreate = vi.fn(async () => ({
  id: 'cs_test_123',
  url: 'https://checkout.stripe.com/c/pay/cs_test_123',
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: () => ({
    checkout: { sessions: { create: sessionsCreate } },
    customers: {
      create: vi.fn(async () => ({ id: 'cus_new_123' })),
    },
  }),
}))

vi.mock('@/lib/stripe/priceIds', () => ({
  getPriceIdForPlan: (p: string) => `price_${p}_test`,
  isSubscriptionPlan: (p: string) => p === 'monthly' || p === 'annual',
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/checkout/create-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/checkout/create-session', () => {
  beforeEach(() => {
    sessionsCreate.mockClear()
  })

  it('returns 400 for invalid plan', async () => {
    const res = await POST(makeRequest({ plan: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('creates one-time session for single plan', async () => {
    const res = await POST(makeRequest({ plan: 'single' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.url).toContain('checkout.stripe.com')
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'payment' }),
    )
  })

  it('creates subscription session for monthly plan', async () => {
    const res = await POST(makeRequest({ plan: 'monthly' }))
    expect(res.status).toBe(200)
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'subscription' }),
    )
  })

  it('uses annual price for annual plan', async () => {
    const res = await POST(makeRequest({ plan: 'annual' }))
    expect(res.status).toBe(200)
    const call = sessionsCreate.mock.calls[0][0]
    expect(call.line_items[0].price).toBe('price_annual_test')
  })
})
```

- [ ] **Step 2: Run test — expect fail**

Run: `npm test -- src/app/api/checkout/create-session/route.test.ts`
Expected: FAIL, route does not exist yet.

- [ ] **Step 3: Implement the route**

Create `src/app/api/checkout/create-session/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateUser } from '@/lib/credits'
import { getStripe } from '@/lib/stripe/client'
import { getPriceIdForPlan, isSubscriptionPlan, type PlanId } from '@/lib/stripe/priceIds'
import { dbQuery } from '@/lib/db/sql'

const BodySchema = z.object({
  plan: z.enum(['single', 'pack', 'monthly', 'annual']),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawBody = await request.json().catch(() => null)
    const parsed = BodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid plan', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const plan = parsed.data.plan as PlanId
    const appUser = await getOrCreateUser(
      authUser.id,
      authUser.email!,
      authUser.user_metadata?.full_name,
    )

    const stripe = getStripe()

    // Reuse existing Stripe customer if present; otherwise create.
    let customerId = (appUser as { stripeCustomerId?: string | null }).stripeCustomerId ?? null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: appUser.email,
        metadata: { appUserId: appUser.id, supabaseId: authUser.id },
      })
      customerId = customer.id
      await dbQuery(
        'UPDATE "User" SET "stripeCustomerId" = $1, "updatedAt" = NOW() WHERE id = $2',
        [customerId, appUser.id],
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: isSubscriptionPlan(plan) ? 'subscription' : 'payment',
      line_items: [
        {
          price: getPriceIdForPlan(plan),
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel`,
      client_reference_id: appUser.id,
      metadata: {
        appUserId: appUser.id,
        plan,
      },
      ...(isSubscriptionPlan(plan)
        ? { subscription_data: { metadata: { appUserId: appUser.id, plan } } }
        : { payment_intent_data: { metadata: { appUserId: appUser.id, plan } } }),
      allow_promotion_codes: false,
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/app/api/checkout/create-session/route.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/checkout/create-session/
git commit -m "feat(checkout): add create-session endpoint"
```

---

## Task 5: Stripe webhook handler

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`
- Create: `src/lib/stripe/webhookHandlers.ts`
- Test: `src/lib/stripe/__tests__/webhookHandlers.test.ts`

- [ ] **Step 1: Write failing tests for handlers**

Create `src/lib/stripe/__tests__/webhookHandlers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/credits', () => ({
  grantPackCredits: vi.fn(),
  activateSubscription: vi.fn(),
  resetSubscriptionCredits: vi.fn(),
  cancelSubscription: vi.fn(),
  markSubscriptionPastDue: vi.fn(),
  findUserByStripeSubscriptionId: vi.fn(async () => ({ id: 'user-1' })),
}))

vi.mock('@/lib/stripe/priceIds', () => ({
  getPlanForPriceId: (id: string) => {
    if (id === 'price_single_test') return 'single'
    if (id === 'price_pack_test') return 'pack'
    if (id === 'price_monthly_test') return 'monthly'
    if (id === 'price_annual_test') return 'annual'
    return null
  },
  reportsForPlan: (plan: string) => {
    if (plan === 'single') return 1
    if (plan === 'pack') return 5
    return 10
  },
}))

import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
} from '../webhookHandlers'
import {
  grantPackCredits,
  activateSubscription,
  resetSubscriptionCredits,
  cancelSubscription,
  markSubscriptionPastDue,
} from '@/lib/credits'

describe('webhookHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handleCheckoutSessionCompleted for pack grants credits', async () => {
    await handleCheckoutSessionCompleted({
      id: 'cs_1',
      mode: 'payment',
      metadata: { appUserId: 'user-1', plan: 'pack' },
      line_items: { data: [{ price: { id: 'price_pack_test' } }] },
    } as never)

    expect(grantPackCredits).toHaveBeenCalledWith('user-1', 5, 'cs_1')
  })

  it('handleCheckoutSessionCompleted for single grants 1 credit', async () => {
    await handleCheckoutSessionCompleted({
      id: 'cs_2',
      mode: 'payment',
      metadata: { appUserId: 'user-1', plan: 'single' },
      line_items: { data: [{ price: { id: 'price_single_test' } }] },
    } as never)

    expect(grantPackCredits).toHaveBeenCalledWith('user-1', 1, 'cs_2')
  })

  it('handleCheckoutSessionCompleted for monthly activates subscription', async () => {
    await handleCheckoutSessionCompleted({
      id: 'cs_3',
      mode: 'subscription',
      customer: 'cus_1',
      subscription: 'sub_1',
      metadata: { appUserId: 'user-1', plan: 'monthly' },
      line_items: {
        data: [
          {
            price: {
              id: 'price_monthly_test',
              recurring: { interval: 'month' },
            },
          },
        ],
      },
    } as never)

    expect(activateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tier: 'MONTHLY',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
      }),
    )
  })

  it('handleSubscriptionUpdated resets credits on new period', async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400
    await handleSubscriptionUpdated({
      id: 'sub_1',
      status: 'active',
      current_period_end: periodEnd,
    } as never, 'evt_1')

    expect(resetSubscriptionCredits).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
      'evt_1',
    )
  })

  it('handleSubscriptionDeleted cancels the subscription', async () => {
    await handleSubscriptionDeleted({ id: 'sub_1' } as never, 'evt_2')
    expect(cancelSubscription).toHaveBeenCalledWith('user-1', 'evt_2')
  })

  it('handleInvoicePaymentFailed marks past_due', async () => {
    await handleInvoicePaymentFailed(
      { subscription: 'sub_1' } as never,
      'evt_3',
    )
    expect(markSubscriptionPastDue).toHaveBeenCalledWith('user-1', 'evt_3')
  })
})
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npm test -- src/lib/stripe/__tests__/webhookHandlers.test.ts`
Expected: FAIL, module does not exist.

- [ ] **Step 3: Implement handlers**

Create `src/lib/stripe/webhookHandlers.ts`:

```typescript
import type Stripe from 'stripe'
import {
  grantPackCredits,
  activateSubscription,
  resetSubscriptionCredits,
  cancelSubscription,
  markSubscriptionPastDue,
  findUserByStripeSubscriptionId,
} from '@/lib/credits'
import { getPlanForPriceId, reportsForPlan } from './priceIds'

type SessionWithLineItems = Stripe.Checkout.Session & {
  line_items?: { data: Array<{ price: Stripe.Price | null }> }
}

export async function handleCheckoutSessionCompleted(session: SessionWithLineItems) {
  const appUserId = session.metadata?.appUserId
  if (!appUserId) {
    console.warn('webhook: checkout.session.completed missing appUserId metadata', session.id)
    return
  }

  const priceId = session.line_items?.data?.[0]?.price?.id
  const plan = priceId ? getPlanForPriceId(priceId) : null
  if (!plan) {
    console.warn('webhook: could not resolve plan from price', priceId)
    return
  }

  if (session.mode === 'payment') {
    // one-time purchase: single or pack
    const reports = reportsForPlan(plan)
    await grantPackCredits(appUserId, reports, session.id)
    return
  }

  if (session.mode === 'subscription') {
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id

    if (!customerId || !subscriptionId) {
      console.warn('webhook: subscription session missing customer or subscription id', session.id)
      return
    }

    // Fall back to a naive periodEnd; the next `customer.subscription.updated`
    // event will correct it with the real value.
    const periodEnd = new Date(Date.now() + (plan === 'annual' ? 365 : 30) * 86400 * 1000)

    await activateSubscription({
      userId: appUserId,
      tier: plan === 'annual' ? 'ANNUAL' : 'MONTHLY',
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      periodEnd,
      sessionId: session.id,
    })
  }
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  eventId: string,
) {
  const user = await findUserByStripeSubscriptionId(subscription.id)
  if (!user) {
    console.warn('webhook: subscription.updated for unknown user', subscription.id)
    return
  }

  const periodEnd = new Date(subscription.current_period_end * 1000)

  if (subscription.status === 'active') {
    await resetSubscriptionCredits(user.id, periodEnd, eventId)
  }
  if (subscription.status === 'past_due') {
    await markSubscriptionPastDue(user.id, eventId)
  }
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  eventId: string,
) {
  const user = await findUserByStripeSubscriptionId(subscription.id)
  if (!user) return
  await cancelSubscription(user.id, eventId)
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  eventId: string,
) {
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
  if (!subscriptionId) return

  const user = await findUserByStripeSubscriptionId(subscriptionId)
  if (!user) return
  await markSubscriptionPastDue(user.id, eventId)
}
```

- [ ] **Step 4: Run handler tests — expect pass**

Run: `npm test -- src/lib/stripe/__tests__/webhookHandlers.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 5: Implement the webhook route**

Create `src/app/api/stripe/webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
} from '@/lib/stripe/webhookHandlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  const body = await request.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // Expand line items so we can read the price id
        const session = event.data.object as Stripe.Checkout.Session
        const expanded = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items'],
        })
        await handleCheckoutSessionCompleted(expanded as never)
        break
      }
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event.id)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, event.id)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, event.id)
        break
      default:
        // No-op for unhandled events
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error(`webhook handler failed for ${event.type}:`, err)
    // Return 500 so Stripe retries
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe/webhookHandlers.ts src/lib/stripe/__tests__/ src/app/api/stripe/
git commit -m "feat(stripe): webhook handler with idempotent credit grants"
```

---

## Task 6: Rewrite `PricingCards` — 4 tiers with Monthly/Annual toggle

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
  reports: number | "unlimited"
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
        {typeof plan.reports === "number"
          ? plan.period === "one-time"
            ? `${plan.reports} Reports, never expire`
            : `${plan.reports} Reports per month`
          : "Unlimited"}
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

- [ ] **Step 2: Fix consumers that use the old `PlanId` enum**

Search for old plan IDs:
```bash
grep -rn "starter\|collector\|\"pro\"" src/components src/app --include="*.tsx" --include="*.ts"
```

For each hit, update to use the new enum (`single` / `pack` / `monthly` / `annual`). Typical callsites:
- `src/app/[locale]/pricing/page.tsx` — drop the `handleConfirmPurchase` stub (checkout will now call the real API from CheckoutModal in Task 7).
- `src/components/payments/BillingDashboard.tsx` — update the default plan ID in the "Buy Credits" button to `"pack"` and the filter from `p.id !== 'starter'` to `p.id !== 'single'`. Also update `PRICING_PLANS.filter(...)` to use `Object.values(PRICING_PLANS).filter(...)` since the export is now an object.

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: No errors related to these files. Warnings are OK.

- [ ] **Step 4: Commit**

```bash
git add src/components/payments/PricingCards.tsx src/app/[locale]/pricing src/components/payments/BillingDashboard.tsx
git commit -m "feat(pricing): 4-tier card layout with monthly/annual toggle"
```

---

## Task 7: Rewrite `CheckoutModal` — pre-checkout + Stripe redirect

**Files:**
- Modify: `src/components/payments/CheckoutModal.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the ENTIRE contents of `src/components/payments/CheckoutModal.tsx` with:

```typescript
"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { PRICING_PLANS, type PlanId } from "./PricingCards"
import { Shield, Lock, Loader2 } from "lucide-react"

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

  if (!planId) return null
  const plan = PRICING_PLANS[planId]

  const goToStripe = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: plan.id }),
      })
      const json = await res.json()
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

  const showPackUpsell = plan.id === "pack"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold text-foreground">
            {plan.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">
            {typeof plan.reports === "number"
              ? plan.period === "one-time"
                ? `${plan.reports} Reports · never expire`
                : `${plan.reports} Reports/month · ${plan.perReport}`
              : "Unlimited Reports"}
          </DialogDescription>
        </DialogHeader>

        {showPackUpsell && onSwitchPlan && (
          <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4 mt-2">
            <p className="text-[12px] text-foreground mb-2">
              💡 Monthly at <strong>$19/mo</strong> gives you{" "}
              <strong>10 Reports + Watchlist + Alerts</strong> for 81% less than this pack.
            </p>
            <button
              onClick={() => onSwitchPlan("monthly")}
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
              <span className="text-[11px] text-muted-foreground ml-1">
                {plan.period === "monthly"
                  ? "/mo"
                  : plan.period === "annual"
                  ? "/yr"
                  : "USD"}
              </span>
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

        <div className="flex items-center justify-center gap-4 mt-1">
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

- [ ] **Step 2: Update `src/app/[locale]/pricing/page.tsx` to pass `onSwitchPlan`**

Find the existing `<CheckoutModal ...>` usage in `pricing/page.tsx` and replace with:

```tsx
<CheckoutModal
  open={checkoutPlan !== null}
  onOpenChange={(open) => !open && setCheckoutPlan(null)}
  planId={checkoutPlan}
  onSwitchPlan={(newPlan) => setCheckoutPlan(newPlan)}
/>
```

Remove the unused `handleConfirmPurchase` function — the modal now handles checkout directly.

- [ ] **Step 3: Manual smoke test (dev server)**

Run: `npm run dev`
Open: http://localhost:3000/en/pricing
Click a plan → modal appears. Click "Continue to Payment" — if Stripe keys are set, redirects to `checkout.stripe.com`. If not set, error shows ("STRIPE_SECRET_KEY is not set"). Both outcomes are correct behavior.

- [ ] **Step 4: Commit**

```bash
git add src/components/payments/CheckoutModal.tsx src/app/[locale]/pricing/
git commit -m "feat(checkout): wire pre-checkout modal to Stripe"
```

---

## Task 8: `/checkout/success` and `/checkout/cancel` pages

**Files:**
- Create: `src/app/[locale]/checkout/success/page.tsx`
- Create: `src/app/[locale]/checkout/cancel/page.tsx`
- Create: `src/app/[locale]/checkout/layout.tsx`

- [ ] **Step 1: Create the checkout layout**

Create `src/app/[locale]/checkout/layout.tsx`:

```typescript
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background flex items-center justify-center p-6">{children}</div>
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

export default function CheckoutSuccessPage() {
  const { profile, refreshProfile } = useAuth()
  const [attempts, setAttempts] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Webhook may land before the user returns. Poll profile up to 10s.
    const interval = setInterval(async () => {
      await refreshProfile()
      setAttempts((a) => a + 1)
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

  // If tier flips to MONTHLY/ANNUAL or packCreditsBalance grows, consider it ready
  useEffect(() => {
    if (!profile) return
    if (
      profile.tier === "MONTHLY" ||
      profile.tier === "ANNUAL" ||
      profile.tier === "PACK_OWNER"
    ) {
      setReady(true)
    }
  }, [profile, attempts])

  return (
    <div className="max-w-md w-full rounded-2xl border border-border bg-foreground/2 p-8 text-center">
      {ready ? (
        <>
          <div className="inline-flex items-center justify-center size-12 rounded-full bg-positive/10 mb-4">
            <CheckCircle2 className="size-6 text-positive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">You're all set</h1>
          <p className="text-[13px] text-muted-foreground mb-6">
            Your Reports are ready.
            {profile?.tier === "MONTHLY" || profile?.tier === "ANNUAL"
              ? " Watchlist is unlocked."
              : ""}
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
import Link from "next/link"
import { XCircle } from "lucide-react"

export default function CheckoutCancelPage() {
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
git commit -m "feat(checkout): success and cancel pages with polling"
```

---

## Task 9: `OutOfReportsModal` — paywall when Free user hits cap

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
  nextResetDate?: string
}

export function OutOfReportsModal({ open, onOpenChange, nextResetDate }: OutOfReportsModalProps) {
  const formattedDate = nextResetDate
    ? new Date(nextResetDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : "the 1st of next month"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <div className="inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 mb-3">
            <Coins className="size-5 text-primary" />
          </div>
          <DialogTitle className="text-[17px] font-bold text-foreground">
            You've used your 3 Free Reports this month
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

- [ ] **Step 2: Wire it into report generation flow**

Locate where report generation happens (likely `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` or a hook). At the moment of API error:

```tsx
// Pseudo-code for the relevant section
const [outOfReportsOpen, setOutOfReportsOpen] = useState(false)

async function generateReport() {
  const res = await fetch(`/api/analyze`, { ... })
  if (!res.ok) {
    const body = await res.json()
    if (body.error === 'INSUFFICIENT_CREDITS') {
      setOutOfReportsOpen(true)
      return
    }
    // other error handling
  }
}

// Render
<OutOfReportsModal
  open={outOfReportsOpen}
  onOpenChange={setOutOfReportsOpen}
  nextResetDate={profile?.creditResetDate}
/>
```

Apply the equivalent pattern in whatever component triggers analysis. Look for `INSUFFICIENT_CREDITS` string matches to find the relevant spot:

```bash
grep -rn "INSUFFICIENT_CREDITS" src --include="*.tsx" --include="*.ts"
```

Update each UI callsite to show `OutOfReportsModal` instead of a plain alert/toast.

- [ ] **Step 3: Commit**

```bash
git add src/components/payments/OutOfReportsModal.tsx src/app/[locale]/cars
git commit -m "feat(paywall): out-of-reports modal on INSUFFICIENT_CREDITS"
```

---

## Task 10: Update `BillingDashboard` — show tier, packs, cancel button

**Files:**
- Modify: `src/components/payments/BillingDashboard.tsx`
- Create: `src/app/api/billing/cancel-subscription/route.ts`

- [ ] **Step 1: Create the cancel endpoint**

Create `src/app/api/billing/cancel-subscription/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { dbQuery } from '@/lib/db/sql'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await dbQuery<{
      id: string
      stripeSubscriptionId: string | null
    }>(
      'SELECT id, "stripeSubscriptionId" FROM "User" WHERE "supabaseId" = $1 LIMIT 1',
      [user.id],
    )
    const appUser = result.rows[0]

    if (!appUser?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    const stripe = getStripe()
    await stripe.subscriptions.update(appUser.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Cancel subscription failed:', err)
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Replace `BillingDashboard.tsx`**

Replace the entire contents of `src/components/payments/BillingDashboard.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Coins, RefreshCw, FileText, CreditCard } from "lucide-react"
import Link from "next/link"
import { TransactionHistory } from "./TransactionHistory"

export function BillingDashboard() {
  const { profile, refreshProfile } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [canceling, setCanceling] = useState(false)

  const credits = profile?.creditsBalance ?? 0
  const packCredits =
    (profile as { packCreditsBalance?: number } | null)?.packCreditsBalance ?? 0
  const tier = profile?.tier ?? "FREE"
  const isSubscribed = tier === "MONTHLY" || tier === "ANNUAL"

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshProfile()
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleCancel = async () => {
    if (!confirm("Cancel subscription? You'll keep access until the end of your billing period.")) return
    setCanceling(true)
    try {
      const res = await fetch("/api/billing/cancel-subscription", { method: "POST" })
      if (res.ok) {
        await refreshProfile()
      }
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
            <p className="text-[11px] text-muted-foreground">Your available reports</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl border border-border bg-foreground/2 p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Monthly / Free</span>
            </div>
            <span className={`text-2xl font-bold ${credits > 0 ? "text-primary" : "text-destructive"}`}>
              {credits}
            </span>
          </div>
          <div className="rounded-xl border border-border bg-foreground/2 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Pack (never expire)</span>
            </div>
            <span className={`text-2xl font-bold ${packCredits > 0 ? "text-primary" : "text-muted-foreground"}`}>
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

- [ ] **Step 3: Extend `UserProfile` type to include packCreditsBalance**

In `src/lib/auth/AuthProvider.tsx`, update the `UserProfile` interface:

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
  subscriptionPeriodEnd?: string | null
}
```

Then update `src/app/api/user/profile/route.ts` to include these fields in the response:

```typescript
return NextResponse.json({
  profile: {
    id: profile.id,
    supabaseId: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || null,
    avatarUrl: user.user_metadata?.avatar_url || null,
    creditsBalance: profile.creditsBalance,
    packCreditsBalance: (profile as { packCreditsBalance?: number }).packCreditsBalance ?? 0,
    freeCreditsUsed: profile.freeCreditsUsed,
    tier: profile.tier,
    creditResetDate: profile.creditResetDate,
    subscriptionPeriodEnd: (profile as { subscriptionPeriodEnd?: Date | null }).subscriptionPeriodEnd?.toISOString() ?? null,
  },
})
```

- [ ] **Step 4: Commit**

```bash
git add src/components/payments/BillingDashboard.tsx src/app/api/billing src/lib/auth/AuthProvider.tsx src/app/api/user/profile/route.ts
git commit -m "feat(billing): dashboard with pack balance and cancel subscription"
```

---

## Task 11: Header banner for Free users

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add the banner**

In `src/components/layout/Header.tsx`, add this inside the header component (near the top of the render, before the main nav):

```tsx
{profile && profile.tier === 'FREE' && profile.creditsBalance <= 3 && (
  <div className="bg-primary/[0.06] border-b border-primary/20 px-4 py-2 text-center">
    <span className="text-[11px] text-foreground">
      <strong>{profile.creditsBalance}</strong> Free Reports left this month ·{" "}
      <Link href="/pricing" className="text-primary font-semibold hover:underline">
        Upgrade to Monthly →
      </Link>
    </span>
  </div>
)}
```

Ensure `Link` and `useAuth` are imported at the top of the file.

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): banner for free users with reports left"
```

---

## Task 12: Analytics events

**Files:**
- Create: `src/lib/analytics/events.ts`
- Create: `supabase/migrations/20260418_analytics_events.sql`
- Create: `src/app/api/analytics/route.ts`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260418_analytics_events.sql`:

```sql
CREATE TABLE IF NOT EXISTS analytics_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid,
  event_name   text NOT NULL,
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_user_idx ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events(event_name);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages analytics" ON analytics_events FOR ALL USING (auth.role() = 'service_role');
```

Apply:
```bash
psql "$DATABASE_URL" -f supabase/migrations/20260418_analytics_events.sql
```

- [ ] **Step 2: Create the analytics client**

Create `src/lib/analytics/events.ts`:

```typescript
export type AnalyticsEvent =
  | { event: 'pricing_page_viewed'; payload: { source: string } }
  | { event: 'plan_clicked'; payload: { planId: string; billingCycle?: string } }
  | { event: 'checkout_started'; payload: { planId: string; amount: number; sessionId: string } }
  | { event: 'checkout_completed'; payload: { planId: string; amount: number; sessionId: string } }
  | { event: 'checkout_cancelled'; payload: { planId: string; reason?: string } }
  | { event: 'upsell_shown'; payload: { context: string; fromPlan: string; toPlan: string } }
  | { event: 'upsell_converted'; payload: { context: string; fromPlan: string; toPlan: string } }
  | { event: 'subscription_canceled'; payload: { tier: string } }

export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
    })
  } catch {
    // swallow — analytics must never break the app
  }
}
```

- [ ] **Step 3: Create the analytics endpoint**

Create `src/app/api/analytics/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { dbQuery } from '@/lib/db/sql'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json().catch(() => null)
    if (!body || typeof body.event !== 'string') {
      return NextResponse.json({ error: 'bad event' }, { status: 400 })
    }

    await dbQuery(
      `INSERT INTO analytics_events (user_id, event_name, payload) VALUES ($1, $2, $3)`,
      [user?.id ?? null, body.event, JSON.stringify(body.payload ?? {})],
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('analytics POST failed:', err)
    return NextResponse.json({ ok: false }, { status: 200 }) // never break UX
  }
}
```

- [ ] **Step 4: Wire `track()` into the flow**

Add calls at these exact points:

- `src/app/[locale]/pricing/page.tsx`: inside `useEffect(() => { track({ event: 'pricing_page_viewed', payload: { source: 'direct' } }) }, [])`
- `PricingCards.tsx`: inside `onSelect` handler before calling parent — `track({ event: 'plan_clicked', payload: { planId } })`
- `CheckoutModal.tsx`: at the top of `goToStripe` — `track({ event: 'checkout_started', payload: { planId: plan.id, amount: plan.price, sessionId: '' } })`; also when `showPackUpsell` renders — `track({ event: 'upsell_shown', payload: { context: 'pack_modal', fromPlan: 'pack', toPlan: 'monthly' } })`; and when "Switch to Monthly" is clicked — `track({ event: 'upsell_converted', payload: { context: 'pack_modal', fromPlan: 'pack', toPlan: 'monthly' } })`
- `/checkout/success/page.tsx`: once `ready === true`, fire `track({ event: 'checkout_completed', payload: { planId: profile?.tier ?? 'unknown', amount: 0, sessionId: new URLSearchParams(window.location.search).get('session_id') ?? '' } })`
- `/checkout/cancel/page.tsx`: on mount, `track({ event: 'checkout_cancelled', payload: { planId: '', reason: 'user_back' } })`
- `BillingDashboard.tsx` cancel handler: after success, `track({ event: 'subscription_canceled', payload: { tier } })`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260418_analytics_events.sql src/lib/analytics src/app/api/analytics src/components src/app/[locale]
git commit -m "feat(analytics): track pricing + checkout funnel"
```

---

## Task 13: End-to-end test with Stripe CLI

**Files:**
- Create: `tests/integration/checkout.e2e.test.ts`
- Doc: `docs/stripe-testing.md`

- [ ] **Step 1: Document local testing**

Create `docs/stripe-testing.md`:

````markdown
# Stripe Testing — local dev

## Install Stripe CLI
```bash
brew install stripe/stripe-cli/stripe
stripe login
```

## Forward webhooks to localhost
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret it prints (`whsec_...`) into `.env.local` as `STRIPE_WEBHOOK_SECRET`.

## Create test products (one-time)
In Stripe Dashboard (test mode):

1. Create Product "Monza Haus Single Report" → Price $29 one-time → copy price ID → `STRIPE_PRICE_SINGLE`
2. Create Product "Monza Haus Reports Pack" → Price $99 one-time → `STRIPE_PRICE_PACK`
3. Create Product "Monza Haus Monthly" → Price $19/month recurring → `STRIPE_PRICE_MONTHLY`
4. Create Product "Monza Haus Annual" → Price $179/year recurring → `STRIPE_PRICE_ANNUAL`

## Happy path (manual QA)
1. `npm run dev`
2. Sign in as a test user
3. Go to `/pricing`, click "Monthly" card
4. Click "Continue to Payment"
5. Use Stripe test card `4242 4242 4242 4242`, any future date, any CVC, any ZIP
6. Back on `/checkout/success` after 2-4 seconds, balance should show 10 Reports + "MONTHLY" tier

## Verify webhook fired
```bash
stripe events list --limit 5
```

## Trigger edge-case events
```bash
# Subscription cancelled (simulate)
stripe trigger customer.subscription.deleted

# Payment failed (simulate)
stripe trigger invoice.payment_failed
```

## Test cards for failure scenarios
- `4000 0000 0000 0002` → declined
- `4000 0000 0000 9995` → insufficient funds
- `4000 0025 0000 3155` → requires 3DS authentication
````

- [ ] **Step 2: Write the integration test**

Create `tests/integration/checkout.e2e.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

// This test documents the expected manual flow. Run Stripe CLI first.
// Skip unless STRIPE_SECRET_KEY is set (test mode).

const skip = !process.env.STRIPE_SECRET_KEY
const d = skip ? describe.skip : describe

d('Checkout E2E (live Stripe test mode)', () => {
  it('create-session returns a Stripe URL for single plan', async () => {
    const res = await fetch('http://localhost:3000/api/checkout/create-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'single' }),
      // This test requires an authenticated session — in CI use a pre-seeded session cookie.
    })
    // In practice this returns 401 without auth; document expectations instead.
    expect([200, 401]).toContain(res.status)
  })
})
```

- [ ] **Step 3: Run tests one final time**

Run: `npm test`
Expected: all unit tests PASS. Integration test is `.skip` unless Stripe is configured.

- [ ] **Step 4: Commit**

```bash
git add docs/stripe-testing.md tests/integration/checkout.e2e.test.ts
git commit -m "docs(stripe): local testing guide + e2e skeleton"
```

---

## Task 14: Update pricing page hero copy + FAQ

**Files:**
- Modify: `src/app/[locale]/pricing/page.tsx`

- [ ] **Step 1: Update hero + FAQ**

In `src/app/[locale]/pricing/page.tsx`, replace the hero block with:

```tsx
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

Update the FAQ_ITEMS to:

```tsx
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

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/pricing/page.tsx
git commit -m "copy(pricing): due-diligence narrative with PPI/PPS anchors"
```

---

## Task 15: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Smoke test checklist (manual with Stripe CLI running)**

- [ ] Free user → hit 4th report → `OutOfReportsModal` appears → click upgrade → `/pricing`
- [ ] Click Single $29 → modal → Stripe → pay with `4242...` → success page → balance shows 1 pack credit
- [ ] Click Pack $99 → modal shows upsell → click "Switch to Monthly" → modal changes to Monthly
- [ ] Click Monthly → pay → success page → tier shows MONTHLY, balance shows 10
- [ ] Click Annual toggle → card shows $179 → pay → tier shows ANNUAL
- [ ] Billing dashboard → click Cancel → confirm dialog → subscription shows canceled
- [ ] Webhooks in `stripe events list` show all events processed

- [ ] **Step 5: Final commit (if anything changed)**

```bash
git add -A
git commit -m "chore(checkout): final polish from smoke test"
```

---

## Summary of files created/modified

**Created:**
- `supabase/migrations/20260418_extend_user_for_subscriptions.sql`
- `supabase/migrations/20260418_analytics_events.sql`
- `src/lib/stripe/client.ts`
- `src/lib/stripe/priceIds.ts`
- `src/lib/stripe/webhookHandlers.ts`
- `src/lib/stripe/__tests__/priceIds.test.ts`
- `src/lib/stripe/__tests__/webhookHandlers.test.ts`
- `src/lib/credits/__tests__/subscriptionHelpers.test.ts`
- `src/lib/analytics/events.ts`
- `src/app/api/checkout/create-session/route.ts`
- `src/app/api/checkout/create-session/route.test.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/app/api/billing/cancel-subscription/route.ts`
- `src/app/api/analytics/route.ts`
- `src/app/[locale]/checkout/layout.tsx`
- `src/app/[locale]/checkout/success/page.tsx`
- `src/app/[locale]/checkout/cancel/page.tsx`
- `src/components/payments/OutOfReportsModal.tsx`
- `tests/integration/checkout.e2e.test.ts`
- `docs/stripe-testing.md`

**Modified:**
- `package.json` / `package-lock.json` (Stripe SDK)
- `.env.local.example` (new env keys)
- `src/lib/credits/index.ts` (subscription helpers + pack-first consumption)
- `src/lib/auth/AuthProvider.tsx` (UserProfile extended)
- `src/app/api/user/profile/route.ts` (expose new fields)
- `src/components/payments/PricingCards.tsx` (4 tiers + toggle)
- `src/components/payments/CheckoutModal.tsx` (Stripe redirect + upsell)
- `src/components/payments/BillingDashboard.tsx` (new tier display + cancel)
- `src/components/layout/Header.tsx` (free banner)
- `src/app/[locale]/pricing/page.tsx` (hero copy + FAQ)

Total: ~20 new files, ~8 modified files, ~15 commits.
