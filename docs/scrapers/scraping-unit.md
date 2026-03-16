# Scraping Pipeline — Database Audit Report

**Date:** 2026-02-15
**Database:** garage-advisory (Supabase `xgtlnyemulgdebyweqlf`)
**Source:** BaT (Bring a Trailer) — 159 listings

---

## 1. Inventory Overview

| Status | Count |
|--------|-------|
| sold | 147 |
| active | 11 |
| unsold | 1 |
| **Total** | **159** |

All listings sourced from BaT. All data quality scores: **90-100** (159/159).
Last update range: `2026-02-14 22:50` — `2026-02-15 00:16` (most recent cron run).

---

## 2. Column Fill Rates

| Column | Filled | Missing | Fill % | Status |
|--------|--------|---------|--------|--------|
| title | 159 | 0 | 100.0% | OK |
| platform | 159 | 0 | 100.0% | OK |
| year | 159 | 0 | 100.0% | OK |
| make | 159 | 0 | 100.0% | OK |
| model | 159 | 0 | 100.0% | OK |
| engine | 159 | 0 | 100.0% | OK |
| transmission | 159 | 0 | 100.0% | WARN (see issue #1) |
| vin | 159 | 0 | 100.0% | OK |
| description_text | 159 | 0 | 100.0% | OK |
| images | 159 | 0 | 100.0% | OK |
| location | 159 | 0 | 100.0% | OK |
| source_url | 159 | 0 | 100.0% | OK |
| end_time | 159 | 0 | 100.0% | OK |
| current_bid | 158 | 1 | 99.4% | WARN (see issue #2) |
| final_price | 148 | 11 | 93.1% | OK (11 active = expected) |
| hammer_price | 148 | 11 | 93.1% | OK (11 active = expected) |
| int_color | 142 | 17 | 89.3% | GAP |
| ext_color | 130 | 29 | 81.8% | GAP |
| mileage | 67 | 92 | 42.1% | GAP (see issue #3) |
| start_time | 13 | 146 | 8.2% | GAP (BaT rarely exposes) |
| **seller_notes** | **0** | **159** | **0.0%** | FAIL (see issue #4) |
| **reserve_status** | **0** | **159** | **0.0%** | FAIL (see issue #5) |
| **body_style** | **0** | **159** | **0.0%** | FAIL (see issue #6) |

---

## 3. Issues Found

### Issue #1 — Transmission Misparse (3 listings)

Three listings have mileage text stored in the `transmission` column instead of actual transmission type:

| Listing | transmission value |
|---------|-------------------|
| 1993 Ferrari 512 TR | `17k Miles Shown on Replacement Speedometer` |
| 1994 Ferrari 512 TR | `29k Miles Shown on Replacement Speedometer` |
| 1998 Ferrari 550 Maranello | `50k Miles Shown on Replacement Speedometer` |

**Root cause:** BaT essentials list these as plain `<li>` text. The transmission regex matches because the text contains neither engine nor mileage patterns cleanly. The scraper picked it up as the "leftover" essentials field.

**Impact:** These 3 listings display incorrect transmission on the frontend and also have NULL mileage (the mileage was consumed by transmission).

### Issue #2 — 1 Sold Listing Missing current_bid

| Listing | hammer_price | final_price | current_bid |
|---------|-------------|-------------|-------------|
| 2022 Ferrari F8 Spider | $420,000 | $420,000 | NULL |

**Root cause:** This listing was likely scraped after sale completion. The `current_bid` field wasn't backfilled from `hammer_price` during the sold-status transition.

**Impact:** Minor — `final_price` and `hammer_price` are present, so the read layer (`rowToCollectorCar`) falls back to price correctly. No price_history row exists for this listing.

### Issue #3 — Mileage NULL for 57.9% of Listings

92 out of 159 listings have `mileage = NULL`. Breakdown by status:

| Status | Total | Mileage NULL | % NULL |
|--------|-------|-------------|--------|
| active | 11 | 7 | 63.6% |
| sold | 147 | 84 | 57.1% |
| unsold | 1 | 1 | 100.0% |

**Root cause:** BaT does not always include mileage as a standalone essentials item. For some listings, mileage appears only in the title or description text (e.g., "10k-Mile 2003 Ferrari 360"), not in the structured `<li>` elements the scraper targets. Additionally, some Ferraris (show cars, low-production models) genuinely don't list mileage.

**Impact:** The `mileage` field shows as 0 on the frontend for these listings. The backfill script (`scripts/backfill-detail-scrape.ts`) can re-scrape these to attempt extraction with the improved regex patterns.

### Issue #4 — seller_notes: 0% (ALL 159 NULL)

**Root cause:** The `seller_notes` extraction was added in the recent scraper update but has NOT yet been run against existing data. All 159 listings were scraped before the heading-based seller notes extraction was implemented.

**Fix:** Run the backfill script to re-scrape detail pages with the updated selectors.

### Issue #5 — reserve_status: 0% (ALL 159 NULL)

**Root cause:** Same as seller_notes — the reserve status detection (badges, essentials text, listing info) was just added to the scraper. Existing data predates the improvement.

**Fix:** Run the backfill script.

### Issue #6 — body_style: 0% (ALL 159 NULL)

**Root cause:** Same as above — body style extraction from essentials is new code that hasn't been applied to existing data.

**Fix:** Run the backfill script.

---

## 4. Image Coverage

All 159 listings have images populated in the `images` column.

| Image Count Bucket | Listings | Avg Images |
|-------------------|----------|------------|
| 6-10 | 146 | 8.1 |
| 11-20 | 1 | 11.0 |
| 50+ | 12 | 71.5 |

The 12 listings with 50+ images are likely recently scraped with the image cap removed (previously capped at 10).

---

## 5. Price History Coverage

| Source | Listings | With Price History | History Rows |
|--------|----------|--------------------|--------------|
| BaT | 159 | 158 (99.4%) | 191 |

1 listing missing price history: the F8 Spider (sold, `current_bid = NULL`, so the snapshot writer skipped it).

---

## 6. Satellite Table Audit (Post-Consolidation)

After the DB write consolidation (removing satellite writes), here's the current satellite table state:

| Table | Rows | Unique Listings | Status |
|-------|------|-----------------|--------|
| vehicle_specs | 159 | 159 | Legacy only (0 rows with data not on listings) |
| photos_media | 2,057 | 159 | Legacy only (100% of listings have images column) |
| pricing | 158 | 158 | Legacy only (never read) |
| auction_info | 159 | 159 | Legacy only (never read) |
| location_data | 159 | 159 | Legacy only (never read) |
| provenance_data | 159 | 159 | Legacy only (never read) |

**Validation:** `vehicle_specs.engine` and `vehicle_specs.transmission` have 0 rows where the satellite has data but `listings` doesn't. The consolidation to `listings`-only writes is safe — no data loss.

---

## 7. Active Listings Detail (11 live auctions)

| Title | Bid | Bids | Mileage | Engine | Ext Color | Images |
|-------|-----|------|---------|--------|-----------|--------|
| 2024 Ferrari SF90 Spider Assetto Fiorano | $400,000 | 2 | 507 km | TT 4.0L V8 | Nero DS | 75 |
| 2004 Ferrari 360 Spider | $100,000 | 5 | 9,656 km | 3.6L V8 | Giallo Modena | 66 |
| 1993 Ferrari 512 TR | $155,512 | 3 | NULL | 4.9L Flat-12 | Rosso Corsa | 67 |
| 1987 Ferrari 328 GTS | $63,000 | 12 | NULL | 3.2L V8 | Rosso Corsa | 73 |
| 2019 Ferrari 488 Pista | $690,000 | 24 | 2,414 km | TT 3.9L V8 | NULL | 74 |
| 2001 Ferrari 550 Maranello | $225,000 | 14 | NULL | 5.5L V12 | Blu Tour de France | 9 |
| 1971 Ferrari 365 GT 2+2 | $78,910 | 10 | NULL | 4.4L V12 | Red | 73 |
| 1970 Ferrari Dino 246 GT | $241,000 | 27 | NULL | 2.4L V6 | NULL | 77 |
| 2022 Ferrari 296 GTB Assetto Fiorano | $205,000 | 4 | 9,656 km | TT 3.0L V6 | Verde Pino | 76 |
| 1989 Ferrari Testarossa | $101,000 | 5 | NULL | 4.9L Flat-12 | NULL | 11 |
| 1986 Ferrari 328 GTS | $15,250 | 6 | NULL | 3.2L V8 | Nero | 74 |

Notable: 7/11 active listings missing mileage, 3/11 missing exterior color.

---

## 8. Recommendations

### Immediate (run backfill)

1. **Run `scripts/backfill-detail-scrape.ts`** to re-scrape all 159 listings with the updated scraper. This will populate:
   - `seller_notes` (currently 0%)
   - `reserve_status` (currently 0%)
   - `body_style` (currently 0%)
   - Additional `mileage`, `color_exterior`, `color_interior` where the page has data the old regex missed

2. **Fix the F8 Spider** (`f60167b0`) — backfill `current_bid = 420000` from `hammer_price` since it's sold.

### Short-term (scraper improvements)

3. **Transmission misparse guard** — Add a negative filter: if the matched "transmission" text contains `miles`, `km`, or `speedometer`, reject it and leave transmission as NULL rather than storing garbage. Then attempt to extract actual mileage from that text.

4. **Mileage from title fallback** — When essentials don't yield mileage, try extracting from the listing title (e.g., "10k-Mile 2003 Ferrari 360" → 10,000 miles). Many BaT titles include mileage.

5. **start_time** — Consider not treating this as a gap. BaT doesn't reliably expose auction start time. The 8.2% fill rate is expected.

### Later (cleanup)

6. **Drop satellite tables** — After confirming the backfill populates all data on `listings`, consider dropping `pricing`, `auction_info`, `location_data`, `provenance_data` (never read, never will be). Keep `vehicle_specs` and `photos_media` as read-only fallbacks until all legacy rows are verified.
