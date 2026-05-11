# Handover · `mobile-first-v1` → main

**Generado:** 2026-05-10
**Branch:** `mobile-first-v1`
**Commits ahead of `main`:** 41
**Files changed:** 149
**Naturaleza:** **100% front-end + legal docs.** Cero cambios de API contract, cero migraciones DB, cero scrapers, cero scripts, cero schema.

---

## TL;DR — qué hay aquí

3 grandes bloques de trabajo + 1 paquete legal:

1. **Mobile-first refactor + Editorial Salon polish** (commits `dd…` … `5e7…`)
2. **Auditoría Impeccable + 9 P0 fixes** (commits `4eb…` … `cb9…`)
3. **i18n hardcoded migration — waves 1 + 2** (commits `9da…`, `5e7…`)
4. **Legal compliance package** (commit `aac…`)

Total: **30 commits productivos** firmados, todos con descripción semántica detallada.

---

## ✅ Validación: solo front-end

| Categoría | Tocado | Resultado |
|---|---:|:---:|
| `src/app/api/` (API routes) | 0 archivos | ✅ |
| `supabase/migrations/`, `prisma/` | 0 archivos | ✅ |
| `src/features/scrapers/` | 0 archivos | ✅ |
| `scripts/` | 0 archivos | ✅ |
| `src/lib/supabase/server`, `admin` | 0 archivos | ✅ |
| Backend libs (logic) | 0 archivos | ✅ |

**Excepciones — todas son cambios de display/copy, no de lógica:**

| Archivo | Cambio | Naturaleza |
|---|---|---|
| `src/lib/ai/prompts.ts` | `"Monza Lab AI"` → `"MonzaHaus AI"` en 3 system prompts | Display string (LLM persona) |
| `src/lib/payments/plans.ts` | Badge `"LEGACY UNLIMITED"` → `"Most popular"` | Display string |
| `next.config.ts` | `+ devIndicators.position: "bottom-right"` | Dev-only cosmetic |
| `src/features/social-engine/**` | Paleta v2.0 (burgundy) → v2.1 (Heritage Lavender) en CSS tokens | Brand assets, no productivo UI |

**Cero cambios de:** API contracts · request/response shapes · DB schema · environment variables required (NEXT_PUBLIC_META_PIXEL_ID ya existía) · auth flow · payment flow · subscription tiers (precio + Pistons amount intactos).

---

## Bloque 1 — Mobile-first refactor + Salon polish

Commits clave (ordenados temporalmente): `dd…ddb3728` (advisor pill desktop), `9741c54` (advisor contextual bands), `399ef6f` (header route-aware), `48fed68` (region pills home).

**Lo que cambió:**
- Bottom nav mobile: Home · Advisor · Search · Account (Explore reemplazado por Advisor)
- Header desktop route-aware (de 11 elementos a 6-7 según ruta)
- AccountSheetContent shared component (TÚ side, mobile + desktop parity)
- AdvisorBand contextual cross-breakpoint (home, car detail, report) con prompt pre-poblado vía `?prompt=` query param
- Honest-by-data: `buildRegionalFairValue` ya no fabrica band, retorna null cuando no hay comps; UI muestra "Awaiting comparable sales"
- "Tesis: intelligence, not a marketplace" tagline en `/browse`
- ALL Sparkles/Wand2/Bot/Brain icons removidos (memoria `feedback-no-ai-iconography`)

**Decisiones:** `docs/decisions/`
- `advisor-in-bottom-nav.md`
- `advisor-desktop-pill.md`
- `advisor-contextual-bands.md`
- `account-vs-menu-split.md`
- `desktop-account-button.md`
- `header-route-aware-cleanup.md`
- `search-redesign.md`
- `advisor-tool-call-ux.md`
- `porsche-only-ui.md`
- `advisor-empty-state-redesign.md`
- `mobile-first-v1-report.md`

---

## Bloque 2 — Auditoría Impeccable + 9 P0 fixes

Auditoría inicial: `docs/audits/impeccable-2026-05-10.md` (entregable estructurado P0/P1/P2).

**P0 cerrados:**

| # | Fix | Commit |
|---|---|---|
| P0.9 | Brand leak `Monza Lab` → `MonzaHaus` en 15 archivos metadata/UI | `4ebb2c4` |
| P0.5 | Ruta `/ferrari` eliminada · Sidebar.tsx dead code removido · HeroSection + Filters Porsche-only | `4ebb2c4` |
| P0.2 | Sparkles + Brain icons → Piston/Scale | `4ebb2c4` |
| P0.4 | 8× gradient text (`bg-clip-text`) → solid color + tabular-nums + Cormorant | `099e287` |
| P0.3 | 14× border-left>1px (Impeccable BAN 1) → bg tint / borde completo / italic serif | `2c604fc` |
| P0.1 | Cards `<div role="link">` → `<Link>` (3 archivos): habilita SEO de Haus Index + Cmd+Click + a11y | `918c9ed` |
| P0.6 | `/account` loader copy off-context arreglado (era "Loading cars") | `7e16547` |
| P0.7 | `/cars/porsche` cold load empty → spinner mientras carga | `7e16547` |
| P0.8 | Card images broken → SafeImage fallback editorial | `7e16547` |

