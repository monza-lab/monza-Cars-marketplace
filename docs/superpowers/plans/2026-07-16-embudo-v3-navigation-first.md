# Embudo v3 Navigation-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved navigation-first, email-at-report funnel locally with report-scoped access, durable delivery, analytics, attribution, and launch QA.

**Architecture:** Unverified visitors use dedicated lead and token tables; authenticated users keep the existing credit/report economy. A single report-scoped token authorizes generation/viewing for one lead and listing, then account claim merges that entitlement into the existing user model.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres, Vitest, Playwright, Resend HTTP API.

---

### Task 1: Lead, access-token, analytics, and reminder schema

**Files:**
- Create: `supabase/migrations/20260716_embudo_v3_report_leads.sql`
- Create: `tests/schema/embudo-v3-schema.test.ts`

- [ ] Write a failing schema test asserting `report_leads`, `report_lead_reports`, `report_access_tokens`, `report_request_attempts`, `analytics_events`, `gclid`, indexes, RLS, and service-role policies.
- [ ] Run `npx vitest run tests/schema/embudo-v3-schema.test.ts` and verify failure because the migration is absent.
- [ ] Add idempotent SQL with unique normalized email, one lead report per listing, hashed token uniqueness, claim/reminder timestamps, request-attempt indexes, and analytics payload JSON.
- [ ] Re-run the test and verify pass.

### Task 2: Report-access domain service

**Files:**
- Create: `src/lib/reportAccess/tokens.ts`
- Create: `src/lib/reportAccess/policy.ts`
- Create: `src/lib/reportAccess/repository.ts`
- Create: `src/lib/reportAccess/tokens.test.ts`
- Create: `src/lib/reportAccess/policy.test.ts`

- [ ] Write failing tests for token generation/hash equality, email normalization, disposable domains, three-per-hour decisions, claimed-account collision, first-report allowance, claim requirement, seven-day freshness, and material listing fingerprints.
- [ ] Run the focused tests and verify the expected missing-module failures.
- [ ] Implement crypto with Node primitives, explicit policy result codes, and a thin Supabase service-role repository.
- [ ] Re-run focused tests and verify pass.

### Task 3: Lead request and report generation boundary

**Files:**
- Create: `src/app/api/report-access/request/route.ts`
- Create: `src/app/api/report-access/request/route.test.ts`
- Modify: `src/app/api/analyze/route.ts`
- Modify: `src/app/api/analyze/route.test.ts`
- Modify: `src/lib/reports/queries.ts`

- [ ] Write failing route tests for new lead success, claimed email `AUTH_REQUIRED`, prior unclaimed lead `CLAIM_REQUIRED`, disposable email, rate limit, attribution persistence, scoped-token generation, no debit on failure, and lead entitlement commit on success.
- [ ] Run the focused route tests and confirm behavioral failures.
- [ ] Implement the request endpoint and extend analysis authorization to accept a valid pending lead token in addition to existing Supabase auth.
- [ ] Preserve authenticated credit semantics and commit lead entitlement only after report persistence succeeds.
- [ ] Re-run route and existing report-query tests.

### Task 4: Durable report viewing and email delivery

**Files:**
- Create: `src/lib/email/resend.ts`
- Create: `src/lib/email/reportEmails.ts`
- Create: `src/lib/email/reportEmails.test.ts`
- Modify: `src/app/[locale]/cars/[make]/[id]/report/page.tsx`
- Modify: `src/app/[locale]/cars/[make]/[id]/report/reportAccess.ts`
- Modify: `src/app/[locale]/cars/[make]/[id]/report/reportAccess.test.ts`
- Modify: `.env.example`

- [ ] Write failing tests for scoped view authorization, revoked/unknown tokens, immediate email URL, delivery failure tolerance, and non-expiring token behavior.
- [ ] Implement Resend through `fetch` with `RESEND_API_KEY`, `REPORT_EMAIL_FROM`, and `NEXT_PUBLIC_SITE_URL`; add no runtime dependency.
- [ ] Allow the HTML report page to render with authenticated entitlement or a valid report token; keep PDF/Excel auth unchanged.
- [ ] Trigger immediate report email after successful lead generation and verify failures do not hide the in-tab report.

