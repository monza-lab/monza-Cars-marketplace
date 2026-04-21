# MonzaHaus Personal Advisor — Design Spec

**Date:** 2026-04-21
**Status:** Design — pending review
**Owner:** Camilo
**Implementation planning:** To be written after approval (→ writing-plans)

---

## 1. Goal

Turn the existing rule-based advisor surfaces (the header-search Oracle overlay and the floating AdvisorChat modal) into a single AI-powered agent with deep domain knowledge, live marketplace awareness, and a credit-metered economy. The agent should feel like *the most knowledgeable Porsche agent on the internet* while remaining accessible to every visitor.

## 2. Non-goals (v1)

- Voice input
- Image-upload analysis ("what's this car worth from a photo")
- Inline charts/visualizations in messages
- Proactive push notifications
- Portfolio / watchlist intelligence (Phase 2)
- Cross-marque expansion beyond Porsche (Phase 2)

## 3. Primary jobs (ranked)

1. **Buying decision support** — a user looking at a car (or shortlist) asks: is it fair, should I buy, what to inspect, best region. Drives conversions into the existing Report flow.
2. **Open-domain Porsche expert** — free-form Q&A about models, variants, known issues, history; no specific listing required. Establishes the "most knowledgeable" claim.
3. **(Later) Portfolio / concierge** — proactive opportunity surfacing, watchlist intelligence, collection reasoning. Architecture leaves room for this; not built in v1.

## 4. Current state

Two fake-AI surfaces exist in code, both hardcoded:

- **Oracle overlay** (`src/components/layout/Header.tsx:589`, `OracleOverlay`) — triggered by the header search bar. Single-shot card. Powered by `getResponseForQuery()` (rule-based).
- **AdvisorChat** (`src/components/advisor/AdvisorChat.tsx`) — triggered by "Speak with Advisor" buttons. Multi-turn floating modal. Powered by `src/components/advisor/advisorEngine.ts` (keyword classifier + hardcoded templates).

Supporting infrastructure already present:
- `src/lib/ai/gemini.ts` — Gemini 2.5 Flash client (one-shot, no streaming / tool use yet)
- `src/lib/ai/skills/loader.ts` + `src/lib/ai/skills/listing-rewriter/SKILL.md` — working skill-loading pattern with frontmatter + references
- `src/lib/knowledge/*` — curated Porsche knowledge modules (IMS, Mezger, CoA, PPI, paint codes, rust inspection, service intervals, air/water-cooled) + registry
- `src/lib/brandConfig.ts` — 27 series with labels, year ranges, family, thesis, ownership costs, market depth
- `src/lib/reports/queries.ts` — existing credit/debit flow (`deductCredit`, `FREE_CREDITS_PER_MONTH = 3`)
- `src/hooks/useTokens.ts` — client-side balance + debit hook
- Supabase: `listings`, `vehicle_specs`, `photos_media`, `price_history`, `pricing`, `user_credits` + in-flight `20260421_add_stripe_billing_to_user_credits.sql`

## 5. Terminology — "Pistons"

User-facing currency name: **Pistons** (singular/plural same word in English, translated per locale in i18n).

**Frontend-only rename.** Internal code — tables (`user_credits`), columns (`credits_balance`), hooks (`useTokens`), variables — stays as-is to avoid churning a working billing migration. Only i18n strings and display copy say "Pistons."

**Custom icon** replaces `lucide-react` `Coins` across nav bar, wallet modal, tier pills, and low-balance banner. Icon brief: stylized piston profile (head + skirt + connecting-rod hint), monochrome, scales cleanly at 12/16/24px, restrained register consistent with MonzaHaus wordmark (Cormorant + Karla). SVG asset, one file.

## 6. Surfaces

Three surfaces, one shared agent backend, one shared conversation model.

| Surface | Entry | Container | Initial context | Handoff |
|---|---|---|---|---|
| **Oracle overlay** | Header search bar submit | Top-center overlay (existing UI) | None, or query-detected series/family | `Continue in chat →` button opens AdvisorChat with same `conversation_id` |
| **AdvisorChat** | "Speak with Advisor" button | Bottom-right floating modal (existing UI) | `car` or `make` prop | `Open full view →` routes to `/advisor/c/<id>` |
| **`/advisor` page** | Direct URL (new, owned, or shared) | Full page | Conversation loaded from DB | — |

A single `<AdvisorConversation>` component owns message list, streaming input, tool-call ghost labels, and pricing pills. Each surface is a thin container that injects conversation id + initial context.

