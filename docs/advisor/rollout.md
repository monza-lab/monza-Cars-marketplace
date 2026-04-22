# MonzaHaus Personal Advisor — Rollout Plan

Five-stage rollout gated by the `ADVISOR_ENABLED` env var plus
`ADVISOR_INTERNAL_USER_IDS` allow-list. Each stage defines the gate change,
metrics to watch, and a rollback procedure. Do not advance stages until the
previous stage has held its metrics for a full business week.

The gate is implemented in `src/lib/advisor/runtime/orchestrator.ts`
(`advisorEnabledFor`) — editing this file is not required to move between
stages; only env var changes are needed.

## Stage matrix

| Stage | `ADVISOR_ENABLED` | Audience | Duration |
|------:|:------------------|:---------|:---------|
| 1 | `internal` | MonzaHaus team user ids in `ADVISOR_INTERNAL_USER_IDS` | 1 week |
| 2 | `free_beta` + cohort flag | 10% of FREE users, sticky by user id | 1 week |
| 3 | `free_beta` + cohort flag | 50% of FREE users, sticky by user id | 1 week |
| 4 | `full` | All FREE + PRO users (no anonymous yet) | 2 weeks |
| 5 | `full` | Everyone including anonymous (cookie-session), ongoing | ongoing |

Note: the in-code `advisorEnabledFor` treats `free_beta` as "any signed-in
user (FREE or PRO)". The 10% / 50% cohort split in Stages 2–3 is
implemented at the edge / app router by checking a stable cohort hash
(`userId` → SHA-1 → first-byte bucket). Anonymous users are excluded until
Stage 5.

## Stage 1 — Internal (Week 1)

**Gate change.**
```
ADVISOR_ENABLED=internal
ADVISOR_INTERNAL_USER_IDS=<comma-separated Supabase user ids>
```

**Goal.** Shake out real-world prompts, confirm SSE stream stability
behind Vercel's edge runtime, validate that the pistons ledger credits
and debits reconcile.

**Metrics to watch.**
- p50/p95 end-to-end latency per tier (Instant < 3s p50, Marketplace < 8s p50, Deep Research < 25s p50).
- Classifier accuracy — manual spot-check of at least 20 messages.
- Tool-call success rate per tool name (target ≥ 95%).
- Gemini token cost per message per tier (compare to `PISTONS_BY_TIER`).
- Any `feature_disabled` error event emitted to a non-internal user (should be 0 after a soft cutover — otherwise the gate is mis-set).

**Rollback.** Set `ADVISOR_ENABLED=""` (or any unrecognised value). The
gate fails closed — every turn yields `feature_disabled`. No code push
required.

## Stage 2 — 10% FREE beta (Week 2)

**Gate change.**
```
ADVISOR_ENABLED=free_beta
```
Plus: deploy the cohort check in the advisor API route — `message/route.ts`
returns `feature_disabled` when the user's cohort bucket ≥ 10%.

**Goal.** Verify the pistons economy under real user load. Confirm that
the grace-counter (10/day Instant + 2/day Marketplace) covers normal-user
friction without letting heavy users run free.

**Metrics to watch.**
- Grace-counter hit rate: % of Instant requests that consumed grace vs debited.
- Daily pistons consumption per active user (expect a long tail; median should sit well under the 100-FREE / 2000-PRO monthly cap).
- Error rate per tier. Investigate any > 2%.
- Cost-per-message in USD (Gemini billing / message count) — compare against the piston price point.
- User-facing error events (look for `feature_disabled` leaking — the cohort filter should catch this at the route, never at the orchestrator).

**Rollback.** Widen the cohort threshold to 0% (nobody in bucket) and/or
flip `ADVISOR_ENABLED` back to `internal`. Existing conversations remain
persisted but new turns return `feature_disabled`.

## Stage 3 — 50% FREE beta (Week 3)

**Gate change.** Cohort threshold raised to 50%. `ADVISOR_ENABLED` stays
at `free_beta`.

**Goal.** Confirm the runtime scales at ~5× the Stage-2 load. Watch for
Supabase RLS / connection-pool hot spots and Gemini quota ceilings.

**Metrics to watch.**
- All Stage-2 metrics plus:
- Supabase `advisor_messages` write p95 latency.
- Gemini-side rate-limit 429 count per hour.
- Cache hit rate on the in-memory `advisorQueryCache` (higher audience = more duplicate queries → higher hit rate expected).

**Rollback.** Drop cohort threshold back to 10% (or lower). The gate is
additive — no deletes.

## Stage 4 — Full FREE + PRO (Weeks 4–5)

**Gate change.**
```
ADVISOR_ENABLED=full
```
Remove the cohort filter in the API route, but keep anonymous disabled
(that's still the `internal` condition in `advisorEnabledFor` for
`userId === ""`). Anonymous users receive `feature_disabled` through
the gate.

Update the route to only short-circuit anonymous callers (no cohort
check for signed-in users).

**Goal.** Hit every FREE and PRO user. Validate pistons monthly caps
(100 FREE, 2000 PRO) by inspecting `credits_ledger`.

**Metrics to watch.**
- All previous metrics plus:
- % of users hitting the monthly piston cap (both FREE and PRO).
- PRO conversion rate from FREE caps (expected lift).
- Deep-research tier usage for PRO — confirm the 3-round loop completes within 60s budget in the real world.
- Share-link creation rate (`/api/advisor/conversations/:id/share`) as a signal of answer quality.

**Rollback.** Flip back to `free_beta`. Cohort filter remains committed
in the codebase and re-enables automatically when the env var changes.

## Stage 5 — Full + anonymous (Week 6+)

**Gate change.** `ADVISOR_ENABLED=full`, anonymous path enabled at the
route (no cohort / no signed-in-only gate). Stays like this indefinitely.

**Goal.** Public rollout. The cookie-backed anonymous session writes to
`advisor_grace_counters` keyed by `anonymous_session_id`. When an anon
user signs up, `mergeAnonSessionToUser` claims their conversations and
grace state.

**Metrics to watch.**
- Anonymous → signed-up conversion rate.
- Anonymous abuse: single IP / cookie generating > N turns per hour. Add rate limiting upstream (edge) if exceeded.
- Cost drift — anonymous users don't debit pistons; they only consume grace + cache. Confirm the grace ceiling (10 Instant / 2 Marketplace per day) actually caps them. Anything else gets `feature_disabled` from the grace layer.
- Long-term retention: return rate of anonymous users who converted.

**Rollback.** Drop back to Stage 4 (`full`, anonymous-excluded at the
route). Anonymous conversations remain in the DB but become read-only.

## Cross-stage safety valves

- `ADVISOR_ENABLED=internal` with an empty `ADVISOR_INTERNAL_USER_IDS` =
  off for everyone. This is the emergency kill switch — no deploy needed.
- The observability logger (`logAdvisorEvent`) emits a `response` event
  on every successful turn and an `error` event on every failure. Wire
  these to your alerting surface of choice (Datadog monitor, Vercel log
  drain, etc.). A spike in `kind: "error"` above 5% should trigger a
  stage rollback.
- Each stage should be committed with a git tag (`advisor-stage-1`,
  etc.) so post-mortems can diff the surface area.
