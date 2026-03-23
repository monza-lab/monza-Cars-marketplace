# Elferspot Collector + Porsche Taxonomy Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full Elferspot collector module and expand brandConfig.ts with 250+ Porsche model variants sourced from Elferspot's taxonomy.

**Architecture:** Two-phase: (1) Extract variant data into `brandVariants.ts` and wire into `brandConfig.ts` with regression tests, (2) Build a BeForward-style full collector under `src/features/scrapers/elferspot_collector/` with CLI, checkpoint, discover/detail/normalize pipeline, plus two Vercel cron routes for daily discovery and enrichment.

**Tech Stack:** TypeScript, Cheerio (HTML parsing), JSON-LD (structured data), Supabase (DB), Next.js API routes (cron), vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-22-elferspot-collector-design.md`

---

## File Structure

### New Files
```
src/lib/brandVariants.ts                                    # All variant arrays, imported by brandConfig
src/lib/brandVariants.test.ts                               # Regression tests for matchVariant()
src/features/scrapers/elferspot_collector/types.ts          # Interfaces
src/features/scrapers/elferspot_collector/discover.ts       # Search page parser
src/features/scrapers/elferspot_collector/discover.test.ts  # Tests
src/features/scrapers/elferspot_collector/detail.ts         # Detail page parser (JSON-LD + Cheerio)
src/features/scrapers/elferspot_collector/detail.test.ts    # Tests
src/features/scrapers/elferspot_collector/normalize.ts      # Map to unified schema
src/features/scrapers/elferspot_collector/normalize.test.ts # Tests
src/features/scrapers/elferspot_collector/supabase_writer.ts# Upsert to DB
src/features/scrapers/elferspot_collector/checkpoint.ts     # Resume support
src/features/scrapers/elferspot_collector/collector.ts      # Main orchestrator
src/features/scrapers/elferspot_collector/cli.ts            # CLI entry point
src/app/api/cron/elferspot/route.ts                         # Discovery cron
src/app/api/cron/elferspot/route.test.ts                    # Tests
src/app/api/cron/enrich-elferspot/route.ts                  # Enrichment cron
src/app/api/cron/enrich-elferspot/route.test.ts             # Tests
```

### Modified Files
```
src/lib/brandConfig.ts                                      # Import variants from brandVariants.ts
src/features/scrapers/common/monitoring/types.ts            # Add ScraperName entries
src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx # Add dashboard entries
vercel.json                                                 # Add cron schedules
```

---

### Task 1: Create `brandVariants.ts` — Porsche variant catalog

**Files:**
- Create: `src/lib/brandVariants.ts`

This task extracts all variant definitions into a dedicated file. Each series gets an exported array of `VariantConfig` objects. The existing variants in `brandConfig.ts` move here, and new Elferspot-sourced variants are added.

- [ ] **Step 1: Create `brandVariants.ts` with the VariantConfig import and all series variant arrays**

```ts
// src/lib/brandVariants.ts
import type { VariantConfig } from "./brandConfig"

