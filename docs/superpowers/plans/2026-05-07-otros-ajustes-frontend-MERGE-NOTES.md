# Otros Ajustes Frontend — Merge Notes

**Branch:** `otros-ajustes-front-end`
**Base:** `main` (at SHA `7cfe702`).
**Implementation plan:** [`2026-05-07-otros-ajustes-frontend.md`](./2026-05-07-otros-ajustes-frontend.md)
**Status:** Ready to merge. Pushed to `origin/otros-ajustes-front-end`. PR not opened.

---

## TL;DR

`/browse` (Classic view) ya **no muestra señales de auction fabricadas** en cards de marketplaces no-auction (AutoScout24, BeForward, Elferspot, Classic.com, AutoTrader). Cero `if (platform === ...)` en el front — la decisión es honest-by-data: el componente lee `bidCount` y `endTime` y se silencia cuando no son creíbles.

**La data fabricada sigue en el backend** — este branch solo evita transmitirla. Hay un backend backlog al final.

**Recommended merge:** `Create a merge commit` o `Rebase and merge`. **NO squash** — preservar la separación entre fix (Task A) y test (Task B) para bisects futuros.

---

## Commits (en orden)

| # | SHA | Subject | Files |
|---|---|---|---|
| 1 | `c669e11` | docs(plans): add otros-ajustes-front-end implementation plan | 1 (plan doc) |
| 2 | `bd5d0e4` | fix(browse): card stops showing fabricated auction signals | 1 (`BrowseCard.tsx`) |
| 3 | `f0d9ad6` | test(browse): cover BrowseCard honest-by-data conditions | 1 (`BrowseCard.test.tsx` nuevo) |

**Total commits past `main`:** 3.

---

## Files touched

### New
- `docs/superpowers/plans/2026-05-07-otros-ajustes-frontend.md` — el plan con justificación detallada.
- `docs/superpowers/plans/2026-05-07-otros-ajustes-frontend-MERGE-NOTES.md` — este documento.
- `src/components/browse/BrowseCard.test.tsx` — 6 unit tests con jsdom.

### Modified
- `src/components/browse/BrowseCard.tsx` — quitado el badge `LIVE`, condicionado `Gavel + bidCount` a `bidCount > 0`, condicionado `Clock + countdown` a `(bidCount > 0) && (endTime > now)`. Removida la función helper `isLiveStatus` y la variable `live` ya muertas. ~13 líneas insertadas, ~17 eliminadas.

### Out of scope — explicitly NOT touched
- `src/lib/**` (especialmente `supabaseLiveListings.ts:561` donde `?? 0` coerce silenciosamente).
- `src/app/api/**`.
- `src/features/scrapers/**` — donde vive la fuente de la mentira (ver Backend Backlog abajo).
- `supabase/migrations/**`.
- Cualquier otra ruta del front (home, dashboard, makepage, reporte). Solo `/browse`.

---

## QA verificada antes del push

### Automated
- `npx vitest run src/components/browse src/app/[locale]/cars/[make]/[id]/report` → **43/43 pass** en 5 suites.
- `npx eslint src/components/browse/BrowseCard.tsx src/components/browse/BrowseCard.test.tsx` → 0 errors / 1 warning (en el test, sin impact).
- `npx tsc --noEmit` → 0 errores en archivos tocados; 63 errores pre-existentes en otros archivos del repo, idénticos al estado de `main`.
- `npm run build` → **Compiled successfully**.

### Manual (smoke con Chrome contra dev local)

Distribución observada después de scroll completo en `/browse`:

| Plataforma | Cards | Cards con martillo (Gavel) | Cards con countdown (Clock) |
|---|---|---|---|
| **BaT** (auction real) | 29 | **29 (100%)** | **29 (100%)** |
| **AS24** (marketplace, status hardcoded) | 6 | **0** | **0** |
| **Elferspot** (marketplace, bid_count omitido) | 20 | **0** | **0** |
| **BeForward** (marketplace, bid_count hardcoded) | 5 | **0** | **0** |
| **Total** | 60 | 29 | 29 |

Cero badges `LIVE` verdes en toda la página. Cero false positives.

---

## Backend Backlog (la deuda upstream que este branch documenta pero no resuelve)

El front ahora se silencia cuando ve datos sospechosos, pero la causa raíz vive en backend. Tareas para el equipo:

### Alta prioridad — `status` hardcoded `"active"`

| Archivo | Línea | Plataforma |
|---|---|---|
| `src/features/scrapers/autoscout24_collector/normalize.ts` | 80 | AutoScout24 |
| `src/features/scrapers/beforward_porsche_collector/normalize.ts` | 123 | BeForward |
| `src/features/scrapers/elferspot_collector/normalize.ts` | 47 | Elferspot |
| `src/features/scrapers/classic_collector/normalize.ts` | 166 | Classic.com |

