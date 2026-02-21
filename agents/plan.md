# Plan - Porsche Multi-Source Apify -> Supabase

This plan executes in one-shot feature phases and one-shot testscripts per phase, aligned to `LLM_FRIENDLY_PLAN_TEST_DEBUG`.

## Scope

- Goal: scrape all Porsche-relevant data for all models from Apify scrapers (Bring a Trailer, Cars & Bids, AutoScout24, ClassicCars) and upload to existing Supabase DB (`xgtlnyemulgdebyweqlf`).
- Existing DB state (audited): `public.listings` populated with `363` Porsche BaT rows; other target enrichment tables mostly empty; RLS/security and index/perf findings present.
- Delivery style: vertical slices, locality-first, deterministic runs, replayable artifacts.

## Phase 0 - Environment Matrix + DB Contract Freeze

### Deliverables

- Environment matrix artifact: `agents/testscripts/artifacts/env-matrix.md`.
- DB audit artifact: `agents/testscripts/artifacts/db-audit-<timestamp>.md`.
- Contract freeze doc: accepted target columns and source-field mapping table.

### Pass/Fail

- Pass: Supabase connectivity, table inventory, enum constraints, PK/FK set, existing row counts, advisor findings captured.
- Fail: any unknown required column/type mismatch remains unresolved.

### Testscript TS-P0-DB-AUDIT

- Objective: verify exact runtime and DB baseline before coding.
- Prerequisites: `.env.local` with Supabase and Apify vars present.
- RUN:
  - `node -v && npm -v`
  - `npm run -s env:check` (or equivalent validation command created in Phase 1)
  - `npm run -s db:audit:porsche`
- OBSERVE:
  - Runtime versions, DB project ref, table counts, advisor issues, source distribution.
- COLLECT:
  - `agents/testscripts/artifacts/env-matrix.md`
  - `agents/testscripts/artifacts/db-audit-<timestamp>.json`
- REPORT:
  - Record observed vs expected and list blocking mismatches.
- Cleanup: none.
- Known limitations: row counts in `pg_stat_user_tables` are estimated.

## Phase 1 - Core Ingestion Slice (Canonical Contracts + Supabase Writer)

### Deliverables

- `src/features/porsche_ingest/contracts/*` (zod contracts).
- `src/features/porsche_ingest/repository/supabase_writer.ts` (idempotent upserts).
- `src/features/porsche_ingest/services/{normalize,dedupe}.ts`.
- `scripts/ingest-porsche.ts` CLI entrypoint.

### Pass/Fail

- Pass: one canonical sample listing writes to `public.listings` and correct child table rows.
- Fail: duplicate insertions, contract drift, or missing required fields.

### Testscript TS-P1-INGEST-CORE

- Objective: verify canonical upsert semantics.
- Prerequisites: Phase 0 pass.
- RUN:
  - `npm run test -- src/features/porsche_ingest/contracts`
  - `npm run ingest:porsche -- --source=bat --mode=sample --limit=5 --dry-run`
  - `npm run ingest:porsche -- --source=bat --mode=sample --limit=5`
- OBSERVE:
  - Dry-run emits valid mapping summary.
  - Real-run inserts/updates deterministic row counts.
  - Re-run same batch produces updates, not duplicates.
- COLLECT:
  - `var/runs/porsche-ingest/<run-id>.json`
  - SQL snapshot of affected rows.
- REPORT:
  - Upsert stats (`inserted`, `updated`, `rejected`, `retried`).
- Cleanup:
  - delete test rows by run tag if needed.
- Known limitations:
  - sample mode cannot prove full-rate stability.

## Phase 2 - Source Adapters (BaT, Cars & Bids, AutoScout24, ClassicCars)

### Deliverables

- `src/features/porsche_ingest/adapters/bat.ts`
- `src/features/porsche_ingest/adapters/carsandbids.ts`
- `src/features/porsche_ingest/adapters/autoscout24.ts`
- `src/features/porsche_ingest/adapters/classiccars.ts`
- Source fixture contracts and mapping tests.

### Pass/Fail

- Pass: each source maps to canonical schema with >=95% parse success on fixture set.
- Fail: unbounded field loss or source-specific crashes.

### Testscript TS-P2-SOURCE-CONTRACTS

- Objective: validate source-specific parsing and normalization.
- Prerequisites: Phase 1 pass.
- RUN:
  - `npm run test -- src/features/porsche_ingest/adapters`
  - `npm run ingest:porsche -- --source=carsandbids --mode=sample --limit=20 --dry-run`
  - `npm run ingest:porsche -- --source=autoscout24 --mode=sample --limit=20 --dry-run`
  - `npm run ingest:porsche -- --source=classiccars --mode=sample --limit=20 --dry-run`
