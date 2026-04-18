# Admin Data Quality Refactor — Phased Plan

## Context

The existing `/[locale]/admin/scrapers` page is wired to `scraper_runs` and `scraper_active_runs`, but the data it displays can't be trusted:

- `scraper_name` values (kebab-case, lowercase) do not match `listings.source` values (PascalCase). The two namespaces never cross-reference.
- Several scrapers ingest fine but do not reliably call `recordRun()`, so they appear stale/red in the UI even when fresh listings are landing (Elferspot is the clearest case: 6 runs in 30d, yet 226 rows in the last 1000 listings).
- `scraper_active_runs` accumulates zombie rows (3 stuck ones right now: elferspot, backfill-images, autoscout24) that make cards display "RUN STALLED" even when later successful runs exist.
- There is no single signal for "is this source actually producing fresh data" — the dashboard infers health from runs alone, not from listing-level freshness.

This document is the phased plan to fix that.

## Phase 1 — Ground truth (≤15 min)

Goal: stop the dashboard from lying. Cleanup + instrumentation only, no UI yet.

1. Delete the 3 zombie rows in `scraper_active_runs` (elferspot, backfill-images, autoscout24).
2. Add a SQL view `v_source_ingestion` exposing per-source truth:
   - `source` (canonical, e.g. `Elferspot`)
   - `total_active_listings`
   - `last_listing_inserted_at` (max `created_at`)
   - `last_listing_updated_at` (max `updated_at`)
   - `new_24h`, `new_7d` counts
3. Verify the 3 dead rows don't come back within 1h. If they do, a collector is creating them without cleanup — that becomes Phase 3's scope.

## Phase 2 — Canonical naming (30 min)

Goal: one source of truth for identity.

1. Create `src/features/scrapers/common/sourceRegistry.ts` — a single registry:
   ```ts
   SOURCES = [
     {
       id: "Elferspot",
       scraperNames: ["elferspot", "enrich-elferspot", "backfill-photos-elferspot"],
       label: "Elferspot",
       expectedCadenceHours: 24,
     },
     // …
   ];
   ```
2. Helpers: `getSourceForScraper(name)`, `getScrapersForSource(id)`, `getAllSources()`.
3. Everything downstream reads from this registry — no more raw string comparisons.

## Phase 3 — Truth-telling API (1 hour)

Goal: one endpoint that answers "is this source healthy?" using multiple signals.

`GET /api/admin/data-quality/overview` returns an array of `SourceHealth`:

```ts
{
  sourceId: "Elferspot",
  scrapers: [
    { name: "elferspot", lastRunAt, lastRunSuccess, runs30d },
    // …
  ],
  ingestion: { totalActive, new24h, new7d, lastListingAt },
  fieldCompleteness: { vin: 72.1, mileage: 89.2, /* … */ },
  status: "green" | "yellow" | "red",
  statusReasons: ["elferspot scraper_runs behind, but ingestion fresh"],
}
```

Status heuristic: trust `ingestion.lastListingAt` first. If a source added rows in the last 48h, it is green regardless of `scraper_runs`. This is what fixes Elferspot. `scraper_runs` only downgrades to yellow — it cannot push a source to red on its own.

## Phase 4 — Dedicated Data Quality page (2–3 hours)

Goal: a Monza-branded page focused on marketplace data quality. The existing `/admin/scrapers` stays as the ops/debug console.

Location: `/[locale]/admin/data-quality`.

Structure:

- **Header strip** — headline score ("6 of 7 sources healthy"), last refresh time, "Refresh now".
- **Source grid** — one card per marketplace (Elferspot, ClassicCom, BeForward, AutoTrader, AutoScout24, BaT, …):
  - Status dot + short reason
  - "Last listing" / "Listings added 24h" / "Total active"
  - Field-completeness sparkline (VIN, mileage, images, price)
  - Click → drill-down panel on the right
- **Field completeness matrix** — the grid from the existing page, but with canonical sources and color treatment that matches Monza's branding (not raw tailwind red/green).
- **Alerts rail** — list of anomalies: "AutoScout24: stalled run 16h old", "Classic: 4 failed runs today". Each links to logs.

No new analytics work here — everything comes from Phase 3's endpoint.

## Phase 5 — Re-link to the existing console (≈15 min)

Add a cross-link from `/admin/scrapers` → `/admin/data-quality` and back, so admins know both exist and what each is for.

## Timeline

| Phase | Estimate |
| --- | --- |
| 1 — Ground truth | 15 min |
| 2 — Canonical naming | 30 min |
| 3 — Truth-telling API | 1 hour |
| 4 — Dedicated page | 2–3 hours |
| 5 — Cross-links | 15 min |
| **Total** | **≈4–5 hours** |

## Open decisions

1. **Page location:** new `/admin/data-quality` route (recommended) vs. reworking the existing Data Quality tab in `/admin/scrapers`.
2. **Visual direction:** dark admin console (zinc/black, current aesthetic) vs. Monza marketplace branding (editorial/collector aesthetic).
3. **Drill-down depth:** just numbers (A), recent runs list (B — recommended), or full run timeline + field history (C).
