# AI Listing Rewriter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate an editorial, locale-aware hook (headline + 2–5 highlights) for every vehicle listing, cached per `(listing_id, locale)`, rendered inside the existing "Über dieses Fahrzeug" card on the detail page — replacing the placeholder copy and avoiding any republishing of scraped source text verbatim.

**Architecture:** On-demand Gemini 2.5 Flash generation behind a Supabase cache. Five small units: DB cache table → skill loader → Gemini client extension → rewriter service → API route → React hook + UI component. Feature is purely additive — failure falls back to today's placeholder UX. Prompt lives in an Anthropic Skill folder (`SKILL.md` + references) so it is version-controlled and prompt edits auto-invalidate the cache via a frontmatter version bump.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind · next-intl · Supabase (Postgres + RLS) · `@google/generative-ai@0.24.1` (`SchemaType`-based `responseSchema`) · Vitest.

**Reference spec:** `docs/superpowers/specs/2026-04-21-ai-listing-rewriter-design.md`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260421_create_listing_translations.sql` | Create | Cache table + RLS + index |
| `src/lib/ai/gemini.ts` | Modify | Add optional `responseSchema` to `generateJson` |
| `src/lib/ai/gemini.test.ts` | Modify | Add tests for new `responseSchema` option |
| `src/lib/ai/skills/loader.ts` | Create | Load + parse `SKILL.md` + concat reference files + cache |
| `src/lib/ai/skills/loader.test.ts` | Create | Unit tests for loader |
| `src/lib/ai/skills/listing-rewriter/SKILL.md` | Create | Frontmatter + system prompt + user-prompt template |
| `src/lib/ai/skills/listing-rewriter/references/tone-guide.md` | Create | Editorial voice rules + banned-hype list + anti-paraphrase rule |
| `src/lib/ai/skills/listing-rewriter/references/locale-notes.md` | Create | Per-locale tone (en, es, de, ja) |
| `src/lib/ai/skills/listing-rewriter/references/examples.md` | Create | Few-shot input→output pairs |
| `src/lib/ai/skills/listing-rewriter/references/output-schema.md` | Create | Human-readable mirror of JSON schema |
| `src/lib/ai/sourceHash.ts` | Create | Stable canonicalization + sha256 |
| `src/lib/ai/sourceHash.test.ts` | Create | Tests for hash stability |
| `src/lib/ai/listingRewriter.ts` | Create | Rewriter service (pipeline: hash → cache → generate → validate → upsert) |
| `src/lib/ai/listingRewriter.test.ts` | Create | Rewriter unit tests |
| `src/lib/ai/__fixtures__/listing-rewriter-rich.json` | Create | Gemini response fixture (rich source) |
| `src/lib/rateLimit.ts` | Create | In-memory sliding-window per-IP limiter |
| `src/lib/rateLimit.test.ts` | Create | Rate-limiter tests |
| `src/app/api/listings/[id]/rewrite/route.ts` | Create | `GET` endpoint, rate-limit, source load, orchestration |
| `src/app/api/listings/[id]/rewrite/route.test.ts` | Create | Route integration tests |
| `src/hooks/useListingRewrite.ts` | Create | Client-side fetcher with loading/null state |
| `src/components/detail/ListingHook.tsx` | Create | Presentational component for headline + bullets |
| `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx` | Modify | Wire `<ListingHook />` into the existing "Über dieses Fahrzeug" card with placeholder fallback |
| `.env.example` | Modify | Document `LISTING_REWRITER_ENABLED` and reaffirm `GEMINI_API_KEY` |

**Conventions confirmed by exploration:**
- Vitest with co-located `.test.ts` files. Mock via `vi.mock(...)`. Env via `vi.stubEnv(...)`.
- Supabase access uses `SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY` falling back to anon.
- `live-*` listing IDs drop the prefix (`.slice(5)`) before hitting the DB.
- API routes export `async function GET(request: Request)` and return `NextResponse.json`.

---

## Task 1: DB migration — `listing_translations` cache table

**Files:**
- Create: `supabase/migrations/20260421_create_listing_translations.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 20260421_create_listing_translations.sql
-- AI-generated editorial hook per (listing_id, locale).
-- See docs/superpowers/specs/2026-04-21-ai-listing-rewriter-design.md

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

alter table public.listing_translations enable row level security;

create policy "listing_translations_read_all"
  on public.listing_translations
  for select
  using (true);

-- No insert/update/delete policy: writes only via service-role key (bypasses RLS).
```

- [ ] **Step 2: Verify the migration SQL parses**

Run: `grep -c "create table public.listing_translations" supabase/migrations/20260421_create_listing_translations.sql`
Expected: `1`

(The project applies migrations via its normal Supabase workflow; no local `supabase db push` required in this plan. If the engineer is running a local Supabase stack, they can apply it there for confidence, but CI-level validation happens when the migration is merged and deployed.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260421_create_listing_translations.sql
git commit -m "feat(listings): add listing_translations cache table for AI rewrites"
```

---

## Task 2: Extend `generateJson` with optional `responseSchema`

**Files:**
- Modify: `src/lib/ai/gemini.ts`
- Modify: `src/lib/ai/gemini.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/ai/gemini.test.ts`:

```ts
import { SchemaType } from "@google/generative-ai"

describe("generateJson responseSchema", () => {
  it("passes responseSchema to generationConfig when provided", async () => {
    const capturedConfig: Array<unknown> = []
    mockGenerateContent.mockImplementationOnce(async (_: unknown) => {
      return { response: { text: () => '{"ok":true}' } }
    })

    // Re-mock with a spy that captures getGenerativeModel args
    const getGenerativeModel = vi.fn(() => ({
      generateContent: mockGenerateContent,
    }))

    vi.doMock("@google/generative-ai", () => ({
      GoogleGenerativeAI: class {
        getGenerativeModel = getGenerativeModel
      },
      SchemaType: (await vi.importActual<typeof import("@google/generative-ai")>(
        "@google/generative-ai",
      )).SchemaType,
    }))

    vi.resetModules()
    const mod = await import("./gemini")

    const schema = {
      type: SchemaType.OBJECT,
      properties: { ok: { type: SchemaType.BOOLEAN } },
      required: ["ok"],
    }

    const res = await mod.generateJson<{ ok: boolean }>({
      userPrompt: "hi",
      responseSchema: schema,
    })

    expect(res.ok).toBe(true)
    const modelCall = getGenerativeModel.mock.calls[0]?.[0] as {
      generationConfig?: { responseSchema?: unknown; responseMimeType?: string }
    }
    expect(modelCall.generationConfig?.responseMimeType).toBe("application/json")
    expect(modelCall.generationConfig?.responseSchema).toEqual(schema)

    vi.doUnmock("@google/generative-ai")
  })
})
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npm test -- src/lib/ai/gemini.test.ts`
Expected: FAIL — new test fails because `GenerateJsonOptions` has no `responseSchema` field (TS error) or the config assertion fails.

- [ ] **Step 3: Implement — add `responseSchema` to `GenerateJsonOptions`**

In `src/lib/ai/gemini.ts`, add the import and extend the options interface:

```ts
import { GoogleGenerativeAI, type Schema } from "@google/generative-ai"
```

```ts
interface GenerateJsonOptions {
  systemPrompt?: string
  userPrompt: string
  temperature?: number
  maxOutputTokens?: number
  responseSchema?: Schema   // NEW
}
```

Then update `generateJson`'s model construction so the schema is forwarded when present:

```ts
  const client = new GoogleGenerativeAI(JSON_API_KEY)
  const model = client.getGenerativeModel({
    model: JSON_MODEL_ID,
    systemInstruction: opts.systemPrompt,
    generationConfig: {
      temperature: opts.temperature ?? 0,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      responseMimeType: "application/json",
      ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
    },
  })
```

