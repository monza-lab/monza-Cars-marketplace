# Aura Maxima — Backend Handoff

**Branch:** `Aura-Maxima-Front`
**PR:** https://github.com/monza-lab/monza-Cars-marketplace/pull/new/Aura-Maxima-Front
**Author:** Edgar (con Claude)
**Date:** 2026-05-15
**Scope:** Frontend-only changes. No API routes, no DB schema, no AI pipeline edits.

---

## 1. TL;DR para el equipo de backend

Este branch reconstruye la UX del reporte y del Advisor, **sin tocar nada del backend**. Lo que necesitas saber:

- Cero cambios en `src/app/api/**`, `supabase/**`, ni en el pipeline de `/api/analyze/v3`.
- Cero cambios en el schema de DB (`user_credits`, `listing_reports`, `listing_signals`, etc.).
- Cero cambios en el shape de los tipos `HausReport`, `HausReportV3`, `MarketIntelD2`, `ReportTier`.
- El único archivo "de backend" tocado es `src/lib/reports/queries.ts`: una sola línea — el `REPORT_PISTON_COST = 100` se convirtió en un re-export desde `src/lib/reports/canAffordReport.ts` para que el frontend (client component) pueda importarlo sin chocar con `next/headers`. Mismo valor, misma semántica, sin nuevos efectos.

Diff vs `main`: **67 archivos, +8,734 / −2,386 LOC** (+~6k netos, mayoría por nueva infra de chat contextual y la fundación de tooltips).

---

## 2. APIs / endpoints que el frontend sigue llamando exactamente igual

| Endpoint | Quién llama desde el front | Cambios |
|----------|----------------------------|---------|
| `POST /api/analyze/v3` | `ReportClient.tsx:handleGenerateV3()` | Sin cambios. Se llama después de que el usuario confirme el modal. |
| `POST /api/analyze` (legacy) | (Si aún se usa en algún path) | Sin cambios. |
| `POST /api/advisor/message` | `AdvisorConversation` (vía Drawer o página `/advisor`) | Sin cambios. Mismo payload, mismo SSE response. |
| `GET /api/user/profile` (o equivalente, `useAuth()`) | `AuthProvider.tsx` | Sin cambios. Sólo leemos `profile.pistonsBalance`. |
| `getReportForListing(carId)` | `page.tsx` (server component) | Sin cambios funcionales. |
| `fetchSignalsForListing(carId)` | `page.tsx` | Sin cambios. |

**Eliminadas** del lado del frontend (page.tsx):
- `getReportMetadataV2(carId)` ← ya no se llama porque ReportClient unificado no consume `reportTier/Hash/Version`. **El endpoint sigue existiendo** en backend; sólo no lo invocamos.
- `computeArbitrageForCar(...)` + `inferTargetRegion(...)` para producir `d2Precomputed` ← lo mismo, ya no se llama desde page.tsx. Si lo usás en otros lugares sigue ahí.

---

## 3. Contratos del frontend que asumen ciertas formas del backend

### 3.1 `profile.pistonsBalance: number`

- Lo lee `useAuth()` (en `AuthProvider.tsx`).
- El banner global se dispara cuando `tier === "FREE" && pistonsBalance < REPORT_PISTON_COST`.
- El modal de confirmación lo muestra como `${balance} → ${balance - cost}`.
- **Si el backend cambia el campo de nombre** (ej. `credits_balance`), hay que actualizar el frontend. Hoy soporta fallback a `creditsBalance` (legacy) pero el principal es `pistonsBalance`.

### 3.2 `REPORT_PISTON_COST = 100`

- Constante exportada por `src/lib/reports/canAffordReport.ts` (re-exportada desde `queries.ts`).
- Si cambias el costo, **actualízalo en `canAffordReport.ts`** (no duplicar). Tanto el frontend (banners, modal, gate) como el route handler `/api/analyze/v3` lo consumen.

