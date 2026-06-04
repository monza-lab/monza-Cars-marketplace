# Elferspot Enrichment 100 Percent Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve 100% Elferspot description and price coverage by separating numeric price extraction from explicit no-price statuses such as sold, POA, or hidden price.

**Architecture:** Keep Elferspot enrichment in the existing collector slice. The detail parser must return both description and price-status evidence from the page. The enrichment route must process missing descriptions independently from price-null sold/no-price rows, so unfillable price rows cannot starve description coverage.

**Tech Stack:** TypeScript, Cheerio, Supabase JS, Vitest, existing Scrapling fallback. No new runtime dependencies.

---

## Phase Zero Context

- OS: Windows, PowerShell 5.1.26100.8457
- Node: v24.5.0
- npm: 11.5.2
- Current commit observed during diagnosis: `1b33686`
- Relevant env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `SCRAPLING_PYTHON=python`
- Non-functional requirements: do not fabricate sold/hidden prices; keep old active listings auditable; ensure the enrichment loop progresses even when source pages have no numeric price.

## Locality Budget

{files: 6 modified + 1 migration, LOC/file: target <= 300 changed LOC per file and <= 1000 total new/changed LOC, deps: 0}

## Coverage Definition

- Description coverage: `description_text` is not null and not empty for every active Elferspot row.
- Price coverage: either `hammer_price` is a positive number, or `enrichment_meta->'priceStatus'` records `sold`, `price_on_request`, `hidden`, `not_listed`, `detail_unavailable`, or `blocked_unverified`.
- Numeric price coverage remains separately visible as `hammer_price` fill rate; it must not be used as the only operational coverage gate because some Elferspot pages expose no price.

## Files

- Create: `supabase/migrations/20260528_add_listing_enrichment_meta.sql` if not already created by the AS24 plan.
- Modify: `src/features/scrapers/elferspot_collector/types.ts`
  - Add `priceStatus` and `descriptionStatus`.
- Modify: `src/features/scrapers/elferspot_collector/detail.ts`
  - Extract page description from JSON-LD WebPage description as fallback.
  - Extract price status from visible price block.
- Modify: `src/features/scrapers/elferspot_collector/normalize.ts`
  - Carry price/description status into normalized metadata if collector writes fresh rows.
- Modify: `src/features/scrapers/elferspot_collector/supabase_writer.ts`
  - Persist `enrichment_meta`.
- Modify: `src/app/api/cron/enrich-elferspot/route.ts`
  - Split description queue and price queue.
  - Mark no-price rows as covered with evidence instead of repeatedly retrying them.
- Modify: `scripts/enrich-loop-quality.ts`
  - Count Elferspot price coverage using numeric price OR audited status.
- Test: `src/features/scrapers/elferspot_collector/detail.test.ts`
- Test: `src/app/api/cron/enrich-elferspot/route.test.ts`

## Task 1: Add Enrichment Metadata Column

**Files:**
- Create: `supabase/migrations/20260528_add_listing_enrichment_meta.sql`

- [ ] **Step 1: Reuse the shared migration if not already present**

```sql
alter table public.listings
  add column if not exists enrichment_meta jsonb not null default '{}'::jsonb;

create index if not exists listings_source_status_enrichment_meta_gin_idx
  on public.listings using gin (enrichment_meta)
  where status = 'active';
```

- [ ] **Step 2: Apply migration**

Run: `npx tsx scripts/run-migration.mjs supabase/migrations/20260528_add_listing_enrichment_meta.sql`

Expected: success or already-exists messages only.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260528_add_listing_enrichment_meta.sql
git commit -m "db: add listing enrichment metadata"
```

## Task 2: Parse Elferspot Description and Price Status Separately

**Files:**
- Modify: `src/features/scrapers/elferspot_collector/types.ts`
- Modify: `src/features/scrapers/elferspot_collector/detail.ts`
- Test: `src/features/scrapers/elferspot_collector/detail.test.ts`

- [ ] **Step 1: Extend detail type**

Add to `ElferspotDetail`:

```ts
priceStatus: "numeric" | "sold" | "price_on_request" | "hidden" | "not_listed" | "unknown";
descriptionStatus: "present" | "missing";
```

- [ ] **Step 2: Write failing parser tests**

```ts
it("uses JSON-LD WebPage description when highlight blocks are missing", () => {
  const html = `
    <html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[{"@type":"WebPage","description":"A documented 964 Turbo in Guards Red."}]}
    </script></head><body><div class="price"><span class="p">Sold</span></div></body></html>`;

  const detail = parseDetailPage(html);

  expect(detail.descriptionText).toBe("A documented 964 Turbo in Guards Red.");
  expect(detail.descriptionStatus).toBe("present");
  expect(detail.price).toBeNull();
  expect(detail.priceStatus).toBe("sold");
});

