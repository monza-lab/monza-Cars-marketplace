-- ============================================================================
-- Enable Row-Level Security on all public tables
-- Applied: 2026-04-19
-- Prevents unauthorized writes via the anon key (exposed in browser)
-- Read access remains public for data tables; writes restricted to service_role
-- User/CreditTransaction: per-user read isolation
-- ModelBackfillState: service_role only (no public access)
-- ============================================================================

-- 1. LISTINGS (core table)
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_listings"
  ON public.listings FOR SELECT
  USING (true);

CREATE POLICY "service_write_listings"
  ON public.listings FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_update_listings"
  ON public.listings FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_delete_listings"
  ON public.listings FOR DELETE
  TO service_role
  USING (true);


-- 2. PRICE_HISTORY
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_price_history"
  ON public.price_history FOR SELECT
  USING (true);

CREATE POLICY "service_write_price_history"
  ON public.price_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 3. AUCTION (legacy ORM table)
ALTER TABLE public."Auction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_auction"
  ON public."Auction" FOR SELECT
  USING (true);

CREATE POLICY "service_write_auction"
  ON public."Auction" FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 4. COMPARABLE
ALTER TABLE public."Comparable" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_comparable"
  ON public."Comparable" FOR SELECT
  USING (true);

CREATE POLICY "service_write_comparable"
  ON public."Comparable" FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 5. PRICEHISTORY (legacy, PascalCase)
ALTER TABLE public."PriceHistory" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_PriceHistory"
  ON public."PriceHistory" FOR SELECT
  USING (true);

CREATE POLICY "service_write_PriceHistory"
  ON public."PriceHistory" FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 6. MARKETDATA
ALTER TABLE public."MarketData" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_MarketData"
  ON public."MarketData" FOR SELECT
  USING (true);

CREATE POLICY "service_write_MarketData"
  ON public."MarketData" FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 7. MARKET_ANALYTICS
ALTER TABLE public.market_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_market_analytics"
  ON public.market_analytics FOR SELECT
  USING (true);

CREATE POLICY "service_write_market_analytics"
  ON public.market_analytics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 8. MARKET_SEGMENTS
ALTER TABLE public.market_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_market_segments"
  ON public.market_segments FOR SELECT
  USING (true);

CREATE POLICY "service_write_market_segments"
  ON public.market_segments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 9. MODELBACKFILLSTATE (internal, service_role only)
ALTER TABLE public."ModelBackfillState" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_only_ModelBackfillState"
  ON public."ModelBackfillState" FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 10. USER (per-user read isolation)
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own"
  ON public."User" FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id);

CREATE POLICY "service_all_users"
  ON public."User" FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 11. CREDITTRANSACTION (per-user read isolation)
ALTER TABLE public."CreditTransaction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_transactions"
  ON public."CreditTransaction" FOR SELECT
  TO authenticated
  USING (auth.uid()::text = "userId");

CREATE POLICY "service_all_transactions"
  ON public."CreditTransaction" FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
