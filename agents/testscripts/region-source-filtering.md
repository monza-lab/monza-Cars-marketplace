# Testscript: Region-Based Source Filtering

**ID:** TS-region-source-filtering
**Created:** 2026-02-22
**Feature:** Region filter buttons now filter by listing source/platform

---

## Objective

Verify that clicking region filter buttons correctly filters listings by their source platform:
- "US" button → shows only BaT (BRING_A_TRAILER) listings
- "EU" button → shows only AutoScout24 listings  
- "All" button → shows all listings
- "UK"/"JP" buttons → show all listings (no specific mapping)

---

## Prerequisites

1. Dev server running: `npm run dev`
2. Database has listings from multiple sources (BaT, AutoScout24, etc.)
3. Browser access to http://localhost:3000

---

## Test Steps

### Step 1: Baseline - All Listings
1. Navigate to http://localhost:3000 (dashboard)
2. Ensure "All" region button is selected (default)
3. **Expected:** All brands/listings visible regardless of platform

### Step 2: US Filter
1. Click the "🇺🇸 US" region button
2. **Expected:** Only listings with `platform === "BRING_A_TRAILER"` are shown
3. **Verify:** Check that visible auction cards show "BaT" platform badge
4. **Verify:** No AutoScout24 ("AS24") listings should appear

### Step 3: EU Filter
1. Click the "🇪🇺 EU" region button
2. **Expected:** Only listings with `platform === "AUTO_SCOUT_24"` are shown
3. **Verify:** Check that visible auction cards show "AS24" platform badge
4. **Verify:** No BaT listings should appear

### Step 4: UK/JP Filters (No Mapping)
1. Click the "🇬🇧 UK" region button
2. **Expected:** All listings shown (no specific platform filter)
3. Click the "🇯🇵 JP" region button
4. **Expected:** All listings shown (no specific platform filter)

### Step 5: Reset to All
1. Click the "🌍 All" region button
2. **Expected:** All listings restored

---

## Edge Cases Handled

1. **Empty results:** If a region has no listings from its mapped platform, shows empty state
2. **Index reset:** When region changes, scroll position resets to top
3. **Unknown region:** Regions without mapping (UK, JP) show all listings
4. **Platform aliases:** Source values like `BaT`, `Bring a Trailer`, `BRING_A_TRAILER`, `AutoScout24`, and `AUTO_SCOUT_24` normalize to canonical platform IDs before filtering

---

## Implementation Details

**File Modified:** `src/components/dashboard/DashboardClient.tsx`

**Change:** Region filtering now normalizes platform aliases before matching:

```typescript
// Region → Source/Platform mapping
const REGION_TO_PLATFORM: Record<string, string> = {
  US: "BRING_A_TRAILER",     // BaT
  EU: "AUTO_SCOUT_24",       // AutoScout24
  // UK and JP: no specific platform filter yet
}

// Filter auctions by region (maps to source platform), then aggregate
const filteredAuctions = useMemo(() => {
  if (!selectedRegion) return auctions
  const targetPlatform = REGION_TO_PLATFORM[selectedRegion]
  if (!targetPlatform) return auctions // Unknown region → show all
return auctions.filter((auction) => normalizeAuctionPlatform(auction.platform) === targetPlatform)
}, [auctions, selectedRegion])
```

---

## Verification Checklist

- [ ] US button shows only BaT listings
- [ ] EU button shows only AutoScout24 listings
- [ ] All button shows all listings
- [ ] UK button shows all listings
- [ ] JP button shows all listings
- [ ] Filter persists during navigation within dashboard
- [ ] Scroll resets to top when filter changes
- [ ] Mobile layout works correctly
- [ ] Desktop layout works correctly
