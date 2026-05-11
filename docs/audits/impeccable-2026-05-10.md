# Auditoría Impeccable · MonzaHaus front-end

**Fecha:** 2026-05-10
**Branch:** `mobile-first-v1`
**Alcance:** front-end únicamente — no se modifica lógica, contratos de API ni schema.
**Metodología:** captura visual desktop (1280×800) en 11 rutas core + audit de código por anti-patterns Impeccable v2.1 + brand doctrine MonzaHaus v2.1 + skill `monzahaus-monetization` (Pistons doctrine) + skill `monzahaus-growth` (Haus Index programático).

> Mobile real (390×844) no fue capturable por límite del SO — el browser extension no resiziea bajo 1280px en macOS. La auditoría mobile se hizo via componentes shared con `md:hidden` y `MobileBottomNav` / `MobileCarCTA`.

---

## TL;DR — qué hay que hacer

**9 P0** (rompen funnel, branding, o promesa al user). Los 3 que más duelen:
1. **Cards de car son `<div role="link">`** — mata el Haus Index programático (SEO + crawlers no siguen). Skill `monzahaus-growth` lo identifica como *"la máquina de CAC→0"*.
2. **AI iconography leaks**: `Sparkles` en `WhatsRemarkableBlock.tsx`, `Brain` en `AnalysisReport.tsx` — contradicen memoria `feedback-no-ai-iconography.md`.
3. **Ruta `/ferrari` resuelve** — Porsche-only doctrine roto.

Más 5 P1 y 3 P2. Todos son fix-only, sin tocar lógica.

---

## P0 — Críticos

### P0.1 — Cards de car NO son anchors

**Síntoma:** En `/browse`, `/`, etc. las cards son `<div role="link" tabindex="0">` con `onClick`, no `<a href="...">`.

**Por qué duele:**
- 🔴 Cmd/Ctrl+Click no abre en nueva pestaña → fricción para el dealer que compara múltiples carros
- 🔴 Crawlers de Google **no siguen** la "navegación" → el Haus Index programático (skill growth: target 2,000+ URLs en m12) no será indexable
- 🔴 Right-click "Copy link", middle-click → no funcionan
- 🔴 Screen readers leen "link" sin URL

**Archivos:**
- `src/components/browse/BrowseCard.tsx:105`
- `src/components/dashboard/DashboardClient.tsx:1096`
- `src/components/makePage/mobile/MobileMakeLiveAuctions.tsx:91`

**Fix:** envolver el card en `<Link href={...}>` (next-intl), mantener `role="link"`/`tabindex` removidos. La lógica de click handler la maneja Next.js Link nativamente.

### P0.2 — AI iconography aún presente

**Síntoma:** Memoria `feedback-no-ai-iconography.md` dice CERO `Sparkles`/`Wand2`/`Bot`/`Brain`. Quedan 2 leaks reales:

| Archivo | Línea | Icon |
|---|---|---|
| `src/components/report/WhatsRemarkableBlock.tsx` | 3, 54 | `Sparkles` |
| `src/components/analysis/AnalysisReport.tsx` | 6, 244 | `Brain` |

**Por qué duele:** estos son componentes de **report** y **analysis** — exactamente donde la marca quiere transmitir criterio editorial, no "AI tool". El user paga 100 Pistons por un report y ve un Sparkle.

**Fix:** reemplazar con `Piston` (custom) o `Scale` para el bloque de "remarkable", `ShieldCheck` o `Award` para analysis. Patrón ya validado en `AdvisorBand.tsx`.

### P0.3 — Border-left > 1px (Impeccable BAN 1)

**Síntoma:** 10 instancias del banned pattern `border-l-2 border-l-primary` (o `/20`, `/30`).

| Archivo | Líneas | Contexto |
|---|---|---|
| `src/app/[locale]/cars/[make]/MakePageClient.tsx` | 955, 956, 996, 997 | Active state de chips en sidebar |
| `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx` | 127, 164, 1256, 1640 | Cards de "Why buy", "Market depth", quotes |
| `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` | 1731 | Quote/insight block |
| `src/app/[locale]/auctions/[id]/AuctionDetailClient.tsx` | 591 | Quote/insight block |

**Por qué duele:** *"the single most overused 'design touch'... never looks intentional regardless of color, radius, opacity"* (Impeccable v2.1). Esos `border-l-2 border-primary/20` son el cliché admin-dashboard SaaS — exactamente lo opuesto al Salon test.

**Fix por caso:**
- **Sidebar active state** (`MakePageClient`): reemplazar con background tint + tracking-wide bold (no stripe)
- **Cards "Why buy" / quote blocks**: dejar el border completo (1px todo alrededor) y usar background tint + eyebrow lavender para señalar importancia, sin la stripe lateral
- **Insight quotes**: text-treatment serif (Cormorant italic, lavender ink) sin container — lo más editorial

