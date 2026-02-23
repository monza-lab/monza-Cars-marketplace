# TS Porsche Ingest Option C

## TS-P0-DB-AUDIT

- `node -v && npm -v`
- `npm run -s env:check`
- `npm run -s db:audit:porsche`

## TS-P1-INGEST-CORE

- `npm run test -- src/features/porsche_ingest/contracts`
- `npm run ingest:porsche -- --source=bat --mode=sample --limit=5 --dry-run`
- `npm run ingest:porsche -- --source=bat --mode=sample --limit=5`

## TS-P2-SOURCE-CONTRACTS

- `npm run test -- src/features/porsche_ingest`
- `npm run ingest:porsche -- --source=carsandbids --mode=sample --limit=20 --dry-run`
- `npm run ingest:porsche -- --source=autoscout24 --mode=sample --limit=20 --dry-run`
- `npm run ingest:porsche -- --source=classiccars --mode=sample --limit=20 --dry-run`

## TS-P2A-AUTOSCOUT24-PPR-SMALL-BATCH

- Objective: verify `3x1t/autoscout24-scraper-ppr` pan-European Porsche ingestion with low run cost.
- Preconditions: `APIFY_AUTOSCOUT24_ACTOR_ID=3x1t/autoscout24-scraper-ppr` and valid `APIFY_TOKEN`.
- `npm run test -- src/features/porsche_ingest`
- `npm run ingest:porsche -- --source=autoscout24 --mode=sample --limit=5 --dry-run`
- `npm run ingest:porsche -- --source=autoscout24 --mode=sample --limit=5`
- Observe: report includes `source=autoscout24` and non-zero `fetched`/`normalized` with Porsche-only records.

## TS-P2B-AUTOSCOUT24-PROD-LISTINGS-ONLY

- Objective: production-style AutoScout24 Porsche ingest writing only `listings` parent rows.
- Preconditions: valid `APIFY_TOKEN`, `APIFY_AUTOSCOUT24_ACTOR_ID=3x1t/autoscout24-scraper-ppr`, Supabase service role key.
- `npm run ingest:porsche -- --source=autoscout24 --mode=backfill --limit=5000 --listings-only`
- Observe: report shows non-zero fetched/normalized/deduped and `errors=0`; `listings` rows increase for `source=AutoScout24` while child tables are unchanged.

## TS-P3-RESUME-AND-BACKFILL

- `npm run ingest:porsche -- --source=bat --mode=incremental --since=24h`
- `npm run ingest:porsche -- --source=all --mode=backfill --from=2000-01-01 --limit=500`
- `npm run ingest:porsche -- --resume=<run-id>`

## TS-P4-PROD-READINESS

- `npm run test -- src/features/porsche_ingest`
- `npm run ingest:porsche -- --source=all --mode=incremental --limit=200`
- `npm run db:quality:porsche`
- `npm run db:security:advisors`
