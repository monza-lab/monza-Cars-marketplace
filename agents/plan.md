# Execution Plan: Ferrari Historical Sold Listings -> Existing Live Ferrari UI

## Plan Envelope (Binding)
`{files: 7, LOC/file: 40-220, deps: [zod]}`

- Files: 7 maximum, feature-local and route-local only.
- LOC/file: target 40-220, hard cap 300.
- Dependencies: add exactly `zod`.

## Phase 0: Environment and Baseline Capture

### Objective
Capture runtime matrix and current behavior before code changes.

### Dependencies
None.

### Deliverables
- Environment matrix artifact.
- Baseline responses for live Ferrari detail and price-history endpoints.

### Testscript TS-P0-ENV
- Identifier: `TS-P0-ENV`
- Objective: verify deterministic local runtime and baseline API behavior.
- Prerequisites: repo installed.
- Setup:
  1. Ensure `.env.local` has Supabase URL/keys.
  2. Start dev server.
- Run commands:
  - `node -v`
  - `npm -v`
  - `npm run dev`
  - `curl -sS http://localhost:3000/api/auctions/live-<knownFerrariId>`
  - `curl -sS http://localhost:3000/api/listings/live-<knownFerrariId>/price-history`
- Expected observations:
  - Runtime versions captured.
  - Existing endpoints return valid JSON.
- Artifact capture:
  - `agents/testscripts/TS-P0-ENV.env.txt`
  - `agents/testscripts/TS-P0-ENV.auction.json`
  - `agents/testscripts/TS-P0-ENV.price-history.json`
- Cleanup:
  - Stop dev server.
- Pass/Fail:
  - PASS if all commands run and artifacts are captured.
  - FAIL if runtime mismatch or endpoint fails.

## Phase 1: Ferrari History Feature Slice (Contracts + Service + Adapters)

### Objective
Create server-owned Ferrari sold-history query boundary with strict Zod input/output validation and table-state checks.

### Dependencies
Phase 0 pass.

### Files
1. `src/features/ferrari_history/contracts.ts`
2. `src/features/ferrari_history/service.ts`
3. `src/features/ferrari_history/adapters.ts`

### Implementation Scope
- Input contract: make/model/months/limit validation.
- Output contract: sold rows with normalized `sold_price`, `sold_at`, `currency`.
- Table-state checks in priority order:
  1. sold-state correctness
  2. valid sold timestamp
  3. valid sold price
  4. currency normalization
  5. duplicate suppression
  6. model normalization
- Query constraints:
  - `make = Ferrari` (case-normalized)
  - exact normalized `model`
  - sold-only rows
  - last 12 months
  - bounded limit (50-200)
  - projected columns only

### Testscript TS-P1-CONTRACTS
- Identifier: `TS-P1-CONTRACTS`
- Objective: validate feature contracts and filtering logic in isolation.
- Prerequisites: Phase 0 artifacts, dependency installed (`zod`).
- Setup:
  1. Prepare fixtures with mixed statuses, invalid dates, invalid prices.
  2. Mock Supabase response set.
- Run commands:
  - `npm test -- tests/integration/ferrari_history.boundary.test.ts -t "contracts"`
- Expected observations:
  - Invalid input rejected with stable 400 envelope.
  - Non-sold rows excluded.
  - Rows sorted by sold_at asc then id asc.
- Artifact capture:
  - `agents/testscripts/TS-P1-CONTRACTS.output.txt`
  - `agents/testscripts/TS-P1-CONTRACTS.filtered.json`
- Cleanup:
  - Remove temporary fixtures.
- Pass/Fail:
  - PASS if all table-state assertions pass.
  - FAIL on any schema/filtering mismatch.

## Phase 2: Integrate Server Boundary into Existing Endpoints

### Objective
Wire Ferrari historical service into existing live detail routes without changing UI contract shapes.

### Dependencies
Phase 1 pass.

### Files
4. `src/app/api/listings/[id]/price-history/route.ts`
5. `src/app/api/auctions/[id]/route.ts`

### Implementation Scope
- `GET /api/listings/[id]/price-history`:
  - For Ferrari live listing IDs, return 12-month sold historical points mapped to `PriceHistoryEntry[]`.
  - For non-Ferrari IDs, preserve current `price_history` behavior.
- `GET /api/auctions/[id]`:
  - For live Ferraris, enrich response with historical `priceHistory` and comparables payload from same service.
  - Keep non-Ferrari and DB-backed behavior unchanged.
- Security/scalability boundary:
  - server-owned Supabase access only
  - projection + bounded result size
  - request correlation ID logging

### Testscript TS-P2-BOUNDARY
- Identifier: `TS-P2-BOUNDARY`
- Objective: validate endpoint-level Ferrari history behavior and non-Ferrari preservation.
- Prerequisites: Phase 1 pass.
- Setup:
  1. Seed or identify one Ferrari live ID and one non-Ferrari live ID.
  2. Start app.
