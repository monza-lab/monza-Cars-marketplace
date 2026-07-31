-- Serialize anonymous report access decisions across email, IP, and device.
-- The service-role-only RPC owns rate checking, lead creation, first-touch
-- preservation, and pending token reservation in one transaction.

ALTER TABLE public.report_access_tokens
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS device_hash text,
  ADD COLUMN IF NOT EXISTS pending_expires_at timestamptz DEFAULT (now() + interval '30 minutes');

CREATE INDEX IF NOT EXISTS report_access_tokens_ip_idx
  ON public.report_access_tokens (ip_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS report_access_tokens_device_idx
  ON public.report_access_tokens (device_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS report_access_tokens_pending_expires_at_idx
  ON public.report_access_tokens (pending_expires_at)
  WHERE status = 'pending' AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.reserve_report_lead_access(
  p_email text,
  p_email_normalized text,
  p_listing_id text,
  p_ip_hash text,
  p_device_hash text,
  p_email_hash text,
  p_token_hash text,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_fbclid text DEFAULT NULL,
  p_gclid text DEFAULT NULL,
  p_landing_path text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_first_seen_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key text;
  v_lead_id uuid;
  v_attempts integer;
BEGIN
  -- A stable order prevents deadlocks when requests share only some keys.
  FOR v_lock_key IN
    SELECT lock_key FROM unnest(ARRAY[
      'device:' || p_device_hash,
      'email:' || p_email_hash,
      'ip:' || p_ip_hash
    ]) AS keys(lock_key) ORDER BY lock_key
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  END LOOP;

  SELECT count(*) INTO v_attempts
  FROM public.report_request_attempts
  WHERE created_at >= now() - interval '1 hour'
    AND (ip_hash = p_ip_hash OR device_hash = p_device_hash);

  IF v_attempts >= 3 THEN
    RETURN jsonb_build_object('code', 'RATE_LIMITED');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_credits
    WHERE lower(trim(email)) = p_email_normalized
  ) THEN
    RETURN jsonb_build_object('code', 'AUTH_REQUIRED');
  END IF;

  SELECT id INTO v_lead_id
  FROM public.report_leads
  WHERE email_normalized = p_email_normalized;

  IF v_lead_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.report_lead_reports WHERE lead_id = v_lead_id)
    OR EXISTS (
      SELECT 1 FROM public.report_access_tokens
      WHERE lead_id = v_lead_id AND revoked_at IS NULL
        AND (status = 'ready' OR (status = 'pending' AND pending_expires_at > now()))
    )
  ) THEN
    RETURN jsonb_build_object('code', 'CLAIM_REQUIRED');
  END IF;

  -- A report already reserved or completed on this device cannot be
  -- bypassed by changing the email address. Shared IPs remain valid;
  -- IP is used only by the hourly abuse limit above.
  IF EXISTS (
    SELECT 1 FROM public.report_access_tokens
    WHERE revoked_at IS NULL
      AND device_hash = p_device_hash
      AND (status = 'ready' OR (status = 'pending' AND pending_expires_at > now()))
  ) THEN
    RETURN jsonb_build_object('code', 'CLAIM_REQUIRED');
  END IF;

  INSERT INTO public.report_leads (
    email, email_normalized, utm_source, utm_medium, utm_campaign,
    utm_term, utm_content, fbclid, gclid, landing_path, referrer,
    first_seen_at, updated_at
  ) VALUES (
    trim(p_email), p_email_normalized, p_utm_source, p_utm_medium,
    p_utm_campaign, p_utm_term, p_utm_content, p_fbclid, p_gclid,
    p_landing_path, p_referrer, coalesce(p_first_seen_at, now()), now()
  )
  ON CONFLICT (email_normalized) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now()
  RETURNING id INTO v_lead_id;

  INSERT INTO public.report_access_tokens (
    lead_id, listing_id, token_hash, ip_hash, device_hash, pending_expires_at
  ) VALUES (
    v_lead_id, p_listing_id, p_token_hash, p_ip_hash, p_device_hash, now() + interval '30 minutes'
  );

  INSERT INTO public.report_request_attempts (
    ip_hash, device_hash, email_hash, listing_id, outcome
  ) VALUES (
    p_ip_hash, p_device_hash, p_email_hash, p_listing_id, 'allowed'
  );

  RETURN jsonb_build_object('code', 'OK', 'lead_id', v_lead_id);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_report_lead_access(
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, timestamptz
) FROM public;
GRANT EXECUTE ON FUNCTION public.reserve_report_lead_access(
  text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, timestamptz
) TO service_role;
