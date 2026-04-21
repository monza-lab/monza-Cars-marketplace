-- Add Stripe billing fields to user_credits and transaction idempotency support.

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS pack_credits_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_credits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;

ALTER TABLE user_credits
  DROP CONSTRAINT IF EXISTS user_credits_tier_check;

ALTER TABLE user_credits
  ADD CONSTRAINT user_credits_tier_check
  CHECK (tier IN ('FREE', 'PACK_OWNER', 'MONTHLY', 'ANNUAL', 'PRO'));

ALTER TABLE credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (
    type IN (
      'FREE_MONTHLY',
      'REPORT_USED',
      'PURCHASE',
      'STRIPE_PACK_PURCHASE',
      'STRIPE_SUBSCRIPTION_ACTIVATION',
      'STRIPE_SUBSCRIPTION_CANCELED'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_stripe_payment_id_unique
  ON credit_transactions (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_credits_stripe_customer_id_idx
  ON user_credits (stripe_customer_id);

CREATE INDEX IF NOT EXISTS user_credits_stripe_subscription_id_idx
  ON user_credits (stripe_subscription_id);
