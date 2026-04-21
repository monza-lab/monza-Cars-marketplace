-- Add landed_cost_json JSONB column to listing_reports for storing
-- the LandedCostBreakdown payload generated at Haus Report time.
-- Nullable because some reports (domestic transactions, out-of-matrix
-- origins, or exchange-rate failures) have no estimate to store.

ALTER TABLE listing_reports
ADD COLUMN IF NOT EXISTS landed_cost_json JSONB;

-- No index: the field is read only on report load by listing_id,
-- which already has its own index. We never query by landed_cost_json fields.

COMMENT ON COLUMN listing_reports.landed_cost_json IS
  'Serialized LandedCostBreakdown (see src/lib/landedCost/types.ts). Null when origin is unsupported or transaction is domestic.';
