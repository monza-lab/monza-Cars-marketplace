# Conversion Relaunch Implementation Plan

> **Route:** GENERAL → LIRA → EYE. Execute as one vertical conversion slice and preserve existing unrelated workspace edits.

## 1. Lock the free-report contract

- Add failing query tests proving new free accounts receive 3,000 welcome Pistons with no monthly allowance and proving stale FREE accounts are never reset.
- Add a migration that changes the FREE default/rows to `monthly_allowance_pistons = 0` without modifying balances.
- Separate welcome allowance from paid monthly allowance in report queries and degraded profile responses; leave paid renewals unchanged.
- Add failing locale/legal tests for one-time copy across supported locales, then align messages and Terms §4.

## 2. Make the `/browse` first response convert

- Add failing component tests for the Report Hero Card, real count, safe sample fallback, actionable campaign strip, card first-paint visibility, full platform labels, and card report CTA hierarchy.
- Implement a server-renderable hero component and insert it before listing slot zero.
- Set motion initial state to visible and add report CTA tracking/state used by the rescue prompt.

## 3. Curate the featured grid

- Add failing ranking tests for challenge-title exclusion, halo-price sanity, priced top ten, fair-value priority, relatable/halo pacing, and adjacent variant dedupe.
- Extend ranking inputs with price/fair-value data and apply conversion-quality gates before the existing collector-significance scoring.
- Preserve deterministic ranking and established portfolio caps outside the first conversion window.

## 4. Repair the report ask and wait

- Add failing tests for exact sales/privacy copy and SSE progress propagation.
- Add an inline mode to `GenerationStepper` and mount it in `ReportEmailSheet` while submitting.
- Parse progress events into live steps and show permanent-link reassurance for the submitted email.

## 5. Remove anti-sales detail states

- Add failing tests for back fallback, mileage display, all-POA region behavior, and zero-count badges.
- Replace developer placeholders, hide invalid regional data, remove empty BEST/YOUR MARKET states, and mount `MethodologyLink` below CTAs.
- Use `router.back()` with `/browse` fallback for every detail back control.

## 6. Expose trust and reduce interruption

- Add failing tests for mobile footer/legal links, delayed cookie banner, Instagram structured data, independent-business statement, guarantee copy, and rescue CTA rules.
- Implement footer/JSON-LD/landing/pricing trust surfaces.
- Delay consent UI without loading trackers and add the late-scroll browse rescue CTA.

## 7. Verify the complete story

- Run all focused red/green test files, then the full test suite, lint/typecheck, and production build.
- Start the local app and inspect `/en/browse`, a real detail page, the email sheet, responsive mobile footer, delayed consent behavior, back navigation, console errors, and key requests using the in-app browser.
- Record any production-only blocker, especially the required team-owned `NEXT_PUBLIC_HAUS_REPORT_SAMPLE_URL`; do not fabricate a sample.
