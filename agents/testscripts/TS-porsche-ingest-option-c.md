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

## TS-P3-RESUME-AND-BACKFILL

- `npm run ingest:porsche -- --source=bat --mode=incremental --since=24h`
- `npm run ingest:porsche -- --source=all --mode=backfill --from=2000-01-01 --limit=500`
- `npm run ingest:porsche -- --resume=<run-id>`

## TS-P4-PROD-READINESS

- `npm run test -- src/features/porsche_ingest`
- `npm run ingest:porsche -- --source=all --mode=incremental --limit=200`
- `npm run db:quality:porsche`
- `npm run db:security:advisors`
