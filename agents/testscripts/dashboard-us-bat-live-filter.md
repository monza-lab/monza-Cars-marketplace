# TS-dashboard-us-bat-live-filter

## Objective
Verify the dashboard data pipeline no longer truncates US (BaT) live listings when another source has sparse/zero rows.

## Run
- `npm run test -- src/lib/supabaseLiveListings.test.ts`
- `npm run test -- src/features/porsche_collector/normalize.test.ts`

## Expected
- Interleave helper returns all BaT rows when the parallel source array is empty.
- Platform normalization regression remains green.