// ── 992 ──
export const PORSCHE_992_VARIANTS: VariantConfig[] = [
  // Existing variants (preserved)
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  { id: "carrera-s", label: "Carrera S", keywords: ["carrera s"] },
  { id: "4s", label: "4S", keywords: ["4s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "gt3", label: "GT3", keywords: ["gt3"] },
  { id: "gt3-rs", label: "GT3 RS", keywords: ["gt3 rs", "gt3rs"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  { id: "sport-classic", label: "Sport Classic", keywords: ["sport classic"] },
  { id: "st", label: "S/T", keywords: ["s/t"] },
  { id: "dakar", label: "Dakar", keywords: ["dakar"] },
  // New Elferspot variants
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "carrera-t", label: "Carrera T", keywords: ["carrera t"] },
  { id: "carrera-4-gts", label: "Carrera 4 GTS", keywords: ["carrera 4 gts"] },
  { id: "gt3-touring", label: "GT3 Touring", keywords: ["gt3 touring"] },
  { id: "gt3-cup", label: "GT3 Cup", keywords: ["gt3 cup"] },
  { id: "gt3-r", label: "GT3 R", keywords: ["gt3 r"] },
  { id: "gt3-r-rennsport", label: "GT3 R Rennsport", keywords: ["gt3 r rennsport", "rennsport"] },
  { id: "turbo-50-jahre", label: "Turbo 50 Jahre", keywords: ["turbo 50 jahre", "turbo 50"] },
  { id: "heritage-design", label: "Heritage Design Edition", keywords: ["heritage design"] },
  { id: "edition-50-jahre", label: "Edition 50 Jahre Porsche Design", keywords: ["50 jahre porsche design"] },
  { id: "belgian-legend", label: "Belgian Legend Edition", keywords: ["belgian legend"] },
  { id: "sally-special", label: "Sally Special", keywords: ["sally special"] },
  { id: "spirit-70", label: "Spirit 70", keywords: ["spirit 70"] },
  // 992.2 sub-generation
  { id: "992.2-carrera", label: "992.2 Carrera", keywords: ["992.2 carrera"] },
  { id: "992.2-carrera-s", label: "992.2 Carrera S", keywords: ["992.2 carrera s"] },
  { id: "992.2-carrera-4s", label: "992.2 Carrera 4S", keywords: ["992.2 carrera 4s"] },
  { id: "992.2-carrera-t", label: "992.2 Carrera T", keywords: ["992.2 carrera t"] },
  { id: "992.2-carrera-gts", label: "992.2 Carrera GTS", keywords: ["992.2 carrera gts"] },
  { id: "992.2-carrera-4-gts", label: "992.2 Carrera 4 GTS", keywords: ["992.2 carrera 4 gts"] },
  { id: "992.2-gt3", label: "992.2 GT3", keywords: ["992.2 gt3"] },
  { id: "992.2-gt3-touring", label: "992.2 GT3 Touring", keywords: ["992.2 gt3 touring"] },
  { id: "992.2-turbo-s", label: "992.2 Turbo S", keywords: ["992.2 turbo s"] },
  { id: "992.2-cuarenta", label: "992.2 Carrera GTS Cuarenta Edition", keywords: ["cuarenta"] },
]

// ── 991 ──
export const PORSCHE_991_VARIANTS: VariantConfig[] = [
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  { id: "carrera-s", label: "Carrera S", keywords: ["carrera s"] },
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "carrera-4s", label: "Carrera 4S", keywords: ["carrera 4s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "carrera-4-gts", label: "Carrera 4 GTS", keywords: ["carrera 4 gts"] },
  { id: "carrera-t", label: "Carrera T", keywords: ["carrera t"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "gt3", label: "GT3", keywords: ["gt3"] },
  { id: "gt3-rs", label: "GT3 RS", keywords: ["gt3 rs"] },
  { id: "gt3-touring", label: "GT3 Touring", keywords: ["gt3 touring"] },
  { id: "gt2-rs", label: "GT2 RS", keywords: ["gt2 rs"] },
  { id: "gt2-rs-clubsport", label: "GT2 RS Clubsport", keywords: ["gt2 rs clubsport"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  { id: "speedster", label: "Speedster", keywords: ["speedster"] },
  { id: "911-r", label: "911 R", keywords: ["911 r", "911r"] },
  { id: "carrera-s-50-jahre", label: "Carrera S 50 Jahre", keywords: ["50 jahre"] },
  { id: "club-coupe", label: "Club Coupe", keywords: ["club coupé", "club coupe"] },
  { id: "turbo-s-exclusive", label: "Turbo S Exclusive Series", keywords: ["exclusive series"] },
  { id: "gt3-cup", label: "GT3 Cup", keywords: ["gt3 cup"] },
  { id: "gt3-r", label: "GT3 R", keywords: ["gt3 r"] },
  { id: "gt3-rsr", label: "GT3 RSR", keywords: ["gt3 rsr"] },
  { id: "black-edition", label: "Black Edition", keywords: ["black edition"] },
  { id: "martini-racing", label: "Martini Racing Edition", keywords: ["martini racing"] },
  // 991.2 sub-generation
  { id: "991.2-carrera", label: "991.2 Carrera", keywords: ["991.2 carrera"] },
  { id: "991.2-carrera-s", label: "991.2 Carrera S", keywords: ["991.2 carrera s"] },
  { id: "991.2-carrera-4", label: "991.2 Carrera 4", keywords: ["991.2 carrera 4"] },
  { id: "991.2-carrera-4s", label: "991.2 Carrera 4S", keywords: ["991.2 carrera 4s"] },
  { id: "991.2-carrera-gts", label: "991.2 Carrera GTS", keywords: ["991.2 carrera gts"] },
  { id: "991.2-carrera-4-gts", label: "991.2 Carrera 4 GTS", keywords: ["991.2 carrera 4 gts"] },
  { id: "991.2-carrera-t", label: "991.2 Carrera T", keywords: ["991.2 carrera t"] },
  { id: "991.2-gt3", label: "991.2 GT3", keywords: ["991.2 gt3"] },
  { id: "991.2-gt3-rs", label: "991.2 GT3 RS", keywords: ["991.2 gt3 rs"] },
  { id: "991.2-turbo", label: "991.2 Turbo", keywords: ["991.2 turbo"] },
  { id: "991.2-turbo-s", label: "991.2 Turbo S", keywords: ["991.2 turbo s"] },
]

// ── 997 ──
export const PORSCHE_997_VARIANTS: VariantConfig[] = [
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  { id: "carrera-s", label: "Carrera S", keywords: ["carrera s"] },
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "carrera-4s", label: "Carrera 4S", keywords: ["carrera 4s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "gt2", label: "GT2", keywords: ["gt2"] },
  { id: "gt2-rs", label: "GT2 RS", keywords: ["gt2 rs"] },
  { id: "gt3", label: "GT3", keywords: ["gt3"] },
  { id: "gt3-rs", label: "GT3 RS", keywords: ["gt3 rs"] },
  { id: "gt3-rs-4.0", label: "GT3 RS 4.0", keywords: ["gt3 rs 4.0", "rs 4.0"] },
  { id: "gt3-cup", label: "GT3 Cup", keywords: ["gt3 cup"] },
  { id: "gt3-cup-s", label: "GT3 Cup S", keywords: ["gt3 cup s"] },
  { id: "gt3-rsr", label: "GT3 RSR", keywords: ["gt3 rsr"] },
  { id: "sport-classic", label: "Sport Classic", keywords: ["sport classic"] },
  { id: "speedster", label: "Speedster", keywords: ["speedster"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  // 997.2 sub-generation
  { id: "997.2-carrera", label: "997.2 Carrera", keywords: ["997.2 carrera"] },
  { id: "997.2-carrera-s", label: "997.2 Carrera S", keywords: ["997.2 carrera s"] },
  { id: "997.2-carrera-4", label: "997.2 Carrera 4", keywords: ["997.2 carrera 4"] },
  { id: "997.2-carrera-4s", label: "997.2 Carrera 4S", keywords: ["997.2 carrera 4s"] },
  { id: "997.2-carrera-gts", label: "997.2 Carrera GTS", keywords: ["997.2 carrera gts"] },
  { id: "997.2-carrera-4-gts", label: "997.2 Carrera 4 GTS", keywords: ["997.2 carrera 4 gts"] },
  { id: "997.2-carrera-black", label: "997.2 Carrera Black Edition", keywords: ["997.2 carrera black", "997.2 black edition"] },
  { id: "997.2-turbo", label: "997.2 Turbo", keywords: ["997.2 turbo"] },
  { id: "997.2-turbo-s", label: "997.2 Turbo S", keywords: ["997.2 turbo s"] },
  { id: "997.2-gt3", label: "997.2 GT3", keywords: ["997.2 gt3"] },
  { id: "997.2-gt3-rs", label: "997.2 GT3 RS", keywords: ["997.2 gt3 rs"] },
  { id: "997.2-gt3-r", label: "997.2 GT3 R", keywords: ["997.2 gt3 r"] },
  { id: "997.2-gt3-rsr", label: "997.2 GT3 RSR", keywords: ["997.2 gt3 rsr"] },
  { id: "997.2-gt3-cup", label: "997.2 GT3 Cup", keywords: ["997.2 gt3 cup"] },
]

// ── 996 ──
export const PORSCHE_996_VARIANTS: VariantConfig[] = [
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "carrera-4s", label: "Carrera 4S", keywords: ["carrera 4s"] },
  { id: "carrera-r", label: "Carrera R", keywords: ["carrera r"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "gt2", label: "GT2", keywords: ["gt2"] },
  { id: "gt2-clubsport", label: "GT2 Clubsport", keywords: ["gt2 clubsport"] },
  { id: "gt2-r", label: "GT2 R", keywords: ["gt2 r"] },
  { id: "gt3", label: "GT3", keywords: ["gt3"] },
  { id: "gt3-clubsport", label: "GT3 Clubsport", keywords: ["gt3 clubsport"] },
  { id: "gt3-cup", label: "GT3 Cup", keywords: ["gt3 cup"] },
  { id: "gt3-r", label: "GT3 R", keywords: ["gt3 r"] },
  { id: "gt3-rs", label: "GT3 RS", keywords: ["gt3 rs"] },
  { id: "gt3-rsr", label: "GT3 RSR", keywords: ["gt3 rsr"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  { id: "4s", label: "4S", keywords: ["4s"] },
  { id: "40-jahre", label: "40 Jahre 911", keywords: ["40 jahre"] },
  { id: "millennium", label: "Millennium Edition", keywords: ["millennium"] },
  // 996.2 sub-generation
  { id: "996.2-carrera", label: "996.2 Carrera", keywords: ["996.2 carrera"] },
  { id: "996.2-carrera-4", label: "996.2 Carrera 4", keywords: ["996.2 carrera 4"] },
  { id: "996.2-gt3", label: "996.2 GT3", keywords: ["996.2 gt3"] },
  { id: "996.2-gt3-clubsport", label: "996.2 GT3 Clubsport", keywords: ["996.2 gt3 clubsport"] },
]

// ── 993 ──
export const PORSCHE_993_VARIANTS: VariantConfig[] = [
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  { id: "carrera-s", label: "Carrera S", keywords: ["carrera s"] },
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "4s", label: "4S", keywords: ["4s"] },
  { id: "carrera-3.8", label: "Carrera 3.8", keywords: ["carrera 3.8"] },
  { id: "carrera-rs", label: "Carrera RS", keywords: ["carrera rs"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "turbo-cabrio", label: "Turbo Cabrio", keywords: ["turbo cabrio", "turbo cabriolet"] },
  { id: "turbo-wls-1", label: "Turbo WLS 1", keywords: ["turbo wls 1", "wls 1"] },
  { id: "turbo-wls-2", label: "Turbo WLS 2", keywords: ["turbo wls 2", "wls 2"] },
  { id: "gt2", label: "GT2", keywords: ["gt2"] },
  { id: "gt2-evo", label: "GT2 Evo", keywords: ["gt2 evo"] },
  { id: "cup-3.8", label: "3.8 Cup", keywords: ["3.8 cup", "cup 3.8"] },
  { id: "cup-3.8-rsr", label: "Cup 3.8 RSR", keywords: ["cup 3.8 rsr"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  { id: "rs", label: "RS", keywords: [" rs"] },
]

// ── 964 ──
export const PORSCHE_964_VARIANTS: VariantConfig[] = [
  { id: "carrera-2", label: "Carrera 2", keywords: ["carrera 2"] },
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "carrera-rs", label: "Carrera RS", keywords: ["carrera rs"] },
  { id: "carrera-rs-3.8", label: "Carrera RS 3.8", keywords: ["rs 3.8", "carrera rs 3.8"] },
  { id: "rs-america", label: "RS America", keywords: ["rs america"] },
  { id: "rs-n-gt", label: "Carrera RS N/GT", keywords: ["rs n/gt"] },
  { id: "rsr-3.8", label: "Carrera RSR 3.8", keywords: ["rsr 3.8"] },
  { id: "america-roadster", label: "America Roadster", keywords: ["america roadster"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-3.6", label: "Turbo 3.6", keywords: ["turbo 3.6"] },
  { id: "turbo-flachbau", label: "Turbo Flachbau", keywords: ["flachbau", "flatnose", "slantnose"] },
  { id: "turbo-s-leichtbau", label: "Turbo S Leichtbau", keywords: ["leichtbau"] },
  { id: "turbo-s2", label: "Turbo S2", keywords: ["turbo s2"] },
  { id: "turbo-wls", label: "Turbo WLS", keywords: ["turbo wls"] },
  { id: "speedster", label: "Speedster", keywords: ["speedster"] },
  { id: "cup", label: "Cup", keywords: [" cup"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  { id: "jubilaeums", label: "Jubiläumsmodell 30 Jahre 911", keywords: ["jubiläum", "jubilae", "30 jahre"] },
  { id: "carrera-4-lightweight", label: "Carrera 4 Lightweight", keywords: ["lightweight"] },
]

// ── 930 (first variants ever for this series!) ──
export const PORSCHE_930_VARIANTS: VariantConfig[] = [
  { id: "turbo-3.0", label: "Turbo 3.0", keywords: ["turbo 3.0"] },
  { id: "turbo-3.3", label: "Turbo 3.3", keywords: ["turbo 3.3"] },
  { id: "turbo-3.3-wls", label: "Turbo 3.3 WLS", keywords: ["turbo 3.3 wls", "wls"] },
  { id: "turbo-5-gang", label: "Turbo 5 Gang", keywords: ["5 gang", "5-speed", "5 speed"] },
  { id: "turbo-flachbau", label: "Turbo Flachbau", keywords: ["flachbau", "flatnose", "slantnose"] },
  { id: "turbo-s-3.3", label: "Turbo S 3.3", keywords: ["turbo s 3.3"] },
  { id: "934", label: "934", keywords: ["934"] },
]

// ── G-Model (first variants ever!) ──
export const PORSCHE_GMODEL_VARIANTS: VariantConfig[] = [
  { id: "carrera-2.7", label: "Carrera 2.7", keywords: ["carrera 2.7"] },
  { id: "carrera-rs-3.0", label: "Carrera RS 3.0", keywords: ["carrera rs 3.0", "rs 3.0"] },
  { id: "carrera-rsr-3.0", label: "Carrera RSR 3.0", keywords: ["rsr 3.0"] },
  { id: "carrera-3.0", label: "Carrera 3.0", keywords: ["carrera 3.0"] },
  { id: "sc", label: "SC", keywords: ["911 sc", " sc "] },
  { id: "sc-3.1", label: "SC 3.1", keywords: ["sc 3.1"] },
  { id: "sc-rs", label: "SC/RS", keywords: ["sc/rs"] },
  { id: "carrera-3.2", label: "Carrera 3.2", keywords: ["carrera 3.2"] },
  { id: "carrera-3.2-clubsport", label: "Carrera 3.2 Clubsport", keywords: ["3.2 clubsport", "3.2 club sport"] },
  { id: "carrera-3.2-speedster", label: "Carrera 3.2 Speedster", keywords: ["3.2 speedster"] },
  { id: "carrera-3.2-supersport", label: "Carrera 3.2 Supersport", keywords: ["3.2 supersport"] },
  { id: "carrera-3.2-wtl", label: "Carrera 3.2 WTL", keywords: ["3.2 wtl"] },
  { id: "speedster", label: "Speedster", keywords: ["speedster"] },
]

// ── F-Model (first variants ever!) ──
export const PORSCHE_FMODEL_VARIANTS: VariantConfig[] = [
  { id: "901", label: "901", keywords: ["901"] },
  { id: "911-base", label: "911", keywords: ["911"] },
  { id: "911-l", label: "911 L", keywords: ["911 l", "911l"] },
  { id: "911-t", label: "911 T", keywords: ["911 t", "911t"] },
  { id: "911-s", label: "911 S", keywords: ["911 s", "911s"] },
  { id: "911-e", label: "911 E", keywords: ["911 e", "911e"] },
  { id: "911-r", label: "911 R", keywords: ["911 r", "911r"] },
  { id: "911-st", label: "911 ST", keywords: ["911 st"] },
  { id: "911-tr", label: "911 T/R", keywords: ["911 t/r"] },
  { id: "carrera-rs", label: "Carrera RS", keywords: ["carrera rs"] },
  { id: "carrera-2.8-rsr", label: "Carrera 2.8 RSR", keywords: ["2.8 rsr"] },
]

// ── 912 ──
export const PORSCHE_912_VARIANTS: VariantConfig[] = [
  { id: "912", label: "912", keywords: ["912"] },
  { id: "912-e", label: "912 E", keywords: ["912 e", "912e"] },
]

// ── 718 / 982 ──
export const PORSCHE_718_CAYMAN_VARIANTS: VariantConfig[] = [
  { id: "base", label: "Base", keywords: ["cayman"] },
  { id: "s", label: "S", keywords: ["cayman s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "gts-4.0", label: "GTS 4.0", keywords: ["gts 4.0"] },
  { id: "t", label: "T", keywords: ["cayman t"] },
  { id: "gt4", label: "GT4", keywords: ["gt4"] },
  { id: "gt4-rs", label: "GT4 RS", keywords: ["gt4 rs"] },
  { id: "gt4-clubsport", label: "GT4 Clubsport", keywords: ["gt4 clubsport"] },
  { id: "gt4-rs-clubsport", label: "GT4 RS Clubsport", keywords: ["gt4 rs clubsport"] },
]

export const PORSCHE_718_BOXSTER_VARIANTS: VariantConfig[] = [
  { id: "base", label: "Base", keywords: ["boxster"] },
  { id: "s", label: "S", keywords: ["boxster s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "gts-4.0", label: "GTS 4.0", keywords: ["gts 4.0"] },
  { id: "t", label: "T", keywords: ["boxster t"] },
  { id: "spyder", label: "Spyder", keywords: ["spyder"] },
  { id: "spyder-rs", label: "Spyder RS", keywords: ["spyder rs"] },
  { id: "25-years", label: "25 Years", keywords: ["25 years", "25 jahre"] },
]

// ── Cayman (pre-718: covers 981 + 987 generations) ──
// Maps to series id "cayman" in brandConfig.ts
export const PORSCHE_CAYMAN_VARIANTS: VariantConfig[] = [
  { id: "cayman", label: "Cayman", keywords: ["cayman"] },
  { id: "cayman-s", label: "Cayman S", keywords: ["cayman s"] },
  { id: "cayman-gts", label: "Cayman GTS", keywords: ["cayman gts"] },
  { id: "cayman-gt4", label: "Cayman GT4", keywords: ["cayman gt4", "gt4"] },
  { id: "cayman-gt4-clubsport", label: "Cayman GT4 Clubsport", keywords: ["gt4 clubsport"] },
  { id: "cayman-r", label: "Cayman R", keywords: ["cayman r"] },
  { id: "cayman-cup", label: "Cayman Cup", keywords: ["cayman cup"] },
  { id: "black-edition", label: "Black Edition", keywords: ["black edition"] },
]

// ── Boxster (pre-718: covers 986 + 987 + 981 generations) ──
// Maps to series id "boxster" in brandConfig.ts
export const PORSCHE_BOXSTER_VARIANTS: VariantConfig[] = [
  { id: "boxster", label: "Boxster", keywords: ["boxster"] },
  { id: "boxster-s", label: "Boxster S", keywords: ["boxster s"] },
  { id: "boxster-gts", label: "Boxster GTS", keywords: ["boxster gts"] },
  { id: "boxster-spyder", label: "Boxster Spyder", keywords: ["boxster spyder", "spyder"] },
  { id: "boxster-rs60", label: "Boxster RS 60 Spyder", keywords: ["rs 60"] },
  { id: "black-edition", label: "Black Edition", keywords: ["black edition"] },
]

// ── 914 ──
export const PORSCHE_914_VARIANTS: VariantConfig[] = [
  { id: "914-1.7", label: "914 1.7", keywords: ["1.7"] },
  { id: "914-1.8", label: "914 1.8", keywords: ["1.8"] },
  { id: "914-2.0", label: "914 2.0", keywords: ["2.0"] },
  { id: "914-6", label: "914/6", keywords: ["914/6"] },
  { id: "914-6-gt", label: "914/6 GT", keywords: ["914/6 gt"] },
  { id: "916", label: "916", keywords: ["916"] },
]

// ── Transaxle Classics ──
export const PORSCHE_944_VARIANTS: VariantConfig[] = [
  { id: "coupe", label: "Coupé", keywords: ["coupé", "coupe"] },
  { id: "s-coupe", label: "S Coupé", keywords: ["944 s coupe", "944 s coupé"] },
  { id: "s2-coupe", label: "S2 Coupé", keywords: ["s2 coupe", "s2 coupé"] },
  { id: "s2-cabrio", label: "S2 Cabriolet", keywords: ["s2 cabriolet", "s2 cabrio"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "turbo-cup", label: "Turbo Cup", keywords: ["turbo cup"] },
]

export const PORSCHE_928_VARIANTS: VariantConfig[] = [
  { id: "base", label: "928", keywords: ["928"] },
  { id: "s", label: "S", keywords: ["928 s"] },
  { id: "s4", label: "S4", keywords: ["s4"] },
  { id: "s4-clubsport", label: "S4 Clubsport", keywords: ["s4 clubsport"] },
  { id: "gt", label: "GT", keywords: ["928 gt"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
]

export const PORSCHE_968_VARIANTS: VariantConfig[] = [
  { id: "base", label: "968", keywords: ["968"] },
  { id: "club-sport", label: "Club Sport", keywords: ["club sport", "clubsport"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "turbo-rs", label: "Turbo RS", keywords: ["turbo rs"] },
]

export const PORSCHE_924_VARIANTS: VariantConfig[] = [
  { id: "base", label: "924", keywords: ["924"] },
  { id: "s", label: "S", keywords: ["924 s"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "carrera-gt", label: "Carrera GT", keywords: ["carrera gt"] },
  { id: "carrera-gts", label: "Carrera GTS", keywords: ["carrera gts"] },
  { id: "carrera-gtp", label: "Carrera GTP", keywords: ["carrera gtp"] },
  { id: "carrera-gtr", label: "Carrera GTR", keywords: ["carrera gtr"] },
]

// ── Heritage ──
export const PORSCHE_356_VARIANTS: VariantConfig[] = [
  { id: "pre-a", label: "Pre-A", keywords: ["pre-a", "pre a"] },
  { id: "a-1300", label: "A 1300", keywords: ["a 1300"] },
  { id: "a-1300-super", label: "A 1300 Super", keywords: ["a 1300 super"] },
  { id: "a-1500-gs-carrera", label: "A 1500 GS Carrera", keywords: ["a 1500 gs carrera"] },
  { id: "a-1600", label: "A 1600", keywords: ["a 1600"] },
  { id: "a-1600-super", label: "A 1600 Super", keywords: ["a 1600 super"] },
  { id: "a-1600-speedster", label: "A 1600 Speedster", keywords: ["a 1600 speedster"] },
  { id: "b-1600", label: "B 1600", keywords: ["b 1600"] },
  { id: "b-1600-super", label: "B 1600 Super", keywords: ["b 1600 super"] },
  { id: "b-1600-super-90", label: "B 1600 Super 90", keywords: ["b 1600 super 90"] },
  { id: "b-2000-gs-carrera", label: "B 2000 GS Carrera", keywords: ["b 2000 gs"] },
  { id: "c", label: "C", keywords: ["356 c"] },
  { id: "sc", label: "SC", keywords: ["356 sc"] },
  { id: "speedster", label: "Speedster", keywords: ["speedster"] },
  { id: "convertible-d", label: "Convertible D", keywords: ["convertible d"] },
  { id: "america-roadster", label: "America Roadster", keywords: ["america roadster"] },
]

// ── GT & Hypercars ──
export const PORSCHE_918_VARIANTS: VariantConfig[] = [
  { id: "spyder", label: "918 Spyder", keywords: ["spyder", "918"] },
]

export const PORSCHE_CARRERA_GT_VARIANTS: VariantConfig[] = [
  { id: "carrera-gt", label: "Carrera GT", keywords: ["carrera gt"] },
  { id: "carrera-gt-r", label: "Carrera GT-R", keywords: ["carrera gt-r", "gt-r"] },
]

export const PORSCHE_959_VARIANTS: VariantConfig[] = [
  { id: "959", label: "959", keywords: ["959"] },
  { id: "959-s", label: "959 S", keywords: ["959 s"] },
  { id: "959-sport", label: "959 Sport", keywords: ["959 sport"] },
]

// ── SUV & Sedan ──
// Taycan expanded from Elferspot
export const PORSCHE_TAYCAN_VARIANTS: VariantConfig[] = [
  { id: "base", label: "Taycan", keywords: ["taycan"] },
  { id: "4", label: "Taycan 4", keywords: ["taycan 4 "] },
  { id: "4s", label: "Taycan 4S", keywords: ["taycan 4s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "turbo-gt", label: "Turbo GT", keywords: ["turbo gt"] },
  { id: "cross-turismo", label: "Cross Turismo", keywords: ["cross turismo"] },
  { id: "sport-turismo", label: "Sport Turismo", keywords: ["sport turismo"] },
]

// Panamera expanded from Elferspot
export const PORSCHE_PANAMERA_VARIANTS: VariantConfig[] = [
  { id: "base", label: "Panamera", keywords: ["panamera"] },
  { id: "4", label: "Panamera 4", keywords: ["panamera 4 "] },
  { id: "s", label: "S", keywords: ["panamera s"] },
  { id: "4s", label: "4S", keywords: ["4s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "e-hybrid", label: "E-Hybrid", keywords: ["e-hybrid", "hybrid"] },
  { id: "executive", label: "Executive", keywords: ["executive"] },
  { id: "sport-turismo", label: "Sport Turismo", keywords: ["sport turismo"] },
]
```

The implementer MUST include ALL variants listed in the spec's "Complete Elferspot Model Catalog" section. The above is a complete reference — each variant needs an `id`, `label`, and `keywords` array. Follow the pattern exactly.

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/brandVariants.ts`
Expected: No errors (the import of `VariantConfig` from `brandConfig` should resolve)

- [ ] **Step 3: Commit**

```bash
git add src/lib/brandVariants.ts
git commit -m "feat(taxonomy): create brandVariants.ts with 250+ Porsche model variants from Elferspot catalog"
```

---

### Task 2: Wire `brandVariants.ts` into `brandConfig.ts` + regression tests

**Files:**
- Modify: `src/lib/brandConfig.ts`
- Create: `src/lib/brandVariants.test.ts`

- [ ] **Step 1: Update `brandConfig.ts` to import variant arrays from `brandVariants.ts`**

At the top of `brandConfig.ts`, add imports:
```ts
import {
  PORSCHE_992_VARIANTS, PORSCHE_991_VARIANTS, PORSCHE_997_VARIANTS,
  PORSCHE_996_VARIANTS, PORSCHE_993_VARIANTS, PORSCHE_964_VARIANTS,
  PORSCHE_930_VARIANTS, PORSCHE_GMODEL_VARIANTS, PORSCHE_FMODEL_VARIANTS,
  PORSCHE_912_VARIANTS, PORSCHE_718_CAYMAN_VARIANTS, PORSCHE_718_BOXSTER_VARIANTS,
  PORSCHE_CAYMAN_VARIANTS, PORSCHE_BOXSTER_VARIANTS,
  PORSCHE_914_VARIANTS, PORSCHE_944_VARIANTS, PORSCHE_928_VARIANTS,
  PORSCHE_968_VARIANTS, PORSCHE_924_VARIANTS, PORSCHE_356_VARIANTS,
  PORSCHE_918_VARIANTS, PORSCHE_CARRERA_GT_VARIANTS, PORSCHE_959_VARIANTS,
  PORSCHE_TAYCAN_VARIANTS, PORSCHE_PANAMERA_VARIANTS,
} from "./brandVariants"
```

Then replace inline `variants: [...]` arrays with the imported constants. For series that had NO variants (930, g-model, f-model, 912), add `variants: PORSCHE_XXX_VARIANTS`.

Example for 992:
```ts
// BEFORE:
{ id: "992", ..., variants: [
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  // ... inline
] }

// AFTER:
{ id: "992", ..., variants: PORSCHE_992_VARIANTS }
```

Example for 930 (adding variants for the first time):
```ts
// BEFORE:
{ id: "930", ..., turboOnly: false, thesis: "..." }

// AFTER:
{ id: "930", ..., turboOnly: false, thesis: "...", variants: PORSCHE_930_VARIANTS }
```

**Important: `cayman` and `boxster` series mapping.** The `cayman` series (label "Cayman (981/987)") covers both 981 and 987 Cayman generations — wire it to `PORSCHE_CAYMAN_VARIANTS`. The `boxster` series (label "Boxster (986/987/981)") covers three Boxster generations — wire it to `PORSCHE_BOXSTER_VARIANTS`. There are no separate `981`, `987`, or `986` series IDs.

Do this for ALL 27 series.

- [ ] **Step 2: Verify `brandConfig.ts` compiles**

Run: `npx tsc --noEmit src/lib/brandConfig.ts`
Expected: No errors

- [ ] **Step 3: Write regression tests in `brandVariants.test.ts`**

```ts
// src/lib/brandVariants.test.ts
import { describe, it, expect } from "vitest"
import { matchVariant, extractSeries } from "./brandConfig"

describe("matchVariant regression tests", () => {
  // Existing behavior must be preserved
  it("matches 992 GT3 RS", () => {
    expect(matchVariant("992 GT3 RS", null, "992", "Porsche")).toBe("gt3-rs")
  })
  it("matches 991 911 R", () => {
    expect(matchVariant("991 911 R", null, "991", "Porsche")).toBe("911-r")
  })
  it("matches generic 993 Carrera", () => {
    expect(matchVariant("993 Carrera", null, "993", "Porsche")).toBe("carrera")
  })
  it("matches 964 RS America (most specific wins)", () => {
    expect(matchVariant("964 RS America", null, "964", "Porsche")).toBe("rs-america")
  })

  // New Elferspot variants
  it("matches 964 Carrera RS 3.8", () => {
    expect(matchVariant("964 Carrera RS 3.8", null, "964", "Porsche")).toBe("carrera-rs-3.8")
  })
  it("matches 964 Turbo Flachbau", () => {
    expect(matchVariant("964 Turbo Flachbau", null, "964", "Porsche")).toBe("turbo-flachbau")
  })
  it("matches 930 Turbo 3.3 WLS", () => {
    expect(matchVariant("930 Turbo 3.3 WLS", null, "930", "Porsche")).toBe("turbo-3.3-wls")
  })
  it("matches G-Model Carrera 3.2 Clubsport", () => {
    expect(matchVariant("911 Carrera 3.2 Clubsport", null, "g-model", "Porsche")).toBe("carrera-3.2-clubsport")
  })
  it("matches F-Model 911 T", () => {
    expect(matchVariant("911 T", null, "f-model", "Porsche")).toBe("911-t")
  })
  it("matches 992.2 GT3 Touring", () => {
    expect(matchVariant("992.2 GT3 Touring", null, "992", "Porsche")).toBe("992.2-gt3-touring")
  })

  // Cross-scraper titles (BaT, AS24, etc.)
  it("BaT-style title: '1996 Porsche 993 Turbo' matches turbo", () => {
    expect(matchVariant("993 Turbo", null, "993", "Porsche")).toBe("turbo")
  })
  it("AS24-style title: '911 Carrera' with no variant detail still matches", () => {
    expect(matchVariant("911 Carrera", null, "997", "Porsche")).toBe("carrera")
  })
})

describe("extractSeries still works", () => {
  it("extracts 992 from model", () => {
    expect(extractSeries("992 GT3", 2023, "Porsche")).toBe("992")
  })
  it("extracts 964 from model", () => {
    expect(extractSeries("964 Carrera RS 3.8", 1993, "Porsche")).toBe("964")
  })
  it("year fallback: 911 Carrera → 997 for year 2010", () => {
    expect(extractSeries("911 Carrera", 2010, "Porsche")).toBe("997")
  })
})
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/brandVariants.test.ts`
Expected: All tests PASS. If any keyword conflicts cause wrong matches, adjust keywords in `brandVariants.ts` (add spaces or more specific keywords) and re-run.

- [ ] **Step 5: Commit**

```bash
git add src/lib/brandConfig.ts src/lib/brandVariants.test.ts
git commit -m "feat(taxonomy): wire 250+ Elferspot variants into brandConfig with regression tests"
```

---

### Task 3: Create Elferspot collector types

**Files:**
- Create: `src/features/scrapers/elferspot_collector/types.ts`

- [ ] **Step 1: Create `types.ts`**

```ts
// src/features/scrapers/elferspot_collector/types.ts

export interface CollectorRunConfig {
  maxPages: number
  maxListings: number
  scrapeDetails: boolean
  delayMs: number
  checkpointPath: string
  outputPath: string
  dryRun: boolean
  language: "en" | "de" | "nl" | "fr"
}

export interface ElferspotListingSummary {
  sourceUrl: string
  sourceId: string
  title: string
  year: number | null
  country: string | null
  thumbnailUrl: string | null
}

export interface ElferspotDetail {
  // JSON-LD fields
  price: number | null
  currency: string
  year: number | null
  mileageKm: number | null
  transmission: string | null
  bodyType: string | null
  driveType: string | null
  colorExterior: string | null
  model: string | null
  firstRegistration: string | null
  // Cheerio fallback fields
  fuel: string | null
  engine: string | null
  colorInterior: string | null
  vin: string | null
  sellerName: string | null
  sellerType: "dealer" | "private" | null
  location: string | null
  locationCountry: string | null
  descriptionText: string | null
  images: string[]
  condition: string | null
}

export interface CollectorCounts {
  discovered: number
  written: number
  enriched: number
  errors: number
}

export interface CollectorResult {
  runId: string
  counts: CollectorCounts
  errors: string[]
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit src/features/scrapers/elferspot_collector/types.ts`

- [ ] **Step 3: Commit**

```bash
git add src/features/scrapers/elferspot_collector/types.ts
git commit -m "feat(elferspot): add collector type definitions"
```

---

### Task 4: Create `discover.ts` — search page parser

**Files:**
- Create: `src/features/scrapers/elferspot_collector/discover.ts`
- Create: `src/features/scrapers/elferspot_collector/discover.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/features/scrapers/elferspot_collector/discover.test.ts
import { describe, it, expect } from "vitest"
import { parseSearchPage, buildSearchUrl, extractSourceIdFromUrl } from "./discover"

describe("buildSearchUrl", () => {
  it("builds page 1 URL", () => {
    expect(buildSearchUrl(1, "en")).toBe("https://www.elferspot.com/en/search/")
  })
  it("builds page 3 URL", () => {
    expect(buildSearchUrl(3, "en")).toBe("https://www.elferspot.com/en/search/page/3/")
  })
  it("builds German URL", () => {
    expect(buildSearchUrl(2, "de")).toBe("https://www.elferspot.com/de/suchen/page/2/")
  })
})

describe("extractSourceIdFromUrl", () => {
  it("extracts numeric ID from URL slug", () => {
    expect(extractSourceIdFromUrl("https://www.elferspot.com/en/car/porsche-992-gt3-2023-5856995/"))
      .toBe("5856995")
  })
  it("returns null for invalid URL", () => {
    expect(extractSourceIdFromUrl("https://www.elferspot.com/en/search/")).toBeNull()
  })
})

describe("parseSearchPage", () => {
  const FIXTURE = `<html><body>
    <article>
      <a href="https://www.elferspot.com/en/car/porsche-992-gt3-2023-5856995/">
        <img src="https://cdn.elferspot.com/thumb.jpg" />
        <h2>Porsche 992 GT3</h2>
        <span class="year">2023</span>
      </a>
    </article>
  </body></html>`

  it("extracts listings from HTML", () => {
    const listings = parseSearchPage(FIXTURE)
    expect(listings.length).toBeGreaterThanOrEqual(1)
    expect(listings[0].sourceId).toBe("5856995")
    expect(listings[0].sourceUrl).toContain("5856995")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/elferspot_collector/discover.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `discover.ts`**

```ts
// src/features/scrapers/elferspot_collector/discover.ts
import * as cheerio from "cheerio"
import type { ElferspotListingSummary } from "./types"

const SEARCH_PATHS: Record<string, string> = {
  en: "/en/search/",
  de: "/de/suchen/",
  nl: "/nl/zoeken/",
  fr: "/fr/rechercher/",
}

export function buildSearchUrl(page: number, language: string): string {
  const basePath = SEARCH_PATHS[language] ?? SEARCH_PATHS.en
  if (page <= 1) return `https://www.elferspot.com${basePath}`
  return `https://www.elferspot.com${basePath}page/${page}/`
}

export function extractSourceIdFromUrl(url: string): string | null {
  // URL pattern: /en/car/{slug}-{year}-{id}/
  const match = url.match(/-(\d{5,})\/?\s*$/)
  return match ? match[1] : null
}

export function parseSearchPage(html: string): ElferspotListingSummary[] {
  const $ = cheerio.load(html)
  const listings: ElferspotListingSummary[] = []

  // Elferspot listing cards are links to /en/car/ or /de/fahrzeug/ pages
  $("a[href*='/car/'], a[href*='/fahrzeug/']").each((_i, el) => {
    const href = $(el).attr("href") ?? ""
    if (!href.includes("elferspot.com")) return

    const sourceId = extractSourceIdFromUrl(href)
    if (!sourceId) return

    // Avoid duplicates within a page
    if (listings.some(l => l.sourceId === sourceId)) return

    const title = $(el).find("h2, h3, .title").first().text().trim()
      || $(el).attr("title")?.trim()
      || ""

    const yearText = $(el).find(".year, .construction-year").first().text().trim()
    const yearMatch = yearText.match(/\b(19|20)\d{2}\b/)
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null

    const img = $(el).find("img").first()
    const thumbnailUrl = img.attr("src") || img.attr("data-src") || null

    listings.push({
      sourceUrl: href,
      sourceId,
      title: title || `Porsche ${sourceId}`,
      year,
      country: null, // Country extracted from flag icon CSS class if available
      thumbnailUrl,
    })
  })

  return listings
}

export async function fetchSearchPage(page: number, language: string, delayMs: number): Promise<{
  html: string
  listings: ElferspotListingSummary[]
}> {
  const url = buildSearchUrl(page, language)
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const html = await response.text()
  const listings = parseSearchPage(html)
  return { html, listings }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/scrapers/elferspot_collector/discover.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/elferspot_collector/discover.ts src/features/scrapers/elferspot_collector/discover.test.ts
git commit -m "feat(elferspot): add search page parser (discover.ts)"
```

---

### Task 5: Create `detail.ts` — detail page parser (JSON-LD + Cheerio)

**Files:**
- Create: `src/features/scrapers/elferspot_collector/detail.ts`
- Create: `src/features/scrapers/elferspot_collector/detail.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/features/scrapers/elferspot_collector/detail.test.ts
import { describe, it, expect } from "vitest"
import { parseDetailPage, extractJsonLd } from "./detail"

const FIXTURE_JSON_LD = `<script type="application/ld+json">{
  "@type": "Vehicle",
  "model": "992 GT3 Touring",
  "bodyType": "Coupé",
  "dateVehicleFirstRegistered": "2023-06-15",
  "mileageFromOdometer": { "value": "12500", "unitCode": "KMT" },
  "vehicleTransmission": "PDK",
  "driveWheelConfiguration": "Rear drive",
  "color": "Oak Green Metallic",
  "offers": { "@type": "Offer", "price": "224990", "priceCurrency": "EUR" }
}</script>`

const FIXTURE_HTML = `<html><head>${FIXTURE_JSON_LD}</head><body>
  <h1>Porsche 992 GT3 Touring</h1>
  <div class="specifications">
    <span>Engine:</span> <span>4.0L, 510 HP</span>
    <span>Interior:</span> <span>Black leather</span>
    <span>Fuel:</span> <span>Gasoline</span>
  </div>
  <div class="seller-info">
    <span class="seller-name">Auto Müller GmbH</span>
    <span class="seller-type">Dealer</span>
    <span class="location">Munich, Germany</span>
  </div>
  <div class="gallery">
    <img src="https://cdn.elferspot.com/wp-content/uploads/2023/img1.jpeg?class=xl" />
    <img src="https://cdn.elferspot.com/wp-content/uploads/2023/img2.jpeg?class=xl" />
  </div>
</body></html>`

describe("extractJsonLd", () => {
  it("parses Vehicle JSON-LD", () => {
    const data = extractJsonLd(FIXTURE_HTML)
    expect(data).not.toBeNull()
    expect(data!.price).toBe(224990)
    expect(data!.currency).toBe("EUR")
    expect(data!.model).toBe("992 GT3 Touring")
    expect(data!.mileageKm).toBe(12500)
    expect(data!.transmission).toBe("PDK")
    expect(data!.bodyType).toBe("Coupé")
    expect(data!.colorExterior).toBe("Oak Green Metallic")
  })
})

describe("parseDetailPage", () => {
  it("combines JSON-LD and Cheerio data", () => {
    const detail = parseDetailPage(FIXTURE_HTML)
    expect(detail.price).toBe(224990)
    expect(detail.images.length).toBe(2)
    expect(detail.images[0]).toContain("cdn.elferspot.com")
  })

  it("handles missing price (Price on request)", () => {
    const html = FIXTURE_HTML.replace('"price": "224990",', '"price": "",')
    const detail = parseDetailPage(html)
    expect(detail.price).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/elferspot_collector/detail.test.ts`

- [ ] **Step 3: Implement `detail.ts`**

```ts
// src/features/scrapers/elferspot_collector/detail.ts
import * as cheerio from "cheerio"
import type { ElferspotDetail } from "./types"

interface JsonLdVehicle {
  price: number | null
  currency: string
  model: string | null
  year: number | null
  mileageKm: number | null
  transmission: string | null
  bodyType: string | null
  driveType: string | null
  colorExterior: string | null
  firstRegistration: string | null
}

export function extractJsonLd(html: string): JsonLdVehicle | null {
  const $ = cheerio.load(html)
  let vehicle: JsonLdVehicle | null = null

  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const raw = $(el).html()
      if (!raw) return
      const parsed = JSON.parse(raw)

      // Handle @graph arrays or direct objects
      const items = Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed]
      for (const item of items) {
        if (item["@type"] === "Vehicle" || item["@type"]?.includes("Vehicle")) {
          const offer = item.offers || {}
          const mileage = item.mileageFromOdometer
          const priceRaw = offer.price ?? item.price
          const price = priceRaw ? parseFloat(String(priceRaw)) : null

          vehicle = {
            price: price && Number.isFinite(price) && price > 0 ? price : null,
            currency: offer.priceCurrency || "EUR",
            model: item.model || null,
            year: item.dateVehicleFirstRegistered
              ? new Date(item.dateVehicleFirstRegistered).getFullYear()
              : null,
            mileageKm: mileage?.value ? parseInt(String(mileage.value), 10) : null,
            transmission: item.vehicleTransmission || null,
            bodyType: item.bodyType || null,
            driveType: item.driveWheelConfiguration || null,
            colorExterior: item.color || null,
            firstRegistration: item.dateVehicleFirstRegistered || null,
          }
          return false // stop iterating
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  })

  return vehicle
}

export function parseDetailPage(html: string): ElferspotDetail {
  const $ = cheerio.load(html)
  const jsonLd = extractJsonLd(html)

  // Images from gallery — filter to CDN URLs only
  const images: string[] = []
  $("img[src*='cdn.elferspot.com']").each((_i, el) => {
    const src = $(el).attr("src") || ""
    if (src && !images.includes(src)) {
      images.push(src)
    }
  })
  // Also check data-src (lazy loaded)
  $("img[data-src*='cdn.elferspot.com']").each((_i, el) => {
    const src = $(el).attr("data-src") || ""
    if (src && !images.includes(src)) {
      images.push(src)
    }
  })

  // Cheerio fallback for fields not in JSON-LD
  const bodyText = $("body").text()

  // Engine extraction: look for pattern like "4.0L" or "3.0 Liter" + "510 HP"
  const engineMatch = bodyText.match(/(\d+\.\d+)\s*(?:L|Liter|l)(?:.*?(\d{2,4})\s*(?:HP|PS|hp|ps|bhp))?/)
  const engine = engineMatch
    ? `${engineMatch[1]}L${engineMatch[2] ? ` ${engineMatch[2]} HP` : ""}`
    : null

  // VIN extraction
  const vinMatch = bodyText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i)
  const vin = vinMatch ? vinMatch[0].toUpperCase() : null

  // Fuel type
  const fuelPatterns = ["Gasoline", "Diesel", "Electric", "Hybrid", "Benzin", "Elektro"]
  const fuel = fuelPatterns.find(f => bodyText.includes(f)) || null

  // Description text
  const descriptionEl = $(".description, .vehicle-description, [class*='description']").first()
  const descriptionText = descriptionEl.text().trim() || null

  return {
    // JSON-LD primary
    price: jsonLd?.price ?? null,
    currency: jsonLd?.currency ?? "EUR",
    year: jsonLd?.year ?? null,
    mileageKm: jsonLd?.mileageKm ?? null,
    transmission: jsonLd?.transmission ?? null,
    bodyType: jsonLd?.bodyType ?? null,
    driveType: jsonLd?.driveType ?? null,
    colorExterior: jsonLd?.colorExterior ?? null,
    model: jsonLd?.model ?? null,
    firstRegistration: jsonLd?.firstRegistration ?? null,
    // Cheerio fallback
    fuel,
    engine,
    colorInterior: null, // Extracted from spec table in production
    vin,
    sellerName: null, // Extracted from seller section
    sellerType: null,
    location: null,
    locationCountry: null,
    descriptionText,
    images,
    condition: null,
  }
}

export async function fetchDetailPage(url: string): Promise<ElferspotDetail> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const html = await response.text()
  return parseDetailPage(html)
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/scrapers/elferspot_collector/detail.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/elferspot_collector/detail.ts src/features/scrapers/elferspot_collector/detail.test.ts
git commit -m "feat(elferspot): add detail page parser with JSON-LD + Cheerio"
```

---

### Task 6: Create `normalize.ts` + `supabase_writer.ts`

**Files:**
- Create: `src/features/scrapers/elferspot_collector/normalize.ts`
- Create: `src/features/scrapers/elferspot_collector/normalize.test.ts`
- Create: `src/features/scrapers/elferspot_collector/supabase_writer.ts`

- [ ] **Step 1: Write normalize tests**

```ts
// src/features/scrapers/elferspot_collector/normalize.test.ts
import { describe, it, expect } from "vitest"
import { normalizeListing, mapTransmission, mapBodyStyle } from "./normalize"
import type { ElferspotListingSummary, ElferspotDetail } from "./types"

describe("mapTransmission", () => {
  it("maps PDK to Automatic", () => expect(mapTransmission("PDK")).toBe("Automatic"))
  it("maps Manual to Manual", () => expect(mapTransmission("Manual")).toBe("Manual"))
  it("maps Schaltgetriebe to Manual", () => expect(mapTransmission("Schaltgetriebe")).toBe("Manual"))
  it("returns null for null input", () => expect(mapTransmission(null)).toBeNull())
})

describe("mapBodyStyle", () => {
  it("maps Coupé to Coupe", () => expect(mapBodyStyle("Coupé")).toBe("Coupe"))
  it("maps Cabriolet to Convertible", () => expect(mapBodyStyle("Cabriolet")).toBe("Convertible"))
  it("maps Targa to Targa", () => expect(mapBodyStyle("Targa")).toBe("Targa"))
})

describe("normalizeListing", () => {
  const summary: ElferspotListingSummary = {
    sourceUrl: "https://www.elferspot.com/en/car/porsche-992-gt3-2023-5856995/",
    sourceId: "5856995",
    title: "Porsche 992 GT3",
    year: 2023,
    country: "DE",
    thumbnailUrl: "https://cdn.elferspot.com/thumb.jpg",
  }

  const detail: ElferspotDetail = {
    price: 224990, currency: "EUR", year: 2023, mileageKm: 12500,
    transmission: "PDK", bodyType: "Coupé", driveType: "Rear drive",
    colorExterior: "Green", model: "992 GT3", firstRegistration: "2023-06-15",
    fuel: "Gasoline", engine: "4.0L 510 HP", colorInterior: "Black",
    vin: "WP0ZZZ99ZPS123456", sellerName: "Auto Müller", sellerType: "dealer",
    location: "Munich", locationCountry: "Germany", descriptionText: "Perfect condition",
    images: ["https://cdn.elferspot.com/img1.jpeg"], condition: "Accident-free",
  }

  it("produces a valid normalized listing", () => {
    const result = normalizeListing(summary, detail)
    expect(result).not.toBeNull()
    expect(result!.source).toBe("Elferspot")
    expect(result!.source_id).toBe("5856995")
    expect(result!.make).toBe("Porsche")
    expect(result!.price).toBe(224990)
    expect(result!.original_currency).toBe("EUR")
    expect(result!.transmission).toBe("Automatic") // PDK → Automatic
    expect(result!.body_style).toBe("Coupe") // Coupé → Coupe
    expect(result!.vin).toBe("WP0ZZZ99ZPS123456")
  })

  it("handles null price (Price on request)", () => {
    const result = normalizeListing(summary, { ...detail, price: null })
    expect(result!.price).toBeNull()
  })
})
```

- [ ] **Step 2: Implement `normalize.ts`**

```ts
// src/features/scrapers/elferspot_collector/normalize.ts
import type { ElferspotListingSummary, ElferspotDetail } from "./types"
import { extractSeries } from "@/lib/brandConfig"
import { validateListing } from "@/features/scrapers/common/listingValidator"

export function mapTransmission(raw: string | null): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.includes("pdk") || lower.includes("tiptronic") || lower.includes("automatik") || lower.includes("automatic")) return "Automatic"
  if (lower.includes("manual") || lower.includes("schaltgetriebe") || lower.includes("handschaltung")) return "Manual"
  return raw
}

export function mapBodyStyle(raw: string | null): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.includes("coupé") || lower.includes("coupe")) return "Coupe"
  if (lower.includes("cabriolet") || lower.includes("convertible") || lower.includes("cabrio")) return "Convertible"
  if (lower.includes("targa")) return "Targa"
  if (lower.includes("speedster")) return "Speedster"
  if (lower.includes("sport turismo") || lower.includes("shooting brake")) return "Sport Turismo"
  return raw
}

export interface NormalizedElferspot {
  source: "Elferspot"
  source_id: string
  source_url: string
  title: string
  make: "Porsche"
  model: string
  trim: string | null
  year: number
  price: number | null
  original_currency: string
  mileage_km: number | null
  transmission: string | null
  body_style: string | null
  engine: string | null
  color_exterior: string | null
  color_interior: string | null
  vin: string | null
  description_text: string | null
  images: string[]
  photos_count: number
  country: string | null
  location: string | null
  seller_type: string | null
  seller_name: string | null
  status: "active"
  fuel: string | null
  scrape_timestamp: string
}

export function normalizeListing(
  summary: ElferspotListingSummary,
  detail: ElferspotDetail | null,
): NormalizedElferspot | null {
  const year = detail?.year ?? summary.year
  if (!year) return null

  const title = summary.title
  const modelRaw = detail?.model ?? title.replace(/^Porsche\s+/i, "").trim()
  const model = extractSeries(modelRaw, year, "Porsche") || modelRaw.split(/\s+/)[0]

  // Validation
  const validation = validateListing({ make: "Porsche", model: modelRaw, title, year })
  if (!validation.valid) return null

  // Extract trim from the model name (e.g., "992 GT3 Touring" → "GT3 Touring")
  const trimMatch = modelRaw.replace(/^\d{3}\.?\d?\s*/i, "").trim()
  const trim = trimMatch || null

  return {
    source: "Elferspot",
    source_id: summary.sourceId,
    source_url: summary.sourceUrl,
    title,
    make: "Porsche",
    model: validation.fixedModel || modelRaw,
    trim,
    year,
    price: detail?.price ?? null,
    original_currency: detail?.currency ?? "EUR",
    mileage_km: detail?.mileageKm ?? null,
    transmission: mapTransmission(detail?.transmission ?? null),
    body_style: mapBodyStyle(detail?.bodyType ?? null),
    engine: detail?.engine ?? null,
    color_exterior: detail?.colorExterior ?? null,
    color_interior: detail?.colorInterior ?? null,
    vin: detail?.vin ?? null,
    description_text: detail?.descriptionText ?? null,
    images: detail?.images ?? (summary.thumbnailUrl ? [summary.thumbnailUrl] : []),
    photos_count: detail?.images?.length ?? (summary.thumbnailUrl ? 1 : 0),
    country: detail?.locationCountry ?? summary.country ?? null,
    location: detail?.location ?? null,
    seller_type: detail?.sellerType ?? null,
    seller_name: detail?.sellerName ?? null,
    status: "active",
    fuel: detail?.fuel ?? null,
    scrape_timestamp: new Date().toISOString(),
  }
}
```

- [ ] **Step 3: Implement `supabase_writer.ts`**

Follow the exact pattern from `beforward_porsche_collector/supabase_writer.ts`:

```ts
// src/features/scrapers/elferspot_collector/supabase_writer.ts
import { createClient } from "@supabase/supabase-js"
import type { NormalizedElferspot } from "./normalize"

export async function upsertListing(listing: NormalizedElferspot, dryRun: boolean): Promise<boolean> {
  if (dryRun) return false

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env vars")

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const row = {
    source: listing.source,
    source_id: listing.source_id,
    source_url: listing.source_url,
    title: listing.title,
    make: listing.make,
    model: listing.model,
    trim: listing.trim,
    year: listing.year,
    price: listing.price,
    original_currency: listing.original_currency,
    mileage_km: listing.mileage_km,
    transmission: listing.transmission,
    body_style: listing.body_style,
    engine: listing.engine,
    color_exterior: listing.color_exterior,
    color_interior: listing.color_interior,
    vin: listing.vin,
    description_text: listing.description_text,
    images: listing.images,
    photos_count: listing.photos_count,
    country: listing.country,
    location: listing.location,
    seller_type: listing.seller_type,
    seller_name: listing.seller_name,
    status: listing.status,
    fuel: listing.fuel,
    scrape_timestamp: listing.scrape_timestamp,
    updated_at: new Date().toISOString(),
  }

  const { error } = await client
    .from("listings")
    .upsert(row, { onConflict: "source,source_id" })

  if (error) throw new Error(`Upsert failed: ${error.message}`)
  return true
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/scrapers/elferspot_collector/normalize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/elferspot_collector/normalize.ts src/features/scrapers/elferspot_collector/normalize.test.ts src/features/scrapers/elferspot_collector/supabase_writer.ts
git commit -m "feat(elferspot): add normalize + supabase_writer"
```

---

### Task 7: Create `checkpoint.ts` + `collector.ts`

**Files:**
- Create: `src/features/scrapers/elferspot_collector/checkpoint.ts`
- Create: `src/features/scrapers/elferspot_collector/collector.ts`

- [ ] **Step 1: Create `checkpoint.ts`**

Follow the exact BeForward checkpoint pattern:

```ts
// src/features/scrapers/elferspot_collector/checkpoint.ts
import { promises as fs } from "node:fs"
import path from "node:path"

export interface ElferspotCheckpoint {
  version: 1
  updatedAt: string
  lastCompletedPage: number
  processedIds: string[]
  written: number
  errors: number
}

const DEFAULT: ElferspotCheckpoint = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  lastCompletedPage: 0,
  processedIds: [],
  written: 0,
  errors: 0,
}

export async function loadCheckpoint(filePath: string): Promise<ElferspotCheckpoint> {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return { ...DEFAULT }
    return { ...DEFAULT, ...parsed }
  } catch {
    return { ...DEFAULT }
  }
}

export async function saveCheckpoint(filePath: string, cp: ElferspotCheckpoint): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify({ ...cp, version: 1, updatedAt: new Date().toISOString() }, null, 2) + "\n", "utf8")
}
```

- [ ] **Step 2: Create `collector.ts`**

```ts
// src/features/scrapers/elferspot_collector/collector.ts
import crypto from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

import { loadCheckpoint, saveCheckpoint } from "./checkpoint"
import { fetchSearchPage } from "./discover"
import { fetchDetailPage } from "./detail"
import { normalizeListing } from "./normalize"
import { upsertListing } from "./supabase_writer"
import type { CollectorRunConfig, CollectorResult, CollectorCounts, ElferspotListingSummary } from "./types"

export async function runElferspotCollector(config: CollectorRunConfig): Promise<CollectorResult> {
  const runId = crypto.randomUUID()
  const counts: CollectorCounts = { discovered: 0, written: 0, enriched: 0, errors: 0 }
  const errors: string[] = []
  const CONSECUTIVE_FAILURE_LIMIT = 5
  let consecutiveFailures = 0

  console.log(`[elferspot] Starting run ${runId}, maxPages=${config.maxPages}, details=${config.scrapeDetails}`)

  const checkpoint = await loadCheckpoint(config.checkpointPath)
  const processedSet = new Set(checkpoint.processedIds)
  const startPage = checkpoint.lastCompletedPage + 1

  // Ensure output dir
  const outputDir = path.dirname(config.outputPath)
  await fs.mkdir(outputDir, { recursive: true })

  for (let page = startPage; page <= config.maxPages; page++) {
    if (counts.discovered >= config.maxListings) {
      console.log(`[elferspot] Reached maxListings=${config.maxListings}`)
      break
    }

    try {
      console.log(`[elferspot] Fetching page ${page}...`)
      const { listings } = await fetchSearchPage(page, config.language, config.delayMs)

      if (listings.length === 0) {
        console.log(`[elferspot] No listings on page ${page}, stopping.`)
        break
      }

      for (const summary of listings) {
        if (processedSet.has(summary.sourceId)) continue
        if (counts.discovered >= config.maxListings) break

        counts.discovered++

        try {
          let detail = null
          if (config.scrapeDetails) {
            // Wait before detail fetch (rate limiting)
            await sleep(config.delayMs)
            detail = await fetchDetailPage(summary.sourceUrl)
            counts.enriched++
          }

          const normalized = normalizeListing(summary, detail)
          if (!normalized) continue

          const wrote = await upsertListing(normalized, config.dryRun)
          if (wrote) counts.written++

          // Append to JSONL
          await fs.appendFile(config.outputPath, JSON.stringify(normalized) + "\n", "utf8")

          processedSet.add(summary.sourceId)
          consecutiveFailures = 0  // Reset on success
        } catch (err) {
          counts.errors++
          consecutiveFailures++
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`${summary.sourceUrl}: ${msg}`)

          // Circuit-break on 403/429
          if (/\b(403|429)\b/.test(msg)) {
            errors.push("Circuit-break: blocked by server")
            break
          }

          // Circuit-break on consecutive failures
          if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
            errors.push(`Circuit-break: ${CONSECUTIVE_FAILURE_LIMIT} consecutive failures`)
            break
          }
        }
      }

      // Save checkpoint after each page
      await saveCheckpoint(config.checkpointPath, {
        version: 1,
        updatedAt: new Date().toISOString(),
        lastCompletedPage: page,
        processedIds: Array.from(processedSet),
        written: counts.written,
        errors: counts.errors,
      })

      // Wait before next page (rate limiting)
      if (page < config.maxPages) {
        await sleep(config.delayMs)
      }
    } catch (err) {
      counts.errors++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Page ${page}: ${msg}`)

      if (/\b(403|429)\b/.test(msg)) {
        errors.push("Circuit-break: blocked by server")
        break
      }
    }
  }

  console.log(`[elferspot] Run complete: discovered=${counts.discovered}, written=${counts.written}, errors=${counts.errors}`)
  return { runId, counts, errors }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
```

- [ ] **Step 3: Verify compiles**

Run: `npx tsc --noEmit src/features/scrapers/elferspot_collector/collector.ts`

- [ ] **Step 4: Commit**

```bash
git add src/features/scrapers/elferspot_collector/checkpoint.ts src/features/scrapers/elferspot_collector/collector.ts
git commit -m "feat(elferspot): add checkpoint + collector orchestrator"
```

---

### Task 8: Create `cli.ts` entry point

**Files:**
- Create: `src/features/scrapers/elferspot_collector/cli.ts`

- [ ] **Step 1: Create `cli.ts`**

Follow the BeForward CLI pattern (manual env loading, argv parsing):

```ts
// src/features/scrapers/elferspot_collector/cli.ts
import { existsSync, readFileSync } from "node:fs"
import { resolve as resolvePath } from "node:path"
import { runElferspotCollector } from "./collector"
import type { CollectorRunConfig } from "./types"

function loadEnvFromFile(relPath: string): void {
  const abs = resolvePath(process.cwd(), relPath)
  if (!existsSync(abs)) return
  const raw = readFileSync(abs, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (!key || process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1)
    process.env[key] = value
  }
}

function parseArgv(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue
    const trimmed = raw.slice(2)
    const eq = trimmed.indexOf("=")
    if (eq === -1) { out[trimmed] = true; continue }
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return out
}

async function main() {
  loadEnvFromFile(".env.local")
  loadEnvFromFile(".env")

  const args = parseArgv(process.argv.slice(2))

  if (args.help) {
    console.log([
      "Elferspot Collector CLI",
      "",
      "Usage:",
      "  npx tsx src/features/scrapers/elferspot_collector/cli.ts [flags]",
      "",
      "Flags:",
      "  --maxPages=25          Max search pages (default: 25)",
      "  --maxListings=3500     Max listings (default: 3500)",
      "  --scrapeDetails        Fetch detail pages (default: false)",
      "  --delayMs=10000        Delay between requests in ms (default: 10000)",
      "  --dryRun               Skip DB writes",
      "  --language=en          Site language: en, de, nl, fr (default: en)",
      "  --checkpointPath=...   Resume file",
      "  --outputPath=...       JSONL output file",
      "  --help                 Show this help",
    ].join("\n"))
    process.exit(0)
  }

  const config: CollectorRunConfig = {
    maxPages: Number(args.maxPages) || 25,
    maxListings: Number(args.maxListings) || 3500,
    scrapeDetails: args.scrapeDetails === true,
    delayMs: Number(args.delayMs) || 10_000,
    checkpointPath: String(args.checkpointPath || "var/elferspot_collector/checkpoint.json"),
    outputPath: String(args.outputPath || "var/elferspot_collector/listings.jsonl"),
    dryRun: args.dryRun === true,
    language: (String(args.language || "en")) as CollectorRunConfig["language"],
  }

  console.log("[elferspot] Config:", JSON.stringify(config, null, 2))
  const result = await runElferspotCollector(config)
  console.log("[elferspot] Result:", JSON.stringify(result, null, 2))

  process.exit(result.counts.errors > 0 ? 1 : 0)
}

main().catch(err => {
  console.error("[elferspot] Fatal:", err)
  process.exit(1)
})
```

- [ ] **Step 2: Verify it runs (help flag)**

Run: `npx tsx src/features/scrapers/elferspot_collector/cli.ts --help`
Expected: Shows help text, exits 0

- [ ] **Step 3: Commit**

```bash
git add src/features/scrapers/elferspot_collector/cli.ts
git commit -m "feat(elferspot): add CLI entry point"
```

---

### Task 9: Create discovery cron route (`/api/cron/elferspot`)

**Files:**
- Create: `src/app/api/cron/elferspot/route.ts`
- Create: `src/app/api/cron/elferspot/route.test.ts`

- [ ] **Step 1: Write the cron route test**

Follow the exact pattern from `enrich-details/route.test.ts`:

```ts
// src/app/api/cron/elferspot/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "./route"

vi.mock("@/features/scrapers/elferspot_collector/collector", () => ({
  runElferspotCollector: vi.fn().mockResolvedValue({
    runId: "test-run",
    counts: { discovered: 10, written: 5, enriched: 0, errors: 0 },
    errors: [],
  }),
}))

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}))

import { markScraperRunStarted, recordScraperRun, clearScraperRunActive } from "@/features/scrapers/common/monitoring"

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/elferspot", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe("GET /api/cron/elferspot", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = "test-secret"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key"
  })

  it("returns 401 without valid auth", async () => {
    const response = await GET(makeRequest("wrong"))
    expect(response.status).toBe(401)
  })

  it("returns 200 on success", async () => {
    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.discovered).toBe(10)
  })

  it("calls monitoring lifecycle", async () => {
    await GET(makeRequest())
    expect(markScraperRunStarted).toHaveBeenCalledWith(expect.objectContaining({ scraperName: "elferspot" }))
    expect(recordScraperRun).toHaveBeenCalledWith(expect.objectContaining({ scraper_name: "elferspot", success: true }))
    expect(clearScraperRunActive).toHaveBeenCalledWith("elferspot")
  })
})
```

- [ ] **Step 2: Implement the cron route**

```ts
// src/app/api/cron/elferspot/route.ts
import { NextResponse } from "next/server"
import { runElferspotCollector } from "@/features/scrapers/elferspot_collector/collector"
import { clearScraperRunActive, markScraperRunStarted, recordScraperRun } from "@/features/scrapers/common/monitoring"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  const startTime = Date.now()
  const startedAtIso = new Date(startTime).toISOString()
  const runId = crypto.randomUUID()

  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  await markScraperRunStarted({ scraperName: "elferspot", runId, startedAt: startedAtIso, runtime: "vercel_cron" })

  try {
    const result = await runElferspotCollector({
      maxPages: 25,
      maxListings: 3500,
      scrapeDetails: false,
      delayMs: 10_000,
      checkpointPath: "/tmp/elferspot_collector/checkpoint.json",
      outputPath: "/tmp/elferspot_collector/listings.jsonl",
      dryRun: false,
      language: "en",
    })

    await recordScraperRun({
      scraper_name: "elferspot",
      run_id: result.runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: result.counts.discovered,
      written: result.counts.written,
      errors_count: result.counts.errors,
      error_messages: result.errors.length > 0 ? result.errors : undefined,
    })

    await clearScraperRunActive("elferspot")

    return NextResponse.json({
      success: true,
      runId: result.runId,
      discovered: result.counts.discovered,
      written: result.counts.written,
      errors: result.errors,
      duration: `${Date.now() - startTime}ms`,
    })
  } catch (error) {
    console.error("[cron/elferspot] Error:", error)
    await recordScraperRun({
      scraper_name: "elferspot", run_id: runId, started_at: startedAtIso,
      finished_at: new Date().toISOString(), success: false, runtime: "vercel_cron",
      duration_ms: Date.now() - startTime, discovered: 0, written: 0, errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Collection failed"],
    })
    await clearScraperRunActive("elferspot")
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Collection failed", duration: `${Date.now() - startTime}ms` }, { status: 500 })
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/app/api/cron/elferspot/route.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/elferspot/route.ts src/app/api/cron/elferspot/route.test.ts
git commit -m "feat(elferspot): add discovery cron route"
```

---

### Task 10: Create enrichment cron route (`/api/cron/enrich-elferspot`)

**Files:**
- Create: `src/app/api/cron/enrich-elferspot/route.ts`
- Create: `src/app/api/cron/enrich-elferspot/route.test.ts`

- [ ] **Step 1: Write the cron route test**

```ts
// src/app/api/cron/enrich-elferspot/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock Supabase
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      is: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }),
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
  })),
}));

// Mock detail parser
vi.mock("@/features/scrapers/elferspot_collector/detail", () => ({
  fetchDetailPage: vi.fn(),
}));

// Mock monitoring
vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/enrich-elferspot", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/enrich-elferspot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("returns 401 without valid auth", async () => {
    const response = await GET(makeRequest("wrong"));
    expect(response.status).toBe(401);
  });

  it("returns 200 with empty results when no listings need enrichment", async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.discovered).toBe(0);
    expect(data.enriched).toBe(0);
  });

  it("calls monitoring lifecycle functions", async () => {
    await GET(makeRequest());
    expect(markScraperRunStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        scraperName: "enrich-elferspot",
        runtime: "vercel_cron",
      })
    );
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "enrich-elferspot",
        success: true,
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("enrich-elferspot");
  });

  it("returns 500 when Supabase env vars missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("Supabase");
  });
});
```

- [ ] **Step 2: Implement the enrichment route**

```ts
// src/app/api/cron/enrich-elferspot/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchDetailPage } from "@/features/scrapers/elferspot_collector/detail";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { success: false, error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  await markScraperRunStarted({
    scraperName: "enrich-elferspot",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Query Elferspot active listings missing description (proxy for unenriched)
    const { data: rows, error: fetchErr } = await client
      .from("listings")
      .select("id,source_url")
      .eq("source", "Elferspot")
      .eq("status", "active")
      .is("description_text", null)
      .order("updated_at", { ascending: true })
      .limit(50);

    if (fetchErr || !rows) {
      throw new Error(fetchErr?.message ?? "No rows returned");
    }

    const discovered = rows.length;
    let enriched = 0;
    const errors: string[] = [];
    const DELAY_MS = 5_000;        // 5s between fetches (Elferspot 10s crawl-delay)
    const TIME_BUDGET_MS = 270_000; // 4.5 min budget within 5 min maxDuration

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Time budget check
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        errors.push(`Time budget reached after ${enriched} enrichments`);
        break;
      }

      // Rate limit
      if (i > 0) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      try {
        const detail = await fetchDetailPage(row.source_url);

        if (!detail) {
          // Mark as attempted — set description_text to empty string
          await client
            .from("listings")
            .update({ description_text: "", updated_at: new Date().toISOString() })
            .eq("id", row.id);
          continue;
        }

        // Build update payload — only set non-null fields
        // Field names match ElferspotDetail interface (types.ts)
        const update: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (detail.transmission) update.transmission = detail.transmission;
        if (detail.bodyType) update.body_style = detail.bodyType;
        if (detail.engine) update.engine = detail.engine;
        if (detail.colorExterior) update.color_exterior = detail.colorExterior;
        if (detail.colorInterior) update.color_interior = detail.colorInterior;
        if (detail.vin) update.vin = detail.vin;
        if (detail.descriptionText) update.description_text = detail.descriptionText;
        if (detail.images && detail.images.length > 0) {
          update.images = detail.images;
          update.photos_count = detail.images.length;
        }
        if (detail.sellerName) update.seller_name = detail.sellerName;
        if (detail.sellerType) update.seller_type = detail.sellerType;
        if (detail.location) update.location = detail.location;
        if (detail.locationCountry) update.country = detail.locationCountry;

        const newFieldCount = Object.keys(update).length - 1; // minus updated_at
        if (newFieldCount > 0) {
          const { error: updateErr } = await client
            .from("listings")
            .update(update)
            .eq("id", row.id);

          if (updateErr) {
            errors.push(`Update failed (${row.id}): ${updateErr.message}`);
          } else {
            enriched++;
          }
        } else {
          // Mark as attempted
          await client
            .from("listings")
            .update({ description_text: "", updated_at: new Date().toISOString() })
            .eq("id", row.id);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        // Mark 404/410 as delisted
        if (/\b(404|410)\b/.test(msg)) {
          await client
            .from("listings")
            .update({ status: "delisted", updated_at: new Date().toISOString() })
            .eq("id", row.id);
          errors.push(`Delisted (${row.id}): ${msg}`);
          continue;
        }

        // Circuit-break on 403/429
        if (/\b(403|429)\b/.test(msg)) {
          errors.push(`Circuit-break: ${msg}`);
          break;
        }

        errors.push(`Failed ${row.source_url}: ${msg}`);
      }
    }

    await recordScraperRun({
      scraper_name: "enrich-elferspot",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written: enriched,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });

    await clearScraperRunActive("enrich-elferspot");

    return NextResponse.json({
      success: true,
      runId,
      discovered,
      enriched,
      errors,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/enrich-elferspot] Error:", error);

    await recordScraperRun({
      scraper_name: "enrich-elferspot",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Enrichment failed"],
    });

    await clearScraperRunActive("enrich-elferspot");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Enrichment failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/app/api/cron/enrich-elferspot/route.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/enrich-elferspot/route.ts src/app/api/cron/enrich-elferspot/route.test.ts
git commit -m "feat(elferspot): add enrichment cron route"
```

---

### Task 11: Register in monitoring, dashboard, vercel.json

**Files:**
- Modify: `src/features/scrapers/common/monitoring/types.ts`
- Modify: `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx`
- Modify: `vercel.json`

- [ ] **Step 1: Add to `ScraperName` type union**

In `src/features/scrapers/common/monitoring/types.ts`, add `'elferspot' | 'enrich-elferspot'` to the `ScraperName` union:

```ts
// BEFORE:
export type ScraperName = 'porsche' | 'ferrari' | ... | 'cleanup';

// AFTER:
export type ScraperName = 'porsche' | 'ferrari' | ... | 'cleanup' | 'elferspot' | 'enrich-elferspot';
```

- [ ] **Step 2: Add to dashboard config arrays**

In `ScrapersDashboardClient.tsx`, add to ALL 4 config objects:

```ts
// ALL_SCRAPERS array — add:
"elferspot",
"enrich-elferspot",

// SCRAPER_LABELS — add:
elferspot: "Elferspot",
"enrich-elferspot": "Elferspot Enrichment",

// SCRAPER_RUNTIME — add:
elferspot: "Vercel Cron",
"enrich-elferspot": "Vercel Cron",

// SCRAPER_CADENCE_MS — add:
elferspot: 24 * 60 * 60 * 1000,
"enrich-elferspot": 24 * 60 * 60 * 1000,
```

- [ ] **Step 3: Add cron entries to `vercel.json`**

```json
{ "path": "/api/cron/elferspot", "schedule": "15 9 * * *" },
{ "path": "/api/cron/enrich-elferspot", "schedule": "45 9 * * *" }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (including the new ones from Tasks 2, 4, 5, 6, 9, 10)

- [ ] **Step 6: Commit**

```bash
git add src/features/scrapers/common/monitoring/types.ts src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx vercel.json
git commit -m "feat(elferspot): register in monitoring, dashboard, and vercel cron schedule"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: CLI smoke test**

Run: `npx tsx src/features/scrapers/elferspot_collector/cli.ts --help`
Expected: Shows help text

- [ ] **Step 4: Verify no hardcoded variants remain**

Search for inline variant arrays that should have been moved to `brandVariants.ts`:

Run: `grep -n "keywords.*carrera" src/lib/brandConfig.ts | head -5`
Expected: No matches (all moved to `brandVariants.ts`)

- [ ] **Step 5: Verify variant count**

Run: `grep -c "id:" src/lib/brandVariants.ts`
Expected: 200+ entries
