# Project Canon - Porsche Apify -> Supabase Ingestion

Prime Directive: `agents/canon.md` is the sole source of truth for architecture, contracts, and operational behavior for the Porsche ingestion program.

## Non-Generic Perspective (Final)

We reject the generic approach of "one big cron script + best effort inserts". The chosen architecture is a deterministic ingestion monolith with strict vertical slices, typed contracts at every boundary, source-specific adapters, idempotent upserts, and replayable run manifests. This is superior because it preserves locality, makes debugging convergent, and prevents silent data drift while scaling to all Porsche models across 4 marketplaces.

## Database Audit Snapshot (Supabase `garage` -> `garage-advisory` / `xgtlnyemulgdebyweqlf`)

- Public schema is active with core ingestion target `public.listings` and auxiliary tables (`pricing`, `vehicle_specs`, `auction_info`, `location_data`, `photos_media`, `provenance_data`, `price_history`, etc.).
- Current Porsche inventory is BaT-only: `363` listings (`277 sold`, `86 active`), source=`BaT`; no Cars & Bids / AutoScout24 / ClassicCars rows yet.
- Coverage gaps: child enrichment tables are empty (`pricing`, `vehicle_specs`, `auction_info`, `location_data`, `photos_media`, `provenance_data` all `0` rows).
- Quality gaps in current Porsche rows: `86` rows missing all price fields (`hammer_price`, `final_price`, `price_usd`); `1` row missing VIN.
- Legacy duplication exists (`Auction`/`PriceHistory` uppercase legacy tables) and `ops_archive` contains non-trivial historical archived tables.
- Security posture issue: RLS disabled on exposed public tables (Supabase advisor `rls_disabled_in_public` errors).
- Performance posture issue: unindexed foreign keys flagged on `Comparable`, `PriceHistory`, `market_analytics`; several archive tables have no primary key.

## Architecture Choice (Why this works best)

Single-process, feature-sliced ingestion pipeline executed via CLI commands (not background workers yet), with one canonical normalized listing contract and one write path into Supabase.

- Source adapters (BaT, Cars & Bids, AutoScout24, ClassicCars) only transform external payloads to canonical DTOs.
- Canonical validator performs schema and normalization before persistence.
- Repository layer upserts parent listing first, then fan-out child-table upserts in one transaction boundary per listing.
- Run manifest + checkpoint table guarantees resumability and deterministic re-runs.
- Testscripts validate smoke, happy path, edge, failure, recovery, budget, and security layers in order.

## Detailed Decisions (Unified Checklist)

### A1. Authentication & Authorization Schema

- Auth method: `API-key-header` outbound to Apify; `service-role JWT key` inbound to Supabase client.
- User model file location: `src/features/porsche_ingest/contracts/operator.ts`.
- Permission enforcement point: CLI boundary guard in `src/features/porsche_ingest/entrypoints/run_ingest.ts`.

```typescript
export type OperatorContext = {
  actor: 'system' | 'operator';
  canWrite: boolean;
  canRunBackfill: boolean;
};

export function assertOperatorCanWrite(ctx: OperatorContext) {
  if (!ctx.canWrite) {
    return { status: 403, code: 'FORBIDDEN', message: 'Write permission required' };
  }
  return null;
}
```

### A2. Request Flow & State Management

- Entry point: CLI commands.
  - `npm run ingest:porsche -- --source=bat --mode=incremental`
  - `npm run ingest:porsche -- --source=autoscout24 --mode=backfill`
- Lifecycle order: `load-config -> validate-cli-input -> auth-guard -> fetch-apify-dataset -> normalize -> dedupe -> upsert-listing -> upsert-child-records -> emit-run-report -> persist-checkpoint`.
- State storage: `Postgres (Supabase)` + filesystem JSON run manifests.
- State location:
  - DB: `postgresql://...xgtlnyemulgdebyweqlf...`
  - Files: `var/runs/porsche-ingest/<run-id>.json`
- Transaction boundaries: explicit begin/commit per listing write bundle.

### A3. Error Handling & Recovery

```typescript
export type ErrorResponse = {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
};
```

- Validation library: `zod`.
- Validation location: both boundary and service layer.
- Retry strategy: exponential backoff for Apify pulls and Supabase transient failures (`3` attempts, jitter).
- Fallback behavior on critical failure: return error and persist failure artifact (`agents/testscripts/failure_report.md` after two failed debug turns).

### A4. Data Contracts & Schemas

