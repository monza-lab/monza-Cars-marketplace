# Family Filter Fix & MakePageClient Refactor

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken family filtering (992 page shows all Porsche instead of just 992s) and decompose the 4,207-line MakePageClient.tsx into focused, maintainable files.

**Architecture:** Two workstreams executed sequentially. Workstream 1 (filtering) threads the `family` parameter through the entire chain: MakePageClient → useInfiniteAuctions → API route → Supabase query, using keyword-based ILIKE patterns derived from brandConfig. Workstream 2 (refactor) extracts inline components, hooks, and constants into separate files while preserving existing behavior.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (PostgREST), Tailwind CSS

---

## File Structure

### Workstream 1: Family Filtering (modify existing files)

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/brandConfig.ts` | Add `getModelPatternsForSeries()` — converts series keywords to ILIKE patterns |
| Modify | `src/lib/supabaseLiveListings.ts` | Add `modelPatterns` param to `fetchPaginatedListings()` |
| Modify | `src/app/api/mock-auctions/route.ts` | Read `family` query param, resolve to model patterns, pass to DB |
| Modify | `src/hooks/useInfiniteAuctions.ts` | Include `family` in API URL (make it server-side, not client-side) |
| Modify | `src/app/[locale]/cars/[make]/MakePageClient.tsx` | Pass `initialFamily` to `useInfiniteAuctions()` |

### Workstream 2: MakePageClient Refactor (extract to new files)

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/makePageConstants.ts` | brandThesis, brandStrategy, ownershipCosts, mockMarketDepth, priceRanges, sortOptions, SORT_LABELS, platformLabels, regionLabels, GENERATIONS_BY_FAMILY |
| Create | `src/lib/makePageHelpers.ts` | timeLeft(), extractFamily(), extractGenerationFromModel(), aggregateModels(), aggregateRegionalPricing(), findBestRegion(), deriveModelDepth() |
| Create | `src/components/makePage/FilterChip.tsx` | FilterChip + SidebarPill |
| Create | `src/components/makePage/SortSelector.tsx` | SortSelector dropdown |
| Create | `src/components/makePage/DropdownSelect.tsx` | Generic dropdown |
| Create | `src/components/makePage/CarCard.tsx` | Grid car card |
| Create | `src/components/makePage/CarFeedCard.tsx` | Full-height car card for Column B |
| Create | `src/components/makePage/ModelFeedCard.tsx` | Family card for Column B |
| Create | `src/components/makePage/GenerationFeedCard.tsx` | Generation card for Column B |
| Create | `src/components/makePage/ModelNavSidebar.tsx` | Column A sidebar navigation |
| Create | `src/components/makePage/context/ModelContextPanel.tsx` | Column C model panel (347 lines) |
| Create | `src/components/makePage/context/GenerationContextPanel.tsx` | Column C generation panel (274 lines) |
| Create | `src/components/makePage/context/CarContextPanel.tsx` | Column C car panel (197 lines) |
| Create | `src/components/makePage/mobile/MobileHeroModel.tsx` | Mobile hero section |
| Create | `src/components/makePage/mobile/MobileModelRow.tsx` | Mobile model list item |
| Create | `src/components/makePage/mobile/MobileModelContext.tsx` | Mobile context panels |
| Create | `src/components/makePage/mobile/MobileModelContextSheet.tsx` | Bottom sheet wrapper |
| Create | `src/components/makePage/mobile/MobileMakeLiveAuctions.tsx` | Mobile live auction carousel |
| Create | `src/components/makePage/mobile/MobileFilterSheet.tsx` | Mobile filter bottom sheet |
| Create | `src/components/makePage/mobile/MakePageRegionPills.tsx` | Region filter pills |
| Create | `src/hooks/useScrollSync.ts` | Scroll position tracking for 3-column sync |
| Modify | `src/app/[locale]/cars/[make]/MakePageClient.tsx` | Orchestrator only (~500 lines) |

---

## Chunk 1: Server-Side Family Filtering

### Task 1: Add `getModelPatternsForSeries()` to brandConfig

**Files:**
- Modify: `src/lib/brandConfig.ts` (after line 515, near `getSeriesConfig`)

