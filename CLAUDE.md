# CLAUDE.md — Monza Cars Marketplace

## Project Overview
Collector car marketplace focused on Porsche (extensible to Ferrari, BMW, etc.).
Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Supabase.

## Architecture

### Layout: 3-Column Desktop
- **Column A** (left): Sidebar — family navigation, filters, discovery
- **Column B** (center): Main feed — car listings, family cards, auction cards
- **Column C** (right): Context panel — market intelligence, thesis, stats

### Taxonomy: Elferspot-style (flat series)
Series are **top-level categories**, NOT nested under model lines:
- `992`, `991`, `997`, `996`, `993`, `964`, `930` (not "911 → generations")
- `718-cayman`, `718-boxster`, `cayenne`, `macan`, `panamera`, `taycan`
- Each series = a generation. No sub-generations layer.

### Navigation Flow
```
Dashboard (families) → click "992" → MakePage?family=992 (cars view)
                                      viewMode = 'cars' (skip 'generations')
                                      Back button → router.push("/")
```

### Key File: `src/lib/brandConfig.ts`
Central registry — **single source of truth** for all brand/series data.
- 27 Porsche series, 6 family groups
- `extractSeries(model, year, make)` — intelligent series extraction
- `getSeriesConfig(seriesId, make)` — label, order, year range, family group
- `getSeriesThesis(seriesId, make)` — investment thesis text
- `getFamilyGroupsWithSeries(make)` — grouped series for UI
- **Never hardcode** series names, display labels, or sort order in components

## Conventions

### Code Rules
- Use `brandConfig.ts` functions instead of hardcoded constants
- Use `extractSeries()` instead of `model.split()` for series extraction
- All component data flows through brandConfig helpers
- Frontend-only changes — don't modify API routes or DB schema without discussion

### Stack
- `npm run dev` starts the dev server (uses `--webpack` flag)
- Legacy ORM for DB schema, Supabase for data
- i18n via next-intl (locale in URL: `/en/cars/porsche`)
- Middleware handles locale redirects (307 responses are normal)

### Git
- Branch: `UI-UX-5.0` for frontend work
- Commit style: `feat(scope): description` / `fix(scope): description`
- Always push after committing to avoid object corruption

## Roadmap

### Completed
- [x] Phase 1A: `brandConfig.ts` — centralized brand registry
- [x] Phase 1B: Connect DashboardClient + MakePageClient to brandConfig
- [x] Phase 4-5: Column C consistency, bid filtering, currency polish, Fuchs spinner

### Next
- [ ] Phase 2: Advanced filters (Body Type, Transmission, Sort)
- [ ] Phase 3: Variant chips within series (GT3, Turbo, Carrera, GTS, etc.)

## Known Issues
- `node_modules` corruption: if `npm install` fails with ENOTEMPTY, rename `node_modules` out of project dir and reinstall fresh
- Webpack compilation hangs: check for large untracked directories in project root (e.g. `node_modules_old`) — webpack/watchpack scans everything
- Always `rm -rf .next` after git or npm issues before restarting dev server
- Port 3000 conflicts: `lsof -ti:3000 | xargs kill -9` before starting

## Communication
- User communicates in Spanish
- Keep explanations clear and structured
- Use tables and bullet points for status updates
