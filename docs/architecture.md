# 🏗️ Monza Lab — Architecture Document

> **Generated:** February 12, 2026  
> **App:** Monza Lab — Investment-Grade Automotive Asset Terminal  
> **Stack:** Next.js 16 · React 19 · TypeScript · legacy ORM · Supabase · Claude AI · TailwindCSS 4  

---

## 1. Executive Summary

**Monza Lab** is a full-stack web application that aggregates collector vehicle auctions from multiple platforms (Bring a Trailer, Cars & Bids, Collecting Cars), provides AI-powered investment analysis using Claude, and presents everything through a premium dark-themed dashboard. The app targets serious collectors and investors who want data-driven insights before bidding on high-value vehicles.

### Core Value Proposition
- **Multi-platform aggregation** of live auctions
- **AI-powered vehicle analysis** (valuation, red flags, investment grade)
- **Credit-based monetization** (3 free analyses/month, purchasable credits)
- **Multi-language support** (EN, ES, DE, JA)

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT TIER                           │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Dashboard   │  │   Auctions   │  │   Auction Detail   │  │
│  │  (Home Page) │  │   Browser    │  │   + AI Analysis    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘  │
│         │                 │                    │              │
│  ┌──────┴─────────────────┴────────────────────┴──────────┐  │
│  │            Shared Components & Hooks                    │  │
│  │   Header · Sidebar · Auth · Search · Filters · Charts  │  │
│  └────────────────────────────┬────────────────────────────┘  │
│                               │                              │
│  ┌────────────────────────────┴────────────────────────────┐  │
│  │        Auth Context (Supabase) · i18n (next-intl)       │  │
│  └────────────────────────────┬────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────┘
                                │
                     ┌──────────┴──────────┐
                     │    MIDDLEWARE TIER    │
                     │  i18n · Auth Refresh  │
                     └──────────┬──────────┘
                                │
