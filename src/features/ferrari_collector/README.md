# Ferrari Collector

Collect Ferrari listings from existing scrapers (BaT, Cars & Bids, Collecting Cars) and persist into Supabase tables described in `BASE_DATOS_COMPLETA_TODOS_LUJO.md`.

## Environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (preferred for writes) or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Notes:
- The CLI bootstraps env from `.env.local` / `.env` when present (it only fills missing vars and never overrides an already-set `process.env`).
- In CI/cron, prefer exporting env vars explicitly.

## Run

Daily incremental sync (active + ended within last 90 days):

```bash
npx tsx src/features/ferrari_collector/cli.ts --mode=daily
```

Backfill ended listings within a date range (UTC, inclusive):

```bash
npx tsx src/features/ferrari_collector/cli.ts --mode=backfill --dateFrom=2026-01-01 --dateTo=2026-01-07
```

Useful flags:

```bash
--maxActivePages=10 --maxEndedPages=10 --endedWindowDays=90 --checkpointPath=var/ferrari_collector/checkpoint.json --dryRun --noDetails
```

## Smoke run

Use a small backfill window and verify rows:

```bash
npx tsx src/features/ferrari_collector/cli.ts --mode=backfill --dateFrom=2026-01-01 --dateTo=2026-01-02 --maxEndedPages=2
```

Expect JSON logs with `collector.source_done` and Supabase writes.
