# Repo Reorganization — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the repository file structure without changing any code behavior.

**Architecture:** Move-only approach — relocate files with `git mv`, update import paths, delete dead artifacts. Zero logic changes.

**Tech Stack:** git mv, TypeScript compiler (`tsc --noEmit`), vitest

**Spec:** `docs/superpowers/specs/2026-03-17-repo-reorganization-design.md`

---

## Chunk 1: Root Cleanup + Documentation Consolidation

### Task 1: Delete dead root artifacts

**Files:**
- Delete: `nul` (Windows artifact, 0 bytes)
- Delete: `prisma/` (empty legacy directory)

- [ ] **Step 1: Remove the `nul` file**
```bash
git rm nul
```

- [ ] **Step 2: Remove empty prisma directory**
```bash
git rm -r prisma/ || rmdir prisma
```

- [ ] **Step 3: Move loose scripts to scripts/**
```bash
git mv test_db.ts scripts/test_db.ts
git mv push-to-github.sh scripts/push-to-github.sh
git mv curated_cars.json scripts/curated_cars.json
```

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "chore: remove dead root artifacts, move loose scripts"
```

### Task 2: Move documentation .md files to docs/

**Files:**
- Move: 15 root .md files → `docs/` subdirectories
- Keep in root: `CLAUDE.md`, `AGENTS.md`, `README.md`

- [ ] **Step 1: Create docs subdirectories**
```bash
mkdir -p docs/scrapers docs/porsche
```

- [ ] **Step 2: Move general docs**
```bash
git mv architecture.md docs/architecture.md
git mv overview.md docs/overview.md
git mv overview_ferrari.md docs/overview-ferrari.md
git mv login_overview.md docs/login-overview.md
git mv FRONTEND_BACKEND_GUIDE.md docs/frontend-backend-guide.md
git mv BRANDING_REFRESH.md docs/branding-refresh.md
git mv REGIONAL_VALUATION_FIX.md docs/regional-valuation-fix.md
git mv QUICK_START_CAMILO_1PAGE.md docs/quick-start.md
```

- [ ] **Step 3: Move scraper docs**
```bash
git mv SCRAPERS.md docs/scrapers/SCRAPERS.md
git mv scraper_overview.md docs/scrapers/overview.md
git mv scrapers_nextsteps.md docs/scrapers/next-steps.md
git mv scrapingunit.md docs/scrapers/scraping-unit.md
```

- [ ] **Step 4: Move Porsche docs**
```bash
git mv PORSCHE_DATABASE_MASTER_PLAN.md docs/porsche/database-master-plan.md
git mv PORSCHE_DATA_PROJECT_CONTEXT.md docs/porsche/data-project-context.md
git mv BASE_DATOS_COMPLETA_TODOS_LUJO.md docs/porsche/base-datos-completa.md
```

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "docs: consolidate scattered .md files into docs/"
```

---

## Chunk 2: Scraper Directory Consolidation

### Task 3: Create scrapers umbrella and move collectors

**Files:**
- Create: `src/features/scrapers/`
- Move: 8 collector directories into it

- [ ] **Step 1: Create the scrapers umbrella directory**
```bash
mkdir -p src/features/scrapers
```

- [ ] **Step 2: Move all collector directories into scrapers/**
```bash
git mv src/features/porsche_collector src/features/scrapers/porsche_collector
git mv src/features/ferrari_collector src/features/scrapers/ferrari_collector
git mv src/features/autotrader_collector src/features/scrapers/autotrader_collector
git mv src/features/autoscout24_collector src/features/scrapers/autoscout24_collector
git mv src/features/beforward_porsche_collector src/features/scrapers/beforward_porsche_collector
git mv src/features/classic_collector src/features/scrapers/classic_collector
git mv src/features/porsche_ingest src/features/scrapers/porsche_ingest
git mv src/features/ferrari_history src/features/scrapers/ferrari_history
```

- [ ] **Step 3: Commit (before import updates — checkpoint)**
```bash
git add -A && git commit -m "chore: move all collectors under src/features/scrapers/"
```

### Task 4: Move auction scrapers from src/lib/scrapers/ to src/features/scrapers/auctions/

**Files:**
- Move: `src/lib/scrapers/` → `src/features/scrapers/auctions/`

- [ ] **Step 1: Move the directory**
```bash
git mv src/lib/scrapers src/features/scrapers/auctions
```

- [ ] **Step 2: Commit**
```bash
git add -A && git commit -m "chore: move auction scrapers to src/features/scrapers/auctions/"
```

### Task 5: Move scraper utilities to src/features/scrapers/common/

**Files:**
- Move: `src/lib/scraper.ts` → `src/features/scrapers/common/scraper.ts`
- Move: `src/lib/serverless-browser.ts` → `src/features/scrapers/common/serverless-browser.ts`
- Move: `src/lib/listingValidator.ts` → `src/features/scrapers/common/listingValidator.ts`
- Move: `src/lib/scraper-monitoring/` → `src/features/scrapers/common/monitoring/`

- [ ] **Step 1: Create common directory**
```bash
mkdir -p src/features/scrapers/common
```

- [ ] **Step 2: Move files**
```bash
git mv src/lib/scraper.ts src/features/scrapers/common/scraper.ts
git mv src/lib/serverless-browser.ts src/features/scrapers/common/serverless-browser.ts
git mv src/lib/listingValidator.ts src/features/scrapers/common/listingValidator.ts
git mv src/lib/scraper-monitoring src/features/scrapers/common/monitoring
```

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "chore: move scraper utilities to src/features/scrapers/common/"
```

---

## Chunk 3: Import Path Updates

### Task 6: Update cron route imports (collector paths)

**Files to modify:**
- `src/app/api/cron/autotrader/route.ts`: `@/features/autotrader_collector/` → `@/features/scrapers/autotrader_collector/`
- `src/app/api/cron/autoscout24/route.ts`: `@/features/autoscout24_collector/` → `@/features/scrapers/autoscout24_collector/`
- `src/app/api/cron/porsche/route.ts`: `@/features/porsche_collector/` → `@/features/scrapers/porsche_collector/`
- `src/app/api/cron/classic/route.ts`: `@/features/classic_collector/` → `@/features/scrapers/classic_collector/`
- `src/app/api/cron/ferrari/route.ts`: `@/features/ferrari_collector/` → `@/features/scrapers/ferrari_collector/`
- `src/app/api/cron/beforward/route.ts`: `@/features/beforward_porsche_collector/` → `@/features/scrapers/beforward_porsche_collector/`
- `src/app/api/listings/[id]/price-history/route.ts`: `@/features/ferrari_history/` → `@/features/scrapers/ferrari_history/`
- `src/app/api/auctions/[id]/route.ts`: `@/features/ferrari_history/` → `@/features/scrapers/ferrari_history/`

- [ ] **Step 1: Find-and-replace in each file**

In all 8 files listed above, replace:
```
@/features/autotrader_collector/  →  @/features/scrapers/autotrader_collector/
@/features/autoscout24_collector/ →  @/features/scrapers/autoscout24_collector/
@/features/porsche_collector/     →  @/features/scrapers/porsche_collector/
@/features/classic_collector/     →  @/features/scrapers/classic_collector/
@/features/ferrari_collector/     →  @/features/scrapers/ferrari_collector/
@/features/beforward_porsche_collector/ → @/features/scrapers/beforward_porsche_collector/
@/features/ferrari_history/       →  @/features/scrapers/ferrari_history/
@/features/porsche_ingest/        →  @/features/scrapers/porsche_ingest/
```

- [ ] **Step 2: Commit**
```bash
git add -A && git commit -m "fix: update cron route imports for scrapers/ move"
```

### Task 7: Update auction scraper imports

**Files to modify (old path `@/lib/scrapers` → new path `@/features/scrapers/auctions`):**
- `src/app/api/scrape/route.ts`: `@/lib/scrapers` → `@/features/scrapers/auctions`
- `src/features/scrapers/porsche_collector/collector.ts`: `@/lib/scrapers/bringATrailer` → `@/features/scrapers/auctions/bringATrailer` (and carsAndBids, collectingCars)
- `src/features/scrapers/ferrari_collector/collector.ts`: same pattern
- `src/features/scrapers/porsche_collector/historical_backfill.ts`: `@/lib/scrapers/bringATrailer` → `@/features/scrapers/auctions/bringATrailer`
- `src/features/scrapers/ferrari_collector/historical_backfill.ts`: same pattern

- [ ] **Step 1: Update each file's imports**

Replace `@/lib/scrapers` with `@/features/scrapers/auctions` in all 5 files.

- [ ] **Step 2: Commit**
```bash
git add -A && git commit -m "fix: update auction scraper import paths"
```

### Task 8: Update scraper utility imports (scraper.ts, serverless-browser.ts, listingValidator.ts)

**Files to modify:**

`@/lib/scraper` → `@/features/scrapers/common/scraper`:
- `src/features/scrapers/ferrari_collector/collector.ts`
- `src/features/scrapers/porsche_collector/collector.ts`
- `src/features/scrapers/autotrader_collector/collector.ts`
- `src/app/api/scrape/route.ts`

`@/lib/serverless-browser` → `@/features/scrapers/common/serverless-browser`:
- `src/features/scrapers/autoscout24_collector/browser.ts`
- `src/features/scrapers/classic_collector/browser.ts`

`@/lib/listingValidator` → `@/features/scrapers/common/listingValidator`:
- `src/features/scrapers/porsche_ingest/repository/supabase_writer.ts`
- `src/features/scrapers/autoscout24_collector/supabase_writer.ts`
- `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- `src/features/scrapers/autotrader_collector/supabase_writer.ts`
- `src/features/scrapers/classic_collector/supabase_writer.ts`
- `src/features/scrapers/porsche_collector/supabase_writer.ts`
- `src/app/api/cron/validate/route.ts`

- [ ] **Step 1: Update each import path in all files listed above**

- [ ] **Step 2: Commit**
```bash
git add -A && git commit -m "fix: update scraper utility import paths"
```

### Task 9: Update scraper-monitoring imports

**Files to modify (`@/lib/scraper-monitoring` → `@/features/scrapers/common/monitoring`):**
- `src/features/scrapers/autoscout24_collector/collector.ts`
- `src/features/scrapers/classic_collector/collector.ts`
- `src/app/api/admin/scrapers/live/route.ts`
- `src/app/api/cron/autoscout24/route.ts`
- `src/app/api/cron/porsche/route.ts`
- `src/app/api/cron/ferrari/route.ts`
- `src/app/api/cron/beforward/route.ts`
- `src/app/api/cron/autotrader/route.ts`
- `src/app/api/cron/classic/route.ts`
- `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx`
- `src/app/[locale]/admin/scrapers/page.tsx`

- [ ] **Step 1: Replace `@/lib/scraper-monitoring` with `@/features/scrapers/common/monitoring` in all 11 files**

- [ ] **Step 2: Commit**
```bash
git add -A && git commit -m "fix: update scraper-monitoring import paths"
```

---

## Chunk 4: Verification

### Task 10: Full verification pass

- [ ] **Step 1: TypeScript compilation check**
```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 2: Run all tests**
```bash
npx vitest run
```
Expected: All tests pass

- [ ] **Step 3: Verify no stale imports remain**
```bash
# These should return 0 results:
grep -r "@/lib/scrapers" src/ --include="*.ts" --include="*.tsx"
grep -r "@/lib/scraper\"" src/ --include="*.ts" --include="*.tsx"
grep -r "@/lib/scraper'" src/ --include="*.ts" --include="*.tsx"
grep -r "@/lib/serverless-browser" src/ --include="*.ts" --include="*.tsx"
grep -r "@/lib/listingValidator" src/ --include="*.ts" --include="*.tsx"
grep -r "@/lib/scraper-monitoring" src/ --include="*.ts" --include="*.tsx"
grep -r "from.*@/features/[a-z].*_collector/" src/ --include="*.ts" --include="*.tsx" | grep -v "scrapers/"
grep -r "from.*@/features/ferrari_history/" src/ --include="*.ts" --include="*.tsx" | grep -v "scrapers/"
grep -r "from.*@/features/porsche_ingest/" src/ --include="*.ts" --include="*.tsx" | grep -v "scrapers/"
```

- [ ] **Step 4: Final commit if any fixes needed**
```bash
git add -A && git commit -m "fix: resolve any remaining stale imports"
```

### Task 11: Update CLAUDE.md references

- [ ] **Step 1: Check if CLAUDE.md references any moved paths**
Review and update any file path references in `CLAUDE.md` that point to old locations.

- [ ] **Step 2: Commit**
```bash
git add CLAUDE.md && git commit -m "docs: update CLAUDE.md for new repo structure"
```
