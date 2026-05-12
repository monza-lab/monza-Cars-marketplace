# Pistons Wallet Pricing — Design Spec

**Date:** 2026-05-11
**Branch:** `otros-cambios-front`
**Owner:** Edgar Navarro Soto
**Scope:** Front-end only. Cero cambios de backend, Stripe products, schema o API contracts.

---

## 1. Context

La pantalla de pricing actual hereda un modelo "card grid" de 6 tiers (Zuffenhausen, Weissach, Rennsport, Jerrycan, Fuel Cell, Boxenstopp) que mezcla suscripciones mensuales y top-ups one-time en cards idénticamente prominentes. Visualmente compiten entre sí; cognitivamente, el user no sabe qué comparar.

Edgar identificó dos cambios fundamentales:

1. **Pistons no son reports.** Pistons son una currency multi-use: 1 chat = 1 Piston, 1 marketplace query = ~5, 1 deep research = ~25, 1 full report = 100. La plataforma es como un casino donde el user gasta según su intensidad. Hoy la pricing page no comunica esto — vende "X reports por Y dólares" cuando debería vender "fuel for your research."

2. **El modelo "card grid" es el problema.** No importa cuántas cards haya — la decisión "comparar tiers" es la fricción. Lo que el user realmente hace es **recargar una wallet**, como Steam Wallet o Uber Credits.

Este spec rediseña `/pricing` + todos los entry points a "comprar Pistons" para reflejar el modelo wallet recharge, con un único sub recomendado para users de alto consumo.

---

## 2. Mental Model

> *"Pistons son tu wallet de research. Recargás una vez o te suscribís. Gastás como quieras."*

El user entra a `/pricing` y ve UNA decisión simple: cuánto cargar. No compara planes. Si después le encanta la plataforma y la usa mucho, ve el sub como upgrade natural.

Anclajes psicológicos clave:
- **Pistons economy table** visible antes de los presets (educa la unidad)
- **Round pricing** ($13 / $30 / $99 / $59) — no charm pricing (doctrina `monzahaus-monetization`)
- **Volume discount progresivo** en presets
- **Never-expire** badge en top-ups (psicología de no-loss)
- **Sub como upsell** debajo de los presets, no compitiendo arriba

---

## 3. Productos finales (frontend)

| Producto | Precio | Pistons | Vigencia | Visible en UI |
|---|---|---|---|---|
| Free | $0 | 300/mes | Perpetuo | ✓ siempre |
| **Top-up Entry** | $13 | 1,000 | Never expire | ✓ preset 1 |
| **Top-up Active** | $30 | 2,500 | Never expire | ✓ preset 2 |
| **Top-up Heavy** | $99 | 10,000 | Never expire | ✓ preset 3 |
| **Rennsport** sub | $59/mo | Unlimited research + bundle | Mientras suscrito | ✓ siempre |
| Zuffenhausen sub | $9.99/mo | 1,000/mes | Mientras suscrito | ✗ legacy only |
| Weissach sub | $39/mo | 5,000/mes | Mientras suscrito | ✗ legacy only |
| Jerrycan top-up | $9.99 | 600 | Never expire | ✗ retired |
| Fuel Cell top-up | $29 | 2,200 | Never expire | ✗ retired |
| Boxenstopp top-up | ? | ? | Never expire | ✗ retired |

**Cost-per-Piston de los 3 presets** (volume discount progresivo):

| Preset | Pistons | Precio | Cost/Piston |
|---|---|---|---|
| Entry | 1,000 | $13 | $0.0130 |
| Active | 2,500 | $30 | $0.0120 |
| Heavy | 10,000 | $99 | $0.0099 |

**Rennsport ($59/mo) vs Heavy top-up ($99) =** distancia intencional. *"$40 menos y queda unlimited"* es el conversion driver natural a sub.

**Legacy / retirados:** quedan en `src/lib/payments/plans.ts` como entries con `visibleInNewUI: false` (o equivalente flag). Solo se usan para users que ya pagaron esos planes históricos. Cero impact en Stripe products que ya existen.

---

## 4. Pantallas afectadas

### 4.1 `/pricing` — rediseño completo

Layout (mobile-first; desktop = misma estructura, más ancho):

