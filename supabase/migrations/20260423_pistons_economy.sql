-- Pistons economy backfill + debit RPC update.

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS subscription_plan_key text,
  ADD COLUMN IF NOT EXISTS monthly_allowance_pistons integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS unlimited_reports boolean NOT NULL DEFAULT false;

-- Backfill existing rows from the old report-credit economy into Pistons.
UPDATE public.user_credits
SET
  credits_balance = CASE
    WHEN tier = 'FREE' AND credits_balance BETWEEN 0 AND 10 THEN credits_balance * 100
    WHEN tier IN ('MONTHLY', 'ANNUAL', 'PRO') AND credits_balance BETWEEN 0 AND 100 THEN credits_balance * 100
    ELSE credits_balance
  END,
  pack_credits_balance = CASE
    WHEN pack_credits_balance BETWEEN 0 AND 100 THEN pack_credits_balance * 100
    ELSE pack_credits_balance
  END,
  monthly_allowance_pistons = CASE
    WHEN tier = 'FREE' THEN 300
    WHEN tier IN ('MONTHLY', 'ANNUAL', 'PRO') THEN GREATEST(credits_balance, 10000)
    ELSE monthly_allowance_pistons
  END,
  subscription_plan_key = CASE
    WHEN tier = 'FREE' THEN NULL
    WHEN tier IN ('MONTHLY', 'ANNUAL', 'PRO') THEN 'legacy_monthly'
    ELSE subscription_plan_key
  END,
  unlimited_reports = CASE
    WHEN tier = 'FREE' THEN false
    WHEN tier IN ('MONTHLY', 'ANNUAL', 'PRO') THEN true
    ELSE unlimited_reports
  END;

CREATE OR REPLACE FUNCTION public.debit_user_credits(
  p_supabase_user_id uuid,
  p_anon text,
  p_amount integer,
  p_type text,
  p_conversation_id uuid,
  p_message_id uuid,
  p_description text DEFAULT NULL
)
RETURNS TABLE(new_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_credits_id uuid;
  v_subscription_balance integer;
  v_pack_balance integer;
  v_total_balance integer;
  v_signed_amount integer;
  v_unlimited boolean;
  v_is_refund boolean := (p_type = 'ADVISOR_REFUND');
  v_from_subscription integer := 0;
  v_from_pack integer := 0;
BEGIN
  IF p_supabase_user_id IS NULL AND p_anon IS NULL THEN
    RAISE EXCEPTION 'supabase_user_id or anonymous_session_id required';
  END IF;
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'amount must be >= 0';
  END IF;
  IF p_type NOT IN ('FREE_MONTHLY','REPORT_USED','PURCHASE','STRIPE_PACK_PURCHASE','STRIPE_SUBSCRIPTION_ACTIVATION','STRIPE_SUBSCRIPTION_CANCELED','ADVISOR_INSTANT','ADVISOR_MARKETPLACE','ADVISOR_DEEP_RESEARCH','ADVISOR_REFUND') THEN
    RAISE EXCEPTION 'invalid debit type %', p_type;
  END IF;

  IF p_supabase_user_id IS NOT NULL THEN
    SELECT id, credits_balance, pack_credits_balance, unlimited_reports
      INTO v_user_credits_id, v_subscription_balance, v_pack_balance, v_unlimited
      FROM public.user_credits
      WHERE supabase_user_id = p_supabase_user_id
      FOR UPDATE;

    IF v_user_credits_id IS NULL THEN
      RAISE EXCEPTION 'user_credits row not found for auth user %', p_supabase_user_id;
    END IF;

    IF v_is_refund THEN
      UPDATE public.user_credits
        SET credits_balance = credits_balance + p_amount,
            updated_at = now()
        WHERE id = v_user_credits_id
        RETURNING credits_balance + pack_credits_balance INTO v_total_balance;
      v_signed_amount := p_amount;
    ELSIF p_type = 'ADVISOR_INSTANT' OR p_type = 'ADVISOR_MARKETPLACE' OR p_type = 'ADVISOR_DEEP_RESEARCH' THEN
      v_signed_amount := 0;
      v_total_balance := COALESCE(v_subscription_balance, 0) + COALESCE(v_pack_balance, 0);
    ELSE
      v_total_balance := COALESCE(v_subscription_balance, 0) + COALESCE(v_pack_balance, 0);
      IF v_total_balance < p_amount AND NOT COALESCE(v_unlimited, false) THEN
        RAISE EXCEPTION 'insufficient_credits';
      END IF;

      IF NOT COALESCE(v_unlimited, false) THEN
        v_from_subscription := LEAST(COALESCE(v_subscription_balance, 0), p_amount);
        v_from_pack := p_amount - v_from_subscription;

        UPDATE public.user_credits
          SET credits_balance = credits_balance - v_from_subscription,
              pack_credits_balance = pack_credits_balance - v_from_pack,
              updated_at = now()
          WHERE id = v_user_credits_id
          RETURNING credits_balance + pack_credits_balance INTO v_total_balance;
      END IF;

      v_signed_amount := -p_amount;
      IF COALESCE(v_unlimited, false) THEN
        v_signed_amount := 0;
      END IF;
    END IF;
  ELSE
    v_total_balance := 0;
    v_signed_amount := CASE WHEN v_is_refund THEN p_amount ELSE 0 END;
  END IF;

  INSERT INTO public.credit_transactions(
    user_id, anonymous_session_id, amount, type, description,
    conversation_id, message_id
  ) VALUES (
    v_user_credits_id, p_anon, v_signed_amount, p_type, p_description,
    p_conversation_id, p_message_id
  );

  RETURN QUERY SELECT COALESCE(v_total_balance, 0);
END $$;

REVOKE ALL ON FUNCTION public.debit_user_credits(uuid, text, integer, text, uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.debit_user_credits(uuid, text, integer, text, uuid, uuid, text) TO service_role;
