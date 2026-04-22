-- Fix: debit_user_credits previously treated every type as a debit, including
-- ADVISOR_REFUND. A refund must INCREASE the balance and write a POSITIVE
-- ledger row. This CREATE OR REPLACE splits the two branches:
--   * ADVISOR_REFUND       → credits_balance + p_amount, ledger amount +p_amount,
--                            balance-negative check skipped.
--   * all other valid types → original subtract-and-guard behavior.

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
  v_new_balance integer;
  v_is_refund boolean := (p_type = 'ADVISOR_REFUND');
  v_signed_amount integer;
BEGIN
  IF p_supabase_user_id IS NULL AND p_anon IS NULL THEN
    RAISE EXCEPTION 'supabase_user_id or anonymous_session_id required';
  END IF;
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'amount must be >= 0';
  END IF;
  IF p_type NOT IN ('ADVISOR_INSTANT','ADVISOR_MARKETPLACE','ADVISOR_DEEP_RESEARCH','REPORT_USED','ADVISOR_REFUND') THEN
    RAISE EXCEPTION 'invalid debit type %', p_type;
  END IF;

  IF p_supabase_user_id IS NOT NULL THEN
    SELECT id INTO v_user_credits_id
      FROM public.user_credits
      WHERE supabase_user_id = p_supabase_user_id;
    IF v_user_credits_id IS NULL THEN
      RAISE EXCEPTION 'user_credits row not found for auth user %', p_supabase_user_id;
    END IF;

    IF v_is_refund THEN
      -- Refund: increase balance; ledger row is positive; no negative guard.
      UPDATE public.user_credits
        SET credits_balance = credits_balance + p_amount,
            updated_at = now()
        WHERE id = v_user_credits_id
        RETURNING credits_balance INTO v_new_balance;
    ELSE
      UPDATE public.user_credits
        SET credits_balance = credits_balance - p_amount,
            updated_at = now()
        WHERE id = v_user_credits_id
        RETURNING credits_balance INTO v_new_balance;

      IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'insufficient_credits';
      END IF;
    END IF;
  ELSE
    v_new_balance := 0; -- anonymous sessions have no balance; audit row only
  END IF;

  v_signed_amount := CASE WHEN v_is_refund THEN p_amount ELSE -p_amount END;

  INSERT INTO public.credit_transactions(
    user_id, anonymous_session_id, amount, type, description,
    conversation_id, message_id
  ) VALUES (
    v_user_credits_id, p_anon, v_signed_amount, p_type, p_description,
    p_conversation_id, p_message_id
  );

  RETURN QUERY SELECT v_new_balance;
END $$;

REVOKE ALL ON FUNCTION public.debit_user_credits(uuid, text, integer, text, uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.debit_user_credits(uuid, text, integer, text, uuid, uuid, text) TO service_role;
