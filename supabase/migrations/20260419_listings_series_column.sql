-- Migration: Add series column for fast family filtering + facet aggregation.
-- listings.series is populated by scraper writers via
-- extractSeries() in src/lib/brandConfig.ts (single source of truth).

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS series TEXT;

-- Most filtering happens on the active subset only. A partial index keeps
-- the index tiny (ended auctions never need it).
CREATE INDEX IF NOT EXISTS listings_active_series_idx
  ON listings (series)
  WHERE status = 'active';

-- Compound lookup for "counts per series for a given make".
CREATE INDEX IF NOT EXISTS listings_active_make_series_idx
  ON listings (make, series)
  WHERE status = 'active';

COMMENT ON COLUMN listings.series IS
  'Normalized series id (e.g. "992", "991", "718-cayman"). Populated at write time by scraper writers using extractSeries() from brandConfig.ts. NULL for unclassified rows.';