### 3.3 `HausReportV3` shape

- El frontend asume las propiedades concretas que cada V3 section component lee:
  - `v3Report.finalSynthesis` → consumido por `ExecutiveSummarySection`, `VerdictBlock` (en V1 unificado)
  - `v3Report.vehicle_identity` / `v3Report.color_intelligence` / `v3Report.vin_intelligence` → `VinIntelBlock`, `ColorIntelBlock`, `InvestmentStoryBlock`
  - `v3Report.investmentAnalysis` → `InvestmentStrategySection`
  - `v3Report.ownershipCosts` → `OwnershipCostSection`
  - `v3Report.resaleTimeline` → `ResaleTimelineSection`
  - `v3Report.technicalAnalysis` → `TechnicalAnalysisSection`
  - `v3Report.dueDiligence` → `DueDiligenceSection` (en V3 y V1 unificado)
  - `v3Report.buyerServices` → `BuyerServicesSection`
  - `v3Report.marketResearch` → `MarketResearchSection`
- **Si renombras un campo en el backend, actualiza también el render en `ReportClient.tsx`** (busca por `v3Report.<nombre>`).

### 3.4 Mock fixtures preservados

El backend / pipeline puede seguir asumiendo que los archivos:
- `src/lib/fairValue/__fixtures__/992-gt3-pts-mock.json`
- `src/lib/fairValue/__fixtures__/991-carrera-sparse-mock.json`
- `src/lib/reports/__fixtures__/v3-911-gt3r-rennsport-mock.json`

…siguen activos para QA. Las URLs `?mock=992gt3`, `?mock=sparse`, `?mock=v3` funcionan igual que antes.

---

## 4. Pantallas afectadas (nada se rompió, sólo se reorganizó)

### 4.1 Reporte (`/[locale]/cars/[make]/[id]/report`)

- Antes: dos clientes (`ReportClient` para preview, `ReportClientV2` para paid).
- Ahora: **un solo cliente** unificado. `ReportClientV2.tsx` borrado.
- Lógica de acceso:
  - Si `userHasAccess === false` → muestra sidebar TOC + hero + Summary unlocked + secciones 02-09 con paywall blur + CTA "Unlock 100 pistons".
  - Si `userHasAccess === true && v3Report != null` → mismo shell pero todas las 9 secciones renderizan componentes V3 (`ExecutiveSummarySection`, etc.) sin blur ni locks.
- El backend resuelve `userHasAccess` igual que antes (`page.tsx` líneas ~210-230, basado en `hasAlreadyGenerated`, `getUserCredits.unlimited`, `isAdmin`, y mockName).

### 4.2 Modal de confirmación (nuevo)

- Componente: `src/components/report/ConfirmGenerateModal.tsx`
- Se abre cuando el usuario hace clic en cualquier "Unlock 100 pistons" CTA **si tiene suficiente balance**.
- Si NO tiene balance (`pistonsBalance < REPORT_PISTON_COST`), se salta el modal y abre directamente `OutOfPistonsModal` existente.
- Al confirmar, ejecuta el flujo existente (`consumeForAnalysis(carId)` → `handleGenerateV3()`).

### 4.3 Banner global de pistons bajos (Header)

- **Copy actualizado**: antes decía "Free Reports left this month · ...", ahora dice:
  - "Out of pistons — top up to generate a Haus Report ·" (cuando `balance === 0`)
  - "Only X pistons left — not enough for a report (100 needed) ·" (cuando `0 < balance < 100`)
- **Trigger**: `tier === "FREE" && pistonsBalance < REPORT_PISTON_COST`
- Antes el threshold era `<= 3` (legacy, cuando los reportes eran 1 unidad).

### 4.4 Chat / Advisor

