# Ferrari Data Collection - Process Overview

## Objective
Build a pipeline to collect **all Ferrari listings** from existing scrapers (Bring a Trailer, Cars & Bids, Collecting Cars) and persist them into a Supabase database following the `BASE_DATOS_COMPLETA_TODOS_LUJO.md` schema.

---

## What Already Existed (Starting Point)

### Scrapers (Reused, Not Rewritten)
| File | Platform | Status |
|------|----------|--------|
| `src/lib/scrapers/bringATrailer.ts` | BaT | ✅ Functional |
| `src/lib/scrapers/carsAndBids.ts` | C&B | ✅ Functional |
| `src/lib/scrapers/collectingCars.ts` | CC | ✅ Functional |

### Database Schema (Target)
The target schema from `BASE_DATOS_COMPLETA_TODOS_LUJO.md` includes:
- `listings` (core)
- `pricing`
- `auction_info`
- `location_data`
- `vehicle_specs`
- `provenance_data`
- `photos_media`
- `price_history`
- `vehicle_history`
- `market_segments`
- `market_analytics`

---

## What Was Built (New Implementation)

### 1. Ferrari Collector Slice
**Location:** `src/features/ferrari_collector/`

| File | Purpose |
|------|---------|
| `cli.ts` | Entry point with `--mode` (daily/backfill), pagination flags, dry-run |
| `collector.ts` | Orchestrates scraping → filtering → normalization → persistence |
| `normalize.ts` | Maps scraper output → doc schema rows |
| `supabase_writer.ts` | Writes to Supabase (upserts `listings`, inserts `price_history`, etc.) |
| `checkpoint.ts` | Checkpointing for resumable runs (`var/ferrari_collector/checkpoint.json`) |
| `logging.ts` | Structured logging |
| `README.md` | Usage docs |

### 2. UI Rendering
**Location:** `src/app/[locale]/ferrari/page.tsx`
- Server-side reads Ferrari rows from `public.listings`
- Renders accessible table with year, model, price, status, location, source link

---

## Key Problems Discovered & Fixed

### Problem 1: Zero Rows Written
**Symptoms:** Running collector produced 0 database inserts despite finding Ferrari listings.

**Root Causes:**
1. **Logic bug:** Daily mode filtered out active Ferraris discovered via "ended discovery" (only ingested ended auctions).
2. **Schema mismatch:** Supabase writer tried to insert `updated_at` column into `auction_info`, which didn't exist → HTTP 400.

**Fixes Applied:**
- `collector.ts`: Daily mode now ingests ACTIVE Ferraris too (not just ended).
- `supabase_writer.ts`: Removed `updated_at` from `auction_info` payload.
- `cli.ts`: Added auto-loading of `.env.local`/`.env` for env vars.

### Problem 2: BaT Page Shows More Ferraris Than Collected
**Symptoms:** User screenshot shows ~19 live Ferrari auctions on BaT; collector only captured 2.

**Root Causes Identified:**
1. **Title parsing fails** when year is NOT the first token:
   - Examples: "19k-Mile 2001 Ferrari 550 Maranello", "Euro 1989 Ferrari Testarossa"
   - Current `parseTitleComponents` expects year at start → fails to extract.
2. **Non-car items** (scale models, wheels, luggage) are being filtered butFerrari cars are ALSO being dropped due to year extraction.
3. **Discovery limited** - may not be scraping the dedicated Ferrari make page.

---

## Current Status

| Component | Status |
|-----------|--------|
| Scrapers (BaT/C&B/CC) | ✅ Working, reused |
| Ingestion pipeline | ✅ Writes to Supabase (after fixes) |
| UI page (`/en/ferrari`) | ✅ Built, renders rows |
| Full Ferrari coverage | 🔄 In Progress |

### Data Written (as of last run)
- **2 Ferrari rows** in `public.listings` (BaT, ACTIVE)
- Related tables populated: `auction_info`, `location_data`, `vehicle_specs`, `provenance_data`
- **Gap:** `pricing` and `price_history` still empty (price extraction needs improvement)

---

## Next Steps (Remaining Work)

1. **Fix title parsing** in scrapers to extract year from ANY position (not just start)
2. **Update Ferrari filter** to include Dino and exclude non-car items
3. **Improve discovery** to scrape dedicated Ferrari make pages (not just general `/auctions`)
4. **Verify coverage** matches user screenshot (~19 Ferraris on BaT)
5. **Add tests** for parsing edge cases

---

## Commands

### Run Ingestion
```bash
# Daily mode (active + recent ended)
npx tsx src/features/ferrari_collector/cli.ts --mode=daily --maxActivePages=10 --maxEndedPages=10 --noDetails

# Backfill mode (historical)
npx tsx src/features/ferrari_collector/cli.ts --mode=backfill --dateFrom=2026-01-01 --dateTo=2026-02-14 --maxEndedPages=10

# Dry run (no writes)
npx tsx src/features/ferrari_collector/cli.ts --mode=daily --dryRun
```

### Verify in Supabase
```sql
-- Count active Ferraris
select count(*) from public.listings where make = 'Ferrari' and status = 'active';

-- Breakdown by source
select source, count(*) from public.listings where make = 'Ferrari' group by source;

-- Latest entries
select source, source_id, title, sale_date, status from public.listings 
where make = 'Ferrari' order by updated_at desc limit 20;
```

### Run UI
```bash
npm run dev
# Open http://localhost:3000/en/ferrari
```

---

## Files Changed

### Created
- `src/features/ferrari_collector/` (entire slice)
- `src/app/[locale]/ferrari/page.tsx`
- `agents/negentropized_instructions.md`
- `agents/testscripts/ferrari-ingestion-e2e.md`

### Modified
- `src/lib/scraper.ts` (improved BaT `endTime` extraction)
- `.gitignore` (ignored `var/` checkpoint directory)

---

## Dependencies
- `@supabase/supabase-js` (already present)
- No new dependencies added
