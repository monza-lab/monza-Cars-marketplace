# AI Listing Rewriter — Editorial Hook per Locale

**Date:** 2026-04-21
**Status:** Draft — pending user review
**Owner:** Camilo / Monza Haus
**Related:** `2026-04-19-fair-value-signal-extraction-design.md` (Haus Report; future prose-description integration lives there)

---

## 1. Problem

Today the listing detail page shows a card titled **"Über dieses Fahrzeug" / "About this car"** whose body is a generic placeholder (e.g. *"Live auction listing from Be Forward"*). Below it, the **"Seller's Description"** section renders the raw `description_text` scraped from the source marketplace (BaT, Cars & Bids, AutoScout24, Be Forward, …) verbatim, in whichever language the source posted it.

Two problems follow:

1. **Verbatim source copy.** Republishing scraped seller prose puts us in a weak legal and SEO position — it is other marketplaces' content, word-for-word, indexed by our domain.
2. **No locale-aware editorial voice.** A Spanish-speaking user opening a Be Forward listing gets English text; a German user opening a BaT listing gets English prose. Nothing Monza-authored guides the user on *why this car matters*.

Both problems compound: the placeholder card that *should* carry the editorial hook is empty, and the only descriptive text is foreign-language source copy.

## 2. Goal

Fill the "About this car" card with an **editorial, locale-aware hook** — AI-generated, grounded only in real data (scraped description + structured DB columns), never republishing the source verbatim. The hook is two pieces:

- `headline` — one sentence positioning the car ("what this is, why it matters")
- `highlights` — 2–5 compact bullets surfacing the specific facts a collector cares about first

Render these in the user's current locale (`en`, `es`, `de`, `ja`). The existing "Seller's Description" section continues to show the raw source text unchanged — as a transparency/trust layer one scroll away.

## 3. Scope

### In scope
- SKILL-package prompt authoring (Anthropic Skill folder layout).
- On-demand generation with Supabase cache keyed by `(listing_id, locale)`.
- Gemini 2.5 Flash structured JSON output via `responseSchema`.
- New API route `/api/listings/[id]/rewrite?locale=…`.
- New UI component `<ListingHook />` rendered inside the existing "Über dieses Fahrzeug" card in `CarDetailClient.tsx`.
- Failure fallback to the current placeholder (feature is purely additive — no regression path).
- Rate limiting on the API route to prevent unauthenticated Gemini-call abuse.

### Out of scope (deferred)
- **Full prose `description`**. Will be added when the Haus Report integration lands; the schema and prompt are designed to extend cleanly (one field added, one prompt edit, one `prompt_version` bump to invalidate the cache).
- **Pre-generation / backfill**. MVP is lazy-only. A follow-up script can warm the cache by iterating over active listings per locale once we see real traffic patterns.
- **Per-highlight categorization / icons**. If useful later, this is a deterministic TS post-processor (regex/keyword → icon), not an AI-generation concern.
- **Red flags / concerns**. Already handled by the existing `dbAnalysis` path; do not duplicate.
- **Migration to `@google/genai`** (the newer SDK that uses `responseJsonSchema`). Current SDK `@google/generative-ai@0.24.1` supports everything we need via `responseSchema`.

## 4. Architecture

Five small, well-bounded units. Each has one purpose, a narrow public interface, and minimal knowledge of the others.

```
                         ┌────────────────────────┐
 CarDetailClient ──GET──▶│  API route             │
 (browser)               │  /api/listings/[id]/   │
                         │  rewrite?locale=xx     │
                         └───────────┬────────────┘
                                     │
                                     ▼
                         ┌────────────────────────┐
                         │  Rewriter service      │
                         │  src/lib/ai/           │
                         │  listingRewriter.ts    │
                         └──┬─────────────────┬───┘
                            │                 │
                 cache hit  │                 │  cache miss
                            │                 │
                            ▼                 ▼
                ┌───────────────────┐   ┌────────────────────┐
                │ listing_          │   │ Skill loader       │
                │ translations      │   │ src/lib/ai/skills/ │
                │ (Supabase)        │   │ loader.ts          │
                └───────────────────┘   └─────────┬──────────┘
                                                  │
                                                  ▼
                                        ┌────────────────────┐
                                        │ Gemini client      │
                                        │ (existing          │
                                        │ generateJson)      │
                                        └────────────────────┘
```

### 4.1 Skill package

Path: `src/lib/ai/skills/listing-rewriter/`

Anthropic Skill folder layout. Pure files, no TS:

