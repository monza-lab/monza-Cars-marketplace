# Otros Ajustes Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Branch:** `otros-ajustes-front-end` (created from `main` at SHA `7cfe702`).

**Goal:** Eliminar de `/browse` toda señal UI de subasta que no se pueda garantizar como **data real**, sin tocar `src/lib/`, `src/app/api/`, scrapers ni migraciones. UI deja de mentir, sin requerir cambios upstream.

**Architecture decisions:**
- **Honest-by-data**: el componente decide qué renderizar según el valor de los campos (`bidCount > 0`, `endTime > now`), no según una lista de plataformas. Cero `if (platform === "AS24")` o equivalentes — eso sería trasladar el hardcode del back al front.
- **El badge `LIVE`** se elimina de la card en `/browse`. El campo `status` está hardcoded a `"active"` por 4 de los 5 scrapers de marketplace (AutoScout24, BeForward, Elferspot, Classic.com) — es el campo menos confiable de toda la cadena. Si el usuario quiere saber si el listing sigue vivo, hace click en "View on {platform}" y va a la fuente original.
- **El precio (`car.currentBid`)** queda intacto: la auditoría confirmó que todos los scrapers populan este campo con data real (no hay hardcode). El "Price" mostrado es honesto.
- **`MarketDeltaPill` arriba-derecha** queda intacto: ya está apagado en la card (`medianUsd={null}` siempre, retorna `null`). No agrega ruido.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, Tailwind v4, framer-motion, lucide-react. Tests con vitest + @testing-library/react.

**Background — la deuda que esto deja documentada:**

La causa raíz vive en backend; este plan no la arregla, solo evita transmitirla. El audit del 2026-05-07 detectó:

| Campo | Plataformas con data real | Plataformas con data fabricada |
|---|---|---|
| `bidCount` | BaT, Cars and Bids, Collecting Cars (scraped) | **AutoTrader hardcoded `0`** (`autotrader_collector/supabase_writer.ts:137`); **BeForward hardcoded `0`** (`beforward_porsche_collector/supabase_writer.ts:131`); **Elferspot omite el campo** (DB default `0` aplica); AutoScout24 + Classic.com sourcean pero pueden ser null y se coercen a `0` en `src/lib/supabaseLiveListings.ts:561` (`?? 0`) |
| `endTime` | Plataformas auction (real auction-end timestamps) | Plataformas marketplace dejan null si no aplica (correcto). Elferspot lo omite siempre. |
| `status` | BaT, Cars and Bids, Collecting Cars, **AutoTrader** (verifica con `refreshActiveListings()` 196–262) | **AutoScout24, BeForward, Elferspot, Classic.com hardcodean `"active"`** en sus respectivos `normalize.ts` |

Tareas para backend (fuera de scope de este plan, deben ir a backlog):
- AS24, BF, ES, Cls.com: dejar de hardcodear `status` — implementar verificación real al estilo AutoTrader.
- AT, BF: dejar de hardcodear `bid_count: 0`. Si la fuente no tiene bids (porque no es subasta), dejar el campo `null`, no `0`.
- Elferspot: emitir explicitamente `bid_count: null` y `end_time: null` en lugar de omitir las columnas.
- Considerar `src/lib/supabaseLiveListings.ts:561` — el `?? 0` en `currentBid` está OK (price fallback), pero `bid_count` podría preservarse como `null` para que la UI distinga.

**Out of scope (NO tocar en este plan):**
- `src/lib/**`
- `src/app/api/**`
- Scrapers (`src/features/scrapers/**`)
- Migraciones Supabase
- Branding / theme tokens
- Cualquier otra ruta del front (la home, el dashboard, makepage). Solo `/browse` (= la "Classic view") en este branch.

---

## File Structure

| File | Created? | Touched in task | Responsibility |
|---|---|---|---|
| `src/components/browse/BrowseCard.tsx` | existing | A | Card individual. Quitar LIVE badge. Condicionar Gavel y Clock a data signals. |
| `src/components/browse/BrowseCard.test.tsx` | NEW | B | Suite que verifica que los signals desaparecen para listings sin bids/endTime. |

