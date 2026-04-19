-- Extend listing_reports with Haus Report v1 fields (specific-car fair value + signal extraction meta).
-- Legacy investment_grade column stays (nullable) for backward compat — stop writing in app code.
ALTER TABLE listing_reports
  ADD COLUMN IF NOT EXISTS specific_car_fair_value_low   numeric,
  ADD COLUMN IF NOT EXISTS specific_car_fair_value_mid   numeric,
  ADD COLUMN IF NOT EXISTS specific_car_fair_value_high  numeric,
  ADD COLUMN IF NOT EXISTS comparable_layer_used         text,
  ADD COLUMN IF NOT EXISTS comparables_count             integer,
  ADD COLUMN IF NOT EXISTS modifiers_applied_json        jsonb,
  ADD COLUMN IF NOT EXISTS modifiers_total_percent       numeric,
  ADD COLUMN IF NOT EXISTS signals_extracted_at          timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_version            text;

-- Optional constraint: comparable_layer_used must be one of 'strict' | 'series' | 'family' when present.
ALTER TABLE listing_reports
  DROP CONSTRAINT IF EXISTS chk_comparable_layer;
ALTER TABLE listing_reports
  ADD CONSTRAINT chk_comparable_layer CHECK (comparable_layer_used IS NULL OR comparable_layer_used IN ('strict','series','family'));