- El FAB (botón flotante) **ya no navega** a la página `/advisor`. Abre un **drawer lateral** (Sheet desde la derecha, 420px en desktop, fullscreen en mobile).
- La ruta `/advisor` sigue existiendo y funciona — se usa como deep link "open fullscreen".
- Sugerencias rápidas (quick replies / chips) son ahora **contextuales** según la página y la sección del reporte:
  - Dashboard, marketplace, car-detail, report (con sub-cases por sección activa), "other" fallback.
  - Total: 32 templates de prompts en `src/lib/advisor/buildSuggestions.ts`.
- El `conversationId` persiste durante la sesión del browser (no en localStorage, no en backend). Si el usuario recarga, conversación nueva. Esto matchea la UX que ya tenía `AdvisorChat.tsx`.

### 4.5 Monza View (Dashboard)

- Fix de layout overflow: `h-[100dvh] overflow-hidden` → `min-h-[100dvh]` para que el contenido no se recorte cuando el header crece (por la banner de pistons bajos).

### 4.6 Tooltips de métricas (nuevo)

- 6 métricas con icono `Info` + tooltip de explicación:
  - Fair Value, Market Position, Risk Score, Signals, Verdict, Similar Cars
- Copy hardcoded (sin i18n por ahora, marcado como follow-up).

---

## 5. Tipos / módulos nuevos en `src/lib/`

| Path | Qué hace | Quién lo consume |
|------|----------|------------------|
| `src/lib/reports/canAffordReport.ts` | Helper puro `canAffordReport(balance, cost): boolean` + constante `REPORT_PISTON_COST = 100` | `ReportClient.tsx`, `queries.ts` (re-export), `/api/analyze/v3/route.ts` (vía re-export en queries) |
| `src/lib/reports/canAffordReport.test.ts` | 6 tests Vitest | CI |
| `src/lib/advisor/types.ts` | `ChatContext`, `Suggestion`, `AdvisorSurface` | provider, util, drawer |
| `src/lib/advisor/buildSuggestions.ts` | Pure function context → 4 chips | drawer, page shell |
| `src/lib/advisor/buildSuggestions.test.ts` | 3 tests Vitest | CI |
| `src/lib/advisor/ChatContextProvider.tsx` | React Context + state (open, conversationId, surface) | layout, drawer, FAB, surfaces |

---

## 6. Componentes nuevos en `src/components/`

| Path | Qué hace |
|------|----------|
| `src/components/report/ConfirmGenerateModal.tsx` | Modal de confirmación de pistons antes de generar reporte |
| `src/components/advisor/AdvisorDrawer.tsx` | Sheet wrapper que monta `AdvisorConversation` en un panel derecho |

---

## 7. Componentes que se modificaron (no se rompieron)

| Path | Cambio |
|------|--------|
| `src/app/[locale]/cars/[make]/[id]/report/page.tsx` | Branch V1/V2 colapsado a único render de `ReportClient`. Limpieza de variables huérfanas (d2Precomputed, reportTier/Hash/Version). |
| `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` | Acepta `v3Report` + `userHasAccess`. Cada sección tiene un ternary que renderiza V3 component cuando `hasAccess && v3Report`, o V1 teaser si no. `handleUnlock` ahora abre el ConfirmGenerateModal. |
| `src/app/[locale]/cars/[make]/[id]/report/page.test.tsx` | Removido `vi.mock("./ReportClientV2", ...)` obsoleto. |
| `src/components/advisor/AdvisorFab.tsx` | `<Link href="/advisor">` → `<button onClick={open}>`. |
| `src/components/layout/Header.tsx` | Banner copy + trigger condition actualizados. |
| `src/components/dashboard/DashboardClient.tsx` | Container `h-[100dvh] overflow-hidden` → `min-h-[100dvh]`. setContext({ surface: "dashboard" }) on mount. |
| `src/app/[locale]/cars/[make]/MakePageClient.tsx` | setContext({ surface: "marketplace-series", seriesId }) on mount. |
| `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx` | setContext({ surface: "car-detail", car }) on mount. |
| `src/app/[locale]/layout.tsx` | Wrapper `<ChatContextProvider>` + mount `<AdvisorDrawer>` global. |
| `src/components/advisor/AdvisorPageShell.tsx` | Lee suggestions de `buildSuggestions(context)` en lugar de array hardcoded. |
| `src/components/report/v3/ExecutiveSummarySection.tsx`, `SpecificCarFairValueBlock.tsx`, `VerdictBlock.tsx` | Tooltips añadidos en las métricas. Sin cambios de datos. |