```
┌─────────────────────────────────────────────────────┐
│  HERO                                               │
│  300 free Pistons each month — no card required     │
│                                                     │
│  Recargá tu wallet                                  │
│                                                     │
│  Pistons son tu moneda. Compra una vez o suscribite.│
│  Tu wallet de research.                             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  PISTONS ECONOMY TABLE                              │
│                                                     │
│  💬  Quick chat              1 Piston               │
│  🔍  Marketplace query       ~5 Pistons             │
│  📊  Deep research           ~25 Pistons            │
│  📄  Full investment report  100 Pistons            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  TOP-UP PRESETS (HERO)                              │
│                                                     │
│  ¿Cuántos Pistons?                                  │
│                                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐                            │
│  │1,000│ │2,500│ │10K  │                            │
│  │ $13 │ │ $30 │ │ $99 │                            │
│  └─────┘ └─────┘ └─────┘                            │
│                                                     │
│  Selected: 1,000 Pistons → $13 · never expire       │
│  ≈ 10 reports · 200 marketplace · 40 deep research  │
│                                                     │
│  [          Recargar →          ]                   │
│                                                     │
│  O ingresá un monto custom →  (collapsible)         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  SUBSCRIPTION RECOMMENDATION (secondary)            │
│                                                     │
│  ¿Vas a usar mucho?                                 │
│                                                     │
│  ┌────────────────────────────────────────────┐     │
│  │  RENNSPORT  ★  Most popular                │     │
│  │  $59/mo                                    │     │
│  │  Unlimited research · Watchlist · Alerts   │     │
│  │  Cancel anytime                       →    │     │
│  └────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  ANCHOR NARRATIVE (small, italic)                   │
│  A PPI costs $400. A Porsche PPS, $250.             │
│  Paying $59/mo to know if the deal is worth it is   │
│  due diligence, not expense.                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  FAQ (collapsed, light)                             │
│  · Do Pistons expire?                               │
│  · How do I cancel my subscription?                 │
│  · Can I get a refund?                              │
└─────────────────────────────────────────────────────┘
```

**Sin cards de tier comparison.** Sin paradox of choice. 3 presets + 1 sub. **Esa es la pantalla.**

### 4.2 Mini-buy quick path — reemplaza `OutOfReportsModal`

Cuando el user trata de hacer una acción y no le alcanzan Pistons (advisor message, generate report, deep research), aparece un modal compacto:

```
┌─────────────────────────────────────────────┐
│  Necesitás 100 Pistons. Tenés 47.           │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  🛢️  1,000 Pistons                     │  │
│  │  $13 · never expires           Buy → │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  💡 Tip: Rennsport te da unlimited research │
│  por $59/mo. See plans →                    │
└─────────────────────────────────────────────┘
```

**Sin nombres en los top-ups.** La doctrina wallet recharge no nombra paquetes — sólo amounts. "1,000 Pistons / $13" es self-explanatory. Como Steam Wallet no se llama "Pack Hercules $20" sino "$20 in Steam Credit." Esto reduce ruido cognitivo y refuerza el mental model "currency, not product." Los nombres alemanes (Jerrycan, Fuel Cell, Boxenstopp) que se retiran NO se reciclan para los nuevos top-ups.

Características:
- Top-up por defecto = preset Entry ($13 / 1,000 Pistons). El user de bajo presupuesto resuelve su acción inmediata en 1 click.
- Stripe checkout abre dentro del modal (CheckoutModal embebido) — no redirige fuera del flow.
- Después de pago, refresca Pistons balance y deja al user CONTINUAR la acción donde estaba.
- "See plans →" abre `/pricing` para el user que quiere considerar sub.

Rename del componente: `OutOfReportsModal.tsx` → `OutOfPistonsModal.tsx`. El concepto "reports" desaparece de UI; siempre hablamos de Pistons.

### 4.3 `PistonsWalletModal.tsx` (header pill click)

Actualmente muestra el balance + último uso. Agregar:
- **Mini Pistons economy table** (versión compacta de 4 lines)
- **Sticky bottom CTAs**: si NO suscrito → "Top-up Pistons →" abre mini-buy; si suscrito → "Manage subscription"
- **Recent debits** ya existe — keep.

### 4.4 `AccountSheetContent.tsx` entry points

Hoy tiene "Buy →" en sección Pistons y "Upgrade" en plan section. Mantener; ambos llevan a `/pricing` (no cambio de behavior, solo el destino es el pricing rediseñado).

