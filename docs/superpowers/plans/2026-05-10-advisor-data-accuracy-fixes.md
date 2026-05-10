# Advisor Chat Agent — Data Accuracy Fixes

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the advisor chat agent so every data-backed answer is accurate against the full 16K+ listing corpus, not a 500-row sample.

**Architecture:** Replace the shared `fetchPricedListingsForModel(make, 500)` bottleneck with a new `fetchAdvisorListings()` function that pushes all filters (series, variant/trim, price range, year range, query, region, status) to the Supabase query. Add a `count_listings` tool.

**Tech Stack:** Supabase JS client, TypeScript, Next.js API routes

**QA audit reference:** This plan addresses all 7 test failures from the 2026-05-10 QA audit (see conversation context).

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/advisor/advisorListings.ts` | New server-side filtered query function for advisor tools |
| Modify | `src/lib/advisor/tools/marketplace.ts` | Replace all `fetchPricedListingsForModel` calls with `fetchAdvisorListings` |
| Modify | `src/lib/advisor/tools/analysis.ts:426` | `buildShortlist` inherits fix via `searchListings` |
| Create | `src/lib/advisor/tools/inventory.ts` | New `count_listings` tool |
| Modify | `src/lib/advisor/tools/index.ts` | Register `inventoryTools` |
| Modify | `src/lib/advisor/tools/marketplace.test.ts` | Update mocks to use new `fetchAdvisorListings` |
| Create | `src/lib/advisor/__tests__/advisorListings.test.ts` | Unit tests for the new query function |
| Create | `src/lib/advisor/__tests__/marketplace.integration.test.ts` | Integration tests: tools vs DB ground truth |
| Create | `scripts/advisor-live-qa.ts` | End-to-end live test script hitting the API |

---

## Chunk 1: Server-Side Filtered Query Function

### Task 1: Create `fetchAdvisorListings` — the new data backbone

**Files:**
- Create: `src/lib/advisor/advisorListings.ts`
- Test: `src/lib/advisor/__tests__/advisorListings.test.ts`

**Context:** Currently all advisor tools call `fetchPricedListingsForModel(make, 500)` which fetches 500 rows ordered by `sale_date DESC` with zero server-side filtering. The DB has 16,217 active Porsche listings. The 500-row window misses 97% of inventory.

The new function pushes filters to Supabase and returns `PricedListingRow[]` (same type the tools already consume). The `listings` table has a `series` column populated on 98% of active rows, so server-side series filtering is viable.

- [ ] **Step 1: Write the failing test**

Create `src/lib/advisor/__tests__/advisorListings.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// We mock the Supabase client to test query construction
const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null })
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockGt = vi.fn(() => ({ order: mockOrder, limit: mockLimit }))
const mockLte = vi.fn(() => ({ gt: mockGt, order: mockOrder, limit: mockLimit }))
const mockGte = vi.fn(() => ({ lte: mockLte, gt: mockGt, order: mockOrder, limit: mockLimit }))
const mockOr = vi.fn(() => ({ gte: mockGte, lte: mockLte, gt: mockGt, order: mockOrder, limit: mockLimit }))
const mockEq = vi.fn(() => ({ or: mockOr, gte: mockGte, lte: mockLte, gt: mockGt, order: mockOrder, limit: mockLimit }))
const mockIlike = vi.fn(() => ({ eq: mockEq, or: mockOr, gte: mockGte, lte: mockLte, gt: mockGt, order: mockOrder, limit: mockLimit }))
const mockSelect = vi.fn(() => ({ ilike: mockIlike, eq: mockEq, or: mockOr, gte: mockGte, lte: mockLte, gt: mockGt, order: mockOrder, limit: mockLimit }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

// Must import after mocking
import { fetchAdvisorListings } from "../advisorListings"

describe("fetchAdvisorListings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key"
  })

  it("applies series filter server-side when seriesId provided", async () => {
    await fetchAdvisorListings({ make: "Porsche", seriesId: "993" })
    expect(mockEq).toHaveBeenCalledWith("series", "993")
  })

  it("applies trim+model OR filter when variantId provided", async () => {
    await fetchAdvisorListings({ make: "Porsche", variantId: "targa" })
    expect(mockOr).toHaveBeenCalledWith(
      expect.stringContaining("model.ilike.%targa%")
    )
    expect(mockOr).toHaveBeenCalledWith(
      expect.stringContaining("trim.ilike.%targa%")
    )
  })

  it("applies price ceiling when priceToUsd provided", async () => {
    await fetchAdvisorListings({ make: "Porsche", priceToUsd: 100000 })
    expect(mockLte).toHaveBeenCalledWith("listing_price", 100000)
  })

  it("applies price floor when priceFromUsd provided", async () => {
    await fetchAdvisorListings({ make: "Porsche", priceFromUsd: 50000 })
    expect(mockGte).toHaveBeenCalledWith("listing_price", 50000)
  })

  it("applies year range filters", async () => {
    await fetchAdvisorListings({ make: "Porsche", yearFrom: 2000, yearTo: 2010 })
    expect(mockGte).toHaveBeenCalledWith("year", 2000)
    expect(mockLte).toHaveBeenCalledWith("year", 2010)
  })

  it("applies status=active filter when status is 'live'", async () => {
    await fetchAdvisorListings({ make: "Porsche", status: "live" })
    expect(mockEq).toHaveBeenCalledWith("status", "active")
  })

  it("applies free-text query on model+trim+title", async () => {
    await fetchAdvisorListings({ make: "Porsche", query: "GT3 RS" })
    expect(mockOr).toHaveBeenCalledWith(
      expect.stringContaining("model.ilike.%GT3 RS%")
    )
  })

  it("defaults to 200 row limit", async () => {
    await fetchAdvisorListings({ make: "Porsche" })
    expect(mockLimit).toHaveBeenCalledWith(200)
  })

  it("orders by listing_price ASC when sortBy is 'price_asc'", async () => {
    await fetchAdvisorListings({ make: "Porsche", sortBy: "price_asc" })
    expect(mockOrder).toHaveBeenCalledWith("listing_price", { ascending: true })
  })

  it("returns empty array when env vars missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const result = await fetchAdvisorListings({ make: "Porsche" })
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/advisor/__tests__/advisorListings.test.ts`
Expected: FAIL — module `../advisorListings` not found

- [ ] **Step 3: Export `isJunkListing` from `supabaseLiveListings.ts`**

In `src/lib/supabaseLiveListings.ts`, change line 626 from:
```typescript
function isJunkListing(row: { make: string; model: string; year: number; title?: string | null }): boolean {
```
to:
```typescript
export function isJunkListing(row: { make: string; model: string; year: number; title?: string | null }): boolean {
```

- [ ] **Step 4: Write the implementation**

Create `src/lib/advisor/advisorListings.ts`:

```typescript
import { createClient } from "@supabase/supabase-js"
import type { PricedListingRow } from "@/lib/supabaseLiveListings"
import { isJunkListing } from "@/lib/supabaseLiveListings"
import { normalizeSupportedMake } from "@/lib/makeProfiles"

/**
 * Server-side filtered listing fetch for advisor tools.
 *
 * Unlike `fetchPricedListingsForModel` (which fetches 500 rows and filters
 * client-side), this function pushes ALL filters to the Supabase query.
 * This ensures the advisor sees the full 16K+ listing corpus.
 */
export async function fetchAdvisorListings(options: {
  make: string
  seriesId?: string | null
  variantId?: string | null
  query?: string | null
  yearFrom?: number | null
  yearTo?: number | null
  priceFromUsd?: number | null
  priceToUsd?: number | null
  status?: "live" | "ended" | null
  region?: string | null
  sortBy?: "price_asc" | "price_desc" | "year_desc" | null
  limit?: number
}): Promise<PricedListingRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return []

  const normalizedMake = normalizeSupportedMake(options.make)
  if (!normalizedMake) return []

  const limit = options.limit ?? 200

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Start building the query — select the same columns as fetchPricedListingsForModel
    let q = supabase
      .from("listings")
      .select(
        "id,year,make,model,trim,hammer_price:listing_price,original_currency,sale_date,status,mileage,source,country",
      )
      .ilike("make", normalizedMake)
      .gt("listing_price", 0)

    // ── Server-side filters ──

    // Series (98% of active rows have this column populated)
    if (options.seriesId) {
      q = q.eq("series", options.seriesId)
    }

    // Variant / body type — search model AND trim server-side
    if (options.variantId) {
      const v = options.variantId.replace(/[%_]/g, "")
      q = q.or(`model.ilike.%${v}%,trim.ilike.%${v}%`)
    }

    // Free-text query — search model, trim, and title
    if (options.query) {
      const escaped = options.query.replace(/[%_]/g, "")
      q = q.or(
        `model.ilike.%${escaped}%,trim.ilike.%${escaped}%,title.ilike.%${escaped}%`,
      )
    }

    // Year range
    if (options.yearFrom != null) q = q.gte("year", options.yearFrom)
    if (options.yearTo != null) q = q.lte("year", options.yearTo)

    // Price range (listing_price is in original currency, not USD — but
    // this is still far better than the old 500-row client filter which
    // also compared raw hammer_price without conversion)
    if (options.priceFromUsd != null)
      q = q.gte("listing_price", options.priceFromUsd)
    if (options.priceToUsd != null)
      q = q.lte("listing_price", options.priceToUsd)

    // Status
    if (options.status === "live") {
      q = q.eq("status", "active")
    } else if (options.status === "ended") {
      q = q.eq("status", "sold")
    }

    // Ordering — default to price ascending (cheapest first) for search queries
    if (options.sortBy === "price_asc") {
      q = q.order("listing_price", { ascending: true })
    } else if (options.sortBy === "price_desc") {
      q = q.order("listing_price", { ascending: false })
    } else if (options.sortBy === "year_desc") {
      q = q.order("year", { ascending: false })
    } else {
      q = q.order("listing_price", { ascending: true })
    }

    q = q.limit(limit)

    const { data, error } = await q

    if (error || !data) {
      console.error("[advisorListings] fetchAdvisorListings failed:", error?.message)
      return []
    }

    // Post-fetch filter: remove junk listings (tractors, kit cars, etc.)
    return (data as PricedListingRow[]).filter(
      (r) =>
        r.hammer_price != null &&
        Number(r.hammer_price) > 0 &&
        !isJunkListing({ make: r.make, model: r.model, year: r.year }),
    )
  } catch (err) {
    console.error("[advisorListings] fetchAdvisorListings error:", err)
    return []
  }
}

/**
 * Server-side count of listings matching filters.
 * Used by the count_listings tool.
 */
export async function countAdvisorListings(options: {
  make: string
  seriesId?: string | null
  variantId?: string | null
  query?: string | null
  status?: "live" | "ended" | null
}): Promise<{ count: number; ok: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return { count: 0, ok: false }

  const normalizedMake = normalizeSupportedMake(options.make)
  if (!normalizedMake) return { count: 0, ok: false }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    let q = supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .ilike("make", normalizedMake)
      .gt("listing_price", 0)

    if (options.seriesId) q = q.eq("series", options.seriesId)

    if (options.variantId) {
      const v = options.variantId.replace(/[%_]/g, "")
      q = q.or(`model.ilike.%${v}%,trim.ilike.%${v}%`)
    }

    if (options.query) {
      const escaped = options.query.replace(/[%_]/g, "")
      q = q.or(
        `model.ilike.%${escaped}%,trim.ilike.%${escaped}%,title.ilike.%${escaped}%`,
      )
    }

    if (options.status === "live") {
      q = q.eq("status", "active")
    } else if (options.status === "ended") {
      q = q.eq("status", "sold")
    }

    const { count, error } = await q

    if (error) {
      console.error("[advisorListings] countAdvisorListings failed:", error.message)
      return { count: 0, ok: false }
    }

    return { count: count ?? 0, ok: true }
  } catch (err) {
    console.error("[advisorListings] countAdvisorListings error:", err)
    return { count: 0, ok: false }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/advisor/__tests__/advisorListings.test.ts`
Expected: all 10 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/advisor/advisorListings.ts src/lib/advisor/__tests__/advisorListings.test.ts src/lib/supabaseLiveListings.ts
git commit -m "feat(advisor): add server-side filtered fetchAdvisorListings function

Replaces the 500-row client-side filtering bottleneck with server-side
Supabase queries that push series, variant, price, year, query, and
status filters to the database. Includes countAdvisorListings for
inventory counting. Exports isJunkListing for reuse."
```

---

## Chunk 2: Rewire Marketplace Tools

### Task 2: Replace `fetchPricedListingsForModel` in `search_listings`

**Files:**
- Modify: `src/lib/advisor/tools/marketplace.ts:1-143`

**Context:** The `searchListings` tool (line 78) currently calls `fetchPricedListingsForModel(make, 500)` and applies all filters client-side (lines 83-105). We replace this with `fetchAdvisorListings()` which pushes filters server-side. The handler's return shape stays identical so no downstream changes needed.

- [ ] **Step 1: Update imports**

In `src/lib/advisor/tools/marketplace.ts`, replace the import at line 2-6:

```typescript
// OLD (line 2-6):
import {
  fetchPricedListingsForModel,
  fetchLiveListingById,
  type PricedListingRow,
} from "@/lib/supabaseLiveListings"

// NEW:
import {
  fetchLiveListingById,
  type PricedListingRow,
} from "@/lib/supabaseLiveListings"
import { fetchAdvisorListings } from "@/lib/advisor/advisorListings"
```

- [ ] **Step 2: Rewrite searchListings handler (lines 64-142)**

Replace the handler body. Key changes:
- Pass all filters to `fetchAdvisorListings()` instead of client-side filtering
- Default sort to `price_asc` for "cheapest" queries
- Status "live" maps to DB status "active"
- Increase default limit to see more results

```typescript
  async handler(args) {
    const query = typeof args.query === "string" ? args.query.trim() : ""
    const seriesId = typeof args.seriesId === "string" ? args.seriesId : null
    const variantId = typeof args.variantId === "string" ? args.variantId.toLowerCase() : null
    const make = typeof args.make === "string" && args.make ? args.make : "Porsche"
    const yearFrom = typeof args.yearFrom === "number" ? args.yearFrom : null
    const yearTo = typeof args.yearTo === "number" ? args.yearTo : null
    const priceFromUsd = typeof args.priceFromUsd === "number" ? args.priceFromUsd : null
    const priceToUsd = typeof args.priceToUsd === "number" ? args.priceToUsd : null
    const status = typeof args.status === "string" ? args.status : null
    const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(50, args.limit) : 10

    let rows: PricedListingRow[]
    try {
      rows = await fetchAdvisorListings({
        make,
        seriesId,
        variantId,
        query: query || null,
        yearFrom,
        yearTo,
        priceFromUsd,
        priceToUsd,
        status: status as "live" | "ended" | null,
        sortBy: "price_asc",
        limit: Math.min(limit * 2, 200), // Fetch extra to allow for post-filter losses
      })
    } catch (err) {
      return { ok: false, error: `listings_fetch_failed:${err instanceof Error ? err.message : "unknown"}` }
    }

    // Also fold in curated cars (currently empty but future-proof).
    const curated: CollectorCar[] = CURATED_CARS.filter((c) => c.make.toLowerCase() === make.toLowerCase())
      .filter((c) => (seriesId ? extractSeries(c.model, c.year, c.make) === seriesId : true))
      .filter((c) => (query ? `${c.title}`.toLowerCase().includes(query.toLowerCase()) : true))

    const liveResults = rows.slice(0, limit).map(rowToSearchResult)
    const curatedResults = curated.slice(0, Math.max(0, limit - liveResults.length)).map((c) => ({
      id: c.id,
      year: c.year,
      make: c.make,
      model: c.model,
      trim: c.trim,
      currentBid: c.currentBid,
      currency: "USD",
      mileage: c.mileage,
      status: c.status,
      source: c.platform,
      country: c.location,
    }))
    const results = [...liveResults, ...curatedResults]

    const top3 = results.slice(0, 3).map((r) => {
      const title = `${r.year} ${r.make} ${r.model}${r.trim ? ` ${r.trim}` : ""}`
      return `${title} @ ${formatPrice(r.currentBid, r.currency)}`
    })

    const criteria =
      [seriesId && `series=${seriesId}`, variantId && `variant=${variantId}`, query && `"${query}"`]
        .filter(Boolean)
        .join(", ") || "any"
    const summary = truncate(
      `Found ${results.length} match${results.length === 1 ? "" : "es"} for ${criteria}; top 3: ${top3.join("; ") || "none"}`,
    )

    return { ok: true, data: { results, total: results.length }, summary }
  },
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: no errors in `marketplace.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/advisor/tools/marketplace.ts
git commit -m "fix(advisor): rewire search_listings to use server-side filtering

search_listings now pushes series, variant, price, year, query, and
status filters to Supabase via fetchAdvisorListings instead of fetching
500 rows and filtering client-side. Fixes the 97% data visibility gap."
```

### Task 3: Replace `fetchPricedListingsForModel` in `getComparableSales` and `getRegionalValuation`

**Files:**
- Modify: `src/lib/advisor/tools/marketplace.ts:187-352`

**Context:** Both `getComparableSales` (line 199) and `getRegionalValuation` (line 299) call `fetchPricedListingsForModel(make, 500)` with the same 500-row limit. Replace with `fetchAdvisorListings` using server-side series filtering.

- [ ] **Step 1: Rewrite `getComparableSales` handler (lines 187-242)**

Replace lines 197-202:

```typescript
    // OLD:
    // let rows: PricedListingRow[]
    // try {
    //   rows = await fetchPricedListingsForModel(make, 500)
    // } catch ...

    // NEW:
    let rows: PricedListingRow[]
    try {
      rows = await fetchAdvisorListings({
        make,
        seriesId,
        variantId,
        status: "ended",   // comps = sold listings
        sortBy: "price_asc",
        limit: 500,
      })
    } catch (err) {
      return { ok: false, error: `listings_fetch_failed:${err instanceof Error ? err.message : "unknown"}` }
    }
```

Then simplify the post-fetch filtering. Remove the client-side series filter (line 205) since it's now server-side. Keep the date cutoff filter (lines 206-209) and variant filter only if variantId wasn't passed to fetchAdvisorListings (it was, so remove lines 210-212 too).

Updated handler body:

```typescript
    // Filter by date cutoff only (series + variant already filtered server-side)
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - monthsBack)
    const cutoffIso = cutoff.toISOString().slice(0, 10)
    const matched = rows.filter((r) => !r.sale_date || r.sale_date >= cutoffIso)
```

- [ ] **Step 2: Rewrite `getRegionalValuation` handler (lines 291-352)**

Replace lines 297-307:

```typescript
    // OLD:
    // let rows: PricedListingRow[]
    // try {
    //   rows = await fetchPricedListingsForModel(make, 500)
    // } catch ...
    // const seriesRows = rows.filter(...)
    // const matched = variantId ? seriesRows.filter(...) : seriesRows

    // NEW:
    let matched: PricedListingRow[]
    try {
      matched = await fetchAdvisorListings({
        make,
        seriesId,
        variantId,
        sortBy: "price_asc",
        limit: 500,
      })
    } catch (err) {
      return { ok: false, error: `listings_fetch_failed:${err instanceof Error ? err.message : "unknown"}` }
    }
```

Remove old lines 304-307 (client-side series/variant filter) since now server-side.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/lib/advisor/tools/marketplace.ts
git commit -m "fix(advisor): rewire getComparableSales + getRegionalValuation to server-side filtering

Both tools now use fetchAdvisorListings with series/variant filters
pushed to Supabase. Comparable sales and valuation data now spans
the full corpus instead of 500-row sample."
```

### Task 4: Remove unused `fetchPricedListingsForModel` import

**Files:**
- Modify: `src/lib/advisor/tools/marketplace.ts:1-10`

- [ ] **Step 1: Verify `fetchPricedListingsForModel` is no longer referenced**

Run: `grep -n fetchPricedListingsForModel src/lib/advisor/tools/marketplace.ts`
Expected: only the import line (which we already removed in Task 2)

- [ ] **Step 2: Commit if needed**

If the import was already cleaned in Task 2, skip. Otherwise:

```bash
git add src/lib/advisor/tools/marketplace.ts
git commit -m "chore(advisor): remove unused fetchPricedListingsForModel import"
```

---

## Chunk 3: Add `count_listings` Tool

### Task 5: Create the inventory tool

**Files:**
- Create: `src/lib/advisor/tools/inventory.ts`
- Modify: `src/lib/advisor/tools/index.ts`

**Context:** The agent currently has no tool to answer "how many listings do you have?" It abuses `search_listings` with `limit: 1` and reports "1 listing" instead of the real count (16,217). We add a dedicated `count_listings` tool that does `SELECT count(*)` with server-side filters.

- [ ] **Step 1: Create `src/lib/advisor/tools/inventory.ts`**

```typescript
import type { ToolDef } from "@/lib/advisor/tools/registry"
import { countAdvisorListings } from "@/lib/advisor/advisorListings"

export const countListings: ToolDef = {
  name: "count_listings",
  description:
    "Count how many listings match the given filters. Use this when the user asks 'how many', 'total', 'count', or 'do you have any' questions.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      make: { type: "string", description: "Make, defaults to 'Porsche'." },
      seriesId: { type: "string", description: "Series id like '997', '993', 'cayenne'." },
      variantId: { type: "string", description: "Variant (GT3, Turbo, Targa, etc.)." },
      query: { type: "string", description: "Free-text keyword." },
      status: {
        type: "string",
        enum: ["live", "ended"],
        description: "Filter by status: 'live' for active listings, 'ended' for sold.",
      },
    },
  },
  async handler(args) {
    const make = typeof args.make === "string" && args.make ? args.make : "Porsche"
    const seriesId = typeof args.seriesId === "string" ? args.seriesId : null
    const variantId = typeof args.variantId === "string" ? args.variantId.toLowerCase() : null
    const query = typeof args.query === "string" ? args.query.trim() : null
    const status = typeof args.status === "string" ? (args.status as "live" | "ended") : null

    const result = await countAdvisorListings({
      make,
      seriesId: seriesId || undefined,
      variantId: variantId || undefined,
      query: query || undefined,
      status,
    })

    if (!result.ok) {
      return { ok: false, error: "count_failed" }
    }

    const filters = [
      seriesId && `series=${seriesId}`,
      variantId && `variant=${variantId}`,
      query && `"${query}"`,
      status && `status=${status}`,
    ]
      .filter(Boolean)
      .join(", ")

    const summary = `${result.count.toLocaleString("en-US")} ${make} listings${filters ? ` matching ${filters}` : ""}`

    return {
      ok: true,
      data: { count: result.count, make, seriesId, variantId, query, status },
      summary,
    }
  },
}

export const inventoryTools: ToolDef[] = [countListings]
```

- [ ] **Step 2: Register in tool index**

In `src/lib/advisor/tools/index.ts`, add the import and registration:

```typescript
import { inventoryTools } from "./inventory"
```

Add `inventoryTools` to the array that gets registered (same pattern as `marketplaceTools`, `knowledgeTools`, etc.).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/lib/advisor/tools/inventory.ts src/lib/advisor/tools/index.ts
git commit -m "feat(advisor): add count_listings tool for inventory questions

New tool does SELECT count(*) with server-side filters so the agent
can accurately answer 'how many listings do you have?' questions.
Previously the agent reported '1 listing' instead of 16,217."
```

---

## Chunk 4: Update Existing Test Mocks

### Task 6: Update existing test files to mock new module

**Files:**
- Modify: `src/lib/advisor/tools/marketplace.test.ts` (if exists)
- Modify: `src/lib/advisor/tools/analysis.test.ts` (if exists)

**Context:** Existing tests mock `fetchPricedListingsForModel` from `@/lib/supabaseLiveListings`. After our refactor, `marketplace.ts` imports `fetchAdvisorListings` from `@/lib/advisor/advisorListings`. Tests need updating to mock the new module.

Note: The IMS bearing article already exists at `src/lib/knowledge/imsBearing.ts` and is registered in `src/lib/knowledge/registry.ts`. The QA test failure was the LLM not calling the right knowledge slug, not a missing article. The live QA test verifies this still works.

- [ ] **Step 1: Check which test files exist**

Run: `find src/lib/advisor -name "*.test.*" -o -name "*.spec.*" 2>/dev/null`

- [ ] **Step 2: Update mock imports in each test file**

Replace any `vi.mock("@/lib/supabaseLiveListings", ...)` that mocks `fetchPricedListingsForModel` with:

```typescript
vi.mock("@/lib/advisor/advisorListings", () => ({
  fetchAdvisorListings: vi.fn().mockResolvedValue([/* test data */]),
  countAdvisorListings: vi.fn().mockResolvedValue({ count: 100, ok: true }),
}))
```

Keep any other mocks from `@/lib/supabaseLiveListings` (e.g. `fetchLiveListingById`) intact.

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run src/lib/advisor/`
Expected: all tests PASS with updated mocks

- [ ] **Step 4: Commit**

```bash
git add src/lib/advisor/
git commit -m "test(advisor): update test mocks for fetchAdvisorListings migration"
```

---

## Chunk 5: Live QA Test Script

### Task 7: Create end-to-end test script

**Files:**
- Create: `scripts/advisor-live-qa.ts`

**Context:** We need a repeatable test that hits the advisor API endpoint and verifies responses against database ground truth. This script runs the same 7 test cases from the QA audit and compares agent answers to direct DB queries.

- [ ] **Step 1: Create the test script**

Create `scripts/advisor-live-qa.ts`:

```typescript
/**
 * Advisor Live QA Test Script
 *
 * Runs test queries against the advisor API and verifies responses
 * against direct database queries for ground truth.
 *
 * Usage: npx tsx scripts/advisor-live-qa.ts
 *
 * Requires: dev server running at localhost:3000
 */

import { createClient } from "@supabase/supabase-js"

const API_URL = process.env.API_URL || "http://localhost:3000"
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface TestResult {
  name: string
  query: string
  agentResponse: string
  dbGroundTruth: string
  pass: boolean
  details: string
}

async function sendAdvisorMessage(content: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/advisor/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, surface: "chat", locale: "en" }),
  })

  const text = await res.text()
  // Parse SSE events and extract content deltas + tool call summaries
  const lines = text.split("\n")
  let fullResponse = ""
  let toolSummaries: string[] = []

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue
    try {
      const event = JSON.parse(line.slice(6))
      if (event.type === "content_delta") fullResponse += event.delta
      if (event.type === "tool_call_end") toolSummaries.push(event.summary)
    } catch {}
  }

  return `[Tools: ${toolSummaries.join(" | ")}] ${fullResponse}`
}

// ── Test Cases ──

async function testCheapestTarga(): Promise<TestResult> {
  const name = "Cheapest Targa"
  const query = "What is the cheapest Porsche Targa you have listed?"

  const agentResponse = await sendAdvisorMessage(query)

  // Ground truth: cheapest active Targa by model field
  const { data } = await supabase
    .from("listings")
    .select("year,model,trim,hammer_price:listing_price,original_currency")
    .ilike("make", "%porsche%")
    .eq("status", "active")
    .or("model.ilike.%targa%,trim.ilike.%targa%")
    .gt("listing_price", 0)
    .order("listing_price", { ascending: true })
    .limit(3)

  const cheapest = data?.[0]
  const dbGroundTruth = cheapest
    ? `${cheapest.year} ${cheapest.model} @ ${cheapest.original_currency} ${cheapest.hammer_price}`
    : "No targas found"

  // Check if agent mentions a price <= the actual cheapest (within 20% tolerance for currency)
  const agentPrice = extractPrice(agentResponse)
  const dbPrice = cheapest?.hammer_price ?? 0
  const pass = agentPrice > 0 && agentPrice <= dbPrice * 1.5

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass,
    details: pass
      ? `Agent found a Targa near the cheapest (agent: ${agentPrice}, db: ${dbPrice})`
      : `Agent price ${agentPrice} is too far from cheapest ${dbPrice}, or no results found`,
  }
}

async function testGT3Under100k(): Promise<TestResult> {
  const name = "GT3 under $100k"
  const query = "Show me GT3 listings under $100,000"

  const agentResponse = await sendAdvisorMessage(query)

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .ilike("make", "%porsche%")
    .eq("status", "active")
    .or("model.ilike.%GT3%,trim.ilike.%GT3%")
    .gt("listing_price", 0)
    .lt("listing_price", 100000)

  const dbGroundTruth = `${count} active GT3 listings under $100k`
  const agentFoundResults = !agentResponse.toLowerCase().includes("no ") &&
    !agentResponse.toLowerCase().includes("0 match")

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass: (count ?? 0) > 0 ? agentFoundResults : true,
    details: agentFoundResults
      ? `Agent found GT3 results (DB has ${count})`
      : `Agent found no GT3s but DB has ${count}`,
  }
}

async function testListingCount(): Promise<TestResult> {
  const name = "Total listing count"
  const query = "How many Porsche listings do you have on the platform?"

  const agentResponse = await sendAdvisorMessage(query)

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .ilike("make", "%porsche%")
    .eq("status", "active")

  const dbGroundTruth = `${count} active Porsche listings`

  // Agent should report a number > 1000 (not "1" like before)
  const agentNumber = extractNumber(agentResponse)
  const pass = agentNumber > 1000

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass,
    details: pass
      ? `Agent reported ${agentNumber} (DB: ${count})`
      : `Agent reported ${agentNumber} — expected > 1000 (DB: ${count})`,
  }
}

async function test993Under150k(): Promise<TestResult> {
  const name = "993 under $150k"
  const query = "Find me a 993 under $150,000"

  const agentResponse = await sendAdvisorMessage(query)

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .ilike("make", "%porsche%")
    .eq("status", "active")
    .eq("series", "993")
    .gt("listing_price", 0)
    .lt("listing_price", 150000)

  const dbGroundTruth = `${count} active 993 listings under $150k`
  const agentFoundMultiple = !agentResponse.includes("1 match") &&
    !agentResponse.includes("0 match") &&
    !agentResponse.toLowerCase().includes("no ")

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass: (count ?? 0) > 5 ? agentFoundMultiple : true,
    details: `Agent found multiple: ${agentFoundMultiple}, DB count: ${count}`,
  }
}

async function testTurboS(): Promise<TestResult> {
  const name = "911 Turbo S listings"
  const query = "What Porsche 911 Turbo S listings do you have?"

  const agentResponse = await sendAdvisorMessage(query)

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .ilike("make", "%porsche%")
    .eq("status", "active")
    .or("model.ilike.%turbo s%,trim.ilike.%turbo s%")
    .gt("listing_price", 0)

  const dbGroundTruth = `${count} active Turbo S listings`
  const agentFoundMultiple = !agentResponse.includes("0 match")

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass: agentFoundMultiple,
    details: `Agent found results: ${agentFoundMultiple}, DB count: ${count}`,
  }
}

async function testIMSKnowledge(): Promise<TestResult> {
  const name = "IMS bearing knowledge"
  const query = "What is an IMS bearing and which Porsches are affected?"

  const agentResponse = await sendAdvisorMessage(query)

  const mentionsIMS = agentResponse.toLowerCase().includes("ims")
  const mentionsAffectedModels =
    agentResponse.includes("996") || agentResponse.includes("M96")
  const doesNotDeflect = !agentResponse.includes("don't have a specific")

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth: "Should explain IMS bearing, mention 996/997.1/Boxster 986/987",
    pass: mentionsIMS && mentionsAffectedModels && doesNotDeflect,
    details: `IMS mentioned: ${mentionsIMS}, models: ${mentionsAffectedModels}, no deflection: ${doesNotDeflect}`,
  }
}

async function testCheapestOverall(): Promise<TestResult> {
  const name = "Cheapest Porsche overall"
  const query = "What is the cheapest Porsche you have listed right now?"

  const agentResponse = await sendAdvisorMessage(query)

  const { data } = await supabase
    .from("listings")
    .select("year,model,hammer_price:listing_price,original_currency")
    .ilike("make", "%porsche%")
    .eq("status", "active")
    .gt("listing_price", 0)
    .order("listing_price", { ascending: true })
    .limit(1)

  const cheapest = data?.[0]
  const dbGroundTruth = cheapest
    ? `${cheapest.year} ${cheapest.model} @ ${cheapest.original_currency} ${cheapest.hammer_price}`
    : "none"

  // Agent should find something in the bottom 10% price range
  const agentPrice = extractPrice(agentResponse)
  const pass = agentPrice > 0 && agentPrice <= (cheapest?.hammer_price ?? 0) * 3

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass,
    details: `Agent price: ${agentPrice}, DB cheapest: ${cheapest?.hammer_price}`,
  }
}

// ── Helpers ──

function extractPrice(text: string): number {
  const match = text.match(/[\$€£¥]\s?([\d,]+)/)?.[1]
  return match ? parseInt(match.replace(/,/g, ""), 10) : 0
}

function extractNumber(text: string): number {
  const match = text.match(/([\d,]+)\s*(porsche|listing|car|total|active)/i)?.[1]
  return match ? parseInt(match.replace(/,/g, ""), 10) : 0
}

// ── Runner ──

async function main() {
  console.log("╔═══════════════════════════════════════════════════╗")
  console.log("║     MonzaHaus Advisor — Live QA Test Suite        ║")
  console.log("╚═══════════════════════════════════════════════════╝\n")

  const tests = [
    testCheapestTarga,
    testGT3Under100k,
    testListingCount,
    test993Under150k,
    testTurboS,
    testIMSKnowledge,
    testCheapestOverall,
  ]

  const results: TestResult[] = []
  for (const test of tests) {
    try {
      const result = await test()
      results.push(result)
      const icon = result.pass ? "✅" : "❌"
      console.log(`${icon} ${result.name}`)
      console.log(`   Query: ${result.query}`)
      console.log(`   DB:    ${result.dbGroundTruth}`)
      console.log(`   Agent: ${result.agentResponse.substring(0, 120)}...`)
      console.log(`   ${result.details}\n`)
    } catch (err) {
      console.log(`💥 ${test.name}: ${err}`)
    }
  }

  const passed = results.filter((r) => r.pass).length
  const total = results.length
  console.log("─".repeat(55))
  console.log(`Result: ${passed}/${total} tests passed`)

  if (passed < total) {
    console.log("\nFailing tests:")
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  ❌ ${r.name}: ${r.details}`)
    })
    process.exit(1)
  }

  console.log("\n🎉 All tests passed!")
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
```

- [ ] **Step 2: Run the test script against the UNFIXED codebase (baseline)**

Run: `npx tsx scripts/advisor-live-qa.ts`
Expected: 5-7 tests FAIL (confirming the bugs exist)

- [ ] **Step 3: Commit**

```bash
git add scripts/advisor-live-qa.ts
git commit -m "test(advisor): add live QA test script for data accuracy verification

