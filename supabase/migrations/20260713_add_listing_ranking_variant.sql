-- Canonical variant identity and deduplicated live supply for homepage ranking.
-- The existing listings_active_counts MV remains unchanged for series/source counters.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS ranking_variant text;

CREATE INDEX IF NOT EXISTS listings_active_ranking_variant_idx
  ON listings (make, ranking_variant)
  WHERE status = 'active';

DROP MATERIALIZED VIEW IF EXISTS listings_active_variant_counts;

CREATE MATERIALIZED VIEW listings_active_variant_counts AS
SELECT
  lower(make) AS make,
  ranking_variant,
  CASE
    WHEN upper(country) IN ('USA', 'US', 'UNITED STATES') THEN 'US'
    WHEN upper(country) IN ('UK', 'UNITED KINGDOM') THEN 'UK'
    WHEN upper(country) = 'JAPAN' THEN 'JP'
    WHEN upper(country) IN (
      'GERMANY', 'FRANCE', 'ITALY', 'SPAIN', 'NETHERLANDS', 'BELGIUM',
      'AUSTRIA', 'SWITZERLAND', 'PORTUGAL', 'SWEDEN', 'DENMARK', 'NORWAY',
      'FINLAND', 'IRELAND', 'LUXEMBOURG', 'POLAND', 'CZECH REPUBLIC', 'CZECHIA'
    ) THEN 'EU'
    ELSE '__null'
  END AS region_by_country,
  count(DISTINCT CASE
    WHEN length(regexp_replace(coalesce(vin, ''), '[^A-Za-z0-9]', '', 'g')) >= 11
      THEN 'vin:' || upper(regexp_replace(vin, '[^A-Za-z0-9]', '', 'g'))
    WHEN mileage IS NOT NULL THEN 'fingerprint:' || md5(concat_ws(':',
      coalesce(year::text, ''),
      lower(regexp_replace(coalesce(make, ''), '[^A-Za-z0-9]+', '-', 'g')),
      lower(regexp_replace(coalesce(model, ''), '[^A-Za-z0-9]+', '-', 'g')),
      lower(regexp_replace(coalesce(trim, ''), '[^A-Za-z0-9]+', '-', 'g')),
      lower(regexp_replace(coalesce(title, ''), '[^A-Za-z0-9]+', '-', 'g')),
      coalesce(mileage::text, ''),
      lower(regexp_replace(coalesce(color_exterior, ''), '[^A-Za-z0-9]+', '-', 'g'))
    ))
    ELSE 'listing:' || id::text
  END) AS live_count
FROM listings
WHERE status = 'active'
  AND ranking_variant IS NOT NULL
  AND (end_time IS NULL OR end_time > now())
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX listings_active_variant_counts_uniq
  ON listings_active_variant_counts (make, ranking_variant, region_by_country);

CREATE INDEX listings_active_variant_counts_make_idx
  ON listings_active_variant_counts (make);

CREATE OR REPLACE FUNCTION refresh_listings_active_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY listings_active_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY listings_active_variant_counts;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_listings_active_counts() TO service_role, authenticated;
GRANT SELECT ON listings_active_variant_counts TO service_role, authenticated, anon;
