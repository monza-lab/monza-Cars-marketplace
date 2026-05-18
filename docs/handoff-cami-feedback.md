# Handoff — Feedback Amigo Cami → Cami

**Branch:** `feedback-amigo-cami`
**Fecha:** 2026-05-16
**De:** Edgar (frontend) → Cami (backend)
**Resumen:** 11 commits, todo frontend. 1 template de email listo para subir a Supabase. 0 cambios en API/DB.

---

## Lo que pidió el amigo de Cami (video transcrito)

| # | Punto | Status |
|---|---|---|
| 1 | Contraste de letras (gris muy parecido al blanco en light mode) | ✅ Resuelto (frontend) |
| 2 | Muchos clicks para llegar de la familia a los carros | ✅ Resuelto (frontend) |
| 3 | Watchlist — guardar carros como favoritos | ✅ Resuelto (frontend, localStorage) |
| 4 | Landing tipo Elferspot para MonzaHaus | ❌ Fuera de scope — diferido |
| 5 | Magic link "no se ve bien" — pantalla + email | ✅ Pantalla en frontend · ⚠️ **Email** lo subes tú (template adjunto) |

Adicional descubierto y arreglado en el camino:
- Bug preexistente del scroll en el home (el body scrolleaba en vez de cada columna)
- Repetición de "Ask Advisor" entre el panel derecho y el FAB global
- Sidebar duplicada en `DashboardClient.tsx` que no usaba el componente reutilizable

---

## Los 11 commits (en orden)

```
57dd54d  feat(auth): redesign magic link confirmation screen
6f6300b  fix(theme): bump light-mode muted-foreground for WCAG AA
8f14901  ux(sidebar): family click navigates straight to cars view
26c263e  feat(watchlist): localStorage watchlist with sidebar tab
835801a  docs(handoff): summary for Cami + branded magic-link email template
3fd7424  fix(email): exact MonzaHausWordmark replication
62ff6e0  fix(dashboard): restore per-column scroll + add watchlist tab to home
eaf1d54  feat(make-page): add Watchlist tab to left sidebar of /cars
65d4af3  feat(panel): redesign CarContextPanel for Report conversion
8fa1b23  fix(panel): Recent sales empty state + readable Report tease
ac154e7  ux(sidebar): swap tab order — Live first, Watchlist second
```

---

## Detalle por área

### 1. Magic link · pantalla de confirmación
**Archivo:** `src/components/auth/AuthModal.tsx`

La pantalla **dentro de la app** después de pedir el magic link estaba en inglés hardcodeado y se veía como un toast tímido. Ahora:

- Icono Mail dentro de un círculo Heritage Lavender (anchor visual)
- Título "Check your inbox" en Cormorant (display)
- Email del usuario destacado en su propia línea
- Hint amistoso: "Suele llegar en menos de un minuto. No olvides revisar spam."
- Botón **"Reenviar correo"** siempre visible (antes solo en signup) con cooldown de 30s
- Link nuevo "Probar con otro correo" que resetea el form
- Todo traducido en `en/es/de/ja` (6 keys nuevas por locale, namespace `auth`)

### 2. Contraste en light theme
**Archivo:** `src/app/globals.css`

Cambié `--muted-foreground` en `:root` de `#9A8E88` (~2.8 : 1 sobre cream — **falla WCAG AA**) a `#6B6365` (~5.4 : 1 — pasa AA). El dark mode no cambió. Esto arregla automáticamente decenas de componentes que usan `text-muted-foreground` para metadata, precios secundarios, eyebrows, etc.

### 3. Reducir clicks · sidebar → carros
**Archivos:** `src/components/dashboard/sidebar/DiscoverySidebar.tsx` y la sidebar inline en `DashboardClient.tsx`

Antes: click en una familia del sidebar solo **scrolleaba** el feed central, después tocaba clicar en la family card del feed para llegar a los carros (3 clicks total).
Ahora: el click navega directamente a `/cars/<brand>?family=<slug>`, brincando el paso intermedio. **1 click**.

### 4. Watchlist · feature completo

**Archivos creados:**
- `src/hooks/useWatchlist.ts` — hook con `add/remove/toggle/has/clear`, persistencia en localStorage, sync cross-tab (10 tests unitarios pasando)
- `src/components/cars/WatchButton.tsx` — botón corazón overlay (Heritage Lavender fill cuando watched)
- `src/components/dashboard/sidebar/WatchlistSidebarSection.tsx` — lista de items con foto + brand/model + precio + plataforma. Hover muestra X para quitar. Footer con "Clear all" cuando hay >1 item.

