# Project Canon: Historical Data Collection & Status Detection

## Prime Directive

This file (`agents/canon.md`) is the **sole source of truth** for the historical data collection and status detection feature. All implementation decisions, data contracts, and architectural constraints are documented here.

---

## Project Summary

Extend the existing auction scraper system to:
1. **Detect auction status** (SOLD vs ACTIVE) from HTML during live scraping
2. **Automatically backfill historical sales data** when new make/model combinations are discovered
3. Enable comparative market analysis by building historical price baselines

**Anti-Generic Stance:** This is not a generic web scraper. It is a specialized automotive market intelligence tool with domain-specific status detection (sold badges, winning bid patterns) and intelligent historical backfill that respects rate limits while maximizing data coverage.

---

## Architecture Overview

### Vertical Slice Organization

```
src/lib/scrapers/
├── bringATrailer.ts          # Modified: Status detection added
├── carsAndBids.ts            # Modified: Status detection added  
├── collectingCars.ts         # Modified: Status detection added
├── index.ts                  # Modified: Historical trigger integration
└── historical/               # NEW: Historical scraping vertical slice
    ├── baHistorical.ts       # NEW: Historical BaT scraper (~180 LOC)
    └── modelTracker.ts       # NEW: Model backfill state management (~100 LOC)

src/app/api/cron/route.ts     # Modified: Historical backfill trigger
```

### Data Flow

```
Cron Trigger
    │
    ▼
┌─────────────────────┐
│  scrapeAll()        │  (Existing - Live scraping)
│  - Detect status    │  (NEW: Dynamic SOLD/ACTIVE)
│  - Identify new     │  (NEW: Model tracking)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  triggerHistorical  │  (NEW)
│  - Queue new models │
│  - Respect delays   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  baHistorical.ts    │  (NEW)
│  - Search BaT sold  │
│  - Parse 12 months  │
│  - Store historical │
└─────────┬───────────┘
          │
          ▼
     Database
  (Auction + PriceHistory)
```

---

## Locality Budget

| Metric | Budget | Rationale |
|--------|--------|-----------|
| **Total new files** | 2 | Feature-local vertical slice |
| **Modified files** | 3 | Minimal touch points to existing code |
| **Max LOC per file** | 200 | Single-purpose, focused modules |
| **New dependencies** | 0 | Use existing Cheerio, Prisma, fetch |
| **Total new LOC** | ~350 | Concise, explicit implementation |

---

## SECTION A: LOGIC & BEHAVIOR (Runtime Decisions)

### A1. Request Flow & State Management

**Entry Point:**
- Cron job at `GET /api/cron` triggered by scheduler
- Invokes `scrapeAll()` followed by `triggerHistoricalBackfill()`

**Request Lifecycle:**
```
1. Auth check (CRON_SECRET validation)
2. Live scrape: validate-input → fetch-HTML → detect-status → normalize → store
3. Model tracking: identify-new-make/model combinations
4. Historical backfill: build-search-URL → paginate → parse-sold → store-historical
5. Aggregation: update-market-data statistics
```

**State Storage:**
- **Make/Model backfill tracking:** Database table `ModelBackfillState` (see Data Contracts)
- **Auction records:** Existing `Auction` table
- **Price history:** Existing `PriceHistory` table
- **No in-memory state:** All state persisted to PostgreSQL

**Transaction Boundaries:**
- Per-auction upserts: Individual, non-blocking (continue on error)
- Historical batch: Per-model, wrapped in try/catch with partial failure tolerance

### A2. Error Handling & Recovery

**Error Envelope Format:**
```typescript
interface ScraperError {
  stage: 'live_scrape' | 'historical_scrape' | 'status_detection' | 'model_tracking' | 'database';
  action: 'start' | 'fetch' | 'parse' | 'store' | 'complete' | 'error';
  context?: {
    url?: string;
    make?: string;
    model?: string;
    externalId?: string;
  };
  error: string;
  timestamp: string; // ISO8601
  retryable: boolean;
}
```

**Validation:**
- Location: Boundary validation at scraper entry points
- Library: TypeScript types + runtime checks (no new validation library)
- Pattern: Explicit null checks and type guards

**Retry Strategy:**
- Network errors: 3 attempts with exponential backoff (2^attempt * 1000ms)
- Rate limit (429): Wait 60s, retry once, then abort batch
- Parse errors: No retry, log and skip

**Fallback Behavior:**
- Critical failure (DB connection): Log error, continue with next auction
- Partial historical failure: Log, mark model as failed (not backfilled), continue
- Complete failure: Return error summary in cron response, don't crash

### A3. Data Contracts & Schemas

**Schema Definition Tool:** TypeScript interfaces (co-located with feature code)

**HistoricalAuctionRecord Interface:**
```typescript
// src/lib/scrapers/historical/baHistorical.ts
export interface HistoricalAuctionRecord {
  externalId: string;           // BaT auction ID: "bat-{slug}"
  source: 'bring_a_trailer';
  status: 'SOLD';               // Historical are always sold
  make: string;                 // Normalized
  model: string;                // Normalized
  variant: string | null;       // Normalized
  year: number | null;
  price: number | null;         // Final sold price
  currency: string;             // Default 'USD'
  mileage: number | null;
  mileageUnit: string | null;
  url: string;                  // Original BaT URL
  imageUrl: string | null;
  auctionDate: Date | null;     // When it sold
  scrapedAt: Date;              // When we collected it
}
```

