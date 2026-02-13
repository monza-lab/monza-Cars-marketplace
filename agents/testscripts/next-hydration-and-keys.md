## Testscript: Next Hydration + React Keys

Objective: Verify app-router layouts hydrate without `<html>/<body>` mismatch and that curated list rendering no longer logs duplicate React key warnings for `curated-diablo-sv`.

Prerequisites:
- Node + npm installed
- Dependencies installed: `npm ci`

Steps:
1) Static build (catches app-router/layout errors)
   - Command: `npm run build`
   - Expected: build completes successfully; no layout/runtime errors.

2) Lint (optional guardrail)
   - Command: `npm run lint`
   - Expected: lint completes successfully.

3) Dev console check
   - Command: `npm run dev`
   - Visit a locale route (e.g. `/de`)
   - Expected: browser dev console does NOT show a hydration mismatch about nested `<html>`/`<body>`.
   - Expected: browser dev console does NOT show `Encountered two children with the same key` for `curated-diablo-sv`.

Artifacts:
- If failures occur, capture terminal output and browser console logs.
