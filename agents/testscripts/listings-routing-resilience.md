# TS-Listings-Routing-Resilience

## Objective
Verify localized API rewrites, live listing status filters, and degraded API behavior under DB outages.

## Prerequisites
- `npm install`
- `npm run dev`
- Optional outage simulation: set `DATABASE_URL` to an unreachable host.

## Run
1. `curl -i http://localhost:3000/api/user/profile`
2. `curl -i http://localhost:3000/de/api/user/profile`
3. `curl -i -X POST http://localhost:3000/de/api/user/create -H 'Content-Type: application/json' -d '{}'`
4. `curl -i 'http://localhost:3000/api/mock-auctions?limit=8'`
5. `curl -i 'http://localhost:3000/api/auctions?limit=2000'`
6. Open `http://localhost:3000/de/cars/porsche/live-<existing-listing-id>`

## Expected
- Steps 2-3 do not return 404 (rewritten to `/api/*`).
- Step 4 returns auctions when Supabase is reachable and does not emit enum errors for `ACTIVE`.
- Step 5 returns quickly; on DB outage, returns `success: true`, `degraded: true`, and empty data instead of long hang + 500.
- Step 6 avoids `notFound` on transient Supabase failure and shows temporary-unavailable state.
