# Monza Cars Marketplace — Development Overview

## Current State (Feb 14, 2026)

### Data Architecture

| Layer | Source | Status |
|-------|--------|--------|
| **Curated Cars** | `CURATED_CARS` in `curatedCars.ts` | **Emptied** — removed by user request |
| **Live Data** | Supabase `listings` table (BaT scraper) | **Active** — 14 Ferrari listings with full enrichment |
| **Cron** | `/api/cron/ferrari` via Vercel (every 6h) | **Configured** in `vercel.json` |

The app now runs **entirely on Supabase live data** — no hardcoded/static cars remain.

---

### Ferrari Data Pipeline

```
BaT Website → scrapeDetail() → collector.ts → normalize.ts → supabase_writer.ts → Supabase
                    ↓                                                                  ↓
              Extracts:                                                          Stored in:
              - Engine, Transmission                                    - listings table
              - Mileage, VIN                                            - vehicle_specs table
              - Exterior/Interior Color                                 - photos_media table
              - Location (city, state, ZIP)                             - price_history table
              - Current Bid, Bid Count                                  - location_data table
              - Photos (up to 10)                                       - auction_info table
              - Full Description
```

**Pipeline Status**: Fully operational. All 14 active Ferrari listings scraped with:

| Metric | Before | After |
|--------|--------|-------|
| Data Quality Score | 65/100 | 90–100/100 |
| Engine/Transmission | null | Real specs (e.g., "4.9-Liter Flat-12") |
| Mileage | null | Extracted (converted miles → km for storage) |
| Photos | 0 | 7–10 per listing |
| Current Bid | $0 | $15,250 – $685,000 |
| VIN | partial | All 14 extracted |
| Colors | null | Exterior + Interior for most |
| Location | Unknown | City, State, USA |

---

### Active Ferrari Inventory (14 listings)

| Year | Model | Current Bid | Engine | Location |
|------|-------|-------------|--------|----------|
| 2024 | SF90 Spider | $400,000 | Twin-Turbo 4.0L V8 | Newport Beach, CA |
| 2022 | F8 Spider | — | Twin-Turbo 3.9L V8 | Austin, TX |
| 2022 | 296 GTB | $125,000 | Twin-Turbo 3.0L V6 | Vero Beach, FL |
| 2019 | 488 Pista | $685,000 | Twin-Turbo 3.9L V8 | Newbury Park, CA |
| 2013 | FF | $132,000 | 6.3L F140 V12 | Pennington, NJ |
| 2004 | 360 Spider | $100,000 | 3.6L V8 | Neptune, NJ |
| 2001 | 550 Maranello | $170,000 | 5.5L V12 | Pasadena, CA |
| 1993 | 512 TR | $155,512 | 4.9L Flat-12 | North Salem, NY |
| 1989 | Testarossa | $100,000 | 4.9L Flat-12 | North Salem, NY |
| 1987 | 328 GTS | $63,000 | 3.2L V8 | Laredo, TX |
| 1986 | 328 GTS | $15,250 | 3.2L V8 | San Mateo, CA |
| 1971 | 365 GT | $78,910 | 4.4L Colombo V12 | Waltham, MA |
| 1970 | Dino 246 GT | $241,000 | 2.4L V6 | Los Gatos, CA |
| 1968 | 365 GT 2+2 | — | 4.4L Colombo V12 | Ramsey, NJ |

---

### Key Files Modified

| File | Change |
|------|--------|
| `src/lib/scrapers/bringATrailer.ts` | Rewrote `scrapeDetail()` with correct BaT selectors for essentials, bids, photos |
| `src/lib/supabaseLiveListings.ts` | Expanded query with vehicle_specs join + fallback; fixed object-vs-array mapping |
| `src/lib/curatedCars.ts` | Added optional fields to `CollectorCar` interface; curated array emptied |
| `src/features/ferrari_collector/collector.ts` | Use enriched bid data from detail page; USD currency fallback |
| `src/features/ferrari_collector/supabase_writer.ts` | Non-fatal vehicle_specs upsert; `Promise.allSettled` for satellites |
| `src/features/ferrari_collector/normalize.ts` | Added US full-state-name + ZIP code location parsing |
| `src/app/api/auctions/[id]/route.ts` | Uses `fetchLiveListingById()` for efficient single-row lookup |
| `src/app/api/mock-auctions/route.ts` | Ferrari-only filter from Supabase |
| `src/app/[locale]/cars/[make]/page.ts` | Merged curated + live data for make pages |
| `src/app/[locale]/cars/[make]/[id]/page.ts` | Handles `live-*` IDs via Supabase |
| `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx` | Renders colors, VIN conditionally |

---

### Supabase Schema

```
listings (main table)
├── vehicle_specs    (1:1 FK → listing_id)  — engine, transmission
├── photos_media     (1:N FK → listing_id)  — photo URLs
├── price_history    (1:N FK → listing_id)  — time-series bid data
├── pricing          (1:1 FK → listing_id)  — hammer prices
├── auction_info     (1:1 FK → listing_id)  — auction house, lot #
├── location_data    (1:1 FK → listing_id)  — country, region, city
└── provenance_data  (1:1 FK → listing_id)  — ownership history
```

**Important**: PostgREST returns 1:1 joins as **objects** (not arrays). Code must handle both formats.

---

### Known Issues / Edge Cases

1. **2 listings missing bid data** — 1968 365 GT 2+2 and 2022 F8 Spider return `currentBid: null` (may have different bid display format on BaT)
2. **1993 512 TR transmission** — Incorrectly picked up "17k Miles Shown on Replacement Speedometer" (contains "Speed" keyword)
3. **Mileage null for some** — Older listings may not have mileage in the essentials section
4. **Cars & Bids / Collecting Cars** — Scrapers return 0 results (site structure changes); only BaT is producing data

---

### Deployment

| Config | Value |
|--------|-------|
| Platform | Vercel |
| Cron | `/api/cron/ferrari` every 6 hours |
| i18n | `next-intl` with locale prefix |
| Image CDNs | BaT, Cars & Bids, Collecting Cars, RM Sotheby's, Unsplash |
| DB | Supabase (primary), Prisma/PostgreSQL (legacy) |

---

### Next Steps

- [ ] Fix C&B and Collecting Cars scrapers for multi-platform data
- [ ] Add more makes beyond Ferrari (Porsche, Lamborghini, etc.)
- [ ] Implement Claude-powered investment thesis generation (`/api/enrich`)
- [ ] Add fair value computation from comparable sales
- [ ] Price history trend charts on detail pages
- [ ] Handle sold/ended auctions with final prices
