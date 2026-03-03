# Project Canon: Auth-First ORM Exit + Evidence-Gated Supabase Table Cleanup

Prime Directive: `agents/canon.md` is the sole source of truth for this migration program.

## Chosen Non-Generic Perspective

Do not run a broad refactor and do not blend auth and cleanup work into one opaque migration.

Chosen approach is a two-lane program with hard gates:
- Lane 1: remove the legacy ORM through a strict compatibility seam while keeping auth contracts frozen.
- Lane 2: clean unused empty Supabase tables using an evidence pipeline (`detect -> verify -> quarantine -> optional drop`).
- Auth is the top-priority non-regression boundary and blocks every phase.

Why this is superior to generic migration plans:
- Generic approach: "remove ORM then tidy DB later" risks hidden auth drift and unsafe table deletion.
- Canon approach: every phase has explicit auth canary thresholds, rollback triggers, and artifact evidence.
- Result: minimal churn, deterministic rollback, and auditable DB hygiene.

## Scope and Assumptions

- Runtime is Next.js app with Supabase and a legacy ORM currently present.
- Auth/login/session flows must remain behaviorally identical.
- Cleanup targets only empty, unused tables in Supabase Postgres.
- No new dependencies are introduced; use existing stack and Postgres/Supabase primitives.

---

## SECTION A: Logic and Behavior (Definitive)

### A1. Authentication and Authorization Schema
- Auth method: Supabase session-cookie + JWT bearer for API calls.
- User model file location: `src/lib/db/contracts.ts`.
- Permission enforcement point: route/mutation boundary guard before repository calls.
- Required permission check pattern:

```ts
if (!authUser) {
  return { status: 401, code: 'AUTH_REQUIRED', message: 'Please sign in' }
}

if (authUser.id !== targetUserId && authUser.role !== 'admin') {
  return { status: 403, code: 'FORBIDDEN', message: 'Admin or owner required' }
}
```

### A2. Request Flow and State Management
- Entry point: Next.js route handlers/server actions.
- Lifecycle order: `parse -> validate -> auth-check -> execute-repository -> shape-output -> log(reqId)`.
- State storage: Supabase Postgres only.
- State location: `DATABASE_URL` + Supabase URL/keys from environment.
- Transaction boundaries: explicit begin/commit for multi-write credit/profile operations; read-only calls remain per-request.

### A3. Error Handling and Recovery
- Error envelope:

```ts
export type ErrorResponse = {
  status: number
  code: string
  message: string
  details?: Record<string, unknown>
  requestId?: string
}
```

- Validation library: existing `zod` (already installed).
- Validation location: boundary first, repository second for DB shape guarantees.
- Retry strategy: no blind write retries; bounded retry only for transient read/network faults.
- Critical fallback: return structured error; never return implicit success.

### A4. Data Contracts and Schemas
- Schema tool: TypeScript + zod.
- Schema location: co-located in `src/lib/db/contracts.ts` and feature-local route schemas.
- Contract tests: schema-validation and response contract snapshots for auth/profile/cleanup endpoints.
- Main schema examples:

```ts
import { z } from 'zod'

export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['user', 'admin']),
  credits: z.number().int().nonnegative(),
  credits_reset_at: z.string().nullable(),
})

export const EmptyTableCandidateSchema = z.object({
  table_schema: z.string(),
  table_name: z.string(),
  estimated_row_count: z.number().int(),
  has_inbound_fk: z.boolean(),
  has_outbound_fk: z.boolean(),
  has_triggers: z.boolean(),
})
```

### A5. Critical User Journeys
- Primary auth happy path: `POST /auth/sign-in -> session issued -> GET /api/user/profile -> protected endpoint 200`.
- First decision point: auth guard branch in protected route (`valid session -> continue`, `missing/expired -> 401`).
- Failure recovery example: on profile bootstrap DB failure, preserve session, return `500 PROFILE_BOOTSTRAP_FAILED`, trigger rollback gate.
- Cleanup happy path: `inventory empty tables -> verify evidence gates -> quarantine -> soak -> optional drop`.
- Cleanup safety branch: if any table fails evidence gate, mark `blocked`, do not quarantine/drop.

---

## SECTION B: Interface and UX (Constrained by Scope)

### B1. Design System Foundation
- Base system: preserve existing frontend system.
- Why: this project scope is backend/migration safety; UI churn is risk with no value.
- Style location: unchanged existing style files.
- Design token file: unchanged existing token source.

### B2. Distinctive Visual Language
- Typography/colors: unchanged.
- Token reference:

```css
:root {
  --color-bg: #0b0b10;
  --color-fg: #fffcf7;
  --color-accent: #f8b4d9;
  --radius-card: 1rem;
  --motion-fast: 150ms;
}
```

### B3. Component Architecture
- Pattern: existing feature folders.
- Example component path: `src/app/[locale]/login/page.tsx`.
- Prop validation: TypeScript.
- State management: existing React hooks/context.

### B4. Responsive Strategy
- Breakpoints/layout: preserve existing.
- Strategy: mobile-first.
- Minimum touch target: 44px.

### B5. Accessibility Baseline
- Focus style:

```css
:focus-visible {
  outline: 2px solid #f8b4d9;
  outline-offset: 2px;
}
```

- ARIA strategy: semantic-first, targeted ARIA.
- Keyboard navigation: all interactive auth controls.
- Contrast target: WCAG AA 4.5:1.

---

## SECTION C: Architecture and Operations (Definitive)

### C1. Environment and Configuration
- Required files: `.env.example`, `.env.local`, `.env.test`.
- Config loading: existing app config/env loader.
- Config validation: fail-fast for missing auth/db vars.
- `.env.example` baseline:

