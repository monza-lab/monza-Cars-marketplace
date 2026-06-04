# Report V3: Multi-Agent Intelligence Pipeline

**Date:** 2026-05-12
**Status:** Draft — pending user review
**Owner:** Camilo / Monza Haus
**Depends on:** `2026-05-12-report-world-class-completion-design.md` (V2 plumbing fixes must land first)

---

## 0. V2 Completion Spec — Implementation Status

The V3 pipeline depends on the V2 plumbing being solid. Audit of current state (2026-05-12):

| Item | Spec Section | Status | Notes |
|------|-------------|--------|-------|
| V2 is default report | 3.1 | **DONE** | V2 renders when report exists; V1 renders as generation trigger when no report |
| Props always passed | 3.1 | **DONE** | d2, tier, hash, version all passed to V2 |
| `?v1=1` fallback support | 3.1 | **NOT DONE** | searchParams type not updated (minor) |
| color/vin/narrative persist (write) | 3.2 | **DONE** | saveHausReport includes all 3 fields with 42703 fallback |
| color/vin/narrative persist (read) | 3.2 | **DONE** | assembleHausReportFromDB reads all 3 fields |
| False fallbacks fixed | 3.3 | **DONE** | numOrNull returns null not 0; layer/version default to null |
| Structured logging | 3.4 | **PARTIAL** | End-of-pipeline log exists; per-step timing NOT implemented |
| V1 jsPDF deprecated | 3.5 | **DEFERRED** | V1 still renders as fallback, jsPDF code present but unreachable for V2 users |
| PDF templates sparse data | 3.6 | **DONE** | All templates handle null/0 gracefully |
| Excel includes V2 data | 3.7 | **DONE** | Color, VIN, narrative all in Excel sheets |
| D3 percentile null | 3.9 | **DONE** | Returns null when no data; UI shows "Not enough data" |
| PENDING verdict | 3.10 | **DONE** | Implemented in VerdictBlock, PDF, Excel, both deriveVerdict() |

**Overall: ~85% complete.** Remaining gaps (per-step logging, `?v1=1` param) are minor and will be absorbed into the V3 pipeline refactor.

---

## 1. Context & Problem

### 1.1 Current state

The V2 report (when fully connected via the completion spec) delivers:
- Fair value range from comparables (mechanical)
- Signal extraction from listing text (Gemini)
- 150-250 word investment narrative
- Color/VIN intelligence (mechanical)
- Cross-border arbitrage numbers
- Modifier-based valuation breakdown

**Total value delivered: ~5 sections of real content.**

### 1.2 Competitor benchmark

A leading competitor charges $10/report and delivers **23+ rich sections** including:
- Bidding/negotiation strategy with dollar anchoring
- Vehicle history & heritage (deep model knowledge)
- Production numbers & rarity assessment
- Key strengths & common issues specific to the car
- Collector outlook & investment potential
- 1/3/5/10 year ownership cost projections
- Resale timeline with confidence bands
- 13+ vehicle-specific seller questions
- Reliability rating & common issues
- Expert consensus (journalist analysis)
- Owner community sentiment
- Parts availability with specific pricing
- Insurance cost estimates
- Regional market variations with %
- Transportation/shipping estimates
- Original MSRP vs today's value
- Interactive "Build Your Bid" calculator
- Final recommendation with scoring

**Their weakness:** Everything is AI-estimated with no real transaction data. They admit this on-page.

### 1.3 Our moat

Monza has **real data** the competitor does not:
- Real sold prices from BaT, Cars & Bids, Collecting Cars, RM Sotheby's
- Real asking prices from Elferspot, AutoTrader, AutoScout24, Be Forward
- Real cross-border arbitrage from 4 regional markets (US/EU/UK/JP)
- Real comparable vehicles with actual transaction dates
- Real market trends computed from actual data points

**The V3 report combines our real data moat with AI-generated knowledge content.** Every section should clearly distinguish "verified from data" vs "AI-estimated" so users trust our numbers over the competitor's pure-AI approach.

---

## 2. Architecture: Multi-Agent Pipeline

### 2.1 Overview

