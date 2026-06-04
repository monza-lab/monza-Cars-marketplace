# V3 Report Pipeline — Session Summary & Next Steps

> **Date:** 2026-05-12
> **Commit:** `8362861` — `feat(reports): V3 multi-agent pipeline with full-screen generation modal`
> **Files changed:** 32 files, +3,960 lines

---

## What Was Built This Session

### 1. Full Pipeline Infrastructure (backend)

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| V3 Type System | `src/lib/reports/types-v3.ts` | 361 | Complete — all 10 step outputs defined |
| Pipeline Orchestrator | `src/lib/reports/pipeline.ts` | 300 | Complete — 4-tier parallelization, SSE progress |
| Section Persistence | `src/lib/reports/reportSections.ts` | 101 | Complete — CRUD for `report_sections` table |
| Report Assembly | `src/lib/reports/assembleV3Report.ts` | 46 | Complete — reconstructs V3 from DB rows |
| API Endpoint | `src/app/api/analyze/v3/route.ts` | 167 | Complete — SSE streaming, auth, credits, backward compat |

### 2. Ten Agent Implementations

| # | Agent | File | Status | Notes |
|---|-------|------|--------|-------|
| 1 | Listing Scraper | `agents/listingScraper.ts` | Stub (64 lines) | Returns data from DB, no live scrape yet |
| 2 | Vehicle Identifier | `agents/vehicleIdentifier.ts` | Stub (45 lines) | Basic AI prompt, no brand config wiring |
| 3 | Market Data Bundle | `agents/marketDataBundle.ts` | Stub (80 lines) | No DB query wiring |
| 4 | Fair Value Engine | `agents/fairValueEngine.ts` | **Complete** (131 lines) | Wraps existing HausReport computation |
| 5 | Technical Analyst | `agents/technicalAnalyst.ts` | **Complete** (72 lines) | Full Gemini integration with system prompt |
| 6 | Investment Analyst | `agents/investmentAnalyst.ts` | **Complete** (89 lines) | Strategy, ownership costs, resale timeline |
| 7 | Due Diligence | `agents/dueDiligence.ts` | **Complete** (58 lines) | Questions, risk scoring, PPI checklist |
| 8 | Market Researcher | `agents/marketResearcher.ts` | Stub (39 lines) | Expert consensus, owner sentiment placeholders |
| 9 | Buyer Services | `agents/buyerServices.ts` | Stub (46 lines) | Parts, insurance, shipping outlines |
| 10 | Final Synthesis | `agents/finalSynthesis.ts` | **Complete** (80 lines) | Reads all sections, generates executive summary |

**Also created:** `agents/prompts/system.ts` (43 lines) + `agents/prompts/helpers.ts` (78 lines) + `agents/index.ts` (29 lines)

### 3. Nine V3 Section Components (frontend)

| Component | File | Lines | Renders |
|-----------|------|-------|---------|
| Executive Summary | `v3/ExecutiveSummarySection.tsx` | 99 | Headline, key metrics grid, risk meter, verdict badge, investment thesis |
| Technical Analysis | `v3/TechnicalAnalysisSection.tsx` | 192 | Model history, production data, rarity, strengths, common issues, reliability, collector outlook |
| Investment Strategy | `v3/InvestmentStrategySection.tsx` | 110 | Bid/negotiation strategy, leverage points, repair costs, investment narrative |
| Ownership Cost | `v3/OwnershipCostSection.tsx` | 92 | Annual maintenance, fuel, insurance, depreciation breakdown |
| Resale Timeline | `v3/ResaleTimelineSection.tsx` | 129 | 1yr/3yr/5yr projections, market trend, hold recommendation |
| Due Diligence | `v3/DueDiligenceSection.tsx` | 146 | Risk assessment chart, seller questions by category, PPI checklist |
| Market Research | `v3/MarketResearchSection.tsx` | 141 | Expert consensus, owner sentiment, heritage, events, clubs |
| Buyer Services | `v3/BuyerServicesSection.tsx` | 183 | Parts availability table, insurance, transport, original MSRP |
| Data Trust Badge | `DataTrustBadge.tsx` | 42 | Labels: "Verified from Data" / "AI Analysis" / "AI Estimated" |

### 4. Full-Screen Generation Modal (UX)

Built directly into `ReportClient.tsx` (V1 preview page):

- **Trigger:** "Unlock full report" button → `handleUnlock()` → token/pistons check → `handleGenerateV3()`
- **Modal:** Fixed overlay (`z-[100]`, backdrop blur), Framer Motion spring animation
- **10-step progress:** Numbered list with animated status icons (pending dot → spinning → checkmark/error)
- **Progress bar:** Real-time percentage based on completed steps
- **Error handling:** Shows error message with close/retry buttons
- **Completion:** `window.location.reload()` → server re-fetches V3 data → renders ReportClientV2

