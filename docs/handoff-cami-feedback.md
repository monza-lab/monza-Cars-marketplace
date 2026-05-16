# Handoff — Feedback Amigo Cami → Cami

**Branch:** `feedback-amigo-cami`
**Fecha:** 2026-05-16
**De:** Edgar (frontend) → Cami (backend)
**Resumen:** 4 cambios de UI/UX completos en frontend. 1 template de email listo para que lo pegues en Supabase. 0 cambios en API/DB.

---

## Lo que pidió el amigo de Cami (video transcrito)

5 puntos de feedback. **4 ya están resueltos en frontend**, **1 queda para ti**:

| # | Punto | Status |
|---|---|---|
| 1 | Contraste de letras (gris muy parecido al blanco en light mode) | ✅ Resuelto (frontend) |
| 2 | Muchos clicks para llegar de la familia a los carros | ✅ Resuelto (frontend) |
| 3 | Watchlist — guardar carros como favoritos | ✅ Resuelto (frontend, localStorage) |
| 4 | Landing tipo Elferspot para MonzaHaus | ❌ Fuera de scope — Edgar lo dejó para otra iteración |
| 5 | Magic link "no se ve bien" — pantalla de confirmación + email | ✅ Pantalla en frontend · ⚠️ **Email lo subes tú** (template adjunto) |

---

## Qué hice en frontend (5 commits en esta rama)

### Commit 1 — `feat(auth): redesign magic link confirmation screen`
**Archivo principal:** `src/components/auth/AuthModal.tsx`

La pantalla **dentro de la app** que aparece después de pedir el magic link estaba en inglés hardcodeado y se veía como un toast tímido. Ahora:

- Icono Mail dentro de un círculo Heritage Lavender (anchor visual)
- Título "Check your inbox" en Cormorant (display)
- Email del usuario destacado en su propia línea
- Hint amistoso: "Suele llegar en menos de un minuto. No olvides revisar spam."
- Botón "Reenviar correo" **siempre visible** (antes solo en signup) con cooldown de 30s
- Link nuevo "Probar con otro correo" que resetea el form
- Todo traducido en `en/es/de/ja` (6 keys nuevas por locale)

### Commit 2 — `fix(theme): bump light-mode muted-foreground for WCAG AA`
**Archivo:** `src/app/globals.css`

Cambié `--muted-foreground` en `:root` de `#9A8E88` (~2.8:1 sobre cream — FALLA WCAG AA) a `#6B6365` (~5.4:1 — pasa AA). El dark mode no cambió. Esto arregla automáticamente decenas de componentes que usan `text-muted-foreground` para metadata, precios secundarios, eyebrows, etc.

### Commit 3 — `ux(sidebar): family click navigates straight to cars view`
**Archivo:** `src/components/dashboard/sidebar/DiscoverySidebar.tsx`

Antes: click en una familia del sidebar solo **scrolleaba** el feed central, después tocaba clicar en la family card del feed para llegar a los carros (3 clicks total). Ahora: el click navega directamente a `/cars/<brand>?family=<id>`, brincando el paso intermedio (1 click). Conserva el callback `onSelectFamily` opcional por compat.

### Commit 4 — `feat(watchlist): localStorage watchlist with sidebar tab`
**Archivos creados:**
- `src/hooks/useWatchlist.ts` — hook con `add/remove/toggle/has/clear`, persistencia en localStorage, sync cross-tab (10 tests unitarios pasando)
- `src/components/cars/WatchButton.tsx` — botón corazón overlay con Heritage Lavender fill cuando watched
- `src/components/dashboard/sidebar/WatchlistSidebarSection.tsx` — lista de watchlist items en sidebar con thumbnail + brand/model + precio + plataforma. Hover muestra X para quitar. Footer con "Clear all" cuando hay >1 item

**Archivos modificados:**
- `DiscoverySidebar.tsx` — la sección de abajo ahora tiene tabs **Watchlist** / **Live**. Default tab: Watchlist si el usuario tiene items, Live si no
- `CarFeedCard.tsx`, `CarCard.tsx`, `AuctionCard.tsx` — todos llevan WatchButton arriba a la derecha

**Decisión de scope:** watchlist guarda metadata en localStorage (no requiere backend). Si en algún momento quieres sync cross-device, hay una sección abajo con qué endpoints crearías.

### Commit 5 — `docs: handoff for feedback-amigo-cami branch` (este archivo)

---

## Lo que necesito que hagas tú, Cami

### A. Email del magic link en Supabase

El **correo** que llega al inbox del usuario está hosteado por Supabase Auth — no lo tengo en este repo, así que no lo pude tocar. Te dejé un template HTML completo, brand-aligned, listo para pegar:

**Archivo:** `docs/email-templates/magic-link.html`

Cómo subirlo:

1. Abre `https://supabase.com/dashboard/project/<tu-proyecto>/auth/templates`
2. Selecciona la plantilla **"Magic Link"**
3. Reemplaza todo el HTML del editor por el contenido de `docs/email-templates/magic-link.html`
4. Verifica que las variables `{{ .ConfirmationURL }}` y `{{ .SiteURL }}` existan tal cual en el template — Supabase las inyecta cuando envía
5. Guarda y manda un magic link de prueba a tu correo personal para validar visualmente

