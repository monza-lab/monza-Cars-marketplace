-- Migration: Track currently active scraper jobs for live admin dashboard

CREATE TABLE scraper_active_runs (
  scraper_name TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  runtime TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scraper_active_runs_updated_at ON scraper_active_runs (updated_at DESC);

ALTER TABLE scraper_active_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active runs" ON scraper_active_runs FOR SELECT USING (true);
CREATE POLICY "Service role write active runs" ON scraper_active_runs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
