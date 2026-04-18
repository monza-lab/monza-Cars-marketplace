-- Migration: Materialized view aggregating facet counts for active listings.
--
-- Replaces three N+1-style client-side aggregations:
--   - fetchSeriesCounts      (was paginating 18K+ rows into Node for GROUP BY)
--   - fetchLiveListingAggregateCounts (was 10 parallel count() queries)
--   - any other per-source/region headline numbers
--
-- Refreshed by scraper crons via refresh_listings_active_counts().

DROP MATERIALIZED VIEW IF EXISTS listings_active_counts CASCADE;

CREATE MATERIALIZED VIEW listings_active_counts AS
SELECT
  lower(make)                AS make,
  coalesce(series, '__null') AS series,
  source,
  CASE
    WHEN upper(country) IN ('USA', 'US', 'UNITED STATES') THEN 'US'
    WHEN upper(country) IN ('UK', 'UNITED KINGDOM')        THEN 'UK'
    WHEN upper(country) = 'JAPAN'                          THEN 'JP'
    WHEN country IS NOT NULL                               THEN 'EU'
    ELSE NULL
  END                        AS region_by_country,
  count(*)                   AS live_count
FROM listings
WHERE status = 'active'
  AND (end_time IS NULL OR end_time > now())
GROUP BY 1, 2, 3, 4;

-- Unique index is required so REFRESH MATERIALIZED VIEW CONCURRENTLY works.
CREATE UNIQUE INDEX listings_active_counts_uniq
  ON listings_active_counts (make, series, source, region_by_country);

CREATE INDEX listings_active_counts_make_idx
  ON listings_active_counts (make);

-- Refresh function. CONCURRENTLY keeps the MV readable during refresh.
-- Safe to call from any cron route as the final step after writes.
CREATE OR REPLACE FUNCTION refresh_listings_active_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY listings_active_counts;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_listings_active_counts() TO service_role, authenticated;
GRANT SELECT  ON listings_active_counts TO service_role, authenticated, anon;
