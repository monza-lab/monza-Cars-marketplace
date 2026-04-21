# Landed Cost Research Program — Design Spec

**Date:** 2026-04-21
**Author:** Edgar Navarro + Claude (Monza Lab)
**Branch:** `feat/landed-cost`
**Status:** Draft · awaiting Edgar review
**Related:** `~/Downloads/MonzaHaus-LandedCost-Review-2026-04-20.md` (externally-facing specialist review package), `src/lib/landedCost/`

---

## 1. Context

Monza Haus (Porsche-first collector-car marketplace) ships a **landed-cost estimator** at listing level. Today (`feat/landed-cost`) the module is a set of static TypeScript tables in `src/lib/landedCost/`:

- 4 destinations: US, DE, UK, JP
- 7 origins: US, DE, UK, JP + Italy/Belgium/Netherlands (proxied as DE)
- 6 cost lines: shipping, marine insurance, customs duty, VAT/sales tax, port & broker, registration
- 1 flat range per route (no per-model variation)

**The problem:** the current ranges are too wide (e.g., shipping DE→US = $2,800–$5,200, a 47% spread). A 47% spread on a $300k car is a $7,200 swing on shipping alone — credible for "industry average," not credible for a buyer about to click "Buy Now."

**What this spec does:** defines the research program that turns v1 (static, desk-researched, 47% spreads) into v2 (defendable ranges per Porsche family, tighter spreads, sourced fresh every month).

---

## 2. Strategic framework — Tier-1 vs Tier-2

This is the single most important decision of the program. Internalize it before reading anything else.

| | **Tier-1 — Static, free, all users** | **Tier-2 — Live agent, paid only** |
|---|---|---|
| **Who sees it** | All marketplace visitors (detail-page teaser + free-tier Haus Report preview) | Paid Haus Report buyers + monthly subscribers |
| **What it is** | Pre-computed ranges from static tables maintained monthly | On-demand agent that fetches the exact number for *this specific VIN* at query time |
| **Accuracy goal** | "Close enough to trust" — ±10-15% on total landed cost | "The number" — within ±3% of what the buyer will actually pay |
| **Data source** | Monthly-refreshed tables in backend DB | Live carrier APIs + customs broker LLMs + VIN-specific compliance lookups |
| **Phase** | Bootstrap starts **now** (Fase 1-3 of this spec) | Medium-term, designed **after** Fase 2 has generated operational learnings |

**The principle:** the static data does not need to be perfect. It needs to be *credible enough* that a free-tier visitor trusts Monza Haus as a source. The paid agent is the one that earns its keep on precision. Everything in this spec is in service of Tier-1; Tier-2 is a deliberate downstream project informed by what we learn in Fase 1-2.

---

## 3. Scope — what we're getting more accurate about

### 3.1 Destinations (unchanged)

| Destination | Currency | Live FX handling |
|---|:---:|:---|
| United States | USD | N/A (base) |
| Germany | EUR | Live spot via existing FX service |
| United Kingdom | GBP | Live spot via existing FX service |
| Japan | JPY | Live spot via existing FX service |

### 3.2 Origins (unchanged)

| Origin | Handling |
|---|:---|
| US, DE, UK, JP | Direct route |
| IT, BE, NL | Proxied as DE (explicit visible note) |

### 3.3 Porsche families in scope (locked — Option B)

Mapped to existing `brandConfig.ts` seriesIds so the data integrates cleanly with the taxonomy. Note: Option B was discussed in terms of ~12 "collector families" — in `brandConfig.ts` each generation is its own seriesId, which gives a more granular count of **18 seriesIds across 4 family groups**. Same scope, higher-resolution taxonomy.

| Family group | Series IDs | Rationale |
|---|:---|:---|
| **911 Family** | `992, 991, 997, 996, 993, 964, 930, g-model, f-model, 912` | Core marketplace inventory. All collector-grade. |
| **GT & Hypercars** | `918, carrera-gt, 959` | Highest-ticket cars. Specialized handling. |
| **Heritage** | `356` | Highest-ticket vintage. Delicate. |
| **Transaxle Classics** | `944, 928, 968, 924` | Only performance variants (Turbo/S/GTS) drive collector tickets; shipping weight class grouped with 911 air-cooled. |

**Explicitly excluded (out of Tier-1 scope):**

| Series | Reason |
|---|:---|
| `cayenne, macan, panamera, taycan` | SUV/sedan — low collector ticket, not Monza Haus core |
| `718-cayman, 718-boxster, cayman, boxster, 914` | Lower ticket; not aligned with MonzaHaus positioning |

