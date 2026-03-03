# Execution Plan: Auth-First ORM Removal + Safe Supabase Empty-Table Cleanup

This plan is finalized and one-shot executable by the EYE agent (`plan-code-debug`).

Locality Budget `{files, LOC/file, deps}`:
- Files touched max: 14
- LOC per file target: <= 700 (hard <= 1000)
- New dependencies: 0

## Phase 0 - Environment Matrix + Baseline Freeze

### Objective
Capture full environment matrix, auth baseline, and current DB shape before any code or schema changes.

### Environment Matrix
- OS: `win32`
- Node: `v24.5.0`
- npm: `v11.5.2`
- Next.js: `16.1.6`
- Legacy ORM: present in scripts/dependencies at start
- Supabase: Postgres + SSR client stack present
- Build identifier: current git short SHA
- Configuration flags: `NODE_ENV`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOG_LEVEL`

### Non-Functional Targets
- Auth availability target: >= 99.9% during scripted checks
- Login success threshold: >= 99.0%
- Auth/profile `500` rate threshold: < 0.5%
- Valid-credential `401` drift threshold: <= baseline + 0.5pp
- Session refresh reliability: 2 consecutive successes
- Cleanup safety target: 0 false-positive drops (quarantine-before-drop policy)

### Dedicated Auth Canary (Pre + Post)
Thresholds:
1. Login success rate >= 99.0%
2. Valid-credential `401` drift <= +0.5pp over baseline
3. `/auth/*` and `/api/user/profile` `500` rate < 0.5%
4. Session refresh succeeds twice consecutively
5. Protected unauthorized path returns `401/403` only

Rollback triggers:
- Any canary threshold breach
- Profile bootstrap schema/status drift

Rollback action:
- Stop execution, restore prior commit/deployment state, re-run baseline script

### Testscript TS-P0-BASELINE-AUTH-AND-DB
- Objective: freeze auth and DB baseline evidence
- Prerequisites: valid `.env.local`, seeded test user, staging Supabase credentials
- Setup:
  1. Create `agents/testscripts/artifacts/p0/`
- RUN:
  1. `npm run env:check`
  2. `npm run build`
  3. Execute login flow + `/api/user/profile` + one protected endpoint
  4. Capture current table inventory from Supabase SQL
- OBSERVE:
  - Auth thresholds pass
  - Baseline DB table inventory captured
- COLLECT:
  - `agents/testscripts/artifacts/p0/env-matrix.md`
  - `agents/testscripts/artifacts/p0/auth-baseline.json`
  - `agents/testscripts/artifacts/p0/table-inventory.json`
- REPORT:
  - `agents/testscripts/artifacts/p0/report.md`
- Cleanup:
  - End sessions, redact secrets from artifacts

---

## Phase 1 - ORM Touchpoint Inventory + Compatibility Seam

### Objective
Create/confirm repository seam so routes no longer depend directly on ORM calls.

### Scope
- Inventory all legacy ORM imports/usages.
- Ensure route logic calls feature-local repositories (`src/lib/db/*`) instead of direct ORM access.
- Do not alter auth flow semantics.

### Dedicated Auth Canary (Pre + Post)
Thresholds and rollback triggers are identical to Phase 0.

Phase-specific rollback trigger:
- Any route auth status code changes (`401/403/500`) vs baseline.

### Testscript TS-P1-SEAM-REGRESSION
- Objective: verify seam introduction causes no auth regressions
- RUN:
  1. `npm run test`
  2. `npm run build`
  3. Re-run TS-P0 auth checks
- OBSERVE:
  - Same auth outcomes and response contracts as P0
- COLLECT:
  - `agents/testscripts/artifacts/p1/orm-touchpoints.txt`
  - `agents/testscripts/artifacts/p1/auth-regression.json`
- REPORT:
  - `agents/testscripts/artifacts/p1/report.md`

---

## Phase 2 - ORM Read-Path Removal

### Objective
Replace ORM-backed reads with Supabase repositories while preserving auth/session behavior.

### Scope
- Migrate read paths first (browse/history/read APIs).
- Preserve route contracts and auth guard ordering.

### Dedicated Auth Canary (Pre + Post)
Thresholds and rollback triggers are identical to Phase 0.

Phase-specific rollback trigger:
- Any increase in protected-route auth failures after read calls.

### Testscript TS-P2-READ-CUTOVER-AUTH
- Objective: prove read cutover has zero auth/session drift
- RUN:
  1. Start app in test mode
  2. Login
  3. Exercise migrated read endpoints
  4. Re-check `/api/user/profile` and protected endpoint
- OBSERVE:
  - Response parity + auth canary pass
- COLLECT:
  - `agents/testscripts/artifacts/p2/http-read-snapshots.json`
  - `agents/testscripts/artifacts/p2/auth-after-read.json`
- REPORT:
  - `agents/testscripts/artifacts/p2/report.md`

---

## Phase 3 - ORM Write-Path Removal (Auth-Linked Writes)

### Objective
Move auth-linked writes (profile bootstrap, credits, analysis persistence) to Supabase repositories.

### Scope
- Migrate write flows with explicit transaction boundaries.
- Preserve login/session/profile endpoint behavior.

### Dedicated Auth Canary (Pre + Post)
Thresholds and rollback triggers are identical to Phase 0.

Phase-specific rollback trigger:
- Any profile bootstrap failure or credit consistency regression.

### Testscript TS-P3-WRITE-CUTOVER-AUTH
- Objective: validate write-path correctness and auth continuity
- RUN:
  1. Login
  2. Execute write-path API sequence (`/api/user/create`, `/api/user/profile`, `/api/analyze`)
  3. Run session refresh twice
  4. Re-check protected endpoint
- OBSERVE:
  - Credits/profile contracts stable; auth canary pass
- COLLECT:
  - `agents/testscripts/artifacts/p3/credit-ledger.json`
  - `agents/testscripts/artifacts/p3/profile-bootstrap.json`
  - `agents/testscripts/artifacts/p3/session-refresh.json`
- REPORT:
  - `agents/testscripts/artifacts/p3/report.md`

---

## Phase 4 - Remove ORM Runtime/Build Connections

### Objective
Remove legacy ORM client, generate hooks, and script coupling with minimal essential edits.

### Scope
- Remove legacy ORM usage in runtime code.
- Remove legacy ORM build hooks from `package.json` scripts.
- Remove legacy ORM dependencies only after prior gates are green.

### Dedicated Auth Canary (Pre + Post)
Thresholds and rollback triggers are identical to Phase 0.

Phase-specific rollback trigger:
- Any build/runtime failure requiring legacy ORM, or auth drift post-removal.

### Testscript TS-P4-ORM-EXIT
- Objective: verify complete ORM exit without auth regressions
- RUN:
  1. ORM usage scan across codebase
  2. `npm run build`
  3. `npm run test`
  4. Re-run full auth canary
- OBSERVE:
  - No runtime/build ORM dependency; auth canary green
- COLLECT:
  - `agents/testscripts/artifacts/p4/orm-scan.txt`
  - `agents/testscripts/artifacts/p4/auth-post-orm-exit.json`
- REPORT:
  - `agents/testscripts/artifacts/p4/report.md`

---

## Phase 5 - Unused Empty Table Detection (Evidence Gate A)

### Objective
Generate candidate list of empty tables and prove candidates are non-system and currently empty.

### Scope
- Query table row estimates and explicit counts for candidate confirmation.
- Exclude system schemas and known active tables.

### Dedicated Auth Canary (Pre + Post)
Thresholds and rollback triggers are identical to Phase 0.

Phase-specific rollback trigger:
- Any auth canary degradation during inventory process.

### Evidence Gate A (Must Pass)
Per-table evidence required:
1. `estimated_row_count = 0`
2. `exact_row_count = 0`
3. schema is eligible (`public`/approved app schema only)

### Testscript TS-P5-EMPTY-TABLE-DETECT
- Objective: produce safe candidate inventory
- RUN:
  1. Execute detection SQL in Supabase
  2. Execute exact row count checks for candidates
  3. Re-run auth canary
- OBSERVE:
  - Candidate list generated; auth unaffected
- COLLECT:
  - `agents/testscripts/artifacts/p5/empty-table-candidates.json`
  - `agents/testscripts/artifacts/p5/exact-row-counts.json`
  - `agents/testscripts/artifacts/p5/auth-after-detect.json`
- REPORT:
  - `agents/testscripts/artifacts/p5/report.md`

---

## Phase 6 - Dependency Validation + Quarantine (Evidence Gates B/C)

### Objective
Quarantine only candidates proven unused (no FK/view/trigger/code usage) and keep reversible restore scripts.

### Scope
- Validate relational dependencies and runtime references.
- Quarantine by move-to-schema or deterministic rename.
- Create restore SQL for each quarantined table.

### Dedicated Auth Canary (Pre + Post)
Thresholds and rollback triggers are identical to Phase 0.

Phase-specific rollback trigger:
- Any production-path query failure, auth/profile drift, or cleanup script touching non-candidate tables.

### Evidence Gate B (Must Pass Before Quarantine)
Per-table proof:
1. no inbound FKs
2. no outbound FKs required by active tables
3. no dependent views/triggers/functions
4. no runtime references in code/migrations/logs

### Evidence Gate C (Must Pass During Quarantine)
Per-table proof:
1. quarantine SQL applied successfully
2. restore SQL generated and validated
3. auth canary still green after quarantine

### Testscript TS-P6-QUARANTINE-SAFETY
- Objective: quarantine safely with rollback readiness
- RUN:
  1. Execute dependency checks
  2. Apply quarantine SQL for approved candidates
  3. Validate restore SQL in dry-run form
  4. Run full auth canary
- OBSERVE:
  - Only approved tables quarantined; auth remains green
- COLLECT:
  - `agents/testscripts/artifacts/p6/dependency-checks.json`
  - `agents/testscripts/artifacts/p6/quarantine-sql.sql`
  - `agents/testscripts/artifacts/p6/restore-sql.sql`
  - `agents/testscripts/artifacts/p6/auth-after-quarantine.json`
- REPORT:
  - `agents/testscripts/artifacts/p6/report.md`

---

## Phase 7 - Optional Drop After Soak (Evidence Gate D)

### Objective
Drop quarantined tables only after soak window completes with zero incidents.

### Scope
- Soak duration: minimum 7 days.
- Drop is optional; if uncertainty remains, keep quarantine and stop.

### Dedicated Auth Canary (Pre + Post)
Thresholds and rollback triggers are identical to Phase 0.

Phase-specific rollback trigger:
- Any auth regression, incident, or ambiguous evidence during soak.

### Evidence Gate D (Must Pass Before Drop)
Per-table proof:
1. soak window complete with no incidents
2. no runtime references observed during soak
3. auth canary stable through soak and pre-drop check
4. approved drop SQL + fallback plan documented

### Testscript TS-P7-OPTIONAL-DROP-SAFETY
- Objective: execute optional drop with strict safeguards
- RUN:
  1. Verify soak evidence bundle
  2. Apply drop SQL for approved tables only
  3. Run full auth canary and protected endpoint suite
- OBSERVE:
  - Drop applied only to approved tables; auth unaffected
- COLLECT:
  - `agents/testscripts/artifacts/p7/soak-observations.md`
  - `agents/testscripts/artifacts/p7/drop-sql.sql`
  - `agents/testscripts/artifacts/p7/auth-post-drop.json`
- REPORT:
  - `agents/testscripts/artifacts/p7/report.md`

---

## Cumulative Regression Rule

At phase `N`, execute testscripts for all phases `0..N`.
No phase advances unless current and prior scripts pass.

## Auth-First Execution Order Rule

For every phase:
1. Run pre-phase auth canary.
2. Execute phase changes.
3. Run phase-specific script.
4. Re-run all previous scripts.
5. Trigger rollback immediately on any auth breach.

## Cleanup Safeguards Rule

- No table drop without completed Gates A+B+C+D evidence.
- Quarantine is mandatory before optional drop.
- If evidence is incomplete, candidate remains untouched.

## Failure Rule (Mandatory)

If after trying to debug for two turns the tests still fail, stop and generate:
- `agents/testscripts/failure_report.md`

Required fields in `failure_report.md`:
- title, severity, frequency, phase, script identifier
- environment matrix and build commit
- exact reproduction steps
- observed vs expected behavior
- artifact references with timestamps
- suspected boundary and initial hypothesis
- workaround (if any), regression test status, ownership

## EYE Handoff Instruction

EYE agent with `plan-code-debug` executes Phases 0 -> 7 in one-shot order, enforcing auth canary gates and cleanup evidence gates exactly as written.
