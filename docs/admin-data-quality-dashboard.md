# Admin Data Quality Dashboard

Route: `/{locale}/admin/data-quality`
API: `/api/admin/data-quality/overview`, `/api/admin/data-quality/scraper/{name}`
Gate: only emails in `ADMIN_EMAILS` can view.

## What this dashboard is for

The page is the single "truth-telling" view of scraper and cron health:

- Alerts rail at the top — red/yellow anomalies with an `inspect` link to the drill-down.
- Marketplace sources grid — one card per canonical source (AutoScout24, AutoTrader UK, Bring a Trailer, BeForward, Classic, Elferspot) with ingestion counts, field completeness, and the scrapers writing into it.
- Maintenance & enrichment jobs table — cron jobs (enrichers, backfills, validators, liveness checker) with status and failure counts.
- Drill-down panel — last 20 runs for whatever the operator clicked (source, scraper tag, maintenance row, or alert).

Ground truth is `v_source_ingestion` (a view over `listings`). The classification rule is ingestion-first: if listings landed recently, the source is green, even if `scraper_runs` never recorded a finish. This stops Elferspot-style false alarms where the collector dropped the `finally` block but actually did its job.

## Changes made in this session

### 1. Light/dark theme parity — `DataQualityClient.tsx`

The dashboard had been written in dark-only Tailwind (`bg-black`, `bg-zinc-950`, `border-zinc-{800,900}`, `text-zinc-{200..700}`). The rest of the app switches themes via the `.dark` class + CSS variables declared in `globals.css`, so the admin page stayed dark even when the user toggled light mode.

Migrated to the project's semantic tokens:

| Hardcoded                | Replaced with                       |
| ------------------------ | ----------------------------------- |
| `bg-black`, `bg-black/95` | `bg-background`, `bg-background/95` |
| `bg-black/40`            | `bg-muted/40`                       |
| `bg-zinc-950`            | `bg-card`                           |
| `bg-zinc-900/{40,50}`    | `bg-muted/{40,50}`                  |
| `border-zinc-{700,800}`  | `border-border`                     |
| `border-zinc-900`        | `border-border/60`                  |
| `divide-zinc-900`        | `divide-border/60`                  |
| `text-zinc-{200,300}`    | `text-foreground`                   |
| `text-zinc-{400,500}`    | `text-muted-foreground`             |
| `text-zinc-600`          | `text-muted-foreground/60`          |

Status accents (emerald / amber / red for the dot + reason text + field-completeness heatmap) now carry a `dark:` variant — e.g. `text-emerald-600 dark:text-emerald-400` — so they keep contrast against the cream light-mode card without losing brightness in dark mode.

`text-black` on the amber CTA buttons stays — it reads well on `bg-amber-500` in both modes.

### 2. Surface real errors instead of HTTP 500 — `overview/route.ts` + client

The overview endpoint runs several DB reads and maps them into the response. Any thrown error (missing view, missing column, stale env var) bubbled up as a bare 500 with no body, and the client discarded the body anyway (`throw new Error('HTTP ' + res.status)`), so the page just showed "HTTP 500" with no cause.

- Wrapped the entire `GET` handler in `try / catch`. On failure it logs `[data-quality/overview] unhandled error: …` to the server console and returns `{ status: 500, code: 'INTERNAL_ERROR', message, stack }` as JSON.
- Updated `DataQualityClient.load()` to read the error body and use `json.message` (or `json.code`) as the displayed error. Operators now see the actual Postgres / runtime message on the Retry screen instead of a generic HTTP status.

This is diagnostic plumbing, not a behavioural change — a healthy response still returns the same `{ status: 200, code: 'OK', data }` payload.

## Files touched this session

- `src/app/[locale]/admin/data-quality/DataQualityClient.tsx` — token migration, error-body surfacing.
- `src/app/api/admin/data-quality/overview/route.ts` — try/catch + structured 500 body.
- `docs/admin-data-quality-dashboard.md` — this document.

## Known follow-ups

- When the Retry screen now reports a real error (e.g. `relation "v_source_ingestion" does not exist` or `column listings.listing_price does not exist`), run the migration at `supabase/migrations/20260418_data_quality_groundtruth.sql` against the environment the dev server is pointed at. The dashboard depends on that view.
- The Scrapers console (`/admin/scrapers`, the older page this one is meant to replace) still uses hardcoded dark tokens in `main`. A parallel migration there was drafted but is out of scope for this branch.