- OBSERVE:
  - Porsche-only filter enforced.
  - Price/date/mileage normalization succeeds.
  - Rejected records include explicit reason codes.
- COLLECT:
  - Source parse reports JSON.
  - Rejects JSONL.
- REPORT:
  - Parse success %, top rejection reasons, model coverage.
- Cleanup: remove sample run tags.
- Known limitations: source payload shape may drift.

## Phase 3 - Incremental + Backfill Execution Strategy

### Deliverables

- Checkpointing (`last_cursor`, `last_seen_at`, `run_id`) in `ModelBackfillState` or dedicated ingest-state table.
- Two modes: `incremental` (daily) and `backfill` (historical all models).
- Concurrency guard + rate pacing.

### Pass/Fail

- Pass: resumed runs continue from checkpoint without replay floods.
- Fail: missed windows, duplicate storms, or checkpoint corruption.

### Testscript TS-P3-RESUME-AND-BACKFILL

- Objective: prove resumability and full model coverage.
- Prerequisites: Phase 2 pass.
- RUN:
  - `npm run ingest:porsche -- --source=bat --mode=incremental --since=24h`
  - `npm run ingest:porsche -- --source=all --mode=backfill --from=2000-01-01 --limit=500`
  - Interrupt run and resume: `npm run ingest:porsche -- --resume=<run-id>`
- OBSERVE:
  - checkpoint advances monotonically.
  - resumed run skips already committed rows.
  - model distribution broadens beyond existing BaT subset.
- COLLECT:
  - checkpoint table snapshot.
  - run report before/after resume.
- REPORT:
  - recovery proof with exact counts.
- Cleanup: clear test-only checkpoint rows.
- Known limitations: historical availability differs by marketplace.

## Phase 4 - Data Quality, Security, and Regression Gate

### Deliverables

- Quality rules (missing price, invalid year, malformed VIN, non-Porsche contamination).
- Security tasks queued: enable RLS policy rollout plan and restricted service-role usage.
- Regression testscript pack.

### Pass/Fail

- Pass: all critical testscripts green; non-Porsche contamination rate is 0%; no secret leaks.
- Fail: unresolved critical lints, flaky runs, or repeated failures.

### Testscript TS-P4-PROD-READINESS

- Objective: certify production readiness.
- Prerequisites: Phases 0-3 pass.
- RUN:
  - `npm run test -- src/features/porsche_ingest`
  - `npm run ingest:porsche -- --source=all --mode=incremental --limit=200`
  - `npm run db:quality:porsche`
  - `npm run db:security:advisors`
- OBSERVE:
  - stable throughput, deterministic errors, explicit diagnostics.
  - no non-Porsche rows introduced.
  - quality scores and missing-field rates within threshold.
- COLLECT:
  - final readiness report + advisor snapshots + run metrics.
- REPORT:
  - go/no-go decision with rationale.
- Cleanup: archive artifacts under `agents/testscripts/artifacts/final/`.
- Known limitations: marketplace anti-bot changes can impact source availability.

## One-Shot Execution Guidance (Feature Phases + Testscripts)

1. Execute Phase 0 -> 4 sequentially in one implementation cycle.
2. At each phase, run its testscript immediately after implementation.
3. Re-run all prior phase testscripts before advancing (regression lock).
4. Use one-hypothesis/one-variable debug iterations when failing.
5. If any test still fails after two debug turns, stop and generate `agents/testscripts/failure_report.md` with required defect fields.

## Failure Report Mandate

If after trying to debug for two turns or more tests still fail, generate `agents/testscripts/failure_report.md` containing:

- title, severity, frequency, phase, script-identifier
- environment matrix, build/commit
- exact reproduction steps
- observed vs expected behavior
- artifact references
- suspected boundary and hypothesis
- workaround (if any)
- regression status and owner

## Operator Command Checklist (Exact)

```bash
npm install
npm run test
npm run ingest:porsche -- --source=bat --mode=sample --limit=20 --dry-run
npm run ingest:porsche -- --source=all --mode=incremental --limit=200
npm run ingest:porsche -- --source=all --mode=backfill --from=2000-01-01
npm run db:quality:porsche
```

## Locality Budget (Execution Guardrail)

- Files: <= 16 files touched for ingestion feature rollout.
- LOC/file: target <= 700, hard max 1000.
- Dependencies: max +3 production (`@supabase/supabase-js`, `zod`, `p-limit`), max +2 dev.
