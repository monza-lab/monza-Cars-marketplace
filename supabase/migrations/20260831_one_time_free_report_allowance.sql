-- Free accounts receive one introductory 3-report allowance. Their current
-- balance is preserved; only the recurring allowance contract is removed.
ALTER TABLE public.user_credits
  ALTER COLUMN monthly_allowance_pistons SET DEFAULT 0;

UPDATE public.user_credits
SET
  monthly_allowance_pistons = 0,
  updated_at = now()
WHERE tier IN ('FREE', 'PACK_OWNER')
  AND monthly_allowance_pistons <> 0;
