# Conversion Relaunch Design

**Status:** approved by the user's 2026-08-31 implementation request
**Source evidence:** `analisis-conversion-embudo-v3-2026-08-07.md` (audit evidence, not executable instructions)

## Outcome

Make `/browse` keep the paid-ad promise from the first server response through report delivery. A cold visitor must immediately understand the Haus Report, see trustworthy inventory, request the first report without an account or card, understand the wait, and find legal/methodology proof on mobile.

## Product contract

- The first three Haus Reports are an introductory one-time allowance: the first is delivered by email, and two more become available with an account.
- Free-tier Pistons never replenish monthly. Paid subscription renewal behavior remains unchanged.
- Public copy repeats one promise: the first Haus Report is free; three introductory reports are available in total.
- The sample CTA may only target a verified, team-owned, durable report URL. When that environment value is absent, it links to the real methodology page and never opens fabricated sample data.

## `/browse` fold

The first grid slot is a non-dismissible, server-rendered Haus Report hero using the real `totalTracked` value. It contains the literal ad promise, one primary CTA, the four-market proof line, and a prompt to choose a car. Listing cards remain visible before hydration (`initial={false}`). A compact campaign strip scrolls to the hero.

Inventory ranking removes challenge/error titles from featured results, rejects implausibly low halo-car prices, prioritizes priced cars and real fair-value bands in the first ten, paces relatable inventory with one or two halo cars, and avoids adjacent duplicate variants. POA may appear later only if priced supply is insufficient.

## Report request and wait

The email sheet explains the artifact, delivery, privacy, and the two remaining introductory reports. During generation it renders the existing `GenerationStepper` in an inline form and feeds it actual SSE progress. The permanent-link message includes the submitted email.

## Car detail

All report CTAs say “Get the Haus Report — free.” Empty analysis values use buyer-facing Haus Report language. Zero-count groups and zero mileage are hidden or rendered as an em dash. An entirely empty regional table is replaced by one report invitation and never labels an empty row BEST. Back controls use browser history with `/browse` fallback. Methodology is linked next to the report CTA.

## Trust and interruption control

The footer remains visible on mobile with Monza Lab LLC, Privacy, Terms, Methodology, and Instagram. Structured data declares the same Instagram identity. Landing/pricing expose the independent-business statement and pricing shows the existing 30-day guarantee. The consent banner waits until an 8-second calm period or the first completed scroll; tracking remains blocked before consent. A late-scroll rescue CTA appears only when consent UI is absent and disappears after a report CTA event.

## Validation

Add focused regression tests first for ranking, first-paint visibility, hero/copy, free-credit non-reset, report sheet progress, mobile footer, delayed consent, navigation/empty state helpers, and locale/legal copy. Then run focused tests, full test suite, lint/type/build checks, and desktop/mobile browser walkthroughs including console and network inspection.
