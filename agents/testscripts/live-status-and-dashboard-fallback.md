# TS: live-status-and-dashboard-fallback

## Objective
Validate enum-safe live status filtering and dashboard false-empty fallback behavior.

## Prerequisites
- Repo dependencies installed (`npm install`).

## Run Commands
```bash
npm run test -- src/lib/supabaseLiveListings.test.ts src/components/dashboard/DashboardClient.test.ts
npx eslint src/lib/supabaseLiveListings.ts
npx eslint src/lib/supabaseLiveListings.test.ts
npx eslint src/components/dashboard/platformMapping.ts
npx eslint src/components/dashboard/DashboardClient.test.ts
npx eslint src/components/dashboard/DashboardClient.tsx
npx tsc --noEmit --pretty false --incremental false --skipLibCheck

# Runtime verification
npm run dev -- --port 3200
# in another shell:
curl -sS "http://127.0.0.1:3200/api/mock-auctions?limit=12"
curl -sS "http://127.0.0.1:3200/api/mock-auctions?limit=12&make=Porsche"
rg -n "invalid input value for enum monza_listing_status|\[supabaseLiveListings\]|error" agents/testscripts/artifacts/runtime-dev.log
```

## Expected Observations
- Focused Vitest suites pass.
- Lint passes for modified helper/test files.
- `DashboardClient.tsx` may report pre-existing lint violations unrelated to this fix.
- Typecheck may fail on pre-existing generated `.next/dev/types/*` parse errors.