```
listing-rewriter/
  SKILL.md              # YAML frontmatter + system instruction + user-prompt template
  references/
    tone-guide.md       # editorial voice, anti-paraphrase rules, "no invention"
    locale-notes.md     # per-locale tone (usted vs tú for es, formal register for ja, …)
    examples.md         # 2–3 few-shot input→output pairs
    output-schema.md    # human-readable mirror of the JSON schema
```

`SKILL.md` shape:

```markdown
---
name: listing-rewriter
description: Generate editorial headline + highlights for a vehicle listing in a target locale.
version: 1.0.0
model: gemini-2.5-flash
temperature: 0.3
references:
  - tone-guide.md
  - locale-notes.md
  - examples.md
  - output-schema.md
---

# System Instruction

You are an editorial writer for Monza Haus. Generate a structured editorial hook for a single vehicle listing. Follow the rules in the referenced files (tone, locale notes, anti-paraphrase constraints, output schema). The full system prompt body is authored during implementation following the rules specified in §6 of this spec.

# User Prompt Template

Locale: {{locale}}
Listing ID: {{listing_id}}

Known facts:
- Year: {{year}}
- Make: {{make}}
- Model: {{model}}
- Trim: {{trim}}
- Mileage: {{mileage}} {{mileage_unit}}
- VIN: {{vin}}
- Exterior colour: {{color_exterior}}
- Interior colour: {{color_interior}}
- Engine: {{engine}}
- Transmission: {{transmission}}
- Body style: {{body_style}}
- Location: {{location}}
- Source platform: {{platform}}

Seller's original description (may be sparse, may be verbose, may be in any language — do NOT paraphrase or translate this verbatim; use it only as factual input):

"""
{{description_text}}
"""

Write the JSON response now.
```

### 4.2 Skill loader

Path: `src/lib/ai/skills/loader.ts`

One function, zero knowledge of listings or Gemini:

```ts
export interface LoadedSkill {
  name: string
  version: string
  model: string
  temperature: number
  systemPrompt: string     // body before "# User Prompt Template", with references appended
  userPromptTemplate: string  // body after "# User Prompt Template"
}

export function loadSkill(name: string): LoadedSkill
```

Behaviour:
1. Reads `src/lib/ai/skills/${name}/SKILL.md`.
2. Parses YAML frontmatter (use `gray-matter`, already transitively available, or a small inline parser).
3. Splits body at the `# User Prompt Template` heading. Everything before = system prompt body. Everything after = user-prompt template.
4. Appends each file listed in `frontmatter.references` (relative to the skill directory) to the system prompt, each under a `## Reference: <filename>` heading.
5. Caches the result in a module-level `Map<string, LoadedSkill>` after first read (we only reload on server restart; if a dev changes the skill file, they restart the dev server — acceptable).

Return type contains `version`, which the caller uses as `prompt_version` for cache invalidation.

### 4.3 Rewriter service

Path: `src/lib/ai/listingRewriter.ts`

One function:

```ts
interface RewriterInput {
  listingId: string
  locale: "en" | "es" | "de" | "ja"
  source: {
    description_text: string | null
    year: number
    make: string
    model: string
    trim: string | null
    mileage: number | null
    mileage_unit: "mi" | "km" | null
    vin: string | null
    color_exterior: string | null
    color_interior: string | null
    engine: string | null
    transmission: string | null
    body_style: string | null
    location: string | null
    platform: string | null
  }
}

interface RewriteOutput {
  headline: string
  highlights: string[]
  promptVersion: string
  model: string
  sourceHash: string
  generatedAt: string
}

export async function rewriteListing(input: RewriterInput): Promise<RewriteOutput | null>
```

Pipeline:
1. **Normalize + hash.** Build a canonical object from every field in `input.source` (stable key order, null-normalized). Compute `sha256(JSON.stringify(canonical))`. This is `sourceHash` — locale-independent, because the *source data* for a given listing doesn't depend on locale. The cache rows are already separated per locale by the `(listing_id, locale)` primary key; if the source changes, every locale row's `source_hash` flips together, invalidating all of them at once.
2. **Load skill.** `loadSkill("listing-rewriter")` → `{ systemPrompt, userPromptTemplate, version, model, temperature }`.
3. **Cache check.** `SELECT * FROM listing_translations WHERE listing_id = $1 AND locale = $2`. If row exists AND `row.source_hash === sourceHash` AND `row.prompt_version === skill.version` AND `row.model === skill.model` → return existing row as `RewriteOutput`.
4. **Render prompt.** Substitute `{{placeholders}}` in `userPromptTemplate` with `input.source` values. Use `—` for null fields (signals "unknown" to the model). Leave `{{description_text}}` literal even if null — the prompt template explicitly tells the model that field may be empty.
5. **Call Gemini.** Use extended `generateJson` (see §4.5) with `systemPrompt`, `userPrompt`, `temperature` from frontmatter, and the `responseSchema` from §5.
6. **Validate.** Confirm the returned object matches the schema at runtime (non-empty `headline`, `highlights` length 2–5, every element non-empty string ≤180 chars). On schema violation → log and return `null`.
7. **Upsert.** `INSERT ... ON CONFLICT (listing_id, locale) DO UPDATE` with new fields.
8. **Return** the `RewriteOutput`.

