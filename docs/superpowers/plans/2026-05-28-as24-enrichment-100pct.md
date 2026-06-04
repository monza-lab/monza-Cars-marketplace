# AS24 Enrichment 100 Percent Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve 100% AS24 description, trim, and price coverage by preventing summary-only discovery from nulling enriched fields and by making price coverage auditable.

**Architecture:** Keep AutoScout24 as one vertical scraper slice. Discovery may upsert summary fields, but must preserve existing enriched detail fields unless a fresh detail scrape provides replacements. Price coverage is numeric `hammer_price/current_bid` when AS24 exposes a price, otherwise an explicit unavailable reason recorded in a small enrichment metadata column.

**Tech Stack:** TypeScript, Supabase JS, Vitest, existing Scrapling Python fetcher. No new runtime dependencies.

---

## Phase Zero Context

- OS: Windows, PowerShell 5.1.26100.8457
- Node: v24.5.0
- npm: 11.5.2
- Current commit observed during diagnosis: `1b33686`
- Relevant env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SCRAPLING_PYTHON=python`
- Non-functional requirements: do not fabricate marketplace prices; keep scraper writes deterministic; preserve active-listing freshness; keep enrichment loop observable through `scraper_runs`.

## Locality Budget

{files: 5 modified + 1 migration, LOC/file: target <= 250 changed LOC per file and <= 1000 total new/changed LOC, deps: 0}

## Coverage Definition

- Description coverage: `description_text` is not null and not empty for every active AS24 row.
- Trim coverage: `trim` is not null and not empty for every active AS24 row. If AS24 exposes no distinct trim, derive a conservative trim from title/model variant.
- Price coverage: either `hammer_price` is a positive number, or `enrichment_meta->'priceStatus'` records a non-numeric audited status such as `price_on_request`, `sold`, `reserved`, `not_listed`, or `blocked_unverified`.

## Files

- Modify: `src/features/scrapers/autoscout24_collector/supabase_writer.ts`
  - Preserve existing enriched fields during summary-only upserts.
  - Write `enrichment_meta` price status if needed.
- Modify: `src/features/scrapers/autoscout24_collector/normalize.ts`
  - Derive fallback trim from AS24 title when detail trim is absent.
  - Emit price coverage status.
- Modify: `scripts/as24-enrich-scrapling.ts`
  - Select rows missing description, trim, or audited price coverage, not just `trim IS NULL`.
  - Stop using empty string as the primary attempted sentinel.
- Modify: `scripts/enrich-loop-quality.ts`
  - Count AS24 price coverage as numeric price or audited unavailable status.
  - Keep description/trim strict.
- Create: `supabase/migrations/20260528_add_listing_enrichment_meta.sql`
  - Add nullable JSONB metadata column and indexes for coverage checks.
- Test: `src/features/scrapers/autoscout24_collector/supabase_writer.test.ts`
- Test: `src/features/scrapers/autoscout24_collector/normalize.test.ts`
- Test: `scripts/run-scrapers.test.ts` or nearest existing quality test target if `enrich-loop-quality` lacks tests.

## Task 1: Add Auditable Enrichment Metadata

**Files:**
- Create: `supabase/migrations/20260528_add_listing_enrichment_meta.sql`

- [ ] **Step 1: Write the migration**

```sql
alter table public.listings
  add column if not exists enrichment_meta jsonb not null default '{}'::jsonb;

create index if not exists listings_source_status_enrichment_meta_gin_idx
  on public.listings using gin (enrichment_meta)
  where status = 'active';
```

- [ ] **Step 2: Apply migration locally**

Run: `npx tsx scripts/run-migration.mjs supabase/migrations/20260528_add_listing_enrichment_meta.sql`

Expected: migration succeeds, or reports objects already exist on repeat.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260528_add_listing_enrichment_meta.sql
git commit -m "db: add listing enrichment metadata"
```

## Task 2: Preserve AS24 Enriched Fields on Discovery Upsert

