# TS-API-ROUTE-NORMALIZATION-AUCTIONS-LOAD

## Objective
Verify locale-prefixed API requests are normalized to `/api/*` and homepage auction load handles non-200 responses without JSON parse crashes.

## Prerequisites
- Dependencies installed (`npm install`)
- Dev server can run on port 3000

## Run
1. `npm run build`
2. `npm run dev`
3. `npm run verify:api-routes`
4. Open `http://localhost:3000/es`
5. In browser DevTools console, run:
   - `fetch('/es/api/user/profile').then(r => r.status)`
   - `fetch('/es/api/user/create', { method: 'POST' }).then(r => r.status)`

## Expected
- Locale-prefixed API paths no longer return framework 404 pages.
- `/api/user/create` and `/es/api/user/create` return auth-gated status (`401`) instead of `404`.
- No `Unexpected token '<'` JSON parse errors are logged by homepage auction bootstrap code.
- Home route renders loading state then content or empty state cleanly.

## Artifacts
- Browser network entries for `/es/api/user/profile` and `/es/api/user/create`
- Browser console output for homepage load on `/es`
