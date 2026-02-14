# Negentropized Instructions: Historical Data Collection & Status Detection

## Executive Summary

Extend the existing working auction scraper system to:
1. **Detect auction status** (SOLD vs ACTIVE) from HTML during live scraping
2. **Automatically backfill historical sales data** when new make/model combinations are discovered
3. Maintain zero new dependencies while leveraging existing Prisma schema and Cheerio infrastructure

This enables comparative market analysis by building historical price baselines for each vehicle model.

---

## 1. Goal

Extend the existing auction scraper system to detect auction status (SOLD/ACTIVE) during live scraping and automatically collect 12 months of historical sales data from Bring a Trailer for newly discovered make/model combinations, storing results in the existing Auction and PriceHistory tables.

---

## 2. Primary User / Actor

- **Cron Job** (`/src/app/api/cron/route.ts`) - Automated scheduler that triggers scraping
- **Scraper Orchestrator** (`/src/lib/scrapers/index.ts`) - Coordinates live and historical scraping
- **Database** - Receives and stores auction records with status and price history

---

## 3. Inputs

### Required Inputs
- **Live auction listings** from BaT, C&B, CC HTML pages
- **Existing database state** (Auction, PriceHistory, MarketData tables)
- **Make/Model normalization logic** from existing scrapers

### Optional Inputs
- **Historical page range** - Default: 12 months of historical data
- **Rate limiting config** - Default: 2-3s between requests
- **Retry configuration** - Default: 3 attempts with exponential backoff

---

## 4. Outputs / Deliverables

### New Files (2)
1. **`src/lib/scrapers/historical/baHistorical.ts`**
   - Purpose: Scrapes historical "Sold" auctions from BaT
   - Key functions:
     - `fetchHistoricalAuctions(make: string, model: string, months: number)`
     - `parseHistoricalAuctionPage(html: string)`
     - `normalizeHistoricalAuction(raw: RawAuction): AuctionRecord`
   - LOC: ~150-200

2. **`src/lib/scrapers/historical/modelTracker.ts`**
   - Purpose: Tracks which models need historical backfill
   - Key functions:
     - `getModelsNeedingBackfill(): Promise<Model[]>`
     - `markModelBackfilled(make: string, model: string)`
     - `isNewModel(make: string, model: string): Promise<boolean>`
   - LOC: ~80-120

### Modified Files (3)
3. **`src/lib/scrapers/bringATrailer.ts`**
   - Change: Replace `status: 'active'` with dynamic detection
   - Add: `detectStatusFromHtml(html: string): 'active' | 'sold'`
   - LOC delta: +20-30

4. **`src/lib/scrapers/index.ts`**
   - Add: Integration point for historical scraping after live scrape completes
   - Add: `triggerHistoricalBackfill()` orchestration function
   - LOC delta: +30-50

5. **`src/app/api/cron/route.ts`**
   - Add: Call to historical backfill after live scraping finishes
   - LOC delta: +10-15

### Database Artifacts
- **Auction table** records with `status: 'SOLD'` for historical data
- **PriceHistory table** entries for each historical sale
- **MarketData table** aggregated statistics updated

---

## 5. Core Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 1: LIVE SCRAPING (Existing)                                   │
├─────────────────────────────────────────────────────────────────────┤
│ 1.1 Cron job triggers scraper orchestrator                          │
│ 1.2 BaT scraper fetches live listings                               │
│ 1.3 FOR EACH listing:                                               │
│     - Parse HTML for auction details                                │
│     → NEW: Extract status from HTML (sold-badge, bid-status, etc.)  │
│     - Normalize make/model/variant                                  │
│     → NEW: Check if make/model is new (needs backfill)              │
│     - Store in Auction table                                        │
│ 1.4 C&B and CC scrapers run similarly                               │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 2: HISTORICAL BACKFILL TRIGGER (New)                          │
├─────────────────────────────────────────────────────────────────────┤
│ 2.1 After live scraping completes                                   │
│ 2.2 Query for models marked as "new" in this run                    │
│ 2.3 FOR EACH new model:                                             │
│     - Check if already backfilled                                   │
│     - If not, queue for historical scraping                         │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 3: HISTORICAL DATA COLLECTION (New)                           │
├─────────────────────────────────────────────────────────────────────┤
│ 3.1 FOR EACH queued model:                                          │
│     - Build BaT search URL with make/model filters                  │
│     - Fetch paginated results (respecting 12-month window)          │
│     - FOR EACH historical listing:                                  │
│         - Parse "Sold" price and date                               │
│         - Normalize to Auction record with status='SOLD'            │
│         - Insert into Auction table                                 │
│         - Create PriceHistory entry                                 │
│     - Mark model as backfilled                                      │
│     - Apply 2-3s delay between requests                             │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 4: AGGREGATION (Existing, triggered)                          │
├─────────────────────────────────────────────────────────────────────┤
│ 4.1 Update MarketData aggregations                                  │
│ 4.2 Recalculate price statistics with new historical data           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Data / Evidence Contracts

### Auction Record Schema (for historical data)
```typescript
interface HistoricalAuctionRecord {
  externalId: string;           // BaT auction ID
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
  metadata: {
    isHistorical: true;
    backfilledAt: Date;
    sourceQuery: string;        // Make/Model query used
  };
}
```

### PriceHistory Entry
```typescript
interface HistoricalPriceEntry {
  auctionId: string;            // FK to Auction
  price: number;
  currency: string;
  recordedAt: Date;             // Auction end date
  metadata: {
    source: 'bring_a_trailer_historical';
    backfillBatch: string;      // UUID for this backfill session
  };
}
```

