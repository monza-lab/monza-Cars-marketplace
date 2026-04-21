# Haus Report v2 — Online Report + PDF + Excel Design

**Date:** 2026-04-21
**Status:** Draft — pending user review
**Owner:** Edgar / Monza Haus
**Supersedes:** Extends `2026-04-19-fair-value-signal-extraction-design.md` (keeps signal extraction foundation; rewrites IA, adds exports as first-class deliverables, introduces tier system and KB architecture)

---

## 1. Context & Problem

The Haus Report is the core monetization product of Monza Haus. v1 (shipped in `Front-monzaaa`) established:
- Signal extraction pipeline (structured + Gemini + seller tier)
- 12 modifiers library with public citations
- Specific-Car Fair Value with ±35% aggregate cap
- Landed cost calculator (4 destinations × 5+ origins)
- 10-section report UI
- Client-side jsPDF + xlsx exports (basic)

### What's wrong with v1

1. **IA built price-first but not intelligence-first.** Positioned as "fair value report" rather than "market intelligence dossier." Doesn't deliver the strategic promise of "the Bloomberg of Porsches."
2. **"What's special about this VIN" is thin.** Signals exist but aren't synthesized into a readable remarkable-findings block — the thing that would make a buyer say "they know this car."
3. **Exports are afterthoughts.** PDF = client-side jsPDF (effectively a screenshot of the webpage). Excel = raw xlsx dump. Neither is pro-grade or shareable.
4. **Trust layer is fragmented.** Citations exist on modifiers but not as a cross-cutting UI pattern. Sources block at bottom, not integrated.
5. **No depth gradient.** Every paid user gets the same report — no upgrade path, no premium tier, no monetizable progression from free experience to subscription.
6. **Mobile experience is desktop-adapted, not designed.** The primary ICP browses Monza Haus from mobile during Cars & Coffee events, at dealerships, and during idle moments.
7. **Client-side export generation** limits quality (inconsistency, no hashability, no persistent storage, no shareability).

---

## 2. v2 Vision

**Haus Report = Monza Haus' valuation intelligence product.** The paid deliverable that justifies the brand positioning: *"the most robust market intelligence platform for Porsche buyers in the world."*

Three concurrent deliverables:
- **Online report** (mobile-first, Bloomberg-style density, brand-pro)
- **PDF export** (standalone pro document, server-side, hash-verifiable, no whitespace gaps)
- **Excel export** (interactive financial model with editable assumptions, live formulas, brand-pro)

All three share the same underlying HausReport data snapshot (frozen at generation, immutable) but each medium is designed for its native consumption pattern.

### 2.1 Narrative spine: price-led, intelligence-enriched

The report opens with a VERDICT (BUY/WATCH/WALK) + Specific-Car Fair Value — the decision-grade output. Everything below enriches that verdict with market intelligence, VIN-specific remarkable findings, cross-border arbitrage signal, peer positioning, and operational due diligence.

Not editorial-first. Not dashboard-first. **Decision-first, with intelligence layered to defend the decision.**

### 2.2 Principle of restraint

*"Menos es más."* The report must feel pro and dense-in-value, not dense-in-noise. Each block earns its hierarchy. Top-N visible, rest collapsed. Typography and spacing carry weight; data density does not. Restraint is part of the brand. Never "botar un ladrillo."

### 2.3 Every claim is sourced

**Zero ungrounded prose.** Every number, every statement, every modifier has a verifiable source — visible as an inline badge, clickable to see the exact source row. No "estimates" without a cited methodology. This is the inviolable rule across all 3 tiers.

### 2.4 Snapshot immutability

A report is frozen at generation time. Never auto-updates. Timestamp discreetly visible. Data drift is addressed by user-initiated regeneration (new hash, new snapshot, version history preserved), never by silent overwrite. The buyer receives a document of "what I knew when I decided" — with legal clarity.

