-- Migration: Create listing_reports table for investment report data
-- Stores computed market stats + Gemini LLM analysis per listing

CREATE TABLE IF NOT EXISTS listing_reports (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id             uuid NOT NULL,

  -- Market stats (best available tier, in USD)
  fair_value_low         numeric,
  fair_value_high        numeric,
  median_price           numeric,
  avg_price              numeric,
  min_price              numeric,
  max_price              numeric,
  total_comparable_sales integer,
  trend_percent          numeric,
  trend_direction        text,
  stats_scope            text,
  primary_tier           integer,
  primary_region         text,

  -- Full regional breakdown (all tiers)
  regional_stats         jsonb,

  -- LLM analysis (Gemini)
  investment_grade       text,
  confidence             text,
  red_flags              text[],
  key_strengths          text[],
  critical_questions     text[],
  yearly_maintenance     numeric,
  insurance_estimate     numeric,
  major_service_cost     numeric,
  appreciation_potential text,
  bid_target_low         numeric,
  bid_target_high        numeric,
  raw_llm_response       jsonb,

  -- Meta
  llm_model              text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_listing_reports_listing UNIQUE (listing_id)
);

CREATE INDEX idx_listing_reports_listing_id ON listing_reports(listing_id);

ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reports" ON listing_reports FOR SELECT USING (true);
CREATE POLICY "Service role inserts reports" ON listing_reports FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates reports" ON listing_reports FOR UPDATE USING (auth.role() = 'service_role');