### 4.5 Otros entry points (no cambios, solo verificar destinos):

- `Header.tsx` menu — link "Pricing & Pistons" → `/pricing` ✓
- `BillingDashboard.tsx` — "Upgrade" → `/pricing` ✓
- `NoCreditsPrompt.tsx` — link → `/pricing` ✓
- `checkout/cancel`, `checkout/payment` — links → `/pricing` ✓

---

## 5. Componentes a crear / tocar

| Acción | Archivo | Notas |
|---|---|---|
| **Crear** | `src/components/payments/PistonsEconomyTable.tsx` | Tabla reusable (4 rows). 2 variantes: `full` (en `/pricing`) y `compact` (en wallet modal). |
| **Crear** | `src/components/payments/TopUpPresets.tsx` | Los 3 preset buttons + selected state + "custom amount" collapsible. Mobile-first 1×3, desktop 3×1. |
| **Crear** | `src/components/payments/SubRecommendationCard.tsx` | El card de Rennsport debajo de los presets. Una sola card. |
| **Reescribir** | `src/app/[locale]/pricing/page.tsx` | Layout nuevo. Usa los 3 componentes arriba + anchor narrative + FAQ. |
| **Reescribir** | `src/components/payments/OutOfReportsModal.tsx` → `OutOfPistonsModal.tsx` | Rename + nuevo layout mini-buy. |
| **Tocar** | `src/components/payments/PricingCards.tsx` | **Retirar** del flujo principal. Si nadie lo importa después del refactor, soft-delete o marcar `@deprecated`. |
| **Tocar** | `src/components/advisor/PistonsWalletModal.tsx` | Agregar Pistons economy table compact. |
| **Tocar** | `src/lib/payments/plans.ts` | Agregar 3 nuevos top-ups: `topup_entry`, `topup_active`, `topup_heavy`. Marcar legacy con flag `visibleInPricing: false` o `visibleInPricing: false`. |
| **Tocar** | `src/components/payments/CheckoutModal.tsx` | Soportar los 3 nuevos topup IDs en el switch que arma el Stripe checkout. |
| **Tocar** | `messages/{en,es,de,ja}.json` | Nuevas keys en namespace `pricing.*` y `wallet.*`. |

**Listas de archivos NO tocar:**
- Backend: cero (cualquier API route, scraper, DB migration, schema).
- Stripe webhooks: cero.
- AuthProvider, Supabase client: cero.

---

## 6. Stripe / payment flow

El backend ya tiene endpoints para crear Stripe checkout sessions a partir de un `PlanKey`. Front-end agrega 3 `PlanKey` nuevos:

```ts
type PlanKey =
  | "zuffenhausen"   // legacy sub, NO visible nueva UI
  | "weissach"       // legacy sub, NO visible nueva UI
  | "rennsport"      // sub visible
  | "jerrycan"       // legacy top-up, NO visible
  | "fuel_cell"      // legacy top-up, NO visible
  | "boxenstopp"     // legacy top-up, NO visible
  | "topup_entry"    // NEW — $13 / 1,000 Pistons
  | "topup_active"   // NEW — $30 / 2,500 Pistons
  | "topup_heavy"    // NEW — $99 / 10,000 Pistons
```

**Backend setup necesario (NO incluido en este spec, lo coordina backend):**
- 3 nuevos Stripe Product/Price IDs en environment vars: `STRIPE_PRODUCT_TOPUP_ENTRY`, `STRIPE_PRODUCT_TOPUP_ACTIVE`, `STRIPE_PRODUCT_TOPUP_HEAVY`.
- Webhook ya maneja `payment_intent.succeeded` para top-ups → agrega Pistons. Solo necesita reconocer los 3 nuevos product IDs y mapearlos a los amounts (1,000 / 2,500 / 10,000).
- Esto NO es parte del scope front. **Antes del merge a main, backend confirma que los 3 productos están creados en Stripe.**

---

## 7. i18n keys nuevas

Namespace `pricing` (extiende el actual):

