# Funnel Reliability Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make first-report delivery succeed for sparse-data cars, restore transactional email configuration, and secure scraper state without breaking scraper persistence.

**Architecture:** Extract valuation evidence into a small pure boundary that can return either evidence-backed numeric valuation or an explicit sparse state. Keep the existing report pipeline, access-token completion, persistence, and email path shared across both states. Secure `scraper_state` with service-role-only RLS and verify deployment secrets through the linked Vercel project.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Supabase/Postgres RLS, Resend, Vercel CLI, Playwright/in-app browser.

---

### Task 1: Represent Sparse Valuation Evidence

**Files:**
- Create: `src/lib/reports/valuationEvidence.ts`
- Create: `src/lib/reports/valuationEvidence.test.ts`

- [ ] **Step 1: Write failing evidence-resolution tests**

Cover a normal `marketStats` input and `null`. The null case must return:

```ts
{
  mode: "sparse",
  fairValueLow: null,
  fairValueHigh: null,
  baseline: 0,
  comparableLayer: null,
  comparablesCount: 0,
}
```

The normal case must preserve the primary region median, range, mapped comparable layer, and total sample size.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- src/lib/reports/valuationEvidence.test.ts`

Expected: FAIL because `resolveValuationEvidence` does not exist.

- [ ] **Step 3: Implement the pure resolver**

Export a discriminated union and `resolveValuationEvidence(marketStats)`. The sparse branch contains no derived price. The evidence-backed branch maps `model` to `strict`, `series` to `strict`, and `family` to `family`, matching the existing route contract.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- src/lib/reports/valuationEvidence.test.ts`

Expected: PASS.

### Task 2: Generate Sparse Reports Through the Existing Pipeline

**Files:**
- Modify: `src/app/api/analyze/route.ts`
- Modify: `src/app/api/analyze/route.test.ts`
- Modify: `src/lib/fairValue/narrative.ts`
- Create: `src/lib/fairValue/narrative.test.ts`

- [ ] **Step 1: Add a failing route regression test**

Set `computeMarketStatsForCar` to `{ marketStats: null }`, provide lead-token access, and assert a 200 response whose report contains null fair-value fields, zero baseline/comparables, no modifiers, and successful `completeLeadReportAccess`.

- [ ] **Step 2: Run the route test and confirm RED**

Run: `npm test -- src/app/api/analyze/route.test.ts`

Expected: the sparse regression receives 422.

- [ ] **Step 3: Replace the early 422 with valuation evidence**

Use `resolveValuationEvidence`. Apply modifiers only when `mode === "valued"`; otherwise use:

```ts
const appliedModifiers = []
const totalPercent = 0
const specific = { low: null, mid: null, high: null }
```

Continue signal extraction, landed cost, report persistence, token completion, and email delivery. Call legacy `saveReport` only for evidence-backed market stats; always call `saveHausReport`.

- [ ] **Step 4: Make narrative inputs truth-preserving**

Allow the investment narrative input to receive `fairValueMid: null`. Its prompt must explicitly state that numeric fair value is unavailable and prohibit using asking price as fair value.

- [ ] **Step 5: Run route and narrative tests**

Run: `npm test -- src/app/api/analyze/route.test.ts src/lib/fairValue/investmentNarrative.test.ts`

Expected: PASS with both normal and sparse generation covered.

### Task 3: Render Sparse Reports Honestly

**Files:**
- Modify: the narrow report components that currently display numeric fair value when values are absent
- Test: adjacent component test files

- [ ] **Step 1: Locate numeric valuation renderers**

Trace `specific_car_fair_value_mid`, `fair_value_low`, `fair_value_high`, `median_price`, and `confidence_tier` from `ReportClient` into report sections. Record only components that need null-state changes.

- [ ] **Step 2: Add failing component tests**

For a report with null valuation fields and zero comparables, assert visible copy `Insufficient market evidence` and absence of a numeric estimated-fair-value claim.

- [ ] **Step 3: Implement the sparse state**

Render a restrained evidence notice while preserving inspection, provenance, risks, ownership, and seller-question sections. Do not substitute asking price into valuation fields.