```bash
NODE_ENV=development
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
LOG_LEVEL=info
```

### C2. Repository Structure
- Top-level impacted zones:

```text
/
|- src/
|  |- app/api/...
|  |- lib/db/
|  |- lib/auth/
|- scripts/
|- supabase/migrations/
|- agents/
|  |- canon.md
|  |- plan.md
```

- File size limits: soft 700 LOC, hard 1000 LOC.
- Max nesting depth: 4.

### C3. Dependency Management
- Package manager: npm.
- Lockfile: `package-lock.json`.
- Budget: new runtime deps `0`, new dev deps `0`.
- Vanilla-first exceptions: none.
- Removal target: delete legacy ORM runtime/build usage only after auth gates pass.

### C4. Build and Development
- Commands:
  - `npm install`
  - `npm run dev`
  - `npm run test`
  - `npm run build`
  - `npm run start`
- Dev port: 3000 default.
- Hot reload: yes.
- Build tool: Next.js default pipeline.
- Output dir: `.next`.

### C5. Testing Infrastructure
- Test frameworks: Vitest + Playwright (existing).
- Test pattern: existing `*.test.ts` plus testscript artifacts under `agents/testscripts/artifacts/`.
- DB test approach: Supabase staging/dev project (real runtime behavior).
- Required test types: smoke yes, unit yes, integration yes, e2e yes.
- Coverage target for touched auth/db files: >= 80% lines.

### C6. Logging and Observability
- Logging library: existing structured console payloads.
- Format: JSON-structured lines.
- Levels: `error`, `warn`, `info`.
- Correlation ID: request header `x-request-id` or generated UUID.
- Example:

```json
{"level":"info","reqId":"req-42","phase":"p6-detect-empty-tables","auth_canary":"pass","candidate_count":4,"msg":"cleanup_gate_a_pass"}
```

### C7. Security Baseline
- Secrets management: env vars only.
- Input sanitization: boundary zod validation.
- SQL injection prevention: parameterized SQL / Supabase query builder.
- XSS prevention: React escaping defaults.
- CORS: explicit allowed origins only.
- Rate limiting: preserve current behavior; no new dependency.

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

- Branching: trunk + short-lived feature branches.
- Commits: conventional commits.

### C9. Deployment and Infrastructure
- Target: Vercel + Supabase.
- Trigger: CI merge/push to main.
- Parity: staging and production use same auth contract and cleanup process.
- IaC: SQL migrations in `supabase/migrations/`.
- Containerization: none.

### C10. CI/CD Pipeline
- CI tool: GitHub Actions.
- Stages: `install -> auth-smoke -> tests -> build -> migration-gate`.
- CI test policy: all auth canary tests + all touched integration/e2e tests.
- Deployment approval: manual hold on any auth canary breach.
- Example workflow snippet:

```yaml
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm ci
      - run: npm run test
      - run: npm run build
```

---

## Auth Canary Policy (Mandatory Global + Per-Phase)

Every phase must execute auth canary before and after changes.

Thresholds:
1. Login success rate >= 99.0% (controlled test window).
2. Valid-credential `401` rate <= baseline + 0.5 percentage points.
3. `500` rate on `/auth/*` + `/api/user/profile` < 0.5%.
4. Session refresh succeeds twice consecutively for same user.
5. Protected endpoint unauthorized path remains `401/403`, never `500`.

Global rollback triggers:
- Any threshold breach.
- Profile bootstrap contract drift.
- Auth response schema drift.

Global rollback action:
`stop phase -> revert phase changes -> redeploy prior build -> rerun baseline auth script`.

---

## Supabase Empty Table Cleanup Policy (Evidence-Gated)

Only empty and unused tables are eligible. "Unused" means no runtime references and no active relational/runtime dependencies.

Gate A - Detect candidates:
- Build candidate list with zero rows and non-system schemas.
- SQL evidence (example):

```sql
select
  n.nspname as table_schema,
  c.relname as table_name,
  coalesce(s.n_live_tup, 0)::bigint as estimated_row_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where c.relkind = 'r'
  and n.nspname in ('public')
  and coalesce(s.n_live_tup, 0) = 0
order by n.nspname, c.relname;
```

Gate B - Verify not in use:
- No inbound/outbound FKs, no triggers, no views depending on table.
- No references in code search/migrations/runtime logs.

Gate C - Quarantine first:
- Move table to `quarantine` schema or rename with `quarantine__` prefix.
- Keep restore SQL ready for each quarantined table.

Gate D - Optional drop after soak:
- Soak window: 7 days minimum with zero incidents.
- Drop allowed only with explicit evidence bundle and no auth canary regressions.

Required evidence bundle per table:
- detection output
- dependency checks
- code reference scan output
- quarantine/restore SQL
- soak window observation log

---

## Locality Budget

- Files: max 14 touched across this program.
- LOC/file: target <= 700, hard cap 1000.
- Dependencies: 0 new dependencies.

---

## Constitution (Project-Specific)

1. Vertical slice locality: route, repository, schema, and tests remain adjacent.
2. Auth-first gate: no phase completion without pre/post auth canary pass.
3. Minimal churn: no unrelated refactors, no broad file reshuffles.
4. Evidence over intuition: no table quarantine/drop without complete evidence gates.
5. Reversible operations first: quarantine precedes optional drop.
6. Explicit contracts: status/code/message envelopes at all boundaries.
7. Two-turn debug ceiling: if tests still fail after two debug turns, generate `agents/testscripts/failure_report.md` and stop blind retries.
