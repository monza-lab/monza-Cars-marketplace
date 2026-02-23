# 1) Goal
Implement AutoScout24 live ingest for pan-European Porsche-only listings using Apify actor `3x1t/autoscout24-scraper-ppr`, while minimizing token usage and operational overhead by reusing the existing Porsche ingest pipeline.

# 2) Primary User / Actor
- Primary actor: data ingestion operator running `scripts/ingest-porsche.ts`.
- User moment: scheduled or manual ingest runs for live Porsche inventory updates across Europe.

# 3) Inputs
Required inputs
- `APIFY_TOKEN`.
- `APIFY_AUTOSCOUT24_ACTOR_ID=3x1t/autoscout24-scraper-ppr`.
- Supabase env (`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for writes).
- Existing entrypoint `scripts/ingest-porsche.ts` invoking `runIngest(process.argv.slice(2))`.

Optional inputs
- CLI flags: `--source=autoscout24`, `--mode=incremental`, `--limit=<n>`, `--dry-run`, `--fail-fast`, `--resume=<run_id>`.
- Cursor/time filters supported by current pipeline (`--since`, `--from`) when available.

# 4) Outputs / Deliverables
- Updated AutoScout24 source adapter input contract aligned to actor `3x1t/autoscout24-scraper-ppr` for pan-European Porsche-only fetches.
- Ingest behavior that writes into the existing single `listings` table, differentiated by source fields (`source`, `source_id`, `source_url`).
- Deterministic dedupe behavior: primary key `source+source_id`, fallback `source_url`, fallback fingerprint.
- Run artifacts/reports emitted by existing ingest observability path.

Implementation budget: `{files: 3-4, LOC/file: 20-140, deps: 0}`.

# 5) Core Pipeline
1. Invoke `scripts/ingest-porsche.ts` with AutoScout24 source (`--source=autoscout24`) and incremental mode.
2. Build actor input for `3x1t/autoscout24-scraper-ppr` with constraints: pan-European scope, Porsche make filter, all Porsche models.
3. Fetch raw dataset items through existing Apify adapter (`src/features/porsche_ingest/adapters/apify.ts`).
4. Normalize to canonical listing contract (`normalizeRawListing`) and reject non-conforming/non-Porsche payloads.
5. Apply dedupe in this order:
   - primary: `source + source_id`
   - fallback: normalized `source_url`
   - fallback: deterministic fingerprint over stable fields (`year|model|vin|mileage|price|city`).
6. Upsert into existing `listings`-centric persistence flow and child tables via current writer.
7. Emit run report and checkpoint updates through existing observability/checkpoint services.

# 6) Data / Evidence Contracts
Canonical ingest contract
- Must satisfy existing `CanonicalListingSchema` in `src/features/porsche_ingest/contracts/listing.ts`.
- `make` must be `Porsche` (hard gate).
- `source` must be `AutoScout24` for this ingest path.

Differentiation contract across marketplaces
- `source` distinguishes marketplace (`AutoScout24` vs `BaT`, etc.).
- `source_id` remains source-scoped; uniqueness is enforced with `source` pair.
- `source_url` preserves original marketplace URL and serves as secondary identity.
- Run metadata/report retains per-source traceability (totals/errors/rejections).

Token-efficiency contract
- Persist only fields required by existing `listings`/child-table write path.
- Keep `raw_payload` trimmed to fields needed for debugging/replay, avoiding unbounded blobs.

# 7) Constraints
- Reuse existing architecture centered on `scripts/ingest-porsche.ts` and `runIngest`; no parallel ingest framework.
- Keep a single `listings` table (no per-marketplace listing tables).
- No new dependencies (0-deps path).
- Scope fixed to pan-European AutoScout24 and Porsche-only (all Porsche models).
- Prefer incremental mode as default to minimize data volume, tokens, and operational cost.

# 8) Non-Goals / Backlog
- No schema split into marketplace-specific listing tables.
- No frontend/UI changes.
- No multi-make ingest expansion in this phase.
- No actor-framework migration or new queue/orchestrator introduction.
- No backfill redesign beyond current pipeline capabilities.

# 9) Definition of Done
- AutoScout24 ingest runs through existing `scripts/ingest-porsche.ts` -> `runIngest` flow using actor `3x1t/autoscout24-scraper-ppr`.
- Only Porsche listings are accepted; non-Porsche records are rejected with explicit reasons.
- Records are written to the existing single `listings` table and are distinguishable by `source` metadata.
- Dedupe order is implemented and verified: `source+source_id` -> `source_url` -> deterministic fingerprint.
- No new package dependencies are added.
- Budget respected: `{files: 3-4, LOC/file: 20-140, deps: 0}`.
- Run/verify commands (placeholders aligned to repo):
  - `npx tsx scripts/ingest-porsche.ts --source=autoscout24 --mode=incremental --limit=50 --dry-run`
  - `npx tsx scripts/ingest-porsche.ts --source=autoscout24 --mode=incremental --limit=200`
  - `npm test -- src/features/porsche_ingest`
