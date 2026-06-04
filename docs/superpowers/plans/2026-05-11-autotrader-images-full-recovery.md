# AutoTrader UK Images — Full Recovery Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix missing/broken AutoTrader images across the entire app by: (1) bulk-enriching 1,375 stale listings via Scrapling, (2) migrating all remaining raw `<Image>` components to `SafeImage` with dimension-checking, (3) removing dead Vercel cron entries and increasing GH Actions enrichment frequency.

**Architecture:** The enrichment script already exists (`scripts/autotrader-enrich-scrapling.ts`) but its query filter misses image-only stale listings. We widen the filter, run a bulk pass locally, then increase the GH Actions schedule from 1x/day to 4x/day. In parallel, we migrate 3 high-impact components from raw `<Image>` to the canonical `SafeImage` (which detects AutoTrader's 1.5KB `no_image.png` placeholder via dimension check). Finally we remove the Vercel cron entries that always fail with CF 403.

**Tech Stack:** Next.js, React, TypeScript, Supabase, Scrapling (Python 3.11)

---

## Current State (2026-05-11)

| Metric | Value |
|--------|-------|
| Active AutoTrader listings | 2,051 |
| With `{resize}` (un-enriched) | 1,375 (67%) |
| Fully enriched (gallery images) | 675 (33%) |
| Stuck since May 8 | 1,041 listings |
| Vercel enrichment success rate | ~40% (CF-blocked) |
| GH Actions enrichment frequency | 1x/day (300 listings max) |

## File Structure

### Modified Files

| File | Responsibility |
|------|---------------|
| `scripts/autotrader-enrich-scrapling.ts` | Widen query to catch image-stale listings |
| `.github/workflows/autotrader-enrich.yml` | Increase schedule from 1x to 4x daily, raise limit |
| `vercel.json` | Remove dead AutoTrader cron entries |
| `src/components/shared/ImageGallery.tsx` | Migrate 3 `<Image>` to `SafeImage` |
| `src/components/dashboard/DashboardClient.tsx` | Replace local `SafeImage` with canonical import |
| `src/components/dashboard/cards/SafeImage.tsx` | Forward caller `onLoad` prop after dimension check |

---

## Chunk 1: Enrichment Pipeline Fixes

### Task 1: Widen enrichment query to catch image-stale listings

The current `autotrader-enrich-scrapling.ts` query at line 97 only filters for `engine.is.null,transmission.is.null,mileage.is.null,description_text.is.null`. This misses listings that have all text fields but still have `{resize}` thumbnail URLs (photos_count ≤ 4). We add `photos_count.lt.5` to the OR filter (un-enriched listings have exactly 4 GraphQL thumbnails; real listings with 5-9 photos should not be re-processed).

**Files:**
- Modify: `scripts/autotrader-enrich-scrapling.ts:92-99`

- [ ] **Step 1: Update the Supabase query filter and select clause**

In `scripts/autotrader-enrich-scrapling.ts`, add `photos_count` to the select and widen the `.or()` filter:

```typescript
// Before (line 94):
.select("id, source_url, title, engine, transmission, mileage, vin, color_exterior, description_text, images")

// After:
.select("id, source_url, title, engine, transmission, mileage, vin, color_exterior, description_text, images, photos_count")
```

```typescript
// Before (line 97):
.or("engine.is.null,transmission.is.null,mileage.is.null,description_text.is.null")

// After:
.or("engine.is.null,transmission.is.null,mileage.is.null,description_text.is.null,photos_count.lt.5")
```

- [ ] **Step 2: Also update the image-write condition**

The current condition at line 196 only writes images when `listing.images.length <= 1`. Change to also replace `{resize}` URLs:

```typescript
// Before (line 196):
if (detail.images.length > 0 && (!listing.images || listing.images.length <= 1)) {

// After:
const hasStaleImages = listing.images?.some((img: string) => img.includes("{resize}")) ?? false;
if (detail.images.length > 0 && (!listing.images || listing.images.length <= 1 || hasStaleImages)) {
```

- [ ] **Step 3: Verify the script compiles**

Run: `npx tsc --noEmit scripts/autotrader-enrich-scrapling.ts`
(If this fails due to project config, run: `npx tsx --eval "import './scripts/autotrader-enrich-scrapling'"`)

- [ ] **Step 4: Commit**

```bash
git add scripts/autotrader-enrich-scrapling.ts
git commit -m "fix(enrichment): widen query to catch image-stale AutoTrader listings"
```

---

### Task 2: Run local bulk enrichment

Run the existing enrichment script locally with Scrapling to fix the 1,375 un-enriched listings. This is a one-time manual operation.

**Files:** None (operational task)

- [ ] **Step 1: Preflight check**

Run the preflight to verify Scrapling can reach AutoTrader from this machine:

```bash
SCRAPLING_PYTHON=python npx tsx scripts/autotrader-enrich-scrapling.ts --preflight
```

Expected: At least 3/5 listings return OK (not CF-blocked).

- [ ] **Step 2: Dry run with small batch**

Test with 10 listings to verify the widened query catches image-stale rows:

```bash
SCRAPLING_PYTHON=python npx tsx scripts/autotrader-enrich-scrapling.ts --limit=10 --dryRun
```

Expected: Output shows listings with `engine=<value>` (already enriched text fields) but being re-enriched for images.

- [ ] **Step 3: Run first real batch (200 listings)**

```bash
SCRAPLING_PYTHON=python npx tsx scripts/autotrader-enrich-scrapling.ts --limit=200 --delayMs=2000
```

Expected: `Written: ~150-200`, some skipped (CF-blocked or delisted).

- [ ] **Step 4: Run remaining batches**

Repeat until the count of `photos_count < 10` listings drops below 100. Each batch takes ~10 min at 200 listings with 3s delay:

```bash
SCRAPLING_PYTHON=python npx tsx scripts/autotrader-enrich-scrapling.ts --limit=500 --delayMs=2000
```

Monitor progress — if consecutive nulls hit the circuit breaker, wait 5 minutes and retry.

- [ ] **Step 5: Verify results in database**

After all batches complete, check the remaining un-enriched count:

```bash
# Quick check via the app's API or Supabase dashboard
# Target: <100 listings with photos_count < 10
```

---

### Task 3: Increase GH Actions enrichment frequency

Currently runs 1x/day at 03:30 UTC processing 300 listings. At 3s delay, 300 listings = ~15 min. We can safely run 4x/day at 500 listings each (within the 30-min timeout).

**Files:**
- Modify: `.github/workflows/autotrader-enrich.yml:5,9`

- [ ] **Step 1: Update cron schedule and default limit**

```yaml
# Before:
on:
  schedule:
    - cron: '30 3 * * *'     # 03:30 UTC daily (after collector at 02:00)
  workflow_dispatch:
    inputs:
      limit:
        description: 'Max listings to enrich'
        default: '300'

# After:
on:
  schedule:
    - cron: '30 3 * * *'     # 03:30 UTC (after collector at 02:00)
    - cron: '30 9 * * *'     # 09:30 UTC
    - cron: '30 15 * * *'    # 15:30 UTC
    - cron: '30 21 * * *'    # 21:30 UTC
  workflow_dispatch:
    inputs:
      limit:
        description: 'Max listings to enrich'
        default: '500'
```

- [ ] **Step 2: Update the limit in the run command default**

```yaml
# Before (line 58):
--limit=${{ github.event.inputs.limit || '300' }} \

# After:
--limit=${{ github.event.inputs.limit || '500' }} \
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/autotrader-enrich.yml
git commit -m "perf(enrichment): run AutoTrader enrichment 4x/day at 500 listings"
```

---

### Task 4: Remove dead Vercel AutoTrader cron entries

Both `/api/cron/autotrader` and `/api/cron/enrich-autotrader` always fail with Cloudflare 403 from Vercel's datacenter IPs. The same work is done by GH Actions workflows. Remove them.

**Files:**
- Modify: `vercel.json:19-20`

- [ ] **Step 1: Remove the two AutoTrader entries from vercel.json**

Replace lines 18-20 exactly. The trailing comma on `refresh-valuation-factors` must be removed since it becomes the last array element:

```json
// Before (lines 18-20):
    { "path": "/api/cron/refresh-valuation-factors", "schedule": "30 10 * * *" },
    { "path": "/api/cron/autotrader",         "schedule": "0 2 * * *" },
    { "path": "/api/cron/enrich-autotrader",  "schedule": "30 2 * * *" }

// After (line 18 only):
    { "path": "/api/cron/refresh-valuation-factors", "schedule": "30 10 * * *" }
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'));console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore: remove dead AutoTrader Vercel crons (replaced by GH Actions)"
```

---

## Chunk 2: SafeImage Migration

### Task 5: Migrate ImageGallery.tsx to SafeImage

This is the highest-impact migration — the gallery is used on every car detail page and has 3 raw `<Image>` instances that show AutoTrader's gray placeholder without any fallback.

**Files:**
- Modify: `src/components/shared/ImageGallery.tsx`

- [ ] **Step 1: Replace import and add fallback icon**

```typescript
// Before (line 4):
import Image from "next/image";

// After:
import { Car as CarIcon } from "lucide-react";
import { SafeImage } from "@/components/dashboard/cards/SafeImage";
```

- [ ] **Step 2: Replace main image (line 97-109)**

```typescript
// Before:
<Image
  src={images[selectedIndex]}
  alt={`${alt} - Image ${selectedIndex + 1}`}
  fill
  className={cn(
    "object-cover transition-opacity duration-300",
    mainLoaded ? "opacity-100" : "opacity-0"
  )}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 50vw"
  priority={selectedIndex === 0}
  onLoad={() => setMainLoaded(true)}
  referrerPolicy="no-referrer"
/>

// After:
<SafeImage
  src={images[selectedIndex]}
  alt={`${alt} - Image ${selectedIndex + 1}`}
  fill
  className={cn(
    "object-cover transition-opacity duration-300",
    mainLoaded ? "opacity-100" : "opacity-0"
  )}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 50vw"
  priority={selectedIndex === 0}
  onLoad={() => setMainLoaded(true)}
  referrerPolicy="no-referrer"
  fallback={
    <div className="absolute inset-0 flex items-center justify-center bg-card">
      <CarIcon className="size-12 text-muted-foreground/25" />
    </div>
  }
/>
```

Note: When SafeImage detects a placeholder and renders its fallback, `onLoad` never fires, so `mainLoaded` stays `false` and the skeleton overlay stays visible. This is fine — the fallback `div` uses `absolute inset-0` with `z-auto` which paints over the skeleton since it comes later in DOM order. Step 5 (SafeImage fix) ensures `callerOnLoad` only fires when the image passes the dimension check.

- [ ] **Step 3: Replace thumbnail image (line 182-195)**

```typescript
// Before:
<Image
  src={image}
  alt={`${alt} - Thumbnail ${index + 1}`}
  fill
  className={cn(
    "object-cover transition-opacity",
    thumbnailsLoaded[index] ? "opacity-100" : "opacity-0"
  )}
  sizes="96px"
  onLoad={() =>
    setThumbnailsLoaded((prev) => ({ ...prev, [index]: true }))
  }
  referrerPolicy="no-referrer"
/>

// After:
<SafeImage
  src={image}
  alt={`${alt} - Thumbnail ${index + 1}`}
  fill
  className={cn(
    "object-cover transition-opacity",
    thumbnailsLoaded[index] ? "opacity-100" : "opacity-0"
  )}
  sizes="96px"
  onLoad={() =>
    setThumbnailsLoaded((prev) => ({ ...prev, [index]: true }))
  }
  referrerPolicy="no-referrer"
  fallback={
    <div className="absolute inset-0 flex items-center justify-center bg-muted">
      <CarIcon className="size-4 text-muted-foreground/25" />
    </div>
  }
/>
```

- [ ] **Step 4: Replace lightbox image (line 238-246)**

```typescript
// Before:
<Image
  src={images[selectedIndex]}
  alt={`${alt} - Image ${selectedIndex + 1}`}
  fill
  className="object-contain p-4"
  sizes="90vw"
  priority
  referrerPolicy="no-referrer"
/>

// After:
<SafeImage
  src={images[selectedIndex]}
  alt={`${alt} - Image ${selectedIndex + 1}`}
  fill
  className="object-contain p-4"
  sizes="90vw"
  priority
  referrerPolicy="no-referrer"
  fallback={
    <div className="absolute inset-0 flex items-center justify-center bg-card">
      <CarIcon className="size-16 text-muted-foreground/25" />
    </div>
  }
/>
```

- [ ] **Step 5: Fix SafeImage to forward onLoad prop**

The current `SafeImage` replaces `onLoad` with its dimension-check handler, discarding any caller-provided `onLoad`. Fix it to destructure `onLoad` at the parameter level and call the caller's handler after the dimension check passes.

In `src/components/dashboard/cards/SafeImage.tsx`:

```typescript
// Before — full component signature + body:
export function SafeImage({
  src,
  alt,
  fallback,
  fallbackSrc,
  ...props
}: React.ComponentProps<typeof Image> & { fallback: React.ReactNode; fallbackSrc?: string }) {
  const [useFallback, setUseFallback] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const handleError = useCallback(() => {
    if (!useFallback && fallbackSrc) {
      setUseFallback(true)
    } else {
      setFallbackFailed(true)
    }
  }, [useFallback, fallbackSrc])

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      if (img.naturalWidth * img.naturalHeight < MIN_IMAGE_AREA) {
        handleError()
      }
    },
    [handleError],
  )

  const activeSrc = !useFallback ? src : fallbackSrc
  if (!activeSrc || fallbackFailed) return <>{fallback}</>
  return (
    <Image
      key={String(activeSrc)}
      src={activeSrc}
      alt={alt}
      onError={handleError}
      onLoad={handleLoad}
      {...props}
    />
  )
}

// After:
export function SafeImage({
  src,
  alt,
  fallback,
  fallbackSrc,
  onLoad: callerOnLoad,
  ...restProps
}: React.ComponentProps<typeof Image> & { fallback: React.ReactNode; fallbackSrc?: string }) {
  const [useFallback, setUseFallback] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const handleError = useCallback(() => {
    if (!useFallback && fallbackSrc) {
      setUseFallback(true)
    } else {
      setFallbackFailed(true)
    }
  }, [useFallback, fallbackSrc])

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      if (img.naturalWidth * img.naturalHeight < MIN_IMAGE_AREA) {
        handleError()
      } else {
        callerOnLoad?.(e)
      }
    },
    [handleError, callerOnLoad],
  )

  const activeSrc = !useFallback ? src : fallbackSrc
  if (!activeSrc || fallbackFailed) return <>{fallback}</>
  return (
    <Image
      key={String(activeSrc)}
      src={activeSrc}
      alt={alt}
      onError={handleError}
      onLoad={handleLoad}
      {...restProps}
    />
  )
}
```

Key changes:
- `onLoad` is destructured as `callerOnLoad` at the parameter level (type-safe — `React.ComponentProps<typeof Image>` includes `onLoad`)
- `...restProps` no longer contains `onLoad`, so `{...restProps}` cannot overwrite the explicit `onLoad={handleLoad}`
- `callerOnLoad?.(e)` fires only when the image passes the dimension check (real photo, not placeholder)
- When the placeholder is detected, `handleError()` fires and the fallback renders — `callerOnLoad` is never called

**Note on ImageGallery interaction:** When SafeImage renders its fallback ReactNode (the `<CarIcon>` div), the `onLoad` callback never fires, so `mainLoaded` stays `false` and the skeleton overlay remains visible. This is fine because the fallback `<div>` uses `absolute inset-0` which covers the skeleton entirely.

- [ ] **Step 6: Verify the page renders correctly**

Run: `npm run dev`
Navigate to a car detail page with an AutoTrader listing.
Expected: Gallery renders with either real photos or the car-icon fallback — no gray "No image available" placeholder.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/ImageGallery.tsx src/components/dashboard/cards/SafeImage.tsx
git commit -m "fix(images): migrate ImageGallery to SafeImage with dimension-checking fallback"
```

---

### Task 6: Replace local SafeImage in DashboardClient with canonical import

`DashboardClient.tsx` defines its own local `SafeImage` (line 500-527) that lacks the dimension-checking `onLoad` handler. Replace it with an import of the canonical version.

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add canonical import**

Add to the imports section at the top of the file:

```typescript
import { SafeImage } from "@/components/dashboard/cards/SafeImage"
```

- [ ] **Step 2: Delete the local SafeImage function**

Remove lines 499-527 (the comment `// ─── SAFE IMAGE...` through the closing brace of the local function).

- [ ] **Step 3: Verify no compile errors**

Run: `npx tsc --noEmit`
The canonical `SafeImage` has the same interface (`src, alt, fallback, fallbackSrc, ...props`), so all 7 call sites should work without changes.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "refactor: replace local SafeImage with canonical import in DashboardClient"
```

---

## Chunk 3: Verification

### Task 7: End-to-end verification

- [ ] **Step 1: Run dev server and check browse page**

Run: `npm run dev`
Navigate to the browse page filtered by UK region.
Expected: AutoTrader cards show either real photos or the car-icon fallback — no gray AutoTrader "No image available" placeholders.

- [ ] **Step 2: Check a car detail page**

Click on an AutoTrader listing.
Expected: Gallery renders correctly with fallback icons for stale images.

- [ ] **Step 3: Check dashboard**

Navigate to the dashboard.
Expected: Family cards with AutoTrader listings show correctly.

- [ ] **Step 4: Verify enrichment metrics**

After the local bulk enrichment (Task 2), check the database:
- Target: `photos_count < 10` active AutoTrader listings < 100
- Target: `photos_count >= 10` active AutoTrader listings > 1,900

- [ ] **Step 5: Final commit with all changes**

If any fixes were needed during verification, commit only the specific modified files:

```bash
git add <modified-files>
git commit -m "fix(autotrader): complete image recovery — enrichment + SafeImage migration"
```