Any throw anywhere in the pipeline → caught, logged, `return null`. The API route translates `null` into a 204 so the client falls back to the placeholder.

### 4.4 Cache table

New migration: `supabase/migrations/20260421_create_listing_translations.sql`

```sql
create table public.listing_translations (
  listing_id      text         not null,
  locale          text         not null,
  headline        text         not null,
  highlights      jsonb        not null,
  source_hash     text         not null,
  prompt_version  text         not null,
  model           text         not null,
  generated_at    timestamptz  not null default now(),
  primary key (listing_id, locale),
  constraint listing_translations_locale_chk
    check (locale in ('en','es','de','ja')),
  constraint listing_translations_highlights_chk
    check (jsonb_typeof(highlights) = 'array')
);

create index listing_translations_listing_idx
  on public.listing_translations (listing_id);

-- RLS: read-only for anon, writes only via service role
alter table public.listing_translations enable row level security;

create policy "listing_translations_read_all"
  on public.listing_translations
  for select
  using (true);
```

Writes go through the service-role client (same pattern used elsewhere in the codebase); no write policy is exposed to `anon`.

Invalidation triggers — any of these cause the cached row to be ignored and regenerated on next request:
- `source_hash` mismatch (source description changed, or any structured field changed).
- `prompt_version` mismatch (SKILL.md or any referenced file was edited and the version bumped).
- `model` mismatch (we upgrade Gemini model tier).

### 4.5 Gemini client extension

Extend `src/lib/ai/gemini.ts`. The existing `generateJson<T>` does not accept `responseSchema`; we add it as an optional option:

```ts
interface GenerateJsonOptions {
  systemPrompt?: string
  userPrompt: string
  temperature?: number
  maxOutputTokens?: number
  responseSchema?: Schema   // NEW — uses SchemaType from @google/generative-ai
}
```

Implementation change: when `responseSchema` is provided, pass it into `generationConfig` alongside `responseMimeType: "application/json"`. No other callers of `generateJson` are affected because the field is optional.

`Schema` here is the type from `@google/generative-ai` 0.24.x: a recursive `{ type: SchemaType, properties?, items?, required?, enum?, description?, minItems?, maxItems? }`. This is the older-SDK equivalent of the `responseJsonSchema` raw-JSON-Schema path described in Google's structured-output doc — same semantics (types, required, items, minItems/maxItems, description), encoded with a `SchemaType` enum instead of raw strings.

### 4.6 API route

Path: `src/app/api/listings/[id]/rewrite/route.ts`

```
GET /api/listings/:id/rewrite?locale=es
```

Request:
- `id` path param — Supabase listing id (the `live-*` or `curated-*` prefixed id is stripped server-side to match the DB).
- `locale` query param — validated against the four supported locales; invalid → 400.

Response:
- `200 { headline, highlights }` on success (cache hit or fresh generation).
- `204 No Content` when generation fails or produces null; client renders placeholder.
- `400` for bad locale or missing id.
- `404` when the listing id does not exist in Supabase.
- `429` when rate-limited.

Rate limiting: in-memory sliding-window bucket, 10 requests per IP per minute. This is enough to let a user browse multiple listings normally, but stops a script from running us up a Gemini bill. (If we later add authenticated rate limits, we move this per-user.)

Source loading: the route queries Supabase for the minimum fields the rewriter needs (the `RewriterInput["source"]` shape). For curated (non-Supabase) listings we short-circuit and return 204 — curated entries already carry human-authored copy and do not need AI rewriting in MVP.

### 4.7 UI component

New component: `src/components/detail/ListingHook.tsx`

