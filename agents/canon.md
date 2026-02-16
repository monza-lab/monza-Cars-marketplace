# Project Canon: Ferrari Historical Sold Listings (12-Month) Integration

## Prime Directive
`agents/canon.md` is the sole source of truth for implementing Ferrari sold-history integration from Supabase `listings` into current live Ferrari pricing flows with zero UI redesign.

## Non-Generic Engineering Position (Final)
Rejected generic option: adding a new parallel UI page and a new client-side Supabase fetch path.

Chosen architecture: preserve the existing auction detail rendering path and inject Ferrari historical sold series behind server-owned API boundaries already in use by the UI (`/api/auctions/[id]` and `/api/listings/[id]/price-history`). This minimizes file spread, preserves visual behavior, and keeps historical logic localized in one feature slice.

## Grounded Review of Existing Code (Binding Context)
- `PriceChart` already expects `PriceHistoryEntry[]` (`id`, `bid`, `timestamp`) and gracefully handles empty arrays: `src/components/auction/PriceChart.tsx`.
- `AuctionDetailClient` currently fetches detail data from `/api/auctions/[id]`, then performs a second fetch for live IDs to `/api/listings/[id]/price-history`: `src/app/[locale]/auctions/[id]/AuctionDetailClient.tsx`.
- Live Ferrari detail records are sourced from Supabase via `fetchLiveListingById`: `src/app/api/auctions/[id]/route.ts`, `src/lib/supabaseLiveListings.ts`.
- Current Supabase listing status vocabulary in active flows is `active`, `sold`, `unsold`, `delisted`; this is the authoritative filter basis.
- `ComparableSales` exists but is not currently mounted directly; comparable display currently comes from `analysis.comparableSales` in auction detail modules.

## Locality Budget (Hard Envelope)
Implementation envelope: `{files: 7, LOC/file: 40-220, deps: [zod]}`

- Max touched files: 7
- Max LOC per touched file: 220 target, 300 hard cap
- New dependency budget: `zod` only
- No UI markup/styling redesign

## SECTION A: LOGIC AND BEHAVIOR

### A1. Authentication and Authorization Schema
- Auth method: none for end-user read; server-owned Supabase key for backend query.
- User model file location: existing auth profile remains `src/lib/auth/AuthProvider.tsx` (unchanged).
- Permission enforcement point: inline route guard + schema validator in feature service.
- Permission check pattern:

```ts
if (normalizedMake !== "ferrari") {
  return { status: 200, data: [] };
}

if (!requestInput.success) {
  return {
    status: 400,
    code: "INVALID_INPUT",
    message: "Invalid Ferrari historical query",
  };
}
```

### A2. Request Flow and State Management
- Entry points:
  - `GET /api/listings/[id]/price-history` for chart feed.
  - `GET /api/auctions/[id]` for detail payload enrichment.
- Request lifecycle order:
  `parse route params -> resolve listing/make/model -> zod validate input -> query listings sold-only window -> zod validate rows -> table-state checks -> map to UI contracts -> respond`.
- State storage: Supabase Postgres `public.listings`.
- State location: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` server-side.
- Transaction boundaries: none (single bounded read per request).

### A3. Error Handling and Recovery
- Error envelope format:

```ts
export type ErrorResponse = {
  status: number;
  code: "INVALID_INPUT" | "UPSTREAM_ERROR" | "INTERNAL_ERROR";
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
};
```

- Validation library: `zod`.
- Validation location: both boundary and output shaping.
- Retry strategy: none in request path; fail-fast and return safe empty payload.
- Fallback behavior on critical failure: return `200` with empty historical series so live auction view does not break.

### A4. Data Contracts and Schemas
- Schema definition tool: Zod.
- Schema files location: `src/features/ferrari_history/contracts.ts` (feature-local).
- Contract testing approach: schema tests + route integration tests.
- Main schema examples:

```ts
import { z } from "zod";

