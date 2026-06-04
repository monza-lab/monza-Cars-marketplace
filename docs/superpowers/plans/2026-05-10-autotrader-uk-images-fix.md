# AutoTrader UK Images Fix — 2026-05-10

## Problem

UK AutoTrader listings had two issues:
1. **Listings not loading at all** — UK region showed "No active listings"
2. **Stale CDN images** — many AutoTrader listing images showed "Image not available" (AutoTrader's own placeholder)

## Root Cause Analysis

### Issue 1: UK region returns zero listings

**File**: `src/app/api/mock-auctions/route.ts` (line 116-117)

The `useInfiniteAuctions` hook does NOT send a `status` query param to the API.
The API route had: `!status || status === "all" || ...` which defaulted to `dbStatus = "all"`.

With `status = "all"`, `applyLiveStatusFilter()` is skipped, so **all** statuses (active, sold, ended, delisted) are queried. Keyset pagination sorts by `end_time ASC NULLS LAST`, and AutoTrader dealer listings have `end_time = NULL` — they sort **last**, behind potentially thousands of ended listings.

The client-side filter in the hook (line 148-149) drops everything except `ACTIVE`/`ENDING_SOON`. With 4 pages x 50 rows = 200 rows of ended listings, zero active ones reach the UI.

**Fix**: Removed `!status ||` so the default becomes `"active"` instead of `"all"`.

```typescript
// Before
const dbStatus = !status || status === "all" || status === "Ended" || status === "ENDED" ? "all" : "active";

// After
const dbStatus = status === "all" || status === "Ended" || status === "ENDED" ? "all" : "active";
```

### Issue 2: Stale AutoTrader CDN images

**Root cause**: AutoTrader purges images from their CDN (`m.atcdn.co.uk`) when listings are updated or delisted. The CDN returns a `307 Redirect` to `https://m.atcdn.co.uk/a/media/no_image.png` (275x155px, 1.5KB). This is a valid image, so:
- Next.js Image optimizer follows the redirect and serves the placeholder
- The browser renders it successfully — `onError` never fires
- The user sees AutoTrader's gray "Image not available" placeholder

**Scale**: ~46% of the oldest AutoTrader image URLs are stale (tested batch of 50 oldest listings). Newest listings are 100% valid.

**Fix**: Enhanced `SafeImage` component with `onLoad` dimension detection:
- AutoTrader's `no_image.png`: 275x155 = **42,625 px**^2
- Real car photos via Next.js optimization: 304x203+ = **61,712+ px**^2
- Threshold set at **50,000 px**^2 — cleanly separates the two
- When a loaded image area is below the threshold, the fallback ReactNode renders instead

Also fixed a state machine bug: when the primary image failed with no `fallbackSrc`, `fallbackFailed` was set but the render condition `useFallback && fallbackFailed` was never true (since `useFallback` stayed `false`). Changed to just `fallbackFailed`.

## Files Changed

### 1. `src/app/api/mock-auctions/route.ts`
- Changed default `dbStatus` from `"all"` to `"active"` when no status param is sent
- This fixes UK/region-filtered listings not appearing

### 2. `src/components/dashboard/cards/SafeImage.tsx`
- Added `onLoad` handler with `MIN_IMAGE_AREA = 50,000` dimension check
- Detects CDN placeholder images that load successfully but are tiny
- Fixed state machine: `fallbackFailed` now triggers fallback regardless of `useFallback` state
- Extracted `handleError` and `handleLoad` into `useCallback` hooks

### 3. `src/components/browse/BrowseCard.tsx` (Classic grid view)
- Replaced `<Image>` with `<SafeImage>` + `ImageOff` icon fallback
- Removed unused `Image` import, added `ImageOff` and `SafeImage` imports

### 4. `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`
- Hero image: replaced `<Image>` with `<SafeImage>` + car title text fallback
- Similar vehicles thumbnails: replaced `<Image>` with `<SafeImage>` + muted bg fallback
- Added `SafeImage` import

### 5. `src/components/makePage/CarCard.tsx` (Monza grid view)
- Replaced `<Image>` with `<SafeImage>` + `ImageOff` icon fallback
- Removed unused `Image` import, added `ImageOff` and `SafeImage` imports

### 6. `src/components/makePage/CarFeedCard.tsx` (Monza feed view)
- Replaced conditional `Image`/text-div with `<SafeImage>` + year/model text fallback
- Removed unused `Image` import, added `SafeImage` import

## Database Stats (at time of fix)

| Metric | Value |
|--------|-------|
| Total AutoTrader listings | 2,815 |
| Status = `active` | 2,815 (100%) |
| With images in DB | 2,807 (99.7%) |
| With `{resize}` placeholder URLs | 1,956 (69.5%) |
| Stale CDN images (oldest batch) | ~46% |
| Stale CDN images (newest batch) | 0% |
| URL normalization working | Yes |
| CSP / Next.js config correct | Yes (`m.atcdn.co.uk` allowed) |

## Commit Suggestion

```
feat(images): fix UK listings not loading and detect stale AutoTrader CDN images

- Default API status to "active" instead of "all" when no param sent,
  fixing keyset pagination burying active dealer listings behind ended ones
- Enhance SafeImage with onLoad dimension check (50K px² threshold) to
  detect AutoTrader's no_image.png placeholder served via 307 redirect
- Fix SafeImage state machine: fallbackFailed now triggers fallback
  regardless of useFallback state
- Apply SafeImage to BrowseCard, CarCard, CarFeedCard, and ReportClient
  hero/similar-vehicles images
```

## Future Improvements

- **Data-side cleanup**: Run a background job to HEAD-check all AutoTrader image URLs and mark listings with stale images as `delisted` or re-scrape them for fresh image URLs
- **Enrichment**: The 1,956 un-enriched listings (only 4 GraphQL thumbnails) should be enriched via detail page scraping to get full image sets
- **Other components**: `ImageGallery.tsx`, `CarDetailClient.tsx`, `AuctionCard.tsx`, `SearchClient.tsx`, and other components still use raw `<Image>` without error handling — consider migrating to `SafeImage`
