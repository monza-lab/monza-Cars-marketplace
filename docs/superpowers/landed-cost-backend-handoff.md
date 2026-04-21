# Landed Cost — Backend Handoff (Fase 1)

**Status:** Research + implementation plan ready. Zero code changes yet. Backend to execute.
**Branch:** `feat/landed-cost`
**Spec:** [`specs/2026-04-21-landed-cost-research-program-design.md`](specs/2026-04-21-landed-cost-research-program-design.md)
**Plan:** [`plans/2026-04-21-landed-cost-fase-1-implementation.md`](plans/2026-04-21-landed-cost-fase-1-implementation.md)
**Contact:** Edgar Navarro — edgar@monzalab.com

---

## TL;DR

El landed-cost estimator ya está live en `feat/landed-cost` (detail-page teaser + Haus Report 6-line breakdown + SourcesBlock). La data es estática en TypeScript (`src/lib/landedCost/*`), con rangos anchos (~47% de spread en shipping) que rinden como "industry average" pero no como "trust me, this is the number."

**Este handoff construye Fase 1** del programa de research continuo:

1. **Aprieta los rangos** de 12 rutas de shipping (47% → ≤25% promedio), más port/broker y registration por destino. Research es desk-only (gov sites + published carrier rates + Hagerty/BaT), sin carrier quote forms en Fase 1.
2. **Agrega multiplicador por familia Porsche** (`standard 1.00x` / `premium 1.15x` / `exotic 1.35x` / `heritage 1.10x`) mapeado sobre los seriesIds de `brandConfig.ts` ya existentes.
3. **Deja un playbook mensual** (`docs/landed-cost/monthly-playbook.md`) para repetir el ciclo.
4. **Versiona el snapshot** en `src/lib/landedCost/data/versions/2026-05.json` para diffing futuro.

**Supabase migration de las tablas queda explícitamente fuera de scope (Fase 2).** Mantener todo en TypeScript por ahora.

---

## Framework estratégico — contexto antes de ejecutar

Este trabajo sirve dos tiers, y los dos agentes/devs deben entender la diferencia:

| | **Tier-1 — Static, free, all users** | **Tier-2 — Live agent, paid only** |
|---|---|---|
| **Qué es** | Tablas pre-computadas actualizadas mensualmente | Agente on-demand que trae el número exacto por VIN |
| **Precisión** | "Close enough to trust" (±10-15%) | "The number" (±3%) |
| **Fuentes** | Gov sites + published carrier rates | Live carrier APIs + customs broker LLMs + compliance per-VIN |
| **Fase** | **Fase 1 = este handoff** | Fase 3+ (diseño futuro) |

La data de Tier-1 debe ser defendiblemente cercana al valor real, no perfecta. El agente de Tier-2 es el que cobra por precisión exacta. No sobre-invertir en Fase 1.

---

## Decisiones ya lockeadas (no re-abrir)

1. **No VA outreach en Fase 1** → desk research only, target shipping ≤25% spread.
2. **Listings fuera de scope** (Cayenne, Macan, Panamera, Taycan, 718, 914, Boxster, Cayman): el calculator recibe seriesId pero `getShippingMultiplier` devuelve 1.0 para series no-Tier-1. La UI ya renderea el teaser normal; añadir footnote "Family-specific handling not available" es opcional y puede quedar para otro PR.
3. **Supabase migration** de las tablas de landed-cost: **NO en Fase 1**. Todo sigue en TS source files. Migración a Supabase es Fase 2 cuando tengamos 2-3 ciclos de datos de volatilidad.
4. **Tightness targets** son los del spec §3.4 ("trust-the-number" level), no "near Tier-2".

Detalles en spec §9.

---

## Scope — los números que se aprietan

**Destinations:** US, DE, UK, JP (sin cambio).

**Origins:** US, DE, UK, JP + IT/BE/NL proxied as DE (sin cambio).

**Porsche families (18 seriesIds de `brandConfig.ts`, agrupados en 4 handling tiers):**

| Tier | Series IDs | Multiplier |
|---|:---|---:|
| `standard` | 992, 991, 997, 996, 912, 944, 928, 968, 924 | 1.00x |
| `premium` | 993, 964, 930, g-model, f-model | 1.15x |
| `exotic` | 918, carrera-gt, 959 | 1.35x |
| `heritage` | 356 | 1.10x |

**Cost lines y targets:**

| Línea | Spread actual | Target Fase 1 | Método |
|---|:---:|:---:|:---|
| Shipping | ~47% | ≤25% | desk research, ≥2 data points por ruta |
| Port & broker | ~45% | ≤20% | broker schedules publicados |
| Registration | ~60% | ≤30% | DMV/DVLA/KBA/Rikuun |
| Duty (HS 8703) | exacto | verify + date bump | gov sites (HTS, TARIC, UK Tariff, JP Customs) |
| VAT / sales tax | exacto | verify + date bump | gov sites + Avalara |
| Marine insurance | 1.5-2.5% | mantener (annual) | Lloyds industry standard |

---

## Archivos que toca este plan

**NUEVOS:**

```
src/lib/landedCost/
├── familyMultipliers.ts                          # handling tier map + multipliers
├── __tests__/familyMultipliers.test.ts           # unit tests
└── data/versions/2026-05.json                    # frozen snapshot

docs/landed-cost/
├── sources-2026-05.md                            # canonical number → source → date
├── CHANGELOG-v1-to-v2.md                         # narrative diff v1 → v2
├── monthly-playbook.md                           # SOP para repetir mes a mes
└── research-2026-05/
    ├── duty-verification.md
    ├── tax-verification.md
    ├── shipping-research.md                      # 12 rutas, ≥2 data points c/u
    ├── port-broker-research.md
    └── registration-research.md
```

