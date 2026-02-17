# Monza Cars - Porsche Data Engine: Project Context

## About This Project

Monza Cars is a luxury car marketplace and investment analysis platform. This project focuses on building the most comprehensive Porsche vehicle database by aggregating data from auction platforms, dealerships, and listing sites across 4 regions: USA, Europe, UK, and Japan.

The goal is to collect, enrich, and normalize Porsche vehicle data (listings, specs, auction results, historical prices) into a unified Supabase database that powers market analysis, investment reports, and valuations.

---

## Existing Codebase (What Already Works)

**Tech Stack**: Next.js, TypeScript, Supabase, Prisma, Cheerio (scraping)

**Working Scrapers** (located in `src/lib/scrapers/`):
- `bringATrailer.ts` - Bring a Trailer auction scraper (Cheerio-based)
- `carsAndBids.ts` - Cars & Bids auction scraper (Cheerio-based)
- `collectingCars.ts` - Collecting Cars auction scraper (Cheerio-based)
- `historical/baHistorical.ts` - BaT historical "sold" auction backfill (12 months per model)
- `historical/modelTracker.ts` - Tracks which models have been backfilled
- `index.ts` - Orchestrator: `scrapeAll()`, `scrapePlatform()`, `scrapeAllWithBackfill()`

**Existing Scraper Features**:
- 2.5-second delay between requests
- Exponential backoff retry (3 retries)
- 60-second wait on 429 rate limits
- Duplicate detection via `externalId`
- Normalized output type: `ScrapedAuction` / `NormalizedListing`

**Existing Database Schema** (Supabase/Prisma):
- `listings` - Main table (source, make, model, year, price, status, VIN, mileage, url, images, etc.)
- `vehicle_specs` - Engine, transmission, body_style linked to listing
- `pricing` - Price data
- `auction_info` - Auction-specific data
- `price_history` - Historical price tracking per listing
- `photos_media` - Vehicle images
- `location_data` - Geographic data
- `provenance_data` - Vehicle provenance/history
- `market_segments` - Market segment classifications
- `market_analytics` - Aggregated market data

**Existing Middleware** (in scraper pipeline):
- `trimExtractor.ts` - Extracts trim/variant from listing titles
- `currency.ts` - Currency handling

**Supabase Project**: `garage-advisory` (ID: `xgtlnyemulgdebyweqlf`)

---

## API Credentials & Services

### 1. NHTSA VIN Decoder (USA) - FREE, No Auth
- **Base URL**: `https://vpic.nhtsa.dot.gov/api/`
- **No API key needed**
- **Key Endpoints**:
  - `GET /vehicles/DecodeVinValues/{vin}?format=json` - Full decode, flat key-value
  - `GET /vehicles/DecodeVin/{vin}?format=json` - Full decode, nested
  - `GET /vehicles/DecodeVinExtended/{vin}?format=json` - Extended decode
  - `POST /vehicles/DecodeVinValuesBatch/` - Batch up to 50 VINs (semicolon-separated in body, field: `vins`)
  - `GET /vehicles/GetModelsForMakeYear/make/porsche/modelyear/{year}?format=json` - All Porsche models for a year
- **Returns for Porsche**: Make, Model, ModelYear, BodyClass, EngineDisplacement, EngineCylinders, EngineConfiguration, DriveType, GVWR, PlantInfo, FuelTypePrimary, ElectrificationLevel
- **Does NOT return**: Trim level (Carrera vs Carrera S), option codes, colors, pricing, production numbers
- **Rate limit**: No official limit. Recommend max 5-10 requests/second
- **Coverage**: 1981+ vehicles. Pre-1981 Porsches return incomplete data
- **Use case**: Primary VIN enrichment for all scraped listings that include a VIN

### 2. UK MOT History API (UK) - FREE, Requires API Key
- **Documentation**: `https://dvsa.github.io/mot-history-api-documentation/`
- **API Key**: [INSERT KEY WHEN RECEIVED FROM DVSA]
- **Endpoint**: `GET https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration={plate}`
- **Headers**: `x-api-key: {your_api_key}`
- **Returns**: Full MOT test history, mileage at each annual inspection, advisory notices, pass/fail details, test dates
- **Extremely valuable for**: Verifying mileage claims on UK Porsches (mileage recorded at every annual MOT test = verified mileage history)
- **Coverage**: All UK-registered vehicles
- **Rate limit**: Generous but not documented. Recommend max 5 requests/second