### 5. Routing & Display Integration

**`page.tsx` server component:**
- Fetches V3 sections from `report_sections` table
- Assembles into `HausReportV3` object
- Routes to `ReportClientV2` if `existingReport` OR `v3Report` exists
- Routes to `ReportClient` (V1 preview) if neither exists

**`ReportClientV2.tsx` client component:**
- **V3-only mode:** When `v3Report` exists but no V2 `existingReport` — renders header + all 8 V3 sections
- **V2+V3 mode:** When both exist — V2 blocks first, then V3 sections below

### 6. Null-Safety Fixes

Fixed runtime crashes across 7 files where AI-generated data had missing nested properties:

- `MarketResearchSection.tsx` — 7 fixes (expertConsensus, ownerSentiment, relevantEvents, ownerClubs)
- `finalSynthesis.ts` — 5 fixes (reliability, productionData, strategy, riskScore, expertConsensus)
- `TechnicalAnalysisSection.tsx` — 3 fixes (keyStrengths, commonIssues, reliability.commonProblems)
- `DueDiligenceSection.tsx` — 4 fixes (questions, riskScore.overall, riskScore.breakdown, ppiChecklist)
- `BuyerServicesSection.tsx` — 2 fixes (commonParts, specialHandling)
- `InvestmentStrategySection.tsx` — 2 fixes (null guard, negotiationLeverage)
- `ExecutiveSummarySection.tsx` — 1 fix (null guard)

---

## Known Issues

### Non-blocking
| Issue | Impact | Notes |
|-------|--------|-------|
| `saveHausReport: invalid input syntax for type uuid: "live-..."` | V2 backward compat fails for live listings | V3 sections save fine; only `listing_reports` row fails. Non-blocking because V3-only mode works. Fix: use separate UUID or skip for live IDs. |
| 6 agent stubs return minimal/placeholder data | Report sections may have sparse content | Steps 1, 2, 3, 8, 9 need full implementation |
| No GenerationStepper component used | Modal is inline in ReportClient, not a reusable component | `GenerationStepper.tsx` (292 lines) exists but the modal was built directly into ReportClient for tighter integration |

---

## Next Steps — Priority Order

### Priority 1: Live Listing Scraping (Step 1 Agent)

**Goal:** When generating a report, scrape the actual listing page to get full description, photos, equipment list, modifications, seller notes — data that isn't in our DB.

**What exists:** `agents/listingScraper.ts` stub that returns data from DB fields.

**What's needed:**
- [ ] Integrate Scrapling/Playwright to fetch listing HTML from source URL
- [ ] Parse listing-specific selectors per source (BaT, Cars & Bids, Elferspot, etc.)
- [ ] Extract: full description, equipment list, modifications, seller notes, photo URLs
- [ ] Handle authentication/blocking (Cloudflare, etc.)
- [ ] Cache scraped data to avoid re-fetching
- [ ] Fallback to DB data if scrape fails

**Files to modify:**
- `src/lib/reports/agents/listingScraper.ts` — main implementation
- Possibly reuse selectors from `src/features/scrapers/` collectors

### Priority 2: Market Data Bundle (Step 3 Agent)

**Goal:** Pull real comparable sales data, market stats, and pricing context from our DB.

**What exists:** `agents/marketDataBundle.ts` stub.

**What's needed:**
- [ ] Wire to `computeMarketStatsForCar()` from pricing pipeline
- [ ] Wire to `getComparablesForModel()` for sold comps
- [ ] Pull active listings for same model/series as comparables
- [ ] Calculate market position (percentile of current price vs market)
- [ ] Include trend data (price direction over 3/6/12 months)

**Files to modify:**
- `src/lib/reports/agents/marketDataBundle.ts`
- May need to import from `src/lib/pricing/` utilities

### Priority 3: Vehicle Identifier (Step 2 Agent)

**Goal:** Use brand config + AI to identify exact vehicle spec, generation, important options.

**What exists:** `agents/vehicleIdentifier.ts` stub with basic AI prompt.

**What's needed:**
- [ ] Integrate `extractSeries()` and `getSeriesConfig()` from `brandConfig.ts`
- [ ] Use AI to parse listing description for trim, options, production codes
- [ ] Cross-reference known option codes (PTS colors, Sport Chrono, PCCB, etc.)
- [ ] Output: confirmed year, make, model, trim, series, notable options

### Priority 4: Market Researcher (Step 8 Agent)

**Goal:** Generate expert consensus analysis, owner sentiment, heritage significance.

**What exists:** `agents/marketResearcher.ts` stub.

