# Homepage Rarity Ranking v7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Porsche collector significance the dominant homepage-ranking signal while adding bounded live-market scarcity, factory-specification signals, and feed diversity, then compare the old and new top 50 on one inventory cutoff.

**Architecture:** Keep `listingRarity.ts` responsible for intrinsic, listing-level collector significance. Add a pure `homepageRanking.ts` re-ranker that derives canonical series/variant keys, counts unique active vehicles, applies a maximum 15-point scarcity lift only to recognized modern variants, applies evidence/photo guardrails, and limits repetition in the first 50. Persist canonical variants at ingestion so the active-count materialized view can provide scalable market counts; retain graceful zero-scarcity fallback until the migration is applied.

**Tech Stack:** TypeScript 5.9, Vitest 4, Next.js 16 server cache, Supabase/Postgres.

---

### Task 1: Intrinsic Porsche rarity v7

**Files:**
- Modify: `src/lib/listingRarity.test.ts`
- Modify: `src/lib/listingRarity.ts`

- [ ] Write failing tests proving that Speedsters have an 88-point floor without a ceiling, narrow-body Speedsters outrank ordinary examples, 2019 Speedsters are at least very rare, WLS/WTL/sunroof-delete/Porsche Exclusive/Sonderwunsch are detected, and an ordinary sunroof is not rewarded.
- [ ] Run `npx vitest run src/lib/listingRarity.test.ts` and confirm the new assertions fail for missing or incorrect signals.
- [ ] Add version `listing-rarity-v7`, explicit signal patterns, bounded weights, and Speedster handling. Preserve headline-only model classification and the existing protection from marketplace-footer contamination.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Pure homepage re-ranking

**Files:**
- Create: `src/lib/homepageRanking.test.ts`
- Create: `src/lib/homepageRanking.ts`

- [ ] Write failing tests for canonical variant grouping, cross-source VIN deduplication, fallback vehicle fingerprints, modern-only scarcity, the 15-point scarcity ceiling, intrinsic-score dominance, photo/evidence guardrails, deterministic ties, and variant diversity.
- [ ] Run `npx vitest run src/lib/homepageRanking.test.ts` and confirm failure because the module does not exist.
- [ ] Implement the smallest pure API: `buildHomepageRankingContext(listings)` and `rankHomepageListings(listings, context, options)`.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Scalable variant counts and ingestion

**Files:**
- Create: `src/features/scrapers/common/rankingEnrichment.test.ts`
- Create: `src/features/scrapers/common/rankingEnrichment.ts`
- Modify: the six active Porsche listing writers under `src/features/scrapers/*/supabase_writer.ts`
- Create: `scripts/backfill-listing-ranking-variant.ts`
- Create: `supabase/migrations/20260713_add_listing_ranking_variant.sql`
- Modify: `src/lib/supabaseLiveListings.ts`

- [ ] Write a failing test proving canonical `series:variant` output for 991 Speedster, G-model WTL, 964 WLS, and a safe series fallback.
- [ ] Implement shared variant enrichment and wire it into every active writer.
- [ ] Add a nullable `ranking_variant` column and update `listings_active_counts` to expose deduplicated active counts by variant and region.
- [ ] Add a guarded backfill script that populates only stale/missing variant and v7 rarity values; do not run the production mutation during verification.
- [ ] Add `fetchVariantCounts()` with graceful migration-pending fallback and focused query tests.

### Task 4: Homepage integration

**Files:**
- Modify: `src/lib/dashboardCache.test.ts`
- Modify: `src/lib/dashboardCache.ts`
- Modify: `src/lib/curatedCars.ts`
- Modify: `src/components/dashboard/DashboardClient.tsx`
- Modify: `src/components/dashboard/sidebar/useLiveSidebarListings.ts`

- [ ] Write failing dashboard tests proving the supplied variant counts affect order, intrinsic score remains primary, and repeated variants are bounded.
- [ ] Increase the regional candidate sample, run the pure re-ranker before slicing to 60, and expose homepage ranking metadata without overwriting intrinsic rarity.
- [ ] Preserve server order on mobile and sort the desktop rail by homepage score before end time.
- [ ] Run the focused dashboard/sidebar tests.

### Task 5: Frozen before/after top-50 report

**Files:**
- Create: `scripts/compare-homepage-ranking.ts`
- Generate: `docs/rarity-ranking-top-50-2026-07-13.md`

- [ ] Query active Porsche inventory against cutoff `2026-07-13T19:00:12.204Z` with minimal ranking fields.
- [ ] Compute the legacy order from stored v6 score/end-time/id and the v7 order from the same rows.
- [ ] Emit both top-50 tables, score deltas, supply counts, and the largest movers.
- [ ] Sanity-check that all output rows were active at the cutoff and that duplicate VINs do not inflate supply.

### Task 6: Verification

- [ ] Run focused rarity, ranking, ingestion, dashboard, pagination, and writer tests.
- [ ] Run `npm test` and `npm run build`.
- [ ] Review `git diff --check`, the generated top-50 report, and the requirement checklist.
- [ ] Report migration/backfill commands separately; production database mutation remains an explicit deployment action.