### 3. Vincario VIN Decoder (Europe) - $49/month
- **API Documentation**: `https://vindecoder.eu/my/api`
- **API Key**: [INSERT WHEN RECEIVED]
- **API Secret**: [INSERT WHEN RECEIVED]
- **Endpoint**: `GET https://api.vindecoder.eu/3.2/{api_key}/{secret_hash}/{vin}/decode`
- **Secret hash calculation**: SHA-1 of `{vin}|{api_key}|{secret_key}|decode` (check their docs for exact format)
- **Returns**: Make, model, year, engine, transmission, body, equipment list, stolen vehicle check, market value estimate, EU registry data
- **Plan**: Startup (~100 decodes/month). Upgrade if volume grows.
- **Use case**: Decode VINs from European-market Porsches (Mobile.de, AutoScout24, Elferspot listings) that NHTSA may not cover well
- **Priority**: Use NHTSA first (free). Only call Vincario when NHTSA returns incomplete data OR when the listing is from a European source

### 4. Decodo / SmartProxy (Residential Proxies) - ~$75/month
- **Dashboard**: `https://dashboard.decodo.com/`
- **Proxy Host**: [INSERT WHEN CONFIGURED]
- **Port**: [INSERT]
- **Username**: [INSERT]
- **Password**: [INSERT]
- **Connection format**: `http://username:password@host:port`
- **Country targeting**: Append country code to username. Example: `username-country-de:password@host:port` for Germany
- **Countries needed**: DE (Germany), FR (France), IT (Italy), GB (UK), JP (Japan), US (USA)
- **Use case**: ALL scrapers should route through these proxies to avoid IP blocks
- **Estimated traffic**: 5-10 GB/month to start
- **Critical for**: Mobile.de, AutoScout24, AutoTrader UK (sites with anti-bot protection)

---

## Porsche VIN Structure Reference

Porsche VINs (17 characters, 1981+) follow ISO 3779 with Porsche-specific encoding:

| Position | Meaning | Values |
|----------|---------|--------|
| 1-3 (WMI) | Manufacturer | `WP0` = Porsche AG Stuttgart, `WP1` = Porsche Leipzig (Cayenne/Macan) |
| 4 | Body Type | `A` = Coupe, `C` = Cabriolet, `Z` = Targa/SUV |
| 5 | Model Line | `A` = 911, `B` = Boxster/Cayman, `E` = Cayenne, `Y` = Taycan, `J` = Panamera, `L` = Macan |
| 6 | Engine | `B` = flat-6 NA, `C` = flat-6 turbo, `E` = V8, `F` = V8 turbo, `8` = electric |
| 7 | Steering/Trans | `1` = LHD manual, `2` = LHD PDK/auto, `3` = RHD manual, `4` = RHD PDK/auto |
| 8 | Model Variant | Varies by year |
| 9 | Check Digit | Computed (0-9 or X) |
| 10 | Model Year | Standard code: `R`=2024, `S`=2025, `T`=2026 |
| 11 | Plant | `S` = Stuttgart-Zuffenhausen, `L` = Leipzig, `A` = Osnabruck |
| 12-17 | Serial Number | 6-digit sequential |

Pre-1981 Porsches use shorter chassis numbers (10-11 digits). Different decoding logic required.

---

## Data Pipeline Architecture