- [ ] **Step 4: Run the tests to verify green**

Run: `npm test -- src/lib/ai/gemini.test.ts`
Expected: PASS for all tests (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/gemini.ts src/lib/ai/gemini.test.ts
git commit -m "feat(ai): add optional responseSchema to generateJson"
```

---

## Task 3: Skill loader — parse `SKILL.md` + references

**Files:**
- Create: `src/lib/ai/skills/loader.ts`
- Create: `src/lib/ai/skills/loader.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/ai/skills/loader.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"

import { loadSkill, __resetSkillCacheForTests } from "./loader"

function writeSkill(dir: string, files: Record<string, string>) {
  fs.mkdirSync(dir, { recursive: true })
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content, "utf8")
  }
}

describe("loadSkill", () => {
  let tmp: string
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-"))
    __resetSkillCacheForTests()
  })

  it("parses frontmatter fields and splits body at user-prompt heading", () => {
    writeSkill(path.join(tmp, "demo"), {
      "SKILL.md": [
        "---",
        "name: demo",
        "description: demo skill",
        "version: 1.2.3",
        "model: gemini-2.5-flash",
        "temperature: 0.4",
        "references: []",
        "---",
        "",
        "# System Instruction",
        "",
        "SYSTEM BODY",
        "",
        "# User Prompt Template",
        "",
        "USER BODY",
      ].join("\n"),
    })

    const skill = loadSkill("demo", tmp)
    expect(skill.name).toBe("demo")
    expect(skill.version).toBe("1.2.3")
    expect(skill.model).toBe("gemini-2.5-flash")
    expect(skill.temperature).toBe(0.4)
    expect(skill.systemPrompt).toContain("SYSTEM BODY")
    expect(skill.systemPrompt).not.toContain("USER BODY")
    expect(skill.userPromptTemplate.trim()).toBe("USER BODY")
  })

  it("appends referenced files under '## Reference' headings", () => {
    writeSkill(path.join(tmp, "demo"), {
      "SKILL.md": [
        "---",
        "name: demo",
        "version: 1.0.0",
        "model: gemini-2.5-flash",
        "temperature: 0",
        "references:",
        "  - references/a.md",
        "  - references/b.md",
        "---",
        "",
        "# System Instruction",
        "SYSTEM",
        "# User Prompt Template",
        "USER",
      ].join("\n"),
      "references/a.md": "A CONTENT",
      "references/b.md": "B CONTENT",
    })

    const skill = loadSkill("demo", tmp)
    expect(skill.systemPrompt).toContain("## Reference: references/a.md")
    expect(skill.systemPrompt).toContain("A CONTENT")
    expect(skill.systemPrompt).toContain("## Reference: references/b.md")
    expect(skill.systemPrompt).toContain("B CONTENT")
  })

  it("caches after first load", () => {
    writeSkill(path.join(tmp, "demo"), {
      "SKILL.md": [
        "---",
        "name: demo",
        "version: 1.0.0",
        "model: gemini-2.5-flash",
        "temperature: 0",
        "references: []",
        "---",
        "# System Instruction",
        "x",
        "# User Prompt Template",
        "y",
      ].join("\n"),
    })
    const a = loadSkill("demo", tmp)
    const b = loadSkill("demo", tmp)
    expect(a).toBe(b)
  })

  it("throws when SKILL.md is missing", () => {
    expect(() => loadSkill("nope", tmp)).toThrow(/SKILL\.md/)
  })

  it("throws when User Prompt Template heading is missing", () => {
    writeSkill(path.join(tmp, "demo"), {
      "SKILL.md": [
        "---",
        "name: demo",
        "version: 1.0.0",
        "model: gemini-2.5-flash",
        "temperature: 0",
        "references: []",
        "---",
        "# System Instruction",
        "no template here",
      ].join("\n"),
    })
    expect(() => loadSkill("demo", tmp)).toThrow(/User Prompt Template/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/ai/skills/loader.test.ts`
Expected: FAIL — module does not yet exist.

- [ ] **Step 3: Implement the loader**

Create `src/lib/ai/skills/loader.ts`:

```ts
import * as fs from "node:fs"
import * as path from "node:path"

export interface LoadedSkill {
  name: string
  description?: string
  version: string
  model: string
  temperature: number
  systemPrompt: string
  userPromptTemplate: string
}

interface Frontmatter {
  name: string
  description?: string
  version: string
  model: string
  temperature: number
  references: string[]
}

const cache = new Map<string, LoadedSkill>()

const DEFAULT_SKILLS_DIR = path.resolve(process.cwd(), "src/lib/ai/skills")

export function __resetSkillCacheForTests(): void {
  cache.clear()
}

export function loadSkill(name: string, baseDir: string = DEFAULT_SKILLS_DIR): LoadedSkill {
  const cacheKey = path.join(baseDir, name)
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const skillDir = path.join(baseDir, name)
  const skillPath = path.join(skillDir, "SKILL.md")
  if (!fs.existsSync(skillPath)) {
    throw new Error(`SKILL.md not found at ${skillPath}`)
  }
  const raw = fs.readFileSync(skillPath, "utf8")
  const { frontmatter, body } = parseFrontmatter(raw)

  const userHeading = "# User Prompt Template"
  const idx = body.indexOf(userHeading)
  if (idx === -1) {
    throw new Error(`Skill ${name}: missing '${userHeading}' heading in SKILL.md`)
  }
  const systemBody = body.slice(0, idx).trim()
  const userPromptTemplate = body.slice(idx + userHeading.length).trim()

  const referenceBlocks: string[] = []
  for (const ref of frontmatter.references) {
    const refPath = path.join(skillDir, ref)
    if (!fs.existsSync(refPath)) {
      throw new Error(`Skill ${name}: reference file not found: ${ref}`)
    }
    const content = fs.readFileSync(refPath, "utf8").trim()
    referenceBlocks.push(`## Reference: ${ref}\n\n${content}`)
  }

  const systemPrompt = [systemBody, ...referenceBlocks].filter(Boolean).join("\n\n")

  const skill: LoadedSkill = {
    name: frontmatter.name,
    description: frontmatter.description,
    version: frontmatter.version,
    model: frontmatter.model,
    temperature: frontmatter.temperature,
    systemPrompt,
    userPromptTemplate,
  }
  cache.set(cacheKey, skill)
  return skill
}

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) {
    throw new Error("SKILL.md missing YAML frontmatter delimited by '---'")
  }
  const head = match[1]
  const body = match[2]

  const data: Record<string, string | string[]> = {}
  const lines = head.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/)
    if (!kv) { i++; continue }
    const key = kv[1]
    const rest = kv[2]

    if (key === "references") {
      // Either "references: []" or a block list
      const inline = rest.trim()
      if (inline === "[]") {
        data.references = []
        i++
        continue
      }
      const arr: string[] = []
      i++
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        arr.push(lines[i].replace(/^\s*-\s+/, "").trim())
        i++
      }
      data.references = arr
      continue
    }

    data[key] = rest.trim().replace(/^["']|["']$/g, "")
    i++
  }

  const required = ["name", "version", "model", "temperature"] as const
  for (const k of required) {
    if (data[k] === undefined) {
      throw new Error(`SKILL.md frontmatter missing field: ${k}`)
    }
  }

  const fm: Frontmatter = {
    name: String(data.name),
    description: data.description ? String(data.description) : undefined,
    version: String(data.version),
    model: String(data.model),
    temperature: Number(data.temperature),
    references: Array.isArray(data.references) ? (data.references as string[]) : [],
  }
  if (Number.isNaN(fm.temperature)) {
    throw new Error("SKILL.md frontmatter 'temperature' must be a number")
  }
  return { frontmatter: fm, body }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/ai/skills/loader.test.ts`
Expected: PASS for all five tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/skills/loader.ts src/lib/ai/skills/loader.test.ts
git commit -m "feat(ai): add skill loader for SKILL.md + reference file concat"
```

---

## Task 4: Author the `listing-rewriter` skill package

**Files:**
- Create: `src/lib/ai/skills/listing-rewriter/SKILL.md`
- Create: `src/lib/ai/skills/listing-rewriter/references/tone-guide.md`
- Create: `src/lib/ai/skills/listing-rewriter/references/locale-notes.md`
- Create: `src/lib/ai/skills/listing-rewriter/references/examples.md`
- Create: `src/lib/ai/skills/listing-rewriter/references/output-schema.md`

- [ ] **Step 1: Create `SKILL.md`**

```markdown
---
name: listing-rewriter
description: Generate editorial headline + highlights for a vehicle listing in a target locale.
version: 1.0.0
model: gemini-2.5-flash
temperature: 0.3
references:
  - references/tone-guide.md
  - references/locale-notes.md
  - references/examples.md
  - references/output-schema.md
---

# System Instruction

You are an editorial writer for Monza Haus, a collector-car marketplace focused on Porsche and other investment-grade vehicles. Your job is to produce a short editorial hook for a single listing: one `headline` sentence and 2–5 `highlights` bullets, returned as a JSON object matching the schema referenced below.

You MUST follow every rule in the reference files. In particular:

1. **No invention.** Every claim must be supported by either the structured facts given in the user prompt or by the seller's original description. If a fact is not in the inputs, do not write it. Never estimate, never generalize from the model name.
2. **No verbatim republishing.** Do not reuse any sentence from the seller description. Do not reuse any phrase longer than four consecutive words from the seller description. The seller's original text is an input — not a draft.
3. **Write in the target locale.** The user prompt specifies the locale. All strings in your output — headline and every bullet — must be in that locale, following the register described in the locale notes.
4. **No hype vocabulary.** See the banned phrase list in the tone guide. Write like an auction catalogue, not a dealer ad.
5. **Honesty over padding.** If the seller description is sparse or missing, produce fewer highlights (minimum 2) grounded in the structured facts rather than filling bullets with generic praise.

Return JSON only, matching the schema exactly. No preamble, no markdown, no code fences.

# User Prompt Template

Locale: {{locale}}
Listing ID: {{listing_id}}

Known facts (use any that are not "—"):
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

Seller's original description (may be sparse, may be verbose, may be in any language — use only as factual input; do NOT paraphrase or translate verbatim):

"""
{{description_text}}
"""

Write the JSON response now.
```

- [ ] **Step 2: Create `references/tone-guide.md`**

```markdown
# Tone guide

Voice: auction-catalogue register. Measured, specific, factual. You are writing for a collector, not a browsing shopper. The reader knows what a Porsche is; they want to know what *this* one is.

## Positive traits
- Concrete nouns over adjectives. "Original paint" beats "beautiful paint". "Matching-numbers block" beats "great engine".
- Specific numbers where supported. Production figures, option codes, mileage, service stamp counts.
- Provenance and originality first. Collectors weight ownership history, documentation, and factory-correct specification above cosmetic condition.

## Banned phrases (translate spirit across locales, never use these or obvious translations)
- stunning, incredible, must-see, rare opportunity, once-in-a-lifetime
- pristine, immaculate, breathtaking, show-stopping, head-turning
- a true classic, a true investment, one of a kind (unless literally true and sourced)
- any exclamation marks

## Anti-paraphrase rule (HARD)
- You have the seller's description as input. You may mine it for facts.
- You must not reuse any sentence from it.
- You must not reuse any phrase longer than four consecutive words from it.
- If you catch yourself echoing the seller's cadence, rewrite.

## Highlights shape
- Each bullet: one short clause, ≤180 characters, factual, no hype.
- Prefer in this order: provenance → originality → service history → rare options → specific condition notes → spec.
- 2 bullets is better than 5 filler bullets. Stop when you run out of honest things to say.
```

- [ ] **Step 3: Create `references/locale-notes.md`**

```markdown
# Locale notes

## `en` — English
- Auction-catalogue register. Think RM Sotheby's, not dealer listings.
- Short sentences. Precise vocabulary.
- Use metric or imperial consistent with the source (the user prompt tells you).

## `es` — Spanish (neutral Latin American)
- Default register: `usted`. Avoid `tú` and avoid regionalisms (no "coche" vs "auto" preference — use what the model name and context suggest; default to "auto" for neutrality).
- Use Porsche-specific terms that Spanish-speaking collectors recognise: *Porsche de coleccionista, historial de servicio, un solo dueño, pintura original, motor coincidente*.
- Do not use Castilian-only phrasing ("vosotros", "aparcar", "coche" exclusively).

## `de` — German
- Formal (`Sie`). Collector vocabulary expected: *Werksangaben, Erstauslieferung, Originalzustand, Originallack, Scheckheftgepflegt, Ein-Besitzer-Fahrzeug, Matching-Numbers*.
- Compound nouns are correct and expected — do not artificially split them.
- Metric units.

## `ja` — Japanese
- Desu/masu form throughout (丁寧語). No casual endings.
- Collector vocabulary: 純正, ワンオーナー, 記録簿完備, フルオリジナル, マッチングナンバー, 走行距離.
- Mileage in km. Use 万 for large numbers where natural (e.g., 1.2万km).
- No exclamation marks, no emoji.
```

- [ ] **Step 4: Create `references/examples.md`**

```markdown
# Few-shot examples

Each example shows: a user prompt (condensed), followed by the exact JSON response you would return.

## Example 1 — rich source, English output

User prompt extract:
- Year: 2011; Make: Porsche; Model: 911 GT3; Mileage: 9321 mi; Colour: Carrara White / Black leather; Engine: 3.8L flat-six; Transmission: 6-speed manual; Location: Japan; Platform: BeForward.
- Seller description (excerpt): "Two owners from new. Full Porsche main-dealer service history with 11 stamps. Recent IMS inspection and fresh oil service. Original paint throughout, confirmed with paint-depth readings."
- Locale: `en`.

Expected JSON:
```json
{
  "headline": "A two-owner 2011 911 GT3 in Carrara White with original paint and a complete main-dealer service record.",
  "highlights": [
    "Two owners from new, with continuous documentation.",
    "Eleven stamps in the Porsche main-dealer service book.",
    "Original paint confirmed by paint-depth measurements.",
    "Recent IMS inspection and fresh oil service on file.",
    "6-speed manual 997.2 GT3, 9,321 miles from new."
  ]
}
```

## Example 2 — sparse source, Spanish output

User prompt extract:
- Year: 2018; Make: Porsche; Model: 911 Carrera S; Mileage: 24,500 km; Colour: Guards Red / Black; Transmission: PDK; Location: Madrid; Platform: AutoScout24.
- Seller description: "911 Carrera S en muy buen estado. Más información por teléfono."
- Locale: `es`.

Expected JSON:
```json
{
  "headline": "Un 911 Carrera S (991.2) de 2018 en Guards Red con 24.500 km, ubicado en Madrid.",
  "highlights": [
    "991.2 Carrera S con transmisión PDK.",
    "Configuración clásica: rojo Guards sobre interior negro.",
    "24.500 km indicados, listado en Madrid."
  ]
}
```

## Example 3 — non-English source, German output

User prompt extract:
- Year: 1995; Make: Porsche; Model: 993 Carrera; Mileage: 84,000 mi; Colour: Midnight Blue / Beige; Transmission: Manual; Location: Florida; Platform: Bring a Trailer.
- Seller description (excerpt, English): "Single-owner 993 since 2001. Recent top-end refresh with new timing chain tensioners. California and Florida-registered. All service records included."
- Locale: `de`.

Expected JSON:
```json
{
  "headline": "993 Carrera aus Erstauslieferung 1995, seit 2001 in einer Hand, in Midnight Blue auf beigem Leder.",
  "highlights": [
    "Ein-Besitzer-Fahrzeug seit 2001, vollständige Servicehistorie.",
    "Kürzlich durchgeführte Top-End-Überholung inklusive neuer Steuerkettenspanner.",
    "Ursprünglich in Kalifornien und Florida zugelassen.",
    "Handschaltung, 84.000 Meilen Gesamtlaufleistung."
  ]
}
```
```

- [ ] **Step 5: Create `references/output-schema.md`**

```markdown
# Output schema (human mirror)

The Gemini API will enforce the shape via `responseSchema`. This file restates the contract for human editors of the prompt.

```json
{
  "headline": "string, one sentence, 12–28 words, in target locale",
  "highlights": ["2 to 5 short factual bullets, each ≤180 chars, in target locale"]
}
```

Rules repeated:
- No invention of facts not in the inputs.
- No verbatim reuse of sentences or 4+-word phrases from the seller description.
- No banned-hype phrases.
- Fewer honest bullets beats five padded ones.
```

- [ ] **Step 6: Verify the skill package loads cleanly**

Run: `npm test -- src/lib/ai/skills/loader.test.ts`
Expected: PASS (existing tests still pass; they use tmp dirs so they do not touch the new skill, but we verify nothing broke).

Then add a one-off sanity check by running the existing loader test suite. No new tests here — this task is authoring, not logic.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/skills/listing-rewriter/
git commit -m "feat(ai): author listing-rewriter skill package (prompt + references)"
```

---

## Task 5: Source hash utility

**Files:**
- Create: `src/lib/ai/sourceHash.ts`
- Create: `src/lib/ai/sourceHash.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/ai/sourceHash.test.ts
import { describe, it, expect } from "vitest"
import { computeSourceHash, type RewriterSource } from "./sourceHash"

const base: RewriterSource = {
  description_text: "Two owners. Service history complete.",
  year: 2011,
  make: "Porsche",
  model: "911 GT3",
  trim: null,
  mileage: 9321,
  mileage_unit: "mi",
  vin: "WP0AC29911S693111",
  color_exterior: "Carrara White",
  color_interior: "Black",
  engine: "3.8L flat-six",
  transmission: "6-speed manual",
  body_style: "Coupe",
  location: "Japan",
  platform: "BEFORWARD",
}

describe("computeSourceHash", () => {
  it("returns a 64-char hex sha256", () => {
    const h = computeSourceHash(base)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is stable across calls with the same input", () => {
    expect(computeSourceHash(base)).toBe(computeSourceHash(base))
  })

  it("is stable across field insertion order", () => {
    const shuffled: RewriterSource = {
      platform: base.platform,
      description_text: base.description_text,
      year: base.year,
      vin: base.vin,
      make: base.make,
      model: base.model,
      trim: base.trim,
      mileage: base.mileage,
      mileage_unit: base.mileage_unit,
      color_exterior: base.color_exterior,
      color_interior: base.color_interior,
      engine: base.engine,
      transmission: base.transmission,
      body_style: base.body_style,
      location: base.location,
    }
    expect(computeSourceHash(shuffled)).toBe(computeSourceHash(base))
  })

  it("changes when any field changes", () => {
    const original = computeSourceHash(base)
    expect(computeSourceHash({ ...base, mileage: 9322 })).not.toBe(original)
    expect(computeSourceHash({ ...base, description_text: "changed" })).not.toBe(original)
    expect(computeSourceHash({ ...base, color_interior: null })).not.toBe(original)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/lib/ai/sourceHash.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `src/lib/ai/sourceHash.ts`:

```ts
import { createHash } from "node:crypto"

export interface RewriterSource {
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

// Canonical key order — field changes must update this deliberately.
const FIELD_ORDER: Array<keyof RewriterSource> = [
  "year",
  "make",
  "model",
  "trim",
  "mileage",
  "mileage_unit",
  "vin",
  "color_exterior",
  "color_interior",
  "engine",
  "transmission",
  "body_style",
  "location",
  "platform",
  "description_text",
]

export function computeSourceHash(source: RewriterSource): string {
  const canonical = FIELD_ORDER.map(k => [k, source[k] ?? null] as const)
  const serialised = JSON.stringify(canonical)
  return createHash("sha256").update(serialised).digest("hex")
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/lib/ai/sourceHash.test.ts`
Expected: PASS for all four tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/sourceHash.ts src/lib/ai/sourceHash.test.ts
git commit -m "feat(ai): add stable source hash for rewriter cache invalidation"
```

---

## Task 6: Rewriter service — orchestration

**Files:**
- Create: `src/lib/ai/listingRewriter.ts`
- Create: `src/lib/ai/listingRewriter.test.ts`
- Create: `src/lib/ai/__fixtures__/listing-rewriter-rich.json`

- [ ] **Step 1: Create fixture**

`src/lib/ai/__fixtures__/listing-rewriter-rich.json`:

```json
{
  "headline": "A two-owner 2011 911 GT3 in Carrara White with original paint and a complete main-dealer service record.",
  "highlights": [
    "Two owners from new, with continuous documentation.",
    "Eleven stamps in the Porsche main-dealer service book.",
    "Original paint confirmed by paint-depth measurements.",
    "Recent IMS inspection and fresh oil service on file.",
    "6-speed manual 997.2 GT3, 9,321 miles from new."
  ]
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/ai/listingRewriter.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest"

import richFixture from "./__fixtures__/listing-rewriter-rich.json"

// Mock skill loader
const mockLoadSkill = vi.fn()
vi.mock("./skills/loader", () => ({
  loadSkill: (...args: unknown[]) => mockLoadSkill(...args),
}))

// Mock generateJson
const mockGenerateJson = vi.fn()
vi.mock("./gemini", () => ({
  generateJson: (...args: unknown[]) => mockGenerateJson(...args),
}))

// Mock supabase service client
const mockSelect = vi.fn()
const mockUpsert = vi.fn()
vi.mock("./listingRewriterDb", () => ({
  readCachedRewrite: (...args: unknown[]) => mockSelect(...args),
  writeCachedRewrite: (...args: unknown[]) => mockUpsert(...args),
}))

import { rewriteListing } from "./listingRewriter"
import type { RewriterSource } from "./sourceHash"

const baseSource: RewriterSource = {
  description_text: "Two owners. Service history complete.",
  year: 2011, make: "Porsche", model: "911 GT3", trim: null,
  mileage: 9321, mileage_unit: "mi", vin: "WP0AC29911S693111",
  color_exterior: "Carrara White", color_interior: "Black",
  engine: "3.8L flat-six", transmission: "6-speed manual",
  body_style: "Coupe", location: "Japan", platform: "BEFORWARD",
}

function mockSkill() {
  mockLoadSkill.mockReturnValue({
    name: "listing-rewriter",
    version: "1.0.0",
    model: "gemini-2.5-flash",
    temperature: 0.3,
    systemPrompt: "SYSTEM",
    userPromptTemplate: "Locale: {{locale}} Year: {{year}} Desc: {{description_text}}",
  })
}

describe("rewriteListing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSkill()
  })

  it("returns cached row when source_hash + prompt_version + model all match", async () => {
    const { computeSourceHash } = await import("./sourceHash")
    const expectedHash = computeSourceHash(baseSource)

    mockSelect.mockResolvedValue({
      headline: "cached",
      highlights: ["a", "b"],
      source_hash: expectedHash,
      prompt_version: "1.0.0",
      model: "gemini-2.5-flash",
      generated_at: "2026-04-21T00:00:00Z",
    })

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res?.headline).toBe("cached")
    expect(mockGenerateJson).not.toHaveBeenCalled()
  })

  it("generates, validates, and upserts on cache miss", async () => {
    mockSelect.mockResolvedValue(null)
    mockGenerateJson.mockResolvedValue({ ok: true, data: richFixture, raw: "" })
    mockUpsert.mockResolvedValue(undefined)

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })

    expect(res).not.toBeNull()
    expect(res!.headline).toBe(richFixture.headline)
    expect(res!.highlights).toEqual(richFixture.highlights)
    expect(res!.promptVersion).toBe("1.0.0")
    expect(res!.model).toBe("gemini-2.5-flash")
    expect(mockGenerateJson).toHaveBeenCalledOnce()
    expect(mockUpsert).toHaveBeenCalledOnce()
  })

  it("regenerates when prompt_version differs from cached row", async () => {
    mockSelect.mockResolvedValue({
      headline: "old",
      highlights: ["a", "b"],
      source_hash: "__ANY__",
      prompt_version: "0.9.0",   // mismatch
      model: "gemini-2.5-flash",
      generated_at: "2026-04-20T00:00:00Z",
    })
    mockGenerateJson.mockResolvedValue({ ok: true, data: richFixture, raw: "" })
    mockUpsert.mockResolvedValue(undefined)

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res!.headline).toBe(richFixture.headline)
    expect(mockGenerateJson).toHaveBeenCalledOnce()
  })

  it("substitutes placeholders in the user prompt", async () => {
    mockSelect.mockResolvedValue(null)
    mockGenerateJson.mockResolvedValue({ ok: true, data: richFixture, raw: "" })

    await rewriteListing({ listingId: "L1", locale: "es", source: baseSource })

    const call = mockGenerateJson.mock.calls[0]?.[0] as { userPrompt: string }
    expect(call.userPrompt).toContain("Locale: es")
    expect(call.userPrompt).toContain("Year: 2011")
    expect(call.userPrompt).toContain("Two owners. Service history complete.")
    expect(call.userPrompt).not.toContain("{{locale}}")
  })

  it("returns null when Gemini call errors", async () => {
    mockSelect.mockResolvedValue(null)
    mockGenerateJson.mockResolvedValue({ ok: false, error: "boom", raw: null })

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res).toBeNull()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it("returns null when response fails schema validation", async () => {
    mockSelect.mockResolvedValue(null)
    mockGenerateJson.mockResolvedValue({
      ok: true,
      data: { headline: "", highlights: ["only one"] },
      raw: "",
    })

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res).toBeNull()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it("returns null when DB read throws", async () => {
    mockSelect.mockRejectedValue(new Error("db down"))

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res).toBeNull()
  })

  it("returns the generated payload even if the DB write fails", async () => {
    mockSelect.mockResolvedValue(null)
    mockGenerateJson.mockResolvedValue({ ok: true, data: richFixture, raw: "" })
    mockUpsert.mockRejectedValue(new Error("write failed"))

    const res = await rewriteListing({ listingId: "L1", locale: "en", source: baseSource })
    expect(res).not.toBeNull()
    expect(res!.headline).toBe(richFixture.headline)
  })
})
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- src/lib/ai/listingRewriter.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 4: Implement DB layer**