### 2.5 Verifiability as first-class

Every generated report has a SHA256 hash over its normalized JSON. PDFs and Excels include the hash + a public verify URL (`monzahaus.com/verify/{hash}`). Anyone receiving a shared export can visit the URL and see the original online report — anti-forge protection + brand-adjacent inbound traffic.

### 2.6 Mobile-first

The online report is designed mobile and scaled up to desktop. Not desktop adapted down. Single column default, Market Intel as sticky toolbar (not sidebar), tables as stacked cards, thumb-zone CTAs, 16px body minimum.

### 2.7 Tier system

Single report shell, one block varies by tier. Everything else (Verdict, Fair Value, Market Intel, Arbitrage Signal, Comparables, Signals Detected, Questions, Sources, Methodology) is identical across tiers.

- **Tier 1 (Free):** Signals-only synthesis in "What's Remarkable" (3 cards, each citing signal source).
- **Tier 2 (Monthly subscriber, universal day-1):** Signals + `porsche_model_specs` + curated Monza Haus editorial pack per variant (3–5 cards grounded in reference pack citations).
- **Tier 3 (Monthly subscriber, specialist agent available for this variant):** Tier 2 + specialist agent findings with deeper cross-references, rare-combo proofs, KB-backed claims (5–7 cards). Rollout progressive variant-by-variant.

When a specialist agent is not yet built for the user's variant, Tier 3 degrades elegantly to Tier 2 with a micro-badge noting the variant is in development. Never "broken" or "empty" state.

---

## 3. Scope & Boundaries

### 3.1 In scope for v2 (this spec)

- Front-end redesign of the online report (mobile-first)
- Front-end implementation of the 14 blocks defined in §5
- Server-side PDF generation (`@react-pdf/renderer`)
- Server-side Excel generation (`ExcelJS`, interactive with live formulas)
- SHA256 hash computation + public `/verify/{hash}` route
- Tier-aware report orchestrator (front-end awareness of tier, UI gating, CTA touchpoints)
- Reference pack data structure (front-end consumption; seeding is editorial work by Edgar/team, parallel track)
- Architecture scaffold for specialist agents + variant KB (data schemas, loader interfaces; individual agents post-v2)
- Refactor of the 2808-line `ReportClient.tsx` monolith into composed block components
- Close the signal-mapping gap (Gemini outputs `sport_chrono`, `pccb`, `lwb_seats`, `matching_numbers`, `garage_kept` currently not emitted as `DetectedSignal[]`)

### 3.2 Out of scope (explicit)

- **Pricing mechanics (token costs per output, monthly price, token renewal policy).** Edgar's decision, handled separately. UX must support variable token costs per output without rebuild.
- **Dealer product.** Phase 2 post-v2 (dashboard with bulk views, B2B pricing).
- **Specialist agents beyond the scaffold.** Each variant agent is its own build, post-v2.
- **Ownership Economics block.** Removed from v1 until we have sourced cost data per variant (violates "every claim sourced").
- **Similar Vehicles section.** Moved to detail page (discovery), not report (due diligence).
- **Live web search for specialist agents.** Tier 3 v1 only queries internal KB + allow-listed reference sources. External live web research post-legal-framework-finalization (ties to Legal Action Plan pending 2026-04-22).
- **Scenarios sheet in Excel.** User can Save-As the file for manual scenarios. Auto-scenarios feature post-v2.
- **Auto-upgrade flow on subscription.** User regenerates manually after upgrade. Silent auto-upgrade of existing reports can be added later.
- **Back-end migrations.** This spec defines expected data shapes (interface contract). BE handles actual Supabase migrations as parallel/follow-on work.

### 3.3 Workflow & Branch

- All front-end work happens on branch `reporte` (create if not exists; base from current default branch).
- **Front-end only** in this branch. No DB migrations.
- After front-end merge, BE team applies backend changes per handoff document (§13).

---

## 4. Architecture

