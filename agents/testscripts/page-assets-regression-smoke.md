# TS-PAGE-ASSETS-REGRESSION

- Objective: verify root/localized pages and static assets load after locale proxy rewrites.
- Prerequisites: `npm run build` completed.
- Run:
  1. `npm run start -- -p 3200`
  2. `curl -i http://127.0.0.1:3200/`
  3. `curl -i http://127.0.0.1:3200/es`
  4. Extract one `/_next/static/...` URL from `/` HTML and request it directly.
  5. Request the same asset with locale prefix: `/en/_next/static/...`.
  6. `curl -i "http://127.0.0.1:3200/api/mock-auctions?limit=2"`
  7. `curl -i "http://127.0.0.1:3200/api/auctions?limit=2"`
  8. `curl -i "http://127.0.0.1:3200/en/api/auctions?limit=2"`
- Expected:
  - `/` and `/{locale}` return 200 (or 307 redirect for `/en` due `as-needed` locale strategy).
  - Both direct and locale-prefixed static asset URLs return 200.
  - Auctions endpoints return JSON with non-404 status.
