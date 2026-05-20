# Haus Report Polish — Handoff for Camilo

Branch: `haus-report-polish` → `main`
PR: https://github.com/monza-lab/monza-Cars-marketplace/pull/new/haus-report-polish
Session date: 2026-05-19
Author: Edgar (with Claude pair)

## TL;DR

12 frontend-only commits across the Haus Report (online + PDF + Excel),
the feed surfaces (Monza + Classic), and the email template flow. Zero
API routes, DB schema, or AI pipeline touched. Safe to fast-forward
merge after the four backend follow-ups below are resolved.

The main goals from the 2026-05-19 Monza Weekly were:
- Reportes con datos confiables y diseño final ✓
- Email branded MonzaHaus desde dominio propio (template ready, needs Supabase config) ⏳ Camilo
- Página web limpia con registros correctos ✓ (cars sin foto hidden + region flash fix)

## What ships in this branch

### A. Reporte online (collector-facing)

- **Macro → micro reorder.** 9 → 8 sections. Risk Assessment consolidated
  into Due Diligence (same `<V3DueDiligenceSection>` was rendered twice
  for paid users — confirmed dup via code, not a perception bug). New
  order: Exec Summary → Market Valuation → Investment Performance →
  Vehicle Identity → Market Context → Similar Vehicles → Due Diligence →
  Investment Verdict.
- **Sticky ReportSummaryRail** on xl+ screens (right column) and mobile
  bottom bar. Composition: verdict pill, Fair Value range, asking +
  delta %, then up to 4 peer-comp cards from the same series + price
  range. "View all in same range" deep-links into `/browse?series=X&
  priceMin=Y&priceMax=Z` (Classic view with chips prefilled).
- **Hero compactado.** Switched the cover from a 21:9 banner with
  bottom-overlay title to a two-column md+ layout: image left (4:3),
  title + chapter pills + listed-at CTA right. First fold now shows
  the verdict + executive summary metrics, fixing the audit's
  "verdict invisible until scroll 3" finding.
- **Investment Thesis distill.** The amber utility card with a wall of
  ~150-word AI prose is now a lavender brand card with a Lightbulb
  eyebrow and a 3-line clamp + "Read full thesis" toggle when copy
  exceeds 260 chars.

### B. PDF (Haus Report dossier)

- **Wordmark parity with web.** Adds `Saira-SemiBold.ttf` static
  (Google Fonts CDN) so the wordmark renders at the right weight —
  react-pdf can't activate the weight axis on the variable Saira.ttf
  we shipped before, so the wordmark used to render as Regular. Also
  resized the helmet (1.05em → 0.78em) and rebalanced the vertical
  offset (`top: 0.29em` via experiment-bisect) so it reads as the
  proper "O" replacement instead of floating above the cap-line.
- **Macro → micro reorder + chapter eyebrows resynced.** Same order as
  the web; chapter numbers in each V3 template (`Chapter 02 · Strategy`
  etc.) updated to match the new TOC.
- **Methodology URLs clickable.** `CitationsPage` now wraps each
  citation label + domain in `<Link src={url}>` from `@react-pdf/
  renderer` and renders the domain in primary lavender so the
  affordance is visible.
- **Footer pagination switched from chapter index to physical page**
  via `<Text render={({ pageNumber, totalPages })}>`. The dossier
  reads as "15 / 23" instead of the misleading "5 / 10".
- **Flow continuo — black-space killer.** Each V3 chapter used to be
  its own `<Page>`, leaving up to 80% of the last page noir when a
  chapter didn't fill it. New `PageWrap` helper renders each chapter
  inline (`wrap=false`) inside a single host `<Page>` in `render
  Report.tsx`, with a thin lavender `SectionDivider` between them.
  Page count dropped from 23 → 20 on the sample report and the
  transitions read like a magazine.
- **PDF Cover label.** Dropped the "· v3" suffix; the version lives
  in `report_hash`.

### C. Feed surfaces

