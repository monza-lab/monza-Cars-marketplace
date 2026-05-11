# Mobile-First v1 — Informe completo

**Branch:** `mobile-first-v1` (de `rebrand-v2.1-heritage-lavender`)
**Commits:** 10
**Files cambiados:** 75 (+2,055 / −1,525 líneas)
**Servidor local:** `http://localhost:3000` (corriendo en background)

---

## 1. Resumen ejecutivo

Mobile en MonzaHaus pasó de "sitio responsive con varios problemas" a una plataforma **data-first, mobile-native y honest-by-data**, alineada con la tesis "intelligence, not a marketplace".

**Tres principios aplicados durante toda la auditoría:**

1. **Honest-by-data.** Si un número no viene de DB / segment-stats / sold history, no se muestra. Mejor un campo vacío con `Awaiting comparable sales` que un `100%` mentiroso.
2. **Editorial Salon.** Cero iconografía estilo "AI tool" (Sparkles, Wand2). Cormorant para display, Karla para body, ornamentos editoriales (—, ·, →) en vez de iconos genéricos.
3. **Sin fricción.** Los flujos de conversión (signup, checkout, navegación) deben sentirse mobile-native: bottom-sheets con drag handle, sticky CTAs, 1-tap auth, magic link como default.

---

## 2. Lista de commits (orden cronológico)

| Hash | Tema |
|---|---|
| `3ce91cb` | Pase 1 — advisor mobile single-view, header limpio, bottom nav cleanup |
| `ec5f2b9` | Pase 2 — home data-first (tesis banner, family chips, cards honest, advisor band) |
| `c89de62` | Pase 3 — refinement Salon (quitar Sparkles, tesis compacto, theme toggle) |
| `f58a80d` | Pase 4 — auth/checkout/pricing/browse sin fricción |
| `0246f14` | Fix Market Position / Fair Value honest-by-data (detail pages) |
| `037535e` | Sweep hardcoded mobile (avgTrend, trend, market depth synthetic) |
| `df063d2` | Report client: pricePosition sin clamp, riskScore null-safe |
| `c10bf87` | Migrar VIN decoder + knowledge + indices amber → lavender + quitar TransactionHistory mock |
| `b88f556` | **Sweep masivo** amber/zinc legacy → Heritage Lavender (43 archivos) |
| `2a4192a` | Fix sed artifacts (double-slash classnames) |

---

## 3. Cambios por área

### 3.1 Home `/`

| Antes | Después |
|---|---|
| Region pills `[All][US][UK][EU][JP]` al top | Tesis banner: `INTELLIGENCE, NOT A MARKETPLACE · 16,382 tracked` (eyebrow editorial, 1 línea) |
| Hero con `+546%` MarketDeltaPill engañoso (priceMax vs median) | Hero limpio: solo `Porsche · 2016 911 · $6K – $420K` + `16,382 cars` real |
| `LIVE LISTINGS · 16382` rojo pulsante | `LATEST REPORTS · 16,382 tracked` sobrio |
| Cards apretadas (thumbnail 64×48) | Cards "Browse-style" honest-by-data: foto 112×112, **platform pill**, **Fair $X-$Y**, mileage, region, "View on {plat} ↗" cuando hay sourceUrl |
| Sin discovery rápido | **`DISCOVER BY FAMILY`** chips horizontales (911 Family, GT & Hypercars, Mid-Engine, Transaxle, Heritage, Gran Turismo) → linkean a `/cars/porsche?family=...` |
| Sin CTA al advisor | **Advisor band** cada 6 cards: eyebrow `ADVISOR` + Cormorant `Need an opinion?` + `Ask anything — from inspection to fair value` (cero Sparkles) |
| Top 8 cards | Top 16 + CTA `See all 16,382 reports →` al final |
| Header: `MONZAHAUS · Monza/Classic toggle · 🌐 · ☰` | Header: `MONZAHAUS · ☀ · ☰` (theme toggle visible, ViewToggle solo desktop) |

### 3.2 Advisor `/advisor`

- **Bug crítico arreglado**: `grid-cols-[260px_1fr]` hardcoded sin breakpoint hacía el chat inutilizable en mobile.
- Ahora `flex flex-col md:grid md:grid-cols-[260px_1fr]`: en mobile **una sola vista** (chat full-width), la lista de conversaciones es un **drawer animado** que se abre con el botón "≡ New chat" en el chat header.
- Mobile actions: Share/Archive como icon-only en el header del chat.
- Drag handle, focus management, safe-area-aware.

### 3.3 Auth modal `/auth`

