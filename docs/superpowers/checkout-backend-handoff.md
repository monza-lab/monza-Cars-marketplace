# Checkout + Pricing — Backend Handoff

**Status:** Frontend complete (2026-04-18). Backend pending.
**Branch:** `Front-monzaaa`
**Spec:** [`specs/2026-04-18-checkout-pricing-design.md`](specs/2026-04-18-checkout-pricing-design.md)
**Frontend plan:** [`plans/2026-04-18-checkout-pricing-implementation.md`](plans/2026-04-18-checkout-pricing-implementation.md)
**Monetization strategy skill:** `~/.claude/skills/monzahaus-monetization/SKILL.md`

---

## TL;DR

El frontend del flujo de checkout y pricing está completo: 4 tiers (Free / Single $9.99 / Pack $39 / Monthly $59 unlimited), modal de pre-checkout con upsell decoy, páginas `/checkout/success` y `/checkout/cancel` con polling del perfil, `OutOfReportsModal` paywall, `BillingDashboard` con pack balance + cancel UI, header banner para free users, y client de analytics.

**El backend necesita implementar 4 endpoints + extender la DB.** El frontend ya hace las llamadas correctas con los payloads correctos; cuando el backend responda, todo se activa sin más cambios de frontend.

Mientras no exista el backend, `localhost` cae en un preview visual (`/checkout/payment`) que simula el form de Stripe para poder revisar el UX completo — ese fallback desaparece automáticamente cuando el endpoint real devuelve 200.

---

## Pricing final (APROBADO)

| Tier | Precio | Reports | Features | Rol |
|------|--------|---------|----------|-----|
| **Free** | $0 | 3 /mes perpetuos | — | Funnel (ya existe) |
| **Single Report** | **$9.99** | 1 one-time, never expires | — | Impulse buy |
| **Reports Pack** | **$39** | 5 one-time, never expire | — | Decoy |
| **Monthly** ⭐ | **$59/mo** | **UNLIMITED** | Watchlist · Alerts · Saved Searches · Priority Generation · PDF/CSV Export | Target conversion |

**Anchor narrative:** PPI $300, PPS $150, Hagerty $70/yr. El copy en pricing page apela a due diligence, no a ahorro.

**Decoy math:** `2 × Pack = $78 > Monthly $59`. Comprar dos packs cuesta más que Monthly y entrega menos. Copy inline del modal lo explicita.

---

## Lo que el frontend YA hace

### Componentes y páginas

| Archivo | Qué hace |
|---------|----------|
| `src/components/payments/PricingCards.tsx` | Renderiza los 3 cards pagos; Monthly con badge "BEST VALUE" y 6 features; dispara `plan_clicked` analytics |
| `src/components/payments/CheckoutModal.tsx` | Pre-checkout summary, upsell decoy para el Pack, llama `POST /api/checkout/create-session`, redirect a URL devuelta. En localhost cae a `/checkout/payment` si el endpoint 404/500 |
| `src/components/payments/OutOfReportsModal.tsx` | Paywall cuando `/api/analyze` retorna `INSUFFICIENT_CREDITS` |
| `src/components/payments/BillingDashboard.tsx` | Muestra tier, `creditsBalance` (Monthly y Free) y `packCreditsBalance` (packs never-expire); botón Cancel Subscription que llama `POST /api/billing/cancel-subscription` |
| `src/components/layout/Header.tsx` | Banner "X Reports left — Go Unlimited" para Free ≤3; pill muestra "Unlimited" para subscribers |
| `src/app/[locale]/pricing/page.tsx` | Hero due-diligence, 3 cards, features, FAQ actualizada |
| `src/app/[locale]/checkout/success/page.tsx` | Polling de `/api/user/profile` hasta 10s; dispara `checkout_completed` analytics |
| `src/app/[locale]/checkout/cancel/page.tsx` | Estado de cancelación; dispara `checkout_cancelled` |
| `src/app/[locale]/checkout/payment/page.tsx` | **DEV ONLY** — mock visual del Stripe checkout para preview en localhost |
| `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` | Wire del `OutOfReportsModal` cuando `useReport()` surfacea `INSUFFICIENT_CREDITS` |
| `src/lib/analytics/events.ts` | Client `track()` que POSTea a `/api/analytics` |
| `src/lib/auth/AuthProvider.tsx` | `UserProfile` extendido con `packCreditsBalance`, nuevos tiers, `subscriptionPeriodEnd` |