If a listing falls outside Tier-1 scope, the estimator either (a) falls back to the route-base range without per-family adjustment, or (b) hides the landed-cost teaser. Decision deferred to implementation plan.

### 3.4 Cost lines — targets per line

| Line | v1 status | Fase 1 target | Why |
|---|:---|:---|:---|
| Shipping | 47% spread avg | ≤25% spread + per-family multiplier | Biggest variable; biggest trust-builder |
| Marine insurance | 1.5-2.5% of CIF | Keep (stable industry standard) | Slow-changing; verify once/year |
| Customs duty | Exact (gov rate) | Verify against current HTS/TARIC | Gov data; cheap to re-verify |
| VAT / sales tax | Exact (gov/Avalara) | Verify + add state-level US note | Gov data; cheap to re-verify |
| Port & broker | ~45% spread | ≤20% spread | Published broker schedules are researchable |
| Registration | ~60% spread | ≤30% spread | DMV-style public data |

---

## 4. Roadmap — 3 fases (~4 meses)

### Fase 1 — Bootstrap (Mes 1, 2026-04-21 → 2026-05-21)

**Objetivo:** publicar v2 de la data con rangos defendibles para 4 destinos × 7 orígenes × 18 seriesIds agrupados en 4 handling tiers (`standard`, `premium`, `exotic`, `heritage`).

**Scope:**
- Shipping: rango base por ruta × multiplicador por handling-tier (research nuevo)
- Duty, VAT, age rules: verificados contra HTS, TARIC, UK Tariff, Japan Customs
- Port/broker/registration: rangos refinados contra CBP/HMRC/Zoll/Nippon Customs published schedules
- Marine insurance: 1.5-2.5% (re-verificado, no cambiar si es industry standard)
- FX: runtime (ya está)

**Entregables:**
- `src/lib/landedCost/data/` v2 — tablas actualizadas
- `src/lib/landedCost/familyMultipliers.ts` — nuevo archivo con handling-tier map + multipliers
- `docs/landed-cost/sources-2026-05.md` — cada número linkea a fuente + fecha verificada
- `CHANGELOG-v1-to-v2.md` — diff por categoría, con explicación de cada cambio material
- Worked examples doc actualizado (los 4 ejemplos del spec externo, re-calculados con data v2)

**Quién:** Claude ejecuta todo el research. Edgar revisa PR antes de deploy.

**Validation gate antes de deploy:**
- Todo número nuevo tiene source con URL + lastReviewed date
- Spread targets (§3.4) se cumplen en ≥80% de las filas (excepciones justificadas en changelog)
- Los 4 worked examples cierran consistentes con el output del calculador

### Fase 2 — Operación (meses 2-3, 2026-05-21 → 2026-07-21)

**Objetivo:** 2 ciclos mensuales más en modo A (Claude-led). Medir qué se mueve, qué no, qué es ruido vs señal real. Construir el dataset para decidir qué automatizar en Fase 3.

**Entregables por ciclo:**
- PR mensual (`monthly-update-2026-06`, `monthly-update-2026-07`) con:
  - Nueva fecha `lastReviewed` en todas las sources tocadas
  - Diff tabulado en el PR description
  - "What changed and why" narrative
  - Worked examples re-run

**Al final de Fase 2 (2026-07-21), entregar:**
- `docs/landed-cost/lessons-learned-fase-2.md`:
  - Volatilidad por categoría: % filas que cambiaron material mes a mes
  - Confiabilidad por fuente: cuáles respondieron, cuáles no, cuáles tenían cambios inesperados
  - Categorías que nunca cambiaron: candidatas a cadence reducida
  - Fuentes scraping-friendly vs fuentes que requieren intervención humana
- Decision doc: "¿Qué partes migran a modo C event-driven?"

### Fase 3 — Automation + especialización (mes 4+, 2026-08+)

**Objetivo:** graduarse a modo C (event-driven) para partes estables + incorporar validación externa trimestral.

**Entregables:**
- Cron scheduled (GitHub Actions o Vercel Cron) que monitoriza:
  - Gov sites (HTS, TARIC, UK Tariff, JP Customs) — diffing HTML/API
  - Published carrier rate cards (donde existan) — diffing
  - Avalara US sales-tax updates
- Trigger: delta >X% o cambio regulatorio → crea PR automático con el cambio sugerido
- Primer especialista contratado (freight forwarder o customs broker): 1 hora/trimestre, $150-300/call, revisa rangos y flags
- Design doc: **Tier-2 live agent** — arquitectura del agente on-demand para paid users (usa Fase 1-2 como ground truth baseline)

