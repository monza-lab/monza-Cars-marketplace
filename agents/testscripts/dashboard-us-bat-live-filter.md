# TS-dashboard-live-tabs-source-completeness

## Objective
Verify dashboard live-tab completeness for US (BaT) and EU (AutoScout24), including legacy source/status normalization.

## Run
- `npm run test -- src/components/dashboard/DashboardClient.test.ts`
- `npm run test -- src/lib/supabaseLiveListings.test.ts`
- `npm run test -- src/features/porsche_collector/normalize.test.ts`
- `npm run build`

## Expected
- Interleave helper returns all BaT rows when the parallel source array is empty.
- Dashboard tab mapping remains `US -> BRING_A_TRAILER` and `EU -> AUTO_SCOUT_24`.
- Source normalization maps BaT/AutoScout aliases and platform fallbacks to canonical sources.
- Live status normalization accepts `active/ACTIVE/live/ENDING_SOON` and rejects ended statuses.
- Build passes with no type/runtime regressions.
