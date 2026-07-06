-- First-touch attribution for registration and ads measurement.
-- Stored on user_credits because profile creation is the first durable app row
-- created after Supabase auth confirms the user.

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS landing_path text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS user_credits_utm_campaign_idx
  ON public.user_credits (utm_campaign)
  WHERE utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_credits_fbclid_idx
  ON public.user_credits (fbclid)
  WHERE fbclid IS NOT NULL;

-- Align database defaults with the current product promise:
-- 3 free Haus Reports at 1,000 Pistons each.
ALTER TABLE public.user_credits
  ALTER COLUMN credits_balance SET DEFAULT 3000,
  ALTER COLUMN monthly_allowance_pistons SET DEFAULT 3000;

UPDATE public.user_credits
SET
  credits_balance = 3000,
  monthly_allowance_pistons = 3000,
  updated_at = now()
WHERE tier = 'FREE'
  AND credits_balance = 300
  AND monthly_allowance_pistons = 300;