This function converts a series ID (e.g., "992") into an array of `{ keyword: string; yearMin?: number; yearMax?: number }` objects that can be translated into Supabase ILIKE + year range filters.

- [ ] **Step 1: Add the `getModelPatternsForSeries` function**

```typescript
/**
 * Returns model ILIKE patterns + optional year range for a series.
 * Used by fetchPaginatedListings to filter at the DB level.
 */
export function getModelPatternsForSeries(
  seriesId: string,
  make: string
): { keywords: string[]; yearMin?: number; yearMax?: number } | null {
  const series = getSeriesConfig(seriesId, make)
  if (!series) return null

  return {
    keywords: series.keywords,
    yearMin: series.yearRange?.[0],
    yearMax: series.yearRange?.[1],
  }
}
```

- [ ] **Step 2: Verify no existing tests break**

Run: `npx tsc --noEmit`
Expected: No new type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/brandConfig.ts
git commit -m "feat(brandConfig): add getModelPatternsForSeries for DB-level series filtering"
```

---

### Task 2: Add model pattern filtering to `fetchPaginatedListings`

**Files:**
- Modify: `src/lib/supabaseLiveListings.ts:1147-1256` (the `fetchPaginatedListings` function)

- [ ] **Step 1: Extend the options interface with `modelPatterns`**

Add to the `options` parameter of `fetchPaginatedListings` (after line 1156):

```typescript
export async function fetchPaginatedListings(options: {
  make: string;
  pageSize?: number;
  offset?: number;
  region?: string | null;
  platform?: string | null;
  query?: string | null;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: "active" | "all";
  modelPatterns?: { keywords: string[]; yearMin?: number; yearMax?: number } | null;  // NEW
}): Promise<{
```

- [ ] **Step 2: Add the model pattern filter between the status filter and region filter**

After line 1185 (after the status filter block), add:

```typescript
    // Model pattern filter (series-level, e.g. "992" → model ILIKE %992%)
    if (options.modelPatterns) {
      const { keywords, yearMin, yearMax } = options.modelPatterns;
      if (keywords.length > 0) {
        // Build OR clause: model.ilike.%keyword1%,model.ilike.%keyword2%,...
        const orClauses = keywords
          .map((kw) => `model.ilike.%${kw.replace(/[%_]/g, "")}%`)
          .join(",");
        query = query.or(orClauses);
      }
      if (yearMin !== undefined) {
        query = query.gte("year", yearMin);
      }
      if (yearMax !== undefined) {
        query = query.lte("year", yearMax);
      }
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabaseLiveListings.ts
git commit -m "feat(supabase): add modelPatterns filter to fetchPaginatedListings"
```

---

### Task 3: Thread `family` through the API route

**Files:**
- Modify: `src/app/api/mock-auctions/route.ts:50-143`

- [ ] **Step 1: Read the `family` param and resolve to model patterns**

After line 61 (where other params are read), add:

```typescript
  const family = searchParams.get("family") || "";
```

At the top of the file, add the import:

```typescript
import { getModelPatternsForSeries } from "@/lib/brandConfig";
```

- [ ] **Step 2: Pass `modelPatterns` to `fetchPaginatedListings` in the paginated path**

In the paginated path (around line 100-110), resolve the family to model patterns and pass them:

```typescript
    // Resolve family to DB-level model patterns
    const modelPatterns = family
      ? getModelPatternsForSeries(family, requestedMake ?? "Porsche")
      : null;

    const paginatedPromise = fetchPaginatedListings({
      make: requestedMake ?? "Porsche",
      pageSize: rawPageSize,
      offset,
      region: regionParam,
      platform: platformFilter,
      query: query || null,
      sortBy,
      sortOrder: sortOrder as "asc" | "desc",
      status: dbStatus,
      modelPatterns,  // NEW
    });
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/mock-auctions/route.ts
git commit -m "feat(api): pass family filter as modelPatterns to fetchPaginatedListings"
```

---

### Task 4: Include `family` in the API URL from useInfiniteAuctions

**Files:**
- Modify: `src/hooks/useInfiniteAuctions.ts`

The hook already accepts `family` and does client-side filtering. We now make it ALSO send `family` to the API for server-side filtering, while keeping the client-side filter as a safety net.

- [ ] **Step 1: Add `family` to `buildUrl`**

In `buildUrl` (line 86-103), add `family` to the URL and to the dependency array:

```typescript
  const buildUrl = useCallback(
    (pageCursor: string | null): string => {
      const url = new URL("/api/mock-auctions", window.location.origin);
      url.searchParams.set("pageSize", String(PAGE_SIZE));
      url.searchParams.set("make", make);

      if (pageCursor) url.searchParams.set("cursor", pageCursor);
      if (family) url.searchParams.set("family", family);  // NEW — server-side filter
      if (region && region !== "all") url.searchParams.set("region", region);
      if (platform && platform !== "All Platforms")
        url.searchParams.set("platform", platform);
      if (query) url.searchParams.set("query", query);
      if (sortBy) url.searchParams.set("sortBy", sortBy);
      if (sortOrder) url.searchParams.set("sortOrder", sortOrder);

      return url.toString();
    },
    [make, family, region, platform, query, sortBy, sortOrder],  // family added
  );
```

- [ ] **Step 2: Add `family` to the reset effect dependency array**

In the effect at line 293-319, add `family` so the hook resets when the family changes (since it's now an API-level filter):

```typescript
  }, [make, family, region, platform, query, sortBy, sortOrder, enabled]);
