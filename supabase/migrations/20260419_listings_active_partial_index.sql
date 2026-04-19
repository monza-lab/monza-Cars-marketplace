-- Migration: Partial index on active listings for paginated lookups.
-- Matches the WHERE + ORDER BY used by fetchPaginatedListings:
--   WHERE status = 'active' AND (end_time IS NULL OR end_time > now())
--   ORDER BY end_time ASC NULLS LAST, id DESC

CREATE INDEX IF NOT EXISTS listings_active_endtime_id_idx
  ON listings (end_time ASC NULLS LAST, id DESC)
  WHERE status = 'active';

-- Most queries are make-scoped; this variant lets Postgres skip the rest
-- of the active index when a single make is selected.
CREATE INDEX IF NOT EXISTS listings_active_make_endtime_idx
  ON listings (make, end_time ASC NULLS LAST)
  WHERE status = 'active';