```tsx
interface ListingHookProps { listingId: string }

export function ListingHook({ listingId }: ListingHookProps) {
  const locale = useLocale()
  const { data, isLoading } = useListingRewrite(listingId, locale)

  if (isLoading) return <ListingHookSkeleton />
  if (!data) return null   // parent renders existing placeholder

  return (
    <div>
      <p className="text-[14px] leading-relaxed text-foreground italic">{data.headline}</p>
      {data.highlights.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {data.highlights.map((h, i) => (
            <li key={i} className="text-[13px] text-muted-foreground flex gap-2">
              <span className="text-primary">•</span><span>{h}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Integration in `CarDetailClient.tsx`: inside the existing "Über dieses Fahrzeug" card, replace the placeholder text node with:

```tsx
<ListingHook listingId={car.id}>
  <p>{placeholderCopy}</p>   {/* rendered as fallback when ListingHook returns null */}
</ListingHook>
```

(The component accepts a child/fallback slot, or the parent checks a returned state — the simplest version is: `ListingHook` renders null on failure, and the parent renders placeholder copy adjacent to it behind a conditional keyed on the same fetch result. Exact composition is an implementation detail; the spec requires that failure is indistinguishable from today's UX.)

Keep the existing "Editorial" badge on the card — it correctly signals this is Monza's editorial take, not scraped copy. Everything else on the detail page (photos, specs, investment report CTA, seller's description, valuations, market position) is untouched.

## 5. Gemini structured-output schema

The `responseSchema` passed on each call (encoded via `@google/generative-ai`'s `SchemaType` enum):

```ts
import { SchemaType, type Schema } from "@google/generative-ai"