- [ ] **Step 4: Run focused component tests**

Run the exact adjacent Vitest files discovered in Step 1.

Expected: PASS.

### Task 4: Secure `scraper_state`

**Files:**
- Create: `supabase/migrations/20260722_secure_scraper_state.sql`
- Modify: `tests/schema/embudo-v3-schema.test.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts`

- [ ] **Step 1: Add failing schema and client tests**

Assert the migration enables RLS, removes public policies, and creates a service-role policy. Assert scraper-state helpers reject configuration without `SUPABASE_SERVICE_ROLE_KEY`, even when an anonymous key exists.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/schema/embudo-v3-schema.test.ts src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts`

- [ ] **Step 3: Add the idempotent migration**

Use:

```sql
ALTER TABLE public.scraper_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages scraper state" ON public.scraper_state;
CREATE POLICY "Service role manages scraper state" ON public.scraper_state
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

Revoke table privileges from `anon` and `authenticated`; preserve service-role access and existing rows.

- [ ] **Step 4: Fail closed in scraper state helpers**

Require `SUPABASE_SERVICE_ROLE_KEY` in `createServiceClient`; do not fall back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

- [ ] **Step 5: Run focused tests and apply migration**

Run the focused tests, then execute only `20260722_secure_scraper_state.sql` against the configured database in a transaction.

- [ ] **Step 6: Verify role behavior**

Use a namespaced QA row. Confirm service-role select/upsert/delete succeeds and anonymous select is denied or returns no accessible rows. Remove the QA row.

### Task 5: Restore Resend Configuration

**Files:**
- Modify: `.env.example` only if required names are missing
- Inspect: Vercel project environment metadata without printing values

- [ ] **Step 1: Install and authenticate Vercel CLI**

Run: `npm i -g vercel`, then `vercel whoami`.

Expected: installed CLI and an authenticated account. If authentication is absent, stop only this task and report the single required login action while continuing code tasks.

- [ ] **Step 2: Link the correct Vercel project**

Use existing repository/project metadata or `vercel link`. Do not create a new project.

- [ ] **Step 3: Inspect environment key presence**

Verify `RESEND_API_KEY`, `REPORT_EMAIL_FROM`, and `NEXT_PUBLIC_SITE_URL` for Production and Preview without printing secret values. Pull Development values into a temporary ignored file or the existing `.env.local` while preserving unrelated local values.

- [ ] **Step 4: Validate the sender contract**

Confirm `REPORT_EMAIL_FROM` uses the verified MonzaHaus sender domain. Do not substitute an unverified address.

- [ ] **Step 5: Perform a controlled delivery test**

Generate a report for a controlled inbox and verify provider acceptance plus inbox receipt. Do not expose the address or access token in logs or handoff output.

### Task 6: Full Verification

**Files:**
- Modify: `agents/testscripts/embudo-v3.spec.ts` with sparse-report coverage

- [ ] **Step 1: Add the live sparse-data browser assertion**

Exercise the Carrera GT path: car page -> bottom `View Report` -> email sheet -> submit -> same-tab tokenized report. Assert `Insufficient market evidence` and no authentication page.

- [ ] **Step 2: Run focused and full tests**

Run: `npm test -- src/lib/reports/valuationEvidence.test.ts src/app/api/analyze/route.test.ts tests/schema/embudo-v3-schema.test.ts src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts`

Then run: `npm test -- --reporter=dot`

- [ ] **Step 3: Run lint and production build**

Run changed-file ESLint, `npm run build`, and `git diff --check`.

- [ ] **Step 4: Verify through the in-app browser**

Replay both a valued and sparse report from `/browse` at a mobile Instagram-sized viewport. Confirm no tokenless `/report`, Google, or account wall occurs for a new email.

- [ ] **Step 5: Record exact residual external blockers**

Completion requires report rendering, secured RLS, and tests/build. Inbox delivery is complete only with provider acceptance and observed receipt; otherwise report the exact missing credential or authentication action without claiming delivery.