**P1 + P2 cerrados:** Tab title pattern unificado, focus-visible coverage, modal audit, pricing Rennsport elevation visual ("Most popular"), pricing eyebrow softer, search typing animation slower, /knowledge expansión validada (8 articles ya existen). Commit `cb9e1d1`.

**Métricas verificadas en navegador:**

| Antes | Después |
|---|---|
| 0 anchors `<a href>` en cards | **120 anchors** (Haus Index indexable) |
| 120 `[role="link"]` divs | **0** |
| 14 `border-l/r >1px` | **0** |
| 2 AI icons (Sparkles, Brain) | **0** |
| 8 gradient text | **0** |

---

## Bloque 3 — i18n hardcoded migration

**Antes:** 434 marcadores `[HARDCODED]` en JSX (UI no traducible a `es/de/ja`).

**Wave 1 (commit `9dab151`):** Header.tsx + pricing/page.tsx — 50 strings → `t()`. Keys nuevas en `nav.*` + `pricing.*`.

**Wave 2 (commit `5e77414`):** MobileBottomNav.tsx + AccountSheetContent.tsx — 35 strings → `t()`. Keys nuevas en `mobile.*` + `accountSheet.*`.

**Total:** 434 → 358 markers (-76, -17.5%).

**Pendiente Wave 3:** CarDetailClient.tsx (130), DashboardClient.tsx (26), 8 report blocks (~70). Mecánico, sin decisiones de UX. ~3-4 horas para sesión separada.

---

## Bloque 4 — Legal compliance (commit `aacd553`)

Aligna front-end con la Privacy Policy v1.0 madre firmada (April 28, 2026) que cubre los 3 dominios bajo Monza Lab LLC. Source: `monza lab/Empresa/LLC-USA/03-Compliance-Policies/Privacy-Policy.pdf` + `IMPLEMENTATION-GUIDE.md`.

### Documentos producidos

| Documento | URL | Idiomas |
|---|---|---|
| Privacy Policy v1.0 | `/legal/privacy` | EN, ES, DE, JA |
| Cookie Policy | `/legal/cookies` (nuevo) | EN, ES, DE, JA |
| Terms of Service | `/legal/terms` (reescritos) | EN, ES, DE, JA |

**Privacy Policy** — texto canónico del PDF madre + adiciones derivadas de research GDPR/CCPA 2026:
- 14 secciones cubriendo collection, use + GDPR legal basis por purpose, AI Advisor disclosure (Anthropic + Google), sub-processors table con countries y transfer mechanisms, EU/UK Article 27 representative (placeholder TBD), CCPA/CPRA + GPC honor + Do-Not-Sell-or-Share via cookies.
- Identidad: Monza Lab LLC, EIN 30-1486916, Miami FL.

**Cookie Policy** (nuevo):
- Tabla completa de cookies + storage keys con `name / vendor / purpose / duration / category`.
- Categorías: Essential / Analytics / Advertising.

**Terms of Service** (reescritos completamente):
- 17 secciones. Wyoming SMLLC + Stripe + AI Advisor disclaimer + listings de terceros.
- Liability cap = max(12 months payments, $100).
- Wyoming governing law + JAMS arbitration en Cheyenne + class-action waiver + 30-day arbitration opt-out + small claims carve-out.
- EU/UK consumer rights preserved (no se pueden contractar away).

### Consent infrastructure (front-only)

`src/components/legal/`:
- **`ConsentProvider.tsx`** — context + localStorage `monzahaus_cookie_consent` + auto-honor `navigator.globalPrivacyControl` (GPC).
- **`ClientTrackers.tsx`** — gates Vercel Analytics + Speed Insights + Meta Pixel detrás de `consent === "accepted"`. **Cero trackers cargan en pending o rejected.**
- **`CookieBanner.tsx`** — editorial Salon, fixed bottom-right desktop / full-bottom mobile. Reject all + Accept all en MISMA layer, igual prominence (no Accept verde / Reject gris dark patterns).

`app/layout.tsx`: removidos los direct mounts de Analytics, SpeedInsights, Meta Pixel `<Script>` y noscript `<img>`. Movidos a `app/[locale]/layout.tsx` donde `NextIntlClientProvider` existe (banner usa `useTranslations()`).

### Footer

`AppFooter.tsx` ahora muestra: copyright `© 2026 Monza Lab LLC` · Privacy · Terms · **Cookies** (nuevo).

### Pendiente legal — flags para review antes del launch público