### `/advisor` route structure

```
/[locale]/advisor                       → new conversation, empty state + suggestions
/[locale]/advisor/c/<conversation_id>   → owned conversation (auth or anonymous cookie)
/[locale]/advisor/s/<share_token>       → public read-only shared view (watermarked)
```

Left sidebar on `/advisor`: conversation list grouped by recency, search, archive. Mirrors ChatGPT/Claude UX.

### Empty-state suggestion chips

When `/advisor` opens fresh (or Oracle without pre-filled query), show dynamic suggestion chips personalized by region, tier, and recent views:
- "Compare the top 3 997.2 GT3s on sale today"
- "What's the fair value of my 964 Carrera RS?" (if user has a viewed/favorited match)
- "Biggest 992 price movers this quarter"
- "Inspection checklist for an air-cooled 911"

Each chip pre-writes a Marketplace or Deep Research query — teaches users what the agent can do.

### Mobile

- Oracle overlay: full-width below 640px
- AdvisorChat: full-screen sheet on mobile
- `/advisor`: sidebar collapses to hamburger drawer
- Deep Research toggle collapses to icon button

## 7. Agent runtime

### Request lifecycle

```
POST /api/advisor/message
  body: { conversation_id?, content, surface, initial_context? }

  1. Auth / anonymous session resolution
  2. Load conversation + compacted history
       last N turns verbatim + rolling summary of older turns
  3. classify_request(content) → { tier, estimated_pistons }
  4. Piston check
       insufficient        → 402 + upgrade CTA (no debit, no LLM call)
       daily grace applies → proceed with 0-debit flag
       sufficient          → proceed
  5. Build system prompt (skill load + locale + tier + region/currency + knowledge topic index)
  6. Build tool catalog (filter by user tier — FREE drops web_search / fetch_url)
  7. Execute tool-calling loop (streamed via SSE)
       loop_budget: 1 for FREE
       loop_budget: up to 3 for PRO Deep Research
       hard ceilings: 8 tool calls, 60s total, 10s per tool
  8. Persist: user msg + assistant msg + tool_calls summary
  9. Debit Pistons via ledger (link message_id + tier)
 10. First-turn only: async title generation (free, Flash, ~200 tokens)
```

### Model routing (Gemini-only)

| Job | Model | Reason |
|---|---|---|
| `classify_request` (every message) | `gemini-2.5-flash` | Cheap, fast, structured output |
| Title generation (once per conversation) | `gemini-2.5-flash` | Same |
| Assistant responses (Instant, Marketplace) | `gemini-2.5-flash` | Fast tool-use, streamable |
| Deep Research assistant response (PRO) | `gemini-2.5-pro` | Multi-step synthesis earns the cost |

Model IDs come from env (`GEMINI_MODEL_FLASH`, `GEMINI_MODEL_PRO`) so retuning doesn't need a deploy. Existing `src/lib/ai/gemini.ts` handles one-shot; this spec adds **streaming** (`generateContentStream`) and **function calling** as additive extensions.

### Streaming SSE event contract

| Event | UI behavior |
|---|---|
| `classified` | Tier pill on user's bubble (`Marketplace · ~5 Pistons`) |
| `tool_call_start` | Ghost label: `searching listings…` |
| `tool_call_end` | Label updates: `found 14 comps` |
| `content_delta` | Assistant bubble types out |
| `done` | Piston debit label (`-5 Pistons`); nav bar balance refreshes |
| `error` | Inline error + retry button; **no debit on failure** |

Deep Research adds a live running-cost counter during execution (Perplexity Computer pattern): `Running cost: 14 Pistons · Used get_comparables, get_regional_valuation…`.

### Guardrails

| Concern | Mitigation |
|---|---|
| Hallucinated prices / listings | System prompt forbids quoting a price or citing a listing unless it came from a tool output. Assistant numeric claims without matching `tool_result` are flagged in logs for evaluation. |
| Off-topic ("what's the best Ferrari?") | System prompt scopes to Porsche + collector-car domain; polite redirect template. |
| Raw `hammer_price` leakage | Tools never expose raw price columns. Valuation goes through `src/lib/pricing/*` (CLAUDE.md rule enforced at the data layer). |
| Tool failures | Agent sees the error, tries another tool or admits inability. **No Piston debit on failed completion.** |
| Rate abuse | 20 msgs/min/user, 50 msgs/min/IP for anonymous, duplicate-query cache (1-hour TTL) returns cached response at 0 Pistons. |
| Prompt injection via listing descriptions | Tool results wrapped in `<tool_result>` tags. System prompt instructs the model to treat tool content as data, not instructions. |
| Edit/retry of a message | Previous assistant message marked `is_superseded`; new response is a new row. **History is never mutated.** |