it("extracts numeric EUR price from visible price block", () => {
  const html = `<html><body><div class="price"><span class="p">EUR 87,990</span></div></body></html>`;
  const detail = parseDetailPage(html);
  expect(detail.price).toBe(87990);
  expect(detail.currency).toBe("EUR");
  expect(detail.priceStatus).toBe("numeric");
});
```

- [ ] **Step 3: Run failing tests**

Run: `npx vitest run src/features/scrapers/elferspot_collector/detail.test.ts`

Expected: FAIL because statuses and JSON-LD WebPage description fallback are missing.

- [ ] **Step 4: Implement parsing helpers**

Add:

```ts
function extractWebPageDescription(html: string): string | null {
  const $ = cheerio.load(html);
  let description: string | null = null;
  $('script[type="application/ld+json"]').each((_i, el) => {
    if (description) return false;
    try {
      const parsed = JSON.parse($(el).html() || "");
      const items = Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
      for (const item of items) {
        if (item["@type"] === "WebPage" && typeof item.description === "string" && item.description.trim()) {
          description = item.description.trim();
          return false;
        }
      }
    } catch {}
  });
  return description;
}

function classifyElferspotPrice(priceText: string, price: number | null) {
  const text = priceText.toLowerCase();
  if (price && price > 0) return "numeric" as const;
  if (text.includes("sold")) return "sold" as const;
  if (text.includes("price on request") || text.includes("poa")) return "price_on_request" as const;
  if (text.includes("reserved")) return "hidden" as const;
  if (!priceText.trim()) return "not_listed" as const;
  return "unknown" as const;
}
```

Update description:

```ts
const descriptionText =
  descParts.length > 0 ? descParts.join("\n") : extractWebPageDescription(html);
```

Update return object:

```ts
priceStatus: classifyElferspotPrice($("div.price").first().text().trim(), price),
descriptionStatus: descriptionText ? "present" : "missing",
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/features/scrapers/elferspot_collector/detail.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/scrapers/elferspot_collector/types.ts src/features/scrapers/elferspot_collector/detail.ts src/features/scrapers/elferspot_collector/detail.test.ts
git commit -m "fix: classify Elferspot price and description coverage"
```

## Task 3: Persist Elferspot Coverage Metadata

**Files:**
- Modify: `src/features/scrapers/elferspot_collector/normalize.ts`
- Modify: `src/features/scrapers/elferspot_collector/supabase_writer.ts`

- [ ] **Step 1: Add metadata to normalized listing**

In normalized output, include:

```ts
enrichment_meta: {
  elferspot: {
    priceStatus: detail?.priceStatus ?? "unknown",
    descriptionStatus: detail?.descriptionStatus ?? (detail?.descriptionText ? "present" : "missing"),
    checkedAt: new Date().toISOString(),
  },
},
```

- [ ] **Step 2: Persist metadata**

In `supabase_writer.ts`, add:

```ts
enrichment_meta: listing.enrichment_meta,
```

- [ ] **Step 3: Run collector tests**

Run: `npx vitest run src/features/scrapers/elferspot_collector`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/scrapers/elferspot_collector/normalize.ts src/features/scrapers/elferspot_collector/supabase_writer.ts
git commit -m "feat: persist Elferspot enrichment coverage metadata"
```

## Task 4: Split Elferspot Enrichment Queues

**Files:**
- Modify: `src/app/api/cron/enrich-elferspot/route.ts`
- Test: `src/app/api/cron/enrich-elferspot/route.test.ts`

- [ ] **Step 1: Write route test for description priority**

```ts
it("queries missing descriptions before price-only gaps", async () => {
  await GET(makeRequest());

  expect(mockFrom).toHaveBeenCalledWith("listings");
  expect(mockOr).toHaveBeenCalledWith("description_text.is.null,description_text.eq.");
});
```