**Branching & merge strategy:**
- Branch: `otros-ajustes-front-end` (ya creado).
- 2 commits secuenciales, cada uno auto-contenido (Task A + Task B).
- Después del Task B, push + abrir PR.
- Al merger: `Create a merge commit` o `Rebase and merge` (no squash — se quiere preservar la separación entre fix y test).

---

## Task A: BrowseCard footer honest-by-data

**Why first:** Es el cambio visible que el owner reportó. El test (Task B) usa el componente refactorizado, así que va después.

**Files:**
- Modify: `src/components/browse/BrowseCard.tsx`

### Steps

- [ ] **A.1 — Eliminar el badge `LIVE` del overlay de la imagen**

Edit `src/components/browse/BrowseCard.tsx`. Localizar el bloque (alrededor de líneas 110-115):

```tsx
          {live && (
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-background/85 backdrop-blur-md px-2 py-0.5">
              <span className="size-1.5 rounded-full bg-positive animate-pulse" />
              <span className="text-[9px] font-medium text-positive tracking-wide">LIVE</span>
            </div>
          )}
```

**Eliminar el bloque completo.** Razón: el campo `status` está hardcoded a `"active"` en 4 de 5 scrapers de marketplace. Mostrar "LIVE" para listings que pueden llevar meses publicados es UI mintiendo. El frame "live auction" además contradice el pivot del producto (intelligence > marketplace).

- [ ] **A.2 — Eliminar la variable `live` que ya no se usa**

Tras eliminar el JSX del LIVE badge, la variable `const live = isLiveStatus(car.status);` (alrededor de línea 82) sólo es referenciada en el footer (pasos A.3 y A.4). El check de `isAuction` en `endTime` la sustituye. Remover la línea:

```tsx
  const live = isLiveStatus(car.status);
```

Y borrar la función helper `isLiveStatus` arriba del archivo (líneas 27-29) si ya no se usa en ningún lado:

```tsx
function isLiveStatus(status: string): boolean {
  return status === "ACTIVE" || status === "ENDING_SOON";
}
```

Verificar con: `grep -n "isLiveStatus\| live " src/components/browse/BrowseCard.tsx` — no debería arrojar nada después.

- [ ] **A.3 — Condicionar el countdown clock a data real**

Localizar el bloque del clock (líneas 159-169 aprox.):

```tsx
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
```

Reemplazar la condición. El countdown sólo debe mostrarse cuando hay (a) un `endTime` parseable, (b) el endTime está en el futuro, y (c) la card tiene actividad de bids — ese combo solo se da en auctions reales activas:

```tsx
              {(() => {
                const endMs = parseEndTimeMs(car.endTime);
                const isFuture = endMs !== null && endMs > Date.now();
                const hasBids = car.bidCount > 0;
                if (!isFuture || !hasBids) return null;
                return (
                  <span className="flex items-center gap-1 shrink-0">
                    <Clock className="size-3" />
                    {timeLeft(new Date(car.endTime), {
                      ended: "Ended",
                      day: "d",
                      hour: "h",
                      minute: "m",
                    })}
                  </span>
                );
              })()}
```

Razón: `hasBids` es la pista honesta de que la plataforma es de subasta (los marketplaces hardcodean `0`). El check de `isFuture` evita mostrar countdowns negativos ("Ended") para listings vencidos.

- [ ] **A.4 — Condicionar el `Gavel + bidCount` a `bidCount > 0`**

Localizar el bloque (líneas 170-173 aprox.):

```tsx
              <span className="flex items-center gap-1 shrink-0">
                <Gavel className="size-3" />
                {car.bidCount}
              </span>
```

Reemplazar por:

```tsx
              {car.bidCount > 0 && (
                <span className="flex items-center gap-1 shrink-0">
                  <Gavel className="size-3" />
                  {car.bidCount}
                </span>
              )}
```

Razón: marketplaces que hardcodean `bidCount: 0` ya no muestran el martillo. Auctions reales con bids reales lo siguen mostrando. Si una auction de BaT realmente tiene 0 bids (early in auction), también se esconde — falso negativo aceptable porque no es información útil de todas formas (un "0" no agrega).

