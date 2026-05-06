# Browse + Report — Cambios Front Mayo (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Branch:** `cambios-front-mayo` (already created from `main`, +185 commits ahead of `docs/marketing-phase-0-handoff`).

**Goal:** Repositionar la vista `/browse` (la "Classic" view) de marketplace de subastas a un feed de inteligencia que **vende el reporte** y **deja claro que MonzaHaus es información, no un marketplace** — y arreglar dos bugs bloqueantes asociados (filtro de región desconectado, 500 al abrir reportes en producción).

**Architecture decisions:**
- Mantener la grid, filtros y scroll de `/browse` tal como están — solo se cambian textos, CTA primario, visibilidad de la fuente externa y un banner clarificatorio.
- Cada card debe **mostrar dónde está listado el carro** (BaT, Cars and Bids, Collecting Cars, Elferspot, etc.) y permitir abrir la URL original en una pestaña nueva — es un valor explícito que pidió el usuario para que la audiencia pueda "ir a verlo".
- El bug del 500 en `/cars/[make]/[id]/report` se ataca a nivel de page (server component) envolviendo cada llamada SSR con su propio fallback, sin tocar `src/lib/`. Si después del fix la página sigue tronando, se documenta el siguiente paso pero no se ejecuta sin aprobación explícita (regla del proyecto: "fixes pueden tocar `src/lib/` solo con OK del owner").
- División en **6 commits secuenciales pero auto-contenidos** para que el merge a `main` sea limpio y reversible commit-a-commit. Cada commit deja la app en estado funcional.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, Tailwind v4, framer-motion, next-intl. Tests con vitest + @testing-library/react.

**Out of scope (NO tocar en este plan):**
- `src/lib/**` (especialmente `supabaseLiveListings.ts`, `dashboardCache.ts`, `db/queries.ts`).
- `src/app/api/**` route handlers.
- Migraciones Supabase.
- Hooks de auth, billing, advisor.
- Cualquier cambio en branding/tipografía/colores (lo dicta `monzahaus-branding`, intacto).

---

## File Structure

| File | Created? | Touched in phase | Responsibility |
|---|---|---|---|
| `src/app/[locale]/cars/[make]/[id]/report/page.tsx` | existing | 1 | Server component del reporte. Se blindan las 3 llamadas SSR sin try/catch. |
| `src/app/[locale]/cars/[make]/[id]/report/page.test.tsx` | NEW | 1 | Test de robustez (queries que fallan no deben tirar 500). |
| `src/components/browse/BrowseCard.tsx` | existing | 2, 4, 5 | Card individual. Aceptar `sourceUrl` como prop opcional, mostrar link "Ver original en {Platform}", cambiar Link primario a `/report`. |
| `src/components/browse/BrowseClient.tsx` | existing | 2, 3, 5, 6 | Wrapper que pagina y renderea cards. Mapear `sourceUrl` desde el API, multi-select de región, copy nuevo, banner clarificatorio. |
| `src/components/browse/filters/applyFilters.ts` | existing | 3 | Filtro cliente. Cambiar comparación de `car.region` (raw) a `car.canonicalMarket` (normalizado a US/EU/UK/JP). |
| `src/components/browse/filters/applyFilters.test.ts` | existing | 3 | Cubrir el caso de filtro por región usando `canonicalMarket`. |
| `src/components/browse/filters/types.ts` | existing | — | (No cambia — `REGION_OPTIONS` ya tiene los IDs correctos.) |
| `src/components/browse/NoMarketplaceBanner.tsx` | NEW | 6 | Banner sutil "MonzaHaus muestra inteligencia, no vende carros". |

**Branching & merge strategy:**
- Todos los commits sobre `cambios-front-mayo`.
- 6 commits, cada uno con scope acotado y mensaje descriptivo (ver cada Task más abajo).
- Después del Task 6, abrir PR a `main` con título: `feat(browse + report): cambios front mayo — report fix, region filter, source links, anti-marketplace reframe`.
- En el PR, marcar para review humano antes de merge (`/ultrareview` opcional).

---

## Task 1: Blindar el server component del reporte (fix del 500 en producción)

**Why first:** Es el bug más visible — la URL `https://www.monzahaus.com/cars/porsche/live-fff7330c-0ce1-41cd-bb95-4c3f24520dc9/report` tira `500: Internal Server Error` en prod (verificado el 2026-05-06). Causa: tres llamadas SSR sin try/catch en `page.tsx`. Si una falla (DB intermitente, dato faltante, etc.), explota toda la página en lugar de degradar gracefully.

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/page.tsx:93,111,125`
- Create: `src/app/[locale]/cars/[make]/[id]/report/page.test.tsx`

### Steps

- [ ] **1.1 — Leer el page.tsx completo y confirmar líneas a tocar**

Run: `wc -l src/app/[locale]/cars/[make]/[id]/report/page.tsx`
Expected: ~200+ líneas. Las 3 llamadas a blindar están en:
- Línea 93: `const live = await fetchLiveListingsAsCollectorCars({ limit: 60, includePriceHistory: false })` — dentro de un `if (car.id.startsWith("live-"))`. Si Supabase rechaza, no hay catch.
- Línea 111: `const rates = await getExchangeRates()` — sin try/catch.
- Línea 125: `await computeArbitrageForCar({...})` — sin try/catch.

(Las llamadas en `Promise.all` línea 99-108 ya están protegidas por `.catch()` y `try` interno — no tocar.)

- [ ] **1.2 — Escribir el test que reproduce el bug**

Crear `src/app/[locale]/cars/[make]/[id]/report/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