### Analytics events que ya dispara el frontend

Todos POSTean a `/api/analytics` con `{ event, payload }`:

- `pricing_page_viewed` — al cargar `/pricing`
- `plan_clicked` — click en cada card
- `upsell_shown` — modal del Pack abre (decoy visible)
- `upsell_converted` — click en "Switch to Monthly" desde el modal del Pack
- `checkout_started` — click en "Continue to Payment"
- `checkout_completed` — success page detecta tier flip a PACK_OWNER/MONTHLY/ANNUAL
- `checkout_cancelled` — mount de `/checkout/cancel`
- `subscription_canceled` — cancelación exitosa desde Billing Dashboard

---

## Backend — lo que falta construir

### 1. Stripe Dashboard setup (manual)

Crear 3 Products + 3 Prices en Stripe (empezar en test mode):

| Product | Price | Tipo | Env var |
|---------|-------|------|---------|
| Monza Haus Single Report | $9.99 | one-time | `STRIPE_PRICE_SINGLE` |
| Monza Haus Reports Pack | $39.00 | one-time | `STRIPE_PRICE_PACK` |
| Monza Haus Monthly | $59.00 / month recurring | subscription | `STRIPE_PRICE_MONTHLY` |

Env vars adicionales:
- `STRIPE_SECRET_KEY` (sk_test_... para dev)
- `STRIPE_WEBHOOK_SECRET` (whsec_... generado al crear el webhook endpoint o al correr `stripe listen`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_...)
- `NEXT_PUBLIC_APP_URL` (http://localhost:3000 en dev, dominio real en prod)

Crear webhook endpoint en Stripe Dashboard apuntando a `https://<domain>/api/stripe/webhook` con estos eventos:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

### 2. DB migrations

Archivo sugerido: `supabase/migrations/20260418_extend_user_for_subscriptions.sql`

```sql
-- Extender User para suscripciones + packs
ALTER TABLE "User"
  DROP CONSTRAINT IF EXISTS "User_tier_check";

ALTER TABLE "User"
  ADD CONSTRAINT "User_tier_check"
  CHECK (tier IN ('FREE', 'PACK_OWNER', 'MONTHLY', 'ANNUAL', 'PRO'));

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "packCreditsBalance" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" text,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" text,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" text
    CHECK ("subscriptionStatus" IN ('active', 'past_due', 'canceled', 'incomplete') OR "subscriptionStatus" IS NULL),
  ADD COLUMN IF NOT EXISTS "subscriptionPeriodEnd" timestamptz;

-- Expandir CreditTransaction.type
ALTER TABLE "CreditTransaction"
  DROP CONSTRAINT IF EXISTS "CreditTransaction_type_check";

ALTER TABLE "CreditTransaction"
  ADD CONSTRAINT "CreditTransaction_type_check"
  CHECK (type IN (
    'FREE_MONTHLY',
    'ANALYSIS_USED',
    'PURCHASE',
    'STRIPE_PACK_PURCHASE',
    'STRIPE_SUBSCRIPTION_ACTIVATION',
    'STRIPE_MONTHLY_RESET',
    'STRIPE_SUBSCRIPTION_CANCELED'
  ));

-- Idempotencia de webhooks
CREATE UNIQUE INDEX IF NOT EXISTS "CreditTransaction_stripePaymentId_unique"
  ON "CreditTransaction"("stripePaymentId")
  WHERE "stripePaymentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "User_stripeCustomerId_idx" ON "User"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "User_stripeSubscriptionId_idx" ON "User"("stripeSubscriptionId");
```

Tabla `analytics_events`:

```sql
CREATE TABLE IF NOT EXISTS analytics_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid,
  event_name   text NOT NULL,
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_user_idx ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events(event_name);
```

### 3. Endpoints a implementar

Orden sugerido (dependencias internas):

1. `POST /api/checkout/create-session` (desbloquea compra)
2. `POST /api/stripe/webhook` (activa créditos tras pago)
3. `POST /api/billing/cancel-subscription`
4. `POST /api/analytics`
5. Extender `GET /api/user/profile` con los nuevos campos

#### 3.1 `POST /api/checkout/create-session`

**Auth:** requerida (Supabase session).

**Request body:**
```json
{ "plan": "single" | "pack" | "monthly" }
```

**Response 200:**
```json
{ "url": "https://checkout.stripe.com/c/pay/cs_test_...", "sessionId": "cs_test_..." }
```

**Responses:** 400 (invalid plan), 401 (unauthorized), 500 (internal).

**Lógica:**
- Valida `plan ∈ { single, pack, monthly }` (Zod recomendado).
- `getOrCreateUser(supabaseId, email, name)` — ya existe.
- Si el user no tiene `stripeCustomerId`, `stripe.customers.create({ email, metadata: { appUserId } })` y guardar en DB.
- `stripe.checkout.sessions.create({ customer, mode, line_items, success_url, cancel_url, client_reference_id, metadata, ...subscription/payment_intent metadata })`.
  - `mode`: `'payment'` para single/pack, `'subscription'` para monthly.
  - `line_items`: un item con el price ID del env var correspondiente.
  - `success_url`: `${NEXT_PUBLIC_APP_URL}/en/checkout/success?session_id={CHECKOUT_SESSION_ID}`
  - `cancel_url`: `${NEXT_PUBLIC_APP_URL}/en/checkout/cancel`
  - `metadata`: `{ appUserId, plan }` (en el session + también en `subscription_data.metadata` o `payment_intent_data.metadata` según mode — el webhook necesita leerlo)
  - `allow_promotion_codes: false` para MVP.

#### 3.2 `POST /api/stripe/webhook`

**Auth:** signature verification con `stripe.webhooks.constructEvent(body, signature, webhookSecret)`.

**Runtime:** `nodejs` (no edge). `export const dynamic = 'force-dynamic'`.

**Eventos a manejar:**

**`checkout.session.completed`:**
- Expandir `line_items`: `stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items'] })`.
- Leer `session.metadata.appUserId` y `session.metadata.plan`.
- **Idempotencia:** antes de escribir, check `SELECT 1 FROM "CreditTransaction" WHERE "stripePaymentId" = $session.id`. Si existe → return 200 sin hacer nada.
- Si `mode === 'payment'`:
  - `single` → sumar 1 a `packCreditsBalance`, tier `FREE → PACK_OWNER` si aplica.
  - `pack` → sumar 5 a `packCreditsBalance`, tier `FREE → PACK_OWNER` si aplica.
  - Insertar `CreditTransaction` con `type = 'STRIPE_PACK_PURCHASE'`, `stripePaymentId = session.id`.
- Si `mode === 'subscription'`:
  - `monthly` → `tier = 'MONTHLY'`, `creditsBalance = 999999` (o usar un flag `unlimited` — ver nota abajo), `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionPeriodEnd` del objeto subscription, `subscriptionStatus = 'active'`.
  - Insertar `CreditTransaction` con `type = 'STRIPE_SUBSCRIPTION_ACTIVATION'`.

**Nota sobre "unlimited":** dado que Monthly es unlimited, hay 2 opciones:
1. **Flag de feature:** añadir `isUnlimited boolean` al User y hacer que `deductCredit` no decremente si `tier IN ('MONTHLY', 'ANNUAL')`. Limpio.
2. **Balance enorme:** setear `creditsBalance = 999999` en activación. Funciona pero sucio.

Recomiendo opción 1 — deja a Monthly sin consumir balance, mantiene `packCreditsBalance` intacto.

**`customer.subscription.updated`:**
- Buscar user por `stripeSubscriptionId`.
- Si `status === 'active'` y `current_period_end` cambió → renovación. No hay nada que "resetear" (unlimited), solo actualizar `subscriptionPeriodEnd`.
- Si `status === 'past_due'` → `subscriptionStatus = 'past_due'` (Stripe hace dunning automático).
- **Idempotencia:** usar `event.id` como `stripePaymentId` en `CreditTransaction`.

**`customer.subscription.deleted`:**
- Buscar user, `tier = 'FREE'`, clear `stripeSubscriptionId`, `subscriptionStatus = 'canceled'`.
- **Importante:** NO tocar `packCreditsBalance` — los packs nunca expiran aunque cancele la sub.

**`invoice.payment_failed`:**
- Buscar user, `subscriptionStatus = 'past_due'`. Stripe retry automático; si falla final, dispara `subscription.deleted`.

#### 3.3 `POST /api/billing/cancel-subscription`

**Auth:** requerida.

**Request:** sin body.

**Response 200:** `{ ok: true }`, 400 si el user no tiene `stripeSubscriptionId`.

**Lógica:**
- `stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true })`.
- El webhook `customer.subscription.deleted` finaliza el cambio cuando llegue el período.

#### 3.4 `POST /api/analytics`

**Auth:** opcional (user_id nullable).

**Request:** `{ event: string, payload: object }`

**Response 200:** `{ ok: true }`. **Nunca fallar** — si hay error interno, retornar 200 igual (analytics no debe romper UX).

**Lógica:**
- `INSERT INTO analytics_events (user_id, event_name, payload) VALUES ($1, $2, $3)`.

#### 3.5 Extender `GET /api/user/profile`

Archivo existente: `src/app/api/user/profile/route.ts`.

Añadir al objeto `profile` de la response:
```json
{
  "packCreditsBalance": <number>,
  "subscriptionPeriodEnd": <ISO string | null>,
  "tier": "FREE" | "PACK_OWNER" | "MONTHLY" | "ANNUAL" | "PRO"
}
```

La fuente es la fila `User` del Postgres.

### 4. Cambios a `src/lib/credits/index.ts`

Este archivo es el core de la lógica de créditos. El frontend no lo toca; el backend sí.

**Consumption order cuando se genera un report:**
- Si `tier IN ('MONTHLY', 'ANNUAL')` → no descontar nada (unlimited).
- Si `packCreditsBalance > 0` → descontar 1 de `packCreditsBalance` (packs never expire, consume primero).
- Si no → descontar 1 de `creditsBalance` (pool mensual del Free tier).
- Si nada disponible → retornar `INSUFFICIENT_CREDITS`.

El `deductCredit` existente ya descuenta solo de `creditsBalance`. Hay que modificarlo para esta prioridad (código en `plans/2026-04-18-checkout-pricing-implementation.md` sección anterior — backend version).

---

## Testing

### Local (con Stripe CLI)

```bash
# Instalar CLI
brew install stripe/stripe-cli/stripe
stripe login

# Forward webhooks a localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copiar el whsec_... al STRIPE_WEBHOOK_SECRET de .env.local
```

**Happy path test:**
1. `npm run dev`
2. Login como test user
3. `/en/pricing` → click Monthly
4. "Continue to Payment" → redirige a Stripe real (checkout.stripe.com)
5. Tarjeta: `4242 4242 4242 4242`, cualquier fecha futura, CVC, ZIP
6. Redirect a `/en/checkout/success` → tier debe estar en MONTHLY, creditsBalance unlimited

**Edge cases:**
- `stripe trigger customer.subscription.deleted` → tier vuelve a FREE, packs intactos
- `stripe trigger invoice.payment_failed` → status = past_due
- Tarjetas de prueba: `4000 0000 0000 0002` (decline), `4000 0025 0000 3155` (3DS required)

### Contrato frontend ↔ backend

El frontend **ya está mandando las requests correctas**. Cuando el backend implemente los endpoints:
1. El mock local `/checkout/payment` deja de usarse automáticamente (solo se activa en localhost cuando el endpoint real 404/500).
2. El success/cancel flow funcionará end-to-end.
3. Los analytics events empezarán a poblar la tabla `analytics_events`.

Si el backend desea validar el frontend sin conectar a Stripe real, puede devolver `{ url: "/checkout/payment?plan=X" }` desde `create-session` — el frontend redirigirá al mock y el flujo visual se puede revisar.

---

## Phase 2 — Salon (no incluido en MVP)

Cuando haya datos de conversion tras 30 días, considerar:

- **Salon tier** (membresía premium $99-149/mo): Watchlist expandido + Arbitrage Feed regional + Early Access + Pre-Auction Briefs + Garage (portfolio tracking).
- **Dealer tier** (inventory-based pricing, ~$400-900/mo): seguir el modelo Carfax de "X vehículos / tier".
- **Annual plan** ($499-590/año, 30% off): lock-in, reduce churn 40-60% según benchmarks Recurly.
- **Promo codes / referral program.**
- **PostHog/Mixpanel migration** para analytics más serio.
- **Stripe Elements embedded** si los datos muestran que el redirect hurtea conversion.

Ver `~/.claude/skills/monzahaus-monetization/SKILL.md` sección "FASE 2 — SALON" para el framework completo.

---

## Contactos

- Spec + plan + skill: linked arriba.
- Backend dev: cuando este doc sea leído por la persona/sesión que implementa, ping para clarificaciones vía comentarios en el PR de backend.
- Frontend está en branch `Front-monzaaa` — merge a main cuando backend ship.