**ModelBackfillState Interface:**
```typescript
// src/lib/scrapers/historical/modelTracker.ts
export interface ModelBackfillState {
  id: string;                   // CUID
  make: string;
  model: string;
  status: 'pending' | 'backfilled' | 'failed';
  backfilledAt: Date | null;
  auctionCount: number;         // How many historical auctions collected
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Status Detection Contract:**
```typescript
// Evidence-based status detection
type AuctionStatus = 'ACTIVE' | 'SOLD';

interface StatusEvidence {
  source: 'badge' | 'text' | 'bid_status';
  selector: string;
  content: string;
}
```

### A4. Critical User Journeys

**Primary Happy Path (Historical Backfill):**
```
1. GET /api/cron
   → validate CRON_SECRET
2. scrapeAll() completes
   → 3 new Porsche 911 auctions found
3. modelTracker.identifyNewModels()
   → "Porsche/911" marked as new (not seen before)
4. triggerHistoricalBackfill()
   → fetch 12 months of sold Porsche 911s from BaT
5. baHistorical.fetchHistoricalAuctions('Porsche', '911', 12)
   → 47 historical auctions found
6. For each: normalize → store in Auction (status='SOLD') → PriceHistory entry
7. modelTracker.markBackfilled('Porsche', '911')
   → Status updated, auctionCount=47
8. Return: { success: true, historical: { modelsProcessed: 1, auctionsAdded: 47 } }
```

**First Decision Point (Status Detection):**
- Location: `parseAuctionCard()` in each scraper
- Branch 1: SOLD indicators found → status = 'SOLD'
- Branch 2: No SOLD indicators → status = 'ACTIVE'
- Evidence logged for debugging

**Failure Recovery Example:**
- Scenario: BaT rate limits during historical scrape
- Detection: HTTP 429 response
- Action: Wait 60s, retry once
- If still failing: Log error, mark model as 'failed', continue to next model
- No data loss: Partial results preserved, retry on next cron run

---

## SECTION B: INTERFACE & DESIGN

This feature is backend-only (no UI). No design decisions required.

---

## SECTION C: ARCHITECTURE & OPERATIONS

### C1. Environment & Configuration

**Environment Variables (existing):**
```bash
# .env.example (no changes required)
DATABASE_URL=postgresql://...
CRON_SECRET=your-secret-here
```

**No new config required** - all settings hardcoded as constants:
```typescript
// src/lib/scrapers/historical/baHistorical.ts
const HISTORICAL_MONTHS = 12;
const REQUEST_DELAY_MS = 2500;
const MAX_RETRIES = 3;
const BACKFILL_BATCH_SIZE = 50; // Max auctions per model
```

### C2. Repository Structure

**Target Structure:**
```
src/lib/scrapers/
├── bringATrailer.ts          # ~540 LOC after changes (+30)
├── carsAndBids.ts            # ~520 LOC after changes (+30)
├── collectingCars.ts         # Similar pattern (+30)
├── index.ts                  # ~200 LOC after changes (+40)
├── middleware/               # Existing
└── historical/               # NEW directory
    ├── baHistorical.ts       # ~180 LOC (NEW)
    ├── modelTracker.ts       # ~100 LOC (NEW)
    └── index.ts              # Re-exports (NEW, ~10 LOC)

src/app/api/cron/route.ts     # ~230 LOC after changes (+20)
```

**File Size Limits:**
- Soft limit: 300 LOC
- Hard limit: 500 LOC (split if exceeded)
- Current files within limits

### C3. Dependency Management

**Zero new dependencies.** Existing stack:
- `cheerio` - HTML parsing (already installed)
- `@prisma/client` - Database access (already installed)
- Native `fetch` - HTTP requests (built-in)

**Justification for zero additions:**
- All requirements met by existing dependencies
- No HTTP client needed (native fetch sufficient)
- No additional parsing needed (Cheerio handles all HTML)
- No date library needed (native Date sufficient for 12-month window)

### C4. Build & Development

**Existing commands (unchanged):**
```bash
npm install      # Installs deps
npm run dev      # Starts dev server (port 3000)
npm run build    # Production build
npm test         # Runs vitest
npm start        # Production server
```

**Dev server:** Port 3000 (Next.js default)

### C5. Testing Infrastructure

**Test Framework:** vitest (already configured)

**Test File Pattern:** Co-located or in `/tests/scrapers/`

**New Test Files Required:**
1. `tests/scrapers/historical/baHistorical.test.ts` - Unit tests for parsing
2. `tests/scrapers/historical/modelTracker.test.ts` - Unit tests for state management
3. Integration test updates in `tests/integration/cron-pipeline.test.ts`

**Required Test Types:**
- **Unit:** Status detection logic, HTML parsing functions
- **Integration:** Full cron pipeline with historical backfill
- **Contract:** Database schema alignment verification

### C6. Logging & Observability

**Logging Library:** `console.*` with structured prefixes (existing pattern)

**Log Format:**
```typescript
// Structured logging at each stage
console.log('[Historical] Starting backfill for Porsche/911');
console.log('[Historical] Fetched page 1: 24 auctions found');
console.error('[Historical] Parse error for bat-1990-911: Invalid price format');
console.log('[Historical] Backfill complete: 47 auctions stored');
```

**Log Levels Used:**
- `log`: Progress milestones
- `error`: Parse failures, network errors, DB errors
- No `warn` (use error with retryable flag)

**Correlation ID:** Request-level logging via cron job timestamp

### C7. Security Baseline

**Secrets Management:**
- CRON_SECRET from env vars (existing)
- No new secrets required

**Input Sanitization:**
- All HTML parsed through Cheerio (escapes by default)
- URL construction uses URLSearchParams
- No user-provided input in SQL (Prisma parameterized queries)

**Rate Limiting & Ethics:**
- 2.5s delay between requests (configurable)
- Exponential backoff on errors
- Max 12 months historical data (respectful scope)
- User-Agent header identifies scraper

### C8. Database Schema (Minimal Migration)

**Required Prisma Addition:**
```prisma
// Add to schema.prisma
model ModelBackfillState {
  id            String   @id @default(cuid())
  make          String
  model         String
  status        BackfillStatus @default(PENDING)
  backfilledAt  DateTime?
  auctionCount  Int      @default(0)
  errorMessage  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([make, model])
  @@index([status])
}

