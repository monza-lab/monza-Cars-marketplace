# Data Quality System — Design Spec

**Date:** 2026-03-14
**Status:** Approved

## Problem

Scrapers save listings with bad model data:
- **"PORSCHE"** (231 listings) — BeForward's `porsche-others` category, `parseModelFromTitle()` fails
- **"Others"** (91 listings) — AutoScout24 API catch-all category, accepted without validation
- **Colors as models** (~30 listings) — BaT extracts "Racing Green Metallic" as model
- **Non-cars** (boats, bikes, minibikes) — BaT matches any title containing "Porsche"

No validation layer exists between scrapers and the database.

## Solution: 3-Layer Validation

### Layer 1: `src/lib/listingValidator.ts` (shared module)

Central validation + model fixing logic used by all layers.
All string comparisons are **case-insensitive** (`.toLowerCase()` before comparing).

```typescript
interface ValidationResult {
  valid: boolean
  fixedModel?: string   // corrected model if extraction succeeded
  reason?: string       // rejection reason if invalid
}

// Main exports
export function validateListing(listing: {
  make: string; model: string; title: string; year?: number
}): ValidationResult

export function isNonCar(model: string, title: string): string | null
// Returns rejection reason or null. Checks model field for keywords.
// "diesel" rule has Cayenne exception (same as existing cleanup cron).

export function tryExtractModel(title: string, year: number | undefined, make: string): string | null
// Extracts model substring from title (e.g. "2019 Porsche 911 Carrera S" → "911 Carrera S").
// Then validates via extractSeries() + getSeriesConfig() to confirm it maps to a known series.
// Returns the extracted model string (NOT the series ID) or null if extraction fails.
```

**`tryExtractModel` logic:**
1. Strip year and make from title → remaining = candidate model string
2. Call `extractSeries(candidate, year, make)` → get series ID
3. Call `getSeriesConfig(seriesId, make)` → if not null, the candidate is valid
4. Return the candidate model string (e.g. "911 Carrera S"), not the series ID
5. If no valid series found → return null

**Validation rules (in order):**
1. Non-Porsche make → reject
2. Non-car keywords in **model** field (tractor, boat, bike, literature, etc.) → reject
3. Non-car keywords in **title** only when model is also suspicious → reject
4. Invalid model values ("PORSCHE", "Others", "", colors) → try `tryExtractModel()` from title
5. If extraction succeeds → return `{ valid: true, fixedModel: extractedModel }`
6. If extraction fails → reject

**Color detection:** Check if model matches any known Porsche color. If so, treat as invalid model and try extraction from title.

### Layer 2: Write-time gate (each `supabase_writer.ts`)

Before `upsert()`, call `validateListing()`.

**For the 5 writers using `createSupabaseWriter()` pattern:**
In `upsertAll()`:
1. Call `validateListing(listing)`
2. If `valid === false` → skip upsert, log reason, return `{ wrote: false }`
3. If `fixedModel` exists → use it instead of original model
4. Proceed with upsert

**For `porsche_ingest` writer (different interface):**
In `upsertCanonicalListing()`, call `validateListing({ make: listing.make, model: listing.model, title: listing.title, year: listing.year })` before the upsert. Same logic applies.

**Files to modify (5 Porsche-related writers):**
- `src/features/porsche_collector/supabase_writer.ts`
- `src/features/beforward_porsche_collector/supabase_writer.ts`
- `src/features/classic_collector/supabase_writer.ts`
- `src/features/autoscout24_collector/supabase_writer.ts`
- `src/features/autotrader_collector/supabase_writer.ts`
- `src/features/porsche_ingest/repository/supabase_writer.ts` (uses `upsertCanonicalListing`, not `upsertAll`)

**Excluded:** `src/features/ferrari_collector/supabase_writer.ts` — Ferrari is a separate brand. The validator's "non-Porsche make" rule would reject all Ferrari listings. Ferrari validation, if needed, is a separate concern.

### Layer 3: Post-scrape validation cron (`/api/cron/validate`)

Runs at **5:30 UTC** (after all scrapers, before cleanup at 6:00).
`export const maxDuration = 60;`

1. Query ALL listings updated in last 25 hours (not just bad-model rows, since color-as-model can't be caught by SQL alone)
2. Run `validateListing()` on each
3. If `fixedModel` → update model in DB
4. If `valid === false` → delete listing + price_history
5. Return summary (scanned, fixed, deleted, by-reason)

**Note:** After Layer 2 is deployed, this cron becomes a safety net. It primarily handles:
- Listings that pre-date the Layer 2 deployment
- Edge cases where a scraper bypasses the writer validation

### Layer 0 (existing): Enhanced cleanup cron

Add to existing `/api/cron/cleanup` `detectJunk()`:
- boat/craft keywords
- bike/minibike keywords

This remains the final safety net for obvious non-car junk.

## Non-car keywords

```typescript
// Checked against model field. Title is only checked when model is also suspicious.
const NON_CAR_KEYWORDS = [
  'tractor', 'literature', 'press kit', 'tool kit',
  'apal', 'genie', 'kenworth', 'boat', 'craft', 'bike',
  'minibike', 'scooter', 'autonacional', 'projects unlimited',
]

// Special rule: "diesel" in model → reject UNLESS model also contains "cayenne"
```

## Invalid model values

```typescript
// Compared case-insensitively (.toLowerCase())
const INVALID_MODELS = ['porsche', 'others', 'other', '']
```

## Known Porsche colors (for color-as-model detection)

```typescript
// Match if model.toLowerCase().startsWith(color) to avoid false positives on short words
const PORSCHE_COLORS = [
  'racing green', 'guards red', 'speed yellow', 'miami blue',
  'gentian blue', 'lava orange', 'frozen blue', 'crayon',
  'irish green', 'signal green', 'riviera blue', 'mexico blue',
  'rubystone red', 'maritime blue', 'gulf blue', 'python green',
  'chalk white', 'nardo grey', 'oak green', 'stone grey',
  'arena red', 'jet black', 'night blue', 'shark blue',
  // Short single-word colors like "chalk" or "crayon" require exact model match
]
```

## Immediate DB cleanup

Delete these known non-car listings before the system goes live:
- Craig Craft boats (2)
- Autonacional microcar (1)
- Di Blasi minibike (1)
- Projects Unlimited kit car (1)
- Porsche Bike (1)

## Vercel cron schedule (updated)

```json
{ "path": "/api/cron/validate", "schedule": "30 5 * * *" }
```

## Files created/modified

| File | Action |
|------|--------|
| `src/lib/listingValidator.ts` | **CREATE** — shared validation module |
| `src/app/api/cron/validate/route.ts` | **CREATE** — post-scrape validation cron |
| `src/app/api/cron/cleanup/route.ts` | **MODIFY** — add boat/bike rules to detectJunk |
| `src/features/porsche_collector/supabase_writer.ts` | **MODIFY** — add validation gate |
| `src/features/beforward_porsche_collector/supabase_writer.ts` | **MODIFY** — add validation gate |
| `src/features/classic_collector/supabase_writer.ts` | **MODIFY** — add validation gate |
| `src/features/autoscout24_collector/supabase_writer.ts` | **MODIFY** — add validation gate |
| `src/features/autotrader_collector/supabase_writer.ts` | **MODIFY** — add validation gate |
| `src/features/porsche_ingest/repository/supabase_writer.ts` | **MODIFY** — add validation gate (different interface) |
| `vercel.json` | **MODIFY** — add validate cron schedule |
