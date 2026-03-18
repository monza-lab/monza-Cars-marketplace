-- Migration: Create credits tables in Supabase
-- Replaces legacy PG User, UserAnalysis, CreditTransaction tables

CREATE TABLE IF NOT EXISTS user_credits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id    uuid NOT NULL UNIQUE,
  email               text,
  display_name        text,
  credits_balance     integer NOT NULL DEFAULT 3,
  tier                text NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'PRO')),
  credit_reset_date   timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credits" ON user_credits FOR SELECT USING (auth.uid() = supabase_user_id);
CREATE POLICY "Service role manages credits" ON user_credits FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS user_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES user_credits(id),
  listing_id          uuid NOT NULL,
  report_id           uuid NOT NULL REFERENCES listing_reports(id),
  credit_cost         integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_user_reports_user_listing UNIQUE (user_id, listing_id)
);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own reports" ON user_reports FOR SELECT USING (
  user_id IN (SELECT id FROM user_credits WHERE supabase_user_id = auth.uid())
);
CREATE POLICY "Service role manages reports" ON user_reports FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS credit_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES user_credits(id),
  amount              integer NOT NULL,
  type                text NOT NULL CHECK (type IN ('FREE_MONTHLY', 'REPORT_USED', 'PURCHASE')),
  description         text,
  listing_id          uuid,
  stripe_payment_id   text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON credit_transactions FOR SELECT USING (
  user_id IN (SELECT id FROM user_credits WHERE supabase_user_id = auth.uid())
);
CREATE POLICY "Service role manages transactions" ON credit_transactions FOR ALL USING (auth.role() = 'service_role');