┌───────────────────────────────┼──────────────────────────────┐
│                        API TIER (Next.js Route Handlers)      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  /api/mock-  │  │ /api/auctions│  │   /api/analyze     │  │
│  │  auctions    │  │ /api/auctions│  │   (POST → Claude)  │  │
│  │  (GET)       │  │ /[id] (GET)  │  │                    │  │
│  └──────────────┘  └──────────────┘  └────────────────────┘  │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ /api/scrape  │  │  /api/cron   │  │   /api/user/*      │  │
│  │ GET/POST/DEL │  │  (GET cron)  │  │   create · profile │  │
│  └──────────────┘  └──────────────┘  └────────────────────┘  │
└───────────────────────────────┼──────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────┐
│                      SERVICE TIER                             │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  AI Engine   │  │   Scrapers   │  │  Credits System    │  │
│  │  (Claude)    │  │  (Playwright │  │  (Freemium/Pro)    │  │
│  │  analyzer.ts │  │   + Cheerio) │  │  credits/index.ts  │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└───────────────────────────────┼──────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────┐
│                       DATA TIER                               │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  PostgreSQL  │  │   Supabase   │  │   Static Data      │  │
│  │  (via ORM    │  │   Auth       │  │   (curatedCars.ts  │  │
│  │   + PG adap.)│  │              │  │    + modelImages)  │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1 Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.1.6 | Full-stack React framework (App Router) |
| **React** | 19.2.3 | UI library |
| **TypeScript** | 5.x | Type safety |
| **TailwindCSS** | 4.x | Utility-first CSS |
| **Framer Motion** | 12.31.0 | Animations & transitions |
| **Recharts** | 3.7.0 | Price history charts |
| **Lucide React** | 0.563.0 | Icon library |
| **Radix UI** | 1.4.3 | Headless UI primitives |
| **CMDK** | 1.1.1 | Command palette |
| **next-intl** | 4.8.2 | Internationalization |
| **date-fns** | 4.1.0 | Date formatting |

### 3.2 Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Legacy ORM** | 7.3.0 | ORM with PostgreSQL adapter |
| **ORM PG adapter** | 7.3.0 | PostgreSQL native adapter |
| **Supabase** | 2.95.3 | Authentication (email/password + Google OAuth) |
| **Anthropic SDK** | 0.72.1 | Claude AI integration |
| **Cheerio** | 1.2.0 | HTML parsing for scraping |
| **Playwright** | 1.58.1 | Browser-based scraping |

### 3.3 External Services
| Service | Purpose |
|---------|---------|
| **Supabase** | User authentication, session management |
| **PostgreSQL** | Primary database (via Supabase or standalone) |
| **Anthropic Claude** | AI-powered vehicle analysis (`claude-sonnet-4-5-20250929`) |
| **Bring a Trailer** | Auction data source |
| **Cars & Bids** | Auction data source |
| **Collecting Cars** | Auction data source |

---

## 4. Architectural Patterns

### 4.1 Dual Data Strategy
The app operates in two modes simultaneously:

1. **Curated/Static Data** (`curatedCars.ts`, `featuredAuctions.ts`) — A handcrafted dataset of ~200+ investment-grade collector vehicles with images, pricing, investment theses, and regional valuations. This serves as the **primary data source** for the dashboard and ensures the app always has rich content to display.

2. **Live Scraped Data** (PostgreSQL via ORM) — Real auction data scraped from BaT, C&B, and CC platforms via Playwright. This data is stored in PostgreSQL and kept fresh via the `/api/cron` endpoint.

The API layer **cascades** through both: `curated → featured → database`.

### 4.2 Client-Server Component Split
- **Server Components** are used for layouts, metadata generation, and initial page shells
- **Client Components** (`"use client"`) handle all interactive UI — the dashboard, auction browser, search, and analysis views are fully client-rendered
- Data fetching happens **client-side via `useEffect`/`fetch`** to API routes

### 4.3 Middleware Pipeline
```
Request → next-intl (locale routing) → Supabase (auth refresh) → Response
```
Both middlewares are composed in a single `middleware.ts` that:
1. Resolves the locale and applies routing
2. Creates a Supabase server client to refresh expired sessions
3. Merges cookies from both middleware layers

### 4.4 Credits-Based Access Control
```
User analyzes auction
  ├── Already analyzed? → Free re-access (no credit)
  ├── Cached analysis (< 24h)? → Return cached (no credit)
  ├── Has credits? → Deduct 1, run AI analysis
  └── No credits? → Return 402 INSUFFICIENT_CREDITS
```

---

## 5. Data Architecture

### 5.1 Database Schema (PostgreSQL)

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│     Auction       │────▶│   Analysis   │     │  MarketData  │
│                   │ 1:1 │              │     │  (aggregate) │
│ id               │     │ bidTargetLow │     │ make         │
│ externalId (UQ)  │     │ bidTargetHigh│     │ model        │
│ platform (enum)  │     │ confidence   │     │ avgPrice     │
│ title            │     │ redFlags[]   │     │ totalSales   │
│ make / model     │     │ keyStrengths │     │ trend        │
│ year             │     │ investGrade  │     └──────────────┘
│ mileage          │     │ rawAnalysis  │
│ currentBid       │     └──────────────┘
│ bidCount         │
│ status (enum)    │     ┌──────────────┐
│ endTime          │────▶│  Comparable  │ 1:N
│ images[]         │     │ soldPrice    │
│ description      │     │ soldDate     │
└──────────────────┘     └──────────────┘
         │
         │ 1:N          ┌──────────────┐
         └────────────▶│ PriceHistory │
                        │ bid          │
                        │ timestamp    │
                        └──────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│      User         │────▶│CreditTransaction │     │ UserAnalysis │
│                   │ 1:N │                  │     │              │
│ supabaseId (UQ)  │     │ amount (+/-)     │     │ userId       │
│ email (UQ)       │     │ type (enum)      │     │ auctionId    │
│ creditsBalance   │     │ stripePaymentId  │     │ creditCost   │
│ tier (FREE/PRO)  │     └──────────────────┘     └──────────────┘
│ creditResetDate  │                                    │
└──────────────────┘────────────────────────────────────┘ 1:N
```

### 5.2 Enums

| Enum | Values |
|------|--------|
| `Platform` | `BRING_A_TRAILER`, `CARS_AND_BIDS`, `COLLECTING_CARS` |
| `AuctionStatus` | `ACTIVE`, `ENDING_SOON`, `ENDED`, `SOLD`, `NO_SALE` |
| `ReserveStatus` | `NO_RESERVE`, `RESERVE_NOT_MET`, `RESERVE_MET` |
| `AnalysisConfidence` | `HIGH`, `MEDIUM`, `LOW` |
| `InvestmentGrade` | `EXCELLENT`, `GOOD`, `FAIR`, `SPECULATIVE` |
| `MarketTrend` | `APPRECIATING`, `STABLE`, `DECLINING` |
| `UserTier` | `FREE`, `PRO` |
| `TransactionType` | `FREE_MONTHLY`, `PURCHASE`, `ANALYSIS_USED`, `BONUS`, `REFUND` |

---

## 6. Core Subsystems

### 6.1 AI Analysis Engine

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  prompts.ts  │───▶│  analyzer.ts │───▶│  claude.ts   │
│              │    │              │    │              │
│ Build prompt │    │ Orchestrate  │    │ API wrapper  │
│ with vehicle │    │ + parse JSON │    │ Claude SDK   │
│ + market data│    │ + cache 24h  │    │ Sonnet 4.5   │
└─────────────┘    └──────┬───────┘    └─────────────┘
                          │
                   Returns AnalysisResult:
                   ├── summary
                   ├── fairValueLow/High
                   ├── confidenceScore
                   ├── pros/cons/redFlags
                   ├── recommendation
                   └── marketTrend
```

**Key Features:**
- JSON extraction with markdown fence stripping
- Retry logic for malformed AI responses
- In-memory analysis cache (24h TTL, keyed by vehicle data)
- Three analysis types: full vehicle, market summary, quick valuation

### 6.2 Web Scraping System

```
┌──────────────────┐
│   Scraper Manager │ (scrapers/index.ts)
│   scrapeAll()     │
└────────┬──────────┘
         │ Promise.allSettled (parallel)
    ┌────┼────┐
    ▼    ▼    ▼
┌──────┐ ┌──────┐ ┌──────┐
│  BaT │ │ C&B  │ │  CC  │  ← Playwright-based (full browser)
└──────┘ └──────┘ └──────┘

┌──────────────────────┐
│   URL Price Scraper   │ (scraper.ts)
│   fetchAuctionData()  │ ← Cheerio-based (lightweight, no browser)
│   • BaT · RM · C&B · CC
│   • 24h in-memory cache
│   • Batch support
└──────────────────────┘
```

**Two Scraping Approaches:**
1. **Heavy scraping** (Playwright) — Full browser automation for listing pages, used by cron jobs
2. **Lightweight scraping** (Cheerio) — CSS-only HTML parsing for individual URLs, used for on-demand price checks

### 6.3 Authentication & Authorization

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Supabase    │────▶│  middleware  │────▶│ AuthProvider │
│  (Auth)      │     │  (server)   │     │  (client)    │
│              │     │             │     │              │
│ Email/Pass   │     │ Refresh     │     │ React Context│
│ Google OAuth │     │ sessions    │     │ useAuth()    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                        │
       │         ┌─────────────┐                │
       └────────▶│ /auth/callback │◀────────────┘
                 │ (OAuth code   │
                 │  exchange)    │
                 └─────────────┘
```

**Auth Flow:**
1. User signs in via email/password or Google OAuth
2. Supabase issues session tokens (stored as cookies)
3. Middleware refreshes expired sessions on every request
4. `AuthProvider` provides `useAuth()` hook for client components
5. On first sign-in, `/api/user/create` creates/fetches the DB user

### 6.4 Credits & Monetization System

```
New User Registration
  └── getOrCreateUser()
       └── Creates user with 3 FREE credits
            └── Records FREE_MONTHLY transaction

Monthly Reset (checked on profile access)
  └── checkAndResetFreeCredits()
       └── If 1+ months since reset:
            ├── Add 3 credits
            ├── Reset freeCreditsUsed counter
            └── Record FREE_MONTHLY transaction

Analysis Request
  └── deductCredit()
       ├── Already analyzed? → Free (cached)
       ├── Balance >= 1? → Deduct, record ANALYSIS_USED
       └── Balance < 1? → Reject with INSUFFICIENT_CREDITS

Credit Purchase (prepared, not yet live)
  └── addPurchasedCredits()
       └── Increment balance, record PURCHASE with Stripe ID
```

### 6.5 Internationalization (i18n)

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│  routing.ts       │────▶│  request.ts   │────▶│  messages/   │
│                   │     │              │     │              │
│ locales: en,es,  │     │ Load JSON    │     │ en.json      │
│  de, ja           │     │ messages     │     │ es.json      │
│ default: en       │     │              │     │ de.json      │
│ prefix: as-needed│     │              │     │ ja.json      │
└──────────────────┘     └──────────────┘     └──────────────┘
```

- English URLs have no prefix (`/auctions`)
- Other locales use prefixes (`/es/auctions`, `/de/auctions`, `/ja/auctions`)
- `LanguageSwitcher` component allows runtime locale switching

---

## 7. Page Architecture

### 7.1 Routing Map

```
/                           → Root page (dashboard, non-locale)
/[locale]/                  → Localized dashboard (DashboardClient)
/[locale]/auctions          → Auction browser (AuctionsClient)
/[locale]/auctions/[id]     → Auction detail (AuctionDetailClient)
/[locale]/cars/[make]       → Make page (MakePageClient)
/[locale]/cars/[make]/[id]  → Car detail
/[locale]/cars/[make]/models → Model listing
/[locale]/search            → Search (SearchClient)
/[locale]/history           → Market trends (MarketTrendsClient)
/auth/callback              → OAuth callback handler
```

### 7.2 Component Hierarchy

```
RootLayout (Public_Sans font, dark theme)
  └── [locale]/layout.tsx
       ├── NextIntlClientProvider
       ├── AuthProvider
       ├── Header
       │    ├── Navigation links
       │    ├── Search
       │    ├── LanguageSwitcher
       │    ├── Auth state (CreditDisplay / AuthModal)
       │    └── Mobile menu
       ├── <main>{children}</main>
       │    ├── DashboardClient (/)
       │    │    ├── Brand Grid
       │    │    ├── Auction Cards (filterable)
       │    │    ├── Context Panel (selected car detail)
       │    │    ├── Regional Pricing
       │    │    └── StrategistChat
       │    ├── AuctionsClient (/auctions)
       │    │    ├── FilterSidebar / MobileFilters
       │    │    ├── AuctionCard (grid/list)
       │    │    └── Pagination
       │    ├── AuctionDetailClient (/auctions/[id])
       │    │    ├── ImageGallery
       │    │    ├── PriceChart
       │    │    ├── AnalysisReport
       │    │    ├── ComparableSales
       │    │    ├── OwnershipCosts
       │    │    └── RedFlags / CriticalQuestions
       │    └── SearchClient (/search)
       │         ├── SearchBar
       │         ├── Filters
       │         └── SortOptions
       └── MobileBottomNav
```

---

## 8. Data Flow Diagrams

### 8.1 Dashboard Load Flow

```
Browser                    API                         Data
  │                         │                           │
  │  GET /api/mock-auctions │                           │
  │────────────────────────▶│                           │
  │                         │  Read CURATED_CARS        │
  │                         │─────────────────────────▶│
  │                         │◀─────────────────────────│
  │                         │  Apply filters/sort/page  │
  │  { auctions, total }    │                           │
  │◀────────────────────────│                           │
  │                         │                           │
  │  Transform & render     │                           │
  │  DashboardClient        │                           │
```

### 8.2 AI Analysis Flow

```
Browser              API (/api/analyze)        Services              Database
  │                        │                      │                      │
  │  POST {auctionId}      │                      │                      │
  │───────────────────────▶│                      │                      │
  │                        │  Verify auth         │                      │
  │                        │─────────────────────▶│ Supabase             │
  │                        │◀─────────────────────│                      │
  │                        │                      │                      │
  │                        │  getOrCreateUser()   │                      │
  │                        │─────────────────────────────────────────────▶│
  │                        │◀─────────────────────────────────────────────│
  │                        │                      │                      │
  │                        │  Check cached analysis (24h)                │
  │                        │─────────────────────────────────────────────▶│
  │                        │◀─────────────────────────────────────────────│
  │                        │                      │                      │
  │                        │  Check credits       │                      │
  │                        │─────────────────────────────────────────────▶│
  │                        │◀─────────────────────────────────────────────│
  │                        │                      │                      │
  │                        │  Build prompt        │                      │
  │                        │─────────────────────▶│ prompts.ts           │
  │                        │                      │                      │
  │                        │  Call Claude AI      │                      │
  │                        │─────────────────────▶│ claude.ts            │
  │                        │◀─────────────────────│ (Sonnet 4.5)         │
  │                        │                      │                      │
  │                        │  Parse + save analysis                      │
  │                        │─────────────────────────────────────────────▶│
  │                        │  Deduct credit       │                      │
  │                        │─────────────────────────────────────────────▶│
  │                        │                      │                      │
  │  { analysis, credits } │                      │                      │
  │◀───────────────────────│                      │                      │
```

### 8.3 Cron Scraping Flow

```
External Trigger          API (/api/cron)         Scrapers              Database
  │                            │                      │                      │
  │  GET + Bearer token        │                      │                      │
  │───────────────────────────▶│                      │                      │
  │                            │  Verify CRON_SECRET  │                      │
  │                            │                      │                      │
  │                            │  scrapeAll()         │                      │
  │                            │─────────────────────▶│                      │
  │                            │                      │  BaT (Playwright)    │
  │                            │                      │  C&B (Playwright)    │
  │                            │                      │  CC  (Playwright)    │
  │                            │◀─────────────────────│                      │
  │                            │                      │                      │
  │                            │  Upsert each auction │                      │
  │                            │─────────────────────────────────────────────▶│
  │                            │                      │                      │
  │                            │  Record price history│                      │
  │                            │─────────────────────────────────────────────▶│
  │                            │                      │                      │
  │                            │  Mark expired → ENDED│                      │
  │                            │─────────────────────────────────────────────▶│
  │                            │                      │                      │
  │                            │  Update MarketData   │                      │
  │                            │  (groupBy avg/min/max)                      │
  │                            │─────────────────────────────────────────────▶│
  │                            │                      │                      │
  │  { scrapingResults, ... }  │                      │                      │
  │◀───────────────────────────│                      │                      │
```

---

## 9. Security Architecture

### 9.1 Authentication
- **Supabase Auth** handles user identity (email/password + Google OAuth)
- Sessions are stored as **HTTP-only cookies** managed by `@supabase/ssr`
- Middleware refreshes expired tokens on every request
- API routes verify auth via `supabase.auth.getUser()`

### 9.2 API Protection
| Endpoint | Protection |
|----------|-----------|
| `/api/analyze` | Supabase auth required + credit check |
| `/api/cron` | Bearer token (`CRON_SECRET`) |
| `/api/user/*` | Supabase auth required |
| `/api/auctions` | Public (read-only) |
| `/api/mock-auctions` | Public (read-only) |
| `/api/scrape` | Public (but rate-limited by design) |

### 9.3 Data Safety
- ORM layer uses parameterized queries (SQL injection prevention)
- Server Actions capped at 2MB body size
- Credit deduction uses ORM `$transaction` for atomicity

---

## 10. Performance Considerations

### 10.1 Caching Layers
| Layer | TTL | Purpose |
|-------|-----|---------|
| AI Analysis (in-memory) | 24h | Avoid duplicate Claude API calls |
| AI Analysis (database) | 24h | Persistent analysis cache |
| URL Scraper (in-memory) | 24h | Avoid re-scraping same URL |
| Static data (curatedCars) | ∞ | Hardcoded reference dataset |
| Next.js ISR | 60s | Auction detail metadata revalidation |

### 10.2 Database Indexing
```sql
@@index([platform])         -- Filter by platform
@@index([make, model])      -- Filter by vehicle
@@index([status])           -- Filter by auction status
@@index([endTime])          -- Sort by ending time
@@index([supabaseId])       -- User lookups
@@index([email])            -- User lookups
@@index([userId])           -- Transaction lookups
```

### 10.3 Client Optimizations
- Suspense boundaries for progressive loading
- Debounced search (300ms)
- `next/image` for optimized image delivery
- Grid/list view toggle without re-fetching data
- Framer Motion for GPU-accelerated animations

---

## 11. Deployment Considerations

### 11.1 Required Environment Variables
```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
CRON_SECRET=your-cron-secret
NEXT_PUBLIC_BASE_URL=https://monzalab.com
```

### 11.2 Build Process
```bash
orm generate && next build
```

### 11.3 Recommended Infrastructure
- **Hosting:** Vercel (optimized for Next.js)
- **Database:** Supabase PostgreSQL or standalone PostgreSQL
- **Cron:** Vercel Cron Jobs or external scheduler hitting `/api/cron`
- **CDN:** Vercel Edge Network for static assets + images

---

## 12. Future Architecture Notes

### Prepared but Not Live
- **Stripe integration** — `stripePaymentId` field exists in `CreditTransaction`, `addPurchasedCredits()` is implemented
- **PRO user tier** — `UserTier` enum supports `FREE` and `PRO`, but no subscription management UI exists yet
- **RM Sotheby's support** — Image CDN configured in `next.config.ts`, scraper parser exists in `scraper.ts`

### Scalability Path
- Replace in-memory caches with Redis for multi-instance deployments
- Move Playwright scrapers to dedicated worker processes / serverless functions
- Add WebSocket for real-time bid updates
- Add Stripe Elements for credit purchases
