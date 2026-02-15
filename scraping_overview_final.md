# Scraping Pipeline Overview

## Architecture

The Ferrari collector pipeline scrapes auction data from Bring a Trailer (BaT) and writes it to Supabase across 8 tables. There are three execution modes: **live collection** (active + recently sold listings), **historical backfill** (sold listings going back ~1 year, manual CLI), and **light backfill** (last 30 days of sold listings, automated daily via cron).

### Data Flow

```
BaT Website
    |
    v
Discovery (model index pages + embedded JSON)
    |
    v
scrapeDetail() — individual listing pages
    |
    v
Normalization (NormalizedListing)
    |
    v
writer.upsertAll() — writes to all 8 Supabase tables
```

### Daily Cron Flow (`/api/cron/ferrari` — midnight UTC)

```
Step 1: refreshActiveListings()
    - Query all status='active' listings
    - Re-scrape each to detect ended auctions
    - Update status to sold/unsold + set hammer_price
    |
    v
Step 2: runCollector({ mode: "daily" })
    - Scrape active listings from BaT, CarsAndBids, CollectingCars
    - Discover from model index pages
    - Terminal status guard: skip listings already sold/unsold/delisted
    - Normalize + write to all 8 tables
    |
    v
Step 3: runLightBackfill({ windowDays: 30 })
    - Query DB for every distinct Ferrari model (fully dynamic)
    - For each model: derive BaT slug (override table or auto: lowercase+hyphens)
    - Fetch BaT model page, extract sold listings from embedded JSON
    - Filter to last 30 days, skip already-ingested (batch source_id check)
    - scrapeDetail() for up to 3 new listings per model
    - Normalize + write to all 8 tables (including photos)
    - Bad auto-derived slugs (404) are silently skipped — no crash
    - Time-budgeted: exits early if Vercel timeout approaches
    - Fault-isolated: backfill failure never fails the cron
```

### Supabase Tables Written

| Table | Purpose |
|-------|---------|
| `listings` | Core data: year, make, model, mileage, VIN, colors, description, hammer_price, status |
| `vehicle_specs` | Engine, transmission, body_style |
| `photos_media` | Photo URLs with ordering (up to 10 per listing) |
| `price_history` | Time-series bid/price data |
| `pricing` | Price estimates and currency |
| `auction_info` | Auction house, lot number, bid count, reserve status |
| `location_data` | City, state, country, coordinates |
| `provenance_data` | Title status, service history |

### Photo Pipeline (end-to-end)

| Stage | File | Details |
|-------|------|---------|
| **Scrape** | `bringATrailer.ts` | Extracts `img[src*="wp-content/uploads"]`, filters thumbnails (< 300px) and related-post sections, limits to 10 per listing |
| **Write** | `supabase_writer.ts` | `upsertPhotos()` inserts to `photos_media(listing_id, photo_url, photo_order, photo_hash)`, deduplicates by URL |
| **Read** | `supabaseLiveListings.ts` | Queries `photos_media(photo_url)` join, maps to `image` (first photo) + `images[]` (all photos), falls back to placeholder |

Photos are scraped and stored by all three execution modes (live, historical backfill, and light backfill).

---

## Key Files

| File | Role |
|------|------|
| `src/features/ferrari_collector/collector.ts` | Main live collector — runs discovery + detail scraping for active and recent listings |
| `src/features/ferrari_collector/historical_backfill.ts` | Historical backfill (full, CLI) + light backfill (capped, cron) |
| `src/lib/scrapers/bringATrailer.ts` | BaT scraper — `scrapeDetail()` extracts all fields from individual listing pages |
| `src/features/ferrari_collector/supabase_writer.ts` | `createSupabaseWriter().upsertAll()` — writes to all 8 tables with `Promise.allSettled` for fault tolerance |
| `src/features/ferrari_collector/normalize.ts` | Data normalization — `parseLocation()`, `normalizeMileageToKm()`, `scoreDataQuality()`, `mapAuctionStatus()` |
| `src/features/ferrari_collector/types.ts` | `NormalizedListing` and `ScrapeMeta` interfaces |
| `src/features/ferrari_collector/id.ts` | `deriveSourceId()` produces `bat-{slug}` IDs, `canonicalizeUrl()` strips tracking params |
| `src/features/ferrari_collector/net.ts` | `fetchHtml()` with rate limiting via `PerDomainRateLimiter` |
| `src/app/api/cron/ferrari/route.ts` | Cron endpoint — triggers all 3 steps daily at midnight UTC |

