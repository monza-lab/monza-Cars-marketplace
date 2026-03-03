# 🗺️ Monza Lab — Code Maps

> **Generated:** February 12, 2026  
> **App Name:** Monza Lab (package name: `garage-advisory`)  
> **Framework:** Next.js 16 + React 19 + TypeScript + legacy ORM + Supabase + Claude AI  

---

## 📁 Root-Level Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies & scripts (`dev`, `build`, `start`, `lint`). App name: `garage-advisory` |
| `next.config.ts` | Next.js config: remote image patterns (BaT, C&B, CC, Unsplash, Wikimedia, RM Sotheby's), `next-intl` plugin, 2MB server action body limit |
| `orm.config.ts` | ORM CLI configuration |
| `tsconfig.json` | TypeScript config with `@/` path alias |
| `postcss.config.mjs` | PostCSS (TailwindCSS) |
| `eslint.config.mjs` | ESLint v9 flat config |
| `components.json` | shadcn/ui component config (New York style, CSS variables) |
| `push-to-github.sh` | Git push helper script |

---

## 📁 `orm/`

| File | Purpose |
|------|---------|
| `schema.orm` | **Database schema** — PostgreSQL via the ORM adapter. Defines 7 models: `Auction`, `Analysis`, `Comparable`, `PriceHistory`, `MarketData`, `User`, `CreditTransaction`, `UserAnalysis` + 8 enums |

### Data Models Overview

```
Auction ──┬── Analysis (1:1)
          ├── Comparable[] (1:N)
          └── PriceHistory[] (1:N)

User ──┬── CreditTransaction[] (1:N)
       └── UserAnalysis[] (1:N)

MarketData (standalone aggregation table)
```

---

## 📁 `messages/` — i18n Translation Files

| File | Language |
|------|----------|
| `en.json` | English (default) |
| `es.json` | Spanish |
| `de.json` | German |
| `ja.json` | Japanese |

---

## 📁 `scripts/` — Data Seeding & Image Downloads

| File | Purpose |
|------|---------|
| `seed.ts` | **Database seeder** — populates auctions from curated data (20KB) |
| `test-scraper.ts` | Scraper test harness |
| `download_cars_unsplash.py` | Downloads car images from Unsplash |
| `download_bmw.py` | BMW-specific image downloads |
| `download_batch[3-6].py` | Batch image downloads |
| `download_wave[2-30].py` | Multi-wave car image downloads from various sources |
| `download_*_missing.py` | Gap-fill scripts for missing images |

---

## 📁 `public/`

| File / Dir | Purpose |
|------------|---------|
| `cars/` | Local car images served statically |
| `*.svg` | Default Next.js icons (file, globe, next, vercel, window) |

---

## 📁 `src/` — Main Application Source

### `src/middleware.ts`
- **Dual middleware**: Combines `next-intl` locale routing with Supabase auth session refresh
- Runs on every non-API, non-static request
- Matcher: excludes `/api`, `/_next/static`, images, favicon

---

## 📁 `src/i18n/` — Internationalization

| File | Purpose |
|------|---------|
| `routing.ts` | Locale config: `['en', 'es', 'de', 'ja']`, default `'en'`, prefix `'as-needed'` |
| `request.ts` | Server-side locale resolver — loads messages from `messages/{locale}.json` |
| `navigation.ts` | Creates `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` wrappers from `next-intl` |

---

## 📁 `src/types/` — TypeScript Type Definitions

| File | Key Types |
|------|-----------|
| `auction.ts` | `Platform`, `AuctionStatus`, `ReserveStatus`, `Auction`, `AuctionFilters`, `PriceHistoryEntry`, `Comparable`, `AnalysisConfidence`, `InvestmentGrade`, `Analysis` |
| `analysis.ts` | `AIAnalysisResponse`, `Analysis`, `MarketData`, `MarketTrend` |
| `api.ts` | `ApiResponse<T>`, `ScrapeResult` |

---

## 📁 `src/hooks/` — Custom React Hooks

| File | Hook | Purpose |
|------|------|---------|
| `useAuctions.ts` | `useAuctions(filters?)` | Fetches paginated auctions from `/api/auctions` with filtering, sorting, pagination |
| `useAnalysis.ts` | `useAnalysis(auctionId)` | Fetches/triggers AI analysis for a single auction via `/api/analyze` |
| `useSearch.ts` | `useSearch(delay=300)` | Debounced search input handler |

---

## 📁 `src/lib/` — Core Business Logic

### `src/lib/db/` — Database Layer

| File | Exports | Purpose |
|------|---------|---------|
| `orm.ts` | `orm` singleton | ORM client with Postgres adapter, hot-reload safe singleton |
| `queries.ts` | `getAuctions()`, `getAuctionById()`, `getAuctionByExternalId()`, `upsertAuction()`, `saveAnalysis()`, `getComparables()`, `saveComparable()`, `savePriceHistory()`, `getMarketData()`, `upsertMarketData()` | All ORM query abstractions |

### `src/lib/ai/` — AI Analysis Engine

| File | Exports | Purpose |
|------|---------|---------|
| `claude.ts` | `analyzeVehicle()`, `analyzeWithSystem()`, `generateMarketSummary()` | **Claude API wrapper** — thin SDK wrapper using `claude-sonnet-4-5-20250929` |
| `prompts.ts` | `buildVehicleAnalysisPrompt()`, `buildMarketSummaryPrompt()`, `buildQuickValuationPrompt()` | Prompt templates for vehicle analysis, market summaries, quick valuations |
| `analyzer.ts` | `analyzeAuction()`, `analyzeMarket()`, types: `AnalysisResult`, `VehicleData`, `MarketDataInput` | **Main analysis orchestrator** — builds prompts, calls Claude, parses JSON responses with retry, caches results (24h TTL) |

### `src/lib/scrapers/` — Web Scraping System

| File | Exports | Purpose |
|------|---------|---------|
| `index.ts` | `scrapeAll()`, `scrapePlatform()` | **Scraper manager** — orchestrates parallel scraping with rate limiting |
| `bringATrailer.ts` | `scrapeBringATrailer()` | BaT-specific scraper using Playwright |
| `carsAndBids.ts` | `scrapeCarsAndBids()` | C&B-specific scraper using Playwright |
| `collectingCars.ts` | `scrapeCollectingCars()` | CC-specific scraper using Playwright |

### `src/lib/scraper.ts` — URL-Based Price Scraper
- **Cheerio-based** (no browser), lightweight single-URL scraper
- Platform detection: BaT, RM Sotheby's, C&B, Collecting Cars
- In-memory cache with 24h TTL
- Exports: `fetchAuctionData()`, `getCacheStats()`, `cleanCache()`, `getCachedData()`, `batchFetchAuctionData()`

### `src/lib/supabase/` — Supabase Auth Clients

| File | Exports | Purpose |
|------|---------|---------|
| `client.ts` | `createClient()` | Browser-side Supabase client (`createBrowserClient`) |
| `server.ts` | `createClient()` | Server-side Supabase client via cookies (`createServerClient`) |

### `src/lib/auth/`

| File | Exports | Purpose |
|------|---------|---------|
| `AuthProvider.tsx` | `AuthProvider`, `useAuth()`, `UserProfile` | React context for auth state: user, session, profile, `signIn`, `signUp`, `signInWithGoogle`, `signOut`, `refreshProfile` |

### `src/lib/credits/`

| File | Exports | Purpose |
|------|---------|---------|
| `index.ts` | `getOrCreateUser()`, `checkAndResetFreeCredits()`, `getUserCredits()`, `hasAlreadyAnalyzed()`, `deductCredit()`, `addPurchasedCredits()`, `getTransactionHistory()` | **Credit system** — Free tier (3/month), monthly reset, deduction on analysis, purchase support |

### `src/lib/utils/`

| File | Exports | Purpose |
|------|---------|---------|
| `constants.ts` | `PLATFORMS`, `MAKES`, `SORT_OPTIONS`, `DEFAULT_FILTERS`, `INVESTMENT_GRADE_COLORS`, `MARKET_TREND_ICONS`, `AUCTION_STATUSES`, `PRICE_RANGES`, etc. | Shared constants, filter configs, display configs |
| `formatters.ts` | `formatCurrency()`, `formatNumber()`, `formatDate()`, `formatTimeRemaining()`, `formatMileage()`, `platformLabel()`, `platformColor()`, `investmentGradeColor()`, `trendIcon()`, `trendColor()` | Display formatting utilities |

### Other `src/lib/` Files

| File | Purpose |
|------|---------|
| `curatedCars.ts` | **Massive curated dataset** (~1.2MB) of collector cars with full data: images, prices, regions, grades, theses |
| `featuredAuctions.ts` | Featured auction dataset (5KB) |
| `generateCars.ts` | Car data generation logic (45KB) |
| `modelImages.ts` | Model → image URL mappings (28KB) |
| `utils.ts` | `cn()` class-merge utility (clsx + tailwind-merge) |

---

## 📁 `src/app/` — Next.js App Router

### Root-Level App Files

| File | Purpose |
|------|---------|
| `layout.tsx` | **Root layout** — sets `Public_Sans` font, dark theme globally, imports `globals.css` |
| `page.tsx` | **Root page** (non-locale) — fetches from `/api/mock-auctions`, renders `DashboardClient` |
| `globals.css` | Global styles (16KB) — CSS variables, Tailwind, custom utilities |
| `not-found.tsx` | 404 page |
| `favicon.ico` | App favicon |

### `src/app/auth/callback/route.ts`
- **OAuth callback handler** — exchanges code for Supabase session, redirects to home

### `src/app/[locale]/` — Locale-Aware Pages

| File | Purpose |
|------|---------|
| `layout.tsx` | **Locale layout** — validates locale, provides `NextIntlClientProvider`, `AuthProvider`, `Header`, `MobileBottomNav` |
| `page.tsx` | **Home page** — fetches mock auctions, renders `DashboardClient` with Suspense |
| `not-found.tsx` | Localized 404 page |

### `src/app/[locale]/auctions/` — Auctions Pages

| File | Purpose |
|------|---------|
| `page.tsx` | Auctions listing page (server component shell) |
| `AuctionsClient.tsx` | **Main auctions browser** (40KB) — grid/list views, filtering, sorting, pagination, mobile filters, auction cards |
| `[id]/page.tsx` | Auction detail page — dynamic metadata generation (OG/Twitter cards) |
| `[id]/AuctionDetailClient.tsx` | **Auction detail view** (48KB) — full auction display with analysis, images, comparable sales |

### `src/app/[locale]/cars/` — Car Browse Pages

| File | Purpose |
|------|---------|
| `[make]/page.tsx` | Make landing page |
| `[make]/MakePageClient.tsx` | **Make page client** (42KB) — browse by car make |
| `[make]/[id]/` | Individual car detail pages |
| `[make]/models/` | Model listing pages |

### `src/app/[locale]/search/` — Search Pages

| File | Purpose |
|------|---------|
| `page.tsx` | Search page shell |
| `SearchClient.tsx` | **Search client** (20KB) — full-text search with filters |

### `src/app/[locale]/history/` — Market History

| File | Purpose |
|------|---------|
| `page.tsx` | Market trends page (server-side data fetch) |
| `MarketTrendsClient.tsx` | Market trends visualization client |

---

## 📁 `src/app/api/` — API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/mock-auctions` | `GET` | Returns curated cars with filtering, sorting, pagination. Primary data source for the dashboard |
| `/api/auctions` | `GET` | Queries real DB auctions with full filtering (platform, make, model, year, price, search, sort, pagination) |
| `/api/auctions/[id]` | `GET` | Single auction detail — checks curated → featured → database |
| `/api/analyze` | `POST` | **AI Analysis endpoint** — auth required, credit check, calls Claude, caches 24h, saves to DB |
| `/api/scrape` | `GET` | Single URL price fetch (Cheerio-based, zero-cost) |
| `/api/scrape` | `POST` | Full platform scraping (Playwright-based) |
| `/api/scrape` | `DELETE` | Clear scrape cache |
| `/api/cron` | `GET` | **Cron job** — runs all scrapers, upserts auctions, updates market data aggregations. Protected by `CRON_SECRET` |
| `/api/user/create` | `POST` | Creates/fetches user profile on sign-in |
| `/api/user/profile` | `GET` | Returns authenticated user's profile with credits info |

---

## 📁 `src/components/` — React Components

### `components/ui/` — Base UI Components (shadcn/ui)

| Component | File |
|-----------|------|
| Avatar | `avatar.tsx` |
| Badge | `badge.tsx` |
| Button | `button.tsx` |
| Card | `card.tsx` |
| Command | `command.tsx` |
| Dialog | `dialog.tsx` |
| Dropdown Menu | `dropdown-menu.tsx` |
| Input | `input.tsx` |
| Popover | `popover.tsx` |
| Scroll Area | `scroll-area.tsx` |
| Select | `select.tsx` |
| Separator | `separator.tsx` |
| Sheet | `sheet.tsx` |
| Skeleton | `skeleton.tsx` |
| Tabs | `tabs.tsx` |
| Tooltip | `tooltip.tsx` |

### `components/layout/` — App Layout

| File | Purpose |
|------|---------|
| `Header.tsx` | **Main header** (31KB) — navigation, auth state, search, mobile menu |
| `Sidebar.tsx` | **Sidebar navigation** (18KB) — filters, navigation links |
| `LanguageSwitcher.tsx` | Locale switcher dropdown |
| `LiveTicker.tsx` | **Live auction ticker** — scrolling banner of active auctions |

### `components/dashboard/` — Dashboard

| File | Purpose |
|------|---------|
| `DashboardClient.tsx` | **Main dashboard** (82KB) — brand grid, auction cards, context panel, filtering, category views, regional pricing |
| `StrategistChat.tsx` | **AI Strategist chat** (20KB) — in-app AI conversation interface |

### `components/landing/` — Landing Page Sections

| File | Purpose |
|------|---------|
| `HeroSection.tsx` | Hero section with headline, search, live stats |
| `FeaturedAuctionsSection.tsx` | Featured auctions showcase carousel |
| `LiveAuctionsSection.tsx` | Live auction preview grid |
| `HowItWorksSection.tsx` | "How it works" feature explainer |
| `PlatformPartnersSection.tsx` | Platform logos and info |
| `CTASection.tsx` | Call-to-action section |

### `components/auction/` — Auction Components

| File | Purpose |
|------|---------|
| `AuctionCard.tsx` | Individual auction card (used in grids) |
| `AuctionGrid.tsx` | Grid layout for auction cards |
| `AuctionTimer.tsx` | Countdown timer component |
| `PriceChart.tsx` | Price history chart (Recharts) |

### `components/analysis/` — AI Analysis Components

| File | Purpose |
|------|---------|
| `AnalysisReport.tsx` | **Full analysis report** (13KB) — summary, bid targets, grades |
| `ComparableSales.tsx` | Comparable sales table/cards |
| `CriticalQuestions.tsx` | Questions to ask before bidding |
| `OwnershipCosts.tsx` | Yearly maintenance, insurance, major service estimates |
| `RedFlags.tsx` | Red flag alert display |

### `components/auth/` — Authentication

| File | Purpose |
|------|---------|
| `AuthModal.tsx` | Sign-in / sign-up modal with Google OAuth |
| `AuthRequiredPrompt.tsx` | "Sign in required" prompt display |
| `CreditDisplay.tsx` | Shows user credit balance |
| `NoCreditsPrompt.tsx` | "No credits" upsell prompt |
| `index.ts` | Barrel exports |

### `components/search/` — Search Components

| File | Purpose |
|------|---------|
| `SearchBar.tsx` | Search input with icon |
| `Filters.tsx` | Advanced filter panel (14KB) |
| `SortOptions.tsx` | Sort dropdown |

### `components/shared/` — Shared/Utility Components

| File | Purpose |
|------|---------|
| `ErrorBoundary.tsx` | React error boundary with fallback UI |
| `ImageGallery.tsx` | **Image gallery** (12KB) — lightbox, thumbnails, fullscreen |
| `LoadingSpinner.tsx` | Loading states and skeleton screens |

### `components/mobile/` — Mobile-Specific

| File | Purpose |
|------|---------|
| `MobileBottomNav.tsx` | **Bottom navigation** (29KB) — tab bar for mobile |
| `MobileCarCTA.tsx` | Mobile-optimized car CTA (14KB) |
| `index.ts` | Barrel exports |

### `components/advisor/` — AI Advisor

| File | Purpose |
|------|---------|
| `AdvisorChat.tsx` | **AI Advisor chat** (27KB) — full chat interface for vehicle consulting |

---

## 🔗 Key Data Flow Connections

```
User Visit
  └── middleware.ts (i18n + Supabase auth)
       └── [locale]/layout.tsx (Header, AuthProvider, i18n)
            └── [locale]/page.tsx
                 └── fetches /api/mock-auctions
                      └── reads curatedCars.ts
                           └── renders DashboardClient.tsx

Auction Analysis
  └── User clicks "Analyze"
       └── POST /api/analyze
            ├── Auth check (Supabase)
            ├── Credit check (lib/credits)
            ├── Fetch auction + comparables (ORM)
            ├── Build prompt (lib/ai/prompts)
            ├── Call Claude (lib/ai/claude)
            ├── Parse response (lib/ai/analyzer)
            └── Save analysis + deduct credit

Cron Scraping
  └── GET /api/cron (bearer token)
       ├── scrapeAll() → BaT + C&B + CC (Playwright)
       ├── Upsert auctions (ORM)
       ├── Record price history
       └── Update market data aggregations
```

---

## 🧩 Environment Variables Required

| Variable | Used By |
|----------|---------|
| `DATABASE_URL` | ORM (PostgreSQL) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase auth |
| `ANTHROPIC_API_KEY` | Claude AI |
| `CRON_SECRET` | Cron endpoint protection |
| `NEXT_PUBLIC_BASE_URL` | SEO metadata generation |
