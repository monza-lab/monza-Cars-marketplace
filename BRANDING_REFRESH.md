# Branding Refresh — "Salon" Aesthetic

## Summary

Complete visual rebrand from "Obsidian & Neon Pink" (`#F8B4D9` on `#0b0b10`) to a warm "Salon" art gallery aesthetic. Includes dark/light theme toggle, new typography, and theme-aware PDF dossier generation.

**Branch:** `branding-refresh` (4 commits, based on `UI-UX-5.0`)
**Scope:** 100% frontend — zero backend, API, DB, or infrastructure changes.

---

## Commits

| Hash | Description |
|------|-------------|
| `3e7b837` | feat(branding): Salon aesthetic — warm palette, theme toggle, theme-aware PDF |
| `d4bdb3e` | feat(onboarding): multi-select intent with Sell option |
| `4a7be6d` | fix(report): 8 PDF dossier fixes — real data, clean titles, photo, section 05 |
| `baf4a2a` | fix(report): replace 282 hardcoded colors with semantic theme tokens |

---

## What Changed

### 1. Color System (`globals.css`)
All colors now use CSS custom properties via Tailwind semantic tokens.

**Dark mode** (`.dark` class — default):
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `14 10 12` (warm near-black) | Page background |
| `--foreground` | `232 226 222` (warm off-white) | Primary text |
| `--primary` | `212 115 138` (dusty rose) | Accents, CTAs, links |
| `--card` | `22 18 20` | Card/panel backgrounds |
| `--muted-foreground` | `140 130 126` | Secondary text |
| `--border` | `42 34 38` | Dividers, borders |

**Light mode** (`:root`):
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `253 251 249` (warm cream) | Page background |
| `--foreground` | `42 35 32` (warm charcoal) | Primary text |
| `--primary` | `122 46 74` (deep burgundy) | Accents, CTAs, links |
| `--card` | `255 255 255` | Card/panel backgrounds |
| `--muted-foreground` | `122 110 104` | Secondary text |
| `--border` | `232 226 220` | Dividers, borders |

### 2. Typography
- **Headings:** Cormorant (serif) — art gallery feel
- **Body:** Karla (sans-serif) — clean readability
- Loaded via `next/font/google` in `layout.tsx`

### 3. Theme Toggle
- New dependency: `next-themes` (^0.4.4)
- `ThemeProvider` wraps app in `layout.tsx` with `attribute="class"`
- Toggle button in `Header.tsx` (Sun/Moon icons)
- User preference persisted in localStorage

### 4. PDF Dossier (ReportClient.tsx)
- 16-page jsPDF dossier now uses conditional color palette `C`
- `const isDark = theme !== "light"` determines palette
- Dark: rose accents on warm black; Light: burgundy accents on cream
- Financial colors (green/red/amber) unchanged

### 5. Onboarding (OnboardingModal.tsx)
- Step 4 changed from single-select to multi-select
- Added "Sell" option (DollarSign icon)
- New field `intents: string[]` in `OnboardingPreferences`
- Legacy `intent: string | null` preserved for backwards compatibility
- Translations added in en/es/de/ja

---

## Files Changed (65 total)

### Pages & Layouts (17 files)
```
src/app/globals.css                           — color system (CSS custom properties)
src/app/layout.tsx                            — ThemeProvider, fonts
src/app/[locale]/layout.tsx                   — ThemeProvider wrapper
src/app/[locale]/page.tsx                     — semantic colors
src/app/[locale]/account/page.tsx             — semantic colors
src/app/[locale]/error.tsx                    — semantic colors
src/app/[locale]/not-found.tsx                — semantic colors
src/app/not-found.tsx                         — semantic colors
src/app/[locale]/pricing/page.tsx             — semantic colors
src/app/[locale]/legal/privacy/page.tsx       — semantic colors
src/app/[locale]/legal/terms/page.tsx         — semantic colors
src/app/[locale]/search/page.tsx              — semantic colors
src/app/[locale]/history/page.tsx             — semantic colors
src/app/[locale]/ferrari/page.tsx             — semantic colors
src/app/manifest.ts                           — theme colors
src/app/opengraph-image.tsx                   — OG image colors
src/app/[locale]/cars/[make]/[id]/report/page.tsx — semantic colors
```

