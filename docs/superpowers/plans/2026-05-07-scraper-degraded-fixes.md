# Scraper Degraded Fixes — May 2026

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan.

**Goal:** Fix all root causes identified in the 2026-05-07 health audit — 3 TIMEOUTs, 2 ZERO-WRITEs, and multiple DEGRADED scrapers.

**Architecture:** Fix in priority order (P0→P3), each fix is independent and can be committed separately.

---

## Root Causes Identified

| # | Scraper | Issue | Root Cause | Priority |
|---|---------|-------|------------|----------|
| 1 | enrich-autotrader | TIMEOUT on Vercel | `TIME_BUDGET_MS=600_000` but `maxDuration=300` (300s) | P0 |
| 2 | enrich-beforward | DEGRADED (errors) | VIN field exceeds `VARCHAR(17)` — Japanese vehicle IDs | P1 |
| 3 | as24-enrich-scrapling | DEGRADED (errors) | Fields exceed `VARCHAR(100)` — no truncation before write | P1 |
| 4 | enrich-autotrader | DEGRADED (errors) | No field truncation before Supabase write | P1 |
| 5 | autoscout24 collector | DEGRADED (502s) | No retry on Supabase 502 Bad Gateway | P2 |
| 6 | beforward cron | ZERO-WRITE | `/tmp/` checkpoints ephemeral on Vercel + success counts refreshes | P2 |
| 7 | porsche collector | TIMEOUT (TUI) | Sequential processing, no concurrency | P3 |
| 8 | autoscout24 collector | TIMEOUT (TUI) | Time budget only checks at shard boundaries | P3 |

---

## Chunk 1: P0 — Fix AutoTrader Enrichment Timeout

### Task 1: Align TIME_BUDGET_MS with maxDuration

**File:** `src/app/api/cron/enrich-autotrader/route.ts`

- [ ] Change `TIME_BUDGET_MS` from `600_000` to `270_000` (line 55)
- [ ] Reduce `MAX_BATCHES` from `20` to `5` to prevent unbounded work within 270s

---

## Chunk 2: P1 — Add Field Truncation to Enrichment Routes

### Task 2: Add truncation to enrich-beforward

**File:** `src/app/api/cron/enrich-beforward/route.ts`

- [ ] Add a `truncate(value, max)` helper (same pattern as existing writers)
- [ ] Truncate `vin` to 17 chars before write (line 117)
- [ ] Truncate `trim`, `engine`, `transmission`, `color_exterior` to 100 chars

### Task 3: Add truncation to as24-enrich-scrapling

**File:** `scripts/as24-enrich-scrapling.ts`

- [ ] Add a `truncate(value, max)` helper
- [ ] Truncate `trim` (100), `vin` (17), `transmission` (100), `body_style` (100), `engine` (100), `color_exterior` (100), `color_interior` (100)

### Task 4: Add truncation to enrich-autotrader

**File:** `src/app/api/cron/enrich-autotrader/route.ts`

- [ ] Add a `truncate(value, max)` helper
- [ ] Truncate `engine`, `transmission`, `color_exterior`, `color_interior`, `body_style`, `vin` before write

---

## Chunk 3: P2 — Supabase 502 Retry + BeForward Cron Fix

### Task 5: Add Supabase upsert retry to AS24 writer

**File:** `src/features/scrapers/autoscout24_collector/supabase_writer.ts`

- [ ] Wrap the `.upsert()` call with a retry loop (max 2 retries, 1s delay, only on 502/503)

### Task 6: Fix BeForward cron success logic and checkpoint path

**File:** `src/app/api/cron/beforward/route.ts`

- [ ] Remove `/tmp/` checkpoint path (not useful on ephemeral Vercel)
- [ ] Fix success logic: should require `discovered > 0` (not count refreshes as discovery success)

---

## Chunk 4: P3 — Performance Improvements (TUI timeout fixes)

### Task 7: Add per-listing time budget to AS24 collector

**File:** `src/features/scrapers/autoscout24_collector/collector.ts`

- [ ] Add time budget check inside the inner listing loop (not just shard boundaries)

### Task 8: Skip P3 Porsche concurrency (deferred)

The Porsche collector already has time budget guards per source. The TUI timeout is a local test harness issue (25-min budget vs 5-min TUI timeout). No code change needed — the cron/GHA versions work fine.

---

## Success Criteria

1. `enrich-autotrader` completes within 300s on Vercel
2. `enrich-beforward` writes without VARCHAR errors
3. `as24-enrich-scrapling` writes without VARCHAR errors
4. AS24 collector retries on Supabase 502
5. BeForward cron reports accurate success/failure
6. Health audit shows fewer DEGRADED scrapers