```
PHASE 1: SCRAPE
  Existing scrapers (BaT, Cars & Bids, Collecting Cars)
  + New scrapers (PCarMarket, Classic.com, Mobile.de, Elferspot, AutoScout24, Goo-net Exchange)
  All routed through Decodo/SmartProxy proxies
      |
      v
PHASE 2: NORMALIZE
  Existing middleware (trimExtractor.ts, currency.ts)
  + New: Porsche model name normalizer (see taxonomy below)
  + New: Currency converter with historical rates (USD, EUR, GBP, JPY)
      |
      v
PHASE 3: VIN ENRICHMENT
  If VIN present:
    1. Call NHTSA (free) first
    2. If NHTSA returns incomplete AND source is European → call Vincario
  If UK registration plate present:
    3. Call UK MOT API for mileage verification history
      |
      v
PHASE 4: MODEL MATCHING
  Match against curated `porsche_model_specs` reference table
  Fill in missing specs (HP, torque, weight, 0-60, MSRP) from reference data
      |
      v
PHASE 5: STORE
  Upsert to Supabase tables (listings, vehicle_specs, price_history, etc.)
  Deduplicate by VIN (primary) or source_url (secondary)
      |
      v
PHASE 6: ANALYTICS
  SQL aggregations for price indices per model/generation/quarter
  Trend calculations (12-month rolling averages)
```

---

## Porsche Model Taxonomy (for normalization)

The biggest data challenge: the same car is described differently across sources.
"911 Carrera S", "Porsche 911 Carrera S", "991.2 Carrera S", "911 (991) Carrera S" = SAME CAR.

### Canonical Structure:
```
make: "Porsche"
model_family: "911" | "Boxster" | "Cayman" | "Cayenne" | "Panamera" | "Macan" | "Taycan" | "356" | "914" | "928" | "944" | "968" | "959" | "Carrera GT" | "918 Spyder"
generation: "992" | "991.2" | "991.1" | "997.2" | "997.1" | "996" | "993" | "964" | "930" | "G-body" | "F-body" | etc.
variant: "Carrera" | "Carrera S" | "Carrera 4S" | "Turbo" | "Turbo S" | "GT3" | "GT3 RS" | "GT3 Touring" | "GT2 RS" | "Targa 4" | "Targa 4S" | "GTS" | "Sport Classic" | "S/T" | "Dakar" | etc.
year: number
```

### Key Generation Codes:
**911**: F-body (1963-1973), G-body (1974-1989), 964 (1989-1994), 993 (1995-1998), 996 (1999-2004), 997.1 (2005-2008), 997.2 (2009-2012), 991.1 (2012-2016), 991.2 (2017-2019), 992 (2019-present)
**Boxster**: 986 (1997-2004), 987 (2005-2012), 981 (2012-2016), 718/982 (2016-present)
**Cayman**: 987c (2006-2012), 981c (2013-2016), 718/982c (2016-present)
**Cayenne**: E1/955 (2003-2010), E2/958 (2011-2018), E3 (2018-present)
**Panamera**: 970 (2010-2016), 971 (2017-present)
**Macan**: 95B (2014-present)
**Taycan**: J1 (2020-present)

---

## Scrapers To Build (Priority Order)

### Priority 1: Porsche-Specific Platforms (highest signal, zero noise)

**PCarMarket** (USA - Porsche only auctions)
- URL: `https://pcarmarket.com`
- Method: Cheerio (server-rendered HTML)
- Data: Completed auction prices, detailed descriptions, photos, PPI reports
- Difficulty: Easy
- Proxy needed: No (low volume, US-based)

**Elferspot** (Europe - Porsche only marketplace)
- URL: `https://www.elferspot.com`
- Method: Cheerio
- Data: Listings with prices, specs, photos, dealer/private
- Difficulty: Easy
- Proxy needed: Optional (low anti-bot)

### Priority 2: High-Volume Platforms

**Classic.com** (Global - auction aggregator)
- URL: `https://www.classic.com`
- Method: Cheerio or Playwright (SPA with API calls)
- Data: Aggregated auction results from BaT, RM Sotheby's, Bonhams, Gooding, Mecum, Barrett-Jackson, Collecting Cars
- Difficulty: Medium
- Proxy needed: Recommended
- WHY: One scraper gives you data from 7+ auction houses

**Mobile.de** (Germany - largest European car marketplace)
- URL: `https://www.mobile.de`
- Search URL: `https://suchen.mobile.de/fahrzeuge/search.html?ms=19000` (19000 = Porsche make ID)
- Method: Cheerio + Proxy (server-rendered with Cloudflare)
- Data: Massive Porsche inventory, asking prices, detailed specs, first registration date, TUV/HU inspection dates, equipment lists
- Difficulty: Medium
- Proxy needed: YES (must use German IP via Decodo)
- WHY: Germany is Porsche's home market = deepest inventory in the world

