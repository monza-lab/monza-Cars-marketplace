# Unified Search — Design

**Status:** draft · awaiting implementation
**Date:** 2026-05-25
**Author:** Edgar + Claude (brainstorming)

## Context

Today MonzaHaus has three search surfaces and they don't agree:

1. **Header (desktop)** — a dropdown that shows only **taxonomy** (series like `992`, variants like `GT3`). Capped at 8 items. Never shows real cars.
2. **MobileSearchSheet** — a full-screen sheet with filter chips (region, status, price), recent queries, and a trending listing strip. No category browsing.
3. **`/search` page** — a results grid backed by `/api/mock-auctions`. Lists cars only. No taxonomy navigation.

Two indexes (brandConfig vs. listings) and three different UIs. Customer feedback from Camilo: users struggle to find a specific car. The path from "I want to look at 997 Turbos" to actually seeing one takes more clicks than it should, and the feedback loop while typing is weak (you see series names, not the cars themselves).

## Goal

A single search component that:

- Shows **series** and **listings** side by side as the user types
- Reduces "find a car" to **0–2 clicks** from the global header
- Behaves the same in Header (desktop), MobileSearchSheet, and the `/search` page input
- Treats the product as a **data tool**, not a marketplace — listings are surfaced as market data, not purchase CTAs

## Non-goals (v1)

- Family-group grouping in the series column (911 Family, Mid-Engine, etc.). Flat list for v1, group later if the column gets unwieldy.
- Saved searches / pinned series
- Multi-make search (the product is Porsche-only today)
- Voice or image search
- Server-side full-text search infrastructure beyond what supabase already provides

## Design

### Layout

**Desktop (≥768 px)** — two-column command palette:

```
┌──────────────────────────────────────────────────┐
│  Search ____________________________  ⌘K        │
├──────────────────────────────────────────────────┤
│ SERIES (left, w=180px)  │  LISTINGS (right)      │
│  ▸ 997    ← active       │  2007 997 Turbo  $145K │
│    997.1                 │  2008 997 GT3 RS $315K │
│    997.2                 │  2010 997 Turbo S $189K│
│    964                   │  ...                    │
│    993                   │                          │
│    [scroll-y, all 27]    │  → View all 12 listings │
└──────────────────────────────────────────────────┘
```

**Mobile (<768 px)** — stacked vertical, same content:

```
┌────────────────────────────────────────┐
│  Search _____________________  Cancel  │
├────────────────────────────────────────┤
│  SERIES                                 │
│    997   · 24 cars                      │
│    997.1 · 14 cars                      │
│    997.2 · 10 cars                      │
│    [scroll-y, sticky header]            │
│  LISTINGS                               │
│    2007 997 Turbo  $145K · BaT          │
│    2008 997 GT3 RS $315K · RM           │
│    ...                                   │
│    → View all 12 listings               │
└────────────────────────────────────────┘
```

### State machine

| Input state | Left column (series) | Right column (listings) |
|---|---|---|
| Empty, focused | All 27 series (sorted by recent activity, then alphabetical) | 6–10 trending listings (sorted by `created_at` desc, status=live first) |
| Typed query | Series whose label or keywords fuzzy-match the query (max 6) | Listings whose `title` / `year` / `model` match the query (max 8) |
| Active serie (hover or arrow-key) | Same as above; active row highlighted | Listings filtered to **only that series**, max 8 |
| No matches | "No series match" placeholder | "No listings match — try a different query" |

"Active serie" is desktop-only. On mobile the user just taps; there's no hover layer.

### Click and keyboard destinations

| Action | Behavior |
|---|---|
| Click serie | `router.push("/cars/porsche?family=" + slug)` |
| Click listing | `router.push("/cars/porsche/" + makeSlug + "/" + id + "/report")` |
| Click "View all N listings" footer | If an `activeSeries` exists, `router.push("/cars/porsche?family=" + slug)` (the canonical series page). Otherwise `router.push("/search?q=" + query)`. |
| `⌘K` / `Ctrl+K` | Open the dropdown (desktop). On mobile, the Search tab in the bottom nav already opens the sheet. |
| `↑` `↓` | Move active row inside the focused column |
| `→` (desktop) | Move focus from series column to listings column |
| `←` (desktop) | Move focus back to series column |
| `Enter` | Navigate to the active row's destination |
| `Esc` | Close dropdown, blur input |