### P0.4 — Gradient text (Impeccable BAN 2)

**Síntoma:** 8 instancias de `bg-gradient-to-r from-primary... bg-clip-text text-transparent` (gradient text).

| Archivo | Línea | Qué está gradient |
|---|---|---|
| `src/components/auction/PriceChart.tsx` | 71 | Price tooltip number |
| `src/components/analysis/ComparableSales.tsx` | 130 | Bold price stat |
| `src/components/analysis/AnalysisReport.tsx` | 245, 273, 277 | Bold spans + 3xl numbers |
| `src/components/analysis/OwnershipCosts.tsx` | 62, 222 | Cost numbers |
| `src/features/social-engine/styles/brand-tokens.css` | 320–321 | CSS class |

**Por qué duele:** gradient text es el AI tell #2 (#1 son los border stripes). En componentes de **report** + **analysis**, es exactamente donde la marca debe sentirse editorial, no "ChatGPT-output". Los números que importan (price, cost) son los que peor lucen con gradient — el ojo lee el gradient como inestabilidad de valor.

**Fix:** `text-primary` o `text-foreground` con `font-display` (Cormorant 500) y `tabular-nums`. Si quieres énfasis: tamaño + peso, no gradient.

### P0.5 — Ruta `/ferrari` resuelve (Porsche-only doctrine)

**Síntoma:** `src/app/[locale]/ferrari/page.tsx` existe, hace queries a Supabase listings y renderiza data de Ferrari. Cualquier usuario puede entrar a `/en/ferrari` y ver "MonzaHaus mostrando Ferraris" — directo opuesto al posicionamiento "Porsche-only" del skill `monzahaus-growth`.

**Adicional:** `src/components/layout/Sidebar.tsx:91` lista `"Ferrari"` en algún array de marcas.

**Fix:**
- Mover `src/app/[locale]/ferrari/page.tsx` a `src/app/[locale]/admin/ferrari/page.tsx` si era para inspección interna; o **eliminar la ruta**
- Remover "Ferrari" del array en `Sidebar.tsx:91`
- Si era data legacy, dejar el endpoint Supabase pero no exponerlo en UI

### P0.6 — `/account` está roto (redirect a `/indices`)

**Síntoma:** Click en "Billing & history" del Menu va a `/en/account` pero termina en `/indices`. La página existe (`src/app/[locale]/account/page.tsx`), tiene branch `useAuth` → muestra `AuthRequiredPrompt` si no auth, `BillingDashboard` si auth.

**Hipótesis del bug:**
- Middleware o redirect en `next.config` desvía
- O el AuthProvider no termina de hidratar y un effect dispara router.push a `/indices`
- O el `loading.tsx` de `/account` tiene un fallback erróneo

**Fix:** investigar en orden: `src/middleware.ts` → `src/app/[locale]/account/loading.tsx` → `AuthProvider`. Probable que sea 1 línea.

### P0.7 — `/cars/porsche` muestra "No models found" en cold load

**Síntoma:** Navegación directa a `/en/cars/porsche` muestra empty state "No models found / Try adjusting your filters / [Clear All Filters]". El user que llega via Menu › Discover › "Porsche collection" cae en esto sin entender qué filtros tiene aplicados.

**Hipótesis:** persistencia de filtros en localStorage (probablemente del último `/browse` filter) sin reset al navegar fresh a la página.

**Fix:** dos opciones:
- **A**: la página resetea filtros en mount si la URL no trae query params
- **B**: el empty state explica qué filtros hay activos, no solo "Clear All Filters" genérico (*"Mostrando solo Live · region UK · 200K+ — clear filters →"*)

Recomendación: A + B (defensa en profundidad).

### P0.8 — Imágenes de cards no cargan visualmente

**Síntoma:** En `/`, `/browse` y otras vistas Classic, las cards renderizan estructura (título, price, mileage, badge `BaT`/`AS24`/`AT`) pero la **foto del carro no aparece** — solo el background oscuro del card.

**Hipótesis:**
- Lazy loading que no dispara (intersection observer mal configurado)
- 404 de las URLs de imagen del backend
- `<img>` con `src` vacío o con CSS `opacity:0` en cierto theme
- Backend de scrapers no devuelve `photo_url`

**Investigar:** abrir DevTools › Network en `/browse` y ver si las imágenes 404, o si nunca se piden. Si 404 → es backend (fuera de scope de "solo front"). Si no se piden → bug de front (Intersection Observer, srcset, lazyload).