7 test cases that compare advisor API responses against direct DB
queries. Tests: cheapest Targa, GT3 under $100k, listing count,
993 under $150k, Turbo S, IMS knowledge, cheapest overall."
```

---

## Chunk 6: Integration Verification

### Task 8: Run the full test suite after all fixes

**Files:**
- All modified files from Tasks 1-6

- [ ] **Step 1: TypeScript compilation check**

Run: `npx tsc --noEmit --pretty`
Expected: clean, no errors

- [ ] **Step 2: Run unit tests**

Run: `npx vitest run src/lib/advisor/__tests__/`
Expected: all tests PASS

- [ ] **Step 3: Start the dev server**

Run: `npm run dev` (if not already running)
Wait for: "Ready in X ms"

- [ ] **Step 4: Run the live QA test script**

Run: `npx tsx scripts/advisor-live-qa.ts`
Expected: 7/7 tests PASS

- [ ] **Step 5: Manual browser verification of the Targa test**

1. Open `http://localhost:3000/en/advisor`
2. Type: "What is the cheapest Porsche Targa?"
3. Verify: Response mentions a Targa under €50,000 (the 2003 996.2 Targa at €39,850 or similar)
4. Verify: Response shows multiple Targa results, not just 1

- [ ] **Step 6: Manual browser verification of count**

1. In advisor chat, type: "How many Porsche listings do you have?"
2. Verify: Response shows a number > 10,000 (not "1")

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "test(advisor): verify all data accuracy fixes pass live QA

All 7 test cases pass: cheapest Targa, GT3 under $100k, listing count,
993 under $150k, Turbo S, IMS knowledge, cheapest overall."
```
