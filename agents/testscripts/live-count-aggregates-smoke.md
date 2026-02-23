# TS-live-count-aggregates-smoke

## Objective
Verify that `LIVE NOW` and region badges show full aggregate totals while list bodies remain sampled/paginated.

## Prerequisites
- `.env.local` configured for Supabase.
- App running with `npm run dev`.

## Run
1. Open `/` dashboard.
2. Open devtools Network tab and inspect `/api/mock-auctions` response.
3. Confirm `aggregates.liveNow` and `aggregates.regionTotals` are present.
4. Toggle region tabs (US/EU/UK/JP) and verify `LIVE NOW` badge changes by region total, while visible cards stay sampled.
5. Open a make page (e.g. `/cars/porsche`) and verify region pill counts reflect full totals and `LIVE NOW` badge matches selected region total.

## Expected
- Dashboard live badge uses aggregate totals, not rendered card counts.
- Make page region pills use aggregate totals (full DB counts), not subset lengths.
- No giant listing payload introduced; list rendering remains limited.