**What's needed:**
- [ ] Full Gemini system prompt for enthusiast/expert analysis
- [ ] Owner sentiment generation based on model knowledge
- [ ] Heritage and cultural significance context
- [ ] Relevant events (auctions, shows, milestones)
- [ ] Owner clubs and communities

### Priority 5: Buyer Services (Step 9 Agent)

**Goal:** Provide practical buyer info — parts availability, insurance estimates, transport costs.

**What exists:** `agents/buyerServices.ts` stub.

**What's needed:**
- [ ] Parts availability assessment (OEM vs aftermarket)
- [ ] Insurance estimate ranges by vehicle category
- [ ] Transport cost estimates (enclosed vs open, distance tiers)
- [ ] Original MSRP with inflation adjustment

### Priority 6: UUID Fix for Live Listings

**Goal:** Fix `saveHausReport` to work with live listing IDs (format `live-{source}-{hash}`) so V2+V3 combined view works.

**What's needed:**
- [ ] Either: generate a proper UUID for the `listing_reports` row
- [ ] Or: change `listing_reports.listing_id` column to accept text
- [ ] Or: skip backward compat save entirely for live listings (V3-only is fine)

### Priority 7: Generation UX Polish

**Goal:** Enhance the loading experience during report generation.

**What's in the spec but not built:**
- [ ] Photo slideshow with Ken Burns effect during generation
- [ ] Rotating motivational messages per step
- [ ] Completion celebration animation
- [ ] Transition from modal to full report (instead of page reload)
- [ ] Progress persistence across page refresh (resume interrupted generation)

### Priority 8: PDF/Excel Export

**Goal:** Export V3 report as PDF or Excel for offline sharing.

**From the spec:**
- [ ] react-pdf integration for PDF export
- [ ] ExcelJS for spreadsheet export
- [ ] Include all V3 sections with formatting

---

## Architecture Reference

```
User clicks "Unlock Report"
    │
    ▼
ReportClient.tsx → handleUnlock() → handleGenerateV3()
    │
    ▼ POST /api/analyze/v3 (SSE stream)
    │
    ▼
pipeline.ts orchestrates 10 steps in 4 tiers:
    │
    ├─ Tier 0 (sequential): Step 1 — Listing Scraper
    ├─ Tier 1 (parallel):   Steps 2, 3 — Vehicle ID + Market Data
    ├─ Tier 2 (parallel):   Steps 4–9 — Fair Value, Technical, Investment,
    │                                     Due Diligence, Market Research, Buyer Services
    └─ Tier 3 (sequential): Step 10 — Final Synthesis
    │
    ▼ Each step saves to `report_sections` table
    │
    ▼ window.location.reload()
    │
    ▼
page.tsx → fetches sections → assembleV3Report() → ReportClientV2
    │
    ▼
V3 Section Components render the full report
```

### Key Tables

| Table | Purpose | ID Format |
|-------|---------|-----------|
| `report_sections` | V3 section data (JSONB per step) | `listing_id` (text) |
| `listing_reports` | V2 report data (backward compat) | `listing_id` (UUID only) |
| `listing_signals` | V2 signals (backward compat) | `listing_id` (UUID) |

### Key Files Quick Reference

| Purpose | Path |
|---------|------|
| V3 Types | `src/lib/reports/types-v3.ts` |
| Pipeline | `src/lib/reports/pipeline.ts` |
| Agents | `src/lib/reports/agents/*.ts` |
| Agent Prompts | `src/lib/reports/agents/prompts/*.ts` |
| Section DB | `src/lib/reports/reportSections.ts` |
| Assembly | `src/lib/reports/assembleV3Report.ts` |
| API Endpoint | `src/app/api/analyze/v3/route.ts` |
| V1 Preview | `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` |
| V2/V3 Display | `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx` |
| Server Page | `src/app/[locale]/cars/[make]/[id]/report/page.tsx` |
| V3 Components | `src/components/report/v3/*.tsx` |
| Data Trust Badge | `src/components/report/DataTrustBadge.tsx` |

---

## Completion Status

| Area | Done | Total | % |
|------|------|-------|---|
| Pipeline infrastructure | 5/5 | 5 | 100% |
| Agent implementations | 5/10 | 10 | 50% |
| V3 UI components | 9/9 | 9 | 100% |
| Generation modal | 1/1 | 1 | 100% |
| Routing integration | 1/1 | 1 | 100% |
| Null-safety hardening | 7/7 | 7 | 100% |
| Live scraping per car | 0/1 | 1 | 0% |
| UUID backward compat fix | 0/1 | 1 | 0% |
| UX polish (slideshow, etc.) | 0/5 | 5 | 0% |
| PDF/Excel export | 0/2 | 2 | 0% |
| **Overall** | **28/42** | **42** | **67%** |