Create `src/lib/ai/listingRewriterDb.ts` (keeps Supabase I/O out of the orchestrator, so the orchestrator stays pure and easy to mock):

```ts
import { createClient } from "@supabase/supabase-js"

export interface CachedRewriteRow {
  headline: string
  highlights: string[]
  source_hash: string
  prompt_version: string
  model: string
  generated_at: string
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Supabase env vars missing")
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function readCachedRewrite(
  listingId: string,
  locale: string,
): Promise<CachedRewriteRow | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("listing_translations")
    .select("headline, highlights, source_hash, prompt_version, model, generated_at")
    .eq("listing_id", listingId)
    .eq("locale", locale)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return {
    headline: data.headline as string,
    highlights: data.highlights as string[],
    source_hash: data.source_hash as string,
    prompt_version: data.prompt_version as string,
    model: data.model as string,
    generated_at: data.generated_at as string,
  }
}

export async function writeCachedRewrite(
  listingId: string,
  locale: string,
  row: CachedRewriteRow,
): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase.from("listing_translations").upsert({
    listing_id: listingId,
    locale,
    headline: row.headline,
    highlights: row.highlights,
    source_hash: row.source_hash,
    prompt_version: row.prompt_version,
    model: row.model,
    generated_at: row.generated_at,
  })
  if (error) throw error
}
```

