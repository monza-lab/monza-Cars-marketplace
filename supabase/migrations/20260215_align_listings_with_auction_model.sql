-- Migration: Align listings table with Prisma Auction model
-- Run this against your Supabase database

-- ═══════════════════════════════════════════════════════════════
-- Step 1: Add new columns
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS current_bid DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS bid_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserve_status TEXT,
  ADD COLUMN IF NOT EXISTS seller_notes TEXT,
  ADD COLUMN IF NOT EXISTS images TEXT[],
  ADD COLUMN IF NOT EXISTS engine TEXT,
  ADD COLUMN IF NOT EXISTS transmission TEXT,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_price DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS view_count INTEGER,
  ADD COLUMN IF NOT EXISTS watch_count INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ═══════════════════════════════════════════════════════════════
-- Step 2: Add indexes
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_listings_platform ON listings(platform);
CREATE INDEX IF NOT EXISTS idx_listings_make_model ON listings(make, model);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_end_time ON listings(end_time);

-- ═══════════════════════════════════════════════════════════════
-- Step 3: Backfill existing rows from current data + satellites
-- ═══════════════════════════════════════════════════════════════

-- title from year + make + model + trim
UPDATE listings SET title = year || ' ' || make || ' ' || model || COALESCE(' ' || trim, '')
WHERE title IS NULL;

-- platform from source
UPDATE listings SET platform = CASE
  WHEN source = 'BaT' THEN 'BRING_A_TRAILER'
  WHEN source = 'CarsAndBids' THEN 'CARS_AND_BIDS'
  WHEN source = 'CollectingCars' THEN 'COLLECTING_CARS'
  ELSE source
END WHERE platform IS NULL;

-- final_price from hammer_price
UPDATE listings SET final_price = hammer_price
WHERE final_price IS NULL AND hammer_price IS NOT NULL;

-- location from country, region, city
UPDATE listings SET location = CONCAT_WS(', ', NULLIF(city,''), NULLIF(region,''), NULLIF(country,''))
WHERE location IS NULL;

-- end_time from sale_date
UPDATE listings SET end_time = sale_date::timestamptz
WHERE end_time IS NULL AND sale_date IS NOT NULL;

-- start_time from list_date
UPDATE listings SET start_time = list_date::timestamptz
WHERE start_time IS NULL AND list_date IS NOT NULL;

-- engine/transmission from vehicle_specs
UPDATE listings l SET
  engine = vs.engine,
  transmission = vs.transmission
FROM vehicle_specs vs
WHERE vs.listing_id = l.id AND l.engine IS NULL;

-- images from photos_media
UPDATE listings l SET images = sub.urls
FROM (
  SELECT listing_id, ARRAY_AGG(photo_url ORDER BY photo_order) AS urls
  FROM photos_media GROUP BY listing_id
) sub WHERE sub.listing_id = l.id AND l.images IS NULL;

-- bid_count from auction_info
UPDATE listings l SET bid_count = ai.number_of_bids
FROM auction_info ai
WHERE ai.listing_id = l.id AND (l.bid_count IS NULL OR l.bid_count = 0) AND ai.number_of_bids IS NOT NULL;

-- current_bid from latest price_history
UPDATE listings l SET current_bid = sub.latest_price
FROM (
  SELECT DISTINCT ON (listing_id) listing_id,
    COALESCE(price_usd, price_eur, price_gbp) AS latest_price
  FROM price_history
  ORDER BY listing_id, time DESC
) sub WHERE sub.listing_id = l.id AND l.current_bid IS NULL AND sub.latest_price IS NOT NULL;

-- reserve_status from reserve_met
UPDATE listings SET reserve_status = CASE
  WHEN reserve_met = true THEN 'RESERVE_MET'
  WHEN reserve_met = false THEN 'RESERVE_NOT_MET'
  ELSE NULL
END WHERE reserve_status IS NULL;
