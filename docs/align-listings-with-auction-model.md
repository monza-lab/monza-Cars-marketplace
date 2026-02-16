# Plan: Align Supabase `listings` Table with Prisma `Auction` Model

## Context

The Supabase `listings` table and the Prisma `Auction` model represent the same data but have diverged in schema. The `Auction` model (in `prisma/schema.prisma`) has a clean, flat structure with fields like `title`, `currentBid`, `bidCount`, `sellerNotes`, `images[]`, `platform` (enum), and `reserveStatus` (enum). The `listings` table splits data across 6+ satellite tables and is missing several fields. The goal is to bring `listings` in line with `Auction` so data flows through a single consistent model.

## Status

### Completed (Code Changes)

All application code has been updated and passes TypeScript checks + tests:

1. **`src/features/ferrari_collector/types.ts`** — Added `PlatformEnum`, `ReserveStatusEnum`, and 7 new fields to `NormalizedListing` (`platform`, `sellerNotes`, `endTime`, `startTime`, `reserveStatus`, `finalPrice`, `locationString`)
2. **`src/features/ferrari_collector/normalize.ts`** — Added `mapSourceToPlatform()`, `mapReserveStatus()`, `buildLocationString()` helpers
3. **`src/features/ferrari_collector/supabase_writer.ts`** — `mapNormalizedListingToListingsRow()` writes all new columns; `refreshActiveListings()` updates `final_price`, `current_bid`, `end_time` on status transitions
4. **`src/features/ferrari_collector/collector.ts`** — `normalizeFromBaseAndUrl()` populates all new fields including `sellerNotes` from detail scrape
5. **`src/features/ferrari_collector/historical_backfill.ts`** — `enrichedToNormalizedListing()` populates all new fields
6. **`src/lib/supabaseLiveListings.ts`** — `ListingRow` extended, `SELECT_BROAD`/`SELECT_NARROW` updated, `rowToCollectorCar()` prefers direct columns over satellite joins
7. **`src/lib/curatedCars.ts`** — Added optional `sellerNotes` field to `CollectorCar` interface
8. **Tests** — `normalize.test.ts` and `supabase_writer.test.ts` updated with new test cases (14/14 pass)

### Pending: SQL Migration

The SQL migration must be run against Supabase to add the new columns and backfill existing data.

**File:** `supabase/migrations/20260215_align_listings_with_auction_model.sql`

Run this in the Supabase SQL Editor (Dashboard → SQL Editor → paste and run).

---

## Gap Analysis

| Auction Field | Current `listings` Status | Action Needed |
|---|---|---|
| `title` | Not stored (computed on-the-fly) | **Add column**, populate in scraper |
| `platform` | Stored as `source` ("BaT") | **Add column** with enum values ("BRING_A_TRAILER") |
| `currentBid` | Only in `price_history` table | **Add column**, populate from scraper |
| `bidCount` | Only in `auction_info` satellite | **Add column**, populate from scraper |
| `reserveStatus` | `reserve_met` (boolean) | **Add column** with enum ("NO_RESERVE"/"RESERVE_NOT_MET"/"RESERVE_MET") |
| `sellerNotes` | Not scraped/stored | **Add column**, scrape from BaT detail page |
| `images` | Only in `photos_media` satellite | **Add column** (text[]), populate from scraper |
| `engine` | Only in `vehicle_specs` satellite | **Add column** directly to listings |
| `transmission` | Only in `vehicle_specs` satellite | **Add column** directly to listings |
| `endTime` | `sale_date` (text YYYY-MM-DD) | **Add column** (timestamptz) for proper DateTime |
| `startTime` | `list_date` (text YYYY-MM-DD) | **Add column** (timestamptz) |
| `finalPrice` | `hammer_price` exists | **Add column** (alias, kept in sync) |
| `location` | Split: `country`, `region`, `city` | **Add column** (combined string) |
| `viewCount` | Not available from sources | **Add column** (nullable, best-effort) |
| `watchCount` | Not available from sources | **Add column** (nullable, best-effort) |
| `createdAt` | Not stored | **Add column** (default now()) |

Fields already present (naming differs but OK to keep):
- `source_url` = Auction's `url`
- `source_id` = Auction's `externalId`
- `color_exterior` = Auction's `exteriorColor`
- `color_interior` = Auction's `interiorColor`
- `description_text` = Auction's `description`

---

## Files Modified

| File | What Changed |
|---|---|
| `src/features/ferrari_collector/types.ts` | Added `PlatformEnum`, `ReserveStatusEnum`, 7 new `NormalizedListing` fields |
| `src/features/ferrari_collector/normalize.ts` | Added `mapSourceToPlatform()`, `mapReserveStatus()`, `buildLocationString()` |
| `src/features/ferrari_collector/normalize.test.ts` | 3 new tests for helpers; fixed Dino test to match code |
| `src/features/ferrari_collector/supabase_writer.ts` | Writer maps 13 new columns; refresh updates new columns on status change |
| `src/features/ferrari_collector/supabase_writer.test.ts` | 2 new tests for new column mapping and sold listing |
| `src/features/ferrari_collector/collector.ts` | `normalizeFromBaseAndUrl()` populates all new fields |
| `src/features/ferrari_collector/historical_backfill.ts` | `enrichedToNormalizedListing()` populates all new fields |
| `src/lib/supabaseLiveListings.ts` | Reads new columns, prefers direct over satellite joins |
| `src/lib/curatedCars.ts` | Added `sellerNotes` to `CollectorCar` |

## Files Created

| File | Purpose |
|---|---|
| `supabase/migrations/20260215_align_listings_with_auction_model.sql` | DDL + backfill SQL migration |

---

## SQL Migration Details

### Step 1: Add New Columns

```sql
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS current_bid DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS bid_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserve_status TEXT,
  ADD COLUMN IF NOT EXISTS seller_notes TEXT,
  ADD COLUMN IF NOT EXISTS images TEXT[],
  ADD COLUMN IF NOT EXISTS engine TEXT,
  ADD COLUMN IF NOT EXISTS transmission TEXT,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_price DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS view_count INTEGER,
  ADD COLUMN IF NOT EXISTS watch_count INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
```

### Step 2: Add Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_listings_platform ON listings(platform);
CREATE INDEX IF NOT EXISTS idx_listings_make_model ON listings(make, model);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_end_time ON listings(end_time);
```

### Step 3: Backfill Existing Rows

Populates new columns from existing data + satellite tables:
- `title` from `year || make || model || trim`
- `platform` from `source` (BaT → BRING_A_TRAILER, etc.)
- `final_price` from `hammer_price`
- `location` from `city, region, country`
- `end_time` from `sale_date`
- `start_time` from `list_date`
- `engine`/`transmission` from `vehicle_specs`
- `images` from `photos_media`
- `bid_count` from `auction_info`
- `current_bid` from latest `price_history`
- `reserve_status` from `reserve_met` boolean

---

## Verification Checklist

- [x] TypeScript compiles with zero errors (`npx tsc --noEmit`)
- [x] All 14 tests pass (`npx vitest run src/features/ferrari_collector/`)
- [x] SQL migration run on Supabase (applied via MCP 2026-02-15)
- [x] Verify new columns exist via Supabase dashboard
- [ ] Run collector in dry-run mode to verify normalization outputs
- [ ] Run a single listing scrape to verify columns populated
- [ ] Verify bridge layer reads new columns via `/api/mock-auctions`
