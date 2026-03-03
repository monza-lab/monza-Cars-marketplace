-- Migration: Create scraper_runs table for persistent monitoring
-- Tracks every collector run with unified counts + optional detailed metrics

-- ═══════════════════════════════════════════════════════════════
-- Step 1: Create table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE scraper_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraper_name  TEXT NOT NULL,         -- 'porsche', 'ferrari', 'autotrader', 'beforward', 'classic', 'autoscout24'
  run_id        TEXT NOT NULL,         -- collector's own UUID
  started_at    TIMESTAMPTZ NOT NULL,
  finished_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success       BOOLEAN NOT NULL,
  runtime       TEXT NOT NULL,         -- 'vercel_cron' | 'github_actions' | 'cli'
  duration_ms   INTEGER NOT NULL,

  -- Unified counts (all collectors)
  discovered    INTEGER NOT NULL DEFAULT 0,
  written       INTEGER NOT NULL DEFAULT 0,
  errors_count  INTEGER NOT NULL DEFAULT 0,

  -- Optional detailed counts (varies per collector)
  refresh_checked   INTEGER,
  refresh_updated   INTEGER,
  details_fetched   INTEGER,
  normalized        INTEGER,
  skipped_duplicate INTEGER,
  bot_blocked       INTEGER,           -- cloudflare/akamai blocks

  -- Backfill info (porsche/ferrari only)
  backfill_discovered  INTEGER,
  backfill_written     INTEGER,

  -- Source-level breakdown (JSONB for flexibility)
  source_counts  JSONB,                -- { "BaT": { discovered: 10, written: 8 }, ... }
  error_messages TEXT[],               -- Array of error strings

  -- Uniqueness constraint
  CONSTRAINT scraper_runs_unique UNIQUE (scraper_name, run_id)
);

-- ═══════════════════════════════════════════════════════════════
-- Step 2: Indexes
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX idx_scraper_runs_name_time ON scraper_runs (scraper_name, finished_at DESC);
CREATE INDEX idx_scraper_runs_success ON scraper_runs (success, finished_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- Step 3: RPC functions
-- ═══════════════════════════════════════════════════════════════

-- Daily aggregates per scraper (last N days)
CREATE OR REPLACE FUNCTION scraper_daily_aggregates(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  scraper_name TEXT,
  run_date DATE,
  total_runs BIGINT,
  successful_runs BIGINT,
  failed_runs BIGINT,
  total_discovered BIGINT,
  total_written BIGINT,
  total_errors BIGINT,
  avg_duration_ms NUMERIC,
  total_bot_blocked BIGINT
) AS $$
  SELECT
    sr.scraper_name,
    DATE(sr.finished_at) AS run_date,
    COUNT(*) AS total_runs,
    COUNT(*) FILTER (WHERE sr.success) AS successful_runs,
    COUNT(*) FILTER (WHERE NOT sr.success) AS failed_runs,
    SUM(sr.discovered) AS total_discovered,
    SUM(sr.written) AS total_written,
    SUM(sr.errors_count) AS total_errors,
    AVG(sr.duration_ms)::NUMERIC AS avg_duration_ms,
    SUM(COALESCE(sr.bot_blocked, 0)) AS total_bot_blocked
  FROM scraper_runs sr
  WHERE sr.finished_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY sr.scraper_name, DATE(sr.finished_at)
  ORDER BY run_date DESC, sr.scraper_name;
$$ LANGUAGE sql STABLE;

-- Data quality from listings table (avg quality score per source, last N days)
CREATE OR REPLACE FUNCTION source_data_quality(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  source TEXT,
  avg_quality NUMERIC,
  total_listings BIGINT,
  listings_with_images BIGINT,
  listings_with_price BIGINT
) AS $$
  SELECT
    l.source::TEXT,
    AVG(l.data_quality_score)::NUMERIC AS avg_quality,
    COUNT(*) AS total_listings,
    COUNT(*) FILTER (WHERE l.images IS NOT NULL AND array_length(l.images, 1) > 0) AS listings_with_images,
    COUNT(*) FILTER (WHERE l.hammer_price IS NOT NULL AND l.hammer_price > 0) AS listings_with_price
  FROM listings l
  WHERE l.scrape_timestamp >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY l.source
  ORDER BY l.source;
$$ LANGUAGE sql STABLE;

-- ═══════════════════════════════════════════════════════════════
-- Step 4: Row Level Security
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;

-- Public read access (dashboard is public)
CREATE POLICY "Public read" ON scraper_runs FOR SELECT USING (true);

-- Service role write access
CREATE POLICY "Service role write" ON scraper_runs FOR INSERT WITH CHECK (true);
