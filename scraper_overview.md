# Scraper Architecture Overview

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    ENTRY POINTS                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌─────────────────────────────────────────┐    ┌─────────────────────────────┐    │
│   │           CLI (ferrari_collector)       │    │      Cron API              │    │
│   │  src/features/ferrari_collector/cli.ts  │    │  src/app/api/cron/route.ts │    │
│   └─────────────────────┬───────────────────┘    └──────────────┬──────────────┘    │
│                         │                                         │                  │
│   --mode=daily         │                                         │                  │
│   --mode=backfill      │                                         │                  │
│                         │                                         │                  │
└─────────────────────────┼─────────────────────────────────────────┼──────────────────┘
                          │                                         │
                          ▼                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          FERRARI COLLECTOR                                          │
│                    (Ferrari-specific, Supabase-focused)                             │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │  src/features/ferrari_collector/                                              │  │
│  │                                                                              │  │
│  │  ┌─────────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐ ┌────────┐  │  │
│  │  │ collector.ts │ │ discover │ │ normalize  │ │ supabase_    │ │ cli.ts │  │  │
│  │  │  Orchestrates│ │ Filters  │ │ Transforms │ │ writer.ts    │ │ Entry  │  │  │
│  │  │  all sources │ │ Ferrari  │ │ to schema  │ │ Upserts data │ │ point  │  │  │
│  │  └──────┬──────┘ └────┬─────┘ └──────┬─────┘ └───────┬───────┘ └────────┘  │  │
│  │         │            │             │               │                         │  │
│  │         │            ▼             │               ▼                         │  │
│  │         │    Keeps only Ferrari    │      Supabase (listings, photos)        │  │
│  │         │                          │                                        │  │
│  └─────────┼──────────────────────────┼────────────────────────────────────────┘  │
│            │                          │                                           │
│            ▼                          ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                     PLATFORM SCRAPERS (Used by ferrari_collector)           │   │
│  │  ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐  │   │
│  │  │ bringATrailer.ts    │ │ carsAndBids.ts      │ │ collectingCars.ts   │  │   │
│  │  │                     │ │                     │ │                     │  │   │
│  │  │ scrapeBringATrailer │ │ scrapeCarsAndBids   │ │ scrapeCollectingCars│  │   │
│  │  │ parseAuctionCard    │ │ parseAuctionCard    │ │ parseAuctionCard    │  │   │
│  │  │ scrapeDetail        │ │ scrapeDetail        │ │ scrapeDetail        │  │   │
│  │  └─────────────────────┘ └─────────────────────┘ └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│            │                          │                                           │
│            ▼                          ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │              ALTERNATIVE: Generic Scraper (NOT used by ferrari_collector)    │   │
│  │  src/lib/scraper.ts                                                         │   │
│  │  - Simple cheerio-based price/status extraction                              │   │
│  │  - 24hr in-memory cache                                                    │   │
│  │  - Used for quick price lookups, not production data collection             │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Code Map

### Entry Points

| File | Purpose | Usage |
|------|---------|-------|
| `src/features/ferrari_collector/cli.ts` | CLI entry point | `npx tsx src/features/ferrari_collector/cli.ts --mode=daily` |
| `src/app/api/cron/route.ts` | Cron API endpoint | Automated daily scraping via cron job |

### Ferrari Collector (`src/features/ferrari_collector/`)

| File | Purpose |
|------|---------|
| `collector.ts` | Main orchestrator - coordinates scraping, filtering, normalization, and writing |
| `cli.ts` | CLI argument parsing and run execution |
| `discover.ts` | Filters listings to keep only Ferrari vehicles |
| `normalize.ts` | Transforms raw scraper output to Supabase schema |
| `supabase_writer.ts` | Upserts data to Supabase (listings, photos tables) |
| `checkpoint.ts` | Pagination checkpointing for resumable runs |
| `net.ts` | Rate limiting, retry logic, HTTP utilities |
| `types.ts` | TypeScript type definitions |
| `logging.ts` | Structured JSON logging |

### Platform Scrapers (`src/lib/scrapers/`)

| File | Platform | Exports |
|------|----------|---------|
| `bringATrailer.ts` | Bring a Trailer | `scrapeBringATrailer`, `parseAuctionCard`, `scrapeDetail` |
| `carsAndBids.ts` | Cars & Bids | `scrapeCarsAndBids`, `parseAuctionCard`, `scrapeDetail` |
| `collectingCars.ts` | Collecting Cars | `scrapeCollectingCars`, `parseAuctionCard`, `scrapeDetail` |
| `index.ts` | Orchestrator | `scrapeAll`, `scrapePlatform`, `scrapeAllWithBackfill` |

### Alternative Scraper (`src/lib/scraper.ts`)

| File | Purpose |
|------|---------|
| `scraper.ts` | Simple zero-cost scraper with cheerio, 24hr cache |

---

## Scraping Flows

### Flow 1: Daily Incremental Sync