- [ ] **Step 5: Implement the rewriter service**

Create `src/lib/ai/listingRewriter.ts`:

```ts
import { SchemaType, type Schema } from "@google/generative-ai"

import { generateJson } from "./gemini"
import { loadSkill } from "./skills/loader"
import { computeSourceHash, type RewriterSource } from "./sourceHash"
import {
  readCachedRewrite,
  writeCachedRewrite,
  type CachedRewriteRow,
} from "./listingRewriterDb"

export type RewriterLocale = "en" | "es" | "de" | "ja"

export interface RewriterInput {
  listingId: string
  locale: RewriterLocale
  source: RewriterSource
}

export interface RewriteOutput {
  headline: string
  highlights: string[]
  promptVersion: string
  model: string
  sourceHash: string
  generatedAt: string
}

const SKILL_NAME = "listing-rewriter"

const LISTING_HOOK_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  description:
    "Editorial hook for a single vehicle listing, in the target locale. " +
    "Do not invent facts. Do not paraphrase the seller's original description verbatim.",
  properties: {
    headline: {
      type: SchemaType.STRING,
      description:
        "One sentence (12–28 words) positioning this car: what it is, why a collector would care. " +
        "No hype, no generic filler. No verbatim phrases >4 words from the seller description.",
    },
    highlights: {
      type: SchemaType.ARRAY,
      minItems: 2,
      maxItems: 5,
      description:
        "Between 2 and 5 concise factual bullets (≤180 chars each), in the target locale. " +
        "Prefer provenance, originality, service history, rare options, and condition specifics. " +
        "If the seller description is sparse, produce fewer bullets grounded in structured facts " +
        "rather than padding with filler. Never include bullets unsupported by the input.",
      items: { type: SchemaType.STRING, description: "One highlight bullet." },
    },
  },
  required: ["headline", "highlights"],
}

export async function rewriteListing(
  input: RewriterInput,
): Promise<RewriteOutput | null> {
  try {
    const skill = loadSkill(SKILL_NAME)
    const sourceHash = computeSourceHash(input.source)

    const cached = await safeReadCache(input.listingId, input.locale)
    if (
      cached &&
      cached.source_hash === sourceHash &&
      cached.prompt_version === skill.version &&
      cached.model === skill.model
    ) {
      return rowToOutput(cached, sourceHash)
    }

    const userPrompt = renderUserPrompt(skill.userPromptTemplate, input)

    const resp = await generateJson<{ headline: string; highlights: string[] }>({
      systemPrompt: skill.systemPrompt,
      userPrompt,
      temperature: skill.temperature,
      maxOutputTokens: 600,
      responseSchema: LISTING_HOOK_SCHEMA,
    })

    if (!resp.ok) {
      logEvent("rewrite_failed", {
        listing_id: input.listingId,
        locale: input.locale,
        reason: `gemini_error: ${resp.error}`,
      })
      return null
    }

    const validated = validatePayload(resp.data)
    if (!validated) {
      logEvent("rewrite_failed", {
        listing_id: input.listingId,
        locale: input.locale,
        reason: "schema_invalid",
      })
      return null
    }

    const generatedAt = new Date().toISOString()
    const row: CachedRewriteRow = {
      headline: validated.headline,
      highlights: validated.highlights,
      source_hash: sourceHash,
      prompt_version: skill.version,
      model: skill.model,
      generated_at: generatedAt,
    }

    await safeWriteCache(input.listingId, input.locale, row)

    logEvent("rewrite_generated", {
      listing_id: input.listingId,
      locale: input.locale,
    })

    return {
      headline: validated.headline,
      highlights: validated.highlights,
      promptVersion: skill.version,
      model: skill.model,
      sourceHash,
      generatedAt,
    }
  } catch (err) {
    logEvent("rewrite_failed", {
      listing_id: input.listingId,
      locale: input.locale,
      reason: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

function renderUserPrompt(template: string, input: RewriterInput): string {
  const s = input.source
  const table: Record<string, string> = {
    locale: input.locale,
    listing_id: input.listingId,
    year: String(s.year),
    make: s.make,
    model: s.model,
    trim: s.trim ?? "—",
    mileage: s.mileage != null ? String(s.mileage) : "—",
    mileage_unit: s.mileage_unit ?? "",
    vin: s.vin ?? "—",
    color_exterior: s.color_exterior ?? "—",
    color_interior: s.color_interior ?? "—",
    engine: s.engine ?? "—",
    transmission: s.transmission ?? "—",
    body_style: s.body_style ?? "—",
    location: s.location ?? "—",
    platform: s.platform ?? "—",
    description_text: s.description_text ?? "(no seller description provided)",
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => table[k] ?? `{{${k}}}`)
}

function validatePayload(
  data: unknown,
): { headline: string; highlights: string[] } | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const headline = typeof d.headline === "string" ? d.headline.trim() : ""
  if (headline.length < 20 || headline.length > 240) return null

  if (!Array.isArray(d.highlights)) return null
  const highlights = d.highlights
    .map(h => (typeof h === "string" ? h.trim() : ""))
    .filter(h => h.length > 0 && h.length <= 240)
  if (highlights.length < 2 || highlights.length > 5) return null

  return { headline, highlights }
}

function rowToOutput(row: CachedRewriteRow, sourceHash: string): RewriteOutput {
  return {
    headline: row.headline,
    highlights: row.highlights,
    promptVersion: row.prompt_version,
    model: row.model,
    sourceHash,
    generatedAt: row.generated_at,
  }
}

async function safeReadCache(
  listingId: string,
  locale: string,
): Promise<CachedRewriteRow | null> {
  try {
    return await readCachedRewrite(listingId, locale)
  } catch (err) {
    logEvent("rewrite_failed", {
      listing_id: listingId,
      locale,
      reason: `db_read: ${err instanceof Error ? err.message : String(err)}`,
    })
    throw err
  }
}

async function safeWriteCache(
  listingId: string,
  locale: string,
  row: CachedRewriteRow,
): Promise<void> {
  try {
    await writeCachedRewrite(listingId, locale, row)
  } catch (err) {
    logEvent("rewrite_failed", {
      listing_id: listingId,
      locale,
      reason: `db_write: ${err instanceof Error ? err.message : String(err)}`,
    })
    // swallow — the payload is already validated; we return it to the caller
  }
}

function logEvent(event: string, payload: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event, ...payload }))
}
```