- Run commands:
  - `curl -sS http://localhost:3000/api/listings/live-<ferrariId>/price-history`
  - `curl -sS http://localhost:3000/api/listings/live-<nonFerrariId>/price-history`
  - `curl -sS http://localhost:3000/api/auctions/live-<ferrariId>`
- Expected observations:
  - Ferrari response contains sold-only 12-month series.
  - Non-Ferrari response remains previous behavior.
  - Auction detail includes enriched historical fields without shape break.
- Artifact capture:
  - `agents/testscripts/TS-P2-BOUNDARY.ferrari-history.json`
  - `agents/testscripts/TS-P2-BOUNDARY.non-ferrari-history.json`
  - `agents/testscripts/TS-P2-BOUNDARY.auction.json`
- Cleanup:
  - Stop app.
- Pass/Fail:
  - PASS if Ferrari and non-Ferrari paths both satisfy expected contracts.
  - FAIL on response-shape regression or filtering breach.

## Phase 3: Client Composition Point Integration

### Objective
Use enriched server payload in current auction detail flow while preserving visuals and interaction.

### Dependencies
Phase 2 pass.

### File
6. `src/app/[locale]/auctions/[id]/AuctionDetailClient.tsx`

### Implementation Scope
- Keep existing rendering and component tree.
- Use `priceHistory` from auction payload as primary source.
- Retain existing fallback fetch call only as resilience path.
- Do not modify styles, layout, or component signatures.

### Testscript TS-P3-COMPOSITION
- Identifier: `TS-P3-COMPOSITION`
- Objective: verify chart/comparable sections render from new data source without UI redesign.
- Prerequisites: Phase 2 pass.
- Setup:
  1. Run app locally.
  2. Open Ferrari live auction detail page.
- Run commands:
  - `npm run dev`
  - manual browser verification on `/auctions/live-<ferrariId>`
- Expected observations:
  - Existing `PriceChart` renders with historical sold series.
  - Existing modules remain visually unchanged.
  - No client runtime errors.
- Artifact capture:
  - `agents/testscripts/TS-P3-COMPOSITION.console.txt`
  - `agents/testscripts/TS-P3-COMPOSITION.screenshot.png`
- Cleanup:
  - Close browser/dev server.
- Pass/Fail:
  - PASS if chart appears and layout is unchanged.
  - FAIL on visual drift or runtime error.

## Phase 4: Regression and Hardening

### Objective
Run targeted regressions across existing Ferrari/live flows and enforce rerun policy.

### Dependencies
Phases 0-3 pass.

### File
7. `tests/integration/ferrari_history.boundary.test.ts`

### Implementation Scope
- Add/extend integration test for:
  - sold-only exclusion of active listings
  - 12-month window enforcement
  - sorted output stability
  - invalid input 400 envelope
  - non-Ferrari route invariance

### Testscript TS-P4-REGRESSION
- Identifier: `TS-P4-REGRESSION`
- Objective: verify no regressions and validate full acceptance criteria.
- Prerequisites: all prior phases complete.
- Setup:
  1. Ensure tests and app environment are ready.
- Run commands:
  - `npm test -- tests/integration/ferrari_history.boundary.test.ts`
  - `npm test -- tests/integration/cron-pipeline.test.ts`
  - `npm test -- tests/quality/data-quality.test.ts`
- Expected observations:
  - New boundary tests pass.
  - Existing integration/quality tests still pass.
- Artifact capture:
  - `agents/testscripts/TS-P4-REGRESSION.output.txt`
- Cleanup:
  - Remove temporary logs if any.
- Pass/Fail:
  - PASS if all tests pass and no Ferrari/live regression appears.
  - FAIL if any previous testscript regresses.

## Feature-Phase Sequencing and Re-Run Policy
- Execution order: `Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4`.
- Dependency rule: each phase blocks on prior phase PASS.
- Re-run rule (mandatory): at each phase, re-run all prior phase testscripts before advancing.
  - At Phase 2, run `TS-P0-ENV + TS-P1-CONTRACTS + TS-P2-BOUNDARY`.
  - At Phase 3, run prior scripts plus `TS-P3-COMPOSITION`.
  - At Phase 4, run all scripts including regression suite.

## Failure and Debug Protocol (Binding)
- Debug loop: one hypothesis, one variable change per attempt.
- If a testscript still fails after two debug turns, stop and create:
  - `agents/testscripts/failure_report.md`
- `failure_report.md` must include:
  - title, severity, frequency, phase, script identifier
  - environment matrix and build/commit
  - reproduction steps
  - observed vs expected behavior
  - artifact references
  - suspected boundary
  - initial hypothesis and attempted fixes
  - workaround (if any) and regression-test status

## Acceptance Criteria Mapping
- Ferrari historical sold listings are fetched from `listings` via server-owned boundaries only.
- Active listings are excluded from historical payload.
- Input/output are validated with Zod.
- Existing UI components consume data through current props/state paths with no redesign.
- Table-state checks execute in defined priority order.
- Regression scripts pass after each phase and at final gate.
