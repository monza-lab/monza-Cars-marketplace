-- Persist the optional intelligence payloads produced by the Haus Report pipeline.
-- The application retains a backwards-compatible write fallback, but production
-- should keep the full report output rather than silently dropping these fields.
ALTER TABLE listing_reports
  ADD COLUMN IF NOT EXISTS color_intelligence_json jsonb,
  ADD COLUMN IF NOT EXISTS vin_intelligence_json jsonb,
  ADD COLUMN IF NOT EXISTS investment_narrative_json jsonb;
