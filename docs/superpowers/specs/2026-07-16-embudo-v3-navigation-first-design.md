# Embudo v3 Navigation-First Design

**Status:** Approved for local implementation on 2026-07-16.

## Goal

Paid traffic lands on `/browse`, explores cars without authentication prompts, selects a car, and sees an immediately visible `Generate Haus Report - free` action. A new visitor enters only an email address; the selected report is generated or served fresh from cache, displayed in the same Instagram in-app-browser tab, and sent by email through the existing MonzaHaus Resend account.

## Approved Contract

- Ads target `/browse`; `/` and `/get-started` remain available for organic/direct traffic.
- The report CTA is immediately visible on car detail, with a report preview remaining secondary.
- The first report requires email only. It appears in the current tab and is also sent through a durable link.
- Reports two and three require account claim through password or Google.
- A signed-out email already attached to a claimed account must authenticate before report access.
- Durable report links do not expire automatically, are scoped to one report, store only a hash, and are revocable.
- A fresh cached report counts as one entitlement and is delivered immediately. Cache freshness is seven days, invalidated earlier by material listing changes.
- Anti-abuse retains three requests per IP/device per hour, disposable-domain blocking, and no entitlement consumption on failure. There is no global daily cap.
- Supabase is the funnel analytics source of truth. Meta maps email capture to `Lead`, account claim to `CompleteRegistration`, and successful display to `ReportViewed`.
- Anonymous behavioral analytics respect analytics consent. Attribution is persisted when email is submitted.
- Add `gclid` to first-touch attribution.
- Send an immediate report-ready email and one D+1 account-claim reminder through the existing Resend account/domain.
- Remove `AI` from all customer-facing copy and metadata; internal names may remain.
- Keep the existing browser-local watchlist and remove it from account-claim promises.
- Local implementation and verification only. Do not deploy or mutate production services.

## Architecture

Unverified visitors live in `report_leads`, not Supabase Auth. `report_lead_reports` records the first entitlement. A report request creates a random token, stores only its SHA-256 hash in `report_access_tokens`, and returns the raw token once to the browser. The token is sent to the existing analysis route, scoped to one lead and listing, and becomes viewable only after successful generation. The durable email contains the same report URL and raw token.

Authenticated users retain the existing `user_credits` and `user_reports` path. When a lead later claims an account, `/api/user/create` atomically transfers its report entitlement, adjusts the remaining free balance without resetting it, marks the lead claimed, and fires `CompleteRegistration`.

The report page accepts either normal authenticated entitlement or a valid report token. Tokens never confer account, export, or unrelated report access. Export routes remain authenticated.

## User Flow

1. Instagram ad opens `/browse` with UTM/fbclid/gclid parameters.
2. A one-line dismissible context strip appears only for attributed traffic.
3. The visitor browses and opens a selected car without login UI.
4. The immediate report CTA opens a one-field email sheet.
5. The server rejects disposable addresses, claimed-account collisions, second lead reports, and IP/device rate excess.
6. The client displays progress in the same sheet while `/api/analyze` generates or reuses a fresh report.
7. On success, the entitlement is committed, the immediate email is sent, and the current tab navigates to the full report with its scoped access token.
8. At D+1, an unclaimed lead receives one claim reminder.
9. A second report request routes an unclaimed lead to account claim; a claimed signed-out user routes to sign-in.

## Failure Contract

- Invalid/disposable email: field-level error, no lead entitlement.
- Rate limit: retryable 429 with a stable code.
- Generation failure: remain on selected car, retain entered email, allow retry, consume no report.
- Email delivery failure after generation: show the report immediately and log delivery failure; do not roll back access.
- Expired/revoked/unknown token: show a safe report-access error without leaking whether an email exists.
- Existing claimed email: require sign-in before generation.

## Validation

- Unit/route tests cover hashing, token scope/revocation, lead state transitions, rate limiting, disposable domains, attribution including gclid, analytics persistence, entitlement merge, and email payloads.
- Existing authenticated report tests remain green.
- Browser QA covers `/browse` with and without UTM, anonymous browse to car detail, immediate CTA, email sheet states, same-tab report navigation, mobile viewport, keyboard focus, and absence of anonymous login/onboarding overlays.
- Local build must pass. Production email, Meta Events Manager, real Instagram, and live migrations remain external verification gates.