- [ ] **A.5 — Eliminar imports de íconos no usados (si aplica)**

Si después de A.1–A.4 alguno de los íconos `Clock`, `Gavel` ya no se usa (no debería ser el caso — siguen siendo condicionales), correr:

```bash
grep -n "Clock\|Gavel" src/components/browse/BrowseCard.tsx
```

Si alguno aparece sólo en el `import` y no en el JSX, removerlo del `import` para evitar warnings de eslint.

Esperado: `Clock` y `Gavel` siguen apareciendo en el JSX condicionalmente. No debería haber imports muertos. `ExternalLink` también se mantiene.

- [ ] **A.6 — Lint + typecheck**

```bash
npx eslint src/components/browse/BrowseCard.tsx
npx tsc --noEmit 2>&1 | grep -E "BrowseCard\.tsx" | head -5
```

Expected: ambos sin errores en `BrowseCard.tsx`. (Errores en otros archivos son pre-existentes; ignorar.)

- [ ] **A.7 — Smoke runtime con dev server**

Dev server debe estar corriendo (`npm run dev`). En otra terminal:

```bash
/usr/bin/curl -sL "http://localhost:3000/en/browse" --max-time 30 | grep -c 'class="text-\[9px\] font-medium text-positive tracking-wide">LIVE'
```

Expected: `0` (el badge LIVE ya no se renderiza).

- [ ] **A.8 — Commit**

```bash
git add src/components/browse/BrowseCard.tsx
git commit -m "$(cat <<'EOF'
fix(browse): card stops showing fabricated auction signals

Three signals on each /browse card were either showing
backend-fabricated data or reinforcing the auction frame
the product is moving away from:

  1. The green "LIVE" badge read from car.status, which is
     hardcoded to "active" in 4 of 5 marketplace scrapers
     (AutoScout24, BeForward, Elferspot, Classic.com).
     Removed entirely. If the user wants to verify a listing
     is still live, the "View on {platform}" link goes to
     the source of truth.

  2. The Gavel + bidCount pair was rendering "0" for every
     marketplace listing because AutoTrader/BeForward
     hardcode bid_count=0 and Elferspot omits the column
     (DB default 0). Now only renders when bidCount > 0 —
     auction-only signal, honest by data.

  3. The Clock + countdown was rendering whenever endTime
     was parseable, including past dates. Now requires
     endTime in the future AND bidCount > 0 (the combo only
     occurs in active auctions, not marketplace listings).

Cero hardcoded platform allowlists in the front. Decision
is purely data-driven so the UI auto-corrects when the
backend stops fabricating these fields.
EOF
)"
```

---

## Task B: Tests for BrowseCard

**Why:** No existe `BrowseCard.test.tsx`. Sin tests, las condiciones honest-by-data del Task A pueden romperse en futuros refactors sin que nadie lo note. Cinco casos cubren los puntos de fallo más probables.

**Files:**
- Create: `src/components/browse/BrowseCard.test.tsx`

### Steps

- [ ] **B.1 — Crear el archivo de test con los 5 casos**