enum BackfillStatus {
  PENDING
  BACKFILLED
  FAILED
}
```

**Note:** Migration required for ModelBackfillState table only.

### C9. Rollback Safety

**Feature Flags (implicit):**
- Can disable by commenting out `triggerHistoricalBackfill()` call
- Historical data distinguishable via `metadata` (not yet implemented - use `scrapedAt` vs `endTime` comparison)
- No destructive operations to existing tables

**Recovery Procedures:**
- Delete `ModelBackfillState` records to re-trigger backfill
- Historical auctions can be deleted by `externalId` pattern if needed

---

## Implementation Constraints

### Technical Constraints
- **Zero new dependencies** (mandatory)
- **Use existing patterns** (delay, error handling, fetch wrappers)
- **12-month historical window** (configurable constant)
- **Rate limiting: 2-3s delays** (non-negotiable)

### Quality Constraints
- All files < 200 LOC
- Explicit TypeScript types for all functions
- Error handling at every boundary
- Structured logging at each stage

### Non-Goals (Out of Scope)
1. Historical data from C&B or CC (BaT only)
2. Admin dashboard for manual triggers
3. Real-time price alerts
4. Data visualization
5. Image downloads (URLs only)
6. Bid history tracking
7. Seller/buyer information
8. IP rotation or proxy support

---

## Code Constitution

### LLM-Friendly Principles Applied

**1. Locality Over Abstraction**
- Historical scraping logic co-located in `historical/` directory
- Model tracking state adjacent to historical scraper
- Status detection functions inline in scraper files (not extracted prematurely)

**2. Feature-Based Vertical Slices**
- `baHistorical.ts`: Contains fetch, parse, normalize, store for historical data
- `modelTracker.ts`: State management for backfill tracking
- Each file is a complete feature slice with minimal external dependencies

**3. Vanilla-First Mandate**
- No new HTTP libraries (native fetch)
- No new parsing libraries (existing Cheerio)
- No date libraries (native Date for 12-month calculations)
- No validation libraries (TypeScript + runtime guards)

**4. Explicit Contracts**
- TypeScript interfaces at file top
- Function signatures with explicit return types
- Error envelopes with structured context

**5. Stateless Where Possible**
- `baHistorical.ts`: Stateless functions, database as single source of truth
- `modelTracker.ts`: Database-backed state (no in-memory caches)
- Cron job: Stateless request handler

**6. Rule of Three**
- Status detection: Initially inline in each scraper
- If pattern stabilizes after 3 platforms, consider extraction to shared utility
- Historical scraping: BaT-specific, no premature abstraction for C&B/CC

**7. Thin Adapters**
- Cheerio wrapper: Existing pattern in scrapers
- Prisma client: Existing singleton in `lib/db/prisma.ts`

**8. Deterministic Builds**
- No new dependencies to install
- Existing package-lock.json unchanged
- No build configuration changes

---

## Success Metrics

**Functional:**
- [ ] BaT scraper correctly detects SOLD vs ACTIVE status
- [ ] New make/model triggers historical backfill
- [ ] 12 months of historical data collected for new models
- [ ] Rate limiting enforced (2-3s gaps in logs)
- [ ] Errors logged but pipeline continues

**Quality:**
- [ ] All new files < 200 LOC
- [ ] Zero new dependencies
- [ ] Existing tests still pass
- [ ] TypeScript compiles without errors

**Observability:**
- [ ] Logs show status detection decisions
- [ ] Logs show historical backfill progress
- [ ] Cron response includes historical metrics

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-14 | 1.0 | Initial canonical architecture definition |

---

*End of Canon*