```

Also update the comment on line 317 to reflect that family is now sent to the API:

```typescript
    // family is now sent to the API for server-side filtering
```

- [ ] **Step 3: Remove the standalone family-change effect**

Delete the `prevFamilyRef` effect (lines 321-339) since family changes now trigger a full reset via the main effect. This eliminates the separate auto-fetch-on-family-change logic.

- [ ] **Step 4: Keep client-side family filter as safety net**

The existing client-side filtering at lines 140-147 and 342-347 stays as-is. It provides defense-in-depth: the API now does the heavy lifting, but the client still filters just in case.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new type errors

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useInfiniteAuctions.ts
git commit -m "feat(useInfiniteAuctions): send family to API for server-side filtering"
```

---

### Task 5: Pass `initialFamily` from MakePageClient to useInfiniteAuctions

**Files:**
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx:2805-2809`

- [ ] **Step 1: Add `family` to the useInfiniteAuctions call**

Change the hook call at line 2805-2809:

```typescript
const {
  cars: infiniteScrollCars,
  total: infiniteTotal,
  aggregates: infiniteAggregates,
  isLoading: isLoadingCars,
  isFetchingMore,
  hasMore,
  sentinelRef,
  reset: resetInfiniteScroll,
} = useInfiniteAuctions({
  make,
  family: selectedFamilyForFeed || undefined,  // NEW — pass selected family
  region: selectedRegion && selectedRegion !== "all" ? selectedRegion : undefined,
  query: searchQuery || undefined,
})
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new type errors

- [ ] **Step 3: Manual verification**

Run: `npm run dev`
1. Navigate to dashboard → click "992"
2. Confirm: URL shows `/cars/porsche?family=992`
3. Confirm: Network tab shows API calls with `family=992` param
4. Confirm: Only 992-series cars appear (no random 911s from other generations)
5. Confirm: Cars from ALL platforms appear (BaT, Classic.com, BeForward, etc.)
6. Confirm: Switching families (click sibling like "991") reloads with correct cars

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/cars/[make]/MakePageClient.tsx
git commit -m "feat(MakePageClient): pass selectedFamily to useInfiniteAuctions for server-side filtering"
```

---

## Chunk 2: Extract Constants & Helpers

### Task 6: Extract constants to `makePageConstants.ts`

**Files:**
- Create: `src/lib/makePageConstants.ts`
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx` (remove lines 61-158, replace with import)

- [ ] **Step 1: Create the constants file**

Create `src/lib/makePageConstants.ts` with all constant objects currently in MakePageClient.tsx:
- `brandThesis` (lines 61-76)
- `brandStrategy` (lines 78-87)
- `ownershipCosts` (lines 89-104)
- `mockMarketDepth` (lines 107-122)
- `priceRanges` (lines 125-133)
- `sortOptions` (lines 136-142)
- `carSortOptions` (lines 145-150)
- `SORT_LABELS` (lines 152-158)
- `platformLabels` (lines ~1160-1168) — used by CarFeedCard, ModelContextPanel
- `regionLabels` (lines ~1171-1176) — used by context panels
- `GENERATIONS_BY_FAMILY` (line ~3074) — used in familyGenerations useMemo

