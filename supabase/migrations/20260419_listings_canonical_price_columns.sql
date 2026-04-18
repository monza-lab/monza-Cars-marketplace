-- Migration: Add canonical price columns on listings.
--
-- Why: today's price data is scattered across hammer_price / final_price /
-- current_bid, and each scraper populates a different subset (BeForward only
-- writes current_bid, AutoTrader writes hammer_price=current_bid, etc.). UI
-- queries that filter on a single column silently drop entire markets — most
-- notably JP, where every BeForward row was excluded because hammer_price is
-- always NULL. See docs in CLAUDE.md "Current Valuation Standard".
--
-- Both columns are STORED generated columns: scrapers keep writing the raw
-- columns they always have, and Postgres derives the canonical values on
-- every INSERT/UPDATE.
--
--   listing_price  — the price shown to users. Always populated when any
--                    raw price exists. Use this for filtering, sorting, and
--                    display.
--   sold_price     — the realized sale price. NULL unless status = 'sold'.
--                    Use this for "sold" market analysis (medians, IQR).

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS listing_price NUMERIC
    GENERATED ALWAYS AS (
      COALESCE(NULLIF(hammer_price, 0), NULLIF(final_price, 0), NULLIF(current_bid, 0))
    ) STORED;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS sold_price NUMERIC
    GENERATED ALWAYS AS (
      CASE WHEN status = 'sold' THEN
        COALESCE(NULLIF(hammer_price, 0), NULLIF(final_price, 0), NULLIF(current_bid, 0))
      ELSE NULL END
    ) STORED;

-- Partial indexes — keep them small. Filtering/sorting paths only ever care
-- about rows that actually have a price.
CREATE INDEX IF NOT EXISTS listings_listing_price_idx
  ON listings (listing_price)
  WHERE listing_price IS NOT NULL AND listing_price > 0;

CREATE INDEX IF NOT EXISTS listings_sold_price_idx
  ON listings (sold_price)
  WHERE sold_price IS NOT NULL;

COMMENT ON COLUMN listings.listing_price IS
  'Canonical price visible to users. Generated from COALESCE(hammer_price, final_price, current_bid). Always populated when any raw price exists. Use for filtering/display in the UI.';

COMMENT ON COLUMN listings.sold_price IS
  'Realized sale price (status = ''sold'' only). NULL otherwise. Use for sold-market valuation analysis.';
