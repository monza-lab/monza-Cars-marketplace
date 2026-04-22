-- Extend credit_transactions to support advisor debits with conversation/message linkage.

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS anonymous_session_id text,
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS message_id uuid;

-- Allow anonymous rows (no user_id) once the anon column exists.
ALTER TABLE public.credit_transactions
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_user_or_anon;
ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_user_or_anon
  CHECK (user_id IS NOT NULL OR anonymous_session_id IS NOT NULL)
  NOT VALID;
ALTER TABLE public.credit_transactions VALIDATE CONSTRAINT credit_transactions_user_or_anon;

-- Expand type CHECK to include advisor reasons.
ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN (
    'FREE_MONTHLY',
    'REPORT_USED',
    'PURCHASE',
    'STRIPE_PACK_PURCHASE',
    'STRIPE_SUBSCRIPTION_ACTIVATION',
    'STRIPE_SUBSCRIPTION_CANCELED',
    'ADVISOR_INSTANT',
    'ADVISOR_MARKETPLACE',
    'ADVISOR_DEEP_RESEARCH',
    'ADVISOR_REFUND'
  ));

-- Foreign keys to advisor tables (created in 2.1 and 2.2; Task 2.3 must run after those).
ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_conversation_fk;
ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_conversation_fk
  FOREIGN KEY (conversation_id) REFERENCES public.advisor_conversations(id) ON DELETE SET NULL;

ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_message_fk;
ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_message_fk
  FOREIGN KEY (message_id) REFERENCES public.advisor_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credit_tx_anon
  ON public.credit_transactions(anonymous_session_id, created_at DESC)
  WHERE anonymous_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_tx_conversation
  ON public.credit_transactions(conversation_id)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created
  ON public.credit_transactions(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Atomic debit RPC. Resolves user_credits.id via supabase_user_id; decrements with balance guard.
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

    UPDATE public.user_credits
      SET credits_balance = credits_balance - p_amount,
          updated_at = now()
      WHERE id = v_user_credits_id
      RETURNING credits_balance INTO v_new_balance;

    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'insufficient_credits';
    END IF;
  ELSE
    v_new_balance := 0; -- anonymous sessions have no balance; audit row only
  END IF;

  INSERT INTO public.credit_transactions(
    user_id, anonymous_session_id, amount, type, description,
    conversation_id, message_id
  ) VALUES (
    v_user_credits_id, p_anon, -p_amount, p_type, p_description,
    p_conversation_id, p_message_id
  );

  RETURN QUERY SELECT v_new_balance;
END $$;

REVOKE ALL ON FUNCTION public.debit_user_credits(uuid, text, integer, text, uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.debit_user_credits(uuid, text, integer, text, uuid, uuid, text) TO service_role;