### Failure modes (explicit)

| Mode | Response |
|---|---|
| Insufficient Pistons | 402 + upgrade CTA. Message not sent to LLM. |
| Tool exceeds 10s / total 60s | Abort. Return partial answer if any. No debit. |
| LLM returns no content after N rounds | Fallback text: "I couldn't pull that together — try narrowing the question" |

## 8. Tool catalog (agent "skills")

Every tool has a minimum-tier field, enforced server-side in the route handler (not in the prompt). The LLM can *attempt* a Pro-only tool on a FREE user; the server refuses and returns a signal the agent surfaces as "This is a Pro capability — want to upgrade?"

### Marketplace tools

| Tool | Returns | Tier |
|---|---|---|
| `search_listings(filters)` | Ranked listings by year/series/variant/price/region/status/mileage (same engine as the browse page) | FREE |
| `get_listing(id)` | Full detail of one listing (specs, photos, description, provenance, price history) | FREE |
| `get_comparable_sales(series, variant, window)` | Sold comps from the marketplace database | FREE |
| `get_price_history(listing_id)` | Bid/price time series for a listing | FREE |
| `get_regional_valuation(series, variant)` | Fair value bands across US/EU/UK/JP via the pricing pipeline | FREE |
| `compute_price_position(listing_id)` | "This car is the Nth percentile vs its fair value band" | FREE |

### Knowledge tools (proprietary corpus)

| Tool | Returns | Tier |
|---|---|---|
| `get_series_profile(series_id)` | `brandConfig.ts` data — label, year range, family, thesis, ownership costs, market depth | FREE |
| `list_knowledge_topics()` | Index of articles in `src/lib/knowledge/` — so the agent knows what is available to consult | FREE |
| `get_knowledge_article(topic_id)` | Full text of one curated knowledge module | FREE |
| `get_variant_details(series_id, variant)` | Production numbers, option codes, chassis codes, known issues (**new corpus to author — see §13**) | FREE |
| `get_inspection_checklist(series_id, variant)` | PPI points specific to the chassis | FREE |

### Analysis / synthesis tools

| Tool | Returns | Tier |
|---|---|---|
| `assess_red_flags(listing_id)` | Cross-references the listing against known-issues knowledge for the chassis | FREE |
| `compare_listings(ids[])` | Side-by-side valuation + risk + condition digest for 2–5 cars | MARKETPLACE |
| `build_shortlist(criteria)` | Structured shortlist builder — "clean 997.2 GT3s under $250k in EU" | DEEP RESEARCH |

### Action / handoff tools

| Tool | Does | Tier |
|---|---|---|
| `trigger_report(listing_id)` | Surfaces the existing Report CTA (25 Pistons) | FREE |
| `navigate_to(route)` | Returns frontend navigation intent (frontend handles) | FREE |

### User / session tools

| Tool | Returns | Tier |
|---|---|---|
| `get_user_context()` | Tier, region, currency, Piston balance, viewed-car history | FREE |
| `get_user_watchlist()` | Saved/watched cars (Phase 2 groundwork) | FREE |

### Premium-only tools

