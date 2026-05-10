# Decision · Mobile Search sheet redesign

**Fecha:** 2026-05-10
**Branch:** `mobile-first-v1`
**Estado:** Aprobado por Edgar — implementado

## Tesis

> "Que alguien se meta allí a buscar y encuentre todos los filtros desplegables abiertos. Que esa barra de búsqueda mobile sea absolutamente impecable y que la persona vea o encuentre todo muy fácil, con muy pocos clics."

Search no es un input minimalista; es **el centro de discovery con filtros visibles y data real**.

## Antes

Sheet con:
- Input + Cancel
- Empty state: 8 chips populares (taxonomy)
- Query state: matches taxonomy + cars

Limitaciones:
- Cero filtros visibles (todo a través del input)
- `searchCars` apuntaba a `CURATED_CARS` (vacío en producción local) → "0 listings"
- Sin recent searches a pesar de que `saveSearchQuery` ya existe
- Sin trending / curation editorial

## Ahora

Sheet full-screen (`100dvh`), scrollable, secciones siempre visibles:

```
[Q]  Search 992, GT3, Manual…              Cancel
─────────────────────────────────────────────────
RECENT
[992 GT3]  [Manual]  [Air-cooled]               ← solo si hay historial,
                                                  X para limpiar
─────────────────────────────────────────────────
MARKET                  ◉ All  ○ US  ○ UK  ○ EU  ○ JP
STATUS                  ◉ All  ○ Live  ○ Sold
PRICE                   [Any] [<$50K] [$50–150K] [$150–500K] [$500K+]
─────────────────────────────────────────────────
BROWSE BY FAMILY
[911 Family ▸]  [GT & Hypercars ▸]
[Mid-Engine ▸]  [Transaxle ▸]
[Heritage ▸]    [Gran Turismo ▸]
─────────────────────────────────────────────────
TRENDING THIS WEEK                              View all →
[img] 1996 993 Turbo · BaT · $385K
[img] 2022 992 GT3 RS · C&B · $310K
[img] 2008 997 GT2 · AS24 · $380K
```

## Comportamiento

### Empty state (sin query)
- Filtros visibles, ningún clic requerido para verlos.
- Recent searches solo si `getSearchHistory().length > 0` (chips, 1-tap re-ejecuta).
- Family chips → navegan a `/cars/porsche?family={firstSeriesId}`.
- Trending → fetch lazy de `/api/mock-auctions?limit=4` cuando el sheet se abre por primera vez.

### Aplicar filtro (Region/Status/Price)
- 1-tap segmented control.
- Si el usuario navega a resultados (search submit), los filtros se pasan como query params:
  `/search?q=992&region=EU&status=live&priceMax=150000`

### Query state (typing > 1 char)
- Filtros activos quedan como chips removibles arriba: `EU ✕`  `<$150K ✕`
- Resultados:
  - **Models & Series** — taxonomy matches (existente)
  - **Listings** — desde el feed real (no `CURATED_CARS`)
- `No results` empty state con CTA `Ask the advisor about this →` (funnel a Pistons)

### Submit (Enter)
- `saveSearchQuery(q)` para feeding Recent
- Navega a `/search?q={q}&{filtros}`

## Decisiones UX explícitas

| Decisión | Justificación |
|---|---|
| Filtros visibles (no detrás de "Filters" button) | Mandato del usuario: "todos los filtros desplegables abiertos". 0 clicks para ver, 1 click para aplicar. |
| Segmented control para Region/Status | Más rápido que Select dropdown (1 tap vs 2-3) |
| Price como chips, no slider | Mobile slider pierde precisión con dedos; chips son tap-and-go |
| Ningún Year filter en MVP | Y agrega altura sin alto valor — los buyers piensan en familia/generación, no en año aislado. Year va dentro de `/cars/porsche?family=…` |
| Trending pulla del feed real | Honest-by-data: si el feed está vacío, ocultar la sección |
| Recent searches con clear-all | Ya existe `clearSearchHistory()` |

## Tradeoffs

- Sheet pasa de ~300 px de altura a ~1100 px scrollable. Aceptable mobile (scroll natural).
- Trending requiere fetch al abrir el sheet la primera vez (~200-300 ms en dev). Cache en memoria para visitas posteriores en la misma sesión.
- Si el usuario abre el sheet con la intención solo de buscar texto, debe scrollear menos para llegar al input — input es sticky en `top: 0`, así que esto se resuelve solo.

## Touch targets

- Segmented controls: 36 px de alto cada celda
- Chips de price/family: 32 px alto, padding horizontal generoso
- Trending cards: 56 px alto (thumbnail 56×56)
- Cumple HIG (≥44 pt) para zona principal de interacción.

## Archivos tocados

- `src/components/mobile/MobileBottomNav.tsx` — `MobileSearchSheet` reescrito
- (Opcionalmente) `src/lib/searchHistory.ts` ya existe, sin cambios

## Pendiente backend (no tocado en este pase)

- `/search?q=...&region=...&status=...&priceMax=...` debe leer estos query params y aplicar filtros server-side. Si el endpoint actual no los soporta, los filtros se aplican client-side sobre el pool fetched.
- `Trending this week` actualmente se popula con los primeros listings del API. A futuro: agregar campo `trending: boolean` o cálculo (most-viewed/most-bid últimos 7 días).