- [ ] **Step 2: Replace single mixed query with two queues**

Implement:

```ts
async function fetchRows(client: SupabaseClient, filter: "description" | "price", limit: number) {
  let q = client
    .from("listings")
    .select("id,source_url,enrichment_meta")
    .eq("source", "Elferspot")
    .eq("status", "active")
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (filter === "description") {
    return q.or("description_text.is.null,description_text.eq.");
  }

  return q
    .is("hammer_price", null)
    .not("enrichment_meta->elferspot->>priceStatus", "in", '("sold","price_on_request","hidden","not_listed","detail_unavailable","blocked_unverified")');
}
```

Use `descriptionRows` first, then fill remaining capacity with `priceRows`:

```ts
const descriptionRows = await fetchRows(client, "description", 50);
const remaining = Math.max(0, 50 - (descriptionRows.data?.length ?? 0));
const priceRows = remaining > 0 ? await fetchRows(client, "price", remaining) : { data: [] };
const rows = [...(descriptionRows.data ?? []), ...(priceRows.data ?? [])];
```

- [ ] **Step 3: Mark price statuses**

When `detail.priceStatus !== "numeric"`, update:

```ts
update.enrichment_meta = {
  ...existingMeta,
  elferspot: {
    ...(existingMeta.elferspot ?? {}),
    priceStatus: detail.priceStatus,
    descriptionStatus: detail.descriptionStatus,
    checkedAt: new Date().toISOString(),
  },
};
```

- [ ] **Step 4: Run route tests**

Run: `npx vitest run src/app/api/cron/enrich-elferspot/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/enrich-elferspot/route.ts src/app/api/cron/enrich-elferspot/route.test.ts
git commit -m "fix: separate Elferspot description and price queues"
```

## Task 5: Update Quality Gate for Elferspot Price Coverage

**Files:**
- Modify: `scripts/enrich-loop-quality.ts`

- [ ] **Step 1: Replace Elferspot price target field**

Change:

```ts
{ source: "Elferspot", field: "hammer_price", targetPct: 80, label: "Elferspot prices" },
```

to:

```ts
{ source: "Elferspot", field: "price_coverage", targetPct: 100, label: "Elferspot prices" },
```

- [ ] **Step 2: Count numeric or audited status**

In `countFillRate`, special-case Elferspot `price_coverage`:

```ts
if (field === "price_coverage") {
  const numeric = await baseQueryFor(source).not("hammer_price", "is", null);
  const audited = await baseQueryFor(source)
    .is("hammer_price", null)
    .not("enrichment_meta->elferspot->>priceStatus", "is", null);
  return { total: total ?? 0, filled: (numeric.count ?? 0) + (audited.count ?? 0) };
}
```

- [ ] **Step 3: Run quality check**

Run: `npx tsx scripts/run-scrapers.ts --enrich-loop --max-iterations=3 --pause=0`

Expected: Elferspot description coverage increases first; Elferspot price coverage counts numeric prices plus audited no-price statuses.

- [ ] **Step 4: Commit**

```bash
git add scripts/enrich-loop-quality.ts
git commit -m "feat: count audited Elferspot price coverage"
```

## Testscript ELFERSPOT-100

**Objective:** Prove Elferspot reaches 100% description and price coverage without inventing numeric prices.

**Run:**

```bash
npx vitest run src/features/scrapers/elferspot_collector/detail.test.ts src/app/api/cron/enrich-elferspot/route.test.ts
npx tsx scripts/run-scrapers.ts --enrich-loop --max-iterations=5 --pause=0
```

**Expected observations:**
- Parser tests pass for numeric price, sold price, and JSON-LD description fallback.
- Route tests show description queue runs before price-only queue.
- Quality check reports Elferspot descriptions at 100%.
- Quality check reports Elferspot prices at 100% under numeric-or-audited coverage.
- A separate manual DB count can still show numeric `hammer_price` below 100%, which is expected when pages are sold/POA/no-price.

## Self-Review

- Spec coverage: Elferspot description and price coverage are both addressed.
- Placeholder scan: no TBD or deferred steps.
- Type consistency: `priceStatus`, `descriptionStatus`, and `enrichment_meta.elferspot` are used consistently.
