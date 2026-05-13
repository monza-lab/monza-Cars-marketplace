# detalles-front — MERGE NOTES

**Branch:** `detalles-front`
**Date:** 2026-05-12
**Owner:** Edgar (front)
**Scope guarantee:** 100% frontend. **Zero changes** to `src/app/api/`, `src/lib/reports/agents/`, `src/lib/reports/pipeline.ts`, `src/lib/reports/queries.ts`, `src/lib/reports/assembleV3Report.ts`, `src/lib/marketIntel/`, `src/lib/fairValue/adaptV1ToV2.ts`, `src/lib/fairValue/types.ts`, `src/lib/db/queries.ts`, or `supabase/`.

---

## Highlights

1. **Haus Report PDF rebuilt** with v2.1 branding (Heritage Lavender + Saira wordmark + casco oficial).
2. **Excel polished** — Live Model formulas fixed, Evidence sheet humanized, V3 fair value & verdict now consistent with the PDF.
3. **Report paywall flow unified** — same V1 sidebar layout for every car that hasn't been purchased, regardless of whether V3 sits in DB. Zero AI cost until a user actually pays.
4. **Persistent funnel CTAs** in Monza View, Classic View, car cards and report pages: a "Get the Report" cue and a "View on [Platform]" link back to the marketplace.
5. **AdvisorFab** floating bottom-right replaces the old header pill (frees top-nav space, shows on every page).
6. **`/methodology`** page created — the public reference the PDF + Excel link to.
7. **Rename**: "Investment Dossier" → **"Haus Report"** across the product (EN/ES/DE/JA).
8. **ViewToggle** flipped — Classic on the left, Monza (with helmet) on the right.

---

## What changed by area

### A · PDF rebuild (MonzaHaus v2.1)

- **New foundation** in `src/lib/exports/pdf/`:
  - `theme.ts` — light + dark token sets (Heritage Lavender palette).
  - `Wordmark.tsx` — Saira 600 + canonical helmet SVG paths replacing the "O".
  - `utils.ts` — `humanize()` (preserves acronyms like PMP/OEM/FIA), `titleCaseVehicle()`, `fmtCurrency`, `fmtDelta`, `shortenUrl`, `fmtDate`.
  - `styles.ts` — `createPdfStyles(theme)`, `verdictColorsForTheme(verdict, theme)`, `getThemeTokens(theme)`. Old `pdfStyles`/`PDF_COLORS` exports retained for backward compat.
  - `fonts.ts` — registers Saira (`public/fonts/monzahaus/Saira.ttf`).
- **New templates**: `TableOfContents.tsx`, `CitationsPage.tsx`, `DisclaimerPage.tsx`.
- **Rewritten templates** (theme-aware, big editorial chapter headings, humanized labels): `Cover.tsx`, `PageFooter.tsx`, V3 pages (`ExecutiveSummaryPage`, `TechnicalAnalysisPage`, `InvestmentStrategyPage`, `DueDiligenceV3Page`, `MarketResearchPage`, `BuyerServicesPage`).
- **`renderReport.tsx`** — new V3 flow: Cover → TOC → 6 V3 sections → Citations → Disclaimer (10 pages). Accepts `theme: PdfTheme`. V3 verdict + fair value range now override V2 when present (fixes the WALK vs BUY contradiction).
- **No API route changes.** The standalone preview script (`scripts/preview-report-exports.ts`) renders PDFs straight from `renderReportToPdfBuffer` using fixtures — pure front, no DB.
- **Fixture for preview**: `src/lib/reports/__fixtures__/v3-911-gt3r-rennsport-mock.json` (only used by the script and the `?mock=v3` query param in `report/page.tsx`).

### B · Excel polish

- **`liveModel.ts` rewritten** — formulas were referencing the wrong cells (hardcoded `B8` pointed to an empty header row; delta math used wrong row offsets). New version tracks every named cell via a `refs` map so cross-references are bulletproof. Added new sections: Total Investment, Ownership over hold, Break-even & Return scenarios.
- **`renderReport.ts`** — now accepts optional `v3Report`. When present, overrides V2 fair value range + verdict so Excel agrees with the PDF.
- **`summary.ts`** — title-case make/model (preserves "GT3", "RS"), correct number formatting (`$###,###`), `Δ` shown as `+74.9%`/-`%` with sign, verdict styled by brand colors (BUY = Emerald, WALK = Burnt Orange, never red).
- **`dataAndSources.ts`** → renamed sheet to **"Evidence"**. Sections are conditional (Comparables / Regional Stats only render when data exists). All raw keys (`paint_to_sample`, `listing_text`, `very_rare`, `high`) mapped to human labels via dictionaries + a "Why it matters" column was added. Hyperlinks rebuilt with Tailwind blue + underline so users read them as clickable. URLs shortened to `domain · last segment`.
- **`styles.ts`** — header background changed from Ink (`#141413`) to Lavender Ink Deep (`#3F2A47`), title size raised to 20.

### C · Funnel CTAs (front-only)

New shared components in `src/components/funnel/`:
- `ReportCta.tsx` — 4 variants (`pill`, `inline`, `hero`, `sticky`) for "Get the Report".
- `SourceListingCta.tsx` — 3 variants (`pill`, `inline`, `sticky`) for "View on [Platform]".

