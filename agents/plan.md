# Implementation Plan: Historical Data Collection & Status Detection

## Overview

This plan follows the LLM_FRIENDLY_PLAN_TEST_DEBUG protocol: execute feature-phases in one-shot, then run testscripts to validate.

**Total Scope:**
- 2 new files (historical scraper, model tracker)
- 3 modified files (BaT scraper, orchestrator, cron route)
- 1 optional migration (ModelBackfillState table)
- ~350 new LOC
- 0 new dependencies

---

## Phase 0: Environment Preparation

### Objective
Verify existing codebase state and ensure all prerequisites are met.

### Deliverables
- [ ] Confirm existing scrapers are functional
- [ ] Verify database connectivity
- [ ] Check test infrastructure

### Testscript: Phase 0 Verification

```typescript
// Test ID: TS-PHASE-0
// Objective: Verify environment readiness

// SETUP
// 1. Ensure DATABASE_URL is configured
// 2. Ensure dependencies installed: npm install

// RUN
// Execute verification commands:
await exec('npm run test:scrapers -- --run tests/scrapers/bringATrailer.unit.test.ts');
await exec('npx prisma validate');

// OBSERVE
// Expected: Tests pass, Prisma schema valid
// Expected: No TypeScript compilation errors

// COLLECT
// - Test output showing pass/fail status
// - Prisma validation output

// PASS CRITERIA
// - [ ] Unit tests for existing scrapers pass
// - [ ] Prisma schema validates without errors
// - [ ] TypeScript compilation succeeds
```

---

## Phase 1: Status Detection Implementation

### Objective
Add dynamic status detection (SOLD vs ACTIVE) to all three platform scrapers.

### Files to Modify
1. `src/lib/scrapers/bringATrailer.ts`
2. `src/lib/scrapers/carsAndBids.ts`
3. `src/lib/scrapers/collectingCars.ts`

### Implementation Details

**BaT Status Detection:**
```typescript
// Add to bringATrailer.ts after parsePrice function
export function detectStatusFromHtml($: cheerio.CheerioAPI, el: cheerio.Element): 'ACTIVE' | 'SOLD' {
  const $el = $(el);
  
  // Evidence-based detection
  const soldBadge = $el.find('.sold-badge, .winner-badge, [class*="sold"]').length > 0;
  const soldText = /sold|winner|final.*price/i.test($el.text());
  const bidStatus = $el.find('[class*="bid-status"]').text().toLowerCase().includes('ended');
  
  if (soldBadge || soldText || bidStatus) {
    return 'SOLD';
  }
  
  return 'ACTIVE';
}
```

**Integration:**
```typescript
// In parseAuctionCard(), replace:
// status: 'active',
// With:
status: detectStatusFromHtml($, el),
```

### LOC Budget
- Each scraper: +20-30 LOC
- Total: ~80 LOC across 3 files

### Testscript: Phase 1

```typescript
// Test ID: TS-PHASE-1
// Objective: Verify status detection works correctly

// PREREQUISITES
// - Phase 0 passed

// SETUP
// Create test HTML fixtures with SOLD and ACTIVE auctions

// RUN
// Test 1: BaT SOLD detection
const soldHtml = `
  <div class="auction-item">
    <span class="sold-badge">Sold</span>
    <a href="/listing/1990-porsche-911/">1990 Porsche 911</a>
  </div>
`;
const $sold = cheerio.load(soldHtml);
const soldStatus = detectStatusFromHtml($sold, $sold('.auction-item')[0]);
assert.equal(soldStatus, 'SOLD');

// Test 2: BaT ACTIVE detection  
const activeHtml = `
  <div class="auction-item">
    <span class="current-bid">$50,000</span>
    <a href="/listing/2020-porsche-911/">2020 Porsche 911</a>
  </div>
`;
const $active = cheerio.load(activeHtml);
const activeStatus = detectStatusFromHtml($active, $active('.auction-item')[0]);
assert.equal(activeStatus, 'ACTIVE');

// Test 3: Full parseAuctionCard integration
const auction = parseAuctionCard($sold, $sold('.auction-item')[0]);
assert.equal(auction.status, 'SOLD');

// OBSERVE
// Expected: All assertions pass
// Expected: Status correctly detected from HTML patterns

// COLLECT
// - Test execution output
// - Sample of status detection results

// PASS CRITERIA
// - [ ] SOLD auctions correctly identified
// - [ ] ACTIVE auctions correctly identified (fallback)
// - [ ] Integration with parseAuctionCard works
// - [ ] Existing tests still pass
```