- **Bottom sheet** en mobile (override Radix Dialog con `!important`), centered modal en desktop.
- **Reorden del flow**:
  1. **Google → 1 tap** (primary action prominente con Google brand colors)
  2. **Magic link → 2 taps** (email + "Continue with email") — flow default sin password
  3. **Password collapsible** ("Use password instead" toggle) — para los que prefieren password
- Estado dedicado tras enviar magic link: `Check your inbox · {email}` con resend option.
- Drag handle mobile, Cormorant `Welcome back` / `Join MonzaHaus`.

### 3.4 Pricing `/pricing`

- Hero compacto mobile: eyebrow `300 FREE PISTONS EVERY MONTH` + Cormorant `Due diligence for Porsche buyers`.
- **Anchor narrative del skill `monzahaus-monetization`** italic centrado: *"A PPI costs $400. A Porsche PPS, $250. Paying $59/mo to know if the deal is worth it is due diligence, not expense."*
- FAQ accordion (primer ítem abierto, resto collapse). Recupera ~600px verticales.
- Balance pill `Current balance · X Pistons` para auth users.
- `30-day money-back guarantee` trust signal al final.

### 3.5 Checkout modal

- Bottom sheet mobile + sticky footer con CTA.
- Eyebrow `CHECKOUT` + Cormorant nombre del plan (Rennsport / Fuel Cell / Jerrycan).
- `INCLUDED` box con primeras 5 features.
- Upsell automático Pack→Monthly con framing del skill: *"For just $30 more, Rennsport gives you unlimited reports + 10,000 Pistons monthly. Two Fuel Cells already cost more."*
- Total prominente Cormorant + **`Continue — $59/mo`** sticky bottom.
- Trust signals: `Stripe · Secure · 30-day refund · Cancel anytime`.
- `pb-[env(safe-area-inset-bottom)]` para notch iOS.

### 3.6 Cars `/cars/porsche`

- Cards horizontal scroll → vertical stack honest-by-data (12 cards).
- Header: `LATEST REPORTS · 15,117 tracked` (antes "LIVE LISTINGS · 15117" rojo pulsante).
- `POA – POA` → `Price on request` italic cuando priceMin/priceMax === 0.
- `View on BaT ↗` external link en cada card (con stop-propagation; click card → /report).
- Bug fix: `mileage === 0` ya no renderiza "0" literal (typeof guard).

### 3.7 Car detail `/cars/{make}/{id}`

- **Investment Passport mobile** rediseñado:
  - Cell 1 TREND: muestra `+X%` solo si hay history real; sino `Awaiting price history` italic.
  - Cell 2 MARKET POSITION: muestra gauge solo con banda fair real; sino `Pending comps`.
  - Cell 3 FAIR VALUE: muestra precio solo si `hasFairValue`; sino `Awaiting comparable sales` italic.
- Sección Market Position desktop: render condicional con mensaje "Fair value pending more comparable sales for this segment. The Advisor can pull deeper context on a specific listing."

### 3.8 Report `/cars/{make}/{id}/report`

**El bug que reportaste — "100% en todos los carros / 50 risk":**

- `pricePosition`: ya **no se clampea a 100**. Si el listing está sobre fair value (146% en el caso del 964 Jubiläumsmodell), el número se muestra real con tag amber `Above fair value`. Antes el cap a 100% mentía: usuario veía 100% verde y pensaba "está al máximo del rango fair", cuando estaba 46% **sobre** fair.
- `riskScore`: `null` cuando `hasSignals === false`. Antes default `50` se renderizaba como "Risk: 50/100" en cars sin signals extraídos. Ahora muestra `Generate the full report to see signal coverage`.
- Null safety en todos los usages PDF/CSV.

### 3.9 Browse Classic `/browse`

- Layout responsive: title + search + sort stack vertical en mobile (antes era flex horizontal hardcoded que se overflow).
- Quick filter chips horizontal scroll (overflow-x-auto no-scrollbar).

### 3.10 VIN Decoder, Knowledge, Indices

- Migración de **`amber-*` legacy → Heritage Lavender** (Decode VIN button, sample chips, eyebrows "MONZAHAUS KNOWLEDGE/INDEX", "FREE TOOL · MONZAHAUS").
- `zinc-*` raw colors → tokens semánticos (`background`, `foreground`, `muted-foreground`, `card`, `border`).

---

## 4. Hardcoded data eliminada

Trabajo sistemático en bloque para honrar la tesis "intelligence, not a marketplace".

### 4.1 Trend / brand-level

