# Scraper Architecture Overview

Last updated: 2026-05-12

## Active Scrapers

| # | Scraper | Source | Runtime | Schedule | Strategy |
|---|---------|--------|---------|----------|----------|
| 1 | AutoScout24 | Dealer listings (EU) | GitHub Actions | Daily 05:00 UTC | HTTP shards → Supabase |
| 2 | AutoTrader UK | Dealer listings (UK) | GitHub Actions | Daily 02:00 UTC | GraphQL `at-gateway` → Supabase |
| 3 | AutoTrader Enrichment | Detail enrichment | **Windows Task Scheduler** | 4×/day (10:00, 13:00, 16:00, 19:00 CET) | Product-page API + HTML + GraphQL |
| 4 | Elferspot | Dealer listings (DE) | Vercel Cron | 2-phase: discovery + enrichment | HTTP + detail enrichment |
| 5 | BeForward | Dealer listings (JP→export) | Vercel Cron | Daily 03:00 UTC | HTTP summary-only |
| 6 | Classic.com | Dealer + auction (US) | GitHub Actions | Daily | Scrapling (Playwright) |
| 7 | BaT (Porsche) | Auctions | Vercel Cron | Daily 01:00 UTC | HTTP + detail scrape |
| 8 | BaT (Ferrari) | Auctions | Vercel Cron | Daily 00:00 UTC | HTTP + detail scrape |

---

## AutoTrader Enrichment

### Why Windows Task Scheduler?

AutoTrader uses Cloudflare protection that blocks all datacenter IPs:
- **Vercel cron** → 403 (removed from `vercel.json` in commit `4306257`)
- **GitHub Actions** → 403 (Azure/AWS datacenter IPs)
- **Local machine** → Works (residential IP)

The product-page REST API (`/product-page/v1/advert/{id}`) is equally blocked from datacenter IPs — not just the HTML/browser paths.

### Architecture

```
Windows Task Scheduler (4×/day, 10:00–19:00 CET)
    │
    ▼
scripts/autotrader-enrich-scheduled.bat
    │
    ▼
scripts/autotrader-enrich.ts
    │
    ▼
fetchAutoTraderDetail()  [src/features/scrapers/autotrader_collector/detail.ts]
    │
    ├─► Strategy 1: Product-page REST API  (/product-page/v1/advert/{id})
    ├─► Strategy 2: HTML scrape + Cheerio
    ├─► Strategy 3: GraphQL at-gateway fallback (missing mileage/images)
    └─► Strategy 4: Scrapling fallback (headless browser, if available)
    │
    ▼
Supabase updates (enriches null fields, delists 404s)
```

### Scheduled Tasks

| Task Name | Time (CET) | What it does |
|-----------|------------|--------------|
| `Monza\AutoTrader-Enrich-10h` | 10:00 | Enrich up to 500 listings |
| `Monza\AutoTrader-Enrich-13h` | 13:00 | Enrich up to 500 listings |
| `Monza\AutoTrader-Enrich-16h` | 16:00 | Enrich up to 500 listings |
| `Monza\AutoTrader-Enrich-19h` | 19:00 | Enrich up to 500 listings |

**Requirement:** PC must be on and logged in (tasks run in interactive mode).

### Enrichment behavior

- Queries active AutoTrader listings missing `engine`, `transmission`, `mileage`, `description_text`, `current_bid`, or `photos_count < 5`
- Ordered by `updated_at ASC` (oldest first)
- Only updates null fields (never overwrites existing data)
- Delists listings that return 404 from the product-page API
- Circuit-breaks after 10 consecutive failures
- 20-minute time budget per run
- Logs to `scripts/logs/autotrader-enrich.log`

### CLI usage

