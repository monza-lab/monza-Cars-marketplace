# TS-region-tab-runtime-stability

## Objective
Verify region tab switching remains stable, strict source mapping behavior is preserved, and invalid remote image URLs cannot crash make/detail routes.

## Environment Matrix
- OS: win32
- Runtime: Node/Next app runtime
- Test runner: Vitest

## Run
1. `npm run test -- src/components/dashboard/DashboardClient.test.ts src/lib/supabaseLiveListings.test.ts`
2. Manual smoke: open `/cars/porsche`, switch `All/US/UK/EU/JP` tabs, and open at least one detail page from each non-empty tab.

## Expected
- All tests pass.
- `DashboardClient` mapping assertions remain true:
  - UK => `AUTO_TRADER`
  - JP => `BE_FORWARD`
  - all/world => unfiltered aggregate path unchanged
- `normalizeListingImageUrl` assertions remain true:
  - `https://m.atcdn.co.uk/...` is accepted.
  - URLs with `{resize}` token are rejected and fallback image path is used.
  - Unknown image hosts are rejected to prevent `next/image` hostname runtime errors.
- Manual smoke shows no 500 on `/cars/porsche` while changing region tabs.

## Notes
- Image 404s from upstream CDNs may still appear in logs for allowed hosts, but route rendering must remain healthy (no `next/image` hostname crash).