### Data sources

**Series** — `getBrandConfig("porsche").series` from `src/lib/brandConfig.ts`. Already shipped in the client bundle, no fetch. The label, year range, family, and keywords used for fuzzy match all live here.

**Listings** — new endpoint `GET /api/search/listings` that queries Supabase live + sold history. The existing `fetchLiveListingsAsCollectorCars` / `fetchSoldListingsForMake` helpers (in `src/lib/supabaseLiveListings.ts`) don't accept a free-text predicate today, so the route will run a small additional Supabase query with `ilike` on `title`, `model`, and `year::text`. The two helpers are still used for the `trending=true` empty-state path where no `q` is provided.

Endpoint contract:

```
GET /api/search/listings?q=<string>&series=<string>&limit=<number>&trending=<bool>

200 {
  listings: Array<{
    id: string           // "live-uuid" or "sold-uuid"
    title: string
    year: number | null
    model: string | null
    image: string | null
    priceUsd: number | null
    platform: string     // BRING_A_TRAILER, CARS_AND_BIDS, ...
    status: "live" | "sold"
    series: string | null  // "997", "992", ... when classifiable
  }>
  total: number          // unbounded count of matches, used by "View all N"
}
```

Behavior:

- `trending=true` and no `q`: most recently `created_at` live listings, then sold. Used for empty state.
- `q` provided: case-insensitive `ILIKE` on `title || model || year::text`, ranked by recency for now.
- `series` provided: additional filter via `extractSeries(model, year, "Porsche")` from `brandConfig` matching the slug.
- `limit` capped server-side at 25 to keep responses small.

The endpoint runs server-side with `force-dynamic`. It reuses `fetchLiveListingsAsCollectorCars` and `fetchSoldListingsForMake` from `src/lib/supabaseLiveListings.ts` plus a small SQL fallback for the search predicate. No new schema.

### Performance

- 200 ms debounce on input (`useUnifiedSearch` hook)
- `AbortController` on each fetch so a stale request from a slower keystroke doesn't overwrite a fresher one
- In-memory `Map<string, listings>` cache keyed by `(q, series)`; cleared on close
- Series filtering is purely client-side (27 items, no fetch needed)

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│  UnifiedSearch (orchestrator)                              │
│    ├── input + ⌘K hint                                     │
│    ├── useUnifiedSearch()  — state, debounce, keyboard     │
│    ├── SeriesColumn        — left col (desktop) / top      │
│    └── ListingsColumn      — right col (desktop) / bottom  │
└────────────────────────────────────────────────────────────┘
              │
              ├── reads:  getBrandConfig("porsche").series
              │
              └── fetches: /api/search/listings
                            ├── live: fetchLiveListingsAsCollectorCars (filtered)
                            └── sold: fetchSoldListingsForMake (filtered)