### 4.1 Components

**Kept from v1 (may need refactor but not rewrite):**

| Module | Purpose | v2 changes |
|---|---|---|
| `src/lib/fairValue/extractors/*` | Signal extractors | Close mapping gap: emit all Gemini-extracted options as `DetectedSignal[]` |
| `src/lib/marketStats.ts` | Market statistics computation | Extend to expose `comparable_layer_used` (currently hardcoded "strict" in `/api/analyze`) |
| `src/lib/fairValue/engine.ts` | Modifier engine with caps | No structural changes |
| `src/lib/landedCost/*` | Import cost calculator | Expose for D2 arbitrage computation; data robustness work parallel track (Edgar) |
| `src/lib/fairValue/modifiers.ts` | 12 modifier library | Add missing public citation URLs for `warranty_remaining` and `seller_tier_specialist` (content team work, parallel) |

**New in v2:**

| Module | Purpose |
|---|---|
| `src/lib/referencePack/` | Editorial notes per variant (data loader + TypeScript interface). Data files per variant in `/reference-pack/{variant_key}.json` or Supabase table, TBD. |
| `src/lib/variantKB/` | Accumulative knowledge base query interface. Reads from new Supabase table `variant_knowledge` (BE migration). |
| `src/lib/specialistAgents/` | Per-variant agent scaffold. Tool access interface. Individual variant agents are post-v2. |
| `src/lib/remarkableGenerator/` | Tier-aware generator for the "What's Remarkable" block. Takes signals + (optional) reference pack + (optional) KB entries + (optional) agent findings → produces structured `RemarkableClaim[]`. |
| `src/lib/marketIntel/` | D1/D2/D3/D4 aggregator. Reads from `marketStats` + `landedCost` + comparables set. |
| `src/lib/reports/hash.ts` | SHA256 over normalized report JSON (sorted keys, deterministic serialization). |
| `src/lib/exports/pdf/` | `@react-pdf/renderer` templates + orchestrator. Output to Supabase Storage by hash. |
| `src/lib/exports/excel/` | `ExcelJS` interactive model with formulas, named ranges, branding. Output to Supabase Storage by hash. |
| `src/app/verify/[hash]/page.tsx` | Public verify route. Resolves hash → renders the original online snapshot. |

**Refactored:**

| Module | Change |
|---|---|
| `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` | Break the 2808-line monolith into block components; new composition matching §5 IA. |
| `src/components/report/*` | Add new block components (see §5). Keep existing components where reusable (`MarketDeltaPill`, `SignalsDetectedSection`, `SignalsMissingSection`, `ModifiersAppliedList`, `LandedCostBlock`, `SourcesBlock`, `HausReportTeaser`) with rewrites/adjustments. |
| `src/app/api/analyze/route.ts` | Replace with tier-aware orchestrator (signal extract → market intel → modifiers → remarkable generator → assemble + hash). |

### 4.2 Data flow

```
User click "Generate Haus Report"
        │
        ▼
  Plan/Tier check + Token check ──(fail)──▶ Paywall
        │
        ▼
  Cache lookup by (VIN, tier)
        │            │
   (hit)│            │(miss)
        │            ▼
        │     Signal extraction pipeline
        │        ├── Structured parsers
        │        ├── Gemini extractor
        │        └── Seller tier resolver
        │            │
        │            ▼
        │     Market stats + Market Intel aggregator
        │        ├── D1 trajectory (12m sold)
        │        ├── D2 arbitrage (cross-market + landed cost)
        │        ├── D3 peer positioning
        │        └── D4 freshness + confidence
        │            │
        │            ▼
        │     Modifier engine → Specific-Car Fair Value
        │            │
        │            ▼
        │     Remarkable Generator (tier-gated)
        │        ├── Tier 1: signals-only synthesis
        │        ├── Tier 2: + reference pack + KB lookup
        │        └── Tier 3: + specialist agent (if variant covered)
        │              │
        │              └─▶ Agent findings deposit into KB
        │            │
        │            ▼
        │     Assemble HausReport + compute SHA256 hash
        │            │
        │            ▼
        │     Persist to Supabase (listing_reports + listing_signals)
        │            │
        ▼            ▼
       UI renders online report
        │
        ▼ (on Download click, async)
   Export generators (PDF + Excel) → Supabase Storage by hash
        │
        ▼
   Public route: /verify/{hash}
```