---

## 5. Data architecture

### 5.1 Current structure (v1 — TS-only, in source)

```
src/lib/landedCost/
├── shipping.ts      # route × route matrix, flat ranges
├── duties.ts        # destination → rate + age exemption
├── taxes.ts         # destination → rate + age reduction
├── fees.ts          # destination → marine %, port+broker, registration
├── calculator.ts    # main compute
├── originMap.ts     # IT/BE/NL → DE proxy
├── localeMap.ts     # URL locale → destination
├── format.ts        # output formatting
├── types.ts
└── index.ts
```

### 5.2 Proposed structure (v2)

**Additions, not rewrites:**

```
src/lib/landedCost/
├── ... (v1 files)
├── familyMultipliers.ts   # NEW: seriesId → handlingTier → multiplier
└── data/
    └── versions/
        └── 2026-05.json   # snapshot of all tables this month
```

**New file: `familyMultipliers.ts`** — maps each in-scope `seriesId` to a handling tier, and each tier to a shipping multiplier:

```ts
export type HandlingTier =
  | "standard"       // daily-use collectors, $50k-$300k
  | "premium"        // high-value performance, $300k-$1M
  | "exotic"         // hypercars, $1M+ — white-glove required
  | "heritage";      // vintage delicate handling (356, pre-1964 911)

export const SERIES_HANDLING_TIER: Record<SeriesId, HandlingTier> = {
  // 911 family — mostly standard, with performance premiums by trim
  "992": "standard", "991": "standard", "997": "standard", "996": "standard",
  "993": "premium",  "964": "premium",  "930": "premium",
  "g-model": "premium", "f-model": "premium", "912": "standard",
  // GT & hypercars — all exotic
  "918": "exotic", "carrera-gt": "exotic", "959": "exotic",
  // Heritage
  "356": "heritage",
  // Transaxle
  "944": "standard", "928": "standard", "968": "standard", "924": "standard",
};

export const HANDLING_TIER_SHIPPING_MULTIPLIER: Record<HandlingTier, number> = {
  standard: 1.00,
  premium:  1.15,
  exotic:   1.35,
  heritage: 1.10,
};
```

**Note:** "performance trim premium" (e.g., 992 GT3 RS is pricier to ship than 992 Carrera T) is *not* modeled in Tier-1. It would require per-trim data which Tier-1 explicitly does not promise. Trim-level precision is a Tier-2 live-agent responsibility.

**Shipping calc becomes:**

```
baseRange = SHIPPING_RATES[origin][destination]   // existing matrix
tier      = SERIES_HANDLING_TIER[seriesId]
mult      = HANDLING_TIER_SHIPPING_MULTIPLIER[tier]
shipping  = { min: baseRange.min * mult, max: baseRange.max * mult, currency: ... }
```

### 5.3 Versioned snapshots

Every monthly update writes a JSON snapshot to `src/lib/landedCost/data/versions/YYYY-MM.json` — full frozen picture of every table + sources + lastReviewed. This lets us:
- Diff any two months programmatically
- Reproduce old calculations if a listing referenced v-old data
- Build the "volatility by category" metric in Fase 2

### 5.4 Backend ownership (medium-term, not Fase 1)

Today the tables are in TS source. Edgar's directive: *"la data debe vivir en el backend."* This is correct for Tier-2 and also for Tier-1 as we grow. Proposal:

- **Fase 1:** keep tables in TS source (fast iteration, no infra change needed)
- **Fase 2:** migrate tables to Supabase (`landed_cost_rates` table + `landed_cost_sources` table). Frontend reads via SSR or API route. PR review workflow remains — migrations are just seed SQL now instead of TS edits.
- **Fase 3:** Supabase is the source of truth. Tier-2 agent reads the same tables to ground its outputs.

**Deferring to Fase 2** keeps Fase 1 focused on data quality, not schema migration. We don't want to conflate "is the number right?" with "is the schema right?" in the same PR.

---

## 6. Monthly research playbook (the SOP)

This section is the operating manual. Every month, Claude (or whoever runs the cycle) executes these steps in order.

### Step 1 — Open the monthly PR shell

- Branch: `landed-cost/monthly-YYYY-MM`
- Stub `CHANGELOG-monthly-YYYY-MM.md` with skeleton sections per category
- Copy previous month's `sources-YYYY-MM.md` → new date

### Step 2 — Gov data refresh (duties, taxes) — ~30 min