---

## Phase 2: Model Tracker Implementation

### Objective
Create state management for tracking which make/model combinations need historical backfill.

### New File
`src/lib/scrapers/historical/modelTracker.ts` (~100 LOC)

### Implementation

```typescript
// src/lib/scrapers/historical/modelTracker.ts
import { prisma } from '@/lib/db/prisma';

export interface ModelIdentifier {
  make: string;
  model: string;
}

export interface BackfillState {
  status: 'pending' | 'backfilled' | 'failed';
  backfilledAt: Date | null;
  auctionCount: number;
  errorMessage: string | null;
}

/**
 * Check if a make/model combination has been backfilled.
 */
export async function getBackfillState(
  make: string,
  model: string
): Promise<BackfillState | null> {
  const state = await prisma.modelBackfillState.findUnique({
    where: { make_model: { make, model } },
  });
  
  if (!state) return null;
  
  return {
    status: state.status.toLowerCase() as BackfillState['status'],
    backfilledAt: state.backfilledAt,
    auctionCount: state.auctionCount,
    errorMessage: state.errorMessage,
  };
}

/**
 * Check if a make/model needs historical backfill.
 */
export async function needsBackfill(make: string, model: string): Promise<boolean> {
  const state = await getBackfillState(make, model);
  return !state || state.status === 'pending' || state.status === 'failed';
}

/**
 * Mark a model as pending backfill (called when new model seen in live scrape).
 */
export async function markPending(make: string, model: string): Promise<void> {
  await prisma.modelBackfillState.upsert({
    where: { make_model: { make, model } },
    update: { status: 'PENDING', updatedAt: new Date() },
    create: {
      make,
      model,
      status: 'PENDING',
    },
  });
}

/**
 * Get all models pending backfill.
 */
export async function getPendingModels(): Promise<ModelIdentifier[]> {
  const states = await prisma.modelBackfillState.findMany({
    where: { status: 'PENDING' },
    select: { make: true, model: true },
  });
  return states;
}

/**
 * Mark a model as successfully backfilled.
 */
export async function markBackfilled(
  make: string,
  model: string,
  auctionCount: number
): Promise<void> {
  await prisma.modelBackfillState.update({
    where: { make_model: { make, model } },
    data: {
      status: 'BACKFILLED',
      backfilledAt: new Date(),
      auctionCount,
      errorMessage: null,
    },
  });
}

/**
 * Mark a model as failed.
 */
export async function markFailed(
  make: string,
  model: string,
  errorMessage: string
): Promise<void> {
  await prisma.modelBackfillState.update({
    where: { make_model: { make, model } },
    data: {
      status: 'FAILED',
      errorMessage,
    },
  });
}

/**
 * Identify new models from a list of auctions and mark them pending.
 * Returns the newly marked models.
 */
export async function identifyAndMarkNewModels(
  auctions: Array<{ make: string; model: string }>
): Promise<ModelIdentifier[]> {
  const uniqueModels = new Map<string, ModelIdentifier>();
  
  for (const auction of auctions) {
    const key = `${auction.make}|${auction.model}`;
    if (!uniqueModels.has(key)) {
      uniqueModels.set(key, { make: auction.make, model: auction.model });
    }
  }
  
  const newModels: ModelIdentifier[] = [];
  
  for (const model of uniqueModels.values()) {
    const needs = await needsBackfill(model.make, model.model);
    if (needs) {
      await markPending(model.make, model.model);
      newModels.push(model);
    }
  }
  
  return newModels;
}
```

### Prisma Migration Required

```prisma
// Add to prisma/schema.prisma
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

```bash
# Generate and apply migration
npx prisma migrate dev --name add_model_backfill_state
npx prisma generate
```

### Testscript: Phase 2

```typescript
// Test ID: TS-PHASE-2
// Objective: Verify model tracker state management

// PREREQUISITES
// - Phase 1 passed
// - Migration applied

// SETUP
// Clean test data
await prisma.modelBackfillState.deleteMany();