---

## What Was Built

### 1. Historical Backfill Enrichment

**Problem:** The historical backfill originally wrote only skeleton rows to the `listings` table (title, price, date, URL). It skipped all 7 satellite tables and left ~13 fields null (mileage, colors, VIN, engine, transmission, location, description, photos). Data quality scores were low.

**Solution:** Rewrote `historical_backfill.ts` to reuse the live scraper's pipeline:

- For each discovered listing, calls `scrapeDetail()` to scrape the individual listing page
- Converts the enriched result to a `NormalizedListing` using the same normalization functions as the live scraper
- Writes to all 8 tables via `writer.upsertAll()`
- Graceful degradation: if `scrapeDetail()` fails (404, timeout), falls back to discovery-level data

**Result:** All 146 historical sold listings now score quality 100/100 with fully populated satellite tables.

### 2. Source ID Unification

**Problem:** Historical backfill used `bat-hist-{slug}` IDs while the live scraper used `bat-{slug}`. This caused duplicate rows when the same listing appeared in both systems, and triggered `source_url` unique constraint violations.

**Solution:**
- Switched historical backfill to use `deriveSourceId()` which produces `bat-{slug}`, matching the live scraper
- Cleaned up 145 old `bat-hist-*` rows from all 8 tables
- Now the same listing found by both systems merges via upsert instead of creating duplicates

### 3. Terminal Status Guard

**Problem:** The live collector's `parseBringATrailer()` uses CSS selectors (`.listing-available`, `.time-remaining`) that can be present on ended BaT auction pages, causing sold/unsold listings to be incorrectly detected as `status: "active"`. This overwrote manually corrected DB statuses, making sold cars (like the 2022 Ferrari F8 Spider and 1968 Ferrari 365 GT) reappear as active in the UI.

**Solution:** Added `hasTerminalStatus()` guard in `collector.ts`:

```typescript
const TERMINAL_STATUSES = new Set(["sold", "unsold", "delisted"]);

async function hasTerminalStatus(sourceId: string): Promise<boolean> {
  // Queries Supabase to check if the listing already has a terminal status
  const { data } = await client
    .from("listings")
    .select("status")
    .eq("source_id", sourceId)
    .limit(1);
  const existing = data?.[0]?.status;
  return typeof existing === "string" && TERMINAL_STATUSES.has(existing);
}
```

The guard is called in both the active listings loop (step 1) and the discovery loop (step 2) before `writer.upsertAll()`. If a listing already has a terminal status in the DB, the write is skipped with a `collector.skip_terminal` log event.

**Result:** Verified with a test run — the F8 Spider and 1968 365 GT were correctly skipped, reducing written listings from 13 to 11.

### 4. Automated Light Backfill (Daily Cron Step 3)

**Problem:** Historical sold data required manual CLI runs. Recently sold listings could go un-ingested for weeks until someone remembered to run the backfill script.

**Solution:** Added `runLightBackfill()` to `historical_backfill.ts` — a budget-constrained version of the full backfill that:

- **Fully dynamic model discovery:** queries DB for every distinct Ferrari model instead of a hardcoded list
- For each model, derives BaT URL slug via `SLUG_OVERRIDES` (verified edge cases) or auto-derivation (lowercase + hyphens)
- New models ingested by the live collector automatically get historical backfill coverage — no code changes needed
- Bad auto-derived slugs (404) are silently skipped — no crash, no data corruption
- Focuses on the last 30 days only (vs. 12 months for full backfill)
- Caps at 3 new listings per model per run
- Has a time budget that adapts to remaining cron time
- Skips already-ingested listings via batch `source_id` check (after the first run, subsequent runs complete in seconds)
- Called as Step 3 in the daily cron, after refresh + discovery
- Fault-isolated: backfill failure never causes the cron to return 500
- Reports `newModelsFound` — models not in the override table (auto-derived slug)