- **CTA copy sweep.** All 13 user-facing "Investment Report" /
  "Full Investment Report" / etc. strings switched to "Haus Report".
  i18n namespace `investmentReport` left intact so messages/*.json
  don't need a rename.
- **Responsive feed cards.** `ModelFeedCard` and `GenerationFeedCard`
  switched from fixed 16:9 aspect + p-6 to a content-priority flex
  layout (image flexes, bottom shrink-0 with original gaps). CTA at
  the bottom of each card stays visible even when the Out-of-Pistons
  banner pushes the available height down.
- **Hide cars without photos.** Both `useInfiniteAuctions` (Monza)
  and `BrowseClient` (Classic) now drop the `withoutPhoto` bucket
  from `partitionByPhoto`, plus a new `imageFailureStore` (uses
  `useSyncExternalStore`) catches the runtime case where the API
  URL is real but the image errors out, CORS-blocks, or returns a
  CDN placeholder under MIN_IMAGE_AREA. SafeImage reports failures;
  the feed memos depend on the store version and drop the offending
  cards on the next render.
- **Region change flash killed (Classic).** The "No reports match this
  specification" empty state used to flash for ~300ms whenever the
  user switched region — `serverFilterKey` changed synchronously but
  `setRemoteLoading(true)` was gated by a 300ms debounce on
  `activeServerKey`. New `isFilterPending = serverFilterKey !==
  activeServerKey` flag keeps the loading spinner up during that
  debounce window.

## Backend follow-ups (Camilo)

These are the items that block a full ship and need your hand:

1. **Email template.** `docs/email-templates/magic-link.html` is the
   branded MonzaHaus magic-link template (table layout, Outlook-safe,
   light mode, Heritage Lavender). Install via Supabase Dashboard →
   Authentication → Email Templates → Magic Link, switch to the
   Source/HTML tab, replace the body with the file contents, and
   confirm `{{ .ConfirmationURL }}` is still present (the "Sign in to
   MonzaHaus" button uses it). Send yourself a test link to verify
   the wordmark and helmet render OK in Gmail + Outlook.

2. **Excel V3 fallback.** `src/app/api/reports/[id]/excel/route.ts`
   currently 404s on every car whose only data is in the V3
   sections table — it only looks at V1 `listing_reports`. The PDF
   route at `src/app/api/reports/[id]/pdf/route.ts` lines 75-80
   already has the V3 fallback (extracts `fair_value` section from
   `fetchReportSections`). Mirror that in the Excel route so the
   download button stops returning errors for fresh reports.

3. **Custom email sender domain.** Once #1 lands, switch the
   Supabase Auth sender from the default `*.supabase.co` to a
   MonzaHaus domain (e.g. `hello@monzahaus.com`). This was action
   item from the 2026-05-19 sync.

4. **(Optional) Tint the two pure-black overlays** in
   `ReportClient.tsx:1895` and `:3187` (both are `bg-black/30` and
   `bg-black/60` modals — flagged by the impeccable detector but
   low-priority since they're scrims, not surfaces).

## Frontend-only scope confirmation

Nothing in this branch:
- modifies a file under `src/app/api/`
- modifies a file under `src/lib/db/`, `src/lib/supabase*`, or
  `src/lib/reports/agents/`
- modifies a `*.sql` migration
- changes any package dependency in `package.json`

The only new asset is `public/fonts/monzahaus/Saira-SemiBold.ttf`
(70 KB, downloaded from Google Fonts CDN under OFL) needed because
`@react-pdf/renderer` can't activate variable-font weight axes.

## Commit list

```
53dc180 ux(report): compact hero side-panel + distill Investment Thesis
1ad27ed feat(report-rail): wire 'View all' to /browse with series + price filter
c044a81 fix(feed): hide cars whose image fails at runtime, not just by URL
53fc22d fix(browse): kill region-change flash via isFilterPending guard
edfe290 fix(ux): drop PDF v3 label · hide photoless cars · loading state on region change
6c695b5 fix(pdf): flow continuo — kill trailing black space between chapters
f98fa0e fix(pdf): macro→micro order + clickable methodology + tighter layout
6a5411f refactor(report): rail focuses on peer comps (verdict + similar cars)
a455a79 feat(report): macro→micro reorder + sticky ReportSummaryRail (desktop + mobile)
d1275b3 fix(pdf): wordmark parity with web (Saira SemiBold + helmet alignment)
6949171 fix(feed): responsive layout for Model/Generation cards
65197a8 copy(funnel): rename Investment Report → Haus Report
```

## Smoke checklist before merge

- [ ] `/browse` loads → Classic and Monza toggles work, region pills
      switch without a "No reports match" flash, no cars with broken
      images visible.
- [ ] `/cars/porsche/<live-id>/report` loads → hero is 2-column on
      desktop, rail on the right shows verdict + peer comps, "View
      all" deep-links to `/browse?series=...`.
- [ ] PDF download on a car with v3 data → 20-ish pages, no big
      black gaps between chapters, methodology link in Sources is
      clickable, footer reads "X / Y" with the real total.
- [ ] (Once your Excel V3 fix lands) Excel download returns 200 for a
      v3-only car instead of `report_not_generated`.
