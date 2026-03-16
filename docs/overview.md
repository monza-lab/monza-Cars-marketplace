# Workspace Overview (This Conversation)

This file captures what is currently present in the workspace as a result of the i18n + hydration/key-warning work discussed in this conversation. It is written to be concise but sufficiently complete for handoff.

## Context (Reported Issues + Fixes)

- Hydration mismatch: App Router warning about nested/mismatched `<html>`/`<body>` during hydration.
  - Fix applied: keep `<html>`/`<body>` only in the root layout and avoid re-declaring them under the locale segment.
  - Relevant files: `src/app/layout.tsx`, `src/app/[locale]/layout.tsx`.

- Duplicate React key warnings: "Encountered two children with the same key" reported for curated content (example key mentioned: `curated-diablo-sv`).
  - Fix intent: ensure items rendered in lists have stable unique keys (either by making curated IDs unique or using a composite key at render sites).
  - Note: the curated IDs currently visible in `src/lib/curatedCars.ts` include platform/year disambiguation for the Diablo SV entries.

## i18n Work Performed

- next-intl wiring:
  - Plugin enabled via `next.config.ts` with request config at `src/i18n/request.ts`.
  - Locale routing definition in `src/i18n/routing.ts` (`locales: en/es/de/ja`, `defaultLocale: en`, `localePrefix: as-needed`).
  - Navigation helpers created in `src/i18n/navigation.ts` (typed `Link`, `useRouter`, `usePathname`, etc).

- Routing/middleware:
  - Combined middleware runs next-intl routing first, then Supabase SSR auth refresh while preserving headers/cookies.
  - Relevant file: `src/middleware.ts`.

- Language switcher behavior:
  - Uses next-intl navigation router to replace the current pathname while preserving the query string.
  - Implemented for both desktop dropdown and mobile grid.
  - Relevant file: `src/components/layout/LanguageSwitcher.tsx`.

- Message fallbacks:
  - `src/i18n/request.ts` deep-merges locale messages on top of English so missing keys fall back to English instead of throwing at runtime.

- Metadata localization:
  - Locale layout implements `generateMetadata` with per-locale title/description fallbacks.
  - Relevant file: `src/app/[locale]/layout.tsx`.

- Link updates:
  - Header navigation uses `Link` from `@/i18n/navigation` and hrefs are written without hardcoding locale prefixes.
  - Relevant file: `src/components/layout/Header.tsx`.

## Tests/Scripts Added

- i18n guard scripts:
  - `agents/testscripts/i18n-verify.mjs`: ensures message key parity/types across `messages/*.json`.
  - `agents/testscripts/i18n-auction-detail-hardcoded.mjs`: heuristic check to prevent reintroducing hardcoded auction-detail UI strings and verify required next-intl wiring.

- Manual testscripts (docs):
  - `agents/testscripts/next-hydration-and-keys.md`: manual dev-console verification for hydration and duplicate key warnings.
  - `agents/testscripts/auction-detail-language-toggle.md`: manual workflow to validate language switching affects auction detail content.
  - `agents/testscripts/ts-garage-advisory-schema-alignment.md`: Supabase schema inventory + minimal insert checks (read-only/migration planning support).

- Vitest suite added/extended:
  - Test folders present under `tests/` (scrapers, middleware, integration, schema, quality) with config at `vitest.config.ts`.

## Commands Run (Observed Results)

- `node agents/testscripts/i18n-verify.mjs`: PASS (all locales in sync vs en).
- `node agents/testscripts/i18n-auction-detail-hardcoded.mjs`: PASS (auction detail wired to next-intl; no forbidden phrases found).
- `npm test` (vitest): PASS (exit 0).

## Files Changed (High-Level)

- i18n infrastructure:
  - `next.config.ts`: enable next-intl plugin.
  - `src/i18n/request.ts`: request config with English fallback deep-merge.
  - `src/i18n/routing.ts`: locale routing config.
  - `src/i18n/navigation.ts`: next-intl navigation wrappers.
  - `src/middleware.ts`: next-intl middleware + Supabase SSR auth combined.

- App Router structure (locale segment) + metadata:
  - `src/app/layout.tsx`: single root `<html>/<body>` owner; sets `lang` based on locale param with fallback.
  - `src/app/[locale]/layout.tsx`: wraps subtree in `NextIntlClientProvider`; defines `generateStaticParams` and localized metadata.
  - `src/app/page.tsx`: removed in favor of locale-scoped routes.
  - `src/app/[locale]/page.tsx`: home entry now under locale segment.
  - `src/app/[locale]/auctions/page.tsx`, `src/app/[locale]/auctions/AuctionsClient.tsx`.
  - `src/app/[locale]/auctions/[id]/AuctionDetailClient.tsx`.
  - `src/app/[locale]/search/page.tsx`.
  - `src/app/[locale]/history/page.tsx`, `src/app/[locale]/history/MarketTrendsClient.tsx`.
  - `src/app/[locale]/cars/[make]/MakePageClient.tsx`, `src/app/[locale]/cars/[make]/[id]/page.tsx`, `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx`.

- Components updated to use translations and/or i18n-aware navigation:
  - `src/components/layout/Header.tsx`: navigation + labels moved to message keys; uses i18n `Link`.
  - `src/components/layout/LanguageSwitcher.tsx`: locale toggle behavior.
  - Additional touched components (auth/landing/mobile/auction card):
    - `src/components/auth/AuthModal.tsx`, `src/components/auth/AuthRequiredPrompt.tsx`
    - `src/components/landing/HeroSection.tsx`, `src/components/landing/HowItWorksSection.tsx`, `src/components/landing/FeaturedAuctionsSection.tsx`
    - `src/components/mobile/MobileBottomNav.tsx`, `src/components/mobile/MobileCarCTA.tsx`
    - `src/components/auction/AuctionCard.tsx`

- Messages:
  - `messages/en.json`, `messages/es.json`, `messages/de.json`, `messages/ja.json`: expanded/updated translation catalogs.

- Tests and tooling:
  - `vitest.config.ts`, `tests/**`, `test-results/.last-run.json`.
  - `package.json`, `package-lock.json`: script/tooling updates for vitest and related test entrypoints.

- Scraper-related changes (not i18n-specific, but in workspace):
  - `src/lib/scraper.ts`, `src/lib/scrapers/index.ts`, `src/lib/scrapers/bringATrailer.ts`, `src/lib/scrapers/carsAndBids.ts`, `src/lib/scrapers/collectingCars.ts`, `src/lib/scrapers/middleware/`.

## Known Remaining Issue

User report: only the navbar changes language; most page content appears to stay in English.

Hypotheses

- Many high-traffic UI components still contain hardcoded strings and are not yet migrated to `useTranslations` (example: `src/components/dashboard/DashboardClient.tsx` contains extensive English copy).
- Some pages/components may be rendered outside the `NextIntlClientProvider` boundary (layout nesting/routing mismatch) or are reading locale incorrectly.
- Message key parity is enforced, but content coverage is not; keys can exist while translations remain effectively English.

Next debugging steps (do not implement here)

1) Reproduce on a known page (e.g. home dashboard) and confirm whether `useLocale()` changes when toggling language.
2) Audit the specific components that do not change language for hardcoded strings and missing `useTranslations` wiring.
3) Add a focused guard script (similar to the auction detail check) for the home/dashboard surface to flag the most visible hardcoded English phrases.
4) Verify that navigation uses i18n-aware `Link`/router everywhere and that locale segment routes are being used (no accidental non-locale routes).