**Archivos modificados:**
- `CarFeedCard.tsx`, `CarCard.tsx`, `AuctionCard.tsx` — todos llevan WatchButton arriba a la derecha
- `DashboardClient.tsx`, `MakePageClient.tsx`, `DiscoverySidebar.tsx` (3 sidebars) — sección inferior con **tabs Live | Watchlist**, default Live siempre (para que un usuario nuevo no entre a una sección vacía)

Persistencia: `localStorage` con key `monza:watchlist:v1`. Snapshot mínimo por item: `{ id, brand, model, year, priceUsd, image, platform, href, addedAt }`.

### 5. Panel derecho de `/cars/<make>` — rediseñado para conversión de Report
**Archivo:** `src/components/makePage/context/CarContextPanel.tsx`

El panel era un "spec sheet" repetitivo (mileage, color, platform — info ya visible en la card). Lo reescribí como **investment intelligence**:

1. **Investment Intelligence** — título + thesis (line-clamp 4)
2. **Position vs Market** — asking price grande + `MarketDeltaPill` inline, Fair Value range como contextual footer
3. **Signals** — chips derivados (`Low miles`, `High miles`, `Ending soon`, `No bids yet`, `Active bidding`, categoría). Solo aparecen los que la data sustenta — no inventamos chips.
4. **Recent sales** — hasta 3 closed comps del mismo series (filtrado de `regionFilteredCars` por `status === "ENDED"`). Cada uno linkea a su report. Empty state branded cuando no hay comps.
5. **What's inside the Report** — 4 bullets concretos con lock icon en lavender. CTA `Unlock for 100 pistons` (usa `REPORT_PISTON_COST`).

Removidos: bloques Specifications y Listing Source (redundantes con la card del feed), botón "Ask Advisor" (el `AdvisorFab` global ya cubre esa entrada — tener 3 entradas en la misma viewport era ruido).

### 6. Bug fix · scroll del home
**Archivo:** `src/components/dashboard/DashboardClient.tsx`

Bug preexistente: el wrapper del 3-column usaba `min-h-[100dvh]` (mínimo, no fijo), así que cuando el feed central crecía con FamilyCards el body entero scrolleaba. Cambié a `h-[100dvh]` — ahora cada columna scrollea internamente y el body se queda quieto.

Métricas antes/después (en DOM real, viewport 1480×823):
```
body scrollHeight:  15,661px → 872px
grid height:        15,532px → 743px
sidebar height:     15,532px → 743px
```

### 7. Email template branded — `docs/email-templates/magic-link.html`

Lo que recibe el usuario en su inbox. Listo para pegar en Supabase.

- Wordmark MonzaHaus arriba — **replica exacta** de `MonzaHausWordmark.tsx` (Saira 600 + helmet SVG `lavender-deep` 17px × 17px = `0.78em × 0.79em` del wordmark a 22px). Construido como tabla 3-cells (M | helmet | NZAHAUS) para que Outlook lo renderice idéntico a Gmail / Apple Mail / iOS Mail.
- Card blanco sobre fondo cream con sombra sutil
- Icono Mail en círculo Lavender Veil
- Título "Sign in to MonzaHaus" en Cormorant
- CTA Lavender Deep `#D6BEDC` con texto Lavender Ink Deep `#3F2A47`
- Link de fallback en monospace
- Footer con tagline (sin repetir "MonzaHaus" sin casco — la regla del manual)
- Mobile responsive (media query @600px)

---

## Lo que necesito que hagas tú, Cami

### A. Subir el email a Supabase

1. Abre `https://supabase.com/dashboard/project/<tu-proyecto>/auth/templates`
2. Selecciona la plantilla **"Magic Link"**
3. Reemplaza todo el HTML del editor por el contenido de `docs/email-templates/magic-link.html`
4. Verifica que las variables `{{ .ConfirmationURL }}` y `{{ .SiteURL }}` existan tal cual — Supabase las inyecta cuando envía
5. Guarda y manda un magic link de prueba a tu correo personal para validar visualmente

Si quieres traducir el copy del email (`"Sign in to MonzaHaus"`, `"Tap the button below..."`, etc.), Supabase soporta plantillas por locale — pero eso ya es ajuste tuyo, no rompe nada del frontend si lo dejas solo en inglés.

### B. (Opcional, no urgente) Watchlist persistente cross-device

Hoy el watchlist vive en `localStorage` del browser del usuario. Si abren la app en otro dispositivo no la ven. Si limpian cache, se pierde.

Cuando quieras hacerla persistente (probablemente cuando tengamos suscriptores Salon), esto es lo que necesitarías:

```sql
create table user_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null,
  -- snapshot at time of add (so it renders even if the listing
  -- gets delisted)
  brand text not null,
  model text not null,
  year int,
  price_usd int,
  image text,
  platform text,
  href text not null,
  added_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

alter table user_watchlist enable row level security;

create policy "users read own watchlist" on user_watchlist
  for select using (auth.uid() = user_id);
create policy "users insert into own watchlist" on user_watchlist
  for insert with check (auth.uid() = user_id);
create policy "users delete from own watchlist" on user_watchlist
  for delete using (auth.uid() = user_id);
```

Endpoints sugeridos:
- `GET    /api/watchlist` → lista del usuario
- `POST   /api/watchlist` con body `{ id, brand, model, year, priceUsd, image, platform, href }` → add
- `DELETE /api/watchlist/:id` → remove

Cuando esté listo, yo cambio el hook `useWatchlist.ts` para que haga fetch a esos endpoints en vez de leer/escribir localStorage. La API del hook (`add/remove/toggle/has`) queda igual, así que ningún componente cambia.

### C. (Opcional) Recent sales con más data

El panel derecho del `/cars/<make>?family=<id>` muestra hasta 3 closed comps del mismo series. Lo deriva de `regionFilteredCars` filtrando por `status === "ENDED"`. Hoy, si la data en vivo no tiene cars en `ENDED` del 992 (caso que verificamos), muestra un empty state.

Si quieres que ese bloque siempre tenga comps, hay que asegurar que el feed `auctions` que llega al cliente incluya un buffer de listings cerrados del series — quizá los últimos 30-50 cerrados de cada series, en vez de solo activos. Eso lo decides tú según el shape de datos en `dbSoldHistory` / `dbComparables`.

---

## Out of scope (per Edgar, deferido para otra iteración)

- **Landing tipo Elferspot** para MonzaHaus (hero + tabs: search / sell / magazin / events / members)

---

## Cómo revisar mi trabajo

```bash
git checkout feedback-amigo-cami
npm run dev
# open http://localhost:3000/en
```

### Flujo sugerido (10 min)

1. **Home `/en`** — sidebar izquierda con brands. Click en `Porsche` → se expande la lista de familias. Click `992` → te lleva **directo** a `/cars/porsche?family=992` (antes había paso intermedio).
2. **Sidebar bottom (en home y en `/cars`)** — pestañas `Live | Watchlist`. Live es default. Tap en cualquier corazón ❤ de una card → cuenta sube en Watchlist y aparece ahí.
3. **`/en/cars/porsche?family=992`** — sidebar derecha: Investment Intelligence + Position vs Market + Signals + Recent sales + Locked report bullets + CTA "Unlock for 100 pistons".
4. **Light mode** — checa cualquier metadata gris. Debe verse crisp, no washed-out.
5. **Auth modal** (botón "Sign in" arriba a la derecha) → escribe un email cualquiera → "Send Magic Link" → verás la nueva pantalla. Prueba "Resend email" (entra en cooldown 30s) y "Try a different email" (resetea).
6. **`docs/email-templates/magic-link.html`** — abre directo en browser para ver cómo queda el correo.
7. **`/es` y `/en`** — verifica que las traducciones rinden en ambos locales.

---

## Archivos en este branch

```
docs/superpowers/plans/2026-05-16-feedback-amigo-cami.md  ← plan original
docs/handoff-cami-feedback.md                             ← este archivo
docs/email-templates/magic-link.html                      ← para pegar en Supabase

src/hooks/useWatchlist.ts                                 ← hook + 10 tests
src/hooks/useWatchlist.test.ts
src/components/cars/WatchButton.tsx
src/components/dashboard/sidebar/WatchlistSidebarSection.tsx

src/components/auth/AuthModal.tsx                         ← magic link screen
src/components/dashboard/DashboardClient.tsx              ← scroll fix + tabs
src/app/[locale]/cars/[make]/MakePageClient.tsx           ← tabs + sibling cars
src/components/dashboard/sidebar/DiscoverySidebar.tsx     ← tabs + nav directa
src/components/makePage/context/CarContextPanel.tsx       ← rediseño completo
src/components/makePage/CarFeedCard.tsx                   ← WatchButton
src/components/makePage/CarCard.tsx                       ← WatchButton
src/components/auction/AuctionCard.tsx                    ← WatchButton

src/app/globals.css                                       ← fix contraste

messages/en.json, es.json, de.json, ja.json               ← keys auth + watchlist
```

Cualquier cosa que rompa, dime. Un abrazo.

— Edgar