```

`UnifiedSearch` accepts a `variant` prop:

- `"header"` — dropdown anchored under the header search input
- `"sheet"` — fills the mobile bottom-sheet body
- `"inline"` — embeds inside `/search` page (no shell, just the two columns)

The variant changes the chrome (positioning, close button placement, max height), not the inner behavior.

## File plan

### New files

| File | Purpose |
|---|---|
| `src/components/search/UnifiedSearch.tsx` | Orchestrator. Accepts `variant`, renders shell + columns. |
| `src/components/search/SeriesColumn.tsx` | Left column. Renders series rows with active state. |
| `src/components/search/ListingsColumn.tsx` | Right column. Renders listing rows + "View all" footer. |
| `src/hooks/useUnifiedSearch.ts` | Owns `{ query, activeSeries, listings, loading }` state, debounce, keyboard handlers. |
| `src/lib/searchIndex.ts` | Pure function: `searchSeries(query): SeriesMatch[]`. Wraps brandConfig + simple Levenshtein already in `Header.tsx`. |
| `src/app/api/search/listings/route.ts` | Server route for listings search. |

### Files modified

| File | Change |
|---|---|
| `src/components/layout/Header.tsx` | Remove the inline smart-search dropdown (lines ~92–139 and ~768–920). Replace with `<UnifiedSearch variant="header" />`. Keep the URL-paste detection as a separate concern that lives inside `UnifiedSearch` (it fires when the input value matches an auction URL pattern). |
| `src/components/mobile/MobileBottomNav.tsx` | Replace the `SearchEmptyState` + `SearchResultsState` bodies inside `MobileSearchSheet` with `<UnifiedSearch variant="sheet" />`. Keep the input, filter chips (region/status/price), and recent-searches strip outside the unified component — those stay where they are. |
| `src/app/[locale]/search/SearchClient.tsx` | Above the existing results grid, render `<UnifiedSearch variant="inline" />` synced to the page's `q` URL param. The full grid below stays as the deep-dive view with advanced filters. |
| `src/lib/searchHistory.ts` | No change required; `UnifiedSearch` calls `saveSearchQuery` on Enter or click as the current implementations do. |

### Files preserved unchanged

- `src/components/filters/SearchWithAutocomplete.tsx` — still used by `FamilySearchAndFilters` for in-make filtering. Different purpose.
- `src/components/filters/FamilySearchAndFilters.tsx` — local filter within a family page.
- `src/components/search/SearchBar.tsx` — low-level debounced input; `UnifiedSearch` can reuse or inline its own; we'll evaluate during implementation.

## Edge cases

- **Listing without a classifiable series**: `extractSeries` returns `null`. The listing still appears in the un-filtered listings column. It's only hidden when a specific series is active.
- **Series row metadata**: shows the brandConfig year range (`"2005–2012"`) only. No per-series count in v1 — counting would require either an extra fetch or a denormalized field, and Edgar hasn't asked for it. Add later if useful.
- **Series with zero live listings**: the row still shows. The right column shows `"No live listings for 997.2 right now"` plus sold history if present.
- **API failure**: listings column shows a one-line `"Couldn't load listings. Retry."` link. Series column keeps working (pure client).
- **Very long titles**: `truncate` at one line; full title in `title=` attribute for hover.
- **Pasted auction URL**: detection preempts the normal flow. When `UnifiedSearch` sees the input value match an auction URL pattern (existing `detectAuctionUrl` logic in `Header.tsx`), it hides both columns and shows a single full-width row: `"Get Haus Report for this listing →"`. Pressing Enter or clicking that row routes to the Haus Report flow the Header already implements. Reverting to a non-URL value restores the two-column layout.
- **English-only mode**: this work happens after `cambio-idioma-y-otros`. All strings are English. No i18n keys needed for new copy (matches current Header convention).

## Testing

- **Vitest unit** — `searchSeries` returns expected rankings for `"997"`, `"GT3"`, `"porche"` (typo), `""`.
- **Vitest unit** — `useUnifiedSearch` debounces, aborts stale fetches, transitions states correctly.
- **Manual / browser** — checklist run on dev server:
  - Open `⌘K`, see all 27 series and trending listings.
  - Type `"997"`, see series filtered to 3 and listings filtered to 997 cars.
  - Arrow-down to `997.1`, listings column re-filters live.
  - `Enter` on `997.1` → lands on `/cars/porsche?family=997.1`.
  - Mobile viewport: same content stacks vertically, no horizontal scroll.
  - `/search` page shows the unified results above the existing grid.
- **No new e2e** required for v1; the existing Playwright suite is light on search.

## Migration

1. Build `UnifiedSearch` + columns + hook + endpoint behind no flag; component is unused until step 2.
2. Wire `<UnifiedSearch variant="header" />` into `Header.tsx`. Remove old dropdown code in the same commit.
3. Wire `<UnifiedSearch variant="sheet" />` into `MobileSearchSheet`. Remove old empty/results states in the same commit.
4. Wire `<UnifiedSearch variant="inline" />` into `SearchClient.tsx`.
5. QA the three surfaces; ship.

Each step is a separate commit so a regression can be isolated and reverted.

## Open questions

None at time of writing. All key decisions captured in the AskUserQuestion thread on 2026-05-25.
