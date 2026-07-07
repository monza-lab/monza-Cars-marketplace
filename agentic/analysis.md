# Analysis

BRIDGECODE_ROUTE: implementation from existing zero-friction funnel plan -> [GENERAL, LIRA, EYE] | MODE: Mixed: Lira -> Eye | WHY: the markdown is a stale-but-actionable implementation artifact that needs repo-fit execution and browser validation.

## Task Signal

Execute the attached MonzaHaus zero-friction registration/payment plan against the current repo, preserving existing scraper/admin worktree changes and validating browser-visible changes on a local server.

## Repo Evidence

- Next.js App Router app with global locale layout.
- Existing dirty worktree has unrelated scraper/admin changes; leave them untouched.
- P0-2 root cause exists: `WelcomeModal` is mounted globally in `src/app/[locale]/layout.tsx`, opens after 600ms for new visitors, and `HomeGate` blocks first paint behind auth/localStorage loading.
- P0-3 root cause exists: `AuthModal` starts signup in email-link mode; `AuthRequiredPrompt`, mobile account sheet, and search-history auth prompt open sign-in by default.
- P0-4 root cause exists: `CarDetailClient` imports `useTokens`, runs localStorage registration, shows "300 Pistons", simulates analysis delivery, and links WhatsApp paywall.
- Real report path exists: `/cars/[make]/[id]/report` uses `AuthModal`, `/api/analyze/v3`, `OutOfPistonsModal`, and `CheckoutModal`.
- A3/A4/A8/A6 gaps exist: client Meta CAPI is not consent-gated, checkout success lacks browser Purchase twin, SPA PageView/ViewContent/report_viewed are missing, and attribution persistence does not exist.

## Implementation Block

Goal: make cold landing -> signup -> report -> payment paths use one real auth/report/pistons system, then add measurement/attribution instrumentation needed by the plan.

Files, LOC, deps:
- No new runtime dependency.
- Add focused tests near changed slices.
- Production edits stay in landing/auth/car-detail/report/marketing/analytics/user-create/email-template/migration surfaces.

Capability slices:
- Landing: no welcome modal on `/` or `/get-started`, no spinner gate for cold anonymous landing, CTA hierarchy sends registration path first, scroll indicator works.
- Auth: signup is password-first; password signup closes immediately when Supabase returns a session; confirmation screen remains for email-confirmation deployments.
- Real report economy: car detail CTA routes to the existing report path; remove localStorage token/signup/paywall UI and `NoCreditsPrompt` export/file.
- Copy/pricing: UI says reports/Pistons consistently where plan calls out key funnel copy; report cost modals derive from `REPORT_PISTON_COST`.
- Analytics/attribution: consent-gated Meta helper, browser Purchase event with `purchase_${session_id}`, SPA PageView, ViewContent, report_viewed, first-party attribution capture and DB persistence.
- Email hygiene: add confirm-signup template, defensive `/auth/confirm` parsing, visible landing error/resend path.

Validation path:
- Red tests first for helper/component/API seams.
- Targeted Vitest for changed files.
- `npm run lint` and `npm run build` if time/environment allows.
- Start local dev server and use in-app browser to verify `/`, `/get-started`, an anonymous car detail page, auth modal default state, route changes, and console health.

External-operation gaps:
- Supabase dashboard setting for password immediate session cannot be changed from repo unless credentials/API are available.
- Vercel production env vars should be checked in Vercel dashboard/CLI; global Vercel CLI is unavailable in this environment.
- Meta Events Manager, Business Manager AEM, mobile real-device QA, and production Supabase auth row checks require external access.