For each destination, verify the rate in source and age exemption:

| Destination | Primary source | Check |
|---|:---|:---|
| US duty | hts.usitc.gov (Heading 8703) | rate still 2.5%? 25-yr exemption still in effect? |
| US tax | Avalara state averages | 6% still the published average? Add footnote for CA range |
| DE duty | taxation-customs.ec.europa.eu (TARIC 8703) | 10%? any EU trade deal changes? |
| DE VAT | Bundesministerium der Finanzen | 19% standard, 7% H-Kennzeichen? |
| UK duty | gov.uk/trade-tariff | 10% / 5% historic (≥30 yrs)? |
| UK VAT | gov.uk/vat-rates | 20% / 5% historic? |
| JP duty | customs.go.jp | 0% confirmed? |
| JP tax | nta.go.jp | 10% consumption tax confirmed? |

**Output:** update `lastReviewed` dates in `duties.ts` and `taxes.ts`. If any rate changed, log in changelog and note whether historical-in-flight listings need recalculation.

### Step 3 — Shipping research — ~3 hours

For each of the 12 routes, pull at least 2 current data points:

**Data sources (ordered by reliability):**
1. **Published rate cards** (carrier blog posts, rate PDFs) — most carriers post ballpark ranges
2. **Web quote form submissions** (Schumacher, West Coast Shipping, Kayser have forms) — fill out for a "generic" 1400kg / $100k valued 911, 20ft container shared, port-to-port — one per carrier per route per quarter
3. **Classic-car-shipping industry articles** (Hagerty, BaT shipping guides) — cross-reference
4. **Freightos or Freightcenter aggregated rates** — for container-level ballpark

**Per route, record:**
- Min quoted rate in last 30 days
- Max quoted rate in last 30 days
- # of data points
- Source list

Update `shipping.ts` with the tighter range. Flag any route where <2 data points available — those stay at v1 value with an "insufficient data" note in changelog.

### Step 4 — Family multipliers sanity check — monthly is overkill, do quarterly