**Fix mínimo (front-only):** si el backend devuelve null en `photo_url`, el card debería mostrar un **fallback editorial** (silueta del helmet glyph + "no photo" en stone) en lugar de un cuadro vacío.

### P0.9 — Brand leak: "Monza Lab" en lugar de "MonzaHaus"

**Síntoma:** 10+ archivos con metadata title/description usando "Monza Lab":

| Archivo | Línea | String |
|---|---|---|
| `src/app/not-found.tsx` | 61 | `"Monza Lab · Investment-Grade Automotive Assets"` |
| `src/app/[locale]/error.tsx` | 71 | igual |
| `src/app/[locale]/not-found.tsx` | 61 | igual |
| `src/app/[locale]/search-history/page.tsx` | 14 | `title: \`${t("title")} | Monza Lab\`` |
| `src/app/[locale]/cars/[make]/models/[model]/page.tsx` | 30 | `title: "Not Found | Monza Lab"` |
| `src/app/[locale]/cars/[make]/[id]/report/page.tsx` | 44, 47 | `"Investment Dossier: ${car.title} | Monza Lab"` |
| `src/app/[locale]/browse/page.tsx` | 18, 20 | `title + description` con "Monza Lab" |
| `src/app/[locale]/auctions/[id]/page.tsx` | 29 | igual |

**Por qué duele:** MonzaHaus es marca **separada** de Monza Lab (skill `monzahaus-branding` lo enfatiza). El tab title de `/browse` literalmente dice "Browse Collection | Monza Lab" — dilución de marca al primer click.

**Fix:** find/replace `Monza Lab` → `MonzaHaus` en los 10 archivos. Validar que no haya copy *user-facing* en español que también use "Monza Lab".

---

## P1 — Visibles, fix necesario

### P1.1 — 434 marcadores `[HARDCODED]` / TODO / FIXME

**Síntoma:** 434 instancias en `src/**/*.tsx` de strings hardcoded en JSX en lugar de `t("...")`. Esto significa que las locales `de/es/ja` no están 100% cubiertas — la app falla la promesa de i18n.

**Fix:** dividir en 3 oleadas (más urgente → menos):
- **Oleada 1 (user-facing en home + advisor + pricing + checkout)**: ~80 strings. Hacer estos primero.
- **Oleada 2 (cars/{id}, report, knowledge)**: ~150 strings
- **Oleada 3 (admin, error, legal)**: el resto

Tarea independiente, no bloquea fixes P0.

### P1.2 — Pricing cards iguales (identical card grid)

**Síntoma:** `/pricing` tiene 3 cards Jerrycan / Fuel Cell / Rennsport con mismo width, mismo padding, mismo orden de info. Impeccable: *"DO NOT use identical card grids"*.

**Por qué la regla aplica:** la idea es que el ojo distinga inmediatamente cuál es el target real (Monthly = Rennsport en doctrina monetization). Hoy se distingue solo por el badge "LEGACY UNLIMITED" — no es suficiente.

**Fix:** elevar visualmente Rennsport (el target):
- Card Rennsport con noir más intenso + lavender accent border 1px todo alrededor (NO stripe)
- "Most popular" eyebrow encima (no badge tipo "LEGACY UNLIMITED" que confunde — eso solo lo ve usuario que YA tiene el plan)
- 2 columnas en desktop con Rennsport ocupando ancho completo arriba o lado a lado más prominente

### P1.3 — Modal/Dialog overuse (31 usages)

**Síntoma:** 31 instancias de `<Dialog>` o `<AlertDialog>`. Skill: *"Modals are lazy. Use sheets/pages when possible."*

**Fix:** revisar caso por caso. Candidatos a migrar a sheet/page:
- `OutOfReportsModal.tsx` → page-level banner o sheet desde abajo en mobile
- `OnboardingModal.tsx` → step-by-step page (`/onboarding`)
- `PistonsWalletModal.tsx` → keep (modal aceptable para "ver mi wallet rápido")

No bloquea — refinement progresivo.

### P1.4 — focus-visible coverage parcial

**Síntoma:** solo 8 instancias de `focus-visible:` en `src/components/ui/`. Los componentes custom (cards, chips, buttons custom) probablemente no tienen focus rings.

**Fix:** auditar `Button`, `BrowseCard`, `FamilyCard`, header pills (`Pistons pill`, `Advisor pill`, `Account button`) y agregar `focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background`. ~20 componentes afectados.

### P1.5 — Tab title inconsistente entre locale prefix y home

**Síntoma:**
- `/` → "MonzaHaus | Collector Car Market Intelligence..."
- `/en/browse` → "Browse Collection | Monza Lab" (← brand leak P0.9)
- `/en/account` (cuando funcione) → debería ser "Account | MonzaHaus"