When a user clicks "Generate Report", we launch a **10-step pipeline**. The user sees a progress stepper (like the competitor's UI). Each step is a specialized function or AI agent.

```
User clicks "Generate Report" (100 Pistons)
        │
        ▼
┌─────────────────────────────────────────────────┐
│  STEP 1: LISTING SCRAPER                        │
│  Scrapling/Playwright → full listing data        │
│  Source: original listing URL                    │
└────────────────────┬────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ STEP 2:      │ │ STEP 3:  │ │ STEP 4:      │
│ VEHICLE ID   │ │ MARKET   │ │ FAIR VALUE   │
│ (brandConfig │ │ DATA     │ │ ENGINE       │
│  + AI)       │ │ (Supa DB)│ │ (existing)   │
└──────┬───────┘ └────┬─────┘ └──────┬───────┘
       │              │              │
       └──────────────┼──────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ STEP 5:      │ │ STEP 6:  │ │ STEP 7:      │
│ TECHNICAL    │ │ INVEST-  │ │ DUE          │
│ ANALYST      │ │ MENT     │ │ DILIGENCE    │
│ (AI agent)   │ │ ANALYST  │ │ (AI agent)   │
│              │ │ (AI+DB)  │ │              │
└──────┬───────┘ └────┬─────┘ └──────┬───────┘
       │              │              │
       └──────────────┼──────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ STEP 8:      │ │ STEP 9:  │ │ STEP 10:     │
│ MARKET       │ │ BUYER    │ │ FINAL        │
│ RESEARCHER   │ │ SERVICES │ │ SYNTHESIS    │
│ (AI agent)   │ │ (AI+DB)  │ │ (AI agent)   │
└──────┬───────┘ └────┬─────┘ └──────┬───────┘
       │              │              │
       └──────────────┴──────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  PERSIST ALL  │
              │  TO DB        │
              │  Return to UI │
              └───────────────┘
```

### 2.2 Parallelization

- **Steps 2, 3, 4** run in parallel (no inter-dependency)
- **Steps 5, 6, 7** run in parallel (all depend on steps 1-4)
- **Steps 8, 9** run in parallel (depend on steps 1-7)
- **Step 10** runs last (needs everything)

**Expected total time:** ~15-25 seconds (vs current ~8-12 seconds)

### 2.3 Listing-Type Awareness

Each listing is classified as **auction** or **classified** based on platform:

| Platform | Type | Detected by |
|----------|------|-------------|
| BRING_A_TRAILER, CARS_AND_BIDS, COLLECTING_CARS, RM_SOTHEBYS, GOODING, BONHAMS | Auction | `platform` field |
| ELFERSPOT, AUTOSCOUT_24, AUTOTRADER_UK, BE_FORWARD, CLASSIC_COM | Classified | `platform` field |
| Unknown | Classified (default) | fallback |

**Impact on content:**

| Section | Auction | Classified |
|---------|---------|------------|
| Strategy section title | "Bidding Strategy" | "Negotiation Strategy" |
| Price anchor | Current bid / reserve | Asking price |
| Strategy advice | Max bid, timing, reserve strategy | Opening offer, walk-away price, leverage |
| Urgency signal | Auction end date/time | Days on market, price history/drops |
| Comparable framing | "Recent hammer prices" | "Similar asking prices on market" |
| Cost basis | "If you win at $X..." | "If you buy at asking $X..." |

---

## 3. Step Specifications

### Step 1: Listing Scraper (NEW — critical)

**Purpose:** Fetch the original listing URL and extract 100% of available data. The marketplace scraper grabs essentials for the feed; the report scraper grabs everything.

**Implementation:** Scrapling/Playwright (existing infrastructure in `src/features/scrapers/`)

**Input:** `car.sourceUrl` (the original listing URL from the DB)

**Output:** `ScrapedListingFull`
```typescript
interface ScrapedListingFull {
  // Identity
  title: string
  year: number | null
  make: string
  model: string
  trim: string | null
  vin: string | null

  // Specs (often missing from marketplace scrape)
  engine: string | null          // "4.0L flat-six"
  transmission: string | null    // "7-speed PDK"
  drivetrain: string | null      // "RWD"
  horsepower: number | null
  torque: string | null
  weight: string | null
  bodyStyle: string | null       // "Coupe"
  seats: number | null

  // Condition & history
  mileage: number | null
  mileageUnit: "mi" | "km"
  exteriorColor: string | null
  interiorColor: string | null
  location: string | null

  // Full text content
  descriptionFull: string         // Complete listing description (not truncated)
  sellerNotes: string | null      // Additional seller comments
  auctionComments: string | null  // Bidder Q&A, auction house notes
  lotEssay: string | null         // Auction house essay (BaT, RM, etc.)

  // Equipment & options
  equipmentList: string[]         // All listed equipment/options
  modifications: string[]         // Listed modifications

  // Media
  photoUrls: string[]             // All photo URLs
  photoCount: number

  // Auction-specific
  currentBid: number | null
  bidCount: number | null
  reserveStatus: "met" | "not_met" | "no_reserve" | "unknown"
  auctionEndTime: string | null

  // Classified-specific
  askingPrice: number | null
  daysOnMarket: number | null
  priceDrops: { date: string; from: number; to: number }[] | null

  // Seller
  sellerName: string | null
  sellerType: "dealer" | "private" | "auction_house" | null
  sellerLocation: string | null

  // Meta
  scrapedAt: string               // ISO timestamp
  scrapeSuccessful: boolean
  scrapePartial: boolean          // true if some sections failed
  sourceUrl: string
  platform: string
}
```

**Fallback:** If the listing URL is dead, the page is behind a paywall, or scraping fails, fall back to the existing DB data (`CollectorCar` fields). The report still generates — just with less depth. Log the failure.

**Important:** This scrape happens at generation time, NOT during the regular scraper cron. It's a one-time, per-report operation. The cost is negligible (one page load per report).

### Step 2: Vehicle Identifier

**Purpose:** Establish the exact identity of the car using brandConfig + AI enrichment.

**Data sources:**
- `brandConfig.ts` → series, family, generation, year range
- Step 1 scrape data → trim, engine, options from full description
- AI call (Gemini) → Disambiguate model variants when scrape data is ambiguous

**Output:** `VehicleIdentity`
```typescript
interface VehicleIdentity {
  year: number
  make: string
  model: string
  series: string              // from brandConfig: "992"
  family: string              // from brandConfig: "911"
  variant: string | null      // "GT3 RS", "Carrera S", "Turbo S"
  trim: string | null
  generationYears: string     // "2019-2025"
  engine: string | null       // "4.0L naturally aspirated flat-six"
  transmission: string | null // "7-speed PDK"
  drivetrain: string | null   // "RWD"
  bodyStyle: string | null    // "Coupe"
  horsepower: number | null
  factoryOptions: string[]    // ["PCCB", "Sport Chrono", "Weissach Package"]
  isSpecialEdition: boolean   // GT3 RS, Sport Classic, etc.
  listingType: "auction" | "classified"
}
```

### Step 3: Market Data (from DB — our moat)

**Purpose:** Pull all relevant market intelligence from our Supabase database.

**Data sources:**
- `fetchPricedListingsForModel()` → all priced listings for make
- `computeMarketStatsForCar()` → regional medians, trends, data points
- `getComparablesForModel()` → sold comparables from DB
- `computeArbitrageForCar()` → cross-border opportunities
- `findSimilarCars()` → similar active listings

**Output:** `MarketDataBundle`
```typescript
interface MarketDataBundle {
  // Regional market stats (from real data)
  marketStats: ModelMarketStats
  regions: RegionalMarketStats[]

  // Comparables (from real sold data)
  dbComparables: DbComparableRow[]
  comparablesCount: number

  // Cross-border (from real regional prices)
  arbitrage: MarketIntelD2

  // Similar active listings
  similarCars: SimilarCarResult[]

  // Trend data
  trendPercent12m: number | null
  trendDirection: "up" | "down" | "flat" | "insufficient_data"

  // Data quality indicators
  totalDataPoints: number
  oldestDataPoint: string | null // ISO date
  newestDataPoint: string | null
  regionsWithData: string[]      // ["US", "EU", "UK", "JP"]
}
```

**Key:** Every number here comes from real data. The report must label these as "Verified from X data points" not "AI-estimated".

### Step 4: Fair Value Engine (existing, enhanced)

**Purpose:** Compute fair value using the existing modifier-based engine.

**Enhancement:** Use the richer data from Step 1 (full equipment list, complete description) to extract MORE signals than the current thin scrape allows. This should dramatically increase signal count from the typical 2-5 to 10-20+.

**Output:** Existing `HausReport` shape (fair values, signals, modifiers, color intel, VIN intel)

### Step 5: Technical Analyst Agent (AI — NEW)

**Purpose:** Deep technical analysis of this specific car. This is where the AI brings knowledge the DB doesn't have.

**AI model:** Gemini 2.5 Flash (existing integration)

**Input prompt context:**
- Full vehicle identity (Step 2)
- Full listing description (Step 1)
- Equipment list (Step 1)
- Signals detected (Step 4)

**Output:** `TechnicalAnalysis`
```typescript
interface TechnicalAnalysis {
  // Vehicle History & Heritage (competitor: "Heritage" section)
  modelHistory: string              // 300-500 words: model lineage, generation significance
  whatMakesThisSpecSpecial: string   // 150-300 words: specific to THIS config

  // Production Numbers & Rarity
  productionData: {
    totalProduction: string | null   // "3,418 units worldwide"
    thisConfigEstimate: string | null // "~200 with PDK + PCCB"
    rarityAssessment: "common" | "uncommon" | "rare" | "very_rare" | "unique"
    rarityNote: string               // Why it's rare/common
  }

  // Key Strengths (specific to THIS car)
  keyStrengths: {
    point: string
    detail: string
  }[]                                // 4-6 items

  // Common Issues & Concerns (for this model/generation)
  commonIssues: {
    issue: string
    severity: "critical" | "moderate" | "minor"
    typicalCost: string | null       // "$2,000 - $5,000"
    appliesTo: string                // "All 992 GT3 models"
  }[]                                // 4-8 items

  // Reliability Rating
  reliability: {
    rating: "excellent" | "above_average" | "average" | "below_average" | "poor"
    maintenanceCostLevel: "low" | "moderate" | "high" | "very_high"
    commonProblems: string[]         // Top 3-5 known issues
  }

  // Collector Outlook
  collectorOutlook: {
    investmentGrade: "high" | "moderate" | "low" | "speculative"
    demandLevel: "high" | "moderate" | "low"
    futureOutlook: string            // 150-200 words
  }
}
```

**Prompt structure:** System prompt establishes the AI as a specialist automotive journalist with deep Porsche knowledge. The user prompt provides the car data and asks for each section. Temperature: 0.3 (factual but not robotic).

### Step 6: Investment Analyst Agent (AI + DB — NEW)

**Purpose:** Financial analysis combining our real market data with AI projections.

**Input:**
- Market data bundle (Step 3) — real comparables and trends
- Fair value (Step 4) — computed baseline
- Vehicle identity (Step 2) — model/variant context
- Listing type (auction vs classified)

**Output:** `InvestmentAnalysis`
```typescript
interface InvestmentAnalysis {
  // Bidding/Negotiation Strategy (listing-type-aware)
  strategy: {
    type: "auction" | "classified"
    // Auction-specific
    maxBidRecommendation: number | null
    bidTiming: string | null          // "Bid in final 2 minutes"
    reserveStrategy: string | null
    // Classified-specific
    openingOffer: number | null
    walkAwayPrice: number | null
    negotiationLeverage: string[]     // ["Listed 45 days — seller motivated", ...]
    // Common
    strategyInsight: string           // 200-400 words explaining the strategy
    potentialRepairs: {
      low: number
      high: number
      description: string
    }
  }

  // Ownership Cost Projections (AI-estimated, label clearly)
  ownershipCosts: {
    year1: CostProjection
    year3: CostProjection
    year5: CostProjection
  }

  // Resale Timeline (AI-estimated with confidence bands)
  resaleTimeline: {
    year1: ResaleProjection
    year3: ResaleProjection
    year5: ResaleProjection
    year10: ResaleProjection
  }

  // Investment narrative (expanded from current 150-250 to 500-800 words)
  investmentNarrative: string
}

interface CostProjection {
  totalCost: number
  breakdown: {
    valueChange: number        // appreciation or depreciation
    insurance: number
    maintenance: number
    majorWork: number | null   // null if not expected in this period
  }
  notes: string                // Brief explanation
  confidence: "high" | "medium" | "low"
}

interface ResaleProjection {
  estimatedRange: { low: number; high: number }
  percentChange: number        // from current price
  confidence: "high" | "medium" | "low"
  keyFactors: string[]         // 2-3 factors driving the projection
}
```

**Critical:** The strategy section must use REAL data (actual comparables, actual market medians from Step 3) to anchor dollar amounts. The ownership/resale projections are AI-estimated and must be labeled as such.

### Step 7: Due Diligence Agent (AI — NEW)

**Purpose:** Generate vehicle-specific questions, risk assessment, and inspection guidance.

**Input:**
- Full listing data (Step 1)
- Vehicle identity (Step 2)
- Signals detected + missing (Step 4)
- Technical analysis (Step 5 — common issues)

**Output:** `DueDiligenceReport`
```typescript
interface DueDiligenceReport {
  // Critical Questions for the Seller (10-15 questions)
  questions: {
    category: "essential" | "vehicle_specific" | "history" | "financial"
    question: string
    whyItMatters: string       // Brief rationale
  }[]

  // Risk Assessment (now with actual scoring)
  riskScore: {
    overall: number            // 0-100
    breakdown: {
      category: string         // "Pricing", "Provenance", "Condition", "Market"
      score: number            // 0-100
      note: string
    }[]
  }

  // Pre-Purchase Inspection Checklist (model-specific)
  ppiChecklist: {
    item: string
    priority: "critical" | "recommended" | "optional"
    specificTo: string         // "992 GT3 RS" not generic
    estimatedCost: string | null
  }[]
}
```

### Step 8: Market Researcher Agent (AI — NEW)

**Purpose:** Bring external knowledge about the model's reputation, expert opinions, and community sentiment.

**Output:** `MarketResearch`
```typescript
interface MarketResearch {
  // Expert Consensus (what automotive journalists say)
  expertConsensus: {
    compiledAnalysis: {
      category: string           // "Driving Experience", "Performance", "Value", etc.
      sentiment: "positive" | "mixed" | "negative"
      summary: string            // 50-100 words
    }[]
  }

  // Owner Sentiment (community insights)
  ownerSentiment: {
    commonPraise: string[]       // 3-5 things owners love
    commonComplaints: string[]   // 3-5 things owners dislike
    ownerTips: string[]          // 3-5 practical tips
  }

  // Heritage (brand/model history)
  heritage: string               // 200-400 words

  // Events & Community
  relevantEvents: {
    name: string
    frequency: string
    location: string
    description: string
  }[]
  ownerClubs: string[]
}
```

### Step 9: Buyer Services Agent (AI + DB — NEW)

**Purpose:** Practical buyer information combining DB data with AI estimates.

**Input:**
- Market data bundle (Step 3) — regional prices
- Vehicle identity (Step 2) — for parts/insurance context
- Listing location — for shipping estimates

**Output:** `BuyerServices`
```typescript
interface BuyerServices {
  // Parts Availability & Costs
  partsAvailability: {
    overallRating: "readily_available" | "available" | "limited" | "scarce"
    oemNote: string
    aftermarketNote: string
    commonParts: {
      name: string
      availability: string
      priceRange: string       // "$800 - $1,500"
    }[]
  }

  // Insurance Cost Estimates
  insuranceEstimates: {
    collectorPolicy: {
      annualPremium: { low: number; high: number }
      mileageLimit: string
      providers: string[]
    }
    dailyDriver: {
      annualPremium: { low: number; high: number }
    } | null
    notes: string
    vehicleCategory: string    // "Exotic", "Sports", "Classic"
  }

  // Regional Market Variations (enhanced with DB data)
  regionalVariations: {
    strongMarkets: {
      region: string
      premiumPercent: string   // "+10-20%"
      reason: string
    }[]
    weakerMarkets: {
      region: string
      discountPercent: string
      reason: string
    }[]
  }

  // Transportation & Shipping
  transportEstimates: {
    recommendation: "enclosed" | "open" | "either"
    specialHandling: string[]
    routes: {
      type: "enclosed" | "open"
      shortHaul: { perMile: string; example: string }
      mediumHaul: { perMile: string; example: string }
      longHaul: { perMile: string; example: string }
    }[]
    seasonalNote: string
    insuranceNote: string
  }

  // From the Archives
  originalMsrp: {
    basePrice: number | null
    adjustedForInflation: number | null
    note: string
  } | null
}
```

### Step 10: Final Synthesis Agent (AI — assembles everything)

**Purpose:** Read all previous outputs and compose the executive summary, final verdict, and one-page brief.

**Output:** `FinalSynthesis`
```typescript
interface FinalSynthesis {
  // Executive Summary (replaces current thin summary)
  executiveSummary: {
    headline: string           // One powerful sentence
    keyMetrics: {
      fairValueRange: string
      signalsCoverage: string  // "14/20 signals verified"
      riskScore: number
      verdict: "BUY" | "WATCH" | "WALK"
      marketPosition: string   // "12% below fair value"
    }
    investmentThesis: string   // 100-200 words (not the generic "Listed on Be Forward")
  }

  // Final Recommendation
  finalRecommendation: {
    score: number              // 1-10
    conditionEstimate: string  // "9/10"
    verdict: string            // 200-300 words wrapping everything up
  }
}
```

---

## 4. Data Persistence

### 4.1 New DB table: `report_sections`

Instead of cramming everything into `listing_reports`, the V3 pipeline stores each agent's output as a separate JSON section:

```sql
CREATE TABLE report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id TEXT NOT NULL REFERENCES live_listings(id),
  report_version INTEGER NOT NULL DEFAULT 1,
  section_key TEXT NOT NULL,           -- 'technical_analysis', 'investment_analysis', etc.
  section_data JSONB NOT NULL,         -- Agent output as JSON
  agent_model TEXT,                    -- 'gemini-2.5-flash'
  generation_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(listing_id, report_version, section_key)
);
```

**Section keys:**
- `listing_scrape` (Step 1)
- `vehicle_identity` (Step 2)
- `market_data_bundle` (Step 3 — summary only, raw data stays in existing tables)
- `fair_value` (Step 4 — continues using `listing_reports` + `listing_signals`)
- `technical_analysis` (Step 5)
- `investment_analysis` (Step 6)
- `due_diligence` (Step 7)
- `market_research` (Step 8)
- `buyer_services` (Step 9)
- `final_synthesis` (Step 10)

### 4.2 Backward compatibility

The existing `listing_reports` and `listing_signals` tables remain unchanged. Step 4 continues writing to them via the existing `saveHausReport()` and `saveSignals()` functions. The new `report_sections` table extends, not replaces.

### 4.3 Cache strategy

Same as current: if `report_sections` rows exist for a listing, skip re-generation (cache hit). Users who want a fresh report can trigger regeneration (future: "Refresh Report" button that costs additional Pistons).

---

## 5. User Experience

### 5.1 Generation Loading Experience — Photo Slideshow + Progress

When the user clicks "Generate Report", they enter an **immersive full-screen loading experience** that combines the car's photos with research progress. This is NOT a boring spinner — it's a cinematic moment that builds anticipation and communicates the depth of analysis happening.

#### Visual Design

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│          ┌──────────────────────────────┐            │
│          │                              │            │
│          │   [CAR PHOTO - FULLSCREEN    │            │
│          │    WITH KEN BURNS EFFECT     │            │
│          │    SLOW ZOOM + PAN           │            │
│          │    CROSSFADE BETWEEN SHOTS]  │            │
│          │                              │            │
│          │                              │            │
│          └──────────────────────────────┘            │
│                                                      │
│          ● ● ● ○ ○ ○ ○ ○   (photo dots)            │
│                                                      │
│     ─────────────────────────────────────            │
│                                                      │
│          Analyzing Market Data                       │
│          Querying 64,281 listings across             │
│          4 regional markets...                       │
│                                                      │
│          ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  Step 3 of 10    │
│                                                      │
│     ─────────────────────────────────────            │
│                                                      │
│          ✓ Reading Listing — 42 data points          │
│          ✓ Vehicle Identified — 992 GT3 RS PDK       │
│          ◉ Analyzing Market Data...                  │
│          ○ Computing Fair Value                      │
│          ○ Technical Deep-Dive                       │
│          ○ Investment Analysis                       │
│          ○ Due Diligence                             │
│          ○ Market Research                           │
│          ○ Buyer Services                            │
│          ○ Final Report                              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Photo Slideshow Behavior

- **Source:** `car.images[]` from the listing (typically 10-40 photos)
- **Transition:** Crossfade (1s ease) between photos every 4 seconds
- **Effect:** Subtle Ken Burns (slow zoom from 1.0x to 1.05x + slight pan) on each photo
- **Overlay:** Semi-transparent dark gradient at bottom (for text legibility)
- **Fallback:** If listing has < 3 photos, use a single photo with extended Ken Burns effect. If 0 photos, show a stylized MonzaHaus branded background.
- **Dots indicator:** Small dots showing photo position (like Instagram stories)

#### Loading Copy — Rotating Messages

Each step has a **primary status line** (what the agent is doing) plus a **secondary rotating line** that changes every 3 seconds. These secondary lines add personality and communicate depth:

**Step 1: Reading Listing**
- "Extracting every detail from the source listing..."
- "Reading seller notes, specs, and equipment list..."
- "Analyzing {photoCount} photos for condition clues..."

**Step 2: Identifying Vehicle**
- "Matching series, variant, and factory options..."
- "Cross-referencing VIN with production records..."
- "Identifying {make} {series} specifications..."

**Step 3: Market Data**
- "Querying {totalDataPoints} listings across 4 regional markets..."
- "Analyzing sold prices from BaT, Cars & Bids, RM Sotheby's..."
- "Computing cross-border arbitrage opportunities..."
- "Real transaction data — not estimates..."

**Step 4: Fair Value**
- "Applying {signalCount} detected signals as value modifiers..."
- "Computing specific-car fair value bands..."
- "Analyzing color rarity and option premiums..."

**Step 5: Technical Deep-Dive**
- "Researching {series} reliability and known issues..."
- "Analyzing production numbers for this specification..."
- "Evaluating key strengths and concerns..."

**Step 6: Investment Analysis**
- "Building your {listingType === 'auction' ? 'bidding' : 'negotiation'} strategy..."
- "Projecting ownership costs over 1, 3, and 5 years..."
- "Modeling resale value trajectories..."

**Step 7: Due Diligence**
- "Generating vehicle-specific questions for the seller..."
- "Computing risk assessment score..."
- "Building pre-purchase inspection checklist..."

**Step 8: Market Research**
- "Compiling expert opinions from automotive journalists..."
- "Analyzing owner community sentiment..."
- "Researching model heritage and significance..."

**Step 9: Buyer Services**
- "Estimating parts availability and pricing..."
- "Computing insurance cost projections..."
- "Calculating transportation and shipping options..."

**Step 10: Final Report**
- "Composing executive summary and investment thesis..."
- "Synthesizing 10 research dimensions into your verdict..."
- "Your Investment Dossier is almost ready..."

#### Claude Code Loading Words (personality touch)

Below the progress bar, a subtle italic line rotates Claude-style loading messages every 5 seconds:

- *"Thinking about what makes this one special..."*
- *"Cross-referencing auction results from three continents..."*
- *"This {series} has an interesting story..."*
- *"Checking what specialists say about this generation..."*
- *"Almost there — synthesizing everything we found..."*
- *"Your dossier is going to be thorough..."*
- *"We take this more seriously than the seller does..."*

These are playful, brand-building moments. They should feel like a knowledgeable friend is working on your behalf — not a corporate loading screen.

#### Technical Implementation

```typescript
interface GenerationStepperProps {
  carImages: string[]              // Photo URLs for slideshow
  carTitle: string                 // "2024 Porsche 911 GT3 RS"
  series: string                   // "992"
  listingType: "auction" | "classified"
  steps: GenerationStep[]
  currentStep: number
  totalDataPoints?: number         // For "Querying X listings..."
}

interface GenerationStep {
  id: string
  label: string
  sublabel: string
  status: "pending" | "in_progress" | "completed" | "failed"
  completionNote?: string          // "42 data points extracted"
  rotatingMessages: string[]       // Secondary lines that cycle
}
```

- **Component:** `src/components/report/GenerationStepper.tsx`
- **Photo preload:** Preload first 3 images on mount, lazy-load rest
- **Animations:** Framer Motion for step transitions, CSS for Ken Burns
- **Responsive:** On mobile, photo takes top 50% of screen, stepper scrolls below. On desktop, photo is left 60%, stepper is right 40%.
- **Sound:** No sound (too intrusive). Just visual.

#### Completion Transition

When Step 10 completes:
1. Final photo holds for 2 seconds with a subtle golden glow overlay
2. Text changes to: **"Your Investment Dossier is ready"** with the car title below
3. A "View Report" button fades in (large, primary color)
4. Clicking it smoothly transitions to the full report (the stepper slides up/fades out)

**States:** `○` pending → `◉` in progress (pulse animation) → `●` completed (green check) → `✗` failed (red x, with "using cached data" note)

### 5.2 Report Sections (what the user sees after generation)

The V3 report renders **22 sections** organized into 5 groups:

**Group 1: Overview**
1. Executive Summary (metrics + thesis + verdict badge)
2. Vehicle Identity (full specs from scrape)
3. Investment Story (500-800 words, not 150)

**Group 2: Valuation & Strategy**
4. Verdict Block (BUY/WATCH/WALK with strategic reasoning)
5. Bidding Strategy (auction) OR Negotiation Strategy (classified)
6. Specific-Car Fair Value (existing, with real data badge)
7. Valuation Breakdown (existing modifier waterfall)
8. Cross-Border Arbitrage (existing, from real data)

**Group 3: Intelligence**
9. Key Strengths (specific to this car)
10. Common Issues & Concerns (model-specific)
11. Production Numbers & Rarity
12. Color Intelligence (existing)
13. VIN Intelligence (existing)
14. Collector Outlook & Investment Potential

**Group 4: Market & Research**
15. Market Context (existing regional stats, from real data)
16. Comparables & Positioning (existing, from real data)
17. Expert Consensus (journalist analysis)
18. Owner Sentiment (community insights)
19. Regional Market Variations

**Group 5: Buyer's Toolkit**
20. Ownership Cost Projections (1/3/5 year)
21. Resale Timeline (1/3/5/10 year projections)
22. Questions Before You Commit (10-15 vehicle-specific)
23. Parts Availability & Costs
24. Insurance Estimates
25. Transportation & Shipping
26. Heritage (model history)
27. From the Archives (original MSRP)

**Group 6: Meta**
28. Signals Detected / What's Remarkable
29. Report Sources & Methodology
30. Report Metadata Footer

### 5.3 Data Trust Badges

Every section gets a badge indicating its data source:

- **"Verified from Data"** (green) — Section uses real transaction/listing data from our DB
  - Used by: Fair Value, Arbitrage, Market Context, Comparables, Regional Variations
- **"AI Analysis"** (blue) — Section generated by AI using knowledge + listing data
  - Used by: Technical Analysis, Heritage, Expert Consensus, Owner Sentiment
- **"AI Estimated"** (amber) — Section contains forward-looking projections
  - Used by: Ownership Costs, Resale Timeline, Insurance, Parts Pricing
- **"From Listing"** (gray) — Data extracted directly from the source listing
  - Used by: Vehicle Identity, Equipment List

---

## 6. AI Cost Estimation

### 6.1 Per-report AI calls

| Step | AI calls | Est. input tokens | Est. output tokens | Model |
|------|----------|-------------------|--------------------|-------|
| 1 (Scrape) | 0 | — | — | Scrapling |
| 2 (Vehicle ID) | 1 small | ~2K | ~500 | Gemini Flash |
| 3 (Market) | 0 | — | — | DB queries |
| 4 (Fair Value) | 1 (text extraction) | ~4K | ~2K | Gemini Flash |
| 5 (Technical) | 1 large | ~3K | ~4K | Gemini Flash |
| 6 (Investment) | 1 large | ~4K | ~4K | Gemini Flash |
| 7 (Due Diligence) | 1 medium | ~3K | ~3K | Gemini Flash |
| 8 (Research) | 1 large | ~2K | ~4K | Gemini Flash |
| 9 (Buyer Services) | 1 medium | ~2K | ~3K | Gemini Flash |
| 10 (Synthesis) | 1 medium | ~5K | ~2K | Gemini Flash |
| **Total** | **~8 AI calls** | **~25K input** | **~22K output** | |

### 6.2 Cost per report

At Gemini 2.5 Flash pricing (~$0.15/1M input, ~$0.60/1M output):
- Input: 25K tokens × $0.15/1M = $0.004
- Output: 22K tokens × $0.60/1M = $0.013
- **Total AI cost per report: ~$0.02**

At $10/report (100 Pistons), this is a **99.8% margin on AI costs**. Even if we 10x the token usage, costs remain negligible.

---

## 7. Implementation Phases

### Phase 1: Foundation (depends on V2 completion spec)
- Implement `ScrapedListingFull` scraper for report generation time
- Create `report_sections` table
- Build the progress stepper UI component
- Refactor `/api/analyze` into a multi-step orchestrator

### Phase 2: Core Agents (Steps 5-7)
- Technical Analyst agent (prompts + types + persistence)
- Investment Analyst agent (strategy + projections)
- Due Diligence agent (questions + risk scoring)

### Phase 3: Knowledge Agents (Steps 8-9)
- Market Researcher agent (expert consensus + community)
- Buyer Services agent (parts + insurance + shipping)

### Phase 4: Synthesis & Polish (Step 10)
- Final Synthesis agent
- New V3 section components for all new blocks
- PDF/Excel export updated for all new sections
- Data trust badges throughout

### Phase 5: Knowledge Base Seeding
- Pre-build model knowledge for top 27 Porsche series
- Production numbers, common issues, parts pricing by series
- This data supplements AI generation, reducing hallucination risk

---

## 8. Files Changed (New + Modified)

### New files
| File | Purpose |
|------|---------|
| `src/lib/reports/pipeline.ts` | Multi-step orchestrator |
| `src/lib/reports/agents/listingScraper.ts` | Step 1: Full listing scrape |
| `src/lib/reports/agents/vehicleIdentifier.ts` | Step 2: Vehicle identification |
| `src/lib/reports/agents/technicalAnalyst.ts` | Step 5: AI technical analysis |
| `src/lib/reports/agents/investmentAnalyst.ts` | Step 6: AI investment analysis |
| `src/lib/reports/agents/dueDiligence.ts` | Step 7: AI due diligence |
| `src/lib/reports/agents/marketResearcher.ts` | Step 8: AI market research |
| `src/lib/reports/agents/buyerServices.ts` | Step 9: AI buyer services |
| `src/lib/reports/agents/finalSynthesis.ts` | Step 10: AI synthesis |
| `src/lib/reports/agents/prompts/*.ts` | System + user prompts per agent |
| `src/lib/reports/types-v3.ts` | V3 report types |
| `src/components/report/GenerationStepper.tsx` | Progress stepper UI |
| `src/components/report/v3/*.tsx` | New section components |
| `src/components/report/DataTrustBadge.tsx` | Verified/AI-estimated badges |

### Modified files
| File | Change |
|------|--------|
| `src/app/api/analyze/route.ts` | Refactor to use pipeline orchestrator |
| `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx` | Add new section components, listing-type branching |
| `src/lib/reports/queries.ts` | Add `report_sections` CRUD |
| `src/lib/exports/pdf/renderReport.tsx` | Include V3 sections in PDF |
| `src/lib/exports/excel/renderReport.ts` | Include V3 sections in Excel |

---

## 9. Success Criteria

1. A generated report contains **22+ populated sections** (no empty/placeholder sections)
2. Generation completes in **< 30 seconds** with visible progress stepper
3. Auction listings show "Bidding Strategy"; classified listings show "Negotiation Strategy"
4. Every section displays a data trust badge (Verified / AI Analysis / AI Estimated / From Listing)
5. Real data sections (Fair Value, Comparables, Arbitrage, Market Context) show actual transaction counts
6. AI-generated sections are specific to the exact car (not generic model boilerplate)
7. Seller questions are specific and intelligent (not "has it been in an accident?" but "Given the Weissach Package delete, has the front-axle lift been retrofitted?")
8. The PDF export includes all V3 sections in a well-formatted document
9. Cost per report remains < $0.10 in AI costs
10. Scrape failure at Step 1 does not block report generation (graceful fallback)

---

## 10. What This Spec Does NOT Cover

- **Interactive "Build Your Bid" calculator** — Future feature, separate spec
- **Tier-based content gating** — All content included at 100 Pistons (no tiers)
- **Multi-make support** — Spec is Porsche-focused; architecture supports extension
- **i18n** — All new strings will be English initially (i18n tracked separately)
- **Knowledge base seeding** — Phase 5, parallel editorial track
- **V1 ReportClient removal** — Handled by the V2 completion spec
