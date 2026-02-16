# 1) Goal
Integrate Supabase `listings` historical sold Ferrari model data into existing price-relevant frontend components (no visual/UI changes), with secure and scalable server-owned data access and validated contracts.

# 2) Primary User / Actor
- Primary actor: frontend/backend architecture agent implementing data integration.
- User moment: when viewing a Ferrari model context where price/history components already render live auction pricing.

# 3) Inputs
Required inputs
- Supabase project with `listings` table as source of truth.
- Existing frontend components under `src/components/`, especially price-related components.
- Target model identifier inputs (`make`, `model`, optional `generation`/`series` if already present in UI context).

Optional inputs
- Existing server utilities for Supabase client creation.
- Existing formatting helpers for currency/date used by current live auction UI.

# 4) Outputs / Deliverables
- A concrete integration plan and implementation-ready contracts for historical sold Ferrari model prices.
- Server-side fetch boundary that returns validated historical series (12-month sold-only window).
- Mapping guidance to feed existing UI components without changing styles/markup.
- Verification checklist and acceptance criteria.

Plan envelope: `{files: 5-7, LOC/file: 40-220, deps: [zod]}`.

# 5) Core Pipeline
1. Component review pass (no UI edits):
   - Inspect `src/components/auction/PriceChart.tsx` for current series shape, axis expectations, and fallback states.
   - Inspect `src/components/analysis/ComparableSales.tsx` for sold-comparable rendering and required fields.
   - Inspect `src/components/auction/AuctionCard.tsx` for price badges/status assumptions.
   - Inspect `src/components/layout/LiveTicker.tsx` for any shared price formatting/stream assumptions.
   - Inspect `src/components/mobile/MobileCarCTA.tsx` and `src/components/mobile/MobileBottomNav.tsx` for price context usage on mobile.
   - Inspect parent composition points that pass data into these components and identify exact insertion points for historical series.
2. Define historical data contract from `listings` (Ferrari model sold-only).
3. Implement server-owned query boundary (API route or server action), never direct client table reads for this feature.
4. Validate request params (`zod`) and response payload (`zod`) before returning to UI.
5. Map validated payload to existing component props/state adapters; preserve existing rendering and appearance.
6. Add prioritized table-state checks and fail-safe responses.
7. Verify with targeted test/QA passes and acceptance checklist.

# 6) Data / Evidence Contracts
Historical series contract (from `listings`)
- Filter rules:
  - `make = 'Ferrari'` (case-normalized comparison).
  - `model = <requested model>` (normalized exact match; no fuzzy default).
  - Sold-only: include rows where listing is definitively sold; exclude active/in-progress states.
  - Time window: last 12 months from request execution time.
- Sort:
  - Primary: sale timestamp ascending for chart series.
  - Secondary stable tie-breaker: `id` ascending.
- Required output fields:
  - `id`
  - `make`
  - `model`
  - `sold_price` (numeric)
  - `sold_at` (ISO timestamp/date)
  - `currency` (default USD if table contract already enforces)
  - `source_platform` (if available)
- Optional passthrough fields (only if already consumed by existing components):
  - `year`, `mileage`, `location`, `listing_url`

Validation gates (must-pass)
- Input schema (`zod`): enforce non-empty model string, max length, sanitized charset, optional pagination/limit bounds.
- Output schema (`zod`): enforce sold price positive number, valid sold date, required keys present.
- Reject/empty behavior:
  - Invalid input -> 400 with stable error envelope.
  - Valid input + no sold rows -> 200 with empty series and metadata.

# 7) Constraints
- No UI redesign: do not alter component visuals, CSS, layout, or interaction patterns.
- Source of truth must remain Supabase `listings`.
- Security/scalability:
  - Server-side ownership for Supabase reads.
  - Parameterized/typed query path only.
  - Rate-limit and bounded result size (default limit 50-200, tuned to chart needs).
  - Favor projection of only needed columns.
  - Add/verify indexing guidance: composite index for `(make, model, sold_state, sold_at)` or equivalent status/date strategy.
- Table-state checks (prioritized by impact):
  1. Sold-state correctness (exclude active listings).
  2. Presence/validity of `sold_at`.
  3. Presence/validity of `sold_price`.
  4. Currency consistency/normalization.
  5. Duplicate sale rows handling.
  6. Null/unknown model normalization.
- Keep dependency scope to selected option B: add only `zod`.

# 8) Non-Goals / Backlog
- No changes to existing UI appearance/components.
- No migration to redesign chart/comparable UX.
- No ML valuation, forecasting, or pricing recommendation engine.
- No expansion beyond Ferrari historical sold-model integration in this phase.
- No broad schema refactor unless required for correctness of sold-state filtering.

# 9) Definition of Done
- Historical Ferrari sold-model data (12-month window) is fetched from `listings` via server-owned boundary only.
- Active listings are excluded; sold-state filtering is verifiably correct.
- Input and output are validated with `zod`; invalid requests fail with stable 4xx envelope.
- Existing price-relevant components receive and render historical data through current props/state paths with no UI changes.
- Empty-state and partial-data-state behaviors are graceful and do not break live auction price flows.
- Query is bounded, projected, and index-aware for scale.
- Verification plan completed:
  - Contract tests for schema validation and sold-only filtering.
  - Integration test for Ferrari model request returning sorted 12-month series.
  - Regression check confirming live auction price UI remains unchanged.
