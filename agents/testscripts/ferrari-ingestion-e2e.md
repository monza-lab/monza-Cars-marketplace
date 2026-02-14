## Testscript: Ferrari ingestion end-to-end (scrapers -> Supabase -> UI)

Objective: Prove the Ferrari collector can (a) run end-to-end, (b) write idempotently to Supabase luxury schema tables, and (c) render in the app UI.

Prerequisites:
- Node 20+
- Supabase project `xgtlnyemulgdebyweqlf` is accessible
- Env vars (server-side only):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (preferred for writes). If omitted, `NEXT_PUBLIC_SUPABASE_ANON_KEY` may work only if RLS allows writes.

Setup (workspace root):

```bash
npm ci
```

Run A: Unit tests + build

```bash
npm test
npm run build
```

Expected observations:
- `vitest` passes.
- `next build` completes.

Run B: Collector dry run (no Supabase required)

```bash
npx tsx src/features/ferrari_collector/cli.ts --mode=daily --maxActivePages=1 --maxEndedPages=1 --noDetails --dryRun
```

Expected observations:
- Logs include `collector.start`, `discover.page_fetched`, `collector.normalized`, `collector.done`.
- No crash due to missing Supabase env vars.

Run C: Collector real write (small window)

```bash
export NEXT_PUBLIC_SUPABASE_URL="..."
export SUPABASE_SERVICE_ROLE_KEY="..."

npx tsx src/features/ferrari_collector/cli.ts --mode=backfill --dateFrom=2026-02-10 --dateTo=2026-02-12 --maxEndedPages=2 --noDetails
```

Expected observations:
- Logs include `collector.source_done` with `written > 0` (best-effort; may be 0 if sources have no Ferrari in that window).
- Supabase tables have rows:

```sql
select count(*) from public.listings where make = 'Ferrari';
select count(*) from public.price_history ph join public.listings l on l.id = ph.listing_id where l.make = 'Ferrari';
```

Run D: Visual verification

```bash
npm run dev
```

Open:
- `http://localhost:3000/en/ferrari`

Expected observations:
- Page renders a table of Ferrari rows from `public.listings`.
- Links open the source listing URLs.

Artifacts:
- Checkpoint file: `var/ferrari_collector/checkpoint.json`

Cleanup:
- None.

Known limitations:
- Ended listing discovery is best-effort and depends on each platform’s search/results HTML.
- Some ended listings may be skipped if close/end date cannot be parsed (DB requires `sale_date`).