**Fix:** parte del find/replace P0.9, más auditar `generateMetadata` en cada `page.tsx` para que `title` use el patrón `[Page] | MonzaHaus` consistente.

---

## P2 — Refinement

### P2.1 — `/knowledge` muestra solo 1 guide visible

`/en/knowledge` solo lista "Porsche IMS Bearing — Complete Guide for M96/M97 Owners" en sección Reliability. Catálogo thin. Skill `monzahaus-growth` dice *"40-80 piezas/mes pero sólo amplificar las 15-20 que convierten"* — para el visible catalog en /knowledge, mostrar al menos 5-10 guides desde día 1 (Authentication, Import, Generation comparison, etc.) aunque sean stubs.

### P2.2 — Eyebrow "300 FREE PISTONS EVERY MONTH" en uppercase grita

En `/pricing`, el eyebrow en uppercase + tracking ancho está bien, pero "300 FREE PISTONS EVERY MONTH" se siente un poco *Hagerty Drivers Club ad*. Probar:
- "300 free Pistons every month" (sentence case con tracking)
- O mover el "300 free" al hero subtitle y dejar el eyebrow factual: "PRICING · MONZAHAUS"

### P2.3 — Search bar typing animation puede confundir

El header search tiene un typed placeholder que rota frases ("Search 992 GT3 RS...", "What's a 1995 Porsche 993 worth?"). En captures lo vi tipear "Sea|", "Wh|", "Search 992 GT3 RS,|" — al primer vistazo el user puede creer que hay alguien escribiendo.

**Fix:** mantener la animación pero pausar 4-5s (no 2s) entre frases para que el user procese. Y considerar bajar la velocidad de typing ~30ms (ahora 25-55ms se siente acelerado).

---

## Lo que está bien — no romper

- ✅ **Editorial typography** consistente en `/knowledge`, `/buy/porsche`, `/pricing`, `/tools/vin-decoder`, `/get-started`, `/indices`. Cormorant grande + Karla body funciona como debe.
- ✅ **`/advisor` empty state** con suggestion chips ("Compare top 3 997.2 GT3s", "993 inspection checklist", etc.) + helmet glyph como avatar — exactly el aura editorial deseada.
- ✅ **Header route-aware** post commits `399ef6f` y `48fed68` — search respira, controles solo donde aplican, cero duplicación.
- ✅ **Heritage Lavender palette** aplicada consistente — `--lavender`, `--noir`, `--cream` tokens definidos en `globals.css`.
- ✅ **AdvisorBand contextual** — cross-breakpoint, prompt pre-poblado, conexión home→detail→report bien armada.
- ✅ **"MonzaHaus is intelligence, not a marketplace."** tesis line en `/browse` — copy editorial, distintivo, on-brand.
- ✅ **Anchor narrative correcto** en pricing: *"A PPI costs $400. A Porsche PPS, $250..."* (no anchor vs BidBetter, exactamente como dice skill `monzahaus-monetization`).
- ✅ **Honest-by-data**: el bug del fair-value 100% / risk 50 fabricado ya está fixed con null + "Awaiting comparable sales".

---

## Apéndice — orden sugerido de fixes

Fixes ordenados por **impacto / esfuerzo**:

1. **P0.9 — find/replace `Monza Lab` → `MonzaHaus`** (1 commit, 10 archivos, 30 min)
2. **P0.5 — eliminar `/ferrari` route + Sidebar reference** (1 commit, 2 archivos, 15 min)
3. **P0.2 — reemplazar `Sparkles` y `Brain` icons** (1 commit, 2 archivos, 30 min)
4. **P0.4 — quitar gradient text de números** (1 commit, 6 archivos, 1h — replace + revisar visual)
5. **P0.3 — refactor border-left a borde completo + bg tint** (1 commit, 4 archivos, ~2h — necesita review visual de cada caso)
6. **P0.1 — Cards `<div role="link">` → `<Link>`** (1 commit, 3 archivos, ~2h)
7. **P0.6 — investigar `/account` redirect** (1 commit, 30 min — encontrar la línea + fix)
8. **P0.7 — `/cars/porsche` empty state cold load** (1 commit, 1h)
9. **P0.8 — Imágenes de cards** (depende de root cause; si es front, 1h; si es backend, ya queda como issue marcado)
10. **P1 + P2** — 1 sprint adicional, no bloquea ningún P0

Total estimado P0: **~9-10 horas de fixes front-end pure**, sin tocar lógica.

Edgar, esto es lo que tienes hoy. Ningún fix de los 9 P0 cambia comportamiento del producto — todos son correcciones de doctrina, branding, accesibilidad o anti-patterns visuales. Si quieres, voy uno por uno y commit por separado con revisión visual cada vez.
