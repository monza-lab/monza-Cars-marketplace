# Pistons Economy — Calibration Playbook

The pistons price for each advisor tier is a proxy for Gemini token cost
plus an overhead margin. This doc describes how to measure real-world
burn and re-tune `PISTONS_BY_TIER` in
`src/lib/advisor/runtime/classifier.ts`.

## Current baseline (Phase 0)

| Tier | Pistons | Model | Expected p50 latency | Expected tool calls |
|:----:|:-------:|:------|:---------------------|:--------------------|
| `instant` | 1 | `gemini-2.5-flash` (`GEMINI_MODEL_FLASH`) | < 3s | 0 |
| `marketplace` | 5 | `gemini-2.5-flash` | < 8s | 1–2 |
| `deep_research` | 25 | `gemini-2.5-pro` (`GEMINI_MODEL_PRO`) | < 25s | 3–6 across up to 3 loop rounds |

Monthly caps: 100 pistons FREE, 2000 pistons PRO. Daily grace: 10 Instant + 2 Marketplace (per user or per anon session, whichever is active).

The token-to-piston mapping is hand-calibrated against Gemini 2.5
pricing as of 2026-Q2. Retune any time Gemini pricing changes.

## What to measure

For each tier, over a 7-day rolling window, measure:

1. **Gemini input + output tokens per message.** Available via the
   `generationMetadata.usageMetadata` field on the Gemini response (if
   the SDK exposes it — otherwise by counting characters / 4 as a proxy).
2. **p50 / p95 end-to-end latency.** Field `latencyMs` on the `response`
   log event.
3. **Tool-call count per message.** Count `kind: "tool_call"` events per
   `conversationId`.
4. **Tool-call latency per tool name.** `latencyMs` on each `tool_call`
   log event. Watch for 10s timeouts.
5. **Cache hit rate.** Count `response` events where `model === "cache"`
   vs. non-cache responses.
6. **Cost in USD** — pull from Gemini billing dashboard, divide by
   message count, compare to `pistons_per_message × piston_price_usd`.

## Weekly SQL monitor

Run against Supabase each Monday for the first month after launch:

```sql
-- Per-tier weekly summary
select
  tier_classification,
  count(*)                                as messages,
  round(avg(credits_used)::numeric, 2)    as avg_pistons,
  round(avg(latency_ms)::numeric, 0)      as avg_latency_ms,
  round(percentile_cont(0.95) within group (order by latency_ms)::numeric, 0) as p95_latency_ms,
  count(*) filter (where model = 'cache') as cache_hits
from advisor_messages
where role = 'assistant'
  and created_at > now() - interval '7 days'
group by tier_classification
order by tier_classification;
```

```sql
-- Grace-counter consumption by day
select
  day,
  sum(instant_used)     as instant_consumed,
  sum(marketplace_used) as marketplace_consumed,
  count(*)              as active_sessions
from advisor_grace_counters
where day > current_date - 7
group by day
order by day desc;
```

```sql
-- Piston ledger vs. monthly cap (FREE = 100, PRO = 2000)
select
  user_id,
  sum(case when type like 'ADVISOR_%' then amount else 0 end) as advisor_spent,
  count(distinct conversation_id)                             as conversations
from credits_ledger
where created_at > date_trunc('month', now())
  and type like 'ADVISOR_%'
group by user_id
order by advisor_spent desc
limit 50;
```

```sql
-- Tool-call hot spots (from observability logs — requires a log-to-db drain or
-- replacement of these joins with a `advisor_tool_calls` materialised view if
-- you decide to persist them).
-- Placeholder query shape if you populate an advisor_tool_calls table:
-- select tool_name, count(*) as calls, avg(latency_ms) as avg_latency,
--        sum(case when not tool_ok then 1 else 0 end)::float / count(*) as error_rate
-- from advisor_tool_calls
-- where ts > now() - interval '7 days'
-- group by tool_name
-- order by calls desc;
```

## Retuning checklist

When the weekly SQL report shows drift (Gemini price change, model
upgrade, tool-latency creep), work the checklist top-down:

1. **Re-price the tier.** If `avg_pistons / piston_price_usd` is
   materially above or below `actual_gemini_cost_usd + margin`, edit
   `PISTONS_BY_TIER` in `src/lib/advisor/runtime/classifier.ts` and
   update the constants in `src/lib/advisor/persistence/ledger.ts` if
   any downstream guard references the same number.
2. **Swap the model.** Bump `GEMINI_MODEL_FLASH` / `GEMINI_MODEL_PRO`
   env vars (or the default in
   `src/lib/advisor/runtime/orchestrator.ts` → `MODEL_BY_TIER`). No
   code redeploy is required for the env-var path.
3. **Tune the grace counters.** If too many users hit the wall, bump the
   daily grace from 10/2 to something like 15/3 in
   `src/lib/advisor/runtime/grace.ts`. Low friction beats low revenue
   during early rollout.
4. **Tune the tool-call budget.** If Deep-Research runs exceed the 60s
   budget too often, drop `LOOP_BUDGET` from 3 to 2 or shorten
   `TOOL_TIMEOUT_MS`. Both live at the top of
   `src/lib/advisor/runtime/orchestrator.ts`.
5. **Cache harder.** If duplicate-question rate is high, lengthen the
   LRU TTL in `src/lib/advisor/runtime/cache.ts`.
6. **Communicate.** Any piston price change is a Pistons Wallet copy
   change. Update the wallet modal strings in
   `src/components/advisor/PistonsWalletModal.tsx`.

## Red lines

- **Error rate > 5%** (observability `kind: "error"` over total turns)
  → roll back one stage in `rollout.md`.
- **p95 Instant latency > 6s for 3 consecutive days** → switch to a
  smaller Flash variant or temporarily flip `free_beta` cohort to 10%.
- **Any user exceeding 5× the monthly cap in a single week** → likely
  abuse; rate-limit at the edge before the orchestrator runs.

## Where to edit

| Concern | File | Constant / function |
|---|---|---|
| Piston price per tier | `src/lib/advisor/runtime/classifier.ts` | `PISTONS_BY_TIER` |
| Deep-research per-round surcharge | `src/lib/advisor/runtime/orchestrator.ts` | `runningCost += 10` |
| Model per tier | `src/lib/advisor/runtime/orchestrator.ts` | `MODEL_BY_TIER` |
| Deep-research loop count | `src/lib/advisor/runtime/orchestrator.ts` | `LOOP_BUDGET` |
| Tool timeout | `src/lib/advisor/runtime/orchestrator.ts` | `TOOL_TIMEOUT_MS` |
| Total budget | `src/lib/advisor/runtime/orchestrator.ts` | `TOTAL_TIMEOUT_MS` |
| Daily grace | `src/lib/advisor/runtime/grace.ts` | consts in that file |
| Cache TTL / size | `src/lib/advisor/runtime/cache.ts` | `advisorQueryCache` config |