Export all as named exports.

- [ ] **Step 2: Update MakePageClient imports**

Replace lines 61-158 in MakePageClient.tsx with:

```typescript
import {
  brandThesis, brandStrategy, ownershipCosts, mockMarketDepth,
  priceRanges, sortOptions, carSortOptions, SORT_LABELS,
  platformLabels, regionLabels, GENERATIONS_BY_FAMILY,
} from "@/lib/makePageConstants"
```

**Note:** Extracted components (SortSelector, CarFeedCard, context panels) that use these constants must also import from `@/lib/makePageConstants`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/makePageConstants.ts src/app/[locale]/cars/[make]/MakePageClient.tsx
git commit -m "refactor: extract makePageConstants from MakePageClient"
```

---

### Task 7: Extract helper functions to `makePageHelpers.ts`

**Files:**
- Create: `src/lib/makePageHelpers.ts`
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx` (remove lines 162-247 and 1841-1881)

- [ ] **Step 1: Create the helpers file**

Create `src/lib/makePageHelpers.ts` with:
- `timeLeft(endTime, labels)` — lines 162-173
- `extractFamily(modelName, year?, makeName?)` — lines 177-179
- `extractGenerationFromModel(modelName, year?)` — lines 182-187 (used in 5+ locations including GenerationContextPanel and main component)
- `aggregateModels(cars, make)` — lines 190-247
- `aggregateRegionalPricing(modelCars)` — lines 1841-1852
- `findBestRegion(pricing)` — lines 1855-1867
- `deriveModelDepth(modelCars)` — lines 1870-1881

Import needed types (`CollectorCar`, `FairValueByRegion`) and define + export the `Model` type (currently at lines 46-58 in MakePageClient — must be moved here since `aggregateModels` returns it).

- [ ] **Step 2: Update MakePageClient imports**

Replace the removed lines with:

```typescript
import {
  timeLeft, extractFamily, extractGenerationFromModel, aggregateModels,
  aggregateRegionalPricing, findBestRegion, deriveModelDepth,
  type Model,
} from "@/lib/makePageHelpers"
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/makePageHelpers.ts src/app/[locale]/cars/[make]/MakePageClient.tsx
git commit -m "refactor: extract makePageHelpers from MakePageClient"
```

---

## Chunk 3: Extract UI Components

### Task 8: Extract FilterChip and SidebarPill

**Files:**
- Create: `src/components/makePage/FilterChip.tsx`
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx` (remove lines 250-280 and 1179-1206)

- [ ] **Step 1: Create FilterChip component file**

Extract `FilterChip` (lines 250-280) and `SidebarPill` (lines 1179-1206) into `src/components/makePage/FilterChip.tsx`. Both are self-contained with zero parent state dependencies. Export both as named exports.

- [ ] **Step 2: Update imports in MakePageClient**

```typescript
import { FilterChip, SidebarPill } from "@/components/makePage/FilterChip"
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/makePage/FilterChip.tsx src/app/[locale]/cars/[make]/MakePageClient.tsx
git commit -m "refactor: extract FilterChip and SidebarPill components"
```

---

### Task 9: Extract SortSelector and DropdownSelect

**Files:**
- Create: `src/components/makePage/SortSelector.tsx`
- Create: `src/components/makePage/DropdownSelect.tsx`
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx` (remove lines 283-408)

- [ ] **Step 1: Create SortSelector** (lines 283-340)

Self-contained with internal `useState`, `useRef`, `useEffect` for click-outside. Props: `sortBy`, `setSortBy`, `options`.

- [ ] **Step 2: Create DropdownSelect** (lines 343-408)

Self-contained with internal `useState`. Props: `label`, `value`, `options`, `onChange`, `icon?`.

- [ ] **Step 3: Update imports in MakePageClient**

- [ ] **Step 4: Verify TypeScript compiles and commit**