**Result:** Recently sold listings are now automatically ingested within 24 hours of auction close, with full enrichment (photos, specs, location, VIN), and no manual intervention needed. New Ferrari models appearing on BaT are automatically covered without code changes.

---

## Ferrari Models Covered

### Historical + Light Backfill (dynamic — DB-driven)

The backfill queries `SELECT DISTINCT model FROM listings WHERE make = 'Ferrari'` to discover all models. For each model, it derives a BaT URL slug:

1. Check `SLUG_OVERRIDES` for models with non-obvious slugs
2. Otherwise, auto-derive: lowercase + hyphens (e.g., "Roma" → "roma", "F8 Tributo" → "f8-tributo")

**Slug overrides** (verified edge cases):

| Model | BaT Slug |
|-------|----------|
| 296 GTB | `296-gtb-gts` |
| 328 GTS | `328` |
| 360 Spider | `360` |
| 365 GT | `365-gt-22` |
| 488 Pista | `488` |
| 512 TR | `testarossa` |
| 550 Maranello | `550-maranello` |
| Dino 246 | `dino` |
| SF90 Spider | `sf90` |

All other models use auto-derived slugs. If a derived slug is wrong (404), it's silently skipped.

### Live Collector (active + recent)

Discovers from 15 model index pages on BaT, currently tracking ~11 active Ferrari listings.

---

## Data Quality Scoring

`scoreDataQuality()` scores each listing 0-100 based on:

| Field | Points |
|-------|--------|
| Year present | +25 |
| Model present | +15 |
| Sale date present | +25 |
| Country present | +15 |
| Has photos | +10 |
| Has price | +10 |

After enrichment, both historical and live listings consistently achieve 90-100/100.

---

## BaT Scraping Selectors

Verified selectors used by `scrapeDetail()`:

- **Essentials:** `div.essentials li` — most are plain text, only Chassis/VIN have colons
- **Mileage:** regex `/^([\d,]+k?)\s*(miles?|km)$/i` on li text
- **Engine:** regex for liter/V-config patterns (avoids matching "F140" with transmission regex)
- **Transmission:** uses `\bF1\b` word boundary to avoid matching "F140" engine codes
- **Location:** `$('.essentials strong')` text "Location" then `.next('a')` sibling
- **Bid:** `.current-bid-value` for price, `.number-bids-value` for count
- **Photos:** `img[src*="wp-content/uploads"]` filtered for jpg/png/webp, max 10 per listing

---

## Running the Scrapers

### Live Collector (daily mode)
```bash
npx tsx src/features/ferrari_collector/cli.ts --mode=daily
```

### Historical Backfill (full, manual)
```bash
npx tsx src/features/ferrari_collector/historical_backfill.ts
```

### Cron (automated — daily at midnight UTC)

The `/api/cron/ferrari` endpoint runs three steps:
1. **Refresh:** Re-scrape active listings to detect ended auctions (sold/unsold)
2. **Discover:** Find and ingest new active Ferrari listings from all 3 sources
3. **Backfill:** Ingest recently sold listings from BaT (last 30 days, max 3 per model)

All three steps run sequentially within Vercel's 5-minute timeout. The backfill step is fault-isolated — its failure never affects steps 1 and 2.

Schedule configured in `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/ferrari", "schedule": "0 0 * * *" }] }
```

---

## Idempotency

All three scrapers are fully idempotent and safe to re-run:
- All writes use upserts keyed on `source` + `source_id`
- Satellite tables use `listing_id` foreign keys with upsert semantics
- The terminal status guard prevents overwriting corrected statuses
- `Promise.allSettled` prevents satellite table failures from cascading
- Light backfill skips already-ingested listings via batch `source_id` check
