# Elferspot Collector + Porsche Taxonomy Enrichment — Design Spec

## Summary

Build a full collector module for [Elferspot](https://www.elferspot.com/), the Porsche-only European marketplace (~3,500 listings). Simultaneously, adopt Elferspot's granular model taxonomy (~250+ variants) into `brandConfig.ts`, enriching variant classification across ALL scrapers.

**Two deliverables:**
1. **Taxonomy enrichment** — Expand `brandConfig.ts` variants with Elferspot's complete Porsche model catalog
2. **Full collector module** — `src/features/scrapers/elferspot_collector/` with CLI, checkpoint, cron routes

---

## Part 1: Taxonomy Enrichment

### Goal

Elferspot has the most granular Porsche model taxonomy of any marketplace. Their filter system distinguishes 250+ specific models across all generations. Our current `brandConfig.ts` has only ~70 variants total. By importing Elferspot's catalog, every scraper benefits from better variant matching.

### Complete Elferspot Model Catalog

#### 356 Series (45+ variants)
```
356 (Pre A)
356 Pre-A 1100
356 Pre-A 1300
356 Pre-A 1300 Super
356 Pre-A 1500
356 Pre-A 1500 Speedster
356 Pre-A 1500 Super
356 Pre-A 1600 Speedster
356 A 1300
356 A 1300 Super
356 A 1500 GS Carrera
356 A 1500 GS Carrera GT
356 A 1500 GS GT Speedster
356 A 1500 GS Speedster
356 A 1600
356 A 1600 Convertible D
356 A 1600 GS Carrera de Luxe
356 A 1600 GS Carrera de Luxe GT
356 A 1600 Speedster
356 A 1600 Super
356 A 1600 Super Convertible D
356 A 1600 Super Speedster
356 A Speedster Carrera GS
356 America Roadster
356 B 1600
356 B 1600 GLT ABARTH
356 B 1600 GS Carrera
356 B 1600 GS Carrera GT
356 B 1600 Roadster
356 B 1600 Super
356 B 1600 Super 90
356 B 1600 Super 90 GT
356 B 1600 Super 90 Roadster
356 B 1600 Super Roadster
356 B 2000 GS Carrera
356 B 2000 GS GT
356 C
356 C 2000 GS Carrera 2
356 SC
```
*Note: Exclude non-production variants (Junior, Modified, Outlaw, Replica, Zagato, Rod Emory Outlaw) — these are custom/aftermarket, not factory models.*

#### 911 F-Model (13 variants)
```
901
911
911 L
911 T
911 T (US)
911 S
911 E
911 R
911 ST
911 T/R
911 Carrera RS
911 Carrera 2.8 RSR
```

#### 911 G-Model (25 variants)
```
911 G-Modell
911 S (G-Modell)
911 Carrera 2.7
911 Carrera (US)
911 Carrera RS 3.0
911 Carrera RSR 3.0
911 Carrera 3.0
911 SC
911 SC (US)
911 SC 3.1
911 SC Group 4
911 SC/RS
911 Carrera 3.2
911 Carrera 3.2 (KAT)
911 Carrera 3.2 (US)
911 Carrera 3.2 Clubsport
911 Carrera 3.2 Clubsport (US)
911 Carrera 3.2 Speedster
911 Carrera 3.2 Speedster (US)
911 Carrera 3.2 Supersport
911 Carrera 3.2 WTL
911 Carrera 3.2 "25 Jahre 911"
```

#### 930 Turbo (11 variants)
```
911 Turbo 3.0
911 Turbo 3.0 (US)
911 Turbo 3.3
911 Turbo 3.3 (US)
911 Turbo 3.3 WLS
911 Turbo 5 Gang
911 Turbo Flachbau
911 Turbo S 3.3
934
911 TAG Turbo by Lanzante
911 Turbo 3.3 RUF BTR Conversion
```

#### 964 (20 variants)
```
964 Carrera 2
964 Carrera 2 Cabrio WTL
964 Carrera 2 Speedster
964 Carrera 4
964 Carrera 4 Lightweight
964 Carrera 4 WTL
964 America Roadster
964 Carrera RS
964 Carrera RS 3.8
964 Carrera RS America
964 Carrera RS N/GT
964 Carrera RSR 3.8
964 Cup
964 Jubilaeumsmodell "30 Jahre 911"
964 Turbo
964 Turbo 3.6
964 Turbo Flachbau
964 Turbo S Leichtbau
964 Turbo S2
964 Turbo WLS
```

#### 993 (17 variants)
```
993 Carrera
993 Carrera 3.8
993 Carrera 4
993 Carrera 4S
993 Carrera RS
993 Carrera S
993 Cup 3.8 RSR
993 3.8 Cup
993 GT2
993 GT2 Evo
993 GT2 Tribute
993 Turbo
993 Turbo Cabrio
993 Turbo S
993 Turbo WLS 1
993 Turbo WLS 2
```

#### 996 (22 variants)
```
996 Carrera
996 Carrera 4
996 Carrera 4S
996 Carrera R
996 Carrera "40 Jahre 911"
996 Carrera 4 Millennium Edition
996.2 Carrera
996.2 Carrera 4
996 GT2
996 GT2 Clubsport
996 GT2 R
996 GT3
996 GT3 Clubsport
996 GT3 Cup
996 GT3 R
996 GT3 RS
996 GT3 RSR
996.2 GT3
996.2 GT3 Clubsport
996 Turbo
996 Turbo S
```

#### 997 (30 variants)
```
997 Carrera
997 Carrera S
997 Carrera 4
997 Carrera 4S
997.2 Carrera
997.2 Carrera S
997.2 Carrera 4
997.2 Carrera 4S
997.2 Carrera GTS
997.2 Carrera 4 GTS
997.2 Carrera Black Edition
997 GT2
997 GT2 RS
997 GT3
997 GT3 Cup
997 GT3 Cup S
997 GT3 RS
997 GT3 RS 4.0
997 GT3 RSR
997.2 GT3
997.2 GT3 Cup
997.2 GT3 R
997.2 GT3 RS
997.2 GT3 RSR
997 Sport Classic
997 Speedster
997 Turbo
997.2 Turbo
997.2 Turbo S
```

#### 991 (38 variants)
```
991 Carrera
991 Carrera 4
991 Carrera S
991 Carrera 4S
991 Carrera GTS
991 Carrera 4 GTS
991 Carrera T (implied from 991.2)
991 Carrera S 50 Jahre Edition
991 Carrera Black Edition
991 Carrera 4 Black Edition
991 Carrera S Martini Racing Edition
991 Carrera GTS Rennsport Reunion Edition
991 Club Coupe
991.2 Carrera
991.2 Carrera S
991.2 Carrera 4
991.2 Carrera 4S
991.2 Carrera GTS
991.2 Carrera 4 GTS
991.2 Carrera T
991 GT2 RS
991 GT2 RS Clubsport
991 GT3
991 GT3 Touring
991 GT3 Cup
991 GT3 R
991 GT3 RS
991 GT3 RSR
991.2 GT3
991.2 GT3 RS
911 R
911 GT America
991 Targa 4S Exclusive Edition
991.2 Targa 4 GTS Exclusive Manufaktur Edition
991 Turbo
991 Turbo S
991 Turbo S Exclusive Series
991.2 Turbo
991.2 Turbo S
991 Speedster
```

#### 992 (35 variants)
```
992 Carrera
992 Carrera 4
992 Carrera 4S
992 Carrera S
992 Carrera T
992 Carrera GTS
992 Carrera 4 GTS
992 Edition 50 Jahre Porsche Design
992 Heritage Design Edition
992 Belgian Legend Edition
992 GT3
992 GT3 Cup
992 GT3 R
992 GT3 RS
992 GT3 Touring
992 Sport Classic
992 Turbo
992 Turbo 50 Jahre
992 Turbo S
992.2 Carrera
992.2 Carrera S
992.2 Carrera 4S
992.2 Carrera T
992.2 Carrera GTS
992.2 Carrera 4 GTS
992.2 Carrera GTS "Cuarenta Edition"
992.2 GT3
992.2 GT3 Touring
992.2 Turbo S
911 Dakar
911 S/T
911 Sally Special
911 Spirit 70
911 GT3 R Rennsport
```

#### 718 / 982 (24 variants)
```
718 Boxster
718 Boxster 25 Years
718 Boxster GTS
718 Boxster GTS 4.0
718 Boxster S
718 Boxster Style Edition
718 Boxster T
718 Cayman
718 Cayman GT4
718 Cayman GT4 Clubsport
718 Cayman GT4 RS
718 Cayman GT4 RS Clubsport
718 Cayman GT4 Sports Cup Edition
718 Cayman GTS
718 Cayman GTS 4.0
718 Cayman S
718 Cayman Style Edition
718 Cayman T
718 Spyder
718 Spyder 2.0
718 Spyder RS
718 RS 60 Spyder
718 RS 61 Spyder
718 RSK Spyder
```

#### 981 (11 variants)
```
981 Boxster
981 Boxster Black Edition
981 Boxster GTS
981 Boxster S
981 Boxster Spyder
981 Cayman
981 Cayman Black Edition
981 Cayman GT4
981 Cayman GT4 Clubsport
981 Cayman GTS
981 Cayman S
```

#### 987 (10 variants)
```
987 Boxster
987 Boxster S
987 Boxster S Black Edition
987 Boxster RS 60 Spyder
987 Boxster Spyder
987 Cayman
987 Cayman S
987 Cayman S Black Edition
987 Cayman R
987 Cayman Cup
```

#### 986 (3 variants)
```
986 Boxster
986 Boxster S
986 Boxster S "50 Jahre 550 Spyder"
```

#### 914 (9 variants)
```
914 1.7
914 1.8V
914 2.0
914/6
914/6 GT
914/6 GT Tribute
914/8 (S II)
916
916 Tribute
```

#### 944 (9 variants)
```
944 Coupe
944 GTR
944 S Coupe
944 S2 Cabriolet
944 S2 Coupe
944 Turbo Cabriolet
944 Turbo Coupe
944 Turbo Cup
944 Turbo S Coupe
```

#### 928 (6 variants)
```
928
928 GT
928 GTS
928 S
928 S4
928 S4 Clubsport
```

#### 968 (4 variants)
```
968
968 Club Sport
968 Turbo S
968 Turbo RS
```

#### 924 (7 variants)
```
924
924 Carrera GT
924 Carrera GTP
924 Carrera GTR
924 Carrera GTS
924 S
924 Turbo
```

#### 918 (1 variant)
```
918 Spyder
```

#### Carrera GT (2 variants)
```
Carrera GT
Carrera GT-R
```

#### 959 (4 variants)
```
959
959 S
959 Sport
959 Prototyp
```

#### Taycan (16 variants)
```
Taycan
Taycan 4
Taycan 4 Cross Turismo
Taycan 4S
Taycan 4S Cross Turismo
Taycan 4S Sport Turismo
Taycan GTS
Taycan GTS Sport Turismo
Taycan Sport Turismo
Taycan Turbo
Taycan Turbo Cross Turismo
Taycan Turbo GT
Taycan Turbo S
Taycan Turbo S Cross Turismo
Taycan Turbo S Sport Turismo
Taycan Turbo Sport Turismo
```

#### Panamera (18 variants)
```
Panamera
Panamera 4
Panamera S
Panamera 4S
Panamera S Hybrid
Panamera GTS
Panamera Turbo
Panamera Turbo S
Panamera Diesel
Panamera 4S Executive
Panamera S E-Hybrid
Panamera Turbo Executive
Panamera Turbo S Executive
Panamera 4 E-Hybrid
Panamera Turbo S E-Hybrid
Panamera 4S Diesel
Panamera 4S E-Hybrid
Panamera Turbo E-Hybrid
```

### Implementation Approach

Expand the existing `variants` array in each `SeriesConfig` within `brandConfig.ts`. Each variant gets:

```ts
{ id: "carrera-rs-3.8", label: "Carrera RS 3.8", keywords: ["rs 3.8", "carrera rs 3.8"] }
```

**Rules for variant IDs:**
- Lowercase, hyphen-separated: `turbo-s-leichtbau`
- Sub-generation prefix where applicable: no prefix needed (the series already scopes it)
- Racing/special editions get descriptive IDs: `heritage-design-edition`, `martini-racing`

**Rules for keywords:**
- Most specific keyword first (longest match wins in `matchVariant()`)
- Include common abbreviations and spelling variants
- Exclude racing-only variants that would never appear in normal listings (Cup, RSR, R) unless they appear in road-car form

**Scope:** All series that Elferspot covers. For Cayenne and Macan (not on Elferspot), keep existing variants unchanged.

**Sub-generation handling (991.2, 997.2, 996.2, 992.2):** These are variants within their parent series, not separate series. The `.2` prefix in the variant ID distinguishes them: `{ id: "991.2-carrera", label: "991.2 Carrera", keywords: ["991.2 carrera"] }`.

**File organization:** The variant catalog will significantly expand `brandConfig.ts`. Extract variant arrays into a separate file `src/lib/brandVariants.ts` that `brandConfig.ts` imports. This keeps the main config file manageable.

```ts
// src/lib/brandVariants.ts
export const PORSCHE_992_VARIANTS: VariantConfig[] = [
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  { id: "carrera-s", label: "Carrera S", keywords: ["carrera s"] },
  // ... 33 more
]

// src/lib/brandConfig.ts
import { PORSCHE_992_VARIANTS } from './brandVariants'
// ...
{ id: "992", ..., variants: PORSCHE_992_VARIANTS }
```

**Regression safety:** After expanding variants, run `matchVariant()` against a test suite of real listing titles from all existing scrapers (BaT, AS24, AutoTrader, BeForward, Classic.com) to verify no regressions. Include test cases for:
- Generic titles ("Porsche 911 Carrera") — should still match the correct base variant
- Titles with multiple keywords ("964 Carrera RS 3.8") — most specific wins
- Non-Porsche text that could false-match — should not match

---

## Part 2: Elferspot Collector Module

### Site Analysis

| Property | Value |
|----------|-------|
| URL | https://www.elferspot.com/ |
| Focus | Porsche-only marketplace |
| Listings | ~3,500 active |
| Rendering | Server-side HTML (WordPress) |
| Structured data | JSON-LD Schema.org `Vehicle` on detail pages |
| Anti-bot | None (no Cloudflare/Akamai) |
| robots.txt | 10-second crawl delay for default bots |
| Languages | en, de, nl, fr |
| Currency | EUR |
| Pagination | `/en/search/page/{n}/`, ~20 listings/page, ~95 pages |
| Series filter | `/en/search/series/{series}/` (German: `/de/suchen/baureihe/{series}/`) |
| Detail URLs | `/en/car/{model-slug}-{year}-{id}/` |
| CDN images | `cdn.elferspot.com/wp-content/uploads/...` |

### Architecture

```
src/features/scrapers/elferspot_collector/
├── types.ts            # ElferspotRawListing, ElferspotDetail interfaces
├── discover.ts         # Parse search pages → listing URLs + basic data
├── detail.ts           # Parse detail pages: JSON-LD primary + Cheerio fallback
├── normalize.ts        # Map to unified listing schema + variant matching
├── supabase_writer.ts  # Upsert on (source='Elferspot', source_id)
├── checkpoint.ts       # { lastPage, processedIds } for resume
├── collector.ts        # Orchestrator: discover → [detail] → normalize → write
├── cli.ts              # CLI flags: --maxPages, --scrapeDetails, --dryRun, etc.
└── *.test.ts           # Unit tests for discover, detail, normalize
```

### Data Extraction

**Search pages** (Cheerio parse of `/en/search/page/{n}/`):
- Title (model name)
- Year
- Country (from flag icon)
- Thumbnail image URL
- Detail page URL → extract source_id from slug (numeric suffix, e.g., `5856995`)

**Detail pages** (JSON-LD primary + Cheerio fallback):

| Field | JSON-LD path | Cheerio fallback |
|-------|-------------|-----------------|
| Price | `offers.price` | Spec table |
| Currency | `offers.priceCurrency` | Always EUR |
| Year | `dateVehicleFirstRegistered` | Spec table |
| Mileage (km) | `mileageFromOdometer.value` | Spec table |
| Transmission | `vehicleTransmission` | Spec table |
| Body type | `bodyType` | Spec table |
| Drive | `driveWheelConfiguration` | Spec table |
| Color (ext) | `color` | Spec table |
| Model | `model` | Title/heading |
| Fuel | — | Spec table |
| Engine (L + HP) | — | Spec table / description |
| Interior color | — | Spec table |
| VIN | — | Spec table (if present) |
| Seller name | — | Seller section |
| Seller type | — | Seller section (dealer/private) |
| Location | — | Seller section (city, country) |
| Description | — | Description section |
| Images | — | Gallery `<img>` tags, `cdn.elferspot.com` URLs |
| Condition | — | Spec table (accident-free, matching numbers, PTS) |
| First registration | `dateVehicleFirstRegistered` | Spec table |

### Collector Flow

```
CLI/Cron
  │
  ▼
collector.ts
  │
  ├── Load checkpoint (if resuming)
  │
  ├── DISCOVERY LOOP (search pages)
  │   ├── GET /en/search/page/{n}/
  │   ├── Parse with Cheerio → [{url, title, year, country, thumb}]
  │   ├── Extract source_id from URL slug
  │   ├── Skip if already in processedIds (checkpoint)
  │   ├── If --scrapeDetails: fetch detail page
  │   │   ├── Parse JSON-LD → structured data
  │   │   └── Cheerio fallback for remaining fields
  │   ├── normalize → unified listing schema
  │   ├── supabase_writer.upsert()
  │   ├── Save checkpoint after each page
  │   └── Wait delayMs (default: 10000ms per robots.txt)
  │
  └── Summary: discovered, written, errors, duration
```

### Rate Limiting

- **10-second delay** between page requests (robots.txt compliance)
- At 10s/page: 25 pages = 250s, 95 pages = ~16 minutes
- No concurrent requests (sequential only)

### CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--maxPages` | `25` | Max search pages to crawl |
| `--maxListings` | `3500` | Cap total listings |
| `--scrapeDetails` | `false` | Also fetch detail pages |
| `--delayMs` | `10000` | Delay between requests (ms) |
| `--dryRun` | `false` | Skip DB writes |
| `--checkpointPath` | `var/elferspot_collector/checkpoint.json` | Resume file (CLI default; cron uses `/tmp/`) |
| `--outputPath` | `var/elferspot_collector/listings.jsonl` | JSONL output |
| `--language` | `en` | Site language (en, de, nl, fr) |

### Cron Routes

**Discovery** (`/api/cron/elferspot`):
- Schedule: `15 9 * * *` (09:15 UTC daily — after enrich-beforward at 08:00)
- Config: `maxPages=25`, `scrapeDetails=false`, `delayMs=10000`
- At 10s/page, 25 pages = ~250s (fits 5-min Vercel limit)
- Upserts basic data: title, year, model, source_url, country, thumbnail

**Enrichment** (`/api/cron/enrich-elferspot`):
- Schedule: `45 9 * * *` (09:45 UTC daily — after discovery)
- Config: 50 listings/run, 5s delay between fetches
- Queries: `WHERE source='Elferspot' AND description_text IS NULL` (more robust than trim)
- At 5s/listing, 50 listings = ~250s (fits 5-min limit)
- JSON-LD + Cheerio → price, mileage, engine, transmission, colors, images, VIN, seller
- **"Price on request" handling:** If no price found in JSON-LD or HTML, write `price=NULL` (column accepts NULL). Log as a warning, not an error.

### Normalization

`normalize.ts` maps Elferspot data to our unified `listings` table schema:

| Elferspot field | DB column | Notes |
|----------------|-----------|-------|
| source_id (from URL) | `source_id` | Numeric ID from slug |
| `"Elferspot"` | `source` | Constant |
| detail URL | `source_url` | Full URL |
| title | `title` | As-is |
| model name | `model` | Run through `extractSeries()` for series matching |
| year | `year` | Integer |
| price | `price` | Numeric (EUR) |
| `"EUR"` | `original_currency` | Always EUR |
| mileage | `mileage_km` | Already in km |
| transmission | `transmission` | Map: PDK→Automatic, Manual→Manual |
| body type | `body_style` | Map: Coupé→Coupe, Cabriolet→Convertible |
| exterior color | `color_exterior` | As-is |
| interior color | `color_interior` | As-is |
| engine | `engine` | e.g., "4.0L 510 HP" |
| VIN | `vin` | If present |
| description | `description_text` | As-is |
| images | `images` | Array of CDN URLs |
| image count | `photos_count` | images.length |
| country | `country` | From seller location |
| location | `location` | City, Country |
| seller type | `seller_type` | "dealer" or "private" |
| seller name | `seller_name` | As-is |
| condition | `condition` | If present |
| `"active"` | `status` | Constant for new listings |
| make | `make` | Always "Porsche" |

**Variant matching:** After `extractSeries()` determines the series, call `matchVariant()` with the Elferspot model name to get the specific variant (e.g., "964 Carrera RS 3.8" → series `964`, variant `carrera-rs-3.8`). Store the raw trim text from Elferspot in the `trim` column (e.g., "Carrera RS 3.8"), consistent with all other scrapers. The variant ID is derived at display time via `matchVariant()`.

### Error Handling

- **Circuit-break** on HTTP 403/429 responses
- **Mark delisted** on HTTP 404/410 (set `status='delisted'`)
- **Time budget**: 270s within 5-min Vercel limit
- **Consecutive failure limit**: 5 failures → stop
- **Rate limit compliance**: Always respect 10s delay

### Monitoring

- Add `'elferspot'` and `'enrich-elferspot'` to the `ScraperName` type union in `src/features/scrapers/common/monitoring/types.ts`
- Both crons call `markScraperRunStarted()` / `recordScraperRun()` / `clearScraperRunActive()`
- Add to `vercel.json` cron schedule
- Add entries to monitoring dashboard status cards

### Staleness / Delisting Strategy

Listings that disappear from Elferspot search results won't be detected by the discovery cron (it only processes what it finds). Two mechanisms handle this:

1. **Enrichment 404/410 detection:** During enrichment, if a detail page returns 404/410, mark `status='delisted'`.
2. **Existing cleanup cron:** The daily cleanup at 06:00 UTC already marks stale listings. Elferspot listings older than 30 days without a fresh `scrape_timestamp` will be caught by the same staleness rules applied to all sources. The discovery cron should always update `scrape_timestamp` for listings it finds in search results (even if no other data changed), so listings still on Elferspot stay fresh.

### HTTP-Only Architecture Note

This collector uses **plain HTTP fetch + Cheerio** (no Playwright, no browser, no proxy). Unlike Classic.com and AutoScout24, Elferspot has no Cloudflare/Akamai protection and serves server-rendered HTML from WordPress. This means:
- No `rebrowser-playwright` dependency
- No Decodo/SmartProxy credentials needed
- No GitHub Actions workflow needed (Vercel Cron is sufficient)
- Simpler CI/CD — just `npm ci`, no browser installation step

### Updated Daily Schedule

```
...
07:15  Title Enrichment           (Vercel Cron, 1 min)
08:00  BeForward Enrichment       (Vercel Cron, 5 min)    (existing)
09:15  Elferspot Collector        (Vercel Cron, 5 min)    ← NEW
09:45  Elferspot Enrichment       (Vercel Cron, 5 min)    ← NEW
```

---

## Part 3: Testing Strategy

### Unit Tests

- `discover.test.ts` — Parse search page HTML fixtures → extract listing URLs, titles, years
- `detail.test.ts` — Parse detail page HTML fixtures → extract JSON-LD data + Cheerio fallback
- `detail.test.ts` — Handle "Price on request" listings (no price in JSON-LD)
- `normalize.test.ts` — Map raw Elferspot data to unified schema, verify variant matching
- Cron route tests — Auth, empty results, monitoring lifecycle (standard pattern)

### Variant Regression Tests

After expanding `brandConfig.ts` variants, add regression tests in `brandConfig.test.ts`:

```ts
// Verify no regressions for existing scrapers
it("matches 964 Carrera RS 3.8 to most specific variant", () => {
  expect(matchVariant("964 Carrera RS 3.8", null, "964", "Porsche")).toBe("carrera-rs-3.8")
})
it("matches generic 964 Carrera to base carrera variant", () => {
  expect(matchVariant("964 Carrera", null, "964", "Porsche")).toBe("carrera-2") // or "carrera"
})
it("existing BaT title still matches correctly", () => {
  expect(matchVariant("911 Turbo", null, "997", "Porsche")).toBe("turbo")
})
```

Run against a corpus of real listing titles from existing scraper data to catch any regressions.

### Integration Testing

- CLI dry run: `npx tsx src/features/scrapers/elferspot_collector/cli.ts --dryRun --maxPages=2`
- Verify JSONL output contains correct fields
- Verify checkpoint saves and resumes correctly

---

## Out of Scope

- **Cayenne/Macan variants**: Elferspot doesn't list these (sports car focused). Keep existing brandConfig variants.
- **Non-Porsche brands**: Elferspot is Porsche-only.
- **Custom/aftermarket models**: Exclude RUF, Gemballa, Singer, 911 Backdate/Modified, Outlaw, Replica categories — these are not factory Porsche models.
- **UI changes**: The expanded variants will automatically appear in variant chip components via existing `matchVariant()` integration. No UI code changes needed.