```bash
git add src/components/makePage/SortSelector.tsx src/components/makePage/DropdownSelect.tsx src/app/[locale]/cars/[make]/MakePageClient.tsx
git commit -m "refactor: extract SortSelector and DropdownSelect components"
```

---

### Task 10: Extract Card components

**Files:**
- Create: `src/components/makePage/CarCard.tsx` (lines 891-991, ~100 lines)
- Create: `src/components/makePage/CarFeedCard.tsx` (lines 1409-1557, ~150 lines)
- Create: `src/components/makePage/ModelFeedCard.tsx` (lines 1687-1839, ~150 lines)
- Create: `src/components/makePage/GenerationFeedCard.tsx` (lines 1573-1684, ~110 lines)
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx`

- [ ] **Step 1: Extract CarCard**

Props: `car`, `index`. Reads `locale` and `selectedRegion` from context. Uses `motion.div` with staggered animation. Import `formatPriceForRegion` and `timeLeft` from helpers.

- [ ] **Step 2: Extract CarFeedCard**

Props: `car`, `make`. Reads `locale`, `selectedRegion` from context. Full-height card with cinematic image, status badges, stats grid.

- [ ] **Step 3: Extract ModelFeedCard**

Props: `model`, `make`, `onClick?`, `index?`. Reads `selectedRegion` from context. Wraps in Link or button.

- [ ] **Step 4: Extract GenerationFeedCard**

Props: `gen` (GenerationAggregate type), `familyName`, `make`, `onClick`. Button wrapper around content. Export the `GenerationAggregate` type from this file.

- [ ] **Step 5: Update imports in MakePageClient**

```typescript
import { CarCard } from "@/components/makePage/CarCard"
import { CarFeedCard } from "@/components/makePage/CarFeedCard"
import { ModelFeedCard } from "@/components/makePage/ModelFeedCard"
import { GenerationFeedCard, type GenerationAggregate } from "@/components/makePage/GenerationFeedCard"
```

- [ ] **Step 6: Verify TypeScript compiles and commit**

```bash
git add src/components/makePage/CarCard.tsx src/components/makePage/CarFeedCard.tsx src/components/makePage/ModelFeedCard.tsx src/components/makePage/GenerationFeedCard.tsx src/app/[locale]/cars/[make]/MakePageClient.tsx
git commit -m "refactor: extract Card components from MakePageClient"
```

---

## Chunk 4: Extract Context Panels

### Task 11: Extract Context Panel components

**Files:**
- Create: `src/components/makePage/context/ModelContextPanel.tsx` (lines 2356-2702, 347 lines)
- Create: `src/components/makePage/context/GenerationContextPanel.tsx` (lines 1885-2156, 274 lines)
- Create: `src/components/makePage/context/CarContextPanel.tsx` (lines 2159-2354, 197 lines)
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx`

These are the largest inline components (~818 lines total). Each is self-contained with props-driven data.

- [ ] **Step 1: Extract ModelContextPanel**

Props: `model`, `make`, `cars`, `allCars`, `allModels`, `onOpenAdvisor`, `dbOwnershipCosts`. Heavy computation (regional pricing bars, best region, market depth, similar models). Import helpers from `makePageHelpers.ts` and constants from `makePageConstants.ts`.

- [ ] **Step 2: Extract GenerationContextPanel**

Props: `gen` (GenerationAggregate), `familyName`, `make`, `familyCars`, `onOpenAdvisor`. Computes top variants, recent sales, ownership costs. Import helpers.

- [ ] **Step 3: Extract CarContextPanel**

Props: `car`, `make`, `onOpenAdvisor`. Displays car specs, thesis, ownership costs. Import helpers and constants.

- [ ] **Step 4: Update imports in MakePageClient**

```typescript
import { ModelContextPanel } from "@/components/makePage/context/ModelContextPanel"
import { GenerationContextPanel } from "@/components/makePage/context/GenerationContextPanel"
import { CarContextPanel } from "@/components/makePage/context/CarContextPanel"
```

- [ ] **Step 5: Verify TypeScript compiles and commit**

```bash
git add src/components/makePage/context/ src/app/[locale]/cars/[make]/MakePageClient.tsx
git commit -m "refactor: extract Context Panel components from MakePageClient"
```

---

## Chunk 5: Extract Mobile Components