### Task 5: Account-claim merge and D+1 reminder

**Files:**
- Modify: `src/app/api/user/create/route.ts`
- Modify: `src/app/api/user/create/route.test.ts`
- Create: `src/app/api/cron/report-claim-reminders/route.ts`
- Create: `src/app/api/cron/report-claim-reminders/route.test.ts`
- Modify: `vercel.json`

- [ ] Write failing tests proving a claimed account inherits the lead report, retains two free reports, marks the lead claimed, and fires `CompleteRegistration` once.
- [ ] Write failing cron tests for one reminder after 24 hours, no resend, no claimed-user reminder, and safe email failure handling.
- [ ] Implement idempotent merge and reminder processing guarded by `CRON_SECRET`.
- [ ] Re-run focused tests.

### Task 6: Browse entry and same-tab report UX

**Files:**
- Create: `src/components/browse/CampaignContextStrip.tsx`
- Create: `src/components/browse/CampaignContextStrip.test.tsx`
- Create: `src/components/report/ReportEmailSheet.tsx`
- Create: `src/components/report/ReportEmailSheet.test.tsx`
- Modify: `src/components/browse/BrowseClient.tsx`
- Modify: `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx`
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `messages/en.json`

- [ ] Write failing component tests for UTM-only strip visibility/dismissal, immediate CTA, email-only form, progress/error states, auth/claim responses, and same-tab report navigation.
- [ ] Remove global anonymous onboarding prompts and hide anonymous advisor chrome.
- [ ] Integrate the strip and email sheet using accessible dialog semantics, focus restoration, mobile-safe sizing, and no popup/new-tab behavior.
- [ ] Keep signed-in users on the existing authenticated flow.
- [ ] Re-run component tests.

### Task 7: Funnel analytics, attribution, and Meta mapping

**Files:**
- Modify: `src/lib/marketing/attribution.ts`
- Modify: `src/lib/marketing/attribution.test.ts`
- Modify: `src/lib/analytics/events.ts`
- Modify: `src/app/api/analytics/route.ts`
- Modify: `src/app/api/analytics/route.test.ts`
- Modify: `src/components/legal/ClientTrackers.tsx`
- Modify: `src/app/api/user/create/route.ts`

- [ ] Write failing tests for `gclid`, database event persistence, event validation, consent-gated anonymous events, Lead on email capture, ReportViewed on display, and CompleteRegistration on claim.
- [ ] Implement a service-role analytics sink with pseudonymous session IDs and structured payload validation.
- [ ] Instrument landing, car view, CTA, email, report view, and claim events without letting analytics failures break product behavior.
- [ ] Re-run analytics and attribution tests.

### Task 8: Public copy and trust quick wins

**Files:**
- Modify: customer-facing `src/app/**`, `src/components/**`, and `messages/en.json` matches found by the copy audit.
- Modify: `src/app/[locale]/pricing/page.tsx`
- Modify: `src/app/[locale]/get-started/page.tsx`
- Modify: relevant dashboard/valuation components for SSR counters and asking-price fallback.
- Modify: `tests/quality/no-public-ai-copy.test.ts`

- [ ] Write a failing quality test scanning public source/messages for prohibited AI copy and `Genshpod`.
- [ ] Rename the public plan to `Monthly`, route `/get-started` CTA to `/browse`, remove public AI language, preserve internal identifiers, ensure counters use server data, and replace `Sold: - (n=0)` with asking-based copy.
- [ ] Re-run quality and affected component tests.

### Task 9: Verification

**Files:**
- Modify only when a failing verification exposes a scoped defect.

- [ ] Run all focused tests from Tasks 1-8.
- [ ] Run `npm run lint`, `npm test`, and `npm run build`.
- [ ] Start the local app on an available port.
- [ ] Verify `/browse?utm_source=instagram&utm_campaign=embudo-v3&fbclid=test`, anonymous car detail, immediate CTA, email sheet, mobile viewport, keyboard flow, no onboarding/login overlay, and console/layout health in the in-app browser.
- [ ] Record external gates: Resend key/domain, Supabase migration/config, Meta Events Manager, production deployment, and real Instagram-device QA.
