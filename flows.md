# 🌊 Monza Lab — User & Data Flows

This document outlines the core operational flows of the Monza Lab platform, detailing how data moves from external auction platforms to the user's screen through our AI analysis engine.

---

## 1. User Authentication & Onboarding
How a new user enters the ecosystem and receives their starting analysis credits.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Supabase
    participant API
    participant DB

    User->>Frontend: Clicks "Sign In / Sign Up"
    Frontend->>Supabase: Auth Request (Email/OAuth)
    Supabase-->>Frontend: Auth Token / Session
    Frontend->>API: GET /api/user/profile (triggered by state change)
    API->>DB: getOrCreateUser(supabaseId)
    alt New User
        DB-->>API: Create User + Grant 3 FREE Credits
        DB->>DB: Record Transaction (FREE_MONTHLY)
    else Existing User
        API->>DB: Check if monthly credit reset due
        DB-->>API: Return existing profile + credits
    end
    API-->>Frontend: Profile Data (credits, tier, analzedAuctions[])
    Frontend-->>User: Show Dashboard + Credit Count
```

---

## 2. Auction Discovery Flow
Monza uses a "Dual-Stream" data strategy to ensure the app is never empty.

```mermaid
graph TD
    A[User visits Dashboard/Browser] --> B{Fetch Source}
    B -->|Stream 1| C[Static Curated Data]
    B -->|Stream 2| D[Live PostgreSQL Data]
    
    C --> E[curatedCars.ts]
    C --> F[featuredAuctions.ts]
    
    D --> G[Scraped via Cron]
    D --> H[Market Aggregates]

    E & F & G & H --> I[Unified API Interface]
    I --> J[Next.js Client Components]
    J --> K[User View]
```

---

## 3. AI Analysis & Credit Flow
The "Brain" of the operation. This flow manages cost-intensive AI calls through caching and credits.

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant DB
    participant Claude

    User->>Client: Clicks "Analyze Vehicle"
    Client->>API: POST /api/analyze {auctionId}
    API->>DB: Verify Auth & User Credits
    
    API->>DB: Check Cache (Analysis < 24h old?)
    alt Cache Hit
        DB-->>API: Return Cached Analysis
        API-->>Client: Analysis Result (0 credits used)
    else Cache Miss
        API->>DB: Has User already analyzed this ID?
        alt Already Analyzed
            API->>Claude: Run Analysis (Free re-access)
        else First Time
            DB-->>API: Balance >= 1?
            API->>DB: Deduct 1 Credit
            API->>Claude: Run Analysis (Prompt + Market Data)
        end
        Claude-->>API: JSON Analysis
        API->>DB: Save Analysis + Record History
        API-->>Client: Analysis Result + Updated Credits
    end
```

---

## 4. Automatic Data Ingestion (The Cron)
How the system stays fresh without manual intervention.

```mermaid
graph LR
    Trigger[Vercel Cron Trigger] --> API[/api/cron]
    API -->|Auth: Bearer Token| ScraperMgr[Scraper Manager]
    
    subgraph Platforms
        ScraperMgr --> BaT[Bring a Trailer Scraper]
        ScraperMgr --> CB[Cars & Bids Scraper]
        ScraperMgr --> CC[Collecting Cars Scraper]
    end
    
    BaT & CB & CC -->|Raw JSON| DBUpdate[Upsert to DB]
    DBUpdate --> History[Record Price History]
    History --> Calc[Recalculate MarketData]
    Calc -->|Avg/Low/High| FinalDB[(PostgreSQL)]
```

---

## 5. Search & Filtering Logic
How users find specific investment-grade assets.

1.  **Query Input**: User types in Search Bar (debounced 300ms).
2.  **API Routing**: Request hits `/api/auctions?q=...&make=...&year=...`.
3.  **Unified Search**:
    *   Search `CURATED_CARS` array (high performance, client-ready).
    *   Search `PostgreSQL` using ORM `contains` and `insensitive` filters.
4.  **Ranking**: 
    *   Priority 1: Matches in Curated list.
    *   Priority 2: Live matches sorted by `endTime` (Ending Soonest).
5.  **Render**: Results mapped to common `AuctionCard` components.

---

## 6. Credit Reset Engine (Internal)
Monza operates on a freemium model.

*   **Frequency**: Monthly.
*   **Trigger**: User profile access (Lazy Reset).
*   **Logic**: 
    *   If `currentDate` > `creditResetDate`:
    *   Set `creditsBalance` = 3 (Free Tier).
    *   Set `creditResetDate` = `currentDate + 1 month`.
    *   Log `TransactionType.FREE_MONTHLY`.
