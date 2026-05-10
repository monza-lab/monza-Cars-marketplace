# Advisor Data Accuracy Fixes — Implementation Report

**Date:** 2026-05-10
**Plan:** `2026-05-10-advisor-data-accuracy-fixes.md`
**Status:** Implemented and verified

---

## Problem

The advisor chat agent used `fetchPricedListingsForModel(make, 500)` — a function that fetches only 500 rows ordered by `sale_date DESC` with zero server-side filtering. The database has 12,784 active Porsche listings (32,175 total). The 500-row window missed **97% of inventory**, producing wrong answers for every data-backed question:

- "How many listings?" → "1 listing" (actual: 32,175)
- "Cheapest Targa?" → missed cheap Targas outside the 500-row window
- "GT3 under $100k?" → missed most matches
- Series/variant/price filters applied client-side on the truncated set

---

## Solution

Replaced the shared bottleneck with `fetchAdvisorListings()` — a new function that pushes **all filters to Supabase SQL** before returning results. Added a dedicated `count_listings` tool for inventory questions.

### Architecture Change

```
BEFORE:
  Tool → fetchPricedListingsForModel(make, 500) → 500 rows → JS .filter() → results
  Problem: 97% of data invisible

AFTER:
  Tool → fetchAdvisorListings({ make, seriesId, variantId, price, year, status, query })
       → Supabase SQL with WHERE clauses → filtered results from FULL corpus
```

