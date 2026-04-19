-- Append-only log of signal extraction runs per listing.
-- One row per extracted signal; grouped by extraction_run_id.
CREATE TABLE IF NOT EXISTS listing_signals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id            uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  extraction_run_id     uuid NOT NULL,
  signal_key            text NOT NULL,
  signal_value_json     jsonb NOT NULL,
  evidence_source_type  text NOT NULL,
  evidence_source_ref   text,
  evidence_raw_excerpt  text,
  evidence_confidence   text NOT NULL,
  extracted_at          timestamptz NOT NULL DEFAULT now(),
  extraction_version    text NOT NULL,

  CONSTRAINT chk_confidence CHECK (evidence_confidence IN ('high','medium','low')),
  CONSTRAINT chk_source_type CHECK (evidence_source_type IN ('listing_text','structured_field','seller_context','external'))
);

CREATE INDEX IF NOT EXISTS idx_listing_signals_listing ON listing_signals(listing_id, extracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_signals_run ON listing_signals(extraction_run_id);

ALTER TABLE listing_signals ENABLE ROW LEVEL SECURITY;

-- RLS policies (drop-if-exists pattern for idempotency)
DROP POLICY IF EXISTS "Anyone can read signals" ON listing_signals;
CREATE POLICY "Anyone can read signals" ON listing_signals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role inserts signals" ON listing_signals;
CREATE POLICY "Service role inserts signals" ON listing_signals FOR INSERT WITH CHECK (auth.role() = 'service_role');
