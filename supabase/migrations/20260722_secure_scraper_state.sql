BEGIN;

ALTER TABLE public.scraper_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.scraper_state FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.scraper_state TO service_role;

DROP POLICY IF EXISTS "Service role manages scraper state" ON public.scraper_state;
CREATE POLICY "Service role manages scraper state"
  ON public.scraper_state
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
