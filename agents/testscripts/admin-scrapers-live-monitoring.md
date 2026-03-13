# Testscript: Admin scrapers live monitoring

## Objective
Validate live refresh, active job visibility, stale detection, and graceful fallback on `/[locale]/admin/scrapers`.

## Prerequisites
- Admin user session for `caposk8@hotmail.com`.
- Supabase migration `20260304_scraper_active_runs.sql` applied.
- At least one cron route callable with `CRON_SECRET`.

## Setup
1. Start app: `npm run dev`
2. Open `/en/admin/scrapers` in a signed-in admin session.

## Run
1. Confirm header shows `Last updated` and `Live` badge.
2. Trigger one cron route (example):
   - `curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/porsche`
3. While request is in flight, confirm corresponding card shows `RUNNING` or `RUN STALLED` state.
4. After completion, confirm state returns to `OK`/`FAIL`, and history row updates without manual reload.
5. Simulate live endpoint failure (temporary auth/session loss) and confirm dashboard still renders with last known data + warning text.
6. Verify stale behavior by checking a scraper with no recent runs (>36h) shows `STALE` badge.

## Expected
- Auto-refresh occurs every ~20s without reload.
- Active runs appear while cron is running.
- Errors/stale conditions are visible in cards and issue count.
- No redirect/contract changes for existing admin page load.