| Origen | Antes | Después |
|---|---|---|
| `DashboardClient.getBrandsForRegion` | `avgTrend: "Active Market"` | `avgTrend: ""` |
| `aggregation.getBrandsFromCars` | `"Premium/Strong/High/Growing Demand"` derivado de count | `""` (un count alto no es un trend de mercado) |
| `DashboardClient.getVariantStats` | `trend: "Stable"` | `trend: ""` |
| `supabaseLiveListings.computeTrend` | `trend: "Live Data"` cuando <2 history points | `trend: ""` |
| `MobileHeroBrand` / `MobileBrandRow` | `MarketDeltaPill priceUsd={brand.priceMax} medianUsd={brand.medianPriceUsd}` (producía `+546%` engañoso comparando techo del rango con la mediana) | Pill quitada del hero. El `MarketDeltaPill` queda solo para car-level donde sí compara una pieza vs su segment median. |

### 4.2 Market depth

| Origen | Antes | Después |
|---|---|---|
| `makePageHelpers.deriveModelDepth` | Inventaba `auctionsPerYear: max(count*4, 10)`, `avgDaysToSell: max(5, 30 - avgBids*0.5)`, `sellThroughRate: 75%`, `demandScore: max(3, …)` con floors hardcoded cuando no había history | Retorna `null` si `total === 0` o `ended < 2`. UI muestra `Awaiting completed sales to compute depth for this model`. |
| `GenerationContextPanel` | `Sell-Through Rate: 85 + count/3`, `Demand Score: count/2` (fórmulas que se leían como métricas reales) | Solo muestra `Active Listings` y `Avg. Price` (datos reales). Si no hay `recentSales`, mensaje *"Sell-through & demand score pending recent sales for this generation"*. |
| `makePageConstants.mockMarketDepth` | Constante con stats inventados por marca (Porsche: `340 auctions/year, 12d, 89%, 9/10`) | **Eliminado**. Real depth solo desde `deriveModelDepth`. |

### 4.3 Market Position / Fair Value

| Origen | Antes | Después |
|---|---|---|
| `regionPricing.buildRegionalFairValue(price)` | Fabricaba `low = price * 0.8, high = price * 1.2`. Hacía `fairMid === price` → todos los cars mostraban `pricePosition = 100%` | Devuelve `{low: 0, high: 0}`. Real fair viene solo de `enrichFairValues` (segment stats sold IQR / asking IQR). UI renderiza "—" si no hay band. |
| `CarDetailClient.pricePosition` (3 instancias) | Fallback `: 50` cuando `fairMid <= 0` (ese era el "50/100" que veías) | `: null`. UI muestra `Pending comps` o `Awaiting comparable sales` italic. |
| `ReportClient.pricePosition` | Cap a 100% (146% se renderizaba como 100% verde, mintiendo) | Sin cap. Si > 100, badge `Above fair value` amber visible. |
| `ReportClient.riskScore` | `: 50` "neutral default" cuando `hasSignals === false` | `: null`. UI muestra `Generate the full report to see signal coverage`. |

### 4.4 Mock data

| Origen | Antes | Después |
|---|---|---|
| `TransactionHistory.tsx` | `MOCK_TRANSACTIONS` array de 5 transacciones inventadas | Component recibe `transactions: Transaction[]` como prop con default `[]`. Empty state hasta que el backend conecte `getTransactionHistory()`. |
| `makePageConstants.mockMarketDepth` | (ya cubierto) | (ya cubierto) |

---

## 5. Branding migration v2.0 → v2.1

Sweep masivo de colores legacy en **43 archivos** (commit `b88f556`):

| Legacy v2.0 (amber/zinc) | v2.1 (Heritage Lavender + tokens) |
|---|---|
| `text-amber-{300,400,500,600,700}` | `text-primary` (con opacidades correctas) |
| `bg-amber-{300,400,500,600,700}` | `bg-primary` (con opacidades) |
| `border-amber-*` | `border-primary/{20,30,40}` |
| `from/to/via-amber-*` | `from/to/via-primary` |
| `text-zinc-{100,200,300}` | `text-foreground` / `text-foreground/{80,90}` |
| `text-zinc-{400,500,600,700}` | `text-muted-foreground` (con opacidades) |
| `bg-zinc-{700,800,900,950}` | `bg-card` / `bg-foreground/{5,8,10}` |
| `border-zinc-{600,700,800,900}` | `border-border` |

Cero hits restantes en código de producción. Verificado con grep + `tsc --noEmit`.

---

## 6. Memoria persistente guardada

`/Users/bavaraianecons/.claude/projects/.../memory/feedback-no-ai-iconography.md`

