-- Advisor daily grace counters (spec §9)
-- FREE tier gets 10 Instant + 2 Marketplace zero-debit requests per day.
-- Key = (supabase_user_id OR anonymous_session_id, day). Postgres disallows
-- expressions in a PRIMARY KEY, so we use a surrogate id + a UNIQUE index on
-- the COALESCE expression.

CREATE TABLE IF NOT EXISTS public.advisor_grace_counters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supabase_user_id uuid,
  anonymous_session_id text,
  day date NOT NULL,
  instant_used integer NOT NULL DEFAULT 0,
  marketplace_used integer NOT NULL DEFAULT 0,
  CONSTRAINT grace_user_or_anon CHECK (supabase_user_id IS NOT NULL OR anonymous_session_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS advisor_grace_counters_identity_day_uq
  ON public.advisor_grace_counters (
    (COALESCE(supabase_user_id::text, anonymous_session_id)),
    day
  );

ALTER TABLE public.advisor_grace_counters ENABLE ROW LEVEL SECURITY;

-- Owner read-only; writes happen via SECURITY DEFINER RPC only.
DROP POLICY IF EXISTS "grace_owner_select" ON public.advisor_grace_counters;
CREATE POLICY "grace_owner_select"
  ON public.advisor_grace_counters
  FOR SELECT USING (auth.uid() = supabase_user_id);

-- Atomic consume-one. Returns true if within grace, false otherwise.
CREATE OR REPLACE FUNCTION public.advisor_try_consume_grace(
  p_supabase_user_id uuid,
  p_anon text,
  p_tier text,          -- 'instant' | 'marketplace'
  p_instant_cap integer DEFAULT 10,
  p_marketplace_cap integer DEFAULT 2
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_ok boolean := false;
  v_key text := COALESCE(p_supabase_user_id::text, p_anon);
BEGIN
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'supabase_user_id or anonymous_session_id required';
  END IF;

  INSERT INTO public.advisor_grace_counters(supabase_user_id, anonymous_session_id, day)
    VALUES (p_supabase_user_id, p_anon, v_today)
    ON CONFLICT ((COALESCE(supabase_user_id::text, anonymous_session_id)), day) DO NOTHING;

  IF p_tier = 'instant' THEN
    UPDATE public.advisor_grace_counters
      SET instant_used = instant_used + 1
      WHERE day = v_today
        AND COALESCE(supabase_user_id::text, anonymous_session_id) = v_key
        AND instant_used < p_instant_cap
      RETURNING true INTO v_ok;
  ELSIF p_tier = 'marketplace' THEN
    UPDATE public.advisor_grace_counters
      SET marketplace_used = marketplace_used + 1
      WHERE day = v_today
        AND COALESCE(supabase_user_id::text, anonymous_session_id) = v_key
        AND marketplace_used < p_marketplace_cap
      RETURNING true INTO v_ok;
  ELSE
    RAISE EXCEPTION 'unknown tier %', p_tier;
  END IF;

  RETURN COALESCE(v_ok, false);
END $$;

REVOKE ALL ON FUNCTION public.advisor_try_consume_grace(uuid, text, text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.advisor_try_consume_grace(uuid, text, text, integer, integer) TO service_role;
