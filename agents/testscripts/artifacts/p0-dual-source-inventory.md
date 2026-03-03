# P0 Dual-Source Inventory

## ORM Runtime Touchpoints (active)

Source scan pattern: `@/lib/db/orm|@orm/client` in `src/**/*.{ts,tsx}`

Found 7 runtime references:

1. `src/app/api/auctions/route.ts` (import orm client)
2. `src/app/api/auctions/[id]/route.ts` (import orm client)
3. `src/lib/db/queries.ts` (import ORM client types)
4. `src/lib/db/orm.ts` (ORM client singleton)
5. `src/app/[locale]/history/page.tsx` (import orm client)
6. `src/app/api/scrape/route.ts` (import orm client)
7. `src/app/api/analyze/route.ts` (import orm client)

## Supabase Runtime Presence

Source scan patterns included `createClient(`, `createServerClient(`, `.from(`, `.rpc(`.

- Supabase usage is widespread across feature-local collectors and API routes (148 matches in scan, includes non-db false positives from `Array.from`).
- Confirmed Supabase-backed paths include:
  - `src/lib/supabaseLiveListings.ts`
  - `src/lib/supabase/server.ts`
  - `src/app/api/user/profile/route.ts`
  - `src/app/api/user/create/route.ts`
  - `src/features/*_collector/supabase_writer.ts`

## P0 Contract Freeze Notes

- Dual source of truth still present at runtime due legacy ORM references above.
- Unknown write paths at this stage: none newly discovered outside listed ORM endpoints, but legacy ORM remains active for critical routes.
- P0 strict pass/fail verdict: FAIL (build gate failure blocks safe advancement).
