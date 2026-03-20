# Scrapers & Collectors

This document explains how to run and test every scraper in the Monza Cars Marketplace repository.

## Prerequisites

```bash
# Install dependencies
npm ci

# For browser-based scrapers (classic_collector, autoscout24_collector)
npx playwright install chromium --with-deps
```

**Environment variables** (in `.env.local`):

```env
# Required for all scrapers (Supabase database)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Required for Vercel cron authentication
CRON_SECRET=your-secret-here

# Optional — residential proxy for browser-based scrapers
DECODO_PROXY_URL=http://gate.smartproxy.com:7000
DECODO_PROXY_USER=username
DECODO_PROXY_PASS=password
```

---

## Overview

### Collectors (Discovery)

| # | Scraper | Source Website | Method | Runtime | Schedule |
|---|---------|---------------|--------|---------|----------|
| 1 | [Porsche Collector](#1-porsche-collector) | BringATrailer, CarsAndBids, CollectingCars | HTTP / HTML | Vercel Cron | 01:00 UTC |
| 2 | [Ferrari Collector](#2-ferrari-collector) | BringATrailer, CarsAndBids, CollectingCars | HTTP / HTML | Vercel Cron | 00:00 UTC |
| 3 | [AutoTrader Collector](#3-autotrader-collector) | AutoTrader UK | GraphQL API | Vercel Cron | 02:00 UTC |
| 4 | [BeForward Collector](#4-beforward-collector) | BeForward | HTTP / HTML | Vercel Cron | 03:00 UTC |
| 5 | [Classic.com Collector](#5-classiccom-collector) | Classic.com (US) | Playwright Browser | GitHub Actions | 04:00 UTC |
| 6 | [AutoScout24 Collector](#6-autoscout24-collector) | AutoScout24 (8 EU countries) | Playwright Browser | GitHub Actions | 05:00 UTC |

### Enrichment & Maintenance

| # | Cron Job | Purpose | Runtime | Schedule |
|---|----------|---------|---------|----------|
| 7 | [Image Backfill](#7-image-backfill-cross-source) | Backfill missing images (BaT, BeForward, AS24) | Vercel Cron | 06:30 UTC |
| 8 | [BaT Detail Scraper](#8-bat-detail-scraper) | Scrape BaT detail pages for images/specs | GitHub Actions | 01:30 UTC |
| 9 | [Listing Validator](#9-listing-validator) | Validate recent listings, fix models, delete junk | Vercel Cron | 05:30 UTC |
| 10 | [Cleanup](#10-cleanup) | Mark stale/dead listings, reclassify, delete junk | Vercel Cron | 06:00 UTC |
| 11 | [VIN Enrichment](#11-vin-enrichment) | Decode VINs via NHTSA API | Vercel Cron | 07:00 UTC |
| 12 | [Title Enrichment](#12-title-enrichment) | Parse engine/transmission/body/trim from titles | Vercel Cron | 07:15 UTC |
| 13 | [AS24 Detail Enrichment](#13-as24-detail-enrichment) | Scrape AS24 detail pages for trim/VIN/colors | Vercel Cron | Manual |

---

## 1. Porsche Collector

**What it does:** Scrapes Porsche auction listings from 3 auction platforms — Bring a Trailer (BaT), Cars & Bids, and Collecting Cars.

**Source directory:** `src/features/porsche_collector/`

### Run locally

```bash
# Daily mode (discover active + recently ended listings)
npx tsx src/features/porsche_collector/cli.ts --mode=daily

# Backfill a specific date range
npx tsx src/features/porsche_collector/cli.ts --mode=backfill --dateFrom=2026-01-01 --dateTo=2026-01-07

# Dry run (no database writes)
npx tsx src/features/porsche_collector/cli.ts --mode=daily --dryRun

# Skip detail page fetches (faster, less data)
npx tsx src/features/porsche_collector/cli.ts --mode=daily --noDetails

# Show help
npx tsx src/features/porsche_collector/cli.ts --help
```

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--mode` | `daily` | `daily` or `backfill` |
| `--make` | `Porsche` | Target make |
| `--endedWindowDays` | `90` | Days back to check ended auctions |
| `--maxActivePages` | `10` | Max pages of active listings per source |
| `--maxEndedPages` | `10` | Max pages of ended listings per source |
| `--dateFrom` | — | Start date for backfill (YYYY-MM-DD) |
| `--dateTo` | — | End date for backfill (YYYY-MM-DD) |
| `--checkpointPath` | `var/porsche_collector/checkpoint.json` | Resume checkpoint file |
| `--dryRun` | `false` | Skip database writes |
| `--noDetails` | `false` | Skip individual listing page fetches |

### Automated schedule

- **Vercel Cron** at `01:00 UTC` daily
- Route: `GET /api/cron/porsche` (requires `Authorization: Bearer <CRON_SECRET>`)
- Steps: refresh active listings → discover new → light backfill (last 30 days)
- Max duration: 5 minutes

### Test the cron route

```bash
# Start dev server
npm run dev

# In another terminal
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/porsche
```

---

## 2. Ferrari Collector

**What it does:** Same as the Porsche Collector but targets Ferrari listings from the same 3 auction platforms.

**Source directory:** `src/features/ferrari_collector/`

### Run locally

```bash
# Daily mode
npx tsx src/features/ferrari_collector/cli.ts --mode=daily

# Backfill
npx tsx src/features/ferrari_collector/cli.ts --mode=backfill --dateFrom=2026-01-01 --dateTo=2026-01-07

# Dry run
npx tsx src/features/ferrari_collector/cli.ts --mode=daily --dryRun

# Show help
npx tsx src/features/ferrari_collector/cli.ts --help
```

### CLI flags

Same as [Porsche Collector](#cli-flags) above. The only difference:

| Flag | Default | Note |
|------|---------|------|
| `--make` | `Porsche` | Can also pass `Ferrari` |
| `--checkpointPath` | `var/ferrari_collector/checkpoint.json` | Different checkpoint file |

### Automated schedule

- **Vercel Cron** at `00:00 UTC` daily (midnight)
- Route: `GET /api/cron/ferrari` (requires `Authorization: Bearer <CRON_SECRET>`)
- Steps: refresh active listings → discover new → light backfill (last 30 days)
- Max duration: 5 minutes

### Test the cron route

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/ferrari
```

---

## 3. AutoTrader Collector

**What it does:** Scrapes Porsche dealer listings from AutoTrader UK using their internal GraphQL API. No browser required.

**Source directory:** `src/features/autotrader_collector/`

### Run locally

This collector does **not** have a CLI entry point. It runs exclusively via the Vercel cron route.

To test it locally, start the dev server and hit the cron endpoint:

```bash
# Start dev server
npm run dev

# Trigger the collector
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/autotrader
```

### Automated schedule

- **Vercel Cron** at `02:00 UTC` daily
- Route: `GET /api/cron/autotrader` (requires `Authorization: Bearer <CRON_SECRET>`)
- Steps: refresh active listings → discover new listings
- Max duration: 5 minutes

---

## 4. BeForward Collector

**What it does:** Scrapes Porsche listings from BeForward, a Japanese used-car export marketplace.

**Source directory:** `src/features/beforward_porsche_collector/`

### Run locally

```bash
# Dry run — no database writes
npx tsx src/features/beforward_porsche_collector/cli.ts --dryRun --maxPages=5

# Production run (full)
npx tsx src/features/beforward_porsche_collector/cli.ts --maxPages=200 --maxDetails=10000 --concurrency=6

# Summary only (skip detail pages, faster)
npx tsx src/features/beforward_porsche_collector/cli.ts --summaryOnly --maxPages=10

# Show help
npx tsx src/features/beforward_porsche_collector/cli.ts --help
```

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--maxPages` | `200` | Max search result pages to crawl |
| `--startPage` | `1` | Page number to start from |
| `--maxDetails` | `10000` | Max detail pages to fetch |
| `--summaryOnly` | `false` | Skip detail page fetches |
| `--concurrency` | `6` | Parallel detail-page fetches |
| `--rateLimitMs` | `2500` | Minimum delay between requests (ms) |
| `--timeoutMs` | `20000` | HTTP request timeout (ms) |
| `--checkpointPath` | `var/beforward_porsche_collector/checkpoint.json` | Resume checkpoint file |
| `--outputPath` | `var/beforward_porsche_collector/listings.jsonl` | JSONL output file |
| `--dryRun` | `false` | Skip database writes |

### Automated schedule

- **Vercel Cron** at `03:00 UTC` daily
- Route: `GET /api/cron/beforward` (requires `Authorization: Bearer <CRON_SECRET>`)
- Runs with capped config: 3 pages, summary-only, to fit Vercel's 5-minute limit
- Max duration: 5 minutes

### Image backfill

The cron route runs with `summaryOnly=true` to fit the 5-minute Vercel limit, so newly discovered listings have no images. After the discovery phase, any remaining time (>30s) is used to **backfill images** for existing listings:

1. Queries Supabase for active BeForward listings where `images IS NULL OR images = '{}'`
2. Fetches each listing's detail page using `fetchAndParseDetail()` (HTTP + cheerio)
3. Updates only `images`, `photos_count`, `updated_at` in the DB
4. Stops 15s before time budget expires
5. Circuit-breaks on 403/429 (site blocking)

**Config:** max 20 listings per run, 2.5s rate limit between fetches. Backfill stats (`backfill_discovered`, `backfill_written`) are recorded in the `scraper_runs` table and returned in the response JSON.

**Source:** `src/features/beforward_porsche_collector/backfill.ts`

### Test the cron route

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/beforward
```

The response includes a `backfill` object:
```json
{
  "backfill": { "discovered": 20, "backfilled": 2, "errors": [] }
}
```

---

## 5. Classic.com Collector

**What it does:** Scrapes Porsche for-sale listings from Classic.com (US market) using a headless Playwright browser. Uses Decodo/SmartProxy residential proxies to bypass Cloudflare protection.

**Source directory:** `src/features/classic_collector/`

### Run locally

```bash
# Quick dry run — visible browser, 5 listings
npx tsx src/features/classic_collector/cli.ts --dryRun --headed --maxListings=5

# Production run with defaults (headless)
npx tsx src/features/classic_collector/cli.ts --maxPages=20

# With proxy
npx tsx src/features/classic_collector/cli.ts --proxyServer=http://gate.smartproxy.com:7000

# Show help
npx tsx src/features/classic_collector/cli.ts --help
```

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--make` | `Porsche` | Target make |
| `--location` | `US` | Location filter |
| `--status` | `forsale` | Listing status filter |
| `--maxPages` | `10` | Max search pages to crawl |
| `--maxListings` | `500` | Max listings to process |
| `--headed` | `false` | Show the browser window (debug mode) |
| `--navigationDelayMs` | `3000` | Delay between page navigations (ms) |
| `--pageTimeoutMs` | `30000` | Page load timeout (ms) |
| `--proxyServer` | env `DECODO_PROXY_URL` | Proxy server URL |
| `--proxyUsername` | env `DECODO_PROXY_USER` | Proxy username |
| `--proxyPassword` | env `DECODO_PROXY_PASS` | Proxy password |
| `--checkpointPath` | `var/classic_collector/checkpoint.json` | Resume checkpoint file |
| `--outputPath` | `var/classic_collector/listings.jsonl` | JSONL output file |
| `--dryRun` | `false` | Skip database writes |

### Automated schedule

- **GitHub Actions** at `04:00 UTC` daily
- Workflow: `.github/workflows/classic-collector.yml`
- Timeout: 30 minutes
- Can be triggered manually via `workflow_dispatch` with overrides for `max_pages`, `max_listings`, `dry_run`
- Output artifacts uploaded with 7-day retention

### Image backfill

When running with `summaryOnly=true` (the Vercel cron default), listings are ingested without images. After the discovery/write loop, if >40s of time budget remains, the collector automatically backfills images:

1. Queries Supabase for active ClassicCom listings where `images IS NULL OR images = '{}'`
2. Navigates to each listing's detail page using the existing Playwright `page` object
3. Extracts vehicle images from `images.classic.com/vehicles/` sources
4. Updates only `images`, `photos_count`, `updated_at` in the DB
5. Stops 20s before time budget expires (Playwright cleanup is slower)
6. Circuit-breaks on Cloudflare challenges

**Config:** max 5 listings per run (Playwright is ~10-15s/listing). Backfill stats are recorded in `scraper_runs` as `backfill_discovered`/`backfill_written`.

**Source:** `src/features/classic_collector/backfill.ts`

### Dedicated bulk image backfill

For large-scale ClassicCom image backfill, a separate GitHub Actions workflow processes up to 200 listings per run using Playwright with Decodo residential proxy (required to bypass Cloudflare):

- **GitHub Actions** at `04:30 UTC` daily (after the collector at 04:00)
- Workflow: `.github/workflows/classic-backfill-images.yml`
- Timeout: 45 minutes
- Uses `scripts/backfill-classic-images.ts` CLI

**Run locally** (requires `DECODO_PROXY_*` env vars in `.env.local`):
```bash
npx tsx scripts/backfill-classic-images.ts --maxListings=50 --navigationDelayMs=4000
npx tsx scripts/backfill-classic-images.ts --headed   # debug with visible browser
```

**Note:** Without Decodo proxy credentials, Cloudflare blocks the headless browser after 1-2 requests. The proxy is mandatory for bulk backfill.

### Trigger manually on GitHub

Go to **Actions > Classic.com Collector (Daily) > Run workflow** and optionally override:

| Input | Default |
|-------|---------|
| Max search pages | `5` |
| Max listings to process | `125` |
| Skip DB writes | `false` |

Go to **Actions > Classic.com Image Backfill > Run workflow** for dedicated image backfill:

| Input | Default |
|-------|---------|
| Max listings to backfill | `200` |
| Delay between pages (ms) | `4000` |
| Time budget (ms) | `2400000` (40 min) |

---

## 6. AutoScout24 Collector

**What it does:** Scrapes Porsche listings from AutoScout24 across 8 European countries (Germany, Austria, Belgium, Spain, France, Italy, Luxembourg, Netherlands). Uses a headless Playwright browser. Shards searches by model + year range + country to overcome the 20-page pagination limit (~31,000 total listings).

**Source directory:** `src/features/autoscout24_collector/`

### Run locally

```bash
# Quick test — dry run, Luxembourg only, 10 listings
npx tsx src/features/autoscout24_collector/cli.ts --dryRun --maxListings=10 --countries=L

# Germany only, 100 listings
npx tsx src/features/autoscout24_collector/cli.ts --dryRun --maxListings=100 --countries=D

# All countries, with detail page scraping (slower but richer data)
npx tsx src/features/autoscout24_collector/cli.ts --countries=D,A,I --scrapeDetails --maxListings=500

# Full run, all 8 countries (takes ~1 hour)
npx tsx src/features/autoscout24_collector/cli.ts --maxListings=50000

# Debug mode — visible browser, few listings
npx tsx src/features/autoscout24_collector/cli.ts --headed --dryRun --maxListings=5 --countries=L

# Resume an interrupted run (reads checkpoint automatically)
npx tsx src/features/autoscout24_collector/cli.ts

# Show help
npx tsx src/features/autoscout24_collector/cli.ts --help
```

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--make` | `Porsche` | Target make |
| `--countries` | `D,A,B,E,F,I,L,NL` | Country codes (D=Germany, A=Austria, B=Belgium, E=Spain, F=France, I=Italy, L=Luxembourg, NL=Netherlands) |
| `--maxPagesPerShard` | `20` | Max pages per search shard (AS24 caps at 20) |
| `--maxListings` | `50000` | Max total listings to process |
| `--navigationDelayMs` | `3000` | Delay between page navigations (ms) |
| `--pageTimeoutMs` | `30000` | Page load timeout (ms) |
| `--scrapeDetails` | `false` | Fetch individual listing pages for enriched data (VIN, colors, description) |
| `--headed` | `false` | Show the browser window (debug mode) |
| `--checkpointPath` | `var/autoscout24_collector/checkpoint.json` | Resume checkpoint file |
| `--outputPath` | `var/autoscout24_collector/listings.jsonl` | JSONL output file |
| `--dryRun` | `false` | Skip database writes |

### Country codes

| Code | Country |
|------|---------|
| `D` | Germany |
| `A` | Austria |
| `B` | Belgium |
| `E` | Spain |
| `F` | France |
| `I` | Italy |
| `L` | Luxembourg |
| `NL` | Netherlands |

### Automated schedule

- **GitHub Actions** at `05:00 UTC` daily
- Workflow: `.github/workflows/autoscout24-collector.yml`
- Timeout: 60 minutes
- Can be triggered manually via `workflow_dispatch` with overrides

### Trigger manually on GitHub

Go to **Actions > AutoScout24 Collector (Daily) > Run workflow** and optionally override:

| Input | Default |
|-------|---------|
| Max listings to process | `2000` |
| Country codes | `D,A,B,E,F,I,L,NL` |
| Max pages per shard | `20` |
| Fetch detail pages | `false` |
| Skip DB writes | `false` |

---

## 7. Image Backfill (Cross-Source)

**What it does:** Finds active listings with missing images across BaT, BeForward, and AutoScout24, fetches images from each listing's source URL, and updates the database. ClassicCom is excluded (handled by its own Playwright-based backfill inside the Classic.com collector).

**Source files:**
- Core module: `src/features/scrapers/common/backfillImages.ts`
- BaT image extractor: `src/features/scrapers/auctions/bringATrailerImages.ts`
- Cron route: `src/app/api/cron/backfill-images/route.ts`
- CLI script: `scripts/backfill-images.ts`

### How it works

1. Queries Supabase for active listings where `images = '{}'` (empty array)
2. For each listing, fetches the source URL and extracts images:
   - **BaT**: cheerio HTML parse (gallery/CDN images, filters thumbnails)
   - **BeForward**: `parseDetailHtml()` from BeForward collector (cheerio)
   - **AutoScout24**: `parseDetailHtml()` from AutoScout24 collector (cheerio)
3. Updates only `images`, `photos_count`, `updated_at` in the database
4. Circuit-breaks on 403/429/Cloudflare responses
5. Records run metrics via `recordScraperRun()` monitoring

### Dead URL handling (404/410)

When a listing's source URL returns **404 or 410** (removed from marketplace), the backfill module:

1. Sets `images = ['__dead_url__']` — sentinel value to stop re-querying
2. Sets `status = 'unsold'` — removes the listing from the active frontend feed
3. Logs the dead URL as an error for monitoring

The [Cleanup cron](#10-cleanup) (Step 1c) also retroactively catches any older `__dead_url__` listings that were marked before this fix was deployed and sets them to `unsold`.

**Source:** `src/features/scrapers/common/backfillImages.ts:146-158`

### Run locally (CLI)

```bash
# Backfill all sources
npx tsx scripts/backfill-images.ts

# Single source, limited
npx tsx scripts/backfill-images.ts --source BeForward --limit 100

# Preview without writing
npx tsx scripts/backfill-images.ts --dry-run

# Custom delay between requests
npx tsx scripts/backfill-images.ts --source AutoScout24 --delay 3000

# Show help
npx tsx scripts/backfill-images.ts --help
```

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--source` | `all` | Filter by source (`BaT`, `BeForward`, `AutoScout24`, `all`) |
| `--limit` | unlimited | Max listings to process |
| `--dry-run` | `false` | Preview without writing to DB |
| `--delay` | `2000` | Delay between requests (ms) |

### Automated schedule

- **Vercel Cron** at `06:30 UTC` daily (after cleanup at 06:00)
- Route: `GET /api/cron/backfill-images` (requires `Authorization: Bearer <CRON_SECRET>`)
- Processes BaT → BeForward → AutoScout24 sequentially
- Max 20 listings per source, 2s delay, 270s total time budget
- Max duration: 5 minutes

### Test the cron route

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/backfill-images
```

### Relationship to existing backfills

This module **does not conflict** with existing per-source backfills:
- **BeForward**: The BeForward cron (`/api/cron/beforward`) runs its own image backfill after discovery. This cross-source backfill catches anything missed.
- **Classic.com**: Excluded entirely — ClassicCom uses Playwright for image extraction, handled inside its own collector.
- **BaT/AutoScout24**: These scrapers don't have their own image backfill — this module fills that gap.

---

## 8. BaT Detail Scraper

**What it does:** Scrapes BaT listing detail pages to extract high-resolution images and additional specs. Runs after the Porsche Collector to enrich newly discovered listings.

**Source:** `scripts/bat-detail-scraper.ts` (Playwright)

### Automated schedule

- **GitHub Actions** at `01:30 UTC` daily (after Porsche Collector at 01:00)
- Workflow: `.github/workflows/bat-detail-scraper.yml`
- Config: max 700 listings, 20-minute time budget
- Timeout: 30 minutes

---

## 9. Listing Validator

**What it does:** Validates recently updated listings (last 25 hours), fixes invalid model names, and deletes junk entries.

**Source:** `src/app/api/cron/validate/route.ts`

### How it works

1. Fetches active listings where `updated_at >= now - 25h`
2. Runs `validateListing({ make, model, title, year })` on each
3. **If valid but model fixable:** Updates model to corrected value
4. **If invalid (junk):** Deletes price_history (FK), then listing
5. Logs deletion reasons (e.g., "non-porsche-make: 3", "tractor: 1")

### Automated schedule

- **Vercel Cron** at `05:30 UTC` daily (after all collectors finish)
- Route: `GET /api/cron/validate` (requires `Authorization: Bearer <CRON_SECRET>`)
- Max duration: 1 minute

---

## 10. Cleanup

**What it does:** Multi-step maintenance job: marks stale/dead listings as sold or unsold, reclassifies misclassified models using title data, and deletes junk.

**Source:** `src/app/api/cron/cleanup/route.ts`

### Steps

| Step | What | Query | Action |
|------|------|-------|--------|
| **1a** | Stale auctions with bids | `status='active'` + `end_time < now` + `current_bid > 0` | `status → 'sold'` |
| **1b** | Stale auctions without bids | `status='active'` + `end_time < now` | `status → 'unsold'` |
| **1c** | Dead URL listings | `status='active'` + `images contains ['__dead_url__']` | `status → 'unsold'` |
| **2** | Misclassified models | `extractSeries(model) !== extractSeries(model, title)` | Update `model` to correct series |
| **3** | Junk detection | 10 rules (tractors, boats, bikes, non-Porsche, etc.) | Delete listing + price_history |

### Automated schedule

- **Vercel Cron** at `06:00 UTC` daily
- Route: `GET /api/cron/cleanup` (requires `Authorization: Bearer <CRON_SECRET>`)
- Max duration: 1 minute

### Response fields

| Field | Description |
|-------|-------------|
| `staleFixed` | Listings moved from active to sold/unsold (Steps 1a+1b) |
| `deadUrlFixed` | Dead-URL listings moved to unsold (Step 1c) |
| `reclassified` | Models corrected via title (Step 2) |
| `deleted` | Junk listings removed (Step 3) |
| `byReason` | Breakdown of deletions by junk rule |

---

## 11. VIN Enrichment

**What it does:** Decodes VINs using the NHTSA vPIC API to extract standardized make/model/year/body/engine data.

**Source:** `src/app/api/cron/enrich-vin/route.ts`

### Automated schedule

- **Vercel Cron** at `07:00 UTC` daily
- Route: `GET /api/cron/enrich-vin` (requires `Authorization: Bearer <CRON_SECRET>`)
- Max duration: 1 minute

---

## 12. Title Enrichment

**What it does:** Parses listing titles to extract structured metadata (engine size, transmission type, body style, trim level) using regex patterns.

**Source:** `src/app/api/cron/enrich-titles/route.ts`

### Automated schedule

- **Vercel Cron** at `07:15 UTC` daily
- Route: `GET /api/cron/enrich-titles` (requires `Authorization: Bearer <CRON_SECRET>`)
- Max duration: 1 minute

---

## 13. AS24 Detail Enrichment

**What it does:** Enriches AutoScout24 listings by fetching their detail pages via plain HTTP + cheerio (no Playwright). Extracts trim, transmission, body style, engine, colors, VIN, description, and images.

**Source:** `src/app/api/cron/enrich-details/route.ts`

### How it works

1. Queries active AS24 listings where `trim IS NULL` (proxy for missing details)
2. Fetches each listing's `source_url` via HTTP
3. Parses with `parseDetailHtml()` (cheerio)
4. Updates listing if at least 1 new field extracted
5. On 404/410: marks listing as `delisted`
6. On 403/429/Cloudflare: circuit-breaks

### Automated schedule

- **Not scheduled** in `vercel.json` — run manually or via monitoring dashboard
- Route: `GET /api/cron/enrich-details` (requires `Authorization: Bearer <CRON_SECRET>`)
- Config: 25 listings per run, 2s delay, 270s time budget
- Max duration: 5 minutes

---

## Daily Schedule Summary

All times in UTC. Staggered to avoid overlapping.

```
00:00  Ferrari Collector          (Vercel Cron, 5 min)
01:00  Porsche Collector          (Vercel Cron, 5 min)
01:30  BaT Detail Scraper         (GitHub Actions, 30 min)
02:00  AutoTrader Collector       (Vercel Cron, 5 min)
03:00  BeForward Collector        (Vercel Cron, 5 min)
04:00  Classic.com Collector      (GitHub Actions, 45 min)
04:30  Classic.com Image Backfill (GitHub Actions, 45 min)
05:00  AutoScout24 Collector      (GitHub Actions, 90 min)
05:30  Listing Validator          (Vercel Cron, 1 min)
06:00  Cleanup                    (Vercel Cron, 1 min)
06:30  Image Backfill             (Vercel Cron, 5 min)
07:00  VIN Enrichment             (Vercel Cron, 1 min)
07:15  Title Enrichment           (Vercel Cron, 1 min)
 --    AS24 Detail Enrichment     (Vercel Cron, manual only)
```

**Why two runtimes?**
- **Vercel Cron** (max 5 min): Lightweight HTTP-based scrapers that fit within serverless limits.
- **GitHub Actions** (30-90 min): Heavy Playwright browser scrapers that need more time and memory.

---

## Output & Database

All scrapers write to the same Supabase `listings` table using upsert on `(source, source_id)`. Each scraper also produces:

- **JSONL file** in `var/<scraper_name>/listings.jsonl` — one JSON object per line, one line per listing
- **Checkpoint file** in `var/<scraper_name>/checkpoint.json` — tracks progress for resume on failure

### Verify data in Supabase

```sql
-- Check listing counts by source
SELECT source, status, COUNT(*), MAX(scrape_timestamp) as latest
FROM listings
GROUP BY source, status
ORDER BY source;

-- Check a specific source
SELECT source_id, title, year, make, model, hammer_price, country
FROM listings
WHERE source = 'AutoScout24'
ORDER BY scrape_timestamp DESC
LIMIT 10;
```

---

## Monitoring Dashboard

Every scraper run is automatically recorded to the `scraper_runs` Supabase table. The monitoring dashboard shows run status, history, daily trends, and data quality metrics.

### View the dashboard

```
http://localhost:3000/en/admin/scrapers   (local)
https://your-app.vercel.app/en/admin/scrapers  (production)
```

No authentication required — the dashboard is public read-only.

### What it shows

| Tab | Description |
|-----|-------------|
| **Status** | 6 cards (one per scraper) with green/yellow/red indicator. Green = ran successfully in the last 26h. Yellow = 26-48h ago. Red = >48h or last run failed. |
| **Run History** | Table of the most recent 50 runs, filterable by scraper. Click a row to expand: run ID, source breakdown, error messages, backfill stats. |
| **Daily Trends** | Per-day, per-scraper aggregates for the last 30 days: total runs, successes, failures, discovered, written, errors, avg duration. |
| **Data Quality** | Per-source quality metrics from the `listings` table: avg quality score, % with images, % with price. |

### How runs get recorded

Each scraper calls `recordScraperRun()` after completing (success or failure). This function:

- Uses `SUPABASE_SERVICE_ROLE_KEY` to write to the `scraper_runs` table
- Is **non-throwing** — if recording fails (missing env var, network error), the scraper run itself is not affected
- Records: scraper name, run ID, start/finish time, duration, discovered/written counts, errors, source breakdown, bot blocks

### Required environment variables for monitoring

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, Vercel env vars, GitHub Actions secrets | Write access to `scraper_runs` table |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel env vars, GitHub Actions secrets | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, Vercel env vars | Dashboard read access (via RLS public policy) |

### Quick test: run a scraper and check the dashboard

```bash
# 1. Start dev server
npm run dev

# 2. Trigger the fastest scraper (BeForward, ~30s)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/beforward

# 3. Open the dashboard — the BeForward card should turn green
#    http://localhost:3000/en/admin/scrapers
```

### Verify monitoring data in Supabase

```sql
-- Latest runs
SELECT scraper_name, success, discovered, written, errors_count, duration_ms, finished_at
FROM scraper_runs
ORDER BY finished_at DESC
LIMIT 10;

-- Daily aggregates (last 7 days)
SELECT * FROM scraper_daily_aggregates(7);

-- Data quality by source (last 7 days)
SELECT * FROM source_data_quality(7);
```

### Database schema: `scraper_runs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `scraper_name` | TEXT | `porsche`, `ferrari`, `autotrader`, `beforward`, `classic`, `autoscout24`, `backfill-images`, `cleanup`, `validate`, `enrich-vin`, `enrich-titles`, `enrich-details` |
| `run_id` | TEXT | Collector's own UUID |
| `started_at` | TIMESTAMPTZ | When the run started |
| `finished_at` | TIMESTAMPTZ | When the run finished |
| `success` | BOOLEAN | Whether the run succeeded |
| `runtime` | TEXT | `vercel_cron`, `github_actions`, or `cli` |
| `duration_ms` | INTEGER | Total run duration in milliseconds |
| `discovered` | INTEGER | Listings found |
| `written` | INTEGER | Listings written to DB |
| `errors_count` | INTEGER | Number of errors |
| `refresh_checked` | INTEGER | Listings checked for status refresh (porsche/ferrari/autotrader) |
| `refresh_updated` | INTEGER | Listings updated during refresh |
| `details_fetched` | INTEGER | Detail pages fetched (classic/autoscout24) |
| `normalized` | INTEGER | Listings normalized (classic/autoscout24) |
| `skipped_duplicate` | INTEGER | Duplicates skipped (autoscout24) |
| `bot_blocked` | INTEGER | Cloudflare/Akamai blocks (classic/autoscout24) |
| `backfill_discovered` | INTEGER | Listings found needing image backfill (beforward/classic/porsche/ferrari) |
| `backfill_written` | INTEGER | Listings updated with backfilled images (beforward/classic/porsche/ferrari) |
| `source_counts` | JSONB | Per-source breakdown, e.g. `{"BaT": {"discovered": 10, "written": 8}}` |
| `error_messages` | TEXT[] | Array of error strings |

---

## Troubleshooting

### "Missing Supabase env vars"
Make sure `.env.local` has both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Use `--dryRun` to test without database access.

### Playwright not installed
```bash
npx playwright install chromium --with-deps
```

### Cloudflare / Akamai blocks
Browser-based scrapers (Classic.com, AutoScout24) may get blocked without a proxy. Set the `DECODO_PROXY_*` environment variables or pass `--proxyServer`.

### Cron route returns 401
The cron routes require `Authorization: Bearer <CRON_SECRET>`. Make sure `CRON_SECRET` is set in `.env.local` and you pass it in the header.

### BeForward returns 429 (rate limited)
This is expected with aggressive settings. Increase `--rateLimitMs` (e.g., `5000`) or reduce `--concurrency`.

### Dashboard shows "No runs recorded yet"
The `scraper_runs` table is empty — no scraper has been triggered since monitoring was added. Run any scraper (e.g., `curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/beforward`) and refresh the dashboard.

### Scraper runs but doesn't appear in dashboard
Check that `SUPABASE_SERVICE_ROLE_KEY` is set in the environment where the scraper runs. The `recordScraperRun()` function silently skips recording if the key is missing (check stderr for `[scraper-monitoring] Missing SUPABASE_URL or SERVICE_ROLE_KEY`).

### Resuming interrupted runs
All scrapers with checkpoint files (`--checkpointPath`) automatically resume from where they left off. To start fresh, delete the checkpoint file:
```bash
rm var/<scraper_name>/checkpoint.json
```