Per-family shipping multipliers change slowly (car weights don't change). Re-verify only:
- Once per quarter
- When a new series enters scope
- When a carrier flags handling-tier rate changes (e.g., "white-glove surcharge increased 10%")

### Step 5 — Port & broker + registration refresh — ~1 hour

For each destination, re-check the broker schedule + DMV/DVLA/KBA/Rikuun averages. These rarely move >5% mo/mo; most months this is a 15-minute re-verify pass.

### Step 6 — Marine insurance — yearly only

1.5-2.5% of CIF is a Lloyds/classic-auto industry standard that has been stable for years. Re-verify in January each year. No monthly work.

### Step 7 — Re-run worked examples

The 4 examples in the external spec (`~/Downloads/MonzaHaus-LandedCost-Review-2026-04-20.md` §5) are the canonical smoke test:

- A — 1973 911 DE→US, $300k
- B — 2023 GT3 US→DE, $200k
- C — 1995 993 JP→UK, $80k
- D — Italian Porsche→US, $120k (proxied)

Paste old-vs-new teaser values in the changelog. Any example that moves >5% mo/mo needs a "why" note.

### Step 8 — Write changelog + open PR

Changelog format:

```markdown
# Landed Cost Monthly Update — YYYY-MM

## Summary
- Routes refreshed: [N]
- Routes with material change (≥5%): [N]
- Gov rate changes: [list any]
- New data gaps (insufficient data points): [list]

## Changes by category

### Shipping
| Route | v-prev | v-new | Δ | Source count |
|---|---|---|---|---|

### Duty
| Destination | v-prev | v-new | Why |
|---|---|---|---|

### Tax
| Destination | v-prev | v-new | Why |
|---|---|---|---|

### Port/broker + registration
| Destination / Line | v-prev | v-new | Why |
|---|---|---|---|

## Worked examples (before → after)
...

## Sources cited this month
...
```

### Step 9 — Edgar review → merge → deploy

Edgar review focus:
- Any change >10% on any line → is the source credible?
- Any worked example that moves >5% mo/mo → is it explained?
- Any "insufficient data" flag → do we need to pay for a quote?

### Step 10 — Snapshot

After merge, write `data/versions/YYYY-MM.json` with the frozen state.

---

## 7. Research methods — what's automatable now, what's not

| Source | Automatable? | Method | Fase 1? |
|---|:---:|:---|:---:|
| HTS, TARIC, UK Tariff, JP Customs | ✅ | Scrape rate page + diff | Yes |
| Avalara state averages | ✅ | Scrape | Yes |
| Bundesministerium (DE VAT) | ✅ | Scrape | Yes |
| Published carrier rate cards | ⚠️ | Scrape where available; many carriers don't publish | Partial |
| Web quote forms (carriers) | ⚠️ | Form-fill + await email reply — brittle, doable once/quarter per route | Manual initially |
| Hagerty/BaT shipping guides | ✅ | WebFetch + summarize | Yes |
| Broker schedules (CBP, HMRC, Zoll, Nippon) | ✅ | Scrape published schedules | Yes |
| DMV / DVLA / KBA / Rikuun | ✅ | Scrape + cross-reference | Yes |
| Lloyds insurance standard | ❌ | Industry call, yearly | No — yearly only |

**Implication:** ~80% of the monthly cycle is automatable via Claude + WebFetch. The ~20% that is not (actual carrier quote forms) is where we either (a) accept a wider shipping range with fewer refresh points, or (b) pay a VA $50-100/month to submit the quote forms.

**Fase 1 decision:** skip carrier-quote-form outreach. Rely on published rates + industry articles + existing ranges. The program can add VA outreach in Fase 2 if Edgar wants tighter shipping ranges.

---

## 8. Success metrics

### Fase 1 exit criteria (measured 2026-05-21)

- [ ] All 12 shipping routes have tightened spread (avg across routes ≤25%)
- [ ] Port/broker spreads ≤20% for ≥3 of 4 destinations
- [ ] Registration spreads ≤30% for ≥3 of 4 destinations
- [ ] 100% of numbers in the data files have a `lastReviewed` ≤ 30 days old
- [ ] Changelog documents every material change with a source
- [ ] Family multipliers implemented and covered by unit tests
- [ ] Worked examples re-run and teaser values move <15% from v1 (if >15%, justified per-example)

### Fase 2 exit criteria (measured 2026-07-21)

- [ ] 3 monthly cycles completed (May, Jun, Jul)
- [ ] Volatility dataset built: per-category, per-route month-over-month delta %
- [ ] Source reliability scorecard written
- [ ] ≥1 category identified as "stable → candidate for annual-only refresh"
- [ ] Tier-2 agent design doc opened for drafting
- [ ] Supabase migration of tables complete

### Fase 3 exit criteria (measured 2026-09-21 or later)

- [ ] Event-driven monitoring live for ≥2 gov sources
- [ ] First specialist call completed + findings logged
- [ ] Tier-2 live-agent MVP spec written and approved

---

## 9. Open decisions (for Edgar)

Small items that need Edgar's call before implementation:

1. **Carrier quote form outreach in Fase 1?** — Default: skip (use published data only). Alternative: hire VA for $50-100/month to submit quote forms monthly. Decision drives whether shipping target is ≤25% spread (skip) or ≤15% spread (VA).

2. **Out-of-scope listings (Cayenne, Macan, 718, etc.):** show landed cost with route-base range only (no family multiplier) OR hide the landed-cost teaser entirely. Default: show route-base with a footnote "Family-specific handling not available for this model."

3. **Supabase migration timing:** proposed Fase 2 (after we've validated the static table approach). If Edgar wants it earlier (Fase 1), we add ~1 week to the Fase 1 timeline.

4. **Tightness ambition:** targets in §8 are "trust the number" level. If the goal is "close to Tier-2 accuracy" (≤15% shipping spread, ≤10% port/broker), say so now — changes the research method in Fase 1.

---

## 10. Non-goals (explicitly not this program)

- Real-time carrier API integrations (this is Tier-2 scope)
- Per-VIN compliance lookups (Tier-2)
- Per-state US tax granularity (noted as future; not Fase 1-3)
- Per-trim shipping variation within a family (Tier-2)
- EPA/DOT bond modeling for sub-25-yr US imports (future advisory line, not Fase 1)
- Non-Porsche makes (Ferrari, BMW, etc.) — the playbook will generalize, but scope stays Porsche through Fase 3

---

## 11. Appendix — reference links

- External review package (for specialist validation): `~/Downloads/MonzaHaus-LandedCost-Review-2026-04-20.md`
- Current implementation: `src/lib/landedCost/`
- Porsche series taxonomy: `src/lib/brandConfig.ts` (search "seriesIds")
- Related project memory: `project_monzahaus_vision.md`, `project_monzahaus_monetization.md`, `project_haus_report_v1.md`

---

*End of design spec. Next: writing-plans skill produces the step-by-step implementation plan for Fase 1.*