> En MonzaHaus, **nunca** usar Sparkles/Wand2/Bot/AI-stars. Salon-editorial > AI-tool look.
>
> *Why:* "porfavor CERO IA para las cosas que utilizas... me gusta que tenga aura la plataforma no que parezca hecha por la IA". MonzaHaus se posiciona como "estándar editorial y de inteligencia de Porsche".
>
> *How to apply:* Typography Cormorant + Karla, dashes editoriales (—, →, ·), o el casco oficial cuando aplique. Sin icono si hay duda.

Esta memoria se carga automáticamente en futuras sesiones de Claude Code.

---

## 7. Cómo testear

Servidor local en `http://localhost:3000` (corriendo en background con `bokrq66nb`).

Si necesitas restartarlo:
```bash
cd "/Users/bavaraianecons/Desktop/Monzalab/Studio Builder/MonzaHaus/producto"
lsof -ti:3000 | xargs kill -9
rm -rf .next
npm run dev
```

**Flujos críticos a validar en mobile (Chrome DevTools → 390x844 / iPhone 13):**

1. **Onboarding** `/get-started` → CTA `Generate your first Porsche report — free →`
2. **Home** `/` → tesis banner + hero + family chips + cards + advisor band
3. **Discovery por familia** → click chip "911 Family" → `/cars/porsche?family=…`
4. **Card → Report** → click cualquier card del feed → `/cars/{make}/{id}` (Investment Passport)
5. **Report completo** → `/cars/{make}/{id}/report` — validar Market Position muestra valor honesto (no clampado)
6. **Pricing** → `/pricing` — hero, cards, FAQ accordion, anchor narrative
7. **Checkout** → click un plan → bottom sheet con drag handle, sticky `Continue — $59/mo`
8. **Auth** → tap Account en bottom nav → `Create Free Account` → bottom sheet con Google primario + magic link default
9. **Advisor** → bottom nav o `/advisor` → drawer "≡ New chat" abre lista de conversaciones
10. **Theme toggle** → tap ☀ en header → cambia entre dark/light

**Edge cases a validar (honest-by-data):**

- Car sin segment stats → Market Position muestra `Pending comps`, no `50%` falso.
- Car con priceMin=0 → "Price on request" italic, no `POA - POA`.
- Listing sobre fair value → Market Position muestra real `>100%` con badge `Above fair value`.
- Sin signals extraídos → Risk Score muestra `Generate the full report to see signal coverage`.

---

## 8. Estado del branch y stash

```bash
$ git log --oneline mobile-first-v1 ^rebrand-v2.1-heritage-lavender | wc -l
10

$ git stash list
stash@{0}: On rebrand-v2.1-heritage-lavender: social-engine WIP — carousel templates & generation scripts
```

El stash con tu trabajo de social-engine (templates de carousel y scripts de generación) está intacto y se recupera con `git stash pop` cuando quieras.

---

## 9. Pendientes con justificación

Deliberadamente **no abordados** en este pase, con razón:

| Pendiente | Por qué se queda |
|---|---|
| `MOCK_TRANSACTIONS` API real | Requiere backend route `getTransactionHistory()`. UI ya está lista (TransactionHistory acepta props). |
| `ownershipCosts` por marca en `brandConfig.ts` | Estimaciones razonables (no del DB). Reemplazar requiere infra de cost-tracking que no aplica al pase mobile. |
| `brandThesis` editorial copy | Es voz de marca/marketing, no metric. Aceptable hardcoded por ahora. |
| Tests con type errors pre-existentes | No son producción. Ya tenían errors antes de este branch. |
| Loading skeletons en algunos data-fetching components | Componentes ya manejan loading state básico. Polish UX skeleton avanzado sería iteración futura. |
| `BrandContextPanel` desktop sidebar (línea 2280+) market depth fallback | Solo se ve en desktop, no en mobile. El mismo concepto de honest-by-data se puede aplicar después con conditional render del panel. |

---

## 10. Recomendación de siguiente pase

Con la base honest-by-data y mobile-first ya consolidada, los siguientes win-areas serían:

1. **Backend**: cablear `sourceUrl` al `dashboardCache` para que el `View on BaT` aparezca automático en cada card de la home (la UI ya soporta el campo).
2. **Advisor con DB conectada**: probar end-to-end el flow de mensajes (necesita Supabase resoluble localmente).
3. **Loading skeletons** en home feed, /cars/porsche y /report.
4. **i18n cleanup**: convertir los `// [HARDCODED]` strings remanentes a `t("...")` y agregar las claves a `messages/{en,es,de,ja}.json`. No es bug, es polish.
5. **Browse `/browse` Classic view en mobile**: aún tiene cards con "No image available" placeholder dominante. Aplicar la lógica del home feed.

---

**Branch listo para review y merge cuando lo digas.**
