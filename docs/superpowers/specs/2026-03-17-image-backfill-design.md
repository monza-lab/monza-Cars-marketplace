# Image Backfill System — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Active listings only (status = 'active')

## Problem

9,532 of 40,308 listings (23.6%) have empty image arrays. Filtering to active listings only: ~3,867 listings need images. The worst offenders:

| Source | Active Missing | Root Cause |
|--------|---------------|------------|
| BaT | ~2,500+ | Cron runs with `scrapeDetails: false`, skips detail page |
| ClassicCom | ~1,000+ | Scraper doesn't extract images from listing pages |
| BeForward | ~300+ | Gallery images not captured during ingest |
| AutoScout24 | ~50 | Occasional extraction failures |

## Solution

Two-component system:

1. **Vercel Cron** (`/api/cron/backfill-images`) — daily maintenance, processes ~50 listings/run
2. **CLI Script** (`scripts/backfill-images.ts`) — one-time mass backfill, no time limit

Both share a common image scraping module.

## Architecture

### File: `src/features/scrapers/common/imageScraper.ts`

Shared module for platform-specific image extraction from HTML.

```typescript
export interface ImageScrapeResult {
  images: string[];
  source: string;
  scrapedAt: string;
  error?: string;
}

export async function scrapeImagesFromUrl(
  sourceUrl: string,
  source: string
): Promise<ImageScrapeResult>;
```

**Platform strategies** (selectors discovered from existing scrapers + site inspection):

- **BaT:** Extract `<img>` from `.gallery-container`, `.carousel`, content area. Accept URLs containing `bringatrailer.com` or `wp-content/uploads`. Filter by `width`/`height` attributes > 200px. Based on existing `bringATrailer.ts:scrapeDetail` lines 730-770.
- **ClassicCom:** Extract from `<meta property="og:image">`, JSON-LD `@type: Product`, or `img` tags in main content. Filter by URL containing `classic.com` CDN domains.
- **BeForward:** Extract from `.ip-gallery img`, `.vehicle-image img`, or `data-src` attributes on gallery images.
- **AutoScout24:** Extract from `[data-src]` gallery images, `.gallery-picture img`, or `<source>` tags in `<picture>` elements.
- **AutoTrader:** Extract from `.gallery img`, `.advert-image img`, or `data-lazy-src` attributes.
- **Fallback:** Generic extraction: all `<img>` tags with `src` starting with `https://`, filtered to images with `width` > 200 or no explicit size. Deduplicate by URL.

**Image URL validation:**
- Must start with `https://` or `http://`
- Protocol-relative URLs (`//cdn...`) are prefixed with `https:`
- Relative URLs are resolved against the source_url origin
- Deduplicated before storing

**Update strategy:** REPLACE — since we only target listings where `images = '{}'`, there's nothing to append to. Each listing update is an independent row-level operation (no batch transaction needed).

### File: `src/app/api/cron/backfill-images/route.ts`

```
GET /api/cron/backfill-images
Authorization: Bearer <CRON_SECRET>

1. Query listings: status='active', images='{}', limit 50, order by updated_at ASC
2. For each listing:
   a. Fetch source_url HTML (10s timeout)
   b. Extract images via imageScraper
   c. UPDATE listings SET images=<extracted>, updated_at=now() WHERE id=<id>
   d. Wait 2s (rate limit)
3. Record run to scraper_runs
4. Return JSON summary
```

**Constraints:**
- `maxDuration: 300` (Vercel limit)
- Processes max 50 listings per run (~2s delay × 50 = ~100s fetch + parsing)
- Ordered by `updated_at ASC` to prioritize stale listings

### File: `scripts/backfill-images.ts`

```
Usage: npx tsx scripts/backfill-images.ts [options]

Options:
  --source <name>    Filter by source (BaT, ClassicCom, etc.)
  --limit <n>        Max listings to process (default: all)
  --dry-run          Preview without writing to DB
  --delay <ms>       Delay between requests (default: 2000)
```

**Behavior:**
- Queries all active listings with empty images
- Processes sequentially with rate limiting
- Logs progress: `[42/3867] Updated: 2004 Porsche 911 GT3 — 12 images found`
- Summary at end: total processed, updated, errors, skipped

### Vercel Cron Config

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/backfill-images",
    "schedule": "0 4 * * *"
  }]
}
```

Runs daily at 4 AM UTC.

## Data Flow

```
                    ┌──────────────────┐
                    │   Supabase DB    │
                    │  listings table  │
                    └────────┬─────────┘
                             │
              SELECT id, source, source_url
              WHERE status='active' AND images='{}'
                             │
                    ┌────────▼─────────┐
                    │  imageScraper.ts  │
                    │  (per platform)   │
                    └────────┬─────────┘
                             │
                   fetch HTML → cheerio parse
                   → platform-specific extraction
                             │
                    ┌────────▼─────────┐
                    │  UPDATE listings  │
                    │  SET images=[...] │
                    └──────────────────┘
```

## Edge Cases

1. **Source URL returns 404/403:** Log error, skip listing, don't retry until next run
2. **No images found after scraping:** Set `images` to `'{}'` still (no change), log as "no images extractable"
3. **Source URL redirects:** Follow redirects (fetch handles this)
4. **Rate limiting by source site:** 2s delay between requests; if HTTP 429 received, stop batch early and log remaining count
5. **Listing deleted between query and update:** Supabase update is a no-op, no error
6. **HTML parsing fails:** Log error with listing ID and source_url, skip to next listing
7. **Cloudflare/bot protection:** Some sites may block scraping; log as "blocked" and skip

## Success Metrics

- Reduce active listings with empty images from ~3,867 to < 100
- CLI backfill completes initial run without errors
- Cron catches new listings within 24h

## Out of Scope

- Sold/unsold/delisted listings (user decision)
- Image storage/CDN (images stay as external URLs)
- photos_media table migration
- Modifying existing scraper cron jobs