Wired into:
- `BrowseCard.tsx` — persistent "Report →" pill on the image; existing "View on Platform" pill kept.
- `CarCard.tsx` — same Report pill on the image + new "Source ↗" pill in the footer (replaces the static chevron when sourceUrl exists).
- `CarFeedCard.tsx` — discreet "View on [Platform]" glass pill on the image (the bottom CTA "View Investment Report" → renamed to use the same wording, kept its prominence).
- `ReportClient.tsx` — `SourceListingCta` inline card right below the cover hero so the user can flip back to the marketplace at any time.

### D · Report paywall flow unified

- `report/page.tsx` — single-line logic swap:
  ```tsx
  {userHasAccess && (existingReport || v3Report) ? <ReportClientV2 .../> : <ReportClient .../>}
  ```
  V2 (full unlocked) now renders **only** when the user has access. Everyone else sees the V1 layout (sidebar TOC + hero + sections with the data we already have from the listing scrape). **No API call** is made on visit — the AI pipeline only runs when the user clicks "Unlock Report" (existing back path).
- `ReportClientV2.tsx` — old paywall view deleted, defensive `if (!userHasAccess) return null` left in case the page.tsx gate ever changes.
- `ReportClient.tsx` (V1) — empty-state copy rewritten. "Awaiting backend data", "Analysis Pending", "Detailed risk analysis not yet available" replaced with human, sales-aware lines ("Generate the full report to see how this car prices against comparable sales", "Risk flags surface during the full analysis", "Buy · Watch · Walk — the verdict weighs fair value, market signals, risk score, and arbitrage"). `ReportRegionBanner` removed (was noisy / repetitive).

### E · Methodology page

- New: `src/app/[locale]/methodology/page.tsx`. Public reference for the engine: comparables layers, the 12 modifiers + caps, market intel D1–D4, data sources, refresh cadence, what the report does NOT do, engine versioning, feedback channel.
- Linked from PDF Disclaimer, PDF Citations, and Excel Evidence sheet ("Open methodology online → monzahaus.com/methodology").
- Email `methodology@monzalab.com` (not `@monzahaus.com`).

### F · AdvisorFab

- New: `src/components/advisor/AdvisorFab.tsx`. Heritage Lavender pill, helmet glyph + chat indicator, fixed bottom-right (desktop) / bottom-20 (mobile above the bottom nav), hidden on `/advisor`, on `?print|pdf|mock=` URLs, and in `print:hidden`.
- Mounted in `src/app/[locale]/layout.tsx`.
- Old Advisor pill in `Header.tsx` removed (top-nav real estate freed).

### G · Naming & branding

- **"Investment Dossier" → "Haus Report"** in code + EN/ES/DE/JA i18n. Brand term kept untranslated across locales (same approach as iPhone, Bloomberg Terminal). 14 occurrences total.
- **Tagline** in PDF DisclaimerPage: "Investment-Grade Automotive Assets" → **"The Porsche Collector Platform"**.
- Emails: `hello@monzahaus.com` (in `llms.txt`) → `hello@monzalab.com`.

### H · Cards & nav

- `BrowseCard`, `CarCard`, `CarFeedCard` — see section C.
- `Header.tsx` — Advisor pill removed.
- `ViewToggle.tsx` — Classic now on the left, Monza (helmet) on the right.

### I · Other

- `ReportRegionBanner` import removed from `ReportClient.tsx`. Component file kept for now in case marketing wants to bring it back somewhere else.
- `package-lock.json` regenerated from a clean `npm install` (no production dep changes — only lockfile housekeeping).
- New scripts under `scripts/`: `preview-report-exports.ts` (renders Dark/Light PDF + XLSX to Desktop using fixtures), `verify-excel-formulas.mjs` (inspects ExcelJS output for formula references and structure).
- New font asset: `public/fonts/monzahaus/Saira.ttf` (Google Fonts OFL, variable).

---

## How to preview locally

```bash
npm run dev
# Reports: Monza View at /en, Classic View at /en/browse,
#          Make page at /en/cars/porsche?family=992,
#          Report at /en/cars/porsche/{id}/report,
#          Methodology at /en/methodology
#
# PDF + Excel preview (uses fixtures, no DB needed):
npx tsx scripts/preview-report-exports.ts
# → ~/Desktop/MonzaHaus-V3-Report-Dark.pdf
# → ~/Desktop/MonzaHaus-V3-Report-Light.pdf
# → ~/Desktop/MonzaHaus-V3-Report-Preview.xlsx
```

To preview the V3 report with the mock data through Next:
`/en/cars/porsche/{any-id}/report?mock=v3`

---

## Out of scope (NOT touched)

- The V3 multi-agent pipeline (`src/lib/reports/agents/`, `pipeline.ts`, `assembleV3Report.ts`).
- `/api/analyze/v3/route.ts` and any other API route.
- DB queries (`src/lib/db/queries.ts`, `src/lib/reports/queries.ts`).
- Supabase migrations.
- Stripe / pricing / Pistons economy logic.

The back-end work continues unaffected.