### Evidence Requirements for Status Detection
- **SOLD detection**: Must find at least one of:
  - Element with class containing "sold" or "winner"
  - Text containing "sold for $" or "winning bid"
  - Bid status indicating auction completion
- **ACTIVE detection**: Default fallback when SOLD indicators absent

---

## 7. Constraints

### Technical Constraints
- **Stack**: Node.js, TypeScript, Next.js App Router
- **Database**: PostgreSQL via Prisma ORM
- **Scraping**: Cheerio for HTML parsing (existing)
- **HTTP**: Native fetch API (no new HTTP libraries)

### Rate Limiting & Ethics
- **Delay between requests**: 2000-3000ms minimum
- **Exponential backoff**: 2^attempt * 1000ms on 429/5xx errors
- **Max retries**: 3 attempts per request
- **Respect robots.txt**: Do not scrape if BaT blocks

### Data Constraints
- **Historical window**: Maximum 12 months of data
- **Storage**: Use existing tables, no schema changes
- **Status**: Historical records ALWAYS status='SOLD'

### Quality Constraints
- **Duplicate prevention**: Check `externalId` before insert
- **Data validation**: Price must be numeric > 0, date must be parseable
- **Partial failure acceptable**: Log errors, continue with next model

---

## 8. Non-Goals / Backlog

Explicitly OUT OF SCOPE for this implementation:

1. **Historical data from C&B or CC** - Only BaT has accessible historical archive
2. **Admin dashboard** for triggering backfills - Only automatic discovery
3. **Real-time price alerts** - Only batch historical collection
4. **Data visualization** - Raw data collection only
5. **Auction image downloads** - URLs only, no binary storage
6. **Bid history tracking** - Final price only, not bidding progression
7. **Seller/buyer information** - Vehicle data only
8. **Automatic retry on failure** - Retry on next cron run is acceptable
9. **Rate limiting by IP rotation** - Single origin with polite delays only
10. **Schema migrations** - Work within existing tables

---

## 9. Definition of Done

### Functional Verification
- [ ] BaT scraper correctly detects SOLD vs ACTIVE status on live listings
- [ ] C&B scraper correctly detects SOLD vs ACTIVE status on live listings
- [ ] CC scraper correctly detects SOLD vs ACTIVE status on live listings
- [ ] When new make/model seen live, system identifies it as "needs backfill"
- [ ] Historical scraper fetches 12 months of BaT sold auctions for new model
- [ ] Historical data stored with status='SOLD' in Auction table
- [ ] PriceHistory entries created for each historical sale
- [ ] Model marked as "backfilled" to prevent duplicate collection
- [ ] Rate limiting enforced (2-3s delays visible in logs)
- [ ] Errors logged but don't crash the pipeline

### Code Quality
- [ ] All new files < 200 LOC
- [ ] No new dependencies added
- [ ] Existing scraper logic not broken
- [ ] TypeScript types defined for all functions
- [ ] Error handling with explicit try/catch at boundaries
- [ ] Logging at each stage (start, progress, completion, error)

### Testing Verification
- [ ] Manual test: Run cron job, verify status detection on known SOLD auction
- [ ] Manual test: Delete a model's backfill marker, re-run, verify re-collection
- [ ] Check database: Historical records have correct status, dates, prices
- [ ] Verify rate limiting: Check timestamps in logs show 2-3s gaps

### Rollback Safety
- [ ] Can disable historical scraping by not calling `triggerHistoricalBackfill()`
- [ ] Historical data distinguishable from live via `metadata.isHistorical` flag
- [ ] No destructive operations to existing Auction/PriceHistory records

---

## Implementation Notes

### Key Integration Points

1. **Status Detection in BaT** (line ~328):
```typescript
// Current (hardcoded):
status: 'active',

// New (dynamic):
status: detectStatusFromHtml(itemHtml),
```

2. **Historical Trigger** (in `/src/lib/scrapers/index.ts`):
```typescript
// After live scrape completes
const newModels = await modelTracker.getModelsNeedingBackfill();
for (const model of newModels) {
  await baHistorical.scrapeHistoricalForModel(model);
  await modelTracker.markModelBackfilled(model.make, model.model);
}
```

3. **BaT Historical URL Pattern**:
```
https://bringatrailer.com/search/?make={make}&model={model}&status=sold&sort=date&page={n}
```

### Error Handling Strategy
- **Network errors**: Retry 3x with exponential backoff, then log and skip
- **Parse errors**: Log malformed HTML, skip record, continue
- **Database errors**: Transaction rollback, log error, skip model
- **Rate limit (429)**: Wait 60s, retry once, then abort batch

### Logging Contract
```typescript
// Each stage emits structured log:
{
  stage: 'historical_scrape' | 'status_detection' | 'model_tracking',
  action: 'start' | 'progress' | 'complete' | 'error',
  model?: { make: string, model: string },
  count?: number,
  error?: string,
  timestamp: ISO8601
}
```

---

## Total Scope Summary

| Metric | Value |
|--------|-------|
| **New files** | 2 (historical scraper, model tracker) |
| **Modified files** | 3 (BaT scraper, orchestrator, cron) |
| **Estimated new LOC** | 300-400 |
| **New dependencies** | 0 |
| **Database migrations** | 0 (use existing schema) |
| **Breaking changes** | 0 |
| **Rollback complexity** | Low (feature-flag by not calling trigger) |

---

*Instruction stabilized. Ready for INSTRUCT handoff.*