```json
{
  "pricing": {
    "heroTitle": "Recargá tu wallet",
    "heroSubtitle": "Pistons son tu moneda. Compra una vez o suscribite. Tu wallet de research.",
    "economyTitle": "Cómo gastás Pistons",
    "economyChat": "Quick chat",
    "economyMarketplace": "Marketplace query",
    "economyDeepResearch": "Deep research",
    "economyReport": "Full investment report",
    "topupTitle": "¿Cuántos Pistons?",
    "topupSelected": "Selected:",
    "topupCustom": "O ingresá un monto custom",
    "topupCta": "Recargar →",
    "topupNeverExpire": "never expire",
    "subSectionTitle": "¿Vas a usar mucho?",
    "subBadge": "Most popular",
    "subFeatures": "Unlimited research · Watchlist · Alerts",
    "subCancelAnytime": "Cancel anytime",
    "subCta": "Subscribe →",
    "outOfPistonsTitle": "Necesitás {needed} Pistons. Tenés {have}.",
    "outOfPistonsBuyTopup": "{pistons} Pistons",
    "outOfPistonsBuyHint": "$13 · never expires",
    "outOfPistonsBuy": "Buy →",
    "outOfPistonsTip": "Tip: Rennsport te da unlimited research por $59/mo.",
    "outOfPistonsSeePlans": "See plans →"
  }
}
```

Traducidas a EN/ES/DE/JA en los 4 archivos.

---

## 8. Mobile-first considerations

- **Top-up presets**: 1 columna full-width × 3 rows en mobile. 3 columnas en desktop (>768px).
- **Pistons economy table**: stack vertical en mobile (4 rows, full width). Horizontal en desktop si hay espacio.
- **Custom amount input**: collapsible en mobile (tap "Custom amount" para expandir). Visible siempre en desktop.
- **Mini-buy modal**: bottom sheet en mobile (full width, slides up). Centered modal en desktop.
- **Sub recommendation card**: misma estructura mobile/desktop, padding diferente.

Targets de fricción móvil:
- 1 tap → preset seleccionado.
- 2 taps → checkout iniciado (preset → Recargar).
- 3 taps → pago completo (Stripe checkout → confirm).

---

## 9. Lo que se queda fuera de scope (out of scope)

- Backend / Stripe product setup (Edgar coordina con backend).
- Migración de users con planes legacy (Zuff, Weissach, Jerrycan, etc.) — backend maneja billing continuity.
- Auto-renewal email notifications.
- Pistons usage analytics dashboard.
- Anchor narrative completo (texto ya existe; sólo se mueve de lugar).
- Multi-currency support (USD only por ahora).
- Refund flow UI (existe Stripe Customer Portal; no se reemplaza).

---

## 10. Success criteria

- `/pricing` muestra **3 presets + 1 sub card**, cero "tier comparison grid."
- Pistons economy table visible y traducida en 4 idiomas.
- Mini-buy modal aparece on `OutOfPistons` event (en lugar de redirigir a `/pricing`).
- Click "Recargar" abre CheckoutModal con el preset seleccionado en <1s.
- TypeScript compila clean.
- Cero archivos backend tocados (verificado con `git diff --name-only`).
- Mobile (320px–390px) renderea sin overflow horizontal.
- Lighthouse Performance ≥85 en `/pricing` (no regression vs current).

---

## 11. Decisiones bloqueadas — confirmadas con Edgar

| # | Decisión | Confirmado |
|---|---|---|
| 1 | Mental model: wallet recharge, no card grid | ✓ |
| 2 | 3 presets: 1K / 2.5K / 10K Pistons | ✓ |
| 3 | Precios: $13 / $30 / $99 (round, no charm) | ✓ |
| 4 | Sub única visible: Rennsport $59/mo | ✓ |
| 5 | Zuff + Weissach: keep en backend, no UI nueva | ✓ |
| 6 | Jerrycan + Fuel Cell + Boxenstopp: retire de UI | ✓ |
| 7 | Pistons Economy Table visible | ✓ |
| 8 | Mini-buy quick path para out-of-pistons | ✓ |
| 9 | Mobile-first, 4 idiomas EN/ES/DE/JA | ✓ |
| 10 | Front-only, cero backend | ✓ |

---

## 12. Next steps (después de approval)

1. Edgar revisa este spec.
2. Si aprueba: invoco `writing-plans` skill para escribir el implementation plan (orden de archivos, dependencias, smoke tests, etc.).
3. Implementation en branch `otros-cambios-front`.
4. Visual validation en localhost (mobile viewport).
5. Commit + push.
6. Edgar coordina con backend para crear los 3 Stripe products antes del merge.
