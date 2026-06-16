-- Keep non-EU BeForward locations such as Korea and Singapore out of EU counts.
-- Unknown/unsupported countries still contribute to all-count totals, but not to
-- the US/EU/UK/JP regional buckets used by the marketplace filters.

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
    WHEN upper(country) IN (
      'GERMANY',
      'FRANCE',
      'ITALY',
      'SPAIN',
      'NETHERLANDS',
      'BELGIUM',
      'AUSTRIA',
      'SWITZERLAND',
      'PORTUGAL',
      'SWEDEN',
      'DENMARK',
      'NORWAY',
      'FINLAND',
      'IRELAND',
      'LUXEMBOURG',
      'POLAND',
      'CZECH REPUBLIC',
      'CZECHIA'
    )                                                       THEN 'EU'
    ELSE NULL
  END                        AS region_by_country,
  count(*)                   AS live_count
FROM listings
WHERE status = 'active'
  AND (end_time IS NULL OR end_time > now())
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX listings_active_counts_uniq
  ON listings_active_counts (make, series, source, region_by_country);

CREATE INDEX listings_active_counts_make_idx
  ON listings_active_counts (make);

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