**Files:**
- Modify: `src/features/scrapers/autoscout24_collector/supabase_writer.ts`
- Test: `src/features/scrapers/autoscout24_collector/supabase_writer.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that prove summary-only rows do not null existing detail fields:

```ts
it("omits detail-only nulls from summary-only AS24 rows", () => {
  const row = mapNormalizedListingToListingsRow({
    ...baseListing,
    trim: null,
    bodyStyle: null,
    engine: null,
    transmission: null,
    exteriorColor: null,
    interiorColor: null,
    vin: null,
    descriptionText: null,
    photos: [],
    photosCount: 0,
    pricing: { ...baseListing.pricing, hammerPrice: 87990, currentBid: 87990 },
  }, baseMeta);

  expect(row).not.toHaveProperty("trim");
  expect(row).not.toHaveProperty("description_text");
  expect(row).not.toHaveProperty("engine");
  expect(row).toMatchObject({
    source: "AutoScout24",
    hammer_price: 87990,
    current_bid: 87990,
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npx vitest run src/features/scrapers/autoscout24_collector/supabase_writer.test.ts`

Expected: FAIL because mapper currently includes `trim: null` and `description_text: null`.

- [ ] **Step 3: Implement minimal mapper change**

Add a local helper:

```ts
function setIfPresent(row: Record<string, unknown>, key: string, value: unknown): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string" && value.trim() === "") return;
  if (Array.isArray(value) && value.length === 0) return;
  row[key] = value;
}
```

Change `mapNormalizedListingToListingsRow()` so stable discovery fields are always included, and detail-only fields use `setIfPresent()`:

```ts
const row: Record<string, unknown> = {
  source: listing.source,
  source_id: listing.sourceId,
  source_url: listing.sourceUrl,
  year: listing.year,
  make: truncate(listing.make, 100),
  model: truncate(listing.model, 100),
  hammer_price: listing.pricing.hammerPrice,
  current_bid: listing.pricing.currentBid,
  original_currency: listing.pricing.originalCurrency,
  status: listing.status,
  scrape_timestamp: meta.scrapeTimestamp,
  updated_at: meta.scrapeTimestamp,
  last_verified_at: new Date().toISOString(),
  title: listing.title,
  platform: listing.platform,
  series: computeSeries({ make: listing.make, model: listing.model, year: listing.year, title: listing.title }),
};

setIfPresent(row, "trim", truncate(listing.trim, 100));
setIfPresent(row, "body_style", truncate(listing.bodyStyle, 100));
setIfPresent(row, "engine", truncate(listing.engine, 100));
setIfPresent(row, "transmission", truncate(listing.transmission, 100));
setIfPresent(row, "color_exterior", truncate(listing.exteriorColor, 100));
setIfPresent(row, "color_interior", truncate(listing.interiorColor, 100));
setIfPresent(row, "vin", truncate(listing.vin, 17));
setIfPresent(row, "description_text", listing.descriptionText);
setIfPresent(row, "images", listing.photos);
if (listing.photosCount > 0) row.photos_count = listing.photosCount;
return row;
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/features/scrapers/autoscout24_collector/supabase_writer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/autoscout24_collector/supabase_writer.ts src/features/scrapers/autoscout24_collector/supabase_writer.test.ts
git commit -m "fix: preserve AS24 enriched fields during discovery"
```

## Task 3: Derive Conservative AS24 Trim

**Files:**
- Modify: `src/features/scrapers/autoscout24_collector/normalize.ts`
- Test: `src/features/scrapers/autoscout24_collector/normalize.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
it("derives trim from AS24 title when detail trim is absent", () => {
  expect(deriveTrimFromTitle("Porsche 911 3.6i GT3 CS", "911")).toBe("3.6i GT3 CS");
  expect(deriveTrimFromTitle("Porsche 911 TYPE 996 CARRERA 2 3.4 300 ch", "911")).toBe("TYPE 996 CARRERA 2 3.4 300 ch");
  expect(deriveTrimFromTitle("Porsche Boxster", "Boxster")).toBe("Base");
});
```

- [ ] **Step 2: Run failing test**

Run: `npx vitest run src/features/scrapers/autoscout24_collector/normalize.test.ts`

Expected: FAIL because `deriveTrimFromTitle` does not exist.

- [ ] **Step 3: Implement trim derivation**

```ts
export function deriveTrimFromTitle(title: string, model: string | null): string {
  const cleaned = title.replace(/^Porsche\s+/i, "").trim();
  if (!model) return cleaned || "Base";
  const pattern = new RegExp(`^${escapeRegExp(model)}\\s*`, "i");
  const remainder = cleaned.replace(pattern, "").trim();
  return remainder || "Base";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

Update normalized trim:

```ts
const fallbackTrim = deriveTrimFromTitle(search.title, model);
trim: detail?.trim ?? fallbackTrim,
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/features/scrapers/autoscout24_collector/normalize.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/autoscout24_collector/normalize.ts src/features/scrapers/autoscout24_collector/normalize.test.ts
git commit -m "fix: derive AS24 trim from title"
```

## Task 4: Select AS24 Rows by Actual Missing Coverage

**Files:**
- Modify: `scripts/as24-enrich-scrapling.ts`

- [ ] **Step 1: Replace `trim IS NULL` selection**

Change the query to:

```ts
.or("trim.is.null,trim.eq.,description_text.is.null,description_text.eq.,hammer_price.is.null")
```

Keep `.eq("source", "AutoScout24")`, `.eq("status", "active")`, `.order("updated_at", { ascending: true })`, and the existing limit.

- [ ] **Step 2: Stop writing empty trim as success sentinel**

Initialize updates as:

```ts
const updates: Record<string, unknown> = {
  updated_at: new Date().toISOString(),
};
```

If no detail data is returned, write only:

```ts
updates.enrichment_meta = {
  ...(listing.enrichment_meta ?? {}),
  as24Detail: {
    attemptedAt: new Date().toISOString(),
    status: "detail_unavailable",
  },
};
```

- [ ] **Step 3: Run preflight**

Run: `npx tsx scripts/as24-enrich-scrapling.ts --limit=5 --preflight`

Expected: at least 2 of 5 rows return detail data. If fewer, stop and inspect Scrapling/proxy before batch.

- [ ] **Step 4: Commit**

```bash
git add scripts/as24-enrich-scrapling.ts
git commit -m "fix: enrich AS24 by coverage gaps"
```

## Task 5: Update Quality Gate for AS24 Price Coverage

**Files:**
- Modify: `scripts/enrich-loop-quality.ts`

- [ ] **Step 1: Add AS24 price target**

Add:

```ts
{ source: "AutoScout24", field: "price_coverage", targetPct: 100, label: "AS24 prices" },
```

- [ ] **Step 2: Count price coverage**

In `countFillRate`, special-case `price_coverage`:

```ts
if (field === "price_coverage") {
  filledQuery = filledQuery.or(
    "hammer_price.not.is.null,enrichment_meta->priceStatus.not.is.null"
  );
}
```

If Supabase filter syntax rejects JSON path in `.or()`, replace with two exact count queries and return summed unique counts by source.

- [ ] **Step 3: Run quality check**

Run: `npx tsx -e "import { createClient } from '@supabase/supabase-js'; import { checkQuality, printQualityReport } from './scripts/enrich-loop-quality'; const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); checkQuality(sb).then(printQualityReport)"`

Expected: AS24 description/trim gaps reflect only genuinely missing rows; AS24 price target appears.

- [ ] **Step 4: Commit**

```bash
git add scripts/enrich-loop-quality.ts
git commit -m "feat: track AS24 price coverage"
```

## Testscript AS24-100

**Objective:** Prove AS24 reaches 100% coverage without nulling enriched detail fields.

**Run:**

```bash
npx vitest run src/features/scrapers/autoscout24_collector/normalize.test.ts src/features/scrapers/autoscout24_collector/supabase_writer.test.ts
npx tsx scripts/as24-enrich-scrapling.ts --limit=100 --preflight
npx tsx scripts/run-scrapers.ts --enrich-loop --max-iterations=5 --pause=0
```

**Expected observations:**
- Unit tests pass.
- Preflight returns detail data for representative rows.
- AS24 descriptions, trim, and prices report 100% coverage under the revised quality definition.
- `scraper_runs` shows nonzero `written` for `as24-enrich` when gaps existed.

## Self-Review

- Spec coverage: AS24 description, trim, and price coverage are all covered.
- Placeholder scan: no TBD or deferred implementation steps.
- Type consistency: `enrichment_meta` is used consistently as JSONB metadata.
