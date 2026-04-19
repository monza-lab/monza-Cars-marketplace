-- Migration: cached dashboard valuation corpus by make.
--
-- Stores the pre-aggregated { family -> market -> SegmentStats } payload that
-- dashboard requests read first. The refresh route populates this table after
-- rebuilding the valuation corpus off the request path.

CREATE TABLE IF NOT EXISTS dashboard_valuation_by_family (
  make text PRIMARY KEY,
  regional_val_by_family jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_row_count integer NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_valuation_by_family_refreshed_at_idx
  ON dashboard_valuation_by_family (refreshed_at DESC);

ALTER TABLE dashboard_valuation_by_family ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dashboard_valuation_by_family_read ON dashboard_valuation_by_family;
CREATE POLICY dashboard_valuation_by_family_read
  ON dashboard_valuation_by_family
  FOR SELECT
  USING (true);

GRANT SELECT ON dashboard_valuation_by_family TO service_role, authenticated, anon;