**Lo que diseñé**:
- Wordmark MonzaHaus arriba (Saira 600 + casco oficial SVG inline)
- Card blanco sobre fondo cream con sombra sutil
- Icono Mail en círculo Lavender Veil
- Título "Sign in to MonzaHaus" en Cormorant
- CTA Lavender Deep `#D6BEDC` con texto Lavender Ink Deep
- Link de fallback en monospace
- Footer con wordmark + disclaimer "didn't request this"
- Compatible con Outlook (VML fallback para el botón), Gmail, Apple Mail, iOS Mail, Android Gmail
- Mobile responsive (media query @600px)
- Fuentes Google Fonts (Cormorant, Karla, Saira) con fallback system fonts si el cliente no las carga

Si quieres traducir el copy del email (`"Sign in to MonzaHaus"`, `"Tap the button below..."`, etc.), Supabase soporta plantillas por locale — pero eso ya es ajuste tuyo, no rompe nada del frontend si lo dejas solo en inglés.

### B. (Opcional, no urgente) — Watchlist persistente cross-device

Hoy el watchlist vive en `localStorage` del browser del usuario. Si abren la app en otro dispositivo, no la ven. Si limpian cache, se pierde.

Cuando quieras hacerla persistente (probablemente cuando tengamos suscriptores Salon), esto es lo que necesitarías:

```sql
-- Migration
create table user_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null,
  -- metadata snapshot at time of add (so it renders even if the listing
  -- gets delisted or removed from the live feed)
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

-- RLS
alter table user_watchlist enable row level security;

create policy "users read own watchlist" on user_watchlist
  for select using (auth.uid() = user_id);

create policy "users insert into own watchlist" on user_watchlist
  for insert with check (auth.uid() = user_id);

create policy "users delete from own watchlist" on user_watchlist
  for delete using (auth.uid() = user_id);
```

Endpoints sugeridos (estilo REST o como prefieras):

- `GET    /api/watchlist` → lista del usuario
- `POST   /api/watchlist` con body `{ id, brand, model, year, priceUsd, image, platform, href }` → add
- `DELETE /api/watchlist/:id` → remove

Cuando esté listo, yo cambio el hook `useWatchlist.ts` para hacer fetch a esos endpoints en vez de leer/escribir localStorage. La API del hook (`add/remove/toggle/has`) queda igual, así que ningún componente de UI cambia.

### C. (Opcional) — Reducir contraste de algunos otros lugares

El cambio de `--muted-foreground` cubre la gran mayoría de lugares con texto débil, pero hay algunos lugares con `color: "#9A8E88"` **inline** que dejé sin tocar porque son admin tools o templates de redes sociales (`src/app/[locale]/admin/social/*`, `src/features/social-engine/templates/*`). Si quieres limpiar también esos, dime y los barro en otro PR.

---

## Cómo probar mi trabajo

```bash
git checkout feedback-amigo-cami
npm run dev
```

Abre `http://localhost:3000/en` y prueba este flujo:

1. **Watchlist** — clic en el corazón de cualquier card de carro. Mira que se llene en lavender. Anda al sidebar izquierdo, abajo: la tab "Watchlist" debería estar activa con tu carro. Recarga la página: el carro sigue ahí (localStorage).
2. **Reducir clicks** — desde `/en` (dashboard), expande Porsche en el sidebar y click en `992`. Te debe llevar directo a `/en/cars/porsche?family=992` sin pasar por la pantalla intermedia.
3. **Contraste** — fíjate en cualquier metadata gris (precios secundarios, eyebrows, año/kilometraje). Debe leerse claro y crisp, no washed-out.
4. **Magic link screen** — abre el modal de login (botón arriba a la derecha o `/account`), escribe un email cualquiera y dale "Send Magic Link". Vas a ver la pantalla nueva. Prueba el botón "Resend email" (debe entrar en cooldown 30s) y "Try a different email" (debe resetear). Cambia a `/es` y repite — los strings se traducen.
5. **Email** — abre `docs/email-templates/magic-link.html` directamente en el navegador para ver cómo queda el correo.

---

## Cosas que NO toqué (frontend-only, como acordamos)

- API routes (`src/app/api/*`)
- Schema/migrations
- Configuración de Supabase
- AI pipeline (Gemini/RunPod)
- Scrapers
- Cualquier cosa de backend, devops, infra

Todo lo que ves en el diff de la rama es UI/UX puro.

---

## Resumen de archivos en este branch

```
docs/superpowers/plans/2026-05-16-feedback-amigo-cami.md   ← Plan completo del trabajo
docs/handoff-cami-feedback.md                              ← Este archivo
docs/email-templates/magic-link.html                       ← Template para que pegues en Supabase

src/hooks/useWatchlist.ts                                  ← Hook nuevo + 10 tests
src/hooks/useWatchlist.test.ts

src/components/cars/WatchButton.tsx                        ← Botón corazón nuevo
src/components/dashboard/sidebar/WatchlistSidebarSection.tsx  ← Sección sidebar nueva

src/components/auth/AuthModal.tsx                          ← Pantalla magic link rediseñada
src/components/dashboard/sidebar/DiscoverySidebar.tsx      ← Tabs + nav directa
src/components/makePage/CarFeedCard.tsx                    ← WatchButton añadido
src/components/makePage/CarCard.tsx                        ← WatchButton añadido
src/components/auction/AuctionCard.tsx                     ← WatchButton añadido
src/app/globals.css                                        ← Fix contraste

messages/en.json, es.json, de.json, ja.json                ← Nuevas keys auth + watchlist
```

Cualquier cosa, me cuentas. Un abrazo.

— Edgar