export const FerrariHistoryInputSchema = z.object({
  make: z.literal("ferrari"),
  model: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9 .\-/]+$/),
  months: z.literal(12).default(12),
  limit: z.number().int().min(50).max(200).default(120),
});

export const FerrariSoldListingRowSchema = z.object({
  id: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  status: z.string(),
  final_price: z.number().nullable(),
  hammer_price: z.union([z.number(), z.string(), z.null()]),
  end_time: z.string().nullable(),
  sale_date: z.string().nullable(),
  original_currency: z.string().nullable(),
  source: z.string().nullable(),
  year: z.number().nullable(),
  mileage: z.number().nullable(),
  location: z.string().nullable(),
  source_url: z.string().nullable(),
});
```

### A5. Critical User Journeys
- Primary happy path:
  `GET /api/auctions/live-<id> -> fetchLiveListingById() -> Ferrari history service(query listings sold-only 12m) -> response contains enriched priceHistory/comparables -> AuctionDetailClient renders existing PriceChart and comparables modules`.
- First decision point:
  branch at make check in server boundary (`make !== Ferrari` skips Ferrari history; `make === Ferrari` executes history query).
- Failure recovery example:
  on Supabase error or schema mismatch, respond with empty historical payload while preserving auction detail data.

## Prioritized Table-State Checks (Mandatory, in order)
1. Sold-state correctness: include definitive sold only (`status = sold` case-normalized), exclude active/in-progress states.
2. Sold timestamp validity: `sold_at = end_time || sale_date`; discard rows with invalid/null sold timestamp.
3. Sold price validity: `sold_price = final_price || hammer_price`; discard `<= 0`.
4. Currency normalization: use `original_currency` when present, default to `USD`.
5. Duplicate handling: dedupe by `id`, stable order by `sold_at asc`, tie-break `id asc`.
6. Model normalization: exact normalized match; no fuzzy matching.

## SECTION B: INTERFACE AND DESIGN

### B1. Design System Foundation
- Base system: existing Tailwind + current component library.
- Why: feature is data integration only; UI redesign is explicitly out of scope.
- Style file location: unchanged (`src/app/globals.css` + existing component classes).
- Design tokens: unchanged.

### B2. Distinctive Visual Language
- Typography, palette, spacing, radius, and motion remain unchanged.
- Canonical token snippet retained:

```css
:root {
  --background: #0b0b10;
  --foreground: #fffcf7;
}
```

### B3. Component Architecture
- Pattern: existing feature pages + component composition.
- Existing component path references:
  - `src/components/auction/PriceChart.tsx`
  - `src/components/analysis/ComparableSales.tsx`
  - `src/components/auction/AuctionCard.tsx`
  - `src/components/layout/LiveTicker.tsx`
  - `src/components/mobile/MobileCarCTA.tsx`
  - `src/components/mobile/MobileBottomNav.tsx`
- Prop validation: TypeScript in UI, Zod at server boundaries.
- State management: existing `useState/useEffect` in `AuctionDetailClient` remains primary client state surface.

### B4. Responsive Strategy
- Breakpoints: existing Tailwind breakpoints.
- Layout approach: existing grid/flex composition.
- Strategy: existing mobile-first behavior is preserved.
- Minimum target size: preserve current touch target system (no UI edits in scope).

### B5. Accessibility Baseline
- Focus indicator style: keep existing `focus-visible` rules unchanged.
- ARIA pattern: semantic-first, no additional ARIA inflation.
- Keyboard navigation: all existing interactives remain keyboard-reachable.
- Contrast target: maintain existing AA baseline.

## SECTION C: ARCHITECTURE AND OPERATIONS

### C1. Environment and Configuration
- Required env files:
  - `.env.example`
  - `.env.local`
  - `.env.test`
- Config loading: native `process.env`.
- Config validation: Zod schema at feature boundary.
- Example `.env.example`:

```bash
NODE_ENV=development
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service-role>
LOG_LEVEL=info
```

### C2. Repository Structure
- Top-level structure (relevant):

```text
/
|- src/
|  |- app/
|  |- components/
|  |- features/
|  |  |- ferrari_collector/
|  |  |- ferrari_history/        # new feature slice
|  |- lib/
|- tests/
|- agents/
```

- File size limit: 220 LOC target, 300 hard.
- Max nesting depth: 4.

### C3. Dependency Management
- Package manager: npm.
- Lockfile: `package-lock.json`.
- Dependency budget: add only `zod`.
- Vanilla-first exception: Zod is justified for boundary contract enforcement.

### C4. Build and Development
- Commands:
  - `npm install`
  - `npm run dev`
  - `npm run build`
  - `npm test`
  - `npm run start`
- Dev port: 3000.
- Hot reload: yes.
- Build tool: Next.js build pipeline.
- Output dir: `.next`.

### C5. Testing Infrastructure
- Framework: Vitest.
- Test file pattern: `tests/schema/*.test.ts`, `tests/integration/*.test.ts`.
- DB approach: mocked Supabase client for schema/unit + integration with deterministic fixtures.
- Required test types:
  - Smoke: yes
  - Unit: yes
  - Integration: yes
  - E2E: no new browser E2E required for this slice
- Coverage target: >= 90% over new ferrari-history files.

### C6. Logging and Observability
- Logging library: console (existing standard).
- Format: structured JSON-like logs.
- Levels: `error`, `warn`, `info`.
- Correlation ID: `x-request-id` header or generated UUID.
- Example line:

```json
{"level":"info","feature":"ferrari_history","reqId":"b52a7d6c","model":"F40","rows":38,"msg":"sold series loaded"}
```

### C7. Security Baseline
- Secrets: env vars only.
- Input sanitization: Zod at API boundary.
- Injection prevention: Supabase query builder with explicit filters and column projection.
- XSS prevention: React auto-escaping; no unsafe HTML insertion.
- CORS: default same-origin Next API behavior.
- Rate limiting: endpoint-level bounded `limit` and optional per-IP soft limiter in API route.

### C8. Git and Version Control
- `.gitignore` baseline:

```gitignore
node_modules/
dist/
build/
.env.local
.env.*.local
*.log
.DS_Store
coverage/
```

- Branch strategy: trunk-based.
- Commit format: conventional commits.

### C9. Deployment and Infrastructure
- Deployment target: Vercel-compatible Next runtime.
- Trigger: push-driven pipeline.
- Parity: dev/prod equivalent API contract behavior.
- IaC: none required for this feature.
- Runtime snippet:

```bash
npm ci
npm run build
npm run start
```

### C10. CI/CD Pipeline
- CI tool: currently none committed.
- Required stages when added: `install -> lint -> test -> build`.
- CI test execution: all ferrari-history schema + integration suites.
- Deployment approval: manual for production.
- Example workflow:

```yaml
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run build
```

## Implementation Slice (Definitive Files)
1. `src/features/ferrari_history/contracts.ts`
2. `src/features/ferrari_history/service.ts`
3. `src/features/ferrari_history/adapters.ts`
4. `src/app/api/listings/[id]/price-history/route.ts`
5. `src/app/api/auctions/[id]/route.ts`
6. `src/app/[locale]/auctions/[id]/AuctionDetailClient.tsx`
7. `tests/integration/ferrari_history.boundary.test.ts`

## Constitution (Project-Specific Locality and Debugging)
1. Keep Ferrari historical logic in one vertical slice (`src/features/ferrari_history/*`).
2. Do not create client-side direct Supabase reads for historical sold data.
3. Validate every input and output boundary with Zod before crossing route boundaries.
4. Preserve existing UI contracts; adapt data at server edge, not by redesigning components.
5. Re-run prior phase testscripts at each new phase to catch regressions.
6. Debug one hypothesis at a time with minimal local changes.
7. If two debug turns fail for a testscript, stop and generate `agents/testscripts/failure_report.md`.
8. Keep artifacts reproducible and secrets redacted.

---

Version: 3.0
Date: 2026-02-16