// RUN
// Test 1: Mark pending
await markPending('Porsche', '911');
const state1 = await getBackfillState('Porsche', '911');
assert.equal(state1?.status, 'pending');

// Test 2: Check needs backfill
const needs = await needsBackfill('Porsche', '911');
assert.equal(needs, true);

// Test 3: Mark backfilled
await markBackfilled('Porsche', '911', 47);
const state2 = await getBackfillState('Porsche', '911');
assert.equal(state2?.status, 'backfilled');
assert.equal(state2?.auctionCount, 47);

// Test 4: After backfill, does not need backfill
const needsAfter = await needsBackfill('Porsche', '911');
assert.equal(needsAfter, false);

// Test 5: Identify new models from auctions
await prisma.modelBackfillState.deleteMany();
const auctions = [
  { make: 'Ferrari', model: 'F40' },
  { make: 'Ferrari', model: 'F40' }, // Duplicate
  { make: 'Lamborghini', model: 'Countach' },
];
const newModels = await identifyAndMarkNewModels(auctions);
assert.equal(newModels.length, 2); // Only unique models
assert.ok(newModels.some(m => m.make === 'Ferrari' && m.model === 'F40'));

// OBSERVE
// Expected: State transitions work correctly
// Expected: Database persistence verified

// COLLECT
// - Database query results
// - State transition logs

// PASS CRITERIA
// - [ ] Pending models correctly marked
// - [ ] Backfilled status prevents re-processing
// - [ ] Failed status allows retry
// - [ ] New model identification deduplicates
```

---

## Phase 3: Historical BaT Scraper Implementation

### Objective
Create the historical scraper that fetches 12 months of sold auctions from BaT.

### New File
`src/lib/scrapers/historical/baHistorical.ts` (~180 LOC)

### Implementation

```typescript
// src/lib/scrapers/historical/baHistorical.ts
import * as cheerio from 'cheerio';
import { prisma } from '@/lib/db/prisma';
import type { ModelIdentifier } from './modelTracker';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = 'https://bringatrailer.com';
const REQUEST_DELAY_MS = 2500;
const MAX_RETRIES = 3;
const MAX_PAGES = 10; // ~12 months typically

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistoricalAuctionRecord {
  externalId: string;
  source: 'bring_a_trailer';
  status: 'SOLD';
  make: string;
  model: string;
  variant: string | null;
  year: number | null;
  price: number | null;
  currency: string;
  mileage: number | null;
  mileageUnit: string | null;
  url: string;
  imageUrl: string | null;
  auctionDate: Date | null;
  scrapedAt: Date;
}

export interface HistoricalScrapeResult {
  auctions: HistoricalAuctionRecord[];
  errors: string[];
  totalFound: number;
  totalStored: number;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, attempt = 1): Promise<string> {
  try {
    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    
    if (response.status === 429) {
      if (attempt <= MAX_RETRIES) {
        console.log(`[Historical] Rate limited, waiting 60s (attempt ${attempt})`);
        await delay(60000);
        return fetchWithRetry(url, attempt + 1);
      }
      throw new Error('Rate limited after max retries');
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const backoff = Math.pow(2, attempt) * 1000;
      console.log(`[Historical] Retry ${attempt} after ${backoff}ms`);
      await delay(backoff);
      return fetchWithRetry(url, attempt + 1);
    }
    throw error;
  }
}

