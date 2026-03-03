# MONZA Cars Marketplace

## Getting Started

Run the app locally:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Admin Scrapers Dashboard

The scraper monitoring dashboard is available at:

- `/{locale}/admin/scrapers` (example: `/en/admin/scrapers`)

It shows:

- live scraper status cards
- active/running scraper jobs
- recent run history with errors
- daily ingestion trends
- data quality summaries

### 1) Grant Admin Access

Admin access is currently email-allowlisted in code:

- `src/app/[locale]/admin/scrapers/page.tsx`
- `src/app/api/admin/scrapers/live/route.ts`

Add your login email to `ADMIN_EMAILS` in both files.

### 2) Required Environment Variables

Set these vars locally and in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
```

Notes:

- `CRON_SECRET` must match what your cron routes expect in `Authorization: Bearer <CRON_SECRET>`.
- Supabase keys are required for reading/writing scraper monitoring data.

### 3) Apply Active-Run Migration

To track jobs while they are running (not only when finished), apply:

- `supabase/migrations/20260304_scraper_active_runs.sql`

Without this migration, the dashboard still loads, but active live job indicators will be incomplete.

### 4) Verify Live Updates

The dashboard auto-refreshes and also listens for realtime updates where available.

Quick check:

1. Open `/{locale}/admin/scrapers`.
2. Trigger a cron endpoint (with `Authorization: Bearer <CRON_SECRET>`), for example:
   - `GET /api/cron/porsche`
3. Confirm the scraper card switches to running/active, then to success/fail when done.
4. Confirm the run appears in Run History with duration, written/discovered counts, and error details.

### 5) Troubleshooting

- `401` on dashboard: your user email is not in `ADMIN_EMAILS` allowlist.
- no active job shown: migration above not applied or cron route not hitting `markScraperRunStarted`/`clearScraperRunActive`.
- stale status cards: cron schedule did not run recently or runs are failing; inspect Run History errors first.