### 4.3 Cache layers

| Layer | Scope | TTL | Purpose |
|---|---|---|---|
| `marketStats` | variant/year/mileage bucket | 24h (cron refresh) | Fair Value baseline |
| `listing_signals` | VIN | Persistent | Signals snapshot (immutable) |
| `listing_reports` | VIN + tier | Persistent | Full report snapshot with hash |
| `variant_knowledge` (KB) | variant | Persistent + growing | Reusable findings across reports |
| `exports_storage` | report hash | Persistent | PDF/Excel files |

---

## 5. Online Report IA — Block by Block (Mobile-First)

### 5.0 Layout principles (cross-cutting)

- **Single-column by default** (mobile-first). Desktop adds a collapsible right rail for Market Intel (not a persistent sidebar).
- **16px body minimum**, typography hierarchy carries weight
- **Sticky toolbar top** with Download + Regenerate + jump menu
- **Thumb-zone CTAs** bottom-fixed on mobile
- **Tables become stacked cards** on mobile. Zero horizontal scroll.
- **Hover interactions become taps** on mobile
- **Animations subtle** (200–300ms ease)

### 5.1 Header
Sticky top. Thumbnail 60×60 of car + `Year Make Model Trim` + `Generated Apr 21, 2026 · v1 · Tier 2` + Download / Regenerate buttons.

### 5.2 Verdict block
Prominent chip (`BUY` / `WATCH` / `WALK` with color accent) + one-liner reasoning + 3-number metric row (Asking · Fair Value mid · Delta %).

### 5.3 Specific-Car Fair Value
Range hero in display type (`$228K – $252K`) + sub-range text (`Mid $238K · Market layer: strict · 14 comparables`) + horizontal bar showing asking price positioned within the range + link to §5.6.

### 5.4 Market Intel Panel
Mobile: sticky toolbar top, tap to expand. Desktop: collapsible right rail.

**Only 3 compact elements** (restraint):
- Sparkline: sold trajectory 12m of the variant
- Confidence dot + count: `● High · 147 sold samples`
- Freshness: `Data captured Apr 15 – Apr 21, 2026`

Each clickable → drawer with full detail of the dimension.

### 5.5 What's Remarkable About This VIN *(tier-gated, the key block)*

Editorial card layout, not bullets. Each card:
- Claim text in editorial typeface (first line accented)
- Source badge clickable → source panel
- Confidence dot

**Tier 1:** 3 cards from signals only.
**Tier 2:** 3–5 cards grounded in reference pack + KB.
**Tier 3:** 5–7 cards with specialist agent findings.