**AutoScout24** (Pan-European)
- URL: `https://www.autoscout24.com`
- Method: Cheerio + Proxy (React-based, internal API returns JSON)
- Data: Pan-EU listings covering DE, IT, FR, NL, BE, AT, ES
- Difficulty: Medium
- Proxy needed: YES
- WHY: Complements Mobile.de for non-German European markets

### Priority 3: UK Market

**AutoTrader UK**
- URL: `https://www.autotrader.co.uk`
- Method: Cheerio + Proxy (internal search API returns JSON)
- Data: UK listings, prices (GBP), mileage, registration year, MOT history links
- Difficulty: Medium
- Proxy needed: YES (UK IP)

**PistonHeads**
- URL: `https://www.pistonheads.com`
- Method: Cheerio
- Data: Listings, classifieds, strong Porsche enthusiast community
- Difficulty: Medium
- Proxy needed: Recommended

### Priority 4: Japan

**Goo-net Exchange** (Japanese export platform)
- URL: `https://www.goo-net-exchange.com`
- Method: Cheerio (designed for international buyers, in English)
- Data: Japanese dealer inventory for export, FOB Japan prices, specs, mileage, photos
- Difficulty: Easy-Medium
- Proxy needed: Optional

**BidJDM** (Japanese auction aggregator)
- URL: `https://bidjdm.com`
- Method: Cheerio (requires registration for full access)
- Data: Japanese auction listings, auction grades, prices, photos
- Difficulty: Medium
- Proxy needed: Recommended

### Priority 5: High-Value Auction Houses

**RM Sotheby's**
- URL: `https://rmsothebys.com`
- Method: Playwright (React SPA, needs headless browser)
- Data: High-end auction results ($100K-$10M+ Porsches)
- Difficulty: Hard
- Proxy needed: YES

**Bonhams**
- URL: `https://www.bonhams.com`
- Method: Cheerio (mostly server-rendered)
- Data: High-end auction results
- Difficulty: Medium
- Proxy needed: Recommended

**Gooding & Company**
- URL: `https://www.goodingco.com`
- Method: Cheerio (simple HTML)
- Data: Premier collector car auction results
- Difficulty: Easy-Medium
- Proxy needed: Optional

---

## Curated Reference Table: `porsche_model_specs`

The developer should create and seed this table in Supabase. No API provides this level of Porsche-specific detail. Sources: press.porsche.com, Rennlist, Total 911, Porsche press releases.

### Schema:
```sql
CREATE TABLE porsche_model_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_family TEXT NOT NULL,        -- '911', 'Cayenne', 'Taycan', etc.
  generation TEXT NOT NULL,          -- '992', '991.2', 'E3', etc.
  variant TEXT NOT NULL,             -- 'Carrera S', 'GT3', 'Turbo S', etc.
  year_from INTEGER NOT NULL,
  year_to INTEGER,                   -- NULL if current production
  engine_code TEXT,                  -- '9A2 Evo', 'MA1.75', etc.
  engine_layout TEXT,                -- 'Flat-6', 'V8', 'Electric', 'V6 Turbo'
  displacement_cc INTEGER,           -- NULL for electric
  horsepower INTEGER NOT NULL,
  torque_nm INTEGER,
  transmission_options TEXT[],       -- ['7-speed PDK', '7-speed Manual']
  drive_type TEXT,                   -- 'RWD', 'AWD'
  weight_kg INTEGER,
  zero_to_sixty_mph DECIMAL(3,1),
  top_speed_mph INTEGER,
  original_msrp_usd INTEGER,        -- Base MSRP in USD
  body_styles TEXT[],                -- ['Coupe', 'Cabriolet', 'Targa']
  notable_features TEXT,             -- 'Rear-axle steering standard', 'PCCB optional', etc.
  production_numbers INTEGER,        -- Total produced (if known)
  collectibility_tier TEXT,          -- 'Investment Grade', 'Enthusiast', 'Daily Driver', 'Ultra Rare'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(model_family, generation, variant, year_from)
);
```

