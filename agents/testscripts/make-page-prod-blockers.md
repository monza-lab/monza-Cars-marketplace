# TS-MAKE-PROD-BLOCKERS

## Objective
Validate fixes for make-page hydration consistency, locale-prefixed API rewrites, live listing query stability, and listing image fallback behavior.

## Prerequisites
- `.env.local` is present with Supabase credentials.
- Dependencies installed (`npm install`).

## Run
1. `npm run dev`
2. Open `/de/cars/porsche` and confirm no hydration mismatch warning in browser console.
3. In browser network tab, trigger auth profile fetch and verify requests resolve through `/api/user/profile` and `/api/user/create` (no 404 on `/de/api/*`).
4. Load `/de/cars/porsche` and verify server logs do not show repeated `AbortError` for `[supabaseLiveListings]` during normal page load.
5. Open listing `live-6f8f9563-997c-4b37-b58c-b084c868ec91` and verify an image renders (source image or model fallback, not broken image).

## Expected
- No server/client number-format hydration mismatch.
- Locale-prefixed API paths are rewritten to root API routes successfully.
- Live listings fetches complete without timeout-abort loops.
- Listings missing scraped photos render a deterministic fallback model image.
