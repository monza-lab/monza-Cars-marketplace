# Funnel Reliability Closure Design

## Goal

Close the remaining Embudo v3 release blockers without adding friction to the first-report journey or inventing market evidence.

## User Flow Contract

An anonymous visitor can browse, open a car, tap any report CTA, enter one email address, and receive the first report in the same tab. Account authentication is reserved for claimed accounts and subsequent free reports.

The report-generation result is valid in either of two states:

1. A valuation report backed by sufficient comparable-market evidence.
2. A sparse-data report containing vehicle identity, detected and missing signals, provenance, inspection priorities, ownership considerations, risks, seller questions, and source facts while explicitly withholding numeric fair value.

## Sparse-Data Reports

When regional market statistics cannot be computed from at least three usable comparables, generation continues in sparse-data mode.

- `fair_value_low`, `fair_value_high`, and all specific-car fair-value fields are `null`.
- `median_price` is `0` because no defensible market baseline exists.
- `comparable_layer_used` is `null` and `comparables_count` is `0`.
- No price modifiers are applied and `modifiers_total_percent` is `0`.
- The asking price is retained only as listing context. It is never presented as estimated fair value.
- Market-confidence output is `insufficient`.
- Copy must state that there is insufficient market evidence for a valuation and must not imply that the asking price is fair.
- Signal extraction, VIN and color intelligence, landed-cost context, due diligence, and seller questions continue when their inputs are available.
- Persistence, scoped access-token completion, and email delivery follow the same path as a normal report.

The implementation should isolate valuation resolution from the rest of report composition so sparse mode does not duplicate the report pipeline.

## Email Delivery

The Resend adapter remains the transactional-email boundary. Deployment configuration must provide:

- `RESEND_API_KEY`
- `REPORT_EMAIL_FROM`
- `NEXT_PUBLIC_SITE_URL`

Install and use Vercel CLI to link the correct project and inspect or pull environment configuration without printing secret values. Confirm the sender address belongs to a verified Resend domain. A delivery test succeeds only when Resend accepts the request and the message is observed in a controlled inbox; local report rendering remains independent of email delivery.

Missing email configuration must produce a clear server-side diagnostic. It must not prevent the already-generated report from opening in the same tab.

## Scraper-State Security

Enable RLS on `public.scraper_state`. Only the service role may select, insert, update, or delete rows. Anonymous and authenticated Supabase clients receive no policy granting access.

The BeForward scraper already creates its client from `SUPABASE_SERVICE_ROLE_KEY`; preserve that contract and remove the anonymous-key fallback for state persistence so a misconfigured scraper fails closed instead of writing through a public role.

The migration must be idempotent and must preserve existing `scraper_state` rows.

## Error Handling

- Sparse market evidence is a successful report state, not an HTTP 422 error.
- Missing listing data remains a 404.
- Access, rate-limit, and claim decisions remain unchanged.
- Unexpected storage or generation failures retain structured error responses.
- Email-provider failure is logged with provider-safe context and does not revoke report access.

## Validation

1. A failing route test proves that `marketStats: null` currently returns 422.
2. After implementation, the same test proves a successful sparse report with null valuation fields and completed lead access.
3. Existing normal-market report tests remain green.
4. Schema tests assert RLS and service-role-only policy definitions for `scraper_state`.
5. A service-role smoke check reads and upserts a namespaced QA state row; an anonymous-key check cannot read it. The QA row is removed afterward.
6. Vercel environment inspection confirms required key names without exposing values.
7. A live browser check generates a sparse-data report from the previously failing Carrera GT path without authentication.
8. A controlled inbox receives the durable report link when Resend configuration is available.
9. The focused test suite, lint, production build, and diff checks pass.

## Non-Goals

- Do not fabricate valuation numbers from asking price.
- Do not reduce the three-comparable minimum for numeric valuation.
- Do not change the first-report and account-claim allocation.
- Do not expose `scraper_state` to browser clients.
- Do not make inbox delivery a prerequisite for same-tab report access.
