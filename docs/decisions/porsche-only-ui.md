# Decision · UI Porsche-only

**Fecha:** 2026-05-10
**Branch:** `mobile-first-v1`
**Estado:** Aprobado por Edgar — implementado

## Tesis

MonzaHaus es Porsche-only por doctrina de producto (skill `monzahaus-growth`: *"No expandir a otras marcas 'porque hay demanda'. Porsche-only es doctrina. La tentación va a venir; resistila"*).

Hasta hoy la UI dejaba "leakar" otras marcas en filtros y editorial copy, lo que confundía al usuario: parecía que la app cubría Ferrari/Lambo/etc. Cuando Edgar buscó `ferrari` en el search mobile, esperaba cero resultados y se encontraba con un dropdown de "All Makes" que insinuaba lo contrario.

## Cambios

### Search mobile (`MobileSearchSheet`)

- `fetch("/api/mock-auctions?limit=6&make=Porsche")` — explicit make param.
- `data.auctions.filter(c => c.make === "Porsche")` — defense-in-depth client-side.
- Resultado: trending y listing matches solo Porsche, siempre.

### Search page (`/search` — SearchClient.tsx)

- `MAKE_VALUES` reducido de 24 marcas a `["Porsche"]`.
- Make chip dropdown **eliminado** del UI — un dropdown con una sola opción es ruido.
- `selectedMake` siempre inicializa a `"Porsche"` (en vez de `ALL`). Reset también va a `"Porsche"`.

### Auctions page (`/auctions` — AuctionsClient.tsx)

- `POPULAR_MAKES` reducido de 16 marcas a `["", "Porsche"]`.

### Dashboard editorial copy (`DashboardClient.tsx`)

- `mockWhyBuy` Record: 16 keys con copy de Ferrari/Lambo/BMW/etc → solo `Porsche` + `default`.
- Las otras keys eran **dead code** (la home solo renderiza Porsche), pero limpiarlas elimina la posibilidad de que alguien copie el patrón.

### Bottom nav cleanup (`MobileBottomNav.tsx`)

- `MobileExploreSheet` (que mostraba grid de brands) eliminado por completo — ya estaba reemplazado por el Advisor en bottom nav, pero quedaba como dead code.
- Helper `getMakesWithCounts` filtra `make === "Porsche"` (antes `!== "Ferrari"` permitía todo lo demás). Mantenido por compat con `BrandCard` aunque actualmente sin caller.

## Lo que NO se tocó (intencional)

| Archivo | Razón |
|---|---|
| `src/app/[locale]/ferrari/page.tsx` | Página interna de data ingestion (Supabase admin). No accesible desde navigation pública. |
| `src/app/[locale]/admin/scrapers/*` | Admin internal. Maneja scrapers de varias marcas porque es el workbench de data, no UX user-facing. |
| `src/lib/curatedCars.ts` | Estructura legacy con type definition. La constante `CURATED_CARS = []` ya está vacía. |
| `src/lib/advisor/tools/marketplace.ts` | Backend tools (no front). El advisor queries van con `make=Porsche` cuando aplica desde el contexto. |
| `src/lib/makePageConstants.ts` (`brandThesis`, `brandStrategy`, `ownershipCosts`) | Editorial copy multi-marca usado por `getOwnershipCosts` desde `/cars/[make]`. La página solo se renderiza con `make=porsche` en navigation pública pero deja el sistema extensible si en algún momento la doctrina cambia. |

Si la doctrina Porsche-only se relaja en el futuro, restaurar las marcas extra es agregar entries — la infra ya soporta multi-make.

## Validación

Antes:
```
Buscando "ferrari" en search mobile →
  Listings: [resultados Ferrari del trending]
  No results for "ferrari" (a veces, dependiendo del feed)
```

Después:
```
Buscando "ferrari" en search mobile →
  No results for "ferrari"
  "The advisor can pull deeper context."
  [💬 Ask the advisor →]
```

El "ferrari" sigue apareciendo en `Recent searches` si Edgar lo escribió antes (es state local del usuario, no UI hardcoded). Eso es honest: el usuario tipeó esa query, el sistema la guardó. Si quiere, puede usar el `🗑 Clear` que ya tiene el componente.

## Archivos tocados

- `src/components/mobile/MobileBottomNav.tsx`
- `src/app/[locale]/search/SearchClient.tsx`
- `src/app/[locale]/auctions/AuctionsClient.tsx`
- `src/components/dashboard/DashboardClient.tsx`