- Schema definition tool: `Zod` + inferred TypeScript types.
- Schema files location: feature-local `src/features/porsche_ingest/contracts/`.
- Contract testing approach: schema-validation tests + example-based fixtures per source.

```typescript
import { z } from 'zod';

export const CanonicalListingSchema = z.object({
  source: z.enum(['BaT', 'CarsAndBids', 'AutoScout24', 'ClassicCars']),
  source_id: z.string().min(1),
  source_url: z.string().url(),
  make: z.literal('Porsche'),
  model: z.string().min(1),
  year: z.number().int().gte(1948).lte(new Date().getFullYear() + 1),
  sale_date: z.string().date().or(z.null()),
  status: z.enum(['active', 'sold', 'unsold', 'delisted', 'draft']),
  vin: z.string().min(5).optional().nullable(),
  hammer_price: z.number().nonnegative().optional().nullable(),
});
```

### A5. Critical User Journeys

- Primary happy path:
  1. `scripts/ingest-porsche.ts` parses CLI args.
  2. `src/features/porsche_ingest/adapters/<source>.ts` fetches Apify dataset for Porsche filters.
  3. `src/features/porsche_ingest/services/normalize.ts` maps to canonical DTO.
  4. `src/features/porsche_ingest/services/dedupe.ts` computes unique key (`source + source_id` fallback `source_url`).
  5. `src/features/porsche_ingest/repository/supabase_writer.ts` upserts into `public.listings` and child tables.
  6. `src/features/porsche_ingest/observability/run_report.ts` writes run metrics.
- First decision point: `normalize.ts` checks if record is valid Porsche listing.
  - Branch A: valid -> persist.
  - Branch B: invalid/non-Porsche -> quarantine to `var/runs/porsche-ingest/rejects/<run-id>.jsonl`.
- Failure recovery example: on DB connection timeout, retry with backoff; after final failure, persist failed listing payload and continue batch unless `--fail-fast` is set.

### B1. Design System Foundation

- Base system: `none-vanilla-CSS` (internal ops report pages only).
- Why: this feature is ingestion-first; introducing UI frameworks is generic overhead and harms locality.
- Style file location: `src/features/porsche_ingest/ops/ops-report.css`.
- Design token file: `src/features/porsche_ingest/ops/tokens.css`.

### B2. Distinctive Visual Language

- Typography: `'IBM Plex Sans', 'IBM Plex Mono', ui-sans-serif, sans-serif`.
- Color palette: graphite + signal orange + muted green for state diagnostics.

```css
:root {
  --color-primary: #151a1f;
  --color-accent: #ff5a1f;
  --color-ok: #1f8a4c;
  --color-warn: #b7791f;
  --color-error: #b42318;
  --color-bg: #f4f1ea;
  --font-primary: 'IBM Plex Sans', ui-sans-serif, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
}
```

- Spacing scale: `4, 8, 12, 16, 24, 32` px.
- Border radius: subtle `4px`.
- Motion duration: `150ms` transitions.

### B3. Component Architecture

- Component file pattern: feature folders.
- Example component path: `src/features/porsche_ingest/ops/RunReportTable.tsx`.
- Prop validation: TypeScript + runtime zod for external payloads.
- State management: local state only.

### B4. Responsive Strategy

- Breakpoints: `sm 640`, `md 768`, `lg 1024`, `xl 1280`.
- Layout approach: CSS grid for report summaries + table overflow sections.
- Strategy: mobile-first.
- Touch target minimum: `44px`.

### B5. Accessibility Baseline

- Focus indicator style:

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- ARIA usage pattern: minimal semantic HTML + targeted ARIA for status banners.
- Keyboard navigation: all interactive elements.
- Color contrast target: WCAG AA (4.5:1).

### C1. Environment & Configuration

- Required env files: `.env.example`, `.env.local`, `.env.test`.
- Config loading library: `dotenv` via existing project runtime.
- Config validation: `zod` fail-fast.

```bash
NODE_ENV=development
NEXT_PUBLIC_SUPABASE_URL=https://xgtlnyemulgdebyweqlf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace_me
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace_me
DATABASE_URL=postgresql://replace_me
APIFY_TOKEN=replace_me
APIFY_BAT_ACTOR_ID=replace_me
APIFY_CARSANDBIDS_ACTOR_ID=replace_me
APIFY_AUTOSCOUT24_ACTOR_ID=replace_me
APIFY_CLASSICCARS_ACTOR_ID=replace_me
PORSCHE_ONLY=true
INGEST_BATCH_SIZE=100
INGEST_CONCURRENCY=4
```