1. **EU + UK Article 27 Representative** — REQUIRED para servicios a EU residents (research crítico). Servicios: VeraSafe, GDPR-Rep.eu, DPO Europe (~€200-500/año). Doc tiene placeholder *"To be appointed before EU launch."*
2. **Email alias `privacy@monzalab.com`** — recomendado por Implementation Guide (Google Workspace alias forward a edgar@).
3. **Privacy notice link en signup form** — agregar `By creating an account, you agree to our Terms and Privacy Policy.` en `AuthModal`.
4. **Newsletter opt-in checkbox** — solo aplica si activan newsletter.
5. **Email marketing footer con Miami address** — solo si activan Mailchimp/Beehiiv.
6. **Review por abogado US licensed** — especialmente arbitration + class-action waiver clauses (jurisprudencia evoluciona). Puede ser revisión rápida (30-60 min) porque la base es la policy madre firmada de la LLC.

### Archivos legales tocados

```
src/app/[locale]/legal/privacy/page.tsx        ← reescrito completo
src/app/[locale]/legal/terms/page.tsx          ← reescrito completo
src/app/[locale]/legal/cookies/page.tsx        ← nuevo
src/components/legal/ConsentProvider.tsx       ← nuevo
src/components/legal/ClientTrackers.tsx        ← nuevo
src/components/legal/CookieBanner.tsx          ← nuevo
src/components/layout/AppFooter.tsx            ← + link Cookies
src/app/layout.tsx                              ← removido direct trackers
src/app/[locale]/layout.tsx                    ← + ConsentProvider/Tracker/Banner
messages/{en,es,de,ja}.json                    ← + cookies + footer.cookies
```

---

## Deployment notes — qué necesita el merge

### Variables de entorno

**Cero variables nuevas requeridas.** La consent infrastructure usa `NEXT_PUBLIC_META_PIXEL_ID` que ya existe.

### Build / runtime

- **No se requiere migración DB.** Cero schema changes.
- **Build pasa limpio** (typecheck OK; los errores que aparecen son tests pre-existentes en `dashboardCache.test.ts` no relacionados con los cambios de este branch).
- **Sin breaking changes.** Todos los componentes que usan APIs del producto siguen funcionando idéntico.
- **Cookie banner por default = pending.** Después del deploy, **todos los usuarios verán el banner una vez** (incluso usuarios existentes). Esto es comportamiento correcto — no es regresión, es compliance.

### Performance — pequeño cambio observable

Los users que rechacen cookies dejarán de aparecer en Vercel Analytics y Speed Insights. Eso reduce los datos disponibles en esos dashboards pero es **lo correcto bajo GDPR**. Si querían mantener los datos de tracking previos, no lo borramos — solo dejamos de capturar usuarios que rechazan.

### Smoke test post-merge

1. `/en` → home renderea + cookie banner aparece bottom-right primera visita
2. Click "Reject all" → banner desaparece + verificar en DevTools Network que no hay calls a `connect.facebook.net` o `vitals.vercel-insights.com`
3. Click "Accept all" en otra sesión → trackers cargan
4. `/en/legal/privacy`, `/cookies`, `/terms` → todas renderean
5. Cambiar a `/es/legal/privacy` → renderea traducción
6. `/en/cars/porsche` → cards son `<a href>` (Cmd+Click abre nueva pestaña)
7. `/en/ferrari` → 404
8. Footer desktop → 4 elementos: copyright + Privacy + Terms + Cookies

### Rollback plan

Branch contiene 41 commits independientes. Si un commit específico tiene issue, se puede revertir individualmente sin afectar los otros. La mayoría de commits son self-contained (un fix, un feature). Los commits del legal package (`aacd553`) son los más extensos pero un revert solo restaura los `/legal/*` previos y deja banner desactivado.

---

## Documentación generada en este branch

Estructurada para que cualquier reviewer entienda **por qué** se hizo cada cambio:

```
docs/decisions/                          ← decisiones de arquitectura/UX
  ├── account-vs-menu-split.md
  ├── advisor-contextual-bands.md
  ├── advisor-desktop-pill.md
  ├── advisor-empty-state-redesign.md
  ├── advisor-in-bottom-nav.md
  ├── advisor-tool-call-ux.md
  ├── desktop-account-button.md
  ├── header-route-aware-cleanup.md
  ├── porsche-only-ui.md
  └── search-redesign.md

docs/audits/
  └── impeccable-2026-05-10.md           ← auditoría exhaustiva + P0/P1/P2

docs/handover/
  └── mobile-first-v1-handover.md        ← este documento

docs/mobile-first-v1-report.md           ← reporte parcial inicial
.impeccable.md                            ← Design Context para futuras sesiones
```

---

## Recomendación de merge

1. **Squash NO**, prefiero merge commit que preserve los 41 commits. Cada uno es atómico y descrito; un `git log --oneline main..mobile-first-v1` posterior será un changelog usable.
2. **Si la branch protection lo requiere:** rebase + merge OK. Squash perdería el granular history pero preservaría el contenido.
3. **PR Title:** `Mobile-first v1 — refactor, Impeccable audit, i18n waves 1+2, legal compliance`
4. **PR Body:** copiar el TL;DR de este documento.
5. **Reviewers:** front-end (estructural review) + posiblemente abogado (review legal del 30 min — los textos están alineados con la policy madre firmada, pero arbitration clauses pueden necesitar refinement).
