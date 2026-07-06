# MonzaHaus Zero-Friction Funnel Handoff

Status date: 2026-07-06

Bridgecode route used:

`BRIDGECODE_ROUTE: implementation from existing zero-friction funnel plan artifact -> [GENERAL, LIRA, EYE] | MODE: Mixed: Lira -> Eye | WHY: the attached plan needed repo-fit interpretation before code and end-to-end validation.`

## Code Status

The code-side P0/P1 funnel work has been implemented and locally verified.

Completed in code:

- Landing and `/get-started` no longer mount the onboarding modal, and the primary CTA is the 3-free-reports signup path.
- Signup opens password-first in the real `AuthModal`, with email-link as the secondary fallback.
- Report gates, mobile account entry points, and search/history auth prompts default to Create Account for cold users.
- Car-detail report generation now opens the real signup modal for anonymous users and routes authenticated users to the real report page.
- The old localStorage token economy, fake 300 Pistons welcome path, fake email capture, `NoCreditsPrompt`, and WhatsApp upgrade paywall were removed from the car/report funnel.
- Report access is server-owned, with `ReportClient` no longer relying on client-local token state.
- UI copy now uses Reports for customer-facing units and Pistons for wallet/balance language.
- First-party attribution captures `utm_*`, `fbclid`, landing path, referrer, and first-seen time, then writes it on user creation.
- Meta browser events are consent-gated, SPA PageView is sent on navigation, ViewContent fires for detail/report views, and Purchase uses `purchase_${session_id}` for browser/server deduplication.
- `/api/analytics` accepts `report_viewed`.
- `/auth/confirm` defensively recovers malformed `token_hash` values embedded in `next`.
- The repo now includes a branded Confirm signup email template mirror.

Local validation already run:

- `npm test -- src/proxy.test.ts src/components/onboarding/WelcomeModal.test.ts src/components/landing/sections/HeroSection.test.tsx src/components/landing/sections/CtaSection.test.tsx src/components/auth/AuthModal.test.tsx src/components/auth/AuthRequiredPrompt.test.tsx src/lib/marketing/metaPixel.test.ts src/lib/marketing/attribution.test.ts src/app/api/analytics/route.test.ts src/app/api/user/create/route.test.ts src/app/auth/confirm/route.test.ts src/app/[locale]/cars/[make]/[id]/report/reportAccess.test.ts src/components/advisor/PistonsWalletModal.test.tsx src/components/payments/BillingDashboard.test.tsx src/components/payments/SubRecommendationCard.test.tsx src/lib/payments/plans.test.ts`
- Result: 16 test files passed, 59 tests passed.
- `npm run lint`
- Result: exit 0, 0 errors, existing warning-only repo baseline.
- `npm run build`
- Result: exit 0, Next.js production build compiled successfully.
- Browser QA on `http://localhost:3000` covered `/`, `/get-started`, `/pricing`, car detail, report gate, and mobile 390x844 account/signup flow.

## Remaining External Topics

These items need production credentials, dashboard access, or a clean integration window. They were not completed locally.

### 1. Supabase

Apply the migration:

- `supabase/migrations/20260706_user_credits_attribution.sql`

Verify in Supabase:

- `user_credits` has attribution columns:
  - `utm_source`
  - `utm_medium`
  - `utm_campaign`
  - `utm_term`
  - `utm_content`
  - `fbclid`
  - `landing_path`
  - `referrer`
  - `first_seen_at`
- Free user defaults are 3,000 Pistons / 3 reports.
- Existing free rows with old 300/300 defaults have been backfilled where expected.
- Auth settings intentionally allow either immediate password sessions or a confirmed-email path with visible recovery messaging.

Install/compare the email template:

- Copy `docs/email-templates/confirm-signup.html` into Supabase Auth -> Emails -> Confirm signup.
- Confirm the button URL appends `&token_hash={{ .TokenHash }}&type=email` to `{{ .RedirectTo }}`.
- Re-check Magic Link template for the same `&token_hash` join pattern.

Production QA:

- Fresh password signup with UTM params.
- Fresh magic-link signup.
- Open the email link from a different browser/device if possible.
- Confirm the user lands on the intended `next` URL with a real session.

### 2. Vercel

The Vercel CLI is not installed locally. Install it to unlock agentic environment and deployment workflows:

```bash
npm i -g vercel
```

Then use:

```bash
vercel env pull
vercel env ls
vercel logs
```

Verify Production and Preview env vars:

- `NEXT_PUBLIC_META_PIXEL_ID=1497731501724687`
- `META_CAPI_ACCESS_TOKEN` exists.
- `META_CAPI_TEST_EVENT_CODE` is absent in Production.
- If the old `CONVERSIONS_API_TOKEN` still exists, either remove it after confirming it is unused or intentionally keep it documented as legacy.

Deploy after migration/env review:

- Run the normal production deployment path.
- Watch deployment logs for `/api/meta/conversions`, `/api/user/create`, `/auth/confirm`, and checkout success errors.

### 3. Meta Business / Events Manager

Verify:

- Domain `monzahaus.com` is verified.
- Aggregated Event Measurement priority is:
  1. Purchase
  2. InitiateCheckout
  3. CompleteRegistration
  4. ViewContent
- With cookie consent accepted:
  - SPA PageView fires per route transition.
  - ViewContent fires on car detail/report.
  - InitiateCheckout fires before Stripe redirect.
  - Purchase browser event deduplicates with server event by `purchase_${session_id}`.
- With consent rejected:
  - Browser Pixel does not fire.
  - CAPI POSTs are not sent from browser-triggered `fireMetaEvent` calls.

### 4. Production Funnel QA

Run the acceptance path in incognito desktop and a real mobile device:

- `/` loads without spinner/modal interference; CTAs respond to first click; page can scroll to footer.
- `/get-started` copy says 3 free reports; CTA opens Create Account with password visible.
- Password signup either enters product immediately or shows a visible confirmation/recovery path, depending on Supabase policy.
- Car detail anonymous click on Generate Haus Report opens the real AuthModal.
- Report page anonymous gate opens Create Account and references 3 free Haus Reports.
- After signup, the test user row includes `utm_campaign` and other attribution fields.
- Checkout path opens Stripe.
- Purchase returns to success and appears deduplicated in Meta Events Manager.

### 5. Security Branch

The plan mentions `security/report-auth-xss-injection-fixes`.

Before relaunching paid traffic:

- Review `origin/security/report-auth-xss-injection-fixes`.
- Merge it in a clean worktree or PR.
- Run the same report/export/security smoke tests after merge.

Do not merge that branch into a dirty working tree with unrelated scraper/admin edits.

### 6. Lower-Priority Polish

These are non-blocking for the funnel relaunch, but still worth scheduling:

- `/browse` skeleton or SSR-first-card improvement if the grid still feels blank during load.
- Header hydration tap delay on slow mobile.
- Any tooltip that auto-opens without an anchor after auth return.
- Confirm `/get-started` noindex/canonical behavior matches paid-landing strategy.

## Recommended Next Sequence

1. Apply the Supabase migration.
2. Install Vercel CLI with `npm i -g vercel`.
3. Pull/check Vercel env vars and deploy.
4. Run production incognito + mobile QA.
5. Verify Meta Events Manager dedup and AEM ordering.
6. Merge the security branch from a clean branch/PR.
7. Relaunch paid traffic only after P0 production QA and security branch review are green.