---

## 8. Componentes que se BORRARON

| Path | LOC | Razón |
|------|-----|-------|
| `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx` | -681 | Replaced por el ReportClient unificado |

---

## 9. Tests añadidos / actualizados

- `src/lib/reports/canAffordReport.test.ts` (6 cases, Vitest)
- `src/lib/advisor/buildSuggestions.test.ts` (3 cases, Vitest)
- `tests/e2e/haus-report.spec.ts` (1 nuevo scenario Playwright para el modal — se ejecuta si `TEST_LISTING_ID` está seteado)

Total: **9 unit tests** + 1 e2e scenario.

---

## 10. Decisiones aplazadas (no incluidas en este branch)

| Item | Razón |
|------|-------|
| PDF / Excel polish | Edgar pidió aplazar |
| Suscripción $59/mes + checkout Stripe + contador FOMO | Pieza grande de monetización, próximo sprint |
| Historial de chats en `/advisor` fullscreen (sidebar izquierdo estilo ChatGPT) | Feature futura, requiere endpoint `GET /api/advisor/conversations` |
| Tooltips i18n | Hoy hardcoded en inglés; si quieres traducción, hay que mover a `messages/*.json` |
| Test fixture errors (`aggregation.test.ts`, `dashboardCache.test.ts`, etc.) | Pre-existentes, no introducidos por este branch |

---

## 11. Qué necesitamos del backend en próximos sprints

Si el roadmap continúa con la suscripción y el Advisor como producto principal, las cosas que el backend debe pensar:

1. **Endpoint de suscripción** (`/api/billing/subscribe`, Stripe) para el item #6 de la reunión con Camilo. Lo va a pedir el banner del reporte y eventualmente el contador FOMO.
2. **Endpoint de listado de conversaciones del Advisor** (`GET /api/advisor/conversations`) para el historial fullscreen en `/advisor` (sidebar izquierdo).
3. **Eventos de uso del Advisor** — analytics de qué chips se hacen click. Hoy son chips estáticos que envían un prompt al endpoint existente; si queremos optimizar, conviene loggear qué surface + sección + chip se usó.

---

## 12. Cómo probar localmente

```bash
# Desde la raíz del repo
git checkout Aura-Maxima-Front
npm install
npm run dev

# Tests
npx vitest run src/lib/reports/canAffordReport.test.ts src/lib/advisor/buildSuggestions.test.ts

# E2E (necesita TEST_LISTING_ID y dev server arriba)
TEST_LISTING_ID=<un-uuid-de-listing-real> npx playwright test tests/e2e/haus-report.spec.ts
```

URLs claves:
- `/en` — dashboard, prueba abrir el chat (FAB esquina inferior derecha) y verás sugerencias del dashboard
- `/en/cars/porsche/<listingId>` — car-detail, sugerencias del chat cambian
- `/en/cars/porsche/<listingId>/report` — preview del reporte, paywall, modal al click "Unlock"
- `/en/cars/porsche/<listingId>/report?mock=v3` — paid layout completo con V3 content
- `/en/advisor` — chat fullscreen (deep link)

---

## 13. Contacto / dudas

Para cualquier duda sobre lo que está en este branch, contactar a Edgar. El spec completo y el plan de implementación están en:

- `docs/superpowers/specs/2026-05-14-aura-maxima-report-rebuild-design.md`
- `docs/superpowers/plans/2026-05-14-aura-maxima-report-rebuild.md`
