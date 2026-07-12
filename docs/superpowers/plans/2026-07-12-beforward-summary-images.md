# BeForward Summary Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure summary-only BeForward discovery persists a valid stock-list thumbnail so catalog refreshes cannot create an image-coverage backlog.

**Architecture:** Extend the existing `ListingSummary` boundary with one nullable thumbnail URL. The discovery parser owns source-specific URL extraction and validation; summary normalization converts the optional thumbnail into the existing `photos`/`photosCount` contract. The writer uses summary-only run context to fill image-empty rows while preserving existing galleries.

**Tech Stack:** TypeScript, Cheerio, Vitest, existing BeForward collector pipeline

---

### Task 1: Lock the source-row contract with a failing parser test

**Files:**
- Modify: `src/features/scrapers/beforward_porsche_collector/discover.test.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/discover.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/types.ts`

- [x] **Step 1: Write the failing test**

Add representative `tr.stocklist-row` HTML containing a protocol-relative `image-cdn.beforward.jp` image and assert that the parsed listing exposes the HTTPS thumbnail URL.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/features/scrapers/beforward_porsche_collector/discover.test.ts`

Expected: FAIL because stock-list parsing does not expose a thumbnail.

- [x] **Step 3: Implement the minimal parser boundary**

Add `thumbnailUrl: string | null` to `ListingSummary`. Export a testable stock-list parser, extract the row's first valid image source, and normalize only BeForward CDN URLs.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run src/features/scrapers/beforward_porsche_collector/discover.test.ts`

Expected: PASS.

### Task 2: Persist the thumbnail through summary normalization

**Files:**
- Modify: `src/features/scrapers/beforward_porsche_collector/normalize.test.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/normalize.ts`
- Update: BeForward `ListingSummary` fixtures in affected tests

- [x] **Step 1: Write the failing normalization test**

Provide a summary with `thumbnailUrl` and assert `photos` contains it, `photosCount` is one, and the resulting data-quality score reflects image presence.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/features/scrapers/beforward_porsche_collector/normalize.test.ts`

Expected: FAIL because summary normalization still emits an empty photo array.

- [x] **Step 3: Implement the minimal normalization change**

Use `summary.thumbnailUrl ? [summary.thumbnailUrl] : []` for summary photos, derive `photosCount`, and pass that count into `scoreDataQuality`.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run src/features/scrapers/beforward_porsche_collector/normalize.test.ts`

Expected: PASS.

### Task 3: Preserve enriched galleries at the writer boundary

**Files:**
- Modify: `src/features/scrapers/beforward_porsche_collector/types.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/collector.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- Test: `src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts`

- [x] **Step 1: Write the failing writer test**

Model a summary-only one-thumbnail update against a row with `photos_count: 20` and assert that the upsert payload omits `images` and `photos_count`.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts -t "preserves an existing gallery"`

Expected: FAIL because the current payload overwrites image columns.

- [x] **Step 3: Implement conditional image preservation**

Carry `summaryOnly` in `ScrapeMeta`, select the existing `photos_count`, and remove image columns only when a summary-only update targets an image-bearing row.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts -t "preserves an existing gallery"`

Expected: PASS.

### Task 4: Validate the complete BeForward slice and retain the prevention rule

**Files:**
- Modify: `AGENTS.md`

- [x] **Step 1: Run the affected suite**

Run: `npx vitest run src/features/scrapers/beforward_porsche_collector scripts/run-scrapers.test.ts`

Expected: all tests pass.

- [x] **Step 2: Run type validation**

Run: `npx tsc --noEmit`

Expected: no TypeScript errors introduced by the `ListingSummary` contract change.

- [x] **Step 3: Add correction memory**

Add one compact repo rule under `AGENTS.md` section 10: BeForward summary-only discovery must preserve the valid stock-list thumbnail so image coverage does not depend on bounded detail enrichment.

- [x] **Step 4: Review the final diff**

Run: `git diff --check` and `git diff -- src/features/scrapers/beforward_porsche_collector AGENTS.md docs/superpowers/specs/2026-07-12-beforward-summary-images-design.md docs/superpowers/plans/2026-07-12-beforward-summary-images.md`

Expected: no whitespace errors and only scoped changes.