Cada uno hardcodea `status: "active"`. Implementar verificación real al estilo `autotrader_collector/normalize.ts:144` + `refreshActiveListings()` (líneas 196-262), que sí chequea si la página fuente sigue viva. Sin esto, listings posiblemente vendidos hace meses siguen marcados como `ACTIVE` en la DB.

### Alta prioridad — `bid_count` hardcoded `0`

| Archivo | Línea | Plataforma |
|---|---|---|
| `src/features/scrapers/autotrader_collector/supabase_writer.ts` | 137 | AutoTrader |
| `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts` | 131 | BeForward |
| `src/features/scrapers/elferspot_collector/supabase_writer.ts` | 16-46 | Elferspot (omite la columna; DB default 0 aplica) |

Si la fuente no es de subasta y no hay bids, dejar `bid_count: null` (no `0`). Eso permite que la UI distinga "0 bids reales" de "no aplica". También aplica al schema: considerar cambiar `bid_count INTEGER DEFAULT 0` a `bid_count INTEGER DEFAULT NULL` en una migración nueva. Migración relevante: `supabase/migrations/20260215_align_listings_with_auction_model.sql:12`.

### Media prioridad — `?? 0` silencia signals en lib

`src/lib/supabaseLiveListings.ts:561` tiene:

```ts
const currentBid = row.current_bid ?? price;
```

Eso está OK (price fallback es legítimo). Pero **arriba**, en otros lugares de `rowToCollectorCar` y derivados, `bidCount` se transforma sin preservar `null`. Si el backend cambia los scrapers para emitir `bid_count: null`, el front no lo verá hasta que la lib deje pasar el null.

Una vez backend deje de hardcodear `0`, considerar:

```ts
// Antes:
const bidCount = row.bid_count ?? 0;
// Después:
const bidCount = row.bid_count;  // puede ser null
```

Y propagar `bidCount: number | null` en el type. Eso permite que el front distinga "0 reales" de "no aplica" sin las heurísticas actuales.

---

## How to merge

### Pre-merge
1. Pull, install, build:
   ```bash
   git fetch origin
   git checkout otros-ajustes-front-end
   npm install
   npm run build
   ```
2. Run tests:
   ```bash
   npx vitest run src/components/browse src/app/\[locale\]/cars/\[make\]/\[id\]/report
   ```
   Expected: 43/43 pass.
3. Optional visual smoke (`npm run dev`, abrir `/browse`): cards de BaT con martillo + countdown; cards AS24/BF/ES sin esos signals; ningún badge LIVE.

### Open the PR
```bash
gh pr create \
  --base main \
  --head otros-ajustes-front-end \
  --title "fix(browse): stop transmitting fabricated auction signals" \
  --body-file docs/superpowers/plans/2026-05-07-otros-ajustes-frontend-MERGE-NOTES.md
```

### Post-merge — verify in production

1. Visit `https://www.monzahaus.com/en/browse`.
2. Cards de plataformas auction (BaT, Cars and Bids, Collecting Cars) deben mostrar martillo + countdown si tienen bids reales.
3. Cards de plataformas marketplace (AS24, AT, BF, ES, Cls) deben mostrarse limpias: sin martillo, sin countdown, sin badge LIVE verde.
4. El "Price" se muestra honestamente en todas las cards (no $0).
5. Click sobre cualquier card → `/cars/{make}/{id}/report` (igual que antes).
6. Link "View on {platform}" en pestaña nueva (igual que antes).

---

## If something breaks

| Symptom | Likely cause | Mitigation |
|---|---|---|
| Una card de BaT muestra el martillo pero sin countdown | El scraper no extrajo `endTime`, o `endTime` está en el pasado | Confirmar en DB que `end_time` para esa row es `NOT NULL` y futuro. Si el listing ya cerró, esto es correcto. |
| TODAS las cards perdieron el martillo (incluso BaT) | El scraper de BaT está fallando en sourcear `bid_count` (regresión upstream) | Inspeccionar logs del scraper. `bid_count` debería poblarse desde la página de BaT. |
| El badge LIVE reaparece | Reversión accidental | El test `does NOT render the LIVE badge regardless of status` debería atraparlo en CI. Revisar diff. |
| Test de jsdom falla con "document is not defined" | El docblock `// @vitest-environment jsdom` se perdió en el reformat | Restaurar la primera línea del test file. |

---

## Decisión clave preservada para futuros refactors

> **Honest-by-data, no platform allowlists.** El componente nunca pregunta "¿es BaT?". Pregunta "¿hay bidCount > 0?". Si mañana el backend arregla AS24 y emite `bid_count` real, el martillo aparece automáticamente para esos listings sin tocar el front. Si BaT regresiona y deja de emitir bids, el martillo desaparece — síntoma honesto, no oculto.

Este principio se debe respetar en futuros ajustes a la card. Cualquier cambio que introduzca un check `if (platform === "X")` en `BrowseCard.tsx` debe ser justificado y, idealmente, refactoreado a un check de data-value.

---

*End of merge notes.*