### Client Components (28 files)
```
src/components/dashboard/DashboardClient.tsx
src/app/[locale]/cars/[make]/MakePageClient.tsx
src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx
src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx
src/app/[locale]/cars/[make]/models/[model]/ModelPageClient.tsx
src/app/[locale]/auctions/[id]/AuctionDetailClient.tsx
src/app/[locale]/search/SearchClient.tsx
src/app/[locale]/search-history/SearchHistoryClient.tsx
src/app/[locale]/history/MarketTrendsClient.tsx
src/components/layout/Header.tsx
src/components/layout/AppFooter.tsx
src/components/layout/LanguageSwitcher.tsx
src/components/layout/LiveTicker.tsx
src/components/layout/Sidebar.tsx
src/components/mobile/MobileBottomNav.tsx
src/components/mobile/MobileCarCTA.tsx
src/components/filters/AdvancedFilters.tsx
src/components/filters/FamilySearchAndFilters.tsx
src/components/filters/FilterSidebar.tsx
src/components/filters/SearchWithAutocomplete.tsx
src/components/auth/AuthModal.tsx
src/components/auth/AuthRequiredPrompt.tsx
src/components/auth/CreditDisplay.tsx
src/components/auth/NoCreditsPrompt.tsx
src/components/onboarding/OnboardingModal.tsx
src/components/advisor/AdvisorChat.tsx
src/components/advisor/AdvisorMessage.tsx
src/components/auction/AuctionCard.tsx
```

### Payment Components (4 files)
```
src/components/payments/BillingDashboard.tsx
src/components/payments/CheckoutModal.tsx
src/components/payments/PricingCards.tsx
src/components/payments/TransactionHistory.tsx
```

### Landing Page (6 files)
```
src/components/landing/CTASection.tsx
src/components/landing/FeaturedAuctionsSection.tsx
src/components/landing/HeroSection.tsx
src/components/landing/HowItWorksSection.tsx
src/components/landing/LiveAuctionsSection.tsx
src/components/landing/PlatformPartnersSection.tsx
```

### Shared Components (2 files)
```
src/components/shared/MonzaInfinityLoader.tsx
src/components/shared/PorscheWheelSpinner.tsx
```

### Utilities & Config (2 files)
```
src/lib/onboardingPreferences.ts              — added intents[] field
src/lib/utils/formatters.ts                   — color references
```

### Translations (4 files)
```
messages/en.json                              — sell option text
messages/es.json                              — sell option text
messages/de.json                              — sell option text
messages/ja.json                              — sell option text
```

### Package (2 files)
```
package.json                                  — added next-themes
package-lock.json                             — lockfile update
```

---

## What Was NOT Changed

**Zero modifications to any of the following:**

| Category | Files/Directories |
|----------|-------------------|
| API Routes | `src/app/api/**` — all endpoints untouched |
| Database Schema | `prisma/` — schema.prisma untouched |
| Database Queries | `src/lib/db/` — all query files untouched |
| Supabase Client | `src/lib/supabase*.ts` — all Supabase files untouched |
| Scrapers | `src/lib/scrapers/` — untouched |
| Scripts | `scripts/` — untouched |
| Middleware | `src/middleware.ts` — untouched |
| Environment | `.env*` — untouched |
| Supabase Config | `supabase/` — untouched |
| Brand Config | `src/lib/brandConfig.ts` — untouched |
| Similar Cars | `src/lib/similarCars.ts` — untouched |
| Region Pricing | `src/lib/regionPricing.ts` — untouched |

---

## New Dependency

```
next-themes: ^0.4.4
```

Only frontend. No server-side impact. Reads `class` attribute from `<html>` to determine theme.

---

## Verification

```bash
# TypeScript compiles clean (0 source errors)
npx tsc --noEmit

# Dev server starts and serves 200
npm run dev

# No backend files in diff
git diff UI-UX-5.0...branding-refresh --stat -- 'src/app/api/' 'prisma/' 'scripts/' 'src/lib/db/' 'supabase/' '.env*' 'src/middleware.ts'
# → (empty = nothing changed)
```

---

## For Backend Developer

1. **No action required** — all changes are CSS/JSX/client-side only
2. **No API contract changes** — no request/response shapes modified
3. **No DB migrations needed** — schema untouched
4. **No env vars changed** — same Supabase keys, same DATABASE_URL
5. **`npm install`** after pulling — installs `next-themes` (only new dep)
6. **Onboarding data** — localStorage now stores `intents: string[]` alongside legacy `intent: string | null`. If you ever read onboarding data server-side, expect both fields
7. **Theme** — stored in localStorage by `next-themes`. No server-side persistence needed unless you want to sync user theme preference to a profile

---

## Migration Path to Merge

```bash
git checkout UI-UX-5.0
git merge branding-refresh
# or
git checkout main
git merge branding-refresh
```

No conflicts expected with backend branches since zero backend files were touched.
