# Porsche-first Multi-make Onboarding Playbook

## Purpose
- Run production ingestion with Porsche as the default make.
- Keep Ferrari ingestion stable via explicit `--make=Ferrari` runs.
- Add future makes without changing API contracts.

## Phase A: Environment
1. Confirm `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
2. Install dependencies: `npm install`.
3. Verify runtime: `node -v && npm -v`.

## Phase B: Porsche-first Runbook
1. Daily run: `npx tsx src/features/ferrari_collector/cli.ts --mode=daily`.
2. Controlled backfill: `npx tsx src/features/ferrari_collector/cli.ts --mode=backfill --dateFrom=YYYY-MM-DD --dateTo=YYYY-MM-DD`.
3. Checkpoint path defaults to `var/ferrari_collector/checkpoint.json`.

## Phase C: Ferrari Compatibility Runbook
1. Daily run: `npx tsx src/features/ferrari_collector/cli.ts --mode=daily --make=Ferrari`.
2. Backfill run: `npx tsx src/features/ferrari_collector/cli.ts --mode=backfill --make=Ferrari --dateFrom=YYYY-MM-DD --dateTo=YYYY-MM-DD`.

## Phase D: Add Next Make
1. Add make to `src/lib/makeProfiles.ts`.
2. Run dry validation: `npx tsx src/features/ferrari_collector/cli.ts --mode=daily --make=<Make> --dryRun --maxActivePages=1 --maxEndedPages=1`.
3. Run targeted tests and build.

## Validation Checklist
- `npm test -- src/features/ferrari_collector/normalize.test.ts src/features/ferrari_collector/supabase_writer.test.ts src/features/ferrari_collector/id.test.ts`
- `npm run build`
- Runtime checks:
  - `GET /api/mock-auctions` serves Porsche by default.
  - `GET /api/mock-auctions?make=Ferrari` serves Ferrari when data exists.
  - `GET /api/listings/live-<id>/price-history` returns timeline entries for supported makes.
