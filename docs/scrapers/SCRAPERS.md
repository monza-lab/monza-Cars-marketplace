# Scrapers & Collectors

This document explains how to run and test every scraper in the Monza Cars Marketplace repository. Each scraper section is self-contained: discovery, enrichment, backfill, fallbacks, and verification are all grouped together.

## Prerequisites

```bash
# Install Node dependencies
npm ci

# For browser-based scrapers (Classic.com, AutoScout24)
npx playwright install chromium --with-deps

# For Scrapling fallback (Python-based Cloudflare bypass)
pip install "scrapling[fetchers,shell]"
scrapling install
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

# Scrapling Python binary (default: python3.11)
# On Windows set to "python", on macOS/Linux usually "python3" or "python3.11"
SCRAPLING_PYTHON=python
```

> **Cron routes** require `npm run dev` running in another terminal. Replace `YOUR_CRON_SECRET` with your actual secret from `.env.local`.

---

## Overview

| # | Scraper | Source | Method | Runtime | Schedule |
|---|---------|--------|--------|---------|----------|
| 1 | [Porsche Collector](#1-porsche-collector) | BaT, C&B, CollectingCars | HTTP / HTML | Vercel Cron | 01:00 UTC |
| 2 | [Ferrari Collector](#2-ferrari-collector) | BaT, C&B, CollectingCars | HTTP / HTML | Vercel Cron | 00:00 UTC |
| 3 | [AutoTrader Collector](#3-autotrader-collector) | AutoTrader UK | GraphQL API + Scrapling | Vercel Cron | 02:00 UTC |
| 4 | [BeForward Collector](#4-beforward-collector) | BeForward | HTTP / HTML | Vercel Cron | 03:00 UTC |
| 5 | [Classic.com Collector](#5-classiccom-collector) | Classic.com (US) | Scrapling + Playwright | GitHub Actions | 04:00 UTC |
| 6 | [AutoScout24 Collector](#6-autoscout24-collector) | AutoScout24 (8 EU countries) | Playwright Browser | GitHub Actions | 05:00 UTC |
| 7 | [Elferspot Collector](#7-elferspot-collector) | Elferspot (33 countries) | HTTP / Cheerio + JSON-LD | Vercel Cron | 09:15 UTC |

Cross-cutting jobs that apply to all sources:

| Job | Purpose | Schedule |
|-----|---------|----------|
| [Liveness Checker](#8-liveness-checker) | Verify source URLs still resolve | 10:30 UTC |
| [Listing Validator](#cross-source-maintenance) | Fix model names, delete junk | 05:30 UTC |
| [Cleanup](#cross-source-maintenance) | Mark stale auctions, reclassify | 06:00 UTC |
| [VIN Enrichment](#cross-source-maintenance) | Decode VINs via NHTSA API | 07:00 UTC |
| [Title Enrichment](#cross-source-maintenance) | Parse specs from listing titles | 07:15 UTC |

---

## 1. Porsche Collector

**What it does:** Scrapes Porsche auction listings from 3 platforms — Bring a Trailer (BaT), Cars & Bids, and Collecting Cars. Includes a dedicated BaT detail scraper for enrichment and cross-source image backfill.

**Source directory:** `src/features/scrapers/porsche_collector/`

### 1a. Discovery

```bash
# Quick test — dry run, no DB writes
npx tsx src/features/scrapers/porsche_collector/cli.ts --mode=daily --dryRun

# Daily mode (discover active + recently ended listings)
npx tsx src/features/scrapers/porsche_collector/cli.ts --mode=daily

# Skip detail page fetches (faster, less data)
npx tsx src/features/scrapers/porsche_collector/cli.ts --mode=daily --noDetails

# Backfill a specific date range
npx tsx src/features/scrapers/porsche_collector/cli.ts --mode=backfill --dateFrom=2026-01-01 --dateTo=2026-01-07

# Show help
npx tsx src/features/scrapers/porsche_collector/cli.ts --help
```

**Via cron route:**

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/porsche
```

**CLI flags:**

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

### 1b. BaT Detail Scraper (enrichment)

Scrapes BaT listing detail pages for high-resolution images and fields missing from the card view: mileage, VIN, exterior/interior color, engine, transmission, body style. Uses HTTP + Cheerio first, then Scrapling (`StealthyFetcher` with `--solve-cloudflare`) when key fields are still missing.

**Source:** `scripts/bat-detail-scraper.ts`
**Scrapling wrapper:** `src/features/scrapers/auctions/batScrapling.ts`

```bash
# Preflight check — test 5 listings, no writes
npx tsx scripts/bat-detail-scraper.ts --preflight --limit=5 --dryRun

# Small test run — 10 listings, dry run
npx tsx scripts/bat-detail-scraper.ts --limit=10 --dryRun

# Production run — 100 listings, 30-minute budget
npx tsx scripts/bat-detail-scraper.ts --limit=100 --timeBudgetMs=1800000

# Full run with defaults (700 listings, 20-minute budget)
npx tsx scripts/bat-detail-scraper.ts
```

| Flag | Default | Description |
|------|---------|-------------|
| `--limit` | `700` | Max listings to process |
| `--timeBudgetMs` | `1200000` (20 min) | Time budget in milliseconds |
| `--delayMs` | `2500` | Delay between requests (ms) |
| `--dryRun` | `false` | Skip database writes |
| `--preflight` | `false` | Test first 5 listings to verify scraper works |

### 1c. Image Backfill

BaT listings discovered without images are backfilled by the cross-source image backfill module:

```bash
# Backfill BaT images only
npx tsx scripts/backfill-images.ts --source BaT --limit 100

# Dry run
npx tsx scripts/backfill-images.ts --source BaT --limit 10 --dry-run

# Via cron route (processes BaT → BeForward → AutoScout24 sequentially)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/backfill-images
```

### 1d. Verify

```bash
# Run unit tests
npx vitest run src/features/scrapers/auctions/bringATrailer.test.ts -v

# Check quality gate
node scripts/verify-scraper-quality.mjs --scraper=porsche

# Check data in Supabase
# SELECT source, status, COUNT(*) FROM listings WHERE source IN ('BaT','CarsAndBids','CollectingCars') AND make='Porsche' GROUP BY source, status;
```

### Automated schedule

| Step | Time (UTC) | Runtime | Duration |
|------|------------|---------|----------|
| Discovery | 01:00 | Vercel Cron | 5 min |
| BaT Detail Scraper | 01:30 | GitHub Actions | 30 min |
| Image Backfill | 06:30 | Vercel Cron | 5 min |

---

## 2. Ferrari Collector

**What it does:** Same as the Porsche Collector but targets Ferrari listings from the same 3 auction platforms (BaT, Cars & Bids, Collecting Cars).

**Source directory:** `src/features/scrapers/ferrari_collector/`

### 2a. Discovery

```bash
# Quick test — dry run
npx tsx src/features/scrapers/ferrari_collector/cli.ts --mode=daily --dryRun

# Daily mode
npx tsx src/features/scrapers/ferrari_collector/cli.ts --mode=daily

# Backfill a date range
npx tsx src/features/scrapers/ferrari_collector/cli.ts --mode=backfill --dateFrom=2026-01-01 --dateTo=2026-01-07

# Show help
npx tsx src/features/scrapers/ferrari_collector/cli.ts --help
```

**Via cron route:**

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/ferrari
```

**CLI flags:** Same as [Porsche Collector](#1a-discovery). Only differences:

| Flag | Default |
|------|---------|
| `--make` | `Porsche` (pass `Ferrari` explicitly) |
| `--checkpointPath` | `var/ferrari_collector/checkpoint.json` |

### 2b. Image Backfill

Ferrari BaT images are handled by the same cross-source backfill:

```bash
npx tsx scripts/backfill-images.ts --source BaT --limit 100
```

### 2c. Verify

```bash
node scripts/verify-scraper-quality.mjs --scraper=ferrari
```

### Automated schedule

| Step | Time (UTC) | Runtime | Duration |
|------|------------|---------|----------|
| Discovery | 00:00 | Vercel Cron | 5 min |
| Image Backfill | 06:30 | Vercel Cron | 5 min |

---

## 3. AutoTrader Collector

**What it does:** Scrapes Porsche dealer listings from AutoTrader UK using their internal GraphQL API. Includes an enrichment sweep that recovers missing fields, and a Scrapling-based photo probe for manual diagnostics.

**Source directory:** `src/features/scrapers/autotrader_collector/`

### 3a. Discovery

This collector runs exclusively via the cron route (no standalone CLI):

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/autotrader
```

### 3b. Enrichment

Re-visits listings to recover missing price, mileage, images, VIN, colors, engine, transmission, body style, and description. Recovery order: product-page JSON → HTML fallback → search-gateway fallback.

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/enrich-autotrader
```

Response: `200` for true no-op or successful writes, `500` when rows are found but nothing is written.

### 3c. Scrapling Photo Probe

For manual photo recovery from AutoTrader detail pages. Uses Scrapling's `StealthyFetcher` with adaptive mode and headless browser:

```bash
# Probe a single listing for gallery images
python scripts/autotrader-scrapling-probe.py "https://www.autotrader.co.uk/car-details/..."
```

**Output:**
```json
{ "url": "https://...", "images": ["https://m.atcdn.co.uk/..."] }
```

**Script:** `scripts/autotrader-scrapling-probe.py`

### 3d. Verify

```bash
node scripts/verify-scraper-quality.mjs --scraper=autotrader
```

### Automated schedule

| Step | Time (UTC) | Runtime | Duration |
|------|------------|---------|----------|
| Discovery | 02:00 | Vercel Cron | 5 min |
| Enrichment | 07:45 | Vercel Cron | 5 min |

---

## 4. BeForward Collector

**What it does:** Scrapes Porsche listings from BeForward, a Japanese used-car export marketplace. Discovery is summary-only on Vercel (fast); image backfill runs after discovery and also via the cross-source backfill module.

**Source directory:** `src/features/scrapers/beforward_porsche_collector/`

### 4a. Discovery

```bash
# Quick test — dry run, 5 pages
npx tsx src/features/scrapers/beforward_porsche_collector/cli.ts --dryRun --maxPages=5

# Summary only (skip detail pages, faster)
npx tsx src/features/scrapers/beforward_porsche_collector/cli.ts --summaryOnly --maxPages=10

# Full run — all pages with detail scraping
npx tsx src/features/scrapers/beforward_porsche_collector/cli.ts --maxPages=200 --maxDetails=10000 --concurrency=6

# Show help
npx tsx src/features/scrapers/beforward_porsche_collector/cli.ts --help
```

**Via cron route:**

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/beforward
```

**CLI flags:**

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

### 4b. Image Backfill

The cron route runs `summaryOnly=true` (Vercel 5-min limit), so new listings start without images. After discovery, remaining time is used to backfill images inline. The cross-source backfill also catches anything missed:

```bash
# Cross-source backfill — BeForward only
npx tsx scripts/backfill-images.ts --source BeForward --limit 100

# With custom delay
npx tsx scripts/backfill-images.ts --source BeForward --delay 3000

# Dry run
npx tsx scripts/backfill-images.ts --source BeForward --limit 10 --dry-run
```

Inline backfill config: max 20 listings per run, 2.5s rate limit. Stats in `scraper_runs` as `backfill_discovered`/`backfill_written`.

**Source:** `src/features/scrapers/beforward_porsche_collector/backfill.ts`

### 4c. Verify

```bash
node scripts/verify-scraper-quality.mjs --scraper=beforward
```

### Automated schedule

| Step | Time (UTC) | Runtime | Duration |
|------|------------|---------|----------|
| Discovery + inline backfill | 03:00 | Vercel Cron | 5 min |
| Cross-source image backfill | 06:30 | Vercel Cron | 5 min |

---

## 5. Classic.com Collector

**What it does:** Scrapes Porsche for-sale listings from Classic.com (US market). Uses a multi-tier fallback strategy for detail pages to handle Cloudflare protection. The most complex scraper with the most fallback paths.

**Source directory:** `src/features/scrapers/classic_collector/`

### Fallback chain (detail pages)

```
1. Scrapling (Python)           → fetchClassicDetailWithScrapling() — Chrome impersonation, no browser
2. Playwright + proxy           → headless browser + Decodo residential proxy + CF resolution
3. Scrapling image recovery     → if Playwright got 0 images, try scrapling for images only
4. Summary-only normalization   → normalizeListingFromSummary() — basic data, no detail enrichment
```

### 5a. Discovery + Details

```bash
# Quick test — dry run, 5 listings, visible browser
npx tsx src/features/scrapers/classic_collector/cli.ts --dryRun --headed --maxListings=5

# Production run (headless, scrapling fallback active)
npx tsx src/features/scrapers/classic_collector/cli.ts --maxPages=20

# With explicit proxy
npx tsx src/features/scrapers/classic_collector/cli.ts --proxyServer=http://gate.smartproxy.com:7000

# Show help
npx tsx src/features/scrapers/classic_collector/cli.ts --help
```

**CLI flags:**

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

### 5b. Scrapling-Only Mode

Skip Playwright entirely — useful when proxy is down or for faster runs:

```bash
# Scrapling-only discovery + details
CLASSIC_DISABLE_PLAYWRIGHT_FALLBACK=1 npx tsx src/features/scrapers/classic_collector/cli.ts --maxPages=5

# Force scrapling on search pages too (default uses Playwright GraphQL interception)
CLASSIC_FORCE_SCRAPLING=1 npx tsx src/features/scrapers/classic_collector/cli.ts --maxPages=5
```

**Scrapling environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPLING_PYTHON` | `python3.11` | Python binary. Set to `python` on Windows. |
| `CLASSIC_FORCE_SCRAPLING` | — | `1` = use scrapling first on search pages |
| `CLASSIC_DISABLE_PLAYWRIGHT_FALLBACK` | — | `1` = scrapling-only mode, no Playwright |
| `CLASSIC_SCRAPLING_PARALLELISM` | `8` | Max parallel scrapling fetches during backfill |

### 5c. Scrapling Direct (Python, no Node)

Test the scrapling fetcher independently without any Node/Playwright dependency:

```bash
# Single URL
python scripts/classic_scrapling_fetch.py "https://www.classic.com/veh/1996-porsche-911-turbo-..."

# Batch fetch (parallel, up to 6 workers)
python scripts/classic_scrapling_fetch.py "https://..." "https://..." "https://..."
```

**Output:**
```json
{ "ok": true, "title": "1996 Porsche 911 Turbo", "bodyText": "FOR SALE by...", "images": ["https://images.classic.com/vehicles/..."] }
```

**Script:** `scripts/classic_scrapling_fetch.py`
**TS wrapper:** `src/features/scrapers/classic_collector/scrapling.ts`

> Scrapling is disabled on Vercel automatically (`process.env.VERCEL` check).

### 5d. Image Backfill

**Inline backfill** (runs after discovery if >40s remains): max 5 listings per run using the existing Playwright page. Source: `src/features/scrapers/classic_collector/backfill.ts`

**Bulk image backfill** (dedicated script, Playwright + Decodo proxy required):

```bash
# Small test — 50 listings, visible browser
npx tsx scripts/backfill-classic-images.ts --maxListings=50 --headed

# Custom delay
npx tsx scripts/backfill-classic-images.ts --maxListings=100 --navigationDelayMs=5000

# Full run (headless, 30-minute budget)
npx tsx scripts/backfill-classic-images.ts
```

| Flag | Default | Description |
|------|---------|-------------|
| `--maxListings` | unlimited | Total listings to process |
| `--batchSize` | `100` | Batch size per query |
| `--navigationDelayMs` | `3000` | Delay between page navigations (ms) |
| `--pageTimeoutMs` | `20000` | Page load timeout (ms) |
| `--timeBudgetMs` | `1800000` (30 min) | Total time budget (ms) |
| `--headed` | `false` | Show browser window |

> Without Decodo proxy credentials, Cloudflare blocks the headless browser after 1-2 requests. The proxy is mandatory for Playwright-based bulk backfill.

### 5e. Verify

```bash
node scripts/verify-scraper-quality.mjs --scraper=classic
```

### Automated schedule

| Step | Time (UTC) | Runtime | Duration |
|------|------------|---------|----------|
| Discovery + details | 04:00 | GitHub Actions | 45 min |
| Bulk image backfill | 04:30 | GitHub Actions | 45 min |

**Trigger manually on GitHub:**

Go to **Actions > Classic.com Collector (Daily) > Run workflow**:

| Input | Default |
|-------|---------|
| Max search pages | `5` |
| Max listings to process | `125` |
| Skip DB writes | `false` |

Go to **Actions > Classic.com Image Backfill > Run workflow**:

| Input | Default |
|-------|---------|
| Max listings to backfill | `200` |
| Delay between pages (ms) | `4000` |
| Time budget (ms) | `2400000` (40 min) |

---

## 6. AutoScout24 Collector

**What it does:** Scrapes Porsche listings from AutoScout24 across 8 European countries. Uses Playwright browser. Shards searches by model + year range + country to overcome the 20-page pagination limit (~31,000 total listings). Detail enrichment runs separately via a cron route.

**Source directory:** `src/features/scrapers/autoscout24_collector/`

### 6a. Discovery

```bash
# Quick test — dry run, Luxembourg only, 10 listings
npx tsx src/features/scrapers/autoscout24_collector/cli.ts --dryRun --maxListings=10 --countries=L

# Germany only, 100 listings
npx tsx src/features/scrapers/autoscout24_collector/cli.ts --dryRun --maxListings=100 --countries=D

# All countries, with detail page scraping (slower but richer data)
npx tsx src/features/scrapers/autoscout24_collector/cli.ts --countries=D,A,I --scrapeDetails --maxListings=500

# Full run, all 8 countries (~1 hour)
npx tsx src/features/scrapers/autoscout24_collector/cli.ts --maxListings=50000

# Debug — visible browser
npx tsx src/features/scrapers/autoscout24_collector/cli.ts --headed --dryRun --maxListings=5 --countries=L

# Resume an interrupted run (reads checkpoint automatically)
npx tsx src/features/scrapers/autoscout24_collector/cli.ts

# Start fresh (delete checkpoint)
npx tsx src/features/scrapers/autoscout24_collector/cli.ts --reset --dryRun

# Show help
npx tsx src/features/scrapers/autoscout24_collector/cli.ts --help
```

**CLI flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--make` | `Porsche` | Target make |
| `--countries` | `D,A,B,E,F,I,L,NL` | Country codes |
| `--maxPagesPerShard` | `20` | Max pages per search shard (AS24 caps at 20) |
| `--maxListings` | `50000` | Max total listings to process |
| `--navigationDelayMs` | `3000` | Delay between page navigations (ms) |
| `--pageTimeoutMs` | `30000` | Page load timeout (ms) |
| `--scrapeDetails` | `false` | Fetch individual listing pages for enriched data |
| `--headed` | `false` | Show the browser window |
| `--checkpointPath` | `var/autoscout24_collector/checkpoint.json` | Resume checkpoint file |
| `--outputPath` | `var/autoscout24_collector/listings.jsonl` | JSONL output file |
| `--dryRun` | `false` | Skip database writes |
| `--reset` | `false` | Delete checkpoint file and start fresh |

**Country codes:**

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

### 6b. Detail Enrichment

Enriches listings by fetching their detail pages via plain HTTP + cheerio (no Playwright). Extracts trim, transmission, body style, engine, colors, VIN, description, and images.

**Source:** `src/app/api/cron/enrich-details/route.ts`

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/enrich-details
```

Config: 100 listings per run, 1s delay, 270s time budget. On 404/410: marks listing as `delisted`. On 403/429: circuit-breaks.

### 6c. Image Backfill

AS24 images are handled by the cross-source image backfill module:

```bash
# AS24 images only
npx tsx scripts/backfill-images.ts --source AutoScout24 --limit 100

# Dry run
npx tsx scripts/backfill-images.ts --source AutoScout24 --limit 10 --dry-run
```

### 6d. Verify

```bash
node scripts/verify-scraper-quality.mjs --scraper=autoscout24
```

### Automated schedule

| Step | Time (UTC) | Runtime | Duration |
|------|------------|---------|----------|
| Discovery | 05:00 | GitHub Actions | 90 min |
| Detail enrichment | manual | Vercel Cron | 5 min |
| Image backfill | 06:30 | Vercel Cron | 5 min |

**Trigger manually on GitHub:** Go to **Actions > AutoScout24 Collector (Daily) > Run workflow**:

| Input | Default |
|-------|---------|
| Max listings to process | `2000` |
| Country codes | `D,A,B,E,F,I,L,NL` |
| Max pages per shard | `20` |
| Fetch detail pages | `false` |
| Skip DB writes | `false` |

---

## 7. Elferspot Collector

**What it does:** Scrapes Porsche-only classified listings from Elferspot (elferspot.com), a dedicated Porsche marketplace with ~3,900 active listings across 33 countries. Uses plain HTTP with Cheerio + JSON-LD parsing (no browser needed). Runs in two phases: discovery then enrichment.

**Source directory:** `src/features/scrapers/elferspot_collector/`

### 7a. Discovery

```bash
# Quick test — dry run, 5 pages
npx tsx src/features/scrapers/elferspot_collector/cli.ts --dryRun --maxPages=5

# Full run — all pages, with detail scraping
npx tsx src/features/scrapers/elferspot_collector/cli.ts --maxPages=100 --scrapeDetails

# Summary only (discovery, no detail pages)
npx tsx src/features/scrapers/elferspot_collector/cli.ts --maxPages=100

# German language pages
npx tsx src/features/scrapers/elferspot_collector/cli.ts --language=de --maxPages=5

# Show help
npx tsx src/features/scrapers/elferspot_collector/cli.ts --help
```

**Via cron route:**

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/elferspot
```

**CLI flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--maxPages` | `100` | Max search pages to crawl |
| `--maxListings` | `5000` | Max listings to process |
| `--scrapeDetails` | `false` | Fetch individual detail pages for enriched data |
| `--delayMs` | `10000` | Delay between requests (respects robots.txt crawl-delay) |
| `--language` | `en` | Search language (`en`, `de`, `nl`, `fr`) |
| `--checkpointPath` | `var/elferspot_collector/checkpoint.json` | Resume checkpoint file |
| `--outputPath` | `var/elferspot_collector/listings.jsonl` | JSONL output file |
| `--dryRun` | `false` | Skip database writes |

### 7b. Enrichment

Fetches detail pages for listings missing detail data. Extracts specs, images, description, seller info, and pricing via JSON-LD + Cheerio.

**Source:** `src/app/api/cron/enrich-elferspot/route.ts`

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/enrich-elferspot
```

Config: 50 listings per run, 2.5s delay, 270s time budget. On 404/410: marks listing as `delisted`. On 403/429: circuit-breaks.

**Fields enriched:**

| Field | Source |
|-------|--------|
| `hammer_price`, `current_bid` | JSON-LD offers or sidebar price |
| `mileage` | JSON-LD `mileageFromOdometer` |
| `transmission` | JSON-LD `vehicleTransmission` |
| `body_style` | JSON-LD `bodyType` |
| `engine` | Spec table (cylinder capacity + power) |
| `color_exterior` | JSON-LD `color` |
| `color_interior` | Spec table (interior color) |
| `vin` | Body text regex (17-char VIN) |
| `description_text` | `div.highlights-float` paragraphs |
| `images` | `a.photoswipe-image` hrefs (full-size gallery) |
| `seller_name` | Sidebar heading |
| `seller_type` | Heuristic (GmbH/AG/Ltd → dealer, else private) |
| `country` | Spec table (car location) or sidebar flag |

### 7c. Verify

```bash
node scripts/verify-scraper-quality.mjs --scraper=elferspot
```

### Site characteristics

| Property | Value |
|----------|-------|
| Total active listings | ~3,900 |
| Listings per search page | 41 |
| Countries represented | 33 (DE 34%, NL 13%, BE 11%, US 9%, FR 9%) |
| robots.txt crawl-delay | 10 seconds |
| Anti-bot protection | None (plain HTTP) |
| Price availability | Detail page only |

### Automated schedule

| Step | Time (UTC) | Runtime | Duration |
|------|------------|---------|----------|
| Discovery | 09:15 | Vercel Cron | 5 min |
| Enrichment | 09:45 | Vercel Cron | 5 min |

---

## 8. Liveness Checker

**What it does:** Verifies that source URLs of active dealer/classified listings still resolve. Listings returning HTTP 404/410 are marked as `unsold`. Runs all 5 dealer sources in parallel with per-source rate limiting and circuit breakers.

Auction sources (BaT, CarsAndBids, CollectingCars) are excluded — they have `end_time` expiry.

**Source directory:** `src/features/scrapers/liveness_checker/`

### Run locally

```bash
# Quick test — 10 listings, dry run, single source
npx tsx src/features/scrapers/liveness_checker/cli.ts --dryRun --maxListings=10 --source=Elferspot

# Check AutoScout24 only, 100 listings
npx tsx src/features/scrapers/liveness_checker/cli.ts --source=AutoScout24 --maxListings=100

# Full run — all sources, 30-minute budget
npx tsx src/features/scrapers/liveness_checker/cli.ts --timeBudgetMs=1800000

# Show help
npx tsx src/features/scrapers/liveness_checker/cli.ts --help
```

**CLI flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--maxListings` | `6000` | Max total listings to check |
| `--source` | all | Check only one source: `AutoScout24`, `Elferspot`, `AutoTrader`, `BeForward`, `ClassicCom` |
| `--delayMs` | per-source | Override per-source delay (ms) |
| `--timeBudgetMs` | `3300000` (55 min) | Time budget in ms |
| `--dryRun` | `false` | Skip DB writes |

**Per-source defaults:**

| Source | Delay | Max/Run |
|--------|-------|---------|
| AutoScout24 | 2s | 1,650 |
| Elferspot | 10s | 330 |
| AutoTrader | 2s | 1,650 |
| BeForward | 2.5s | 1,320 |
| ClassicCom | 3s | 1,100 |

### Automated schedule

- **GitHub Actions** at `10:30 UTC` daily
- Workflow: `.github/workflows/liveness-checker.yml`
- Timeout: 60 minutes
- **Trigger manually:** Actions → Liveness Checker (Daily) → Run workflow. Inputs: `max_listings`, `source`, `dry_run`.

---

## Cross-Source Maintenance

These jobs apply to all sources. They run as Vercel cron routes with no query parameters.

### Listing Validator

Validates recently updated listings (last 25h), fixes invalid model names, deletes junk.

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/validate
```

**Source:** `src/app/api/cron/validate/route.ts`
**Schedule:** 05:30 UTC daily (Vercel Cron, 1 min)

Steps:
1. Fetches active listings where `updated_at >= now - 25h`
2. Runs `validateListing()` on each
3. Valid but model fixable → updates model
4. Invalid (junk) → deletes price_history + listing

### Cleanup

Multi-step maintenance: marks stale/dead listings, reclassifies models, deletes junk.

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/cleanup
```

**Source:** `src/app/api/cron/cleanup/route.ts`
**Schedule:** 06:00 UTC daily (Vercel Cron, 1 min)

| Step | What | Action |
|------|------|--------|
| 1a | Stale auctions with bids | `status → 'sold'` |
| 1b | Stale auctions without bids | `status → 'unsold'` |
| 1c | Dead URL listings | `status → 'unsold'` |
| 2 | Misclassified models | Update model from title |
| 3 | Junk detection (10 rules) | Delete listing + price_history |

**Response:** `{ staleFixed, deadUrlFixed, reclassified, deleted, byReason }`

### VIN Enrichment

Decodes VINs using the NHTSA vPIC API to extract standardized make/model/year/body/engine data.

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/enrich-vin
```

**Source:** `src/app/api/cron/enrich-vin/route.ts`
**Schedule:** 07:00 UTC daily (Vercel Cron, 1 min)

### Title Enrichment

Parses listing titles to extract structured metadata (engine size, transmission type, body style, trim level) using regex patterns.

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/enrich-titles
```

**Source:** `src/app/api/cron/enrich-titles/route.ts`
**Schedule:** 07:15 UTC daily (Vercel Cron, 1 min)

### Cross-Source Image Backfill

Finds active listings with missing images across BaT, BeForward, and AutoScout24 (Classic.com excluded — has its own Playwright backfill).

```bash
# Backfill all sources
npx tsx scripts/backfill-images.ts

# Single source
npx tsx scripts/backfill-images.ts --source BaT --limit 100
npx tsx scripts/backfill-images.ts --source BeForward --delay 3000
npx tsx scripts/backfill-images.ts --source AutoScout24 --limit 50

# Dry run
npx tsx scripts/backfill-images.ts --dry-run

# Via cron route (processes BaT → BeForward → AS24 sequentially)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/backfill-images
```

| Flag | Default | Description |
|------|---------|-------------|
| `--source` | `all` | Filter by source (`BaT`, `BeForward`, `AutoScout24`, `all`) |
| `--limit` | unlimited | Max listings to process |
| `--dry-run` | `false` | Preview without writing to DB |
| `--delay` | `2000` | Delay between requests (ms) |

**Source:** `src/features/scrapers/common/backfillImages.ts`
**Schedule:** 06:30 UTC daily (Vercel Cron, 5 min)

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
07:45  AutoTrader Enrichment      (Vercel Cron, 5 min)
09:15  Elferspot Collector        (Vercel Cron, 5 min)
09:45  Elferspot Enrichment       (Vercel Cron, 5 min)
10:30  Liveness Checker           (GitHub Actions, 60 min)
 --    AS24 Detail Enrichment     (Vercel Cron, manual only)
```

**Why two runtimes?**
- **Vercel Cron** (max 5 min): Lightweight HTTP-based scrapers that fit within serverless limits.
- **GitHub Actions** (30-90 min): Heavy Playwright browser scrapers that need more time and memory.

---

## Monitoring & Audit

### Health Audit CLI

```bash
# Health report — last 3 days
npx tsx scripts/scraper-health-audit.ts --days=3

# Strict mode — exit 1 on FAILED, STALE, STUCK, or ZERO-WRITE
npx tsx scripts/scraper-health-audit.ts --days=7 --strict

# JSON-only output
npx tsx scripts/scraper-health-audit.ts --json
```

| Flag | Default | Description |
|------|---------|-------------|
| `--days` | `3` | Number of days to look back |
| `--strict` | `false` | Exit with code 1 if issues found |
| `--json` | `false` | JSON-only output (skip formatted table) |

### Quality Gate

Post-scrape quality check. GitHub Actions workflows run this automatically.

```bash
node scripts/verify-scraper-quality.mjs --scraper=classic
node scripts/verify-scraper-quality.mjs --scraper=autoscout24 --dryRun
```

| Flag | Default | Description |
|------|---------|-------------|
| `--scraper` | required | Scraper name to verify |
| `--dryRun` | `false` | Skip quality gate enforcement |

### Dashboard

```
http://localhost:3000/en/admin/scrapers   (local — start dev server first)
https://your-app.vercel.app/en/admin/scrapers  (production)
```

| Tab | Description |
|-----|-------------|
| **Status** | Green/yellow/red per scraper. Green = ran in last 26h. Red = >48h or failed. |
| **Run History** | Last 50 runs, filterable. Expand for source breakdown, errors, backfill stats. |
| **Daily Trends** | Per-day, per-scraper aggregates for last 30 days. |
| **Data Quality** | Per-source: avg quality score, % with images, % with price. |

### Verify data in Supabase

```sql
-- Listing counts by source
SELECT source, status, COUNT(*), MAX(scrape_timestamp) as latest
FROM listings
GROUP BY source, status
ORDER BY source;

-- Latest scraper runs
SELECT scraper_name, success, discovered, written, errors_count, duration_ms, finished_at
FROM scraper_runs
ORDER BY finished_at DESC
LIMIT 10;

-- Daily aggregates (last 7 days)
SELECT * FROM scraper_daily_aggregates(7);

-- Data quality by source
SELECT * FROM source_data_quality(7);
```

### Required environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, Vercel, GitHub Actions | Write to `scraper_runs` |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel, GitHub Actions | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, Vercel | Dashboard read access |

---

## Troubleshooting

### Missing Supabase env vars
Make sure `.env.local` has both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Use `--dryRun` to test without database access.

### Playwright not installed
```bash
npx playwright install chromium --with-deps
```

### Cloudflare / Akamai blocks
Browser-based scrapers (Classic.com, AutoScout24) may get blocked without a proxy. Options:
1. Set the `DECODO_PROXY_*` environment variables or pass `--proxyServer`
2. Use Scrapling fallback: `CLASSIC_DISABLE_PLAYWRIGHT_FALLBACK=1` for scrapling-only mode
3. Test scrapling directly: `python scripts/classic_scrapling_fetch.py <url>`

### Scrapling not working
```bash
# Check Python is available
python --version

# Check scrapling is installed
python -c "import scrapling; print(scrapling.__version__)"

# If not installed
pip install "scrapling[fetchers,shell]"

# Set correct Python binary in .env.local
# Windows: SCRAPLING_PYTHON=python
# macOS/Linux: SCRAPLING_PYTHON=python3
```

### Cron route returns 401
The cron routes require `Authorization: Bearer <CRON_SECRET>`. Make sure `CRON_SECRET` is set in `.env.local` and you pass it in the header.

### BeForward returns 429 (rate limited)
Increase `--rateLimitMs` (e.g., `5000`) or reduce `--concurrency`.

### Dashboard shows "No runs recorded yet"
The `scraper_runs` table is empty. Run any scraper and refresh.

### Scraper runs but doesn't appear in dashboard
Check that `SUPABASE_SERVICE_ROLE_KEY` is set. The `recordScraperRun()` function silently skips if the key is missing (check stderr for `[scraper-monitoring] Missing SUPABASE_URL or SERVICE_ROLE_KEY`).

### Resuming interrupted runs
All scrapers with checkpoint files auto-resume. To start fresh:
```bash
rm var/<scraper_name>/checkpoint.json
```