Note on the DB-read failure path: the test "returns null when DB read throws" expects `null`. Update the catch in `rewriteListing` to treat `safeReadCache` errors as "return null" — which it already does because `safeReadCache` re-throws and the outer `catch` in `rewriteListing` returns `null`. Verify this behaviour in the test run.

- [ ] **Step 6: Run tests to verify pass**

Run: `npm test -- src/lib/ai/listingRewriter.test.ts`
Expected: PASS for all eight tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/listingRewriter.ts src/lib/ai/listingRewriterDb.ts src/lib/ai/listingRewriter.test.ts src/lib/ai/__fixtures__/
git commit -m "feat(ai): implement listing rewriter service with cache + schema validation"
```

---

## Task 7: In-memory rate limiter

**Files:**
- Create: `src/lib/rateLimit.ts`
- Create: `src/lib/rateLimit.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/rateLimit.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createRateLimiter } from "./rateLimit"

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-21T00:00:00Z"))
  })

  it("allows up to N requests within the window", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 })
    expect(limiter.check("1.1.1.1")).toEqual({ allowed: true, remaining: 2 })
    expect(limiter.check("1.1.1.1")).toEqual({ allowed: true, remaining: 1 })
    expect(limiter.check("1.1.1.1")).toEqual({ allowed: true, remaining: 0 })
  })

  it("rejects the (N+1)th request within the window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 })
    limiter.check("1.1.1.1")
    limiter.check("1.1.1.1")
    const res = limiter.check("1.1.1.1")
    expect(res.allowed).toBe(false)
    expect(res.remaining).toBe(0)
  })

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
    expect(limiter.check("1.1.1.1").allowed).toBe(true)
    expect(limiter.check("2.2.2.2").allowed).toBe(true)
    expect(limiter.check("1.1.1.1").allowed).toBe(false)
  })

  it("forgets requests older than the window", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
    expect(limiter.check("1.1.1.1").allowed).toBe(true)
    vi.advanceTimersByTime(61_000)
    expect(limiter.check("1.1.1.1").allowed).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/lib/rateLimit.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/lib/rateLimit.ts
export interface RateLimiter {
  check(key: string): { allowed: boolean; remaining: number }
}

export interface RateLimiterOptions {
  limit: number
  windowMs: number
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>()

  return {
    check(key: string) {
      const now = Date.now()
      const cutoff = now - opts.windowMs
      const bucket = (hits.get(key) ?? []).filter(ts => ts > cutoff)
      if (bucket.length >= opts.limit) {
        hits.set(key, bucket)
        return { allowed: false, remaining: 0 }
      }
      bucket.push(now)
      hits.set(key, bucket)
      return { allowed: true, remaining: opts.limit - bucket.length }
    },
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/lib/rateLimit.test.ts`
Expected: PASS for all four tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rateLimit.ts src/lib/rateLimit.test.ts
git commit -m "feat: add in-memory sliding-window rate limiter"
```

---

## Task 8: API route — `GET /api/listings/[id]/rewrite`

**Files:**
- Create: `src/app/api/listings/[id]/rewrite/route.ts`
- Create: `src/app/api/listings/[id]/rewrite/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/listings/[id]/rewrite/route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"

const mockRewrite = vi.fn()
vi.mock("@/lib/ai/listingRewriter", () => ({
  rewriteListing: (...args: unknown[]) => mockRewrite(...args),
}))

const mockLoadSource = vi.fn()
vi.mock("@/lib/ai/listingSource", () => ({
  loadListingSource: (...args: unknown[]) => mockLoadSource(...args),
}))

vi.stubEnv("LISTING_REWRITER_ENABLED", "true")

import { GET } from "./route"

function req(url: string, ip = "1.1.1.1") {
  return new Request(url, { headers: { "x-forwarded-for": ip } })
}

describe("GET /api/listings/[id]/rewrite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for invalid locale", async () => {
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=xx"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(400)
  })

  it("returns 404 when listing source cannot be loaded", async () => {
    mockLoadSource.mockResolvedValue(null)
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=en"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 204 for curated (non-live) listings", async () => {
    const res = await GET(
      req("https://x/api/listings/curated-abc/rewrite?locale=en"),
      { params: Promise.resolve({ id: "curated-abc" }) },
    )
    expect(res.status).toBe(204)
    expect(mockLoadSource).not.toHaveBeenCalled()
  })

  it("returns 200 with payload on success", async () => {
    mockLoadSource.mockResolvedValue({
      description_text: "desc", year: 2011, make: "Porsche", model: "911", trim: null,
      mileage: 1, mileage_unit: "mi", vin: null, color_exterior: null, color_interior: null,
      engine: null, transmission: null, body_style: null, location: null, platform: null,
    })
    mockRewrite.mockResolvedValue({
      headline: "h",
      highlights: ["a", "b"],
      promptVersion: "1.0.0",
      model: "gemini-2.5-flash",
      sourceHash: "deadbeef",
      generatedAt: "2026-04-21T00:00:00Z",
    })
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=en"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ headline: "h", highlights: ["a", "b"] })
  })

  it("returns 204 when rewriter returns null", async () => {
    mockLoadSource.mockResolvedValue({
      description_text: null, year: 2011, make: "Porsche", model: "911", trim: null,
      mileage: null, mileage_unit: null, vin: null, color_exterior: null, color_interior: null,
      engine: null, transmission: null, body_style: null, location: null, platform: null,
    })
    mockRewrite.mockResolvedValue(null)
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=en"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(204)
  })

  it("returns 429 once the limit is exceeded for one IP", async () => {
    mockLoadSource.mockResolvedValue({
      description_text: "d", year: 2011, make: "Porsche", model: "911", trim: null,
      mileage: null, mileage_unit: null, vin: null, color_exterior: null, color_interior: null,
      engine: null, transmission: null, body_style: null, location: null, platform: null,
    })
    mockRewrite.mockResolvedValue({
      headline: "h", highlights: ["a", "b"],
      promptVersion: "1.0.0", model: "gemini-2.5-flash",
      sourceHash: "x", generatedAt: "t",
    })

    // Burn the bucket
    for (let i = 0; i < 10; i++) {
      await GET(
        req("https://x/api/listings/live-abc/rewrite?locale=en", "9.9.9.9"),
        { params: Promise.resolve({ id: "live-abc" }) },
      )
    }
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=en", "9.9.9.9"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(429)
  })

  it("returns 204 when LISTING_REWRITER_ENABLED is falsey", async () => {
    vi.stubEnv("LISTING_REWRITER_ENABLED", "false")
    const res = await GET(
      req("https://x/api/listings/live-abc/rewrite?locale=en"),
      { params: Promise.resolve({ id: "live-abc" }) },
    )
    expect(res.status).toBe(204)
    vi.stubEnv("LISTING_REWRITER_ENABLED", "true")
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/app/api/listings/\\[id\\]/rewrite/route.test.ts`
Expected: FAIL — route module and `listingSource` module do not exist.

- [ ] **Step 3: Create the `listingSource` loader**

Create `src/lib/ai/listingSource.ts`:

```ts
import { createClient } from "@supabase/supabase-js"
import type { RewriterSource } from "./sourceHash"

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Supabase env vars missing")
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Load the minimum fields the rewriter needs for a live listing.
 * Returns null when the listing does not exist in Supabase.
 * `listingId` is the app-level id WITHOUT the `live-` prefix.
 */
export async function loadListingSource(
  listingIdWithoutPrefix: string,
): Promise<RewriterSource | null> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from("listings")
    .select(
      "year, make, model, trim, mileage, mileage_unit, vin, color_exterior, color_interior, engine, transmission, body_style, location, platform, description_text",
    )
    .eq("id", listingIdWithoutPrefix)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    year: Number(data.year),
    make: String(data.make ?? ""),
    model: String(data.model ?? ""),
    trim: (data.trim as string | null) ?? null,
    mileage: data.mileage != null ? Number(data.mileage) : null,
    mileage_unit: (data.mileage_unit as "mi" | "km" | null) ?? null,
    vin: (data.vin as string | null) ?? null,
    color_exterior: (data.color_exterior as string | null) ?? null,
    color_interior: (data.color_interior as string | null) ?? null,
    engine: (data.engine as string | null) ?? null,
    transmission: (data.transmission as string | null) ?? null,
    body_style: (data.body_style as string | null) ?? null,
    location: (data.location as string | null) ?? null,
    platform: (data.platform as string | null) ?? null,
    description_text: (data.description_text as string | null) ?? null,
  }
}
```

- [ ] **Step 4: Implement the route**

Create `src/app/api/listings/[id]/rewrite/route.ts`:

```ts
import { NextResponse } from "next/server"
import { rewriteListing, type RewriterLocale } from "@/lib/ai/listingRewriter"
import { loadListingSource } from "@/lib/ai/listingSource"
import { createRateLimiter } from "@/lib/rateLimit"

const LIVE_PREFIX = "live-"
const SUPPORTED_LOCALES: RewriterLocale[] = ["en", "es", "de", "ja"]

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (process.env.LISTING_REWRITER_ENABLED !== "true") {
    return new NextResponse(null, { status: 204 })
  }

  const { id } = await params
  const url = new URL(request.url)
  const localeParam = url.searchParams.get("locale") ?? ""

  if (!SUPPORTED_LOCALES.includes(localeParam as RewriterLocale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 })
  }
  const locale = localeParam as RewriterLocale

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  const gate = limiter.check(ip)
  if (!gate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // Curated entries carry human-authored copy; skip AI rewriting.
  if (!id.startsWith(LIVE_PREFIX)) {
    return new NextResponse(null, { status: 204 })
  }
  const dbId = id.slice(LIVE_PREFIX.length)

  let source
  try {
    source = await loadListingSource(dbId)
  } catch {
    return new NextResponse(null, { status: 204 })
  }
  if (!source) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  const result = await rewriteListing({ listingId: id, locale, source })
  if (!result) {
    return new NextResponse(null, { status: 204 })
  }

  return NextResponse.json({
    headline: result.headline,
    highlights: result.highlights,
  })
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm test -- src/app/api/listings/\\[id\\]/rewrite/route.test.ts`
Expected: PASS for all seven tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/listings/\[id\]/rewrite/ src/lib/ai/listingSource.ts
git commit -m "feat(api): add /api/listings/[id]/rewrite with rate-limit + feature flag"
```

---

## Task 9: Client-side hook `useListingRewrite`

**Files:**
- Create: `src/hooks/useListingRewrite.ts`

- [ ] **Step 1: Implement**

```ts
// src/hooks/useListingRewrite.ts
"use client"

import { useEffect, useState } from "react"

export interface ListingRewritePayload {
  headline: string
  highlights: string[]
}

interface State {
  data: ListingRewritePayload | null
  isLoading: boolean
}

const memoryCache = new Map<string, ListingRewritePayload | null>()

export function useListingRewrite(listingId: string, locale: string): State {
  const cacheKey = `${listingId}|${locale}`
  const seeded = memoryCache.has(cacheKey) ? memoryCache.get(cacheKey)! : null
  const [state, setState] = useState<State>({
    data: seeded,
    isLoading: !memoryCache.has(cacheKey),
  })

  useEffect(() => {
    if (memoryCache.has(cacheKey)) {
      setState({ data: memoryCache.get(cacheKey) ?? null, isLoading: false })
      return
    }
    let cancelled = false
    setState({ data: null, isLoading: true })

    fetch(`/api/listings/${encodeURIComponent(listingId)}/rewrite?locale=${encodeURIComponent(locale)}`, {
      headers: { accept: "application/json" },
    })
      .then(async res => {
        if (cancelled) return
        if (res.status === 200) {
          const json = (await res.json()) as ListingRewritePayload
          memoryCache.set(cacheKey, json)
          setState({ data: json, isLoading: false })
          return
        }
        // 204 / 4xx / 5xx — all treated as "no data; show placeholder"
        memoryCache.set(cacheKey, null)
        setState({ data: null, isLoading: false })
      })
      .catch(() => {
        if (cancelled) return
        memoryCache.set(cacheKey, null)
        setState({ data: null, isLoading: false })
      })

    return () => {
      cancelled = true
    }
  }, [cacheKey, listingId, locale])

  return state
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useListingRewrite.ts
git commit -m "feat(hooks): add useListingRewrite client hook"
```

---

## Task 10: `<ListingHook />` presentational component

**Files:**
- Create: `src/components/detail/ListingHook.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/detail/ListingHook.tsx
"use client"

import { useLocale } from "next-intl"
import type { ReactNode } from "react"
import { useListingRewrite } from "@/hooks/useListingRewrite"

interface ListingHookProps {
  listingId: string
  fallback: ReactNode
}

const SUPPORTED = new Set(["en", "es", "de", "ja"])

export function ListingHook({ listingId, fallback }: ListingHookProps) {
  const locale = useLocale()
  const safeLocale = SUPPORTED.has(locale) ? locale : "en"
  const { data, isLoading } = useListingRewrite(listingId, safeLocale)

  if (isLoading) {
    return (
      <div aria-busy="true" className="space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (!data) {
    return <>{fallback}</>
  }

  return (
    <div>
      <p className="text-[14px] italic leading-relaxed text-foreground">{data.headline}</p>
      {data.highlights.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {data.highlights.map((h, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-muted-foreground">
              <span className="text-primary">•</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/detail/ListingHook.tsx
git commit -m "feat(detail): add ListingHook presentational component"
```

---

## Task 11: Wire `<ListingHook />` into `CarDetailClient`

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx`

- [ ] **Step 1: Locate the "Über dieses Fahrzeug" / "About this car" card**

Run: `grep -n "aboutThisCar\|Über dieses\|About this car\|Live auction listing" src/app/\[locale\]/cars/\[make\]/\[id\]/CarDetailClient.tsx`

Note the matching line numbers. The card containing the placeholder `"Live auction listing from <platform>"` is the target.

- [ ] **Step 2: Add the import**

At the top of `CarDetailClient.tsx`, add:

```tsx
import { ListingHook } from "@/components/detail/ListingHook"
```

- [ ] **Step 3: Replace the placeholder text node with `<ListingHook />`**

Inside the "Über dieses Fahrzeug" / "About this car" card, locate the JSX node currently rendering the placeholder (e.g. `<p>Live auction listing from {car.platform}</p>`). Replace it with:

```tsx
<ListingHook
  listingId={car.id}
  fallback={
    <p className="text-[13px] text-muted-foreground">
      {t("aboutFallback", { platform: car.platform.replace(/_/g, " ") })}
    </p>
  }
/>
```

- [ ] **Step 4: Add the fallback translation key**

The `t()` binding at the top of `CarDetailClient.tsx` is `useTranslations("carDetail")` (line 795). Add the new key `aboutFallback` inside the existing `"carDetail"` object in each of the four message files. Example diff for `messages/en.json`:

```diff
 "carDetail": {
   ...existing keys...
+  "aboutFallback": "Live auction listing from {platform}",
   ...
 }
```

Apply the following values, keeping the same placement (inside the `"carDetail"` object):

- `en`: `"aboutFallback": "Live auction listing from {platform}"`
- `es`: `"aboutFallback": "Subasta en vivo desde {platform}"`
- `de`: `"aboutFallback": "Live-Auktion von {platform}"`
- `ja`: `"aboutFallback": "{platform} のライブオークション"`

- [ ] **Step 5: Verify the page builds**

Run: `npm run build` (or `npm run dev` and open a listing detail page).
Expected: Build succeeds. With `LISTING_REWRITER_ENABLED=false` (default), the card renders the fallback copy — the existing placeholder — unchanged. With `LISTING_REWRITER_ENABLED=true` and a valid `GEMINI_API_KEY`, the card shows a skeleton then headline + bullets.

- [ ] **Step 6: Commit**

```bash
git add src/app/\[locale\]/cars/\[make\]/\[id\]/CarDetailClient.tsx messages/
git commit -m "feat(detail): wire ListingHook into About-this-car card with locale fallback"
```

---

## Task 12: `.env.example` update

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append flag and reaffirm Gemini key**

Ensure `.env.example` contains (add if missing, leave existing entries in place):

```
# Enable the AI listing rewriter feature (set to "true" to activate).
LISTING_REWRITER_ENABLED=false

# Gemini API key used by the listing rewriter and other AI features.
GEMINI_API_KEY=
# Optional override for Gemini model id. Defaults to gemini-2.5-flash.
GEMINI_MODEL=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document LISTING_REWRITER_ENABLED env flag"
```

---

## Task 13: End-to-end manual verification

**Files:** (no edits — manual QA)

- [ ] **Step 1: Start dev server with feature enabled**

```bash
LISTING_REWRITER_ENABLED=true npm run dev
```

- [ ] **Step 2: QA matrix — open the same listing in four locales**

Pick a listing with a rich source description (BaT) and one with a sparse source (AutoScout24 or Be Forward). For each, visit:

- `/en/cars/porsche/<id>`
- `/es/cars/porsche/<id>`
- `/de/cars/porsche/<id>`
- `/ja/cars/porsche/<id>`

Check for each:
1. The "Über dieses Fahrzeug" card first shows a skeleton, then a headline + bullets in the expected language.
2. No banned-hype phrases (stunning, amazing, pristine, must-see) are present.
3. No sentence matches the seller description verbatim (the full source is still visible in the "Seller's Description" section lower down for comparison).
4. Sparse-source listings produce 2–3 honest bullets, not 5 filler bullets.

- [ ] **Step 3: Fault-injection QA**

Temporarily run with `GEMINI_API_KEY` blanked:

```bash
LISTING_REWRITER_ENABLED=true GEMINI_API_KEY= npm run dev
```

Open the same listing and confirm the card falls back to the `aboutFallback` placeholder copy. No error visible to the user. Restore the key after.

- [ ] **Step 4: Rate-limit QA**

Using a browser devtools console:

```js
for (let i = 0; i < 12; i++) {
  fetch("/api/listings/live-XXXX/rewrite?locale=en").then(r => console.log(r.status))
}
```

Expected: first ~10 responses are `200` (or `204` if the listing id is invalid); subsequent responses are `429`.

- [ ] **Step 5: DB verification**

Open Supabase SQL editor and run:

```sql
select listing_id, locale, prompt_version, model, generated_at
from public.listing_translations
order by generated_at desc
limit 10;
```

Expected: rows for the listings + locales you visited, with `prompt_version = '1.0.0'`, `model = 'gemini-2.5-flash'`, recent `generated_at`.

- [ ] **Step 6: Commit a QA note (optional)**

If any issues were fixed during manual QA, commit those fixes with descriptive messages. Otherwise no commit needed — this task is verification only.

---

## Rollout reminder (from the spec, not a coding task)

After merge:

1. Deploy with `LISTING_REWRITER_ENABLED=false`. Verify no regression on the detail page.
2. Enable in staging. Run Task 13's manual QA.
3. Flip the flag to `true` in production for locale `en` only (feature-flag per-locale gating is not part of this MVP — if needed, gate client-side behind `useLocale() === "en"` in `CarDetailClient`).
4. After 48h of stable logs (no spike in `rewrite_failed` events), enable the remaining locales one at a time, 24h apart.
5. Remove the flag once stable.