```bash
# Standard run (500 listings, 2s delay)
npx tsx scripts/autotrader-enrich.ts --limit=500 --delayMs=2000

# Dry run (no DB writes)
npx tsx scripts/autotrader-enrich.ts --limit=100 --dryRun

# Custom time budget
npx tsx scripts/autotrader-enrich.ts --limit=1000 --timeBudgetMs=1800000
```

### Managing scheduled tasks

```powershell
# View all Monza tasks
schtasks /query /tn "Monza\*" /fo LIST

# Delete all enrichment tasks
schtasks /delete /tn "Monza\AutoTrader-Enrich-10h" /f
schtasks /delete /tn "Monza\AutoTrader-Enrich-13h" /f
schtasks /delete /tn "Monza\AutoTrader-Enrich-16h" /f
schtasks /delete /tn "Monza\AutoTrader-Enrich-19h" /f

# Run manually
scripts\autotrader-enrich-scheduled.bat
```

---

## Code Map

### Unified Scraper Framework (`src/features/scrapers/`)

All scrapers live under `src/features/scrapers/` with shared utilities:

| Directory | Scraper |
|-----------|---------|
| `autotrader_collector/` | AutoTrader UK (collector + enrichment) |
| `autoscout24_collector/` | AutoScout24 (EU shards) |
| `beforward_porsche_collector/` | BeForward (JP export) |
| `classic_collector/` | Classic.com (US) |
| `elferspot_collector/` | Elferspot (DE) |
| `collectors/` | Auction scrapers (BaT, C&B, Collecting Cars) |
| `common/` | Shared utilities (proxy, monitoring, backfill, cleanup) |

### AutoTrader Detail Fetcher (`autotrader_collector/detail.ts`)

Multi-strategy detail extraction used by both the Vercel cron route and the CLI enrichment script:

| Strategy | Method | Reliability |
|----------|--------|-------------|
| 1. Product-page API | `GET /product-page/v1/advert/{id}` — structured JSON | Best (when not CF-blocked) |
| 2. HTML scrape | Cheerio parsing of detail page | Good |
| 3. GraphQL fallback | `POST /at-gateway` with `SearchResultsListingsGridQuery` | Good for mileage/images |
| 4. Scrapling | Python headless browser (`StealthyFetcher`) | Last resort |

### Shared Monitoring (`common/monitoring/`)

All scrapers record runs to the `scraper_runs` Supabase table via:
- `markScraperRunStarted()` — marks run as active
- `recordScraperRun()` — writes final metrics (discovered, written, errors, duration)
- `clearScraperRunActive()` — clears active flag

---

## Runtime Environments

| Environment | IP Type | Cloudflare Risk | Used For |
|-------------|---------|-----------------|----------|
| Vercel Cron | Datacenter (AWS) | High | Elferspot, BeForward, BaT, cleanup, validation |
| GitHub Actions | Datacenter (Azure) | High | AS24, AutoTrader collector, Classic.com |
| Windows Task Scheduler | Residential | **None** | AutoTrader enrichment |

### Cloudflare-Blocked Endpoints

These AutoTrader endpoints are blocked from datacenter IPs:
- `/product-page/v1/advert/{id}` (REST API)
- `/at-gateway` (GraphQL)
- `/car-details/{id}` (HTML pages)
- `/car-search` (search pages)

---

## Data Output

All scrapers write to the `listings` table in Supabase:

| Field | Source |
|-------|--------|
| `source`, `source_id`, `source_url` | Scraper identity |
| `year`, `make`, `model`, `trim` | Vehicle identification |
| `engine`, `transmission`, `body_style` | Specs (often from enrichment) |
| `color_exterior`, `color_interior` | Colors |
| `mileage`, `mileage_unit` | Odometer (converted to km) |
| `vin` | Vehicle identification number |
| `current_bid`, `hammer_price`, `final_price` | Pricing |
| `images`, `photos_count` | Gallery |
| `description_text` | Listing description |
| `status` | `active`, `sold`, `unsold`, `delisted` |
| `country`, `region`, `city` | Location |