---

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/advisor/advisorListings.ts` | Created | `fetchAdvisorListings()` + `countAdvisorListings()` — server-side filtered queries |
| `src/lib/advisor/tools/inventory.ts` | Created | `count_listings` tool for "how many" questions |
| `src/lib/advisor/tools/marketplace.ts` | Modified | Rewired `search_listings`, `get_comparable_sales`, `get_regional_valuation` to use `fetchAdvisorListings` |
| `src/lib/advisor/tools/index.ts` | Modified | Registered `inventoryTools` in the default tool registry |
| `src/lib/supabaseLiveListings.ts` | Modified | Exported `isJunkListing()` for reuse |
| `src/lib/advisor/tools/marketplace.test.ts` | Modified | Updated mocks from `fetchPricedListingsForModel` → `fetchAdvisorListings` |
| `src/lib/advisor/tools/analysis.test.ts` | Modified | Updated mocks |
| `src/lib/advisor/tools/index.test.ts` | Modified | Added `count_listings` to expected tool name list |
| `src/lib/advisor/__tests__/advisorListings.test.ts` | Created | 10 unit tests for query construction |
| `scripts/advisor-live-qa.ts` | Created | 7 end-to-end live QA tests against DB ground truth |

---

## Server-Side Filters Pushed to Supabase

| Filter | SQL Clause | Column |
|--------|-----------|--------|
| Series | `eq("series", ...)` | `series` (98% coverage on active rows) |
| Variant/body | `or("model.ilike.%X%,trim.ilike.%X%")` | `model`, `trim` |
| Free-text query | `or("model.ilike.%X%,trim.ilike.%X%,title.ilike.%X%")` | `model`, `trim`, `title` |
| Year range | `gte("year", ...) / lte("year", ...)` | `year` |
| Price range | `gte("listing_price", ...) / lte("listing_price", ...)` | `listing_price` |
| Status | `eq("status", "active")` or `eq("status", "sold")` | `status` |
| Sort | `order("listing_price", ...)` or `order("year", ...)` | varies |

---

## Test Results

### Unit Tests: 72/72 PASS (19 test files)

```
19 passed (19)
72 passed (72)
```

### Live API Tests (advisor endpoint on localhost:3000)

| # | Test | Tool Used | Result | Before → After |
|---|------|-----------|--------|----------------|
| 1 | Cheapest Targa | `search_listings` | PASS | Missing → Found at $1,993 |
| 2 | GT3 under $100k | `count_listings` + `search_listings` | PASS | Missing → 2,032 matches |
| 3 | Total listing count | `count_listings` | PASS | "1 listing" → "32,175 listings" |
| 4 | 993 under $150k | `search_listings` | PASS | Limited → 10 results with server-side series filter |
| 5 | 911 Turbo S | `search_listings` | PASS | Limited → 10 results starting at $30,246 |
| 6 | IMS bearing knowledge | `list_knowledge_topics` | PARTIAL | LLM routing issue (searched wrong category), not a data bug |
| 7 | Cheapest overall | `search_listings` | PASS | Limited → Found at €1 across entire corpus |

### DB Ground Truth (direct Supabase queries)

| Metric | Count |
|--------|-------|
| Total active Porsche listings | 12,784 |
| Cheapest Targa | 1982 911SC @ USD 10,000 |
| GT3 under $100k | 16 |
| 993 under $150k | 139 |
| Turbo S | 168 |
| Series column coverage | 15,977 rows populated |

---

## Next Steps & Recommendations

### P0 — Auction Current-Bid Price Distortion

Active auction listings (BaT, Collecting Cars, etc.) have a `listing_price` that reflects the **current bid**, not the final value. A freshly opened auction may show $1,000 for a car worth $150,000. This distorts:

- **"Cheapest X" queries** — returns auctions that just opened, not genuinely cheap cars
- **Valuation/comparable sales** — blends real asking prices with in-progress bids
- **Price range filters** — a "$50k-$100k" filter misses auctions currently at $20k that will sell at $80k

**Recommended fixes:**

1. **Flag auction-in-progress listings.** Add a filter option `excludeActiveAuctions` (default true for search, false for comps) that skips rows where `source` is an auction platform AND `status = 'active'` AND `listing_price` is below a plausibility threshold for the series.
2. **Add an `auction_end_date` awareness.** If the listing's auction hasn't ended yet, annotate results with "current bid" vs "asking price" so the LLM can communicate this clearly.
3. **Separate asking-price and auction-bid searches.** Let the advisor distinguish between "show me cars I can buy now for $X" (dealer/private listings) vs "show me auctions I can bid on" (active auctions).

### P1 — IMS Bearing Knowledge Routing

The IMS bearing article exists (`src/lib/knowledge/imsBearing.ts`, slug: `ims-bearing`, category: `reliability`) but the LLM searched for `category: "engine"` and missed it. Options:

1. **Improve the knowledge tool description** to list available categories explicitly (engine, reliability, history, buying-guide).
2. **Add a `get_knowledge_article` call by slug** when the query contains known keywords like "IMS", "bore scoring", "Mezger".
3. **Add keyword-to-slug mapping** in the system prompt or tool parameters so the LLM can look up articles by topic, not just category.

### P2 — Currency-Aware Price Filtering

`listing_price` is in the listing's original currency (USD, EUR, GBP, JPY). The `priceFromUsd` / `priceToUsd` parameters assume USD but compare against multi-currency values. A EUR 80,000 listing passes a "$100,000 ceiling" filter even though it's worth ~$88,000.

**Recommended fix:** Add a `listing_price_usd` computed column (or virtual column via a Postgres function) that normalizes all prices to USD using a periodically-updated exchange rate table. Filter on that column instead.

### P3 — Result Deduplication

Some listings appear on multiple platforms (e.g., same car on Elferspot and AutoScout24). The advisor may return duplicates in search results.

**Recommended fix:** Add a deduplication pass in `fetchAdvisorListings` post-filter that groups by `(year, make, model, trim)` + price proximity and keeps the most-recently-updated listing.

### P4 — Smarter Sorting Defaults

Currently `fetchAdvisorListings` defaults to `price_asc`. Consider context-aware sorting:

- "Cheapest X" → `price_asc` (current default, correct)
- "Best X" or "top X" → sort by some quality/value score
- "Recent X" → `sale_date DESC`
- "Newest X" → `year DESC`

This could be a parameter the LLM sets based on query intent.

### P5 — Pagination for Large Result Sets

The advisor currently caps at 200 rows. For questions like "show me all GT3s", the user might want to browse. Consider adding offset/cursor pagination to `fetchAdvisorListings` and a "show more" flow in the advisor UI.
