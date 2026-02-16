# Login System — Debugging Overview

## Problem Statement
Google OAuth and email login both fail after deployment. Multiple issues were discovered and fixed incrementally.

---

## Issue 1: Concurrent `/api/user/create` calls (Local)

**Symptom**: `SIGNED_IN` event fires multiple times (session restore, token refresh, component remount), flooding `/api/user/create` with concurrent POSTs and causing Prisma P2002 unique constraint errors.

**Root Cause**: `AuthProvider.tsx` had no guard against duplicate calls in the `onAuthStateChange` handler.

**Fix** (`src/lib/auth/AuthProvider.tsx`):
- Added `useRef(false)` debounce guard — only the first `SIGNED_IN` fires the create call; subsequent events are skipped while the first is in-flight.
- `fetchProfile` now returns `boolean` so callers know if the server accepted or rejected.
- `SIGNED_IN` handler checks `res.ok` before calling `fetchProfile`.

---

## Issue 2: Incomplete P2002 (unique constraint) handling (Local)

**Symptom**: The `User` model has TWO unique constraints (`supabaseId` AND `email`). When a race condition triggered a P2002 on the `email` column, the catch block only retried `findUnique` by `supabaseId` — missing the user and rethrowing.

**Root Cause**: `getOrCreateUser` in `src/lib/credits/index.ts` only handled one unique constraint.

**Fix** (`src/lib/credits/index.ts`):
- Before creating, also look up by `email` (handles identity linking — e.g., user signs up with email, then logs in with Google using the same email).
- If found by email with a different `supabaseId`, update the `supabaseId` to the new one.
- On P2002 catch, retry lookup by **both** `supabaseId` and `email` (using `??` fallback).

---

## Issue 3: All API routes return 401 Unauthorized (Local)

**Symptom**: After signing in with Google, every call to `/api/user/create` and `/api/user/profile` returned 401. The server-side `supabase.auth.getUser()` couldn't find a valid session.

**Root Cause**: The middleware (`src/proxy.ts`) excluded ALL `/api/*` routes from its matcher:
```
'/((?!api|auth/callback|auth/confirm|...).*)'
```
This meant the Supabase session refresh (`getUser()`) in middleware never ran for API routes. Without this refresh, expired or newly-set auth tokens couldn't be validated server-side.

**Fix** (`src/proxy.ts`):
- Removed `api` from the matcher exclusion — middleware now runs for API routes.
- Added `pathname.startsWith('/api/')` check to skip intl (locale) routing for API routes (they don't need `/de/` prefixes), while still running the Supabase auth refresh.
- Updated matcher:
  ```
  '/((?!auth/callback|auth/confirm|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'
  ```

---

## Issue 4: Stale session flood after deleting users (Local)

**Symptom**: After deleting all users from Supabase `auth.users`, the browser still had cached session cookies. Every page load fired `SIGNED_IN` with stale tokens, causing a flood of 401 errors that never stopped.

**Root Cause**: `AuthProvider.tsx` never checked if the server actually accepted the session. It trusted `getSession()` (which reads from local cookies without server verification).

**Fix** (`src/lib/auth/AuthProvider.tsx`):
- In `initAuth`, if `fetchProfile` returns `false` (server rejected), call `supabase.auth.signOut()` to clear the stale local session.
- This breaks the 401 flood loop — one failed attempt clears the bad state.

---

## Issue 5: Prisma can't reach database on Vercel (Production)

**Symptom**: After deploying to Vercel, all Prisma queries fail with:
```
PrismaClientKnownRequestError: Can't reach database server at db.xgtlnyemulgdebyweqlf.supabase.co
Error code: P1001
```

**Root Cause**: The `DATABASE_URL` used a **direct connection** (`db.*.supabase.co:5432`). Vercel serverless functions cannot reach Supabase's direct database host due to network/IPv4 restrictions. Supabase requires using their **connection pooler** (Supavisor) for serverless environments.

**Fix**:
1. Updated `prisma/schema.prisma` to support both pooled and direct URLs:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```
2. Two environment variables needed in Vercel:

   | Variable | Purpose | Format |
   |---|---|---|
   | `DATABASE_URL` | Pooled connection (for queries at runtime) | `postgresql://postgres.xgtlnyemulgdebyweqlf:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` |
   | `DIRECT_URL` | Direct connection (for migrations only) | `postgresql://postgres:[PASSWORD]@db.xgtlnyemulgdebyweqlf.supabase.co:5432/postgres` |

   **Key differences between the two URLs:**
   - Pooler host: `aws-0-[region].pooler.supabase.com` (NOT `db.*.supabase.co`)
   - Pooler port: `6543` (NOT `5432`)
   - Pooler username: `postgres.xgtlnyemulgdebyweqlf` (NOT just `postgres`)
   - Pooler requires `?pgbouncer=true` suffix

**Status**: PENDING — correct pooler URL from Supabase dashboard (Connect → Method → "Transaction pooler") still needs to be set in Vercel. Previous attempts used the wrong hostname (`db.*.supabase.co` with port 6543 instead of the pooler hostname).

---

## How to find the correct pooler URL

1. Go to **Supabase Dashboard** → your project
2. Click **"Connect"** button (top navigation bar)
3. Tab: **Connection String**, Type: **URI**
4. Change Method dropdown from "Direct connection" to **"Transaction pooler"**
5. Copy the URI — replace `[YOUR-PASSWORD]` with your actual database password
6. Append `?pgbouncer=true` to the end
7. Paste as `DATABASE_URL` in Vercel

---

## Files Modified

| File | Changes |
|---|---|
| `src/lib/auth/AuthProvider.tsx` | `useRef` debounce, `fetchProfile` returns boolean, stale session cleanup, check `res.ok` |
| `src/lib/credits/index.ts` | Dual unique-constraint lookup (supabaseId + email), identity linking, improved P2002 catch |
| `src/proxy.ts` | Middleware matcher includes API routes, skips intl for API routes |
| `prisma/schema.prisma` | Added `url` + `directUrl` to datasource for pooler support |

## Vercel Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only admin key |
| `DATABASE_URL` | Yes | **Must be pooler URL** for Vercel |
| `DIRECT_URL` | Yes | Direct connection for Prisma migrations |
| `NEXT_PUBLIC_BASE_URL` | Yes | Set to Vercel domain (e.g. `https://monza-cars-marketplace-pzpy.vercel.app`) |
| `CRON_SECRET` | Recommended | Protects cron/scrape/enrich endpoints |
| `ANTHROPIC_API_KEY` | Optional | For AI analysis features |