| Tool | Does | Tier |
|---|---|---|
| `web_search(query)` | General web search (Rennlist, Classic Driver, Elferspot, forum threads) | **PRO** |
| `fetch_url(url)` | Fetch and summarize a URL the user pasted (e.g., a BaT listing they're asking about) | **PRO** |

### Meta

| Tool | Does |
|---|---|
| `classify_request(text)` | Pre-flight classifier that decides Instant / Marketplace / Deep Research; drives Piston burn rate |

## 9. Economy — Pistons

### Burn rates (proportional to real API cost)

| Operation | Approx API cost | **Pistons** |
|---|---|---|
| Instant (no tools, pretraining + system prompt) | ~$0.001 | **1** |
| Marketplace (1–2 tool calls) | ~$0.005 | **5** |
| Deep Research (multi-round, Pro model, PRO tier only) | ~$0.05–0.15 | **25** |
| Full Investment Report | ~$0.02 | **25** |

Deep Research and Report share a tier — similar complexity class, clean mental model ("anything heavy = 25 Pistons").

### Allocations

| Tier | Monthly Pistons | Daily grace (0-Piston) |
|---|---|---|
| **FREE** | **100** | 10 Instant + 2 Marketplace |
| **PRO** | **2,000** | Unlimited Instant + Marketplace |

Rationale for 100 on FREE: existing free = 3 reports/month = ~75 Pistons of value. Bumping to 100 gives 3–4 reports *or* trade-down for chat, without being stingy. Daily grace absorbs casual chat so the monthly bucket is reserved for real requests.

**Calibration note:** these numbers are estimate-based. The spec commits to retuning after 2–4 weeks of production burn data. Add a `pistons_economy.md` ops playbook describing the retune procedure.

### Daily-grace implementation

Server-side counters keyed on `user_id` (or anonymous cookie) + date. Decrement on each qualifying request. When counter hits zero, the next request of that tier starts debiting Pistons normally. Counters reset at 00:00 UTC. No UI surfacing beyond the Pistons Wallet modal (see §10).

### Duplicate-query cache

Per-user hash of `(normalized_query, tier, conversation_context_fingerprint)` → cached response, 1-hour TTL. Cache hit returns at 0 Pistons. Users hammer refresh; don't punish them.

### Transparency pattern (validated against 2026 industry norms)

Consumer chat platforms do **not** pre-announce per-message cost (ChatGPT, Claude, Gemini, Perplexity regular). Generation / agentic operations **do** show cost (Perplexity Pro Search, Perplexity Computer, Replicate, Heygen). We follow the split:

| Operation class | Disclosure |
|---|---|
| Instant + Marketplace | **Silent debit.** Post-hoc ghost label under answer (`-5 Pistons`). Nav bar balance refreshes. |
| Deep Research | **Opt-in button above input** (`○ Standard ● Deep Research (~25 Pistons)`). The button click is the confirmation — no modal. Live running-cost counter during execution (Perplexity Computer, March 2026). |
| Full Report | Existing ReportCta flow (unchanged). |

Pre-flight per-message confirmations are explicitly rejected — no consumer chat platform does them in 2026.

## 10. Pistons Wallet Modal

Clicking the existing nav bar Piston balance (today `Coins` icon + count) opens a modal, replacing the current simple flyout.

```
┌───────────────────────────────────────────────┐
│ Your Pistons                           ✕      │
├───────────────────────────────────────────────┤
│   847 Pistons              Tier: PRO          │
│   Next reset: May 21                          │
│                                               │
│ ─── Today's usage ──────────────────────      │
│   Advisor chat       22 Pistons               │
│   Oracle answers      5 Pistons               │
│   Reports            25 Pistons               │
│                                               │
│ ─── Recent debits ──────────────────────      │
│   -5  · "Is the 997.2 GT3 a good…" · chat     │
│   -25 · Deep research · "Shortlist 993s"      │
│   -1  · Oracle · "964 Carrera RS value"       │
│   …                                           │
│                                               │
│   [ Top up Pistons ]  [ View all activity ]   │
└───────────────────────────────────────────────┘
```

FREE users additionally see today's grace counter (`8/10 Instant used · 1/2 Marketplace used`) and a primary `Upgrade to PRO` CTA.

Each ledger row links to the originating conversation (`/advisor/c/<id>`) so users can re-read what they paid for. Best anti-refund tool available.

## 11. Persistence schema

### `advisor_conversations`

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid` pk | `/advisor/c/<id>` route param |
| `user_id` | `uuid` fk → `auth.users`, nullable | NULL for anonymous sessions |
| `anonymous_session_id` | `text`, nullable | Client cookie; merged into `user_id` on sign-up |
| `title` | `text` | Auto-generated from first turn; user-editable |
| `surface` | `text` | `'oracle'` \| `'chat'` \| `'page'` |
| `initial_context_listing_id` | `text`, nullable | If launched from a car page |
| `initial_context_series_id` | `text`, nullable | If launched from a family |
| `locale` | `text` | `'en'` / `'de'` / `'es'` / `'ja'` |
| `share_token` | `text` unique, nullable | Opaque token for `/advisor/s/<token>` public view |
| `is_archived` | `bool` default false | Soft delete |
| `created_at` / `updated_at` / `last_message_at` | `timestamptz` | Sort + list UX |

### `advisor_messages`

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid` pk | |
| `conversation_id` | `uuid` fk → `advisor_conversations` | |
| `role` | `text` | `'user'` \| `'assistant'` \| `'tool'` |
| `content` | `text` | Message body |
| `tool_calls` | `jsonb`, nullable | `[{name, args, result_summary}]` — **summary only (≤500 chars each)**, not full results |
| `tier_classification` | `text`, nullable | `'instant'` \| `'marketplace'` \| `'deep_research'` — assistant only |
| `credits_used` | `int` default 0 | Assistant only. Column is `credits_used` to match internal naming (§5); UI displays the value as "Pistons". |
| `latency_ms` | `int`, nullable | Observability |
| `model` | `text`, nullable | `'gemini-2.5-flash'` / `'gemini-2.5-pro'` — for per-model analytics |
| `is_superseded` | `bool` default false | Edit/retry handling |
| `created_at` | `timestamptz` | Message order |

### Piston ledger

**Decision:** extend `user_credits` (the existing table) rather than create a new ledger table. Add columns and/or a companion `user_credits_ledger` if the existing schema doesn't already track per-event debits at sufficient granularity.

Columns to ensure present on the ledger:
- `user_id` (or `anonymous_session_id`)
- `amount` (negative for debit, positive for credit)
- `reason` — `'advisor.instant'` / `'advisor.marketplace'` / `'advisor.deep_research'` / `'report'` / `'grant.monthly'` / `'grant.signup'` / `'topup'` / `'refund'`
- `conversation_id` (nullable fk)
- `message_id` (nullable fk)
- `created_at`

Implementation details deferred to the plan (writing-plans) since the existing `20260421_add_stripe_billing_to_user_credits.sql` migration shape may already cover part of this.

### RLS policies

- **`advisor_conversations`** — user can CRUD rows where `user_id = auth.uid()`. Anonymous sessions can CRUD rows where `anonymous_session_id = <cookie>` (verified via a **signed HTTP-only cookie** set on first visit; secret lives in env, signature checked in the route handler before DB access). Public can READ rows where `share_token IS NOT NULL AND share_token = <requested> AND is_archived = false`.
- **`advisor_messages`** — inherit read/write from parent conversation.
- **`user_credits` ledger rows** — read-only for owner; writes only from server-side route handlers (service role).

### Anonymous → authenticated merge

On sign-up, a transactional update sets `user_id = <new user>` and clears `anonymous_session_id` for all rows matching the cookie. User walks in with their full conversation history.

### Shared view

- `/advisor/s/<share_token>` is a server-rendered read-only page
- Watermarked: "Shared conversation — market data is current, prices at time of writing may be stale"
- Share token is opaque (random 16-char base32), rotatable/revocable via the conversation owner's UI
- Archived conversations return 404 on the share URL

### Context compaction

Long conversations: keep last N turns verbatim in the LLM context + a rolling LLM-generated summary of older turns. The user-visible transcript in the UI is always the full history pulled from Supabase (no summarization surfaced to user).

## 12. System prompt — reuses existing SKILL pattern

Leverages `src/lib/ai/skills/loader.ts` (already used by `listing-rewriter`).

```
src/lib/ai/skills/advisor/
├── SKILL.md                           ← main personality + system instruction
└── references/
    ├── voice-and-tone.md              ← editable voice guide (Monza register)
    ├── knowledge-usage-protocol.md    ← rules for citing tools, never inventing
    ├── safety-and-scope.md            ← off-topic redirects, hallucination guards
    ├── locale-handling.md             ← en/de/es/ja register differences
    ├── deep-research-overlay.md       ← appended only in Deep Research mode
    └── oracle-single-shot-overlay.md  ← appended only when invoked from Oracle
```

Loader extension required: add optional `kind: chat` frontmatter key to `SKILL.md` that skips the existing `# User Prompt Template` requirement (chat messages flow in directly, not via a template). One-line change in `loader.ts`.

All personality, voice, and safety tuning happens in these MD files — no code change to evolve the agent's voice.

## 13. Knowledge corpus — growth plan

"Most knowledgeable Porsche agent" is a content claim, not just a tooling one. Current `src/lib/knowledge/` is the seed; the corpus needs active authoring. In scope for this project (can be staged):

### Phase A (launch)
- `get_variant_details` data for every series in `brandConfig.ts` — production numbers, option codes, chassis codes, date ranges, paint/interior codes, known issues. Sourced from existing authoritative references (Porsche VIN lookups, factory records). Authored by a domain owner, reviewed, committed as structured data (not free-form markdown).
- Expand `src/lib/knowledge/` modules from the current 8 to at least 15 covering: DFI transition, M96/M97 bore-score, air-box liners, GT3 crankshaft issues by year, Tiptronic behavior, PDK history, Macan diesel pitfalls, Cayenne V8 chain tensioner.

### Phase B (weeks 2–6 post-launch)
- Forum-thread distillations: IMS era FAQs, Mezger maintenance wisdom, PPI red flags by platform. Authored or curated — not auto-scraped.
- Per-chassis cost-of-ownership enrichment beyond `brandConfig.ts` baselines.

### Phase C (continuous)
- Quarterly review: what questions did the agent fail to answer well? (log analysis). Close the loop by authoring the missing article.

**Forbidden shortcut:** scraping forum content directly into `get_knowledge_article` responses. Creates legal exposure and poisons the "curated" trust claim. Web search (`web_search` tool, PRO-only) is the vehicle for forum content — always cited inline, never silently blended.

## 14. i18n

The advisor must respond in the user's locale. The existing `advisorLanguage.ts` does keyword-based detection — this is kept for display strings (tier pills, quick-action labels) but **the LLM handles response language natively** via the `{{locale}}` template variable in the system prompt.

Supported for v1: **en, de, es, ja** (matches existing `/[locale]/` routing and locale-handling.md in listing-rewriter).

## 15. Observability

Every request logs (in order of importance):
1. Classification (request text → tier) — for retune accuracy
2. Tool call trace (names, args, latency, success/fail)
3. Pistons debited + reason
4. Full response text (hashed) — for hallucination evaluation without storing PII
5. Loop-round count
6. Model used
7. User tier + region

Dashboards to build:
- Daily / weekly: requests by tier, avg Pistons per request, grace-quota usage %
- Tool success rate (per tool)
- Upgrade conversion funnel (FREE user hits paywall → upgrades)
- Hallucination flag rate (numeric claims without matching tool_result)

## 16. Rollout plan

1. **Internal alpha** — `/advisor` route gated by feature flag, team-only. Prompt tuning, tool accuracy shakeout.
2. **FREE-only beta** — remove flag for FREE tier on Oracle surface only. No AdvisorChat change yet. 1 week of burn-rate calibration.
3. **Full FREE rollout** — Oracle + AdvisorChat + `/advisor` page live for all FREE users. Keep PRO features flagged.
4. **PRO launch** — Deep Research toggle + `web_search` + `fetch_url` enabled for PRO subscribers.
5. **Retune** — 2–4 weeks post-PRO-launch, rebalance Piston burn rates based on real cost data per `pistons_economy.md`.

## 17. Open questions / deferred decisions

- Exact `user_credits` migration shape — depends on final form of the in-flight Stripe billing migration. Resolved in the plan.
- Piston icon asset — to be designed / commissioned before launch.
- `web_search` implementation — Tavily / Brave / SerpAPI vs Google Custom Search. Benchmark before launch.
- Whether to expose an Anthropic / Claude fallback for specific tool chains. **Current decision: no — Gemini-only** per product direction.
- Whether to persist full tool-call results for debugging (vs only summaries). Start with summaries; escalate only if debugging friction appears.

## 18. Out of scope — explicit

- Multi-car comparison beyond `compare_listings(ids[])` (e.g., "compare these 20 cars")
- Automated watchlist alerts
- Collection / portfolio reasoning
- Ferrari / BMW / other marques (corpus-gated; architecture stays open)
- Voice, image, file upload
- Mobile app integration (web only for v1)

## 19. Success criteria

- **FREE user engagement:** ≥30% of active FREE users ask the advisor at least one question per month within 60 days of launch
- **Upgrade lift:** ≥5% of FREE advisor users hit the Deep Research upgrade prompt and convert to PRO within 60 days
- **Hallucination rate:** <1% of assistant messages flagged for numeric claims without tool_result citation
- **Latency:** p50 time-to-first-token <1.5s for Instant, <3s for Marketplace
- **Tool success rate:** >95% across all FREE-tier tools

## 20. Implementation handoff

On approval of this spec, the next step is invoking the `superpowers:writing-plans` skill to produce a sequenced implementation plan with milestones, dependencies, and verification steps. The plan will address:

- Phase sequencing (runtime → surfaces → Pistons → corpus)
- Database migration ordering around `20260421_add_stripe_billing_to_user_credits.sql`
- Skill loader extension for `kind: chat`
- Streaming + function-calling additions to `src/lib/ai/gemini.ts`
- Oracle overlay and AdvisorChat refactors to use the shared `<AdvisorConversation>` component
- Piston icon asset creation
- Knowledge corpus authoring pipeline