### Task 12: Extract Mobile components

**Files:**
- Create: `src/components/makePage/mobile/MakePageRegionPills.tsx` (lines 411-444, 34 lines)
- Create: `src/components/makePage/mobile/MobileHeroModel.tsx` (lines 447-522, 78 lines)
- Create: `src/components/makePage/mobile/MobileModelRow.tsx` (lines 525-599, 77 lines)
- Create: `src/components/makePage/mobile/MobileModelContext.tsx` (lines 602-749, 150 lines)
- Create: `src/components/makePage/mobile/MobileModelContextSheet.tsx` (lines 752-819, 70 lines)
- Create: `src/components/makePage/mobile/MobileMakeLiveAuctions.tsx` (lines 822-888, 69 lines)
- Create: `src/components/makePage/mobile/MobileFilterSheet.tsx` (lines 994-1157, 185 lines)
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx`

- [ ] **Step 1: Extract MakePageRegionPills**

Props: `regionCounts`. Reads `useRegion()` context internally.

- [ ] **Step 2: Extract MobileHeroModel**

Props: `model`, `make`. Reads `selectedRegion` from context.

- [ ] **Step 3: Extract MobileModelRow**

Props: `model`, `make`, `onTap`. Reads `selectedRegion` from context.

- [ ] **Step 4: Extract MobileModelContext**

Props: `model`, `make`, `cars`, `allCars`, `allModels`, `dbOwnershipCosts`. Heavy computation — import helpers from `makePageHelpers.ts`.

- [ ] **Step 5: Extract MobileModelContextSheet**

Props: `model`, `make`, `cars`, `allCars`, `allModels`, `onClose`, `dbOwnershipCosts`. Wraps MobileModelContext.

- [ ] **Step 6: Extract MobileMakeLiveAuctions**

Props: `cars`, `totalLiveCount`. Reads `useRegion()`. Maps `timeLeft()`.

- [ ] **Step 7: Extract MobileFilterSheet**

Props: `open`, `onClose`, `models`, `selectedModel`, `setSelectedModel`, `selectedPriceRange`, `setSelectedPriceRange`, `selectedStatus`, `setSelectedStatus`, `sortBy`, `setSortBy`, `cars`, `filteredCount`. Uses `FilterChip` internally.

- [ ] **Step 8: Update imports in MakePageClient**

```typescript
import { MakePageRegionPills } from "@/components/makePage/mobile/MakePageRegionPills"
import { MobileHeroModel } from "@/components/makePage/mobile/MobileHeroModel"
import { MobileModelRow } from "@/components/makePage/mobile/MobileModelRow"
import { MobileModelContext } from "@/components/makePage/mobile/MobileModelContext"
import { MobileModelContextSheet } from "@/components/makePage/mobile/MobileModelContextSheet"
import { MobileMakeLiveAuctions } from "@/components/makePage/mobile/MobileMakeLiveAuctions"
import { MobileFilterSheet } from "@/components/makePage/mobile/MobileFilterSheet"
```

- [ ] **Step 9: Verify TypeScript compiles and commit**

```bash
git add src/components/makePage/mobile/ src/app/[locale]/cars/[make]/MakePageClient.tsx
git commit -m "refactor: extract Mobile components from MakePageClient"
```

---

## Chunk 6: Extract Sidebar & Scroll Hook

### Task 13: Extract ModelNavSidebar

**Files:**
- Create: `src/components/makePage/ModelNavSidebar.tsx` (lines 1209-1406, 200 lines)
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx`

- [ ] **Step 1: Extract ModelNavSidebar**

Props: `make`, `cars`, `models`, `currentModelIndex`, `onSelectModel`. Uses `useMemo` for live cars internally. Reads `selectedRegion` from context. Contains nested scrollable lists for models and live bids.

- [ ] **Step 2: Update imports and verify**

- [ ] **Step 3: Commit**

```bash
git add src/components/makePage/ModelNavSidebar.tsx src/app/[locale]/cars/[make]/MakePageClient.tsx
git commit -m "refactor: extract ModelNavSidebar from MakePageClient"
```

---

### Task 14: Extract useScrollSync hook

