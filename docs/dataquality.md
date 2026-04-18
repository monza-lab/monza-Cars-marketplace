# Data Quality Overview

This document describes where the marketplace data comes from, how it is collected, how it is stored, and how the data-quality matrix is read from the system.

## 1. Primary Source Of Truth

The main source of truth for listing quality is the `public.listings` table in Supabase.

That table stores the normalized listing rows used by the marketplace and by the admin data-quality dashboard. The quality matrix is computed from the presence or absence of values in those rows.

Related operational tables:

- `public.scraper_runs` - run history and ingestion counters
- `public.scraper_active_runs` - currently running collectors
- `public.price_history` - historical pricing snapshots

## 2. Where The Data Comes From

Listings are collected from multiple marketplace-specific scrapers and enrichment jobs.

### Collectors

- `Porsche Collector`
  - Sources: Bring a Trailer, Cars & Bids, Collecting Cars
  - Location: `src/features/scrapers/porsche_collector/`
- `Ferrari Collector`
  - Sources: Bring a Trailer, Cars & Bids, Collecting Cars
  - Location: `src/features/scrapers/ferrari_collector/`
- `AutoTrader Collector`
  - Source: AutoTrader UK
  - Location: `src/features/autotrader_collector/`
- `BeForward Collector`
  - Source: BeForward
  - Location: `src/features/scrapers/beforward_porsche_collector/`
- `Classic.com Collector`
  - Source: Classic.com
  - Location: `src/features/scrapers/classic_collector/`
- `AutoScout24 Collector`
  - Source: AutoScout24
  - Location: `src/features/scrapers/autoscout24_collector/`
- `Elferspot Collector`
  - Source: Elferspot
  - Location: `src/features/scrapers/elferspot_collector/`

### Enrichment Jobs

These jobs do not create the listing universe by themselves. They fill gaps after discovery:

- VIN enrichment: `src/app/api/cron/enrich-vin/route.ts`
- Title enrichment: `src/app/api/cron/enrich-titles/route.ts`
- Detail enrichment: `src/app/api/cron/enrich-details/route.ts`
- AutoTrader enrichment: `src/app/api/cron/enrich-autotrader/route.ts`
- BeForward enrichment: `src/app/api/cron/enrich-beforward/route.ts`
- Elferspot enrichment: `src/app/api/cron/enrich-elferspot/route.ts`
- Image backfill: `src/app/api/cron/backfill-images/route.ts`
- BaT detail scraper: `scripts/bat-detail-scraper.ts` and `.github/workflows/bat-detail-scraper.yml`

## 3. How The Data Is Collected

The collectors use different retrieval methods depending on the source:

- HTTP + HTML parsing for sites that expose stable markup
- GraphQL/API access for AutoTrader
- Playwright browser automation for sites that require a browser session
- Cheerio / JSON-LD parsing for sources that publish structured data

Some sources also use a second-pass detail fetch to recover missing fields such as:

- mileage
- VIN
- color
- engine
- transmission
- body style
- images

### Fallback Strategy

For sources that need higher recovery, the code uses a fallback fetch-and-parse path. The current direction is:

- try the native source parser first
- if a field is missing, run a detail-page backfill for that source
- use Scrapling as the fallback parser when the normal HTML extraction is incomplete or brittle

## 4. How The Data Gets Into Supabase

Each collector normalizes source data into the shared `listings` schema and writes through a Supabase client using the service role key when available.

The write path generally looks like:

1. Discover a listing from a marketplace source
2. Normalize source fields into the internal listing shape
3. Validate the row
4. Upsert into `public.listings`
5. Insert price history when relevant
6. Record the run in `public.scraper_runs`

The writers are source-local, for example:

- `src/features/scrapers/autotrader_collector/supabase_writer.ts`
- `src/features/scrapers/classic_collector/supabase_writer.ts`
- `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- `src/features/scrapers/porsche_collector/supabase_writer.ts`
- `src/features/scrapers/ferrari_collector/supabase_writer.ts`
- `src/features/scrapers/autoscout24_collector/supabase_writer.ts`
- `src/features/scrapers/elferspot_collector/supabase_writer.ts`

## 5. How The Data-Quality Matrix Is Computed

The admin data-quality matrix is computed from `public.listings`.

The current admin endpoint is:

- `GET /api/admin/scrapers/field-completeness`
- Implementation: `src/app/api/admin/scrapers/field-completeness/route.ts`

That endpoint:

1. Authenticates the admin user with Supabase Auth
2. Reads `public.listings`
3. Filters to active listings for the dashboard view
4. Counts how many rows per source have a non-empty value for each field
5. Converts the counts into percentages
6. Returns the result to the admin scrapers screen

The screen that renders the matrix is:

- `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx`

## 6. What Counts As “Data Quality”

For the marketplace overview, data quality means field completeness, not subjective correctness.

Examples:

- `VIN` is complete when the field is present and non-empty
- `mileage` is complete when the numeric value exists
- `images` is complete when the array contains at least one URL
- `color_exterior` and `color_interior` are complete when the text values exist

This means a row can still be “high quality” even if some optional enrichment fields are missing, as long as the core listing data is present.

## 7. How To Access The Data

### In The App

- Admin dashboard: `/{locale}/admin/scrapers`
- Quality endpoint: `/api/admin/scrapers/field-completeness`

### Directly In Supabase

The most useful query target for audits is:

- `public.listings`

Other supporting tables:

- `public.scraper_runs`
- `public.scraper_active_runs`
- `public.price_history`

### From Scripts

The repository also has audit scripts that read the same data directly:

- `scripts/data-quality-audit.ts`
- `scripts/verify-scraper-quality.mjs`

Those scripts use either:

- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- or `DATABASE_URL` for direct Postgres access when a SQL-level audit is needed

## 8. Environment Access

The collector and audit paths rely on these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

The service role key is used for privileged writes and audits. The anon key is only used where the code explicitly allows it.

## 9. Notes On Coverage

Not every source has the same depth of data.

Typical stronger fields:

- year
- make
- model
- title
- status
- images

Typical weaker fields:

- mileage
- VIN
- color
- engine
- transmission
- body style

The matrix should be interpreted as a source-by-source completeness view over the normalized `listings` schema, not as a guarantee that every field is available from every marketplace.
