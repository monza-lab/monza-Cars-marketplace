-- Navigation-first report funnel: unverified leads, scoped report access,
-- first-party funnel events, and abuse/reminder state.

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS gclid text;

ALTER TABLE public.listing_reports
  ADD COLUMN IF NOT EXISTS source_fingerprint text;

CREATE TABLE IF NOT EXISTS public.report_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalized text NOT NULL UNIQUE,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  fbclid text,
  gclid text,
  landing_path text,
  referrer text,
  first_seen_at timestamptz,
  first_report_at timestamptz,
  claim_reminder_sent_at timestamptz,
  claimed_user_credits_id uuid REFERENCES public.user_credits(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_lead_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.report_leads(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  report_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, listing_id)
);

CREATE TABLE IF NOT EXISTS public.report_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.report_leads(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  last_used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.report_request_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  device_hash text NOT NULL,
  email_hash text NOT NULL,
  listing_id text,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  anonymous_session_id text,
  lead_id uuid REFERENCES public.report_leads(id) ON DELETE SET NULL,
  user_credits_id uuid REFERENCES public.user_credits(id) ON DELETE SET NULL,
  listing_id text,
  source text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_leads_claim_reminder_idx
  ON public.report_leads (first_report_at)
  WHERE first_report_at IS NOT NULL
    AND claim_reminder_sent_at IS NULL
    AND claimed_at IS NULL;
CREATE INDEX IF NOT EXISTS report_access_tokens_lead_listing_idx
  ON public.report_access_tokens (lead_id, listing_id);
CREATE INDEX IF NOT EXISTS report_request_attempts_ip_created_idx
  ON public.report_request_attempts (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS report_request_attempts_device_created_idx
  ON public.report_request_attempts (device_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_name_created_idx
  ON public.analytics_events (event_name, created_at DESC);

ALTER TABLE public.report_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_lead_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_request_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages report leads" ON public.report_leads;
CREATE POLICY "Service role manages report leads" ON public.report_leads
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role manages lead reports" ON public.report_lead_reports;
CREATE POLICY "Service role manages lead reports" ON public.report_lead_reports
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role manages report tokens" ON public.report_access_tokens;
CREATE POLICY "Service role manages report tokens" ON public.report_access_tokens
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role manages report attempts" ON public.report_request_attempts;
CREATE POLICY "Service role manages report attempts" ON public.report_request_attempts
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role manages analytics events" ON public.analytics_events;
CREATE POLICY "Service role manages analytics events" ON public.analytics_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.claim_report_lead(
  p_email text,
  p_user_credits_id uuid,
  p_report_cost integer DEFAULT 1000
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead_id uuid;
  v_count integer := 0;
BEGIN
  SELECT id INTO v_lead_id FROM public.report_leads
    WHERE email_normalized = lower(trim(p_email)) AND claimed_at IS NULL
    FOR UPDATE;
  IF v_lead_id IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.user_reports (user_id, listing_id, report_id, credit_cost)
    SELECT p_user_credits_id, listing_id, report_id, p_report_cost
    FROM public.report_lead_reports WHERE lead_id = v_lead_id
    ON CONFLICT (user_id, listing_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.user_credits SET
    credits_balance = greatest(0, credits_balance - (v_count * p_report_cost)),
    free_credits_used = coalesce(free_credits_used, 0) + v_count,
    updated_at = now()
  WHERE id = p_user_credits_id;

  UPDATE public.report_leads SET
    claimed_user_credits_id = p_user_credits_id,
    claimed_at = now(),
    updated_at = now()
  WHERE id = v_lead_id;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_report_lead(text, uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_report_lead(text, uuid, integer) TO service_role;