**Files:**
- Create: `src/hooks/useScrollSync.ts`
- Modify: `src/app/[locale]/cars/[make]/MakePageClient.tsx` (remove lines 3435-3490)

- [ ] **Step 1: Create useScrollSync hook**

Extract scroll-related logic:
- `feedRef` ref
- `carIndexRefs` ref
- Scroll handler effect (lines 3440-3461) that updates `currentModelIndex` / `activeGenIndex` / `activeCarIndex`
- `scrollToModel()` helper (lines 3463-3468)
- `scrollToCar()` helper (lines 3470-3475)
- Auto-scroll car index effect (lines 3478-3484)
- Reset on filter change effect (lines 3487-3490)

The hook should accept:
- `viewMode` — current view mode
- `filteredModels` — for families scroll tracking
- `familyGenerations` — for generations scroll tracking
- `variantFilteredFeedCars` — for cars scroll tracking
- `filterDeps` — array of values that trigger scroll reset when changed (searchQuery, selectedPriceRange, selectedPriceTier, selectedStatus, selectedRegion, selectedEra)

The hook should own `currentModelIndex` state (remove the `useState` at line 2775 from MakePageClient).

Returns: `feedRef`, `carIndexRefs`, `currentModelIndex`, `setCurrentModelIndex`, `activeGenIndex`, `activeCarIndex`, `scrollToModel`, `scrollToCar`.

- [ ] **Step 2: Replace the extracted code in MakePageClient with the hook call**

Remove the `currentModelIndex` useState at line 2775 and replace the scroll logic with:

```typescript
const {
  feedRef, carIndexRefs, currentModelIndex, setCurrentModelIndex,
  activeGenIndex, activeCarIndex,
  scrollToModel, scrollToCar,
} = useScrollSync({
  viewMode,
  filteredModels,
  familyGenerations,
  variantFilteredFeedCars,
  filterDeps: [searchQuery, selectedPriceRange, selectedPriceTier, selectedStatus, selectedRegion, selectedEra],
})
```

- [ ] **Step 3: Verify TypeScript compiles and commit**

```bash
git add src/hooks/useScrollSync.ts src/app/[locale]/cars/[make]/MakePageClient.tsx
git commit -m "refactor: extract useScrollSync hook from MakePageClient"
```

---

## Chunk 7: Final Verification

### Task 15: Full application verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Run dev server and test all views**

Run: `npm run dev`

Test each view mode:
1. **Dashboard** → Confirm family cards render with images
2. **Click "992"** → Confirm only 992 cars appear from ALL platforms
3. **Click sibling "991"** → Confirm data reloads with 991 cars
4. **Back to families** → Confirm all families show
5. **Mobile view** → Confirm all mobile components render
6. **Column C context panels** → Confirm all 3 panels render correctly
7. **Scroll sync** → Confirm Column A/B/C stay in sync on desktop
8. **Infinite scroll** → Confirm loading more cars works when scrolling
9. **Filters** → Confirm region, sort, variant filters all work

- [ ] **Step 3: Verify MakePageClient line count**

Run: `wc -l src/app/[locale]/cars/[make]/MakePageClient.tsx`
Expected: ~800-1000 lines (down from 4,207). The remaining lines are: state management (~100), useMemo computations (~400), event handlers (~80), and JSX layout orchestration (~300). Further reduction would require extracting the mobile/desktop layout sections into separate layout components.

- [ ] **Step 4: Verify no console errors**

Check browser console for:
- Zero "Image is missing required src" errors
- Zero "empty string passed to src" errors
- Zero "relation Analysis does not exist" errors
- Network tab: API calls include `family=XXX` param when on family page

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "refactor: complete MakePageClient decomposition — 4207→~900 lines"
```

---

## Execution Notes

- **Workstream 1 (Tasks 1-5)** should be executed first and verified before starting Workstream 2
- **Workstream 2 (Tasks 6-14)** can be parallelized: Tasks 6-7 (constants/helpers) must go first, then Tasks 8-13 (components) can run in parallel, then Task 14 (hook) last
- Each task produces a working, compilable state — no broken intermediate commits
- The client-side family filter in useInfiniteAuctions is kept as defense-in-depth even after adding server-side filtering
- All extracted components use the same prop patterns as the inline versions — no API changes needed
