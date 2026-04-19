-- Admin Data Quality Refactor — Phase 1 (Ground truth)
--
-- Creates v_source_ingestion: the single freshness-of-truth view per
-- listings.source. The Data Quality dashboard trusts this before it trusts
-- scraper_runs, so a source that ingests fine but does not record runs
-- (e.g. Elferspot today) still reads as healthy.
--
-- No DELETE on scraper_active_runs: zombie rows are evidence (either a real
-- stall or a collector that forgot to clean up). The UI classifies them as
-- stalled alerts — it does not erase them.

CREATE OR REPLACE VIEW v_source_ingestion AS
SELECT
  source,
  COUNT(*) FILTER (WHERE status = 'active')                            AS total_active_listings,
  COUNT(*)                                                             AS total_listings,
  MAX(created_at)                                                      AS last_listing_inserted_at,
  MAX(updated_at)                                                      AS last_listing_updated_at,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')    AS new_24h,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')      AS new_7d,
  COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '24 hours')    AS updated_24h,
  COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days')      AS updated_7d
FROM listings
WHERE source IS NOT NULL
GROUP BY source;

COMMENT ON VIEW v_source_ingestion IS
  'Per-source listings freshness. Read by /api/admin/data-quality/overview; a source with fresh rows here is healthy regardless of scraper_runs state.';

GRANT SELECT ON v_source_ingestion TO anon, authenticated, service_role;