function buildSearchUrl(make: string, model: string, page: number): string {
  const params = new URLSearchParams({
    make: make.toLowerCase(),
    model: model.toLowerCase().replace(/\s+/g, '-'),
    status: 'sold',
    sort: 'date',
    page: page.toString(),
  });
  return `${BASE_URL}/search/?${params.toString()}`;
}

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseMileage(text: string): number | null {
  const cleaned = text.replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function extractExternalId(url: string): string {
  const match = url.match(/\/listing\/([^/]+)/);
  return match ? `bat-${match[1]}` : `bat-${Buffer.from(url).toString('base64').slice(0, 20)}`;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseHistoricalAuction(
  $: cheerio.CheerioAPI,
  el: cheerio.Element,
  make: string,
  model: string
): HistoricalAuctionRecord | null {
  const $el = $(el);
  
  // Extract URL
  const linkEl = $el.find('a[href*="/listing/"]').first();
  const relativeUrl = linkEl.attr('href');
  if (!relativeUrl) return null;
  
  const url = relativeUrl.startsWith('http') ? relativeUrl : `${BASE_URL}${relativeUrl}`;
  const externalId = extractExternalId(url);
  
  // Title and year
  const title = linkEl.text().trim() || $el.find('h3, h2, .title').first().text().trim();
  if (!title) return null;
  
  const yearMatch = title.match(/^(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  
  // Sold price - look for sold price indicators
  const priceText = $el.find('.sold-price, .final-price, [class*="sold"]').first().text() ||
                   $el.text().match(/\$[\d,]+/)?.[0] || '';
  const price = parsePrice(priceText);
  
  // Image
  const imageUrl = $el.find('img').first().attr('src') ||
                  $el.find('img').first().attr('data-src') ||
                  null;
  
  // Auction date - look for date indicators
  const dateText = $el.find('time, [datetime], .date').first().attr('datetime') ||
                  $el.find('time, [datetime], .date').first().text();
  let auctionDate: Date | null = null;
  if (dateText) {
    const parsed = new Date(dateText);
    if (!isNaN(parsed.getTime())) auctionDate = parsed;
  }
  
  // Mileage (if available)
  const mileageText = $el.text().match(/([\d,]+)\s*(miles?|mi|km)/i);
  const mileage = mileageText ? parseMileage(mileageText[1]) : null;
  const mileageUnit = mileageText && /km/i.test(mileageText[2]) ? 'km' : 'miles';
  
  return {
    externalId,
    source: 'bring_a_trailer',
    status: 'SOLD',
    make,
    model,
    variant: null, // Could extract from title with more logic
    year,
    price,
    currency: 'USD',
    mileage,
    mileageUnit,
    url,
    imageUrl,
    auctionDate,
    scrapedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Main scraping function
// ---------------------------------------------------------------------------

export async function fetchHistoricalAuctions(
  make: string,
  model: string,
  months: number = 12
): Promise<HistoricalScrapeResult> {
  const auctions: HistoricalAuctionRecord[] = [];
  const errors: string[] = [];
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  
  console.log(`[Historical] Starting backfill for ${make}/${model} (${months} months)`);
  
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = buildSearchUrl(make, model, page);
      console.log(`[Historical] Fetching page ${page}: ${url}`);
      
      const html = await fetchWithRetry(url);
      const $ = cheerio.load(html);
      
      // Find auction listings - BaT search results
      const listings = $('.auction-item, .listing-item, [data-auction]');
      
      if (listings.length === 0) {
        console.log(`[Historical] No more listings found on page ${page}`);
        break;
      }
      
      let pageCount = 0;
      listings.each((_, el) => {
        try {
          const auction = parseHistoricalAuction($, el, make, model);
          if (auction) {
            // Check if within date range
            if (auction.auctionDate && auction.auctionDate < cutoffDate) {
              console.log(`[Historical] Reached cutoff date at ${auction.auctionDate}`);
              return false; // Break the .each loop
            }
            auctions.push(auction);
            pageCount++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Parse error';
          errors.push(`Parse error on page ${page}: ${message}`);
        }
      });
      
      console.log(`[Historical] Page ${page}: ${pageCount} auctions parsed`);
      
      // Rate limiting between pages
      if (page < MAX_PAGES) {
        await delay(REQUEST_DELAY_MS);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Page ${page} failed: ${message}`);
      
      // If first page fails, abort
      if (page === 1) break;
    }
  }
  
  console.log(`[Historical] Fetch complete: ${auctions.length} auctions, ${errors.length} errors`);
  
  return {
    auctions,
    errors,
    totalFound: auctions.length,
    totalStored: 0, // Will be updated after storage
  };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export async function storeHistoricalAuctions(
  auctions: HistoricalAuctionRecord[]
): Promise<number> {
  let stored = 0;
  
  for (const auction of auctions) {
    try {
      // Check for duplicates
      const existing = await prisma.auction.findUnique({
        where: { externalId: auction.externalId },
      });
      
      if (existing) {
        console.log(`[Historical] Skipping duplicate: ${auction.externalId}`);
        continue;
      }
      
      // Create auction record
      const created = await prisma.auction.create({
        data: {
          externalId: auction.externalId,
          platform: 'BRING_A_TRAILER',
          title: `${auction.year} ${auction.make} ${auction.model}`,
          make: auction.make,
          model: auction.model,
          year: auction.year ?? 0,
          mileage: auction.mileage,
          mileageUnit: auction.mileageUnit ?? 'miles',
          currentBid: auction.price,
          finalPrice: auction.price,
          url: auction.url,
          images: auction.imageUrl ? [auction.imageUrl] : [],
          status: 'SOLD',
          endTime: auction.auctionDate,
          scrapedAt: auction.scrapedAt,
        },
      });
      
      // Create price history entry
      if (auction.price) {
        await prisma.priceHistory.create({
          data: {
            auctionId: created.id,
            bid: auction.price,
            timestamp: auction.auctionDate ?? auction.scrapedAt,
          },
        });
      }
      
      stored++;
    } catch (error) {
      console.error(`[Historical] Failed to store ${auction.externalId}:`, error);
    }
  }
  
  console.log(`[Historical] Stored ${stored}/${auctions.length} auctions`);
  return stored;
}

// ---------------------------------------------------------------------------
// High-level orchestration
// ---------------------------------------------------------------------------

export async function scrapeHistoricalForModel(
  model: ModelIdentifier,
  months: number = 12
): Promise<HistoricalScrapeResult> {
  console.log(`[Historical] Starting historical scrape for ${model.make}/${model.model}`);
  
  const startTime = Date.now();
  
  // Fetch auctions
  const result = await fetchHistoricalAuctions(model.make, model.model, months);
  
  // Store in database
  result.totalStored = await storeHistoricalAuctions(result.auctions);
  
  const duration = Date.now() - startTime;
  console.log(
    `[Historical] Complete for ${model.make}/${model.model}: ` +
    `${result.totalStored} stored, ${duration}ms`
  );
  
  return result;
}
```

### Testscript: Phase 3

```typescript
// Test ID: TS-PHASE-3
// Objective: Verify historical scraper functionality

// PREREQUISITES
// - Phase 2 passed
// - BaT search page accessible

// SETUP
// Use known make/model with historical data
const testModel = { make: 'Porsche', model: '911' };

// RUN
// Test 1: Build search URL
const url = buildSearchUrl('Porsche', '911', 1);
assert.ok(url.includes('make=porsche'));
assert.ok(url.includes('model=911'));
assert.ok(url.includes('status=sold'));

// Test 2: Parse historical auction (mock HTML)
const mockHtml = `
  <div class="auction-item">
    <a href="/listing/1990-porsche-911-carrera/">1990 Porsche 911 Carrera</a>
    <span class="sold-price">$85,000</span>
    <time datetime="2024-01-15T12:00:00Z">Jan 15, 2024</time>
  </div>
`;
const $ = cheerio.load(mockHtml);
const parsed = parseHistoricalAuction($, $('.auction-item')[0], 'Porsche', '911');
assert.equal(parsed?.year, 1990);
assert.equal(parsed?.price, 85000);
assert.equal(parsed?.status, 'SOLD');
assert.equal(parsed?.make, 'Porsche');

// Test 3: Store historical auctions
const testAuctions: HistoricalAuctionRecord[] = [{
  externalId: 'bat-test-historical-001',
  source: 'bring_a_trailer',
  status: 'SOLD',
  make: 'Test',
  model: 'Historical',
  variant: null,
  year: 2020,
  price: 50000,
  currency: 'USD',
  mileage: 10000,
  mileageUnit: 'miles',
  url: 'https://bringatrailer.com/listing/test-historical-001/',
  imageUrl: null,
  auctionDate: new Date('2024-01-01'),
  scrapedAt: new Date(),
}];

// Clean up test data
await prisma.auction.deleteMany({ where: { externalId: 'bat-test-historical-001' } });

const stored = await storeHistoricalAuctions(testAuctions);
assert.equal(stored, 1);

// Verify in database
const dbAuction = await prisma.auction.findUnique({
  where: { externalId: 'bat-test-historical-001' },
});
assert.ok(dbAuction);
assert.equal(dbAuction.status, 'SOLD');
assert.equal(dbAuction.finalPrice, 50000);

// Verify price history
const priceHistory = await prisma.priceHistory.findMany({
  where: { auctionId: dbAuction.id },
});
assert.equal(priceHistory.length, 1);
assert.equal(priceHistory[0].bid, 50000);

// Clean up
await prisma.priceHistory.deleteMany({ where: { auctionId: dbAuction.id } });
await prisma.auction.delete({ where: { id: dbAuction.id } });

// OBSERVE
// Expected: URL construction correct
// Expected: Parsing extracts correct data
// Expected: Storage creates Auction + PriceHistory

// COLLECT
// - Parsed auction data
// - Database query results

// PASS CRITERIA
// - [ ] URL construction works correctly
// - [ ] HTML parsing extracts all fields
// - [ ] Duplicate prevention works
// - [ ] Auction + PriceHistory stored correctly
```

---

## Phase 4: Orchestrator Integration

### Objective
Integrate historical backfill into the scraper orchestrator.

### File to Modify
`src/lib/scrapers/index.ts` (~40 LOC added)

### Implementation

```typescript
// Add to src/lib/scrapers/index.ts

import { 
  identifyAndMarkNewModels, 
  getPendingModels, 
  markBackfilled,
  markFailed 
} from './historical/modelTracker';
import { scrapeHistoricalForModel } from './historical/baHistorical';

export interface ScrapeWithBackfillResult extends ScrapeAllResult {
  historicalBackfill?: {
    modelsProcessed: number;
    totalAuctionsAdded: number;
    errors: string[];
  };
}

/**
 * Run all platform scrapers and trigger historical backfill for new models.
 */
export async function scrapeAllWithBackfill(options?: {
  maxPages?: number;
  scrapeDetails?: boolean;
  maxDetails?: number;
  enableHistorical?: boolean;
}): Promise<ScrapeWithBackfillResult> {
  // Step 1: Run live scraping
  const result = await scrapeAll(options);
  
  // Step 2: Historical backfill (if enabled)
  if (options?.enableHistorical !== false) {
    const backfillResult = await triggerHistoricalBackfill(result.auctions);
    return {
      ...result,
      historicalBackfill: backfillResult,
    };
  }
  
  return result;
}

/**
 * Trigger historical backfill for new models discovered in live scrape.
 */
export async function triggerHistoricalBackfill(
  liveAuctions: ScrapedAuction[]
): Promise<{
  modelsProcessed: number;
  totalAuctionsAdded: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let totalAuctionsAdded = 0;
  
  try {
    // Step 1: Identify new models from live auctions
    console.log('[Backfill] Identifying new models from live scrape...');
    const newModels = await identifyAndMarkNewModels(liveAuctions);
    console.log(`[Backfill] Found ${newModels.length} new models needing backfill`);
    
    if (newModels.length === 0) {
      return { modelsProcessed: 0, totalAuctionsAdded: 0, errors: [] };
    }
    
    // Step 2: Process each new model
    for (const model of newModels) {
      try {
        console.log(`[Backfill] Processing ${model.make}/${model.model}...`);
        
        const result = await scrapeHistoricalForModel(model, 12);
        
        if (result.totalStored > 0) {
          await markBackfilled(model.make, model.model, result.totalStored);
          totalAuctionsAdded += result.totalStored;
          console.log(`[Backfill] Stored ${result.totalStored} historical auctions`);
        } else {
          // Mark as backfilled even if empty (prevents re-processing)
          await markBackfilled(model.make, model.model, 0);
          console.log(`[Backfill] No historical auctions found`);
        }
        
        // Log any errors but don't fail the whole process
        errors.push(...result.errors);
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Backfill] Failed for ${model.make}/${model.model}: ${message}`);
        await markFailed(model.make, model.model, message);
        errors.push(`${model.make}/${model.model}: ${message}`);
      }
    }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backfill orchestration failed';
    console.error('[Backfill] Orchestration error:', message);
    errors.push(message);
  }
  
  return {
    modelsProcessed: newModels?.length ?? 0,
    totalAuctionsAdded,
    errors,
  };
}

// Re-export historical modules
export { scrapeHistoricalForModel } from './historical/baHistorical';
export * from './historical/modelTracker';
```

### Testscript: Phase 4

```typescript
// Test ID: TS-PHASE-4
// Objective: Verify orchestrator integration

// PREREQUISITES
// - Phase 3 passed

// SETUP
// Clean test state
await prisma.modelBackfillState.deleteMany();
await prisma.auction.deleteMany({
  where: { externalId: { startsWith: 'bat-' } },
});

// RUN
// Test 1: scrapeAllWithBackfill disabled
const resultDisabled = await scrapeAllWithBackfill({ enableHistorical: false });
assert.ok(!resultDisabled.historicalBackfill);

// Test 2: Identify and mark new models
const testAuctions: ScrapedAuction[] = [
  {
    externalId: 'bat-test-001',
    platform: 'BRING_A_TRAILER',
    title: '2020 Porsche 911',
    make: 'Porsche',
    model: '911',
    year: 2020,
    mileage: 1000,
    mileageUnit: 'miles',
    currentBid: 100000,
    bidCount: 5,
    endTime: new Date().toISOString(),
    url: 'https://test.com/1',
    imageUrl: null,
    description: null,
    sellerNotes: null,
    status: 'ACTIVE',
    vin: null,
    images: [],
  },
];

const backfillResult = await triggerHistoricalBackfill(testAuctions);

// OBSERVE
// Expected: Model marked as pending
// Expected: Historical scraping triggered (or attempted)
// Expected: Result contains metrics

// Verify state was created
const state = await prisma.modelBackfillState.findUnique({
  where: { make_model: { make: 'Porsche', model: '911' } },
});
assert.ok(state);

// COLLECT
// - Backfill result metrics
// - Database state

// PASS CRITERIA
// - [ ] New models identified correctly
// - [ ] State management integrated
// - [ ] Historical scraper called for new models
// - [ ] Metrics returned in result
```

---

## Phase 5: Cron Route Integration

### Objective
Update the cron route to trigger historical backfill after live scraping.

### File to Modify
`src/app/api/cron/route.ts` (~20 LOC added)

### Implementation

```typescript
// In src/app/api/cron/route.ts

// Replace:
// import { scrapeAll } from '@/lib/scrapers'
// With:
import { scrapeAllWithBackfill } from '@/lib/scrapers';

// In the scraping section, replace:
// const scrapeResult = await scrapeAll()
// With:
const scrapeResult = await scrapeAllWithBackfill();

// In the response, include historical backfill data:
return NextResponse.json({
  success: true,
  data: {
    scrapingResults: { 
      auctionsFound, 
      auctionsUpdated, 
      errors: errors.filter(e => !e.includes('[Backfill]')) 
    },
    historicalBackfill: scrapeResult.historicalBackfill || { modelsProcessed: 0, totalAuctionsAdded: 0 },
    marketDataUpdate: { aggregationsUpdated },
    duration: `${duration}ms`,
  },
});
```

### Testscript: Phase 5

```typescript
// Test ID: TS-PHASE-5
// Objective: Verify cron endpoint with historical backfill

// PREREQUISITES
// - Phase 4 passed
// - CRON_SECRET configured

// SETUP
// Clean state
await prisma.modelBackfillState.deleteMany();

// Create test request
const request = new Request('http://localhost:3000/api/cron', {
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
});

// RUN
const response = await GET(request);
const body = await response.json();

// OBSERVE
// Expected: Response successful
// Expected: historicalBackfill field present
// Expected: Duration reported

console.log('Response:', JSON.stringify(body, null, 2));

// PASS CRITERIA
// - [ ] Response status 200
// - [ ] success: true
// - [ ] historicalBackfill object present
// - [ ] scrapingResults present
// - [ ] Errors handled gracefully
```

---

## Phase 6: Full Integration Testing

### Objective
Run complete end-to-end test of the entire pipeline.

### Testscript: Phase 6 (Full Pipeline)

```typescript
// Test ID: TS-PHASE-6
// Objective: End-to-end validation of complete feature

// PREREQUISITES
// - All previous phases passed
// - Database accessible
// - BaT accessible (or mocked)

// SETUP
console.log('[E2E] Starting full pipeline test...');
const startTime = Date.now();

// Clean test state
await prisma.modelBackfillState.deleteMany({
  where: { make: 'Porsche' },
});

// RUN
// Step 1: Trigger cron job
const request = new Request('http://localhost:3000/api/cron', {
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
});

const response = await GET(request);
const body = await response.json();

// Step 2: Verify response structure
assert.equal(response.status, 200);
assert.equal(body.success, true);
assert.ok(body.data.scrapingResults);
assert.ok(body.data.historicalBackfill);
assert.ok(body.data.duration);

// Step 3: Verify database state
const backfillStates = await prisma.modelBackfillState.findMany();
console.log(`[E2E] Backfill states: ${backfillStates.length}`);

// Step 4: Verify historical auctions stored
const historicalAuctions = await prisma.auction.count({
  where: { status: 'SOLD' },
});
console.log(`[E2E] Historical auctions in DB: ${historicalAuctions}`);

// Step 5: Verify price history
const priceHistoryCount = await prisma.priceHistory.count();
console.log(`[E2E] Price history entries: ${priceHistoryCount}`);

const duration = Date.now() - startTime;
console.log(`[E2E] Full pipeline completed in ${duration}ms`);

// OBSERVE
// Expected: All steps complete without errors
// Expected: Response contains all expected fields
// Expected: Database populated with data

// COLLECT
// - Full response body
// - Database record counts
// - Execution duration
// - Any error messages

// PASS CRITERIA
// - [ ] Cron endpoint returns 200
// - [ ] Live scraping completes
// - [ ] Historical backfill triggers (if new models)
// - [ ] Database records created
// - [ ] No unhandled exceptions
// - [ ] Response includes all metrics

// FAIL CRITERIA (Generate failure_report.md)
// - [ ] Any assertion fails
// - [ ] Unhandled exception thrown
// - [ ] Database connection lost
// - [ ] Response missing expected fields
```

---

## Regression Test Suite

After each phase, run the existing test suite to ensure no breakage:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:scrapers
npm run test:schema
npm run test:integration
```

### Regression Checklist

- [ ] `bringATrailer.unit.test.ts` passes
- [ ] `carsAndBids.unit.test.ts` passes
- [ ] `collectingCars.unit.test.ts` passes
- [ ] `cron-pipeline.test.ts` passes
- [ ] `prisma-alignment.test.ts` passes

---

## Failure Protocol

### If Tests Fail After 2 Attempts

If any testscript fails after 2 debug iterations:

1. **Stop implementation immediately**
2. **Generate `agents/testscripts/failure_report.md`** containing:
   - Test ID that failed
   - Phase number
   - Environment matrix (OS, Node version, etc.)
   - Exact error messages
   - Observed vs expected behavior
   - Steps already attempted
   - Suspected boundary (parsing/storage/network/etc.)

3. **Request new observations** from user with specific data requirements
4. **Reformulate hypothesis** before next attempt

### Failure Report Template

```markdown
# Failure Report: TS-PHASE-{N}

## Metadata
- **Date**: {timestamp}
- **Phase**: {N}
- **Test ID**: {TS-PHASE-N}
- **Attempt**: {2}

## Environment
- OS: {platform}
- Node: {version}
- Database: {PostgreSQL version}
- BaT accessibility: {reachable/not reachable}

## Failure Summary
{One sentence description}

## Observed Behavior
{What actually happened}

## Expected Behavior
{What should have happened}

## Error Details
```
{Full error stack trace}
```

## Attempted Fixes
1. {First attempt and result}
2. {Second attempt and result}

## Suspected Root Cause
{Most likely cause}

## Required Data for Next Attempt
- [ ] Specific observation 1
- [ ] Specific observation 2

## Recommended Next Steps
{What to try next}
```

---

## Execution Order

1. **Phase 0**: Environment verification
2. **Phase 1**: Status detection (3 scrapers)
3. **Phase 2**: Model tracker + migration
4. **Phase 3**: Historical scraper
5. **Phase 4**: Orchestrator integration
6. **Phase 5**: Cron route update
7. **Phase 6**: Full integration test
8. **Regression**: Run all existing tests

**Estimated Total Time**: 2-3 hours (including tests)

---

## Success Definition

### All Phases Complete When:
- [ ] All 5 testscripts pass
- [ ] All regression tests pass
- [ ] No new dependencies added
- [ ] All files under 200 LOC
- [ ] TypeScript compiles without errors
- [ ] Cron endpoint returns expected response format

### Final Verification:
```bash
# Run complete verification
npm run build
npm test
```

---

*End of Plan*