const listingHookSchema: Schema = {
  type: SchemaType.OBJECT,
  description:
    "Editorial hook for a single vehicle listing, in the target locale. " +
    "All strings must be written in the locale provided by the user prompt. " +
    "Do not invent facts. Do not paraphrase the seller's original description verbatim.",
  properties: {
    headline: {
      type: SchemaType.STRING,
      description:
        "One sentence (12–28 words) positioning this specific car: what it is, why a collector would care. " +
        "Grounded only in the known facts and the seller description provided. " +
        "No hype, no generic filler ('amazing opportunity', 'must see'). " +
        "No verbatim phrases longer than 4 words from the seller description.",
    },
    highlights: {
      type: SchemaType.ARRAY,
      minItems: 2,
      maxItems: 5,
      description:
        "Between 2 and 5 concise bullets surfacing the most collector-relevant facts. " +
        "Each bullet: one short clause, ≤180 characters, factual, no hype. " +
        "Prefer provenance, originality, service history, rare options, and condition " +
        "specifics over generic praise. " +
        "If the seller description is sparse, produce fewer bullets grounded in structured facts " +
        "(year, model, mileage, colour combo, transmission) rather than padding with filler. " +
        "Never include bullets that are not supported by the input.",
      items: {
        type: SchemaType.STRING,
        description: "One highlight bullet, in the target locale.",
      },
    },
  },
  required: ["headline", "highlights"],
}
```

Call-site configuration:

```ts
generationConfig: {
  temperature: 0.3,                  // from SKILL frontmatter
  maxOutputTokens: 600,              // headline + 5 bullets + JSON overhead fits comfortably
  responseMimeType: "application/json",
  responseSchema: listingHookSchema,
}
```

Validation after the call (belt-and-braces — Gemini guarantees syntactic JSON and schema shape, but not semantic correctness):
- `typeof data.headline === "string"` and trimmed length 20–240 chars.
- `Array.isArray(data.highlights)` and length between 2 and 5.
- Every element a trimmed, non-empty string ≤240 chars.
- Reject the response on any failure. Log and return `null`.

## 6. Prompt design (anti-paraphrase + anti-invention)

The system prompt, assembled from `SKILL.md` body + referenced files, must enforce three hard rules:

1. **No invention.** "Every claim in your output must be supported by either the structured facts or the seller description. If a fact is not in the inputs, do not write it. Do not estimate, do not generalize from the model name."
2. **No verbatim republishing.** "You are writing an editorial hook. You may use the seller description as factual input. You must not reuse any sentence from the seller description. You must not reuse any phrase longer than four consecutive words from the seller description. Rewrite in your own words."
3. **No hype vocabulary.** Banned phrase list in the tone guide: *stunning, incredible, must-see, rare opportunity, once-in-a-lifetime, pristine, immaculate, breathtaking, show-stopping*. Measured, specific, collector-vernacular voice only.

Locale notes (`references/locale-notes.md`) cover tone register per locale:
- `es` — neutral Latin American Spanish, default to `usted` (marketplace register), avoid regionalisms.
- `de` — formal (`Sie`), Porsche buyer vocabulary (Werksangaben, Erstauslieferung, Originalzustand).
- `ja` — desu/masu form, avoid casual sentence endings; use expected collector vocabulary (純正, ワンオーナー, 記録簿完備).
- `en` — auction-catalogue register (think RM Sotheby's, not dealer ad).

Few-shot examples (`references/examples.md`) carry 2–3 worked cases covering: rich BaT source, sparse AS24 source, and non-English source — each showing the expected output JSON in one target locale. Few-shots materially lift output quality on Flash-tier models.

## 7. Failure modes and fallbacks

| Failure | Detection | User-visible result |
|---|---|---|
| Gemini API error (5xx, quota, timeout) | try/catch around `generateJson` | 204 → placeholder copy in the card |
| Model returns schema-valid but semantically bad JSON (empty headline, 0 highlights, wall of hype) | post-generation validator in §5 | 204 → placeholder |
| `GEMINI_API_KEY` unset | `generateJson` returns `{ ok: false }` | 204 → placeholder (no retry loop) |
| DB write fails | try/catch around upsert | Log; still return the generated payload to the client (one miss next time, not worse) |
| Listing id not found | `select` returns zero rows | 404 |
| Invalid locale | query-param validator | 400 |
| Rate-limited | in-memory bucket | 429 (client can retry on next visit) |

Every failure mode produces the same UX as today (placeholder shown). The feature can **only improve**, never degrade, what the user sees.

## 8. Observability

Lightweight logging — no new telemetry infrastructure:

- Structured `console.log` in the rewriter service on every path: `{ event: "rewrite_cache_hit" | "rewrite_generated" | "rewrite_failed", listing_id, locale, duration_ms, reason? }`.
- Rate-limit hits logged at `warn`.
- Existing Vercel request logs capture the API route's status codes — we can eyeball 204/429/5xx rates from there.

Cost ceiling: Gemini 2.5 Flash is ~\$0.075 per 1M input tokens and \$0.30 per 1M output tokens. Per-rewrite envelope ≈ 800 input + 300 output tokens ≈ \$0.00015. 10,000 first-views × 4 locales × \$0.00015 = \$6 worst case for the full catalogue across all locales. Negligible; no hard budget gate needed in MVP.

## 9. Testing strategy

- **Unit — skill loader** (`loader.test.ts`): frontmatter parsing, body split, reference concatenation, caching.
- **Unit — rewriter** (`listingRewriter.test.ts`): with `generateJson` mocked to return a fixture, assert cache hit/miss logic, hash stability across field order, schema-validator rejection paths, null-on-failure behaviour.
- **Unit — source-hash** (in the same file): confirm equivalent inputs hash identically and any field change flips the hash.
- **Integration — API route** (`route.test.ts`): valid locale → 200 with payload; unknown listing → 404; invalid locale → 400; rate-limited IP → 429; rewriter returning null → 204.
- **Manual QA — detail page** across all four locales on three representative listings (rich BaT, sparse AS24, non-English Be Forward). Verify (a) output language matches locale, (b) no verbatim copy from source, (c) placeholder shown when `GEMINI_API_KEY` is unset (simulates outage).

Fixture JSON responses for the integration tests live under `src/lib/ai/__fixtures__/listing-rewriter-<scenario>.json`, following the existing pattern used for `gemini-signals-*.json`.

## 10. Rollout

1. Ship migration for `listing_translations`.
2. Ship code behind env flag `LISTING_REWRITER_ENABLED` (default `false`). Deploy dark.
3. Enable in staging; manually QA across four locales.
4. Enable in production for a single locale first (`en`), observe for 48h.
5. Enable remaining locales one at a time, 24h between each, watching Gemini error rate in logs.
6. Remove the flag once stable.

## 11. Follow-ups (not in this spec)

- **Full prose `description` field** — to be generated in the same call once the Haus Report integration needs it. Schema add-only, prompt-version bump.
- **Backfill / warm-cache script** — iterate active listings × locales, cap concurrency, respect Gemini quota. Runs as cron or manual admin trigger.
- **Per-highlight icons / categorization** — deterministic TS post-processor reading the highlight text and assigning an icon from the existing lucide-react vocabulary (`Shield`, `Wrench`, `Gauge`, `History`). No AI cost.
- **Migration to `@google/genai`** — adopt `responseJsonSchema` (raw JSON Schema) and the newer SDK surface. Independent of this feature; when it happens, this rewriter's schema is trivial to port.
- **Authenticated rate limits** — replace the in-memory per-IP bucket with a per-user Supabase-backed quota once auth is required to view detail pages.