```
CLI (--mode=daily)
    │
    ▼
collector.ts::runFerrariCollector()
    │
    ├─► For each source (BaT, CarsAndBids, CollectingCars)
    │       │
    │       ▼
    │   scrapeActiveListings() ──► scrapeBringATrailer/scrapeCarsAndBids/scrapeCollectingCars
    │       │                               │
    │       │                               ▼
    │       │                           Listing pages (maxPages)
    │       │                           Returns: url, title, make, model, year, mileage, endTime
    │       │
    │       ▼
    │   discoverFerrariListingUrls() ──► Filters for Ferrari only
    │       │
    │       ▼
    │   For each Ferrari listing
    │       │
    │       ├─► fetchAuctionData() ──► Basic data (title, price, status, endTime)
    │       │
    │       ├─► scrapeDetail() (optional) ──► Full details: VIN, engine, transmission, colors, images
    │       │
    │       ▼
    │   normalize.ts ──► Transforms to Supabase schema
    │       │
    │       ▼
    │   supabase_writer.ts::upsertAll() ──► Writes to listings, photos tables
    │       │
    │       ▼
    │   checkpoint.ts::saveCheckpoint() ──► Saves pagination state
    │
    ▼
Result: { runId, sourceCounts, errors }
```

**Command:**
```bash
npx tsx src/features/ferrari_collector/cli.ts --mode=daily
```

**What it does:**
- Scrapes active listings from all 3 platforms
- Filters for Ferrari only
- Fetches basic auction data
- Optionally fetches full detail (VIN, images, etc.)
- Writes to Supabase
- Checkpoints pagination state

---

### Flow 2: Historical Backfill

```
CLI (--mode=backfill --dateFrom=YYYY-MM-DD --dateTo=YYYY-MM-DD)
    │
    ▼
collector.ts::runFerrariCollector()
    │
    ├─► For each source
    │       │
    │       ▼
    │   scrapeEndedListings() ──► Paginates through ended auctions
    │       │                    within date range
    │       │
    │       ▼
    │   discoverFerrariListingUrls() ──► Filters for Ferrari
    │       │
    │       ▼
    │   Same as daily: fetch → normalize → write
    │
    ▼
Result: Backfilled historical data
```

**Command:**
```bash
npx tsx src/features/ferrari_collector/cli.ts \
  --mode=backfill \
  --dateFrom=2026-01-01 \
  --dateTo=2026-01-07
```

**What it does:**
- Scrapes ended/completed listings within date range
- Backfills historical Ferrari sales data
- Respects checkpoint state for resumability

---

### Flow 3: Cron API (All Platforms)

```
Cron Job (scheduled)
    │
    ▼
src/app/api/cron/route.ts
    │
    ▼
scrapeAllWithBackfill() ──► src/lib/scrapers/index.ts
    │
    ├─► scrapeBringATrailer()
    ├─► scrapeCarsAndBids()
    └─► scrapeCollectingCars()
        │
        ▼
    For each auction
        │
        ▼
    prisma.auction.upsert() ──► Writes to database
```

**What it does:**
- Runs all platform scrapers in parallel
- Different from ferrari_collector (no Ferrari filter, writes to different schema)
- Uses Prisma instead of Supabase client

---

## Data Output

### Ferrari Collector → Supabase

| Table | Fields |
|-------|--------|
| `listings` | source, source_id, source_url, year, make, model, trim, body_style, color_exterior, color_interior, mileage, mileage_unit, vin, hammer_price, original_currency, country, region, city, auction_house, auction_date, sale_date, status, photos_count, description_text, scrape_timestamp |
| `photos` | listing_id, url, order |

### Cron API → Prisma

| Model | Fields |
|-------|--------|
| `auction` | externalId, platform, title, make, model, year, mileage, mileageUnit, transmission, engine, exteriorColor, interiorColor, location, currentBid, bidCount, endTime, url, imageUrl, description, sellerNotes, status, vin, images, scrapedAt |
| `priceHistory` | auctionId, bid, recordedAt |
| `marketData` | make, model, yearStart, yearEnd, avgPrice, lowPrice, highPrice, totalSales |

---

## Key Differences

| Aspect | Ferrari Collector | Cron API |
|--------|-------------------|-----------|
| Scope | Ferrari only | All makes |
| Output | Supabase | Prisma/Database |
| Filtering | Ferrari filter | None |
| Checkpointing | Yes | No |
| Use case | Ferrari-focused data | Full platform data |

---

## Running the Scrapers

### Daily Ferrari Sync
```bash
npx tsx src/features/ferrari_collector/cli.ts --mode=daily
```

### Historical Backfill
```bash
npx tsx src/features/ferrari_collector/cli.ts \
  --mode=backfill \
  --dateFrom=2026-01-01 \
  --dateTo=2026-01-07
```

### Dry Run (no writes)
```bash
npx tsx src/features/ferrari_collector/cli.ts --mode=daily --dryRun
```

### Disable Detail Scraping
```bash
npx tsx src/features/ferrari_collector/cli.ts --mode=daily --noDetails
```