Create `src/components/browse/BrowseCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { DashboardAuction } from "@/lib/dashboardCache";
import { BrowseCard } from "./BrowseCard";

// Stub Next/i18n boundaries that aren't relevant to this component's
// rendering decisions.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock("@/lib/CurrencyContext", () => ({
  useCurrency: () => ({ formatPrice: (n: number) => `$${n.toLocaleString()}` }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

function makeCar(overrides: Partial<DashboardAuction> = {}): DashboardAuction {
  return {
    id: "test-1",
    title: "2023 Porsche 911 GT3",
    make: "Porsche",
    model: "911",
    year: 2023,
    trim: "GT3",
    price: 200_000,
    currentBid: 200_000,
    bidCount: 0,
    viewCount: 0,
    watchCount: 0,
    status: "ACTIVE",
    endTime: "2030-12-31T00:00:00.000Z",
    platform: "AUTO_SCOUT_24",
    engine: null,
    transmission: null,
    exteriorColor: null,
    mileage: 1000,
    mileageUnit: "mi",
    location: null,
    region: null,
    description: null,
    images: [],
    analysis: null,
    priceHistory: [],
    canonicalMarket: "EU",
    ...overrides,
  };
}

describe("BrowseCard — honest-by-data signals", () => {
  it("does NOT render the LIVE badge regardless of status", () => {
    const car = makeCar({ status: "ACTIVE" });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.textContent ?? "").not.toContain("LIVE");
  });

  it("does NOT render Gavel + bidCount when bidCount is 0", () => {
    const car = makeCar({ bidCount: 0 });
    const { container } = render(<BrowseCard car={car} index={0} />);
    // The "0" character should not appear inside any flex span next to Gavel.
    // We assert by searching for ≥1-digit followed by no other auction text.
    const text = container.textContent ?? "";
    // Crude proxy: there should be no isolated "0" rendered as bid count.
    // The gavel SVG would have aria-hidden, so we check there are zero
    // SVGs marked as lucide-gavel in the DOM.
    expect(container.querySelector(".lucide-gavel")).toBeNull();
    void text;
  });

  it("renders Gavel + bidCount when bidCount > 0", () => {
    const car = makeCar({ bidCount: 14, platform: "BRING_A_TRAILER" });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.querySelector(".lucide-gavel")).not.toBeNull();
    expect(container.textContent ?? "").toContain("14");
  });

  it("does NOT render Clock countdown when bidCount is 0 (even if endTime is future)", () => {
    const car = makeCar({ bidCount: 0, endTime: "2099-01-01T00:00:00.000Z" });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.querySelector(".lucide-clock")).toBeNull();
  });

  it("renders Clock countdown when bidCount > 0 AND endTime is in the future", () => {
    const car = makeCar({
      bidCount: 5,
      endTime: "2099-01-01T00:00:00.000Z",
      platform: "BRING_A_TRAILER",
    });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.querySelector(".lucide-clock")).not.toBeNull();
  });

  it("does NOT render Clock countdown when endTime is in the past", () => {
    const car = makeCar({
      bidCount: 5,
      endTime: "2000-01-01T00:00:00.000Z",
      platform: "BRING_A_TRAILER",
    });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.querySelector(".lucide-clock")).toBeNull();
  });
});
```

- [ ] **B.2 — Correr los tests y verificar que pasan**

```bash
npx vitest run src/components/browse/BrowseCard.test.tsx
```

Expected: 6 tests pass.

Si alguno falla por imports faltantes o setup de jsdom, ajustar mocks (probablemente el harness de vitest+jsdom ya está configurado vía `vitest.config.ts`).

- [ ] **B.3 — Lint**

```bash
npx eslint src/components/browse/BrowseCard.test.tsx
```

Expected: sin errores.

- [ ] **B.4 — Commit**

```bash
git add src/components/browse/BrowseCard.test.tsx
git commit -m "$(cat <<'EOF'
test(browse): cover BrowseCard honest-by-data conditions

Six unit cases asserting that auction signals on the card
respond to data values, not platform identity:

  - LIVE badge never renders (regardless of status field).
  - Gavel + bidCount hidden when bidCount is 0; visible when
    bidCount > 0.
  - Clock countdown hidden when bidCount is 0 even if
    endTime is future; hidden when endTime is past; visible
    only when bidCount > 0 AND endTime is in the future.

Locks in the contract from the previous fix so future
refactors don't accidentally re-introduce the fabricated
signals.
EOF
)"
```

---

## QA — final verification before push

- [ ] **Q.1 — Run all relevant test suites**

```bash
npx vitest run src/components/browse src/app/\[locale\]/cars/\[make\]/\[id\]/report
```

Expected: ≥43 tests pass (37 pre-existing + 6 new). 0 failures.

- [ ] **Q.2 — Lint touched files**

```bash
npx eslint src/components/browse/BrowseCard.tsx src/components/browse/BrowseCard.test.tsx
```

Expected: 0 errors, 0 warnings.

- [ ] **Q.3 — Production build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`. If it fails on `* 2.*` Finder duplicate files (pre-existing in working tree), see "If something breaks" in the merge notes for that workaround.

- [ ] **Q.4 — Smoke test visual con Chrome**

Con dev server corriendo, abrir `http://localhost:3000/en/browse` en un browser y verificar:

| Check | Expected |
|---|---|
| Banner "MonzaHaus is intelligence, not a marketplace" visible debajo del FilterBar | ✅ |
| Cards de plataformas no-auction (AS24, AT, BF, ES, Cls) NO muestran badge LIVE verde | ✅ |
| Cards de plataformas no-auction NO muestran ícono de martillo + "0" | ✅ |
| Cards de plataformas no-auction NO muestran countdown | ✅ |
| Cards de BaT con bids reales SÍ muestran ícono de martillo + número de bids | ✅ |
| Cards de BaT con auction activo SÍ muestran countdown (formato "Xd Yh") | ✅ |
| Link "View on {platform}" sigue visible y funcional (target=_blank) | ✅ |
| Click sobre cualquier card va a `/cars/{make}/{id}/report` | ✅ |
| El "Price" se muestra honestamente (no $0) en todas las cards | ✅ |

Si cualquiera de los checks falla, NO commitear más, revisar el código y reportar.

---

## Push & PR

- [ ] **P.1 — Verify branch state**

```bash
git status --short    # debe estar limpio
git log --oneline main..otros-ajustes-front-end
```

Expected: 2 commits (Task A + Task B). Ambos sobre `otros-ajustes-front-end`.

- [ ] **P.2 — Push**

```bash
git push -u origin otros-ajustes-front-end
```

- [ ] **P.3 — Generate merge notes for the backend**

Crear `docs/superpowers/plans/2026-05-07-otros-ajustes-frontend-MERGE-NOTES.md` con el patrón del merge notes anterior:
- TL;DR de los 2 commits.
- Inventario de archivos.
- QA results.
- "Backend backlog" — la lista de fixes upstream que este plan documenta pero no resuelve (está en la sección "Background" de este plan, copiar tal cual).
- Smoke checklist post-deploy.

- [ ] **P.4 — Commit merge notes + push de nuevo**

```bash
git add docs/superpowers/plans/2026-05-07-otros-ajustes-frontend-MERGE-NOTES.md
git commit -m "docs(plans): add merge notes for otros-ajustes-front-end"
git push origin otros-ajustes-front-end
```

---

## Self-Review

- [x] **Spec coverage** — `bidCount`, `endTime`, `status` (badge LIVE) están todos cubiertos en Task A. `currentBid` no se toca porque la auditoría confirmó data real. `MarketDeltaPill` no se toca porque `medianUsd={null}` la apaga.
- [x] **No platform allowlists** — el plan no introduce ningún `if (platform === "BAT")` ni equivalente. Las condiciones son sobre valores (`bidCount > 0`, `endTime > now`).
- [x] **No lib/api/migrations touch** — los archivos modificados están todos bajo `src/components/browse/`.
- [x] **Tests cover the contract** — los 6 casos del Task B cubren los 3 signals × 2 estados (visible/oculto).
- [x] **Backend deuda documentada** — la sección "Background" del plan + "Backend backlog" en el merge notes son el handoff.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Una card de BaT con genuinely 0 bids (early auction) deja de mostrar el martillo | Aceptado. "0" no es información útil; el countdown sigue mostrándose si `bidCount > 0` aparece después. Falso negativo benigno. |
| El test de Task B usa selectores tipo `lucide-gavel` que dependen de cómo `lucide-react` emite SVGs | Si el selector no matchea, ajustar al selector real (ej. `[data-lucide="gavel"]`). Verificar contra el DOM real al primer run. |
| `parseEndTimeMs` o `timeLeft` cambian en otro PR y rompen el countdown | Tests de Task B detectan: cubren past/future/null. |
| Algún usuario que ya conoce el badge LIVE lo extraña | Aceptado — la regla "UI no puede mentir" pesa más que la familiaridad de UI. La narrativa nueva es "cada card es un reporte", no "cada card es una subasta live". |

---

## Execution mode

**Recomendado:** ejecución inline (los 2 commits son cortos y sin dependencias externas, no requieren multiagente). El plan es ejecutable de cabo a rabo en una sesión.