**MODIFICADOS:**

```
src/lib/landedCost/
├── types.ts              # + SeriesId, HandlingTier; CarInput.seriesId?: SeriesId
├── calculator.ts         # aplica multiplier al shipping range (2 líneas de lógica)
├── shipping.ts           # nuevos rangos (research outputs)
├── fees.ts               # nuevos port/broker + registration
├── duties.ts             # lastReviewed bump (+ rate si hay cambio gov)
├── taxes.ts              # lastReviewed bump (+ rate si hay cambio gov)
├── index.ts              # export nuevos types/helpers
└── __tests__/calculator.test.ts  # casos para multiplier + 1 assertion spread

src/app/api/analyze/route.ts                       # 2 líneas: deriva seriesId vía extractSeries() y lo pasa
src/app/[locale]/cars/[make]/[id]/page.tsx         # 2 líneas: idem (server component)
```

**Impacto UI:** cero. Ningún componente React visual se toca. Los números del teaser cambian (rangos más apretados + multiplier por familia) — eso ES el objetivo del trabajo.

---

## Estructura del plan (22 tareas, 5 fases)

| Fase | Tasks | Qué produce |
|---|:---|:---|
| **A — Research** | 1-6 | 6 markdown files con source URLs + fechas verificadas |
| **B — Code scaffolding (TDD)** | 7-12 | types + familyMultipliers.ts + calculator integration + tests |
| **C — Data refresh** | 13-15 | shipping.ts / fees.ts / duties.ts / taxes.ts con v2 values + lastReviewed bump |
| **D — Callers** | 16-17 | page.tsx + route.ts pasan seriesId derivado (`extractSeries()`) |
| **E — Packaging** | 18-22 | CHANGELOG, snapshot JSON, playbook SOP, worked examples re-run, PR |

Cada task en el plan tiene paths exactos, código completo (no placeholders en pasos de código), comandos con output esperado, tests antes de implementación (TDD), y commit message al final. Pensado para ejecutarse task-by-task — commits frecuentes.

**Dónde empezar:** Task 1 del plan. Las tareas 1-6 son secuencialmente independientes entre sí (research puro), así que pueden despacharse a 5 agentes en paralelo si usas subagent-driven-development. Tasks 7+ tienen dependencias entre sí.

---

## Cómo orientar a los agentes

Si están usando Claude Code con los skills de `superpowers`:

> Skill recomendado: `superpowers:subagent-driven-development` — despacha un subagent fresco por tarea, review entre tareas. El plan está escrito con ese flow en mente.
>
> Alternativa: `superpowers:executing-plans` — ejecución inline con checkpoints.

Al arrancar, el agente debe leer en este orden:

1. Este doc (orientación + decisiones lockeadas)
2. `specs/2026-04-21-landed-cost-research-program-design.md` — el por qué
3. `plans/2026-04-21-landed-cost-fase-1-implementation.md` — el cómo, paso a paso

**Convenciones del repo** (también en `CLAUDE.md`):

- `npm run dev` usa `--webpack`
- Commit style: `feat(landed-cost): ...` / `docs(landed-cost): ...` / `fix(landed-cost): ...`
- Después de cualquier problema de npm/git: `rm -rf .next` antes de re-arrancar dev server
- Siempre push después de commit (evita corrupción)
- Branch de trabajo: `feat/landed-cost` (no crear nuevo)

---

## Validation gate antes del merge

Checklist de review para Edgar (también en el PR body del Task 22):

- [ ] `sources-2026-05.md` — toda línea del v2 tiene URL y fecha
- [ ] `shipping.test.ts` — assertion de spread ≥10/12 rutas cumpliendo ≤25%
- [ ] Ningún cambio >10% sin explicación en CHANGELOG
- [ ] 4 worked examples re-run, teasers documentados, deltas >5% justificados
- [ ] Full suite verde: `npx vitest run`, `npx tsc --noEmit`, `npx eslint src/lib/landedCost/`
- [ ] Smoke manual: abrir listing de 993, 992, 918, 356 y verificar teaser (con multiplier); abrir Cayenne y verificar teaser (sin multiplier, mismo resultado que v1 en esa ruta)

---

## Fuera de scope (NO hacer en este handoff)

- Supabase migration de las tablas → Fase 2
- Carrier quote forms / VA / retainer con freight forwarder → Fase 2 si Edgar lo decide
- Per-state US sales-tax granularity → futuro
- EPA/DOT compliance cost modeling (sub-25-yr US imports) → futuro advisory line
- Tier-2 live-agent design → Fase 3
- Non-Porsche makes (Ferrari, BMW) → Fase 3+
- Cambios visuales / componentes UI / copy — ninguno
- Rediseño del detail page o del Haus Report — ninguno

Si algo de esto aparece como "oportunidad" durante la ejecución: anotarlo, NO ejecutarlo. Ship Fase 1 como especifica el plan.

---

## Preguntas → Edgar

Cualquier ambigüedad del plan o decisión que no esté explícitamente lockeada arriba: preguntar por Slack/email antes de decidir. Mejor pausar 1 hora que tomar una decisión que después haya que deshacer.