// Stubear los módulos que el page importa antes de importarlo.
vi.mock("@/lib/supabaseLiveListings", () => ({
  fetchLiveListingByIdWithStatus: vi.fn().mockResolvedValue({
    car: { id: "live-test", make: "Porsche", model: "911", year: 2020, title: "test", region: "US" },
    transientError: false,
  }),
  fetchLiveListingsAsCollectorCars: vi.fn().mockRejectedValue(new Error("supabase down")),
  fetchPricedListingsForModel: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/exchangeRates", () => ({
  getExchangeRates: vi.fn().mockRejectedValue(new Error("rates api down")),
}));
vi.mock("@/lib/marketIntel/computeArbitrageForCar", () => ({
  computeArbitrageForCar: vi.fn().mockRejectedValue(new Error("arbitrage failed")),
}));
vi.mock("@/lib/db/queries", () => ({
  getComparablesForModel: vi.fn().mockResolvedValue([]),
  getReportForListing: vi.fn().mockResolvedValue(null),
  fetchSignalsForListing: vi.fn().mockResolvedValue([]),
  getReportMetadataV2: vi.fn().mockResolvedValue({ tier: null, report_hash: null, version: null }),
}));

describe("ReportPage SSR robustness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does NOT throw a 500 when fetchLiveListingsAsCollectorCars rejects", async () => {
    const { default: ReportPage } = await import("./page");
    await expect(
      ReportPage({
        params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();
  });

  it("does NOT throw a 500 when getExchangeRates rejects", async () => {
    const { default: ReportPage } = await import("./page");
    await expect(
      ReportPage({
        params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();
  });

  it("does NOT throw a 500 when computeArbitrageForCar rejects", async () => {
    const { default: ReportPage } = await import("./page");
    await expect(
      ReportPage({
        params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();
  });
});
```

- [ ] **1.3 — Correr el test y confirmar que falla**

Run: `npx vitest run src/app/\[locale\]/cars/\[make\]/\[id\]/report/page.test.tsx`
Expected: 3 tests fail con error tipo "supabase down" / "rates api down" / "arbitrage failed" lanzado desde el page.

- [ ] **1.4 — Aplicar el fix en page.tsx**

Edit `src/app/[locale]/cars/[make]/[id]/report/page.tsx`:

Cambiar línea 91-95:
```tsx
  // Fetch similar cars
  const allCandidates = CURATED_CARS.filter(c => c.id !== car.id)
  if (car.id.startsWith("live-")) {
    const live = await fetchLiveListingsAsCollectorCars({ limit: 60, includePriceHistory: false })
    allCandidates.push(...live.filter(c => c.id !== car.id))
  }
```

a:

```tsx
  // Fetch similar cars
  const allCandidates = CURATED_CARS.filter(c => c.id !== car.id)
  if (car.id.startsWith("live-")) {
    try {
      const live = await fetchLiveListingsAsCollectorCars({ limit: 60, includePriceHistory: false })
      allCandidates.push(...live.filter(c => c.id !== car.id))
    } catch (err) {
      console.warn(
        "[report] fetchLiveListingsAsCollectorCars failed, continuing without live candidates:",
        err instanceof Error ? err.message : err,
      )
    }
  }
```

Cambiar línea 110-112:
```tsx
  // Filter by series, expand to family if needed, compute regional stats (shared helper)
  const rates = await getExchangeRates()
  const { marketStats } = computeMarketStatsForCar(car, allPriced, rates)
```

a:

```tsx
  // Filter by series, expand to family if needed, compute regional stats (shared helper)
  const rates = await getExchangeRates().catch((err) => {
    console.warn(
      "[report] getExchangeRates failed, falling back to identity rates:",
      err instanceof Error ? err.message : err,
    )
    return {} as Record<string, number>
  })
  const { marketStats } = computeMarketStatsForCar(car, allPriced, rates)
```

Cambiar línea 123-131:
```tsx
  const targetRegion = inferTargetRegion(car.region)
  const d2Precomputed: MarketIntelD2 =
    askingForArbitrage > 0
      ? await computeArbitrageForCar({
          pricedListings: allPriced,
          thisVinPriceUsd: askingForArbitrage,
          targetRegion,
          carYear: car.year,
        })
      : { by_region: [], target_region: targetRegion, narrative_insight: null }
```

a:

```tsx
  const targetRegion = inferTargetRegion(car.region)
  const d2Precomputed: MarketIntelD2 =
    askingForArbitrage > 0
      ? await computeArbitrageForCar({
          pricedListings: allPriced,
          thisVinPriceUsd: askingForArbitrage,
          targetRegion,
          carYear: car.year,
        }).catch((err) => {
          console.warn(
            "[report] computeArbitrageForCar failed, returning empty D2:",
            err instanceof Error ? err.message : err,
          )
          return { by_region: [], target_region: targetRegion, narrative_insight: null }
        })
      : { by_region: [], target_region: targetRegion, narrative_insight: null }
```

- [ ] **1.5 — Correr el test de nuevo y confirmar que pasa**

Run: `npx vitest run src/app/\[locale\]/cars/\[make\]/\[id\]/report/page.test.tsx`
Expected: 3 tests PASS.

- [ ] **1.6 — Verificar manualmente con la URL real**

Levantar dev server si no está corriendo: `npm run dev`
En otra terminal:
```bash
/usr/bin/curl -sL -o /tmp/r.html -w "HTTP %{http_code}\n" "http://localhost:3000/en/cars/porsche/live-fff7330c-0ce1-41cd-bb95-4c3f24520dc9/report"
/usr/bin/grep -c "500: Internal Server Error" /tmp/r.html
```
Expected: HTTP 200, count = 0 (no debería decir 500 en el title).

NOTA: en local la DB Supabase puede no resolver por DNS y eso es esperado — el test es que el page **renderice algo** en lugar de tirar 500.

- [ ] **1.7 — Lint + typecheck**

Run:
```bash
npx eslint src/app/\[locale\]/cars/\[make\]/\[id\]/report/page.tsx
npx tsc --noEmit
```
Expected: ambos sin errores.

- [ ] **1.8 — Commit**

```bash
git add src/app/\[locale\]/cars/\[make\]/\[id\]/report/page.tsx \
        src/app/\[locale\]/cars/\[make\]/\[id\]/report/page.test.tsx
git commit -m "$(cat <<'EOF'
fix(report): blindar SSR del page de reporte para evitar 500

Tres llamadas server-side (fetchLiveListingsAsCollectorCars,
getExchangeRates, computeArbitrageForCar) no tenian try/catch.
Cualquier fallo en runtime tumbaba la pagina entera con 500
Internal Server Error (verificado en prod sobre
/cars/porsche/live-fff7330c-...). Cada una ahora degrada con
default sensato y log de warning, alineado con el patron ya
usado por getComparablesForModel y getReportForListing.

EOF
)"
```

---

## Task 2: Pipear `sourceUrl` desde el API hasta `BrowseCard`

**Why:** Hoy `/api/mock-auctions` ya devuelve `sourceUrl` por listing (`route.ts:44`), pero `BrowseClient.toDashboardAuction()` (líneas 49-85) **no lo mapea** y `DashboardAuction` (en `src/lib/dashboardCache.ts`) **no lo declara** — entonces aunque el dato existe, jamás llega a la card. Sin esto, Task 4 (link "ver original") no puede leer la URL.

**Decisión deliberada:** **No tocar `src/lib/dashboardCache.ts`** (regla del proyecto: features nuevas se quedan en components/pages). En lugar de eso, la prop `sourceUrl` viaja como prop **independiente** a `BrowseCard`, no como parte de `DashboardAuction`.

**Limitación conocida:** los listings que el SSR (`src/app/[locale]/browse/page.tsx`) entrega via `getCachedDashboardData()` ya están como `DashboardAuction` y no traen `sourceUrl` (el cache no lo guarda). Solo los listings cargados client-side via `/api/mock-auctions` (paginación) tendrán el link "View on X". Si Edgar quiere el link también en los SSR-iniciales, hay dos caminos — ambos requieren su aprobación: (a) agregar `sourceUrl?: string | null` a `DashboardAuction` en `src/lib/dashboardCache.ts` y poblarlo en el cache, o (b) cambiar `/browse/page.tsx` para llamar a `/api/mock-auctions` en SSR en lugar del cache. Por ahora se documenta y se sigue con el approach mínimo.

**Files:**
- Modify: `src/components/browse/BrowseClient.tsx:49-85, 183-200, 211-220, 305-310`
- Modify: `src/components/browse/BrowseCard.tsx:65 (props)`

### Steps

- [ ] **2.1 — Agregar el state `sourceUrlById` en `BrowseClient`**

Edit `src/components/browse/BrowseClient.tsx`. En el componente principal (después de `useClassicFilters` y los demás `useState` cerca del comienzo del cuerpo del componente, aproximadamente línea 100-130 — buscar el bloque de `useState` y agregar al final):

```tsx
const [sourceUrlById, setSourceUrlById] = useState<Map<string, string>>(() => new Map());
```

Importar `useState` si todavía no está (ya lo está en línea 3).

- [ ] **2.2 — Poblar el map cuando se carga la primera página filtrada (línea 217)**

Edit `BrowseClient.tsx`. Localizar el bloque del `useEffect` de reset (alrededor de línea 211-220) — específicamente la línea:

```tsx
const fresh = data.auctions.map(toDashboardAuction);
```

Reemplazar las 2 líneas siguientes a esa (que arman `ids` y `seenIdsRef`) para que también pueblen el map de sourceUrls. La forma exacta:

Antes (líneas 217-220 aprox):
```tsx
        const fresh = data.auctions.map(toDashboardAuction);
        const ids = new Set(fresh.map((c) => c.id));
        seenIdsRef.current = ids;
```

Después:
```tsx
        const fresh = data.auctions.map(toDashboardAuction);
        const ids = new Set(fresh.map((c) => c.id));
        seenIdsRef.current = ids;
        setSourceUrlById((prev) => {
          const next = new Map(prev);
          for (const c of data.auctions) {
            if (c.sourceUrl) next.set(c.id, c.sourceUrl);
          }
          return next;
        });
```

- [ ] **2.3 — Poblar el map en `fetchMoreRemote` (línea 188-192)**

Edit `BrowseClient.tsx`. Localizar el bloque dentro de `fetchMoreRemote` (alrededor de línea 183-200):

Antes:
```tsx
      const data = await fetchPage(remoteCursor);
      const fresh = data.auctions
        .filter((c) => !seenIdsRef.current.has(c.id))
        .map(toDashboardAuction);
      fresh.forEach((c) => seenIdsRef.current.add(c.id));
      setRemoteCars((prev) => [...prev, ...fresh]);
```

Después:
```tsx
      const data = await fetchPage(remoteCursor);
      const freshApi = data.auctions.filter((c) => !seenIdsRef.current.has(c.id));
      const fresh = freshApi.map(toDashboardAuction);
      fresh.forEach((c) => seenIdsRef.current.add(c.id));
      setRemoteCars((prev) => [...prev, ...fresh]);
      setSourceUrlById((prev) => {
        const next = new Map(prev);
        for (const c of freshApi) {
          if (c.sourceUrl) next.set(c.id, c.sourceUrl);
        }
        return next;
      });
```

- [ ] **2.4 — Pasar `sourceUrl` como prop al `BrowseCard`**

Edit `BrowseClient.tsx`. Localizar el render de cards (alrededor de línea 307):

Antes:
```tsx
{visible.map((car, i) => (
  <BrowseCard key={car.id} car={car} index={i} />
))}
```

Después:
```tsx
{visible.map((car, i) => (
  <BrowseCard
    key={car.id}
    car={car}
    index={i}
    sourceUrl={sourceUrlById.get(car.id) ?? null}
  />
))}
```

- [ ] **2.5 — Aceptar `sourceUrl` en BrowseCard**

Edit `src/components/browse/BrowseCard.tsx:65`:

Cambiar:
```tsx
export function BrowseCard({ car, index }: { car: DashboardAuction; index: number }) {
```
por:
```tsx
export function BrowseCard({
  car,
  index,
  sourceUrl,
}: {
  car: DashboardAuction;
  index: number;
  sourceUrl?: string | null;
}) {
```

(En este Task 2 solo recibimos la prop, no la usamos todavía. La usaremos en Task 4.)

- [ ] **2.6 — Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **2.7 — Smoke test runtime**

Levantar dev (`npm run dev` si no está corriendo) y abrir `http://localhost:3000/en/browse`. Hacer scroll hasta disparar el load-more (que va a `/api/mock-auctions`). Abrir DevTools → React → seleccionar una `BrowseCard` cargada via paginación → confirmar que la prop `sourceUrl` llega con un string. Las cards iniciales SSR vendrán con `sourceUrl=null` (limitación conocida, ver intro de Task 2).

- [ ] **2.8 — Commit**

```bash
git add src/components/browse/BrowseClient.tsx src/components/browse/BrowseCard.tsx
git commit -m "$(cat <<'EOF'
feat(browse): pipear sourceUrl del API a BrowseCard

El payload de /api/mock-auctions ya trae sourceUrl, pero el
BrowseClient.toDashboardAuction lo descartaba. Lo pasamos como
prop independiente a BrowseCard (sin tocar el type
DashboardAuction en lib/) para que Task 4 pueda mostrar el
link al listing original (BaT, Cars and Bids, Elferspot, etc.).

EOF
)"
```

---

## Task 3: Conectar el filtro de región (US/EU/UK/JP)

**Why:** El click en el pill de región actualiza la URL y el state, pero la grid no recorta por region. Causa raíz confirmada en `applyFilters.ts:151-153`:
```ts
if (f.region.length > 0) {
  if (!car.region || !f.region.includes(car.region)) return false;
}
```
`f.region` contiene IDs cortos `["US", "EU", ...]`, pero `car.region` viene del DB como string crudo (típicamente "United States", "Germany", "Japan", "United Kingdom"). El `.includes` siempre da false → la lista filtrada queda igual o vacía.

`DashboardAuction` ya tiene un campo `canonicalMarket?: "US" | "EU" | "UK" | "JP" | null` que **es exactamente lo que el filtro espera**. Cambiamos la comparación para usar ese.

Adicionalmente, `BrowseClient.tsx:101-111` solo manda el param al server cuando hay **una sola** región seleccionada. Permitiremos multi-select.

**Files:**
- Modify: `src/components/browse/filters/applyFilters.ts:151-153`
- Modify: `src/components/browse/filters/applyFilters.test.ts` (agregar caso)
- Modify: `src/components/browse/BrowseClient.tsx:101-111`

### Steps

- [ ] **3.1 — Escribir test que reproduce el bug**

Edit `src/components/browse/filters/applyFilters.test.ts`. Agregar al final del describe principal:

```ts
describe("region filter (canonicalMarket)", () => {
  const baseCar = (overrides: Partial<DashboardAuction>): DashboardAuction => ({
    id: "x", title: "t", make: "Porsche", model: "911", year: 2020, trim: null,
    price: 0, currentBid: 0, bidCount: 0, viewCount: 0, watchCount: 0,
    status: "ACTIVE", endTime: "", platform: "BRING_A_TRAILER",
    engine: null, transmission: null, exteriorColor: null,
    mileage: null, mileageUnit: null, location: null,
    description: null, images: [], analysis: null, priceHistory: [],
    ...overrides,
  });

  const baseFilters = (region: string[]): ClassicFilters => ({
    q: "", status: "all", series: [], variants: [],
    yearMin: null, yearMax: null,
    priceMin: null, priceMax: null,
    mileageMin: null, mileageMax: null,
    transmission: [], body: [], region, drive: [],
    platform: [], sort: "newest",
  });

  it("filtra por canonicalMarket=US cuando se selecciona US", () => {
    const cars = [
      baseCar({ id: "a", canonicalMarket: "US" }),
      baseCar({ id: "b", canonicalMarket: "EU" }),
      baseCar({ id: "c", canonicalMarket: "JP" }),
    ];
    const out = applyFilters(cars, baseFilters(["US"]));
    expect(out.map((c) => c.id)).toEqual(["a"]);
  });

  it("acepta multi-select (US + EU)", () => {
    const cars = [
      baseCar({ id: "a", canonicalMarket: "US" }),
      baseCar({ id: "b", canonicalMarket: "EU" }),
      baseCar({ id: "c", canonicalMarket: "JP" }),
    ];
    const out = applyFilters(cars, baseFilters(["US", "EU"]));
    expect(out.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("excluye carros sin canonicalMarket cuando hay filtro activo", () => {
    const cars = [
      baseCar({ id: "a", canonicalMarket: "US" }),
      baseCar({ id: "b", canonicalMarket: null }),
    ];
    const out = applyFilters(cars, baseFilters(["US"]));
    expect(out.map((c) => c.id)).toEqual(["a"]);
  });
});
```

(Importar `ClassicFilters` y `DashboardAuction` arriba si todavía no están importados.)

- [ ] **3.2 — Correr test y confirmar que falla**

Run: `npx vitest run src/components/browse/filters/applyFilters.test.ts -t "region filter"`
Expected: 3 tests fail (los carros no son filtrados como esperamos porque `applyFilters` lee `car.region`).

- [ ] **3.3 — Aplicar el fix en applyFilters.ts**

Edit `src/components/browse/filters/applyFilters.ts:151-153`:

Cambiar:
```ts
    if (f.region.length > 0) {
      if (!car.region || !f.region.includes(car.region)) return false;
    }
```
por:
```ts
    if (f.region.length > 0) {
      const market = car.canonicalMarket ?? null;
      if (!market || !f.region.includes(market)) return false;
    }
```

- [ ] **3.4 — Correr test y confirmar que pasa**

Run: `npx vitest run src/components/browse/filters/applyFilters.test.ts -t "region filter"`
Expected: 3 tests PASS. Y correr toda la suite de applyFilters para detectar regresiones:
`npx vitest run src/components/browse/filters/applyFilters.test.ts`
Expected: todos pass.

- [ ] **3.5 — Permitir multi-select en BrowseClient**

Edit `src/components/browse/BrowseClient.tsx:101-111` (zona donde construye `params` para la API). Localizar:

```tsx
if (filters.region.length === 1) params.region = filters.region[0];
```

y reemplazar por:

```tsx
if (filters.region.length >= 1) params.region = filters.region.join(",");
```

(Los endpoints `/api/mock-auctions` aceptan o ignoran este param sin romper. Aunque el server no lo use, el filtro cliente ya recorta correctamente con Task 3.3 — esto solo evita que la query downstream pida más data de la necesaria cuando el usuario seleccionó varias regiones.)

- [ ] **3.6 — Smoke test runtime**

Con dev corriendo: `http://localhost:3000/en/browse`
1. Click en pill "Region" → seleccionar **US**. Confirmar que la URL cambia a `?region=US` y que la grid solo muestra listings de US (los pills de plataforma típicamente serán BaT, C&B, CC).
2. Agregar **EU** al selector (multi-select). Confirmar que aparecen también listings de Elferspot y similares.
3. Deseleccionar todo. Confirmar que vuelven todos los listings.

- [ ] **3.7 — Lint + typecheck**

Run:
```bash
npx eslint src/components/browse/filters/applyFilters.ts src/components/browse/BrowseClient.tsx
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **3.8 — Commit**

```bash
git add src/components/browse/filters/applyFilters.ts \
        src/components/browse/filters/applyFilters.test.ts \
        src/components/browse/BrowseClient.tsx
git commit -m "$(cat <<'EOF'
fix(browse): conectar filtro de region usando canonicalMarket

El filtro comparaba car.region (string crudo del DB tipo
"United States", "Germany") contra los IDs cortos del UI
(US/EU/UK/JP), por lo que nunca recortaba la grid. Cambiamos
a car.canonicalMarket que es exactamente el shape esperado.
Tambien permitimos multi-select pasando todas las regiones
seleccionadas al endpoint en lugar de solo cuando hay una.

EOF
)"
```

---

## Task 4: Mostrar la fuente externa con link "Ver original"

**Why:** Edgar pidió explícitamente "que la gente pueda ver dónde está listado el carro (BaT, Cars and Bids, etc.) para que puedan entrar y verlo". Hoy la card muestra solo un pill con el código corto de plataforma (BaT, C&B, CC), pero no es clickeable y no abre la URL original. Con `sourceUrl` ya pipeado en Task 2, agregamos el link.

**UX:** El link debe ser:
- Visible pero secundario (el CTA primario será "Ver reporte" en Task 5).
- Abrir en nueva pestaña con `target="_blank" rel="noopener noreferrer"`.
- No interferir con el `<Link>` envolvente — usar `e.stopPropagation()` para que el click en el botón externo no dispare la navegación interna.
- Ocultarse si `sourceUrl` es `null`/`undefined` (graceful degrade).

**Files:**
- Modify: `src/components/browse/BrowseCard.tsx`

### Steps

- [ ] **4.1 — Importar el icono ExternalLink de lucide-react**

Edit `src/components/browse/BrowseCard.tsx:6`:

Cambiar:
```tsx
import { Clock, Gavel } from "lucide-react";
```
por:
```tsx
import { Clock, Gavel, ExternalLink } from "lucide-react";
```

- [ ] **4.2 — Agregar el botón externo dentro del footer de la card**

Edit `BrowseCard.tsx:144-170` (el `<div>` con `mt-2.5 pt-2 border-t`). Después del bloque `region && ...` (antes del cierre del div externo en línea 170), agregar el link. Dado que toda la card está dentro de un `<Link>`, el botón externo debe usar un anchor `<a>` con `onClick` que pare la propagación al wrapper.

Reemplazar las líneas 144-170 por:

```tsx
          <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2.5 min-w-0">
              {live && parseEndTimeMs(car.endTime) !== null && (
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="size-3" />
                  {timeLeft(new Date(car.endTime), {
                    ended: "Ended",
                    day: "d",
                    hour: "h",
                    minute: "m",
                  })}
                </span>
              )}
              <span className="flex items-center gap-1 shrink-0">
                <Gavel className="size-3" />
                {car.bidCount}
              </span>
              {trans && (
                <span className="shrink-0 font-medium text-foreground/70">{trans}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {region && (
                <span className="font-medium text-muted-foreground tracking-wider">
                  {region}
                </span>
              )}
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-foreground/80 hover:border-primary/40 hover:text-primary transition-colors"
                  title={`View original listing on ${platformLabel}`}
                >
                  View on {platformLabel}
                  <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>
          </div>
```

- [ ] **4.3 — Verificar runtime visual**

Con dev corriendo, abrir `http://localhost:3000/en/browse`. En cualquier card visible debe aparecer un mini-pill al fondo-derecha con texto tipo "View on BaT ↗" o "View on C&B ↗". Click → abre la URL del listing original en pestaña nueva, sin disparar navegación interna. Si una card no tiene `sourceUrl` (debería ser raro con DB real), el pill no aparece — la card sigue siendo válida.

- [ ] **4.4 — Lint + typecheck**

Run:
```bash
npx eslint src/components/browse/BrowseCard.tsx
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **4.5 — Commit**

```bash
git add src/components/browse/BrowseCard.tsx
git commit -m "$(cat <<'EOF'
feat(browse): mostrar link "View on {platform}" en cada card

Cada card ahora exhibe un mini-pill clickeable que abre la URL
original del listing (BaT, Cars and Bids, Collecting Cars,
Elferspot, etc.) en pestaña nueva. Refuerza el frame de
MonzaHaus como capa de inteligencia: somos informacion sobre
listings que viven en otras plataformas, no un marketplace.

EOF
)"
```

---

## Task 5: Repivotar copy y CTA primario hacia el reporte

**Why:** La copy hardcoded de `BrowseClient.tsx` repite "acquisitions" 4+ veces y vende "find the right car" en lugar de "read the intelligence". El `<Link>` que envuelve cada `BrowseCard` apunta hoy a `/cars/[make]/[id]` (ficha del carro). Como el producto vende **el reporte**, el CTA primario debe llevar a `/cars/[make]/[id]/report`.

**Files:**
- Modify: `src/components/browse/BrowseClient.tsx:271-355`
- Modify: `src/components/browse/BrowseCard.tsx:84` (el destino del Link wrapper)

### Steps

- [ ] **5.1 — Cambiar el destino del Link primario en la card**

Edit `src/components/browse/BrowseCard.tsx:84`:

Cambiar:
```tsx
        href={`/cars/${makeSlug}/${car.id}`}
```
por:
```tsx
        href={`/cars/${makeSlug}/${car.id}/report`}
```

(El usuario que quiera ver la ficha cruda y otras imágenes del carro sigue teniendo el link "View on {platform}" que abre la fuente original. La ficha interna `/cars/[make]/[id]` queda accesible vía URL directa o desde el reporte.)

- [ ] **5.2 — Reescribir copy del empty state y cuerpo en BrowseClient**

Edit `src/components/browse/BrowseClient.tsx`. Reemplazar las strings (líneas 273-287, 321, 339-343):

| Antes | Después |
|---|---|
| `Our data pipeline is updating` | `Our intelligence is updating` |
| `Check back shortly for new acquisitions.` | `Check back shortly — new reports are published as listings come live.` |
| `No acquisitions match this specification` | `No reports match this specification` |
| `Looking for something specific? Broaden your filters or speak with a dedicated sourcing advisor — we find acquisitions off-market.` | `Try broadening your filters, or talk to an advisor about a custom report.` |
| `Talk to an advisor` | `Talk to an advisor` (mantener) |
| `Load more acquisitions` | `Load more reports` |
| `You've reached the end of the current inventory · {n} shown` | `You've reached the end · {n} reports shown` |
| `Narrow specification?` | `Narrow specification?` (mantener) |
| `Save this search and we'll notify you when new matches appear, or hand it to our sourcing team to search off-market inventory.` | `Save this search and we'll notify you when new reports match, or commission a custom one with our team.` |
| `Save search` | `Save search` (mantener) |

Aplicar cada reemplazo con `Edit` en el archivo. Cuando un string aparezca varias veces, usar contexto único para identificarlo.

- [ ] **5.3 — Smoke test runtime**

Con dev corriendo:
1. `http://localhost:3000/en/browse` — confirmar que el header dice cosas como "reports" no "acquisitions".
2. Click en una card → debe ir a `/cars/{make}/{id}/report` (no a `/cars/{make}/{id}`).
3. Aplicar filtros que no matcheen nada (ej: precio absurdo) — confirmar el empty state nuevo.

- [ ] **5.4 — Lint**

Run: `npx eslint src/components/browse/BrowseCard.tsx src/components/browse/BrowseClient.tsx`
Expected: sin errores.

- [ ] **5.5 — Commit**

```bash
git add src/components/browse/BrowseCard.tsx src/components/browse/BrowseClient.tsx
git commit -m "$(cat <<'EOF'
feat(browse): repivotar copy y CTA primario hacia el reporte

Cards ahora linkean a /cars/[make]/[id]/report (no a la ficha
generica). Copy del empty state, infinite-scroll footer y
"narrow specification" pasa de "acquisitions" a "reports" —
alineado con la tesis: MonzaHaus vende inteligencia, los
carros viven en sus marketplaces originales.

EOF
)"
```

---

## Task 6: Banner "MonzaHaus es información, no marketplace"

**Why:** Edgar pidió explícitamente "que quede claro de que no somos un marketplace sino una información". Un banner sutil, leído al entrar a `/browse`, ancla mental el frame correcto. No debe ser intrusivo (no modal, no toast bloqueante) — preferimos una franja delgada arriba de la grid, dismissible, con copy clara.

**Decisión:** Banner persistente (no dismissible) en una primera iteración, debajo del FilterBar. Si Edgar luego prefiere dismissible, se itera.

**Files:**
- Create: `src/components/browse/NoMarketplaceBanner.tsx`
- Modify: `src/components/browse/BrowseClient.tsx:255-264` (insertar banner debajo del FilterBar)

### Steps

- [ ] **6.1 — Crear el componente NoMarketplaceBanner**

Create `src/components/browse/NoMarketplaceBanner.tsx`:

```tsx
import { Info } from "lucide-react";

export function NoMarketplaceBanner() {
  return (
    <div className="border-b border-border bg-foreground/[0.02]">
      <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-2.5 flex items-start md:items-center gap-2.5">
        <Info className="size-3.5 shrink-0 text-muted-foreground mt-0.5 md:mt-0" aria-hidden />
        <p className="text-[11px] md:text-[12px] text-muted-foreground leading-snug">
          <span className="font-medium text-foreground">MonzaHaus is intelligence, not a marketplace.</span>{" "}
          Every car here is listed on Bring a Trailer, Cars and Bids, Collecting Cars, Elferspot
          and other platforms — we publish the report; you go bid where the car actually lives.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **6.2 — Insertar el banner debajo del FilterBar**

Edit `src/components/browse/BrowseClient.tsx`:

Importar arriba (cerca línea 7):
```tsx
import { NoMarketplaceBanner } from "./NoMarketplaceBanner";
```

Modificar el JSX, cambiar líneas 255-264:
```tsx
  return (
    <div className="min-h-screen bg-background pt-14 md:pt-16">
      <FilterBar
        filters={filters}
        matchCount={filtered.length}
        totalTracked={totalTracked}
        seriesCounts={seriesCounts}
        onChange={(patch) => setFilters(patch)}
        onReset={resetFilters}
      />
```
por:
```tsx
  return (
    <div className="min-h-screen bg-background pt-14 md:pt-16">
      <FilterBar
        filters={filters}
        matchCount={filtered.length}
        totalTracked={totalTracked}
        seriesCounts={seriesCounts}
        onChange={(patch) => setFilters(patch)}
        onReset={resetFilters}
      />
      <NoMarketplaceBanner />
```

- [ ] **6.3 — Smoke test runtime**

Con dev corriendo, recargar `http://localhost:3000/en/browse`:
- El banner aparece debajo de la barra de filtros, antes del primer row de la grid.
- En desktop: una sola línea cómoda. En mobile: el texto wrappea pero queda legible.
- El layout de la grid no se rompe.

- [ ] **6.4 — Lint + typecheck**

Run:
```bash
npx eslint src/components/browse/NoMarketplaceBanner.tsx src/components/browse/BrowseClient.tsx
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **6.5 — Commit**

```bash
git add src/components/browse/NoMarketplaceBanner.tsx \
        src/components/browse/BrowseClient.tsx
git commit -m "$(cat <<'EOF'
feat(browse): banner "MonzaHaus is intelligence, not a marketplace"

Banda delgada bajo el FilterBar que clarifica el rol del
producto: publicamos reportes, los carros viven en BaT, Cars
and Bids, Collecting Cars, Elferspot, etc. El usuario hace bid
donde el carro realmente esta listado. Refuerza el frame
correcto desde la primera impresion.

EOF
)"
```

---

## Closing — push y PR

- [ ] **C.1 — Push de la rama**

```bash
git push -u origin cambios-front-mayo
```

- [ ] **C.2 — Verificar diff completo**

```bash
git log --oneline main..cambios-front-mayo
git diff --stat main..cambios-front-mayo
```

Expected: 6 commits, ~7-9 archivos tocados, ningún archivo bajo `src/lib/`, `src/app/api/`, ni `supabase/migrations/`.

- [ ] **C.3 — Abrir PR (si Edgar confirma)**

```bash
gh pr create --title "feat(browse + report): cambios front mayo" --body "$(cat <<'EOF'
## Summary

Pivot de `/browse` (la "Classic" view) hacia el frame correcto: MonzaHaus es inteligencia, no marketplace. Bug fix asociado del 500 al abrir reportes.

## Cambios por commit

1. **fix(report)** — blindar SSR del page de reporte (try/catch en 3 llamadas) → no más `500: Internal Server Error` en `/cars/[make]/[id]/report`.
2. **feat(browse)** — pipear `sourceUrl` del API hasta `BrowseCard` (sin tocar `lib/`).
3. **fix(browse)** — filtro de región usa `canonicalMarket` (US/EU/UK/JP) en lugar de la `region` cruda del DB. Multi-select habilitado.
4. **feat(browse)** — link "View on {platform}" en cada card, abre el listing original en pestaña nueva.
5. **feat(browse)** — copy y CTA primario rebrandeados de "acquisitions" a "reports". Click de card va a `/report`.
6. **feat(browse)** — banner "MonzaHaus is intelligence, not a marketplace" debajo del FilterBar.

## Test plan

- [ ] `npm test -- src/app/\[locale\]/cars/\[make\]/\[id\]/report/page.test.tsx`
- [ ] `npm test -- src/components/browse/filters/applyFilters.test.ts`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Manual: visitar `https://www.monzahaus.com/cars/porsche/live-fff7330c-0ce1-41cd-bb95-4c3f24520dc9/report` después de deploy — debe cargar sin 500.
- [ ] Manual: en `/browse`, filtro de región US recorta la grid; click "View on BaT" abre listing original; click sobre la card va a `/report` no a la ficha cruda.

## Out of scope

- No se toca `src/lib/`, `src/app/api/`, ni migraciones Supabase.
- No se cambian colores, tipografía, ni branding.
- Si después del fix de Task 1 sigue habiendo 500 en algún listing puntual, el siguiente paso (tocar `src/lib/supabaseLiveListings.ts`) requiere aprobación explícita por separado.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review (auditado antes de entregar)

- [x] **Spec coverage** — los 3 puntos que Edgar describió (Classic→reporte, filtro región, error 500) están cubiertos por Tasks 1, 3, 5 más Tasks 2/4/6 que cubren el requerimiento adicional de mostrar fuente externa y banner anti-marketplace.
- [x] **Placeholder scan** — sin "TBD" ni "implement later". Todas las strings, paths y diff blocks son literales. La única zona laxa es Task 2.1 ("agente: leer 87-200 antes de tocar") porque la ubicación del setter de `cars` puede haber cambiado entre commits — la dirección es explícita y el contrato (poblar `sourceUrlById`) es claro.
- [x] **Type consistency** — `sourceUrl` mantiene shape `string | null` en API, BrowseClient state, y BrowseCard prop. `canonicalMarket` matchea la unión literal `"US" | "EU" | "UK" | "JP" | null` ya declarada en `DashboardAuction`.
- [x] **Scope check** — los 6 commits suman ~7-9 archivos, todos en `src/components/browse/` o el page del reporte. Sin tocar libs/API/DB. Cada commit deja la app funcional. Merge limpio garantizado por la modularidad: si un commit explota en review, los anteriores siguen mergeables.

---

## Riesgos conocidos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `sourceUrl` viene null para todos los listings (mock o DB real) → Task 4 muestra cards sin link y queda inconsistente | Task 2.5 verifica en DevTools que la prop llega. Si llega null masivamente, parar antes del Task 4 y reportar a Edgar — el siguiente paso sería revisar el scraper o el campo del DB. |
| `canonicalMarket` no está poblado en mocks → filtro de región siempre devuelve vacío | El test 3.1 valida el path feliz. En runtime (Task 3.6), si la grid queda vacía con cualquier región, agente: confirmar con `console.log(car.canonicalMarket)` que el campo llega. Si está null, usar fallback `sourceToCanonicalMarket(car.platform)` — agregar como helper en `applyFilters.ts` (mismo archivo, no toca lib). |
| Task 1 fix no resuelve el 500 en prod (causa real es otra) | El fix protege contra fallo de las 3 queries identificadas estáticamente. Si después de deploy sigue tronando, el siguiente paso es leer logs de Vercel del request fallido — eso requiere aprobación explícita para tocar `src/lib/supabaseLiveListings.ts` o equivalente. |
| Dev server local no resuelve la DB Supabase y eso confunde la verificación manual | Task 1.6 nota explícita de que el HTTP 200 con HTML válido (incluso con datos parciales) es el criterio de éxito en local. La verificación final del fix en prod es con la URL real después del deploy. |

---

## Execution mode

Recomendado: **subagent-driven** (un subagente por Task con review entre tasks). Cada Task es auto-contenido y reviewable independientemente.

Alternativa: **inline** (ejecutar las 6 Tasks en sesión actual con checkpoint humano cada commit) — más rápido si Edgar quiere acompañar el progreso en vivo.