### C2. Repository Structure

```text
/
|- src/
|  |- features/
|  |  |- porsche_ingest/
|  |- app/
|  |- lib/
|- scripts/
|- agents/
|- supabase/
|- tests/
|- .env.example
|- package.json
```

- File size limit: soft `<= 500 LOC`, hard `<= 1000 LOC`.
- Max nesting depth: `4` directories.

### C3. Dependency Management

- Package manager: `npm`.
- Lockfile: `package-lock.json`.
- Dependency budget (Option C moderate deps): production max `8` for this feature slice, dev max `10` incremental.
- Approved exceptions:
  - `@supabase/supabase-js` (DB API client)
  - `zod` (schema contracts)
  - `p-limit` (bounded concurrency)

### C4. Build & Development

- Commands:
  - `npm install`
  - `npm run dev`
  - `npm run build`
  - `npm test`
  - `npm start`
  - `npm run ingest:porsche -- --source=bat --mode=incremental`
- Dev server port: `3000`.
- Hot reload: yes.
- Build tool: Next.js build chain (existing).
- Output directory: `.next/`.

### C5. Testing Infrastructure

- Test framework: `vitest` (+ existing Playwright for e2e where needed).
- Test file pattern: `src/features/porsche_ingest/**/*.test.ts` and testscripts in `agents/testscripts/`.
- Test DB approach: real Supabase project with isolated run tags and rollback SQL for test data.
- Required test types: Smoke yes, Unit yes, Integration yes, E2E yes.
- Coverage target: `>= 80%` on new ingestion slice.

### C6. Logging & Observability

- Logging library: existing app logger (console JSON if no logger wrapper present).
- Log format: JSON structured.
- Log levels: `error,warn,info,debug`.
- Correlation ID: generated UUID per run + per listing.

```json
{"level":"info","time":1760958000000,"reqId":"run_20260220_001","source":"AutoScout24","listingKey":"autoscout24_12345","msg":"listing_upserted"}
```

### C7. Security Baseline

- Secrets management: env vars only; never committed.
- Input sanitization: boundary validation via zod + explicit allowlists.
- SQL injection prevention: parameterized Supabase queries / typed upsert payloads.
- XSS prevention: React auto-escaping in any ops UI output.
- CORS: specific origins only for API routes; ingestion CLI not public.
- Rate limiting: per-source request pacing (`p-limit` + min delay).

### C8. Git & Version Control

`.gitignore` must include:

```gitignore
node_modules/
dist/
build/
.env.local
.env.*.local
*.log
.DS_Store
coverage/
```

- Branch strategy: trunk (`main` + short-lived feature branches).
- Commit format: conventional commits.

### C9. Deployment & Infrastructure

- Deployment target: Vercel for app; ingestion runs via manual/CI job execution.
- Deployment trigger: CI pipeline + manual operator run for backfills.
- Environment parity: dev/prod identical for ingestion config schema.
- IaC: none added for this slice; use existing project infra.

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### C10. CI/CD Pipeline

- CI tool: GitHub Actions.
- Stages: `install -> typecheck -> unit -> integration -> build -> ingest-smoke`.
- Test execution: all ingestion tests for modified slice.
- Deployment approval: manual approval for production ingest jobs.

```yaml
name: CI
on: [push, pull_request]
jobs:
  test-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - run: npm run build
```

## Locality Budget

- Max files touched for this feature program: `<= 16`.
- Max LOC per file: `<= 700` target, `1000` hard cap.
- Max new dependencies: `3` production (`@supabase/supabase-js` already present; add only if missing), `0-2` dev.

## Constitution (Project-Specific)

1. Vertical slices are mandatory: adapter + schema + logic + tests remain adjacent under `src/features/porsche_ingest/`.
2. No generic abstraction layers before rule-of-three reuse appears.
3. Every boundary validates input and emits uniform error envelopes.
4. Every run is observable: correlation IDs, run manifest, artifact capture path.
5. Test-debug discipline is mandatory: one hypothesis per iteration, one variable changed, full regression rerun after fix.
6. After two failed debug turns on the same failing testscript, stop blind retries and write `agents/testscripts/failure_report.md` with required defect fields.
7. Never leak secrets in logs, reports, snapshots, or commits.
8. Prefer deterministic batch commands and reproducible outcomes over convenience scripts.
