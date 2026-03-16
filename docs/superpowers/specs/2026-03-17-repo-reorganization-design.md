# Repo Reorganization — Design Spec

**Goal:** Reorganize the repository file structure without changing any code behavior. Move-only approach: relocate files, update imports, delete dead artifacts.

**Constraint:** Zero code logic changes. Only file moves + import path updates.

## Problem

1. **Scrapers split across two locations:** `src/lib/scrapers/` (3 auction scrapers) and `src/features/*_collector/` (8 marketplace collectors)
2. **15 documentation .md files scattered in project root** instead of `docs/`
3. **Loose files in root:** `test_db.ts`, `nul`, `curated_cars.json`, `push-to-github.sh`, empty `prisma/`
4. **Scraper utilities scattered in `src/lib/`:** `scraper.ts`, `serverless-browser.ts`, `listingValidator.ts`, `scraper-monitoring/`

## Solution

### 1. Scraper Consolidation
Create `src/features/scrapers/` umbrella dir. Move all 8 collectors into it (keeping `_collector` suffixes to preserve `var/` path compatibility). Move auction scrapers from `src/lib/scrapers/` into `src/features/scrapers/auctions/`. Move scraper utils into `src/features/scrapers/common/`.

**Before:**
```
src/lib/scrapers/          (3 auction scrapers)
src/lib/scraper.ts         (base utility)
src/lib/serverless-browser.ts
src/lib/listingValidator.ts
src/lib/scraper-monitoring/ (4 files)
src/features/porsche_collector/
src/features/ferrari_collector/
src/features/autotrader_collector/
src/features/autoscout24_collector/
src/features/beforward_porsche_collector/
src/features/classic_collector/
src/features/porsche_ingest/
src/features/ferrari_history/
```

**After:**
```
src/features/scrapers/
├── auctions/              (moved from src/lib/scrapers/)
│   ├── bringATrailer.ts
│   ├── carsAndBids.ts
│   ├── collectingCars.ts
│   └── index.ts
├── common/
│   ├── scraper.ts         (moved from src/lib/)
│   ├── serverless-browser.ts
│   ├── listingValidator.ts
│   └── monitoring/        (moved from src/lib/scraper-monitoring/)
├── porsche_collector/     (moved from src/features/)
├── ferrari_collector/
├── autotrader_collector/
├── autoscout24_collector/
├── beforward_porsche_collector/
├── classic_collector/
├── porsche_ingest/
└── ferrari_history/
```

### 2. Documentation Consolidation
Move root .md files into `docs/` subdirectories:

| File | Destination |
|------|------------|
| `architecture.md` | `docs/architecture.md` |
| `overview.md` | `docs/overview.md` |
| `overview_ferrari.md` | `docs/overview-ferrari.md` |
| `login_overview.md` | `docs/login-overview.md` |
| `FRONTEND_BACKEND_GUIDE.md` | `docs/frontend-backend-guide.md` |
| `BRANDING_REFRESH.md` | `docs/branding-refresh.md` |
| `REGIONAL_VALUATION_FIX.md` | `docs/regional-valuation-fix.md` |
| `QUICK_START_CAMILO_1PAGE.md` | `docs/quick-start.md` |
| `SCRAPERS.md` | `docs/scrapers/SCRAPERS.md` |
| `scraper_overview.md` | `docs/scrapers/overview.md` |
| `scrapers_nextsteps.md` | `docs/scrapers/next-steps.md` |
| `scrapingunit.md` | `docs/scrapers/scraping-unit.md` |
| `PORSCHE_DATABASE_MASTER_PLAN.md` | `docs/porsche/database-master-plan.md` |
| `PORSCHE_DATA_PROJECT_CONTEXT.md` | `docs/porsche/data-project-context.md` |
| `BASE_DATOS_COMPLETA_TODOS_LUJO.md` | `docs/porsche/base-datos-completa.md` |

**Keep in root:** `CLAUDE.md`, `AGENTS.md`, `README.md` (tooling expects these)

### 3. Root Cleanup
- Delete `nul` (Windows artifact, 0 bytes)
- Delete `prisma/` (empty legacy dir)
- Move `test_db.ts` → `scripts/test_db.ts`
- Move `push-to-github.sh` → `scripts/push-to-github.sh`
- Move `curated_cars.json` → `scripts/curated_cars.json` (legacy fixture)

### 4. Import Updates

**Scraper imports affected (exact list):**

`@/lib/scrapers` → `@/features/scrapers/auctions`:
- `src/app/api/scrape/route.ts`
- `src/features/porsche_collector/collector.ts` → `src/features/scrapers/porsche_collector/collector.ts` (self-move)
- `src/features/ferrari_collector/collector.ts` → `src/features/scrapers/ferrari_collector/collector.ts` (self-move)
- `src/features/porsche_collector/historical_backfill.ts`
- `src/features/ferrari_collector/historical_backfill.ts`

`@/lib/scraper` → `@/features/scrapers/common/scraper`:
- `src/features/ferrari_collector/collector.ts`
- `src/features/porsche_collector/collector.ts`
- `src/features/autotrader_collector/collector.ts`
- `src/app/api/scrape/route.ts`

`@/lib/serverless-browser` → `@/features/scrapers/common/serverless-browser`:
- `src/features/autoscout24_collector/browser.ts`
- `src/features/classic_collector/browser.ts`

`@/lib/listingValidator` → `@/features/scrapers/common/listingValidator`:
- `src/features/porsche_ingest/repository/supabase_writer.ts`
- `src/features/autoscout24_collector/supabase_writer.ts`
- `src/features/beforward_porsche_collector/supabase_writer.ts`
- `src/features/autotrader_collector/supabase_writer.ts`
- `src/features/classic_collector/supabase_writer.ts`
- `src/features/porsche_collector/supabase_writer.ts`
- `src/app/api/cron/validate/route.ts`

`@/lib/scraper-monitoring` → `@/features/scrapers/common/monitoring`:
- `src/features/autoscout24_collector/collector.ts`
- `src/features/classic_collector/collector.ts`
- `src/app/api/admin/scrapers/live/route.ts`
- `src/app/api/cron/autoscout24/route.ts`
- `src/app/api/cron/porsche/route.ts`
- `src/app/api/cron/ferrari/route.ts`
- `src/app/api/cron/beforward/route.ts`
- `src/app/api/cron/autotrader/route.ts`
- `src/app/api/cron/classic/route.ts`
- `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx`
- `src/app/[locale]/admin/scrapers/page.tsx`

`@/features/<name>` → `@/features/scrapers/<name>` (cron routes):
- `src/app/api/cron/autotrader/route.ts`
- `src/app/api/cron/autoscout24/route.ts`
- `src/app/api/cron/porsche/route.ts`
- `src/app/api/cron/classic/route.ts`
- `src/app/api/cron/ferrari/route.ts`
- `src/app/api/cron/beforward/route.ts`
- `src/app/api/listings/[id]/price-history/route.ts`
- `src/app/api/auctions/[id]/route.ts`

## Safety Gates

After each batch:
1. `npx tsc --noEmit` — catches broken imports
2. `npx vitest run` — catches runtime regressions
3. `git commit` — checkpoint to revert if needed
