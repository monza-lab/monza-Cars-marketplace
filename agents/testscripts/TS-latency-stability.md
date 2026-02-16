# TS-LATENCY-STABILITY

## Objective
Validate that DB/Supabase/network failure paths fail fast and key routes remain responsive.

## Prerequisites
- `.env.local` configured for app runtime.
- Dev server running on port `3000`.

## Setup
1. `npm run dev`

## Run
1. `curl -sS -o /tmp/mock-auctions.json -w "mock-auctions status=%{http_code} total=%{time_total}s\n" "http://localhost:3000/api/mock-auctions?limit=120"`
2. `curl -sS -L -o /tmp/car-detail.html -w "car-detail status=%{http_code} total=%{time_total}s\n" "http://localhost:3000/en/cars/ferrari/live-<knownLiveId>"`
3. `curl -sS -L -o /tmp/report.html -w "report status=%{http_code} total=%{time_total}s\n" "http://localhost:3000/en/cars/ferrari/live-<knownLiveId>/report"`
4. `curl -sS -o /tmp/root.html -w "root status=%{http_code} total=%{time_total}s\n" "http://localhost:3000/"`
5. `grep -E "getMarketDataForMake|getMarketDataForModel|getComparablesForModel|getAnalysisForCar|getSoldAuctionsForMake|getAnalysesForMake|EHOSTUNREACH" /tmp/monza-dev.log`

## Expected
- `mock-auctions` returns `200` without long (20s+) stalls.
- car detail route returns `200` without long (25s+) stalls.
- report route returns `200` without repeated Prisma error spam.
- `/` returns `200` without intermittent `404`.

## Artifacts
- `/tmp/mock-auctions.json`
- `/tmp/car-detail.html`
- `/tmp/report.html`
- `/tmp/root.html`
- `/tmp/monza-dev.log`

## Cleanup
1. Stop dev server.