### Priority models to seed first:
1. 911 (all 992 variants, all 991 variants, 997 GT cars, 993, 964)
2. 718 Boxster/Cayman (GT4, Spyder, GTS)
3. Cayenne (current gen E3)
4. Taycan (all variants)
5. Classic collectibles (356, 930 Turbo, 959, Carrera GT, 918 Spyder)

---

## Scraper Best Practices (for developer reference)

### Current Standards (already in codebase):
- 2.5s delay between requests
- Random delay variation +/- 1s
- Retry with exponential backoff (3 retries)
- 60s wait on 429 rate limits
- 15s request timeout

### Required Improvements:
1. **Route ALL requests through Decodo proxy** (especially European sites)
2. **User-Agent rotation** (currently static, needs pool):
```typescript
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
];
```
3. **Country-targeted proxy for European sites** (German IP for Mobile.de, etc.)
4. **Session/cookie reuse** per domain (looks more natural)
5. **Off-peak scheduling** (2-6 AM target site local time for heavy scraping)
6. **Playwright** for JS-heavy sites (RM Sotheby's, Mecum)
7. **p-queue** for concurrency control per domain

### Legal Notes:
- hiQ Labs v. LinkedIn (2022): Scraping public data is generally legal in USA
- Only scrape publicly visible data, never circumvent auth
- Store factual data (prices, dates, specs, VINs) - these are not copyrightable
- Truncate/summarize copyrighted descriptions (don't store full text verbatim)
- Respect robots.txt where possible
- GDPR applies to personal data from EU listings (store location at city/region level only)

---

## Currency Handling

Store original currency + amount AND a normalized USD equivalent:

| Region | Currency | Source |
|--------|----------|--------|
| USA | USD | BaT, C&B, PCarMarket |
| Europe | EUR | Mobile.de, AutoScout24, Elferspot |
| UK | GBP | AutoTrader UK, Collecting Cars, PistonHeads |
| Japan | JPY | Goo-net Exchange, BidJDM |

Use historical exchange rate at the listing/sale date for the USD conversion, not current rate.

---

## Execution Roadmap

### Week 1:
- Filter existing scrapers (BaT, C&B, CC) for Porsche only
- Run BaT historical backfill for all Porsche models
- Build NHTSA VIN enrichment middleware
- Create and seed `porsche_model_specs` table (start with 911 and 718)

### Week 2:
- Build PCarMarket scraper
- Build Classic.com scraper
- Integrate Decodo proxies into scraper infrastructure

### Week 3:
- Build Mobile.de scraper (with German proxy)
- Build Elferspot scraper
- Integrate Vincario for European VIN enrichment

### Week 4:
- Build AutoScout24 scraper
- Build AutoTrader UK scraper
- Integrate UK MOT API for mileage verification
- Build price index SQL aggregations

### Week 5+:
- Build Goo-net Exchange scraper (Japan)
- Build BidJDM scraper (Japan)
- Build RM Sotheby's scraper (Playwright)
- Build Bonhams + Gooding scrapers
- Expand `porsche_model_specs` to cover all models/generations

---

## Key Contacts & Resources

- **Vincario support**: Contact through vindecoder.eu dashboard
- **DVSA MOT API support**: Through GitHub documentation page
- **Decodo/SmartProxy support**: Through dashboard.decodo.com
- **Porsche community data sources**: Rennlist.com, Flatsixes.com, press.porsche.com, Rennbow.org (color database)
- **Porsche option codes**: Community-maintained databases on Rennlist forums

---

## Notes for Claude AI Conversations in This Project

When working on this project, always:
1. Reference the existing codebase structure in `src/lib/scrapers/`
2. Follow the existing patterns (Cheerio-based, TypeScript, ScrapedAuction/NormalizedListing types)
3. Route new scrapers through the Decodo proxy
4. Use the Porsche model taxonomy for normalization
5. Prioritize VIN-based deduplication across sources
6. Store prices in original currency + USD equivalent
7. Build on the existing Supabase schema - extend, don't replace