**Tier 1 footer CTA:** subtle panel `Monthly subscribers unlock production context + specialist variant analysis → See sample`. `See sample` opens a modal showing a real Tier 2 output from a DIFFERENT car (avoids giving away the upsell content for this user's specific car).

### 5.6 Valuation Breakdown
Headline: `How we arrived at $238K`.
Visual line: `Comparables median $225K → +Modifiers +6% = Specific-Car Fair Value $238K`.
Top 3 most-impactful modifiers as compact cards with citation. Link `See all 12 applied →` expands.

### 5.7 Arbitrage Signal (D2 — killer feature)

4 horizontal cards (desktop) / 4 stacked cards (mobile):
- US (this listing) / EU / UK / JP
- Flag + market label + cheapest comparable + landed cost add + **total landed to origin region**
- Cards clickable → source listings

Below: one-line narrative insight (e.g., *"JP-sourced example costs $11K less than this listing after import. Worth exploring if timeline allows."*).

### 5.8 Comparables & Peer Positioning (D3)

Fused block with 2 internal tabs:

**Tab 1 (default):** Distribution chart. Histogram of sold prices (last 12m) + percentile marker where this VIN falls + median/P25/P75 lines + narrative one-liner.

**Tab 2:** Comparables table. Collapsed to 5 rows + `Show all N` expand. Mobile: table renders as stacked cards. Filters: mileage range, color, sold date. Each row links to source listing.

### 5.9 Market Context
Compact strip: 4 regional cards (flag + median sold · sample count · 6m trend arrow). No deep dive here — D2 Arbitrage handles that.

### 5.10 Signals Detected (+ Risk Flags inline)

**Risk Flags at top** in red chips (if any).
**Top 5 positive signals** below as neutral chips with value + evidence clickable.
Link `Show all N signals →` expands rest.

### 5.11 Questions To Ask The Seller

5–8 question cards from missing signals. Each card:
- Question in first-person imperative: *"Ask the seller for documented service history"*
- Reason: *"Service book not mentioned in listing"*
- Impact badge: *"Documented service history typically adds 4–6% to specific-car value"*

Button: `Copy all questions` → clipboard-formatted text ready for email/message paste.

### 5.12 Methodology
Sutil link to `/methodology` with hover preview of sections (Fair Value · Modifiers · Market Intel · Sources).

### 5.13 Sources (full)

Grid organized by category:
- **Market data sources** (BaT, AutoScout24, Classic.com, Elferspot, BeForward, AutoTrader, Collecting Cars, C&B, historical auction houses) — names + counts + capture dates
- **Reference pack citations** (Hagerty, PCA, press.porsche, Rennlist selected posts) — public URLs
- **KB citations** (Tier 2+) — variant_knowledge entry IDs used
- **Specialist agent sources** (Tier 3) — allow-listed external sources consulted

Each source with date and link visible.

### 5.14 Report metadata
Last line of the report:
`Haus Report · Generated Apr 21, 2026 · Hash: a7f3c29b · Modifier library v1.0 · Extraction v1.2 · [Verify this report ↗]`

Hash + `Verify this report` links to `/verify/{hash}`.

---

## 6. Trust Layer Design

### 6.1 Pattern: Hybrid

- **Inline source badges** on critical data points only (Fair Value, comparables count, arbitrage signal, modifier amounts, remarkable claims). Not on every number — only where it moves the decision.
- **Sources block complete** at §5.13.
- **Methodology page** linked from footer and from each block.
- **No footnote-style superscripts** (too academic, violates restraint).
- **No persistent sources sidecar** (competes with Market Intel panel).

### 6.2 Click-to-verify

Every source badge is clickable → opens a panel showing:
- The exact source row / signal / text excerpt that produced the datapoint
- Capture date
- For market data: the actual listings that fed the stat (VIN, price, date)
- For modifiers: link to the public citation URL + version
- For reference pack: link to the cited public source
- For KB entries: link to the source the agent used + verification timestamp

### 6.3 Freshness per datapoint

Every source badge includes capture date. Example: `Source: BaT · 14 comparables · captured Mar 15 – Apr 18, 2026`. Freshness is part of trust.

---

## 7. Knowledge Base (Accumulative, per Variant)

### 7.1 Principle

Agents and curators deposit verified findings into `variant_knowledge` keyed by variant. Future reports of the same variant query KB first before external lookup. Cost of lookup amortizes over scale. **KB becomes Monza Haus' data moat** — it grows as a natural byproduct of serving Tier 3 reports.

### 7.2 KB entry structure (TypeScript interface for BE contract)

```typescript
interface KBEntry {
  id: string
  variant_key: string              // e.g., "992_gt3_touring"
  claim_text: string               // e.g., "PTS Y5C represents ~12% of 992 GT3 order book in 2023"
  source_type: "editorial_curation" | "specialist_agent" | "external_verified"
  source_ref: string               // URL or internal ref
  source_capture_date: string      // ISO
  verified_at: string              // ISO
  verification_method: string      // how we confirmed truth
  confidence: "high" | "medium" | "low"
  tags: string[]                   // e.g., ["production_numbers", "pts_rarity"]
  supersedes?: string              // if this entry replaces an older one
  created_by: "monza_editorial" | "agent_{variant}"
  used_in_reports: string[]        // report IDs that referenced this entry (analytics)
}
```

### 7.3 Seeding

Reference Pack (editorial notes per variant, Monza Haus curates) is the initial seed. Each variant gets 5–10 KB entries at Tier 2 launch. Editorial work: ~30 min per variant × ~27 active Porsche variants ≈ **~14 hours of editorial** done by Edgar/team as parallel track to front-end build.

### 7.4 Agent contribution (Tier 3, post-v2)

As specialist agents come online (variant-by-variant), their verified findings deposit back into KB. The same KB entries serve all reports of that variant, including Tier 2 (since Tier 2 already reads KB). Net effect: Tier 2 quality improves silently as Tier 3 rolls out.

---

## 8. PDF Export Design

### 8.1 Engine

`@react-pdf/renderer` — declarative React components compiled to PDF. Server-side rendering in a Next.js API route. Async pipeline:

1. User clicks "Download PDF"
2. Token debit (if applicable)
3. API route triggers generation
4. Report data (from cache by hash) → React components → PDF blob
5. Blob uploaded to Supabase Storage keyed by hash
6. User receives download URL
7. Subsequent downloads of the same hash hit storage, no regeneration

### 8.2 Layout discipline — no whitespace gaps

- **Every page filled and purposeful.** No trailing half-pages, no orphan headings.
- `wrap={false}` on non-breakable blocks (a single card, a small table)
- Cover on page 1. Content starts page 2 (no preamble gap).
- Appendix (Sources, Methodology) uses **2-column layout** to fill ending pages.
- Target: 4–6 pages for a typical report. Dense in value, not noise.

### 8.3 Page structure (target)

1. **Cover:** Car identity + Verdict chip + Fair Value range + hash + verify URL + brand footer.
2. **What's Remarkable + Arbitrage Signal** — the two marquee intelligence blocks together.
3. **Valuation Breakdown + Top modifiers** — how Fair Value was computed.
4. **Comparables + Peer Positioning + Market Context** — market intelligence.
5. **Signals Detected + Questions To Ask The Seller** — due diligence.
6. **Sources + Methodology + Report metadata** — trust layer + closing, 2-column to fill the page.

### 8.4 Typography

Editorial, not webapp. Serif for display (brand choice: `Playfair Display` or equivalent Monza Haus serif) + clean sans for body + monospace for numerical data. Hierarchy > density.

### 8.5 Branding

Monza Haus wordmark on every page footer + timestamp + hash + verify URL + page number (e.g., `3 / 5`). Color palette consistent with brand (pink/burgundy per `brandConfig.ts`). No decorative illustrations.

### 8.6 Verify integration

Cover has prominent `Verify at monzahaus.com/verify/{hash}` callout. Each page footer has discreet hash + verify URL.

---

## 9. Excel Export Design

### 9.1 Engine

`ExcelJS` server-side. Writes **live formulas** into cells (not static computed values). Output stored in Supabase Storage by report hash.

### 9.2 4 Sheets

**Sheet 1 — Summary (static output, not editable)**
Car identity, Verdict, Fair Value range, asking delta, arbitrage signal summary, hash + verify URL. The "what Monza Haus said" document.

**Sheet 2 — Assumptions (editable inputs, blue cells)**
15–20 inputs across 4 sections. Each input has a comment: current Monza Haus value + source + "edit if you have better data."

- **Market baseline:** comparables median, P25, P75, sample size, market delta % (user-specified adjustment since capture date)
- **Modifiers:** each applied modifier with %, caps, current MH value
- **Landed cost:** shipping USD, exchange rate, duty %, VAT/sales tax %, marine insurance %, port/broker, registration
- **Ownership extras (optional):** annual maintenance, annual insurance, hold period, exit multiple

Sheet header: `Blue cells = your inputs. Black cells = live formulas. Edit only the blue.`

**Sheet 3 — Live Model (all formulas, reads from Assumptions)**
- Specific-Car Fair Value computation (baseline × modifiers with caps)
- Landed Cost breakdown (6-component + total)
- Total investment (price + landed cost)
- Arbitrage vs alternative markets (user can toggle which markets to compare)
- Verdict recomputed

All black cells. No manual edits intended. No password protection (respect the sophisticated ICP).

**Sheet 4 — Data & Sources**
- Comparables table (Excel native filters enabled)
- Signals detected with evidence
- Modifiers library with citations
- Sources with URLs + capture dates
- Condensed methodology notes

### 9.3 Branding

Monza Haus logo + brand colors + consistent typography across all sheets. Footer on each sheet: timestamp + hash + verify URL.

### 9.4 Cell conventions

- **Blue cells** = editable inputs
- **Black cells** = live formulas
- **Grey background** = reference data tables
- **No password protection.** Color convention + comments provide guardrails. If user breaks formulas, they re-download from report page.

---

## 10. Tier Gating UX

### 10.1 Pricing model (mechanics only — prices TBD by Edgar)

- **Tokens** ("pistones" in Spanish — naming TBD) per output: online report = X tokens, PDF = Y tokens, Excel = Z tokens. Variable per output, set and adjustable by Edgar.
- **Free tokens** at signup (TBD count; TBD whether one-time or recurring)
- **Monthly subscription** unlocks unlimited outputs + unlimited regeneration
- Subscription name TBD (not "Pro" confirmed; likely brand-aligned Spanish term)

### 10.2 Upgrade touchpoints inside the online report

Three subtle CTAs — no popups, no nag modals:

1. **Inside "What's Remarkable"** (Tier 1 only): subtle panel below the 3 bullets → `Monthly subscribers unlock production context + specialist variant analysis → See sample`. Modal shows real Tier 2 output from another car.
2. **Inside Market Intel Panel:** micro-link `Deepen with monthly subscription`.
3. **Footer CTA** after Sources: `Unlock unlimited reports + specialist variant analysis → Subscribe`.

### 10.3 Token cost visibility

Download buttons (PDF / Excel) show token cost inline at point of action: `Download PDF · 2 tokens`. Transparent pricing, no surprises.

### 10.4 Conversion UX (simple, no auto-upgrade in v1)

User clicks subscribe CTA → Stripe checkout → returns to report. User **manually regenerates** to get Tier 2 content (regeneration is free for subscribers). No silent auto-upgrade. Keeps mechanics simple for v1; can revisit post-launch.

---

## 11. Legal & Compliance Alignment

Per `project_monzahaus_legal_checklist.md` and `project_monzahaus_legal_action_plan_pending.md`:

- **Source attribution on every block.** All external data cited with source name + URL + capture date.
- **Methodology page mandatory.** Linked from report footer and every block.
- **Disclaimer #2 (no financial advice)** rendered in report footer and `/methodology`.
- **Disclaimer #3 (data accuracy)** visible in Methodology.
- **No seller prose reproduction.** Remarkable Generator Tier 1 uses signals (factual extractions), not description text verbatim. Tier 2/3 agents forbidden from quoting seller-authored prose; must paraphrase or reference objective facts only.
- **No aggregator data.** Sources are original marketplaces + editorial publishers (Hagerty, PCA, press.porsche, Rennlist) + our own derived data. `Classic.com` and similar aggregators excluded from sources list.
- **Hash + verify URL** = anti-forge legal protection for shared exports. Also strengthens "this is what we said on this date" framing.
- **DMCA contact** referenced in Sources section (email `copyright@monzahaus.com`).
- **Wyoming jurisdiction** noted in PDF cover footer along with Monza Lab LLC attribution.

---

## 12. Open Questions (for Edgar / team, parallel tracks)

- Exact token costs per output
- Monthly subscription price and name
- Whether free tokens renew monthly or are one-time at signup
- Which variants get specialist agents first (priority informed by listing volume)
- PDF typography serif family (brand decision, visual iteration)
- Regeneration policy: new hash snapshot with version history (recommended) vs overwrite
- Reference pack delivery format: JSON files in repo vs Supabase table (recommend: Supabase table for ease of updates without deploys)
- VIN-or-no-VIN handling: reports where listing has no VIN available — how do we keep KB keyed?

---

## 13. Back-End Handoff (post front-end merge)

Front-end assumes these BE changes will ship separately:

### 13.1 Supabase migrations expected

```sql
-- New table: variant_knowledge (KB)
CREATE TABLE variant_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_key TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('editorial_curation', 'specialist_agent', 'external_verified')),
  source_ref TEXT NOT NULL,
  source_capture_date DATE NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  verification_method TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  tags TEXT[] DEFAULT '{}',
  supersedes UUID REFERENCES variant_knowledge(id),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_variant_knowledge_variant_key ON variant_knowledge(variant_key);
CREATE INDEX idx_variant_knowledge_tags ON variant_knowledge USING GIN(tags);

-- Extend listing_reports with hash + tier + version
ALTER TABLE listing_reports
  ADD COLUMN IF NOT EXISTS report_hash TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('tier_1', 'tier_2', 'tier_3')),
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
CREATE INDEX idx_listing_reports_hash ON listing_reports(report_hash);

-- Supabase Storage bucket
-- Name: exports
-- Structure: /{report_hash}/report.pdf, /{report_hash}/report.xlsx
```

### 13.2 Environment variables expected

- `GEMINI_API_KEY` (already set per prior handoff)
- `GEMINI_MODEL=gemini-2.5-flash` (already set)
- `SUPABASE_STORAGE_EXPORTS_BUCKET=exports` (new)

### 13.3 Optional BE work (non-blocking for front-end)

- Reference pack table + editorial admin UI (could be a simple admin panel or just direct SQL inserts)
- Specialist agent scaffolding (post-v2 per variant)

---

## 14. Success Criteria

Front-end v2 is shippable when:

1. Mobile-first online report renders cleanly for Tier 1 / Tier 2 / Tier 3 (mocked tier for testing)
2. All 14 blocks defined in §5 are implemented as composable components
3. PDF export is server-side, produces a hash-verifiable 4–6 page document with no whitespace gaps
4. Excel export is server-side, interactive with live formulas in 4 branded sheets
5. Public `/verify/{hash}` route resolves correctly
6. Every data point in the online report has an inline source badge where critical, clickable to reveal evidence
7. Restraint applied: top-N visible per block, rest collapsed; no wall-of-numbers anywhere
8. All copy references Monza Haus disclaimers and methodology per Legal Checklist
9. Existing v1 tests pass; new components have unit + integration tests
10. Lighthouse mobile score ≥ 90 for the report page

---

## 15. Next Steps

1. User (Edgar) reviews this spec
2. On approval: invoke `superpowers:writing-plans` skill to produce concrete implementation plan with:
   - Sequenced tasks (component-by-component)
   - Test coverage per task
   - Commit checkpoints
   - Workflow for branch `reporte` creation + front-only changes + BE handoff doc
3. Editorial reference pack work begins in parallel (Edgar/team), ~14 hours total across ~27 variants
