# Hard-Coded Strings Audit

> Generated: 2026-05-07
> Scope: All user-facing pages browsed via Chrome (Dashboard, Car Detail, Report V1, Report V2)
> Status: Strings marked `[HARDCODED]` in source code for key UI files

---

## Legend

- **HC** = Hard-coded in English, not going through `t()` / `useTranslations()`
- **i18n** = Already uses `t()` translation keys
- Strings from `brandConfig.ts` (series names, year ranges) are intentionally NOT flagged — they're data, not UI copy.

---

## 1. Dashboard (`src/components/dashboard/`)

### `DashboardClient.tsx`
| Line | String | Status |
|------|--------|--------|
| 346 | `"Active Market"` | HC |
| 705 | `"car"` / `"cars"` | HC |
| 719 | `"Porsche"` | HC |
| 744 | `"Years"` | HC |
| 754 | `"{count} listings"` | HC |
| 761 | `"Explore {family}"` | HC |
| 1016 | `"POA"` | HC |
| 1039 | `"Listing"` | HC |
| 1425 | `"POA"` | HC |
| 1438-1439 | `"Listing"` | HC |
| 1538 | `"POA"` | HC |
| 1560 | `"High Demand"` | HC |
| 1562 | `"Low Demand"` | HC |
| 1563 | `"Growing Demand"` | HC |
| 1646-1647 | `"Listing"`, `"en-US"` date locale | HC |
| 1795 | `"A compelling Porsche family..."` (fallback thesis) | HC |
| 1875-1876 | `"Listing"`, `"en-US"` date locale | HC |
| 1901 | `"Porsche"` | HC |
| 1941 | `"{count} listings"` | HC |
| 2029 | `"Explore {family} Collection"` | HC |
| 2074-2075 | `"Listing"`, `"en-US"` date locale | HC |
| 2099 | `"Stable"` | HC |

### `cards/FamilyCard.tsx`
| Line | String | Status |
|------|--------|--------|
| 50 | `"car"` / `"cars"` | HC |
| 60 | `"Porsche"` | HC |
| 85 | `"Years"` | HC |
| 95 | `"{count} listings"` | HC |
| 102 | `"Explore {family}"` | HC |

### `context/FamilyContextPanel.tsx`
| Line | String | Status |
|------|--------|--------|
| 20 | `"A compelling Porsche family..."` (fallback) | HC |
| 68-69 | `"Listing"`, `"en-US"` date locale | HC |
| 89 | `"Porsche"` | HC |
| 130 | `"Explore {family} Collection"` | HC |

### `context/BrandContextPanel.tsx`
| Line | String | Status |
|------|--------|--------|
| 52-53 | `"Listing"`, `"en-US"` date locale | HC |
| 123 | `"Median Sold"` | HC |

### `context/shared/RegionalValuation.tsx`
| Line | String | Status |
|------|--------|--------|
| 25-28 | `"High"`, `"Medium"`, `"Low"`, `"No data"` | HC |
| 62 | `"Sold • Asking (adjusted)"` | HC |
| 85 | `"Sold n=... • Asking n=..."` (tooltip) | HC |
| 90 | `"Insufficient data"` | HC |
| 115 | `"{count} listings"` | HC |
| 140-141 | `"Sold:"`, `"Ask:"` | HC |

### `context/shared/ValuationTile.tsx`
| Line | String | Status |
|------|--------|--------|
| 16-21 | `"Market:"`, `"Family:"`, `"Sold sample:"`, `"Asking sample:"`, `"Factor:"` | HC |

### `constants.ts`
| Line | String | Status |
|------|--------|--------|
| 16-35 | All `mockWhyBuy` paragraphs (17 brands) | HC |

---

## 2. Car Detail Page (`src/app/[locale]/cars/[make]/[id]/`)

### `CarDetailClient.tsx`
| Line | String | Status |
|------|--------|--------|
| 320 | `"Market Position"` | HC |
| 323 | `"Fair Value Range ({region})"` | HC |
| 339 | `"Below market average"` | HC |
| 344 | `"Above market average"` | HC |
| 357 | `"Live Auction"` / `"For Sale"` | HC |
| 366 | `"{count} bids"` | HC |
| 376, 404 | `"Ver en {platform}"` (mixed Spanish!) | HC |
| 413 | `"Vehicle"` | HC |
| 440 | `"{count} inspection points"` | HC |
| 452 | `"Similar · {count}"` | HC |
| 511 | `"Investment Analysis"` | HC |
| 538 | `"Trend"` | HC |
| 550 | `"Valuation by Market"` | HC |
| 553 | `"Fair value range by region"` | HC |
| 569 | `"BEST"` | HC |
| 572 | `"YOUR MARKET"` | HC |
| 608-615 | `"Market Position"`, `"Price vs Fair Value"` | HC |
| 635-640 | Market position descriptions (4 variants) | HC |
| 650 | `"Shipping Estimates"` | HC |
| 656-658 | `"Domestic (Enclosed)"`, `"EU Import"`, `"UK Import"` | HC |
| 667 | `"Awaiting backend data"` | HC |
| 676 | `"Events & Community"` | HC |
| 690-760 | Registration gate: `"Sign up to continue"`, `"Continue with Google"`, `"or use email"`, `"Your name"`, `"your@email.com"`, etc. | HC |
| 700 | `"Awaiting backend data"` | HC |
| 716-717 | `"Full Investment Report"`, `"Valuation, risks, comps & costs"` | HC |
| 731 | `"Speak with Advisor"` | HC |
| 958 | `"Report"` | HC |
| 978 | `"{count} photos"` | HC |
| 1003 | `"LIVE"` | HC |
| 1031-1041 | Landed cost tooltip text | HC |
| 1075 | `"Trend"` | HC |
| 1104 | `"Fair Value"` | HC |
| 1133-1137 | `"Full Investment Report"`, `"Valuation · Risks · Comps · Costs"`, `"View"` | HC |
| 1199-1200 | `"BEST"`, `"YOUR MARKET"` | HC |
| 1229-1234 | `"Market Position"`, `"Price vs Fair Value"` | HC |
| 1253-1258 | Fair value position descriptions (4 variants) | HC |
| 1300 | `"{count} items"` | HC |
| 1312, 1334 | `"Awaiting backend analysis"` | HC |
| 1342-1354 | Pre-purchase inspection items + `"Critical"` / `"Recommended"` | HC |
| 1380, 1402, 1433 | `"Awaiting backend data"` | HC |
| 1427 | `"Value +"`, `"Value -"`, `"Neutral"` | HC |
| 1490 | `"LIVE"` | HC |
| 1543-1648 | Mobile accordion: all section titles and content | HC |
| 1792-1842 | Welcome modal: `"Welcome to Monza"`, `"300 Pistons"`, how it works steps | HC |
| 1881-1930 | Analysis sent modal: email confirmation, download buttons | HC |
| 1968-2003 | Paywall modal: upgrade prompts, feature list | HC |

---

## 3. Report V1 — PDF/Excel (`src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`)

### PDF Generation (lines 390–1155)
| Area | Examples | Status |
|------|----------|--------|
| Cover | `"INVESTMENT DOSSIER"`, `"PREPARED EXCLUSIVELY FOR"`, `"CONFIDENTIAL"` | HC |
| Personal Letter | Full English letter body (5 paragraphs) | HC |
| TOC | `"Contents"`, all 9 section names | HC |
| Exec Summary | `"SIGNALS DETECTED"`, `"CURRENT PRICE"`, `"FAIR VALUE"`, etc. | HC |
| Vehicle Identity | `"AUCTION STATUS"`, `"HISTORY & PROVENANCE"`, `"Vehicle Gallery"` | HC |
| Regional Valuation | `"REGIONAL FAIR VALUE COMPARISON"`, `"BEST BUY"`, `"MARKET POSITION"` | HC |
| Performance | `"SIGNAL SYNTHESIS"`, `"PRICE vs FAIR VALUE"`, documentation tiers | HC |
| Risk | `"RISK SCORE"`, `"INVESTMENT STRENGTHS"`, `"RED FLAGS"`, risk context | HC |
| Due Diligence | `"QUESTIONS FOR THE SELLER"`, `"ACTION ITEMS"`, inspection items | HC |
| Market Context | `"MARKET OVERVIEW"`, `"CURRENT MARKET CONDITIONS"`, `"COMPARABLE SALES"` | HC |
| Verdict | `"SIGNALS"`, `"FAIR VALUE"`, `"RISK"`, `"SUMMARY"`, disclaimer | HC |
| Closing | Full closing letter (3 paragraphs), `"WHAT'S NEXT"`, 3 action items | HC |

### Excel Export (lines 1170–1400)
| Area | Examples | Status |
|------|----------|--------|
| Summary sheet | All vehicle, listing, investment, arbitrage, and market data labels | HC |
| Regional sheet | Column headers: `"Region"`, `"Currency"`, `"Fair Low"`, etc. | HC |
| Similar Vehicles | Column headers + statistics labels | HC |
| Comparable Sales | Column headers + statistics labels | HC |
| Regional Data | Column headers | HC |
| Due Diligence | `"RED FLAGS"`, `"SELLER QUESTIONS"` section headers | HC |

### UI Sections (lines 1600–2640)
All section headers, metric labels, status badges, empty states, and inspection items are HC.

---

## 4. Report V2 — UI Blocks (`src/components/report/`)

### `ReportClientV2.tsx`
| Line | String | Status |
|------|--------|--------|
| 65 | `"No Haus Report generated..."` | HC |
| 68 | `"Return to the classic report view..."` | HC |
| 76 | `"Go back"` | HC |
| 251 | Price delta summary template | HC |

### `ReportHeader.tsx`
| String | Status |
|--------|--------|
| `"Tier 1"`, `"Tier 2"`, `"Tier 3"` | HC |
| `"Generated {date} · v{version} · {tier}"` | HC |
| `"Regenerate report"`, `"Download"` | HC |

### `VerdictBlock.tsx`
| String | Status |
|--------|--------|
| `"at fair"`, `"Verdict"`, `"Asking"`, `"Fair Value"`, `"Delta"` | HC |

### `SpecificCarFairValueBlock.tsx`
| String | Status |
|--------|--------|
| `"Specific-Car Fair Value"`, `"Market comparables"` | HC |
| `"See how this was computed"` | HC |

### `MarketIntelPanel.tsx`
| String | Status |
|--------|--------|
| `"Stable"`, `"12m trend"`, `"Confidence"`, `"Captured"`, `"Tap to expand"` | HC |

### `WhatsRemarkableBlock.tsx`
| String | Status |
|--------|--------|
| `"What's Remarkable"`, finding count templates | HC |
| `"Monthly subscribers unlock..."`, `"See sample"`, `"Upgrade"` | HC |

### `ValuationBreakdownBlock.tsx`
| String | Status |
|--------|--------|
| `"How we arrived at {value}"`, `"Baseline median"`, `"Modifiers"` | HC |
| `"Fair Value"`, `"Top modifiers applied"`, `"Source"` | HC |

### `ArbitrageSignalBlock.tsx`
| String | Status |
|--------|--------|
| `"Cross-Border Opportunity"`, landed-cost template | HC |
| `"Landed-cost methodology"`, `"No comparable available"`, `"View listing"` | HC |

### `ComparablesAndPositioningBlock.tsx`
| String | Status |
|--------|--------|
| `"Comparables & Positioning"`, `"Distribution"` | HC |
| Empty states, percentile template, `"Mileage"`, `"Sold"` | HC |

### `QuestionsToAskBlock.tsx`
| String | Status |
|--------|--------|
| `"Questions Before You Commit"` | HC |
| 11 fallback question prompts | HC |
| 10 value-impact explanations | HC |
| `"Not mentioned in listing"`, `"Copied"`, `"Copy all questions"` | HC |

### `SignalsDetectedBlock.tsx`
| String | Status |
|--------|--------|
| `"What we found in this listing"` | HC |
| `"No objective signals were extracted..."` | HC |

### `ColorIntelBlock.tsx`
| String | Status |
|--------|--------|
| `"Color Intelligence"`, `"Exterior"`, `"Interior"` | HC |
| Rarity labels: `"Common"` through `"Unique"` | HC |
| `"Not specified"`, `"Paint-to-Sample"` | HC |

### `VinIntelBlock.tsx`
| String | Status |
|--------|--------|
| `"VIN Intelligence"`, `"Factory"`, `"Body/Generation"` | HC |
| `"Model Year (VIN)"`, VIN mismatch warning | HC |

### `InvestmentStoryBlock.tsx`
| String | Status |
|--------|--------|
| `"Investment Story"`, `"Generated by {agent}"` | HC |

### `MarketContextBlock.tsx`
| String | Status |
|--------|--------|
| `"Market Context"`, `"{count} sold"` | HC |

### `LandedCostBlock.tsx`
| String | Status |
|--------|--------|
| Country names: `"United States"` through `"Netherlands"` | HC |
| `"Landed Cost (Estimate)"`, all cost row labels | HC |
| `"Car price"`, `"Total landed cost"` | HC |

### `DownloadSheet.tsx`
| String | Status |
|--------|--------|
| `"Haus Report"`, `"Download report"`, format descriptions | HC |
| `"Hash"`, `"Verify"`, `"Downloads are included..."` | HC |

### `SeeSampleModal.tsx`
| String | Status |
|--------|--------|
| Sample car title, all sample claims | HC |
| `"Tier 2 sample"`, `"Unlock this depth..."` | HC |

### `MethodologyLink.tsx`
| String | Status |
|--------|--------|
| `"How we compute Fair Value, Modifiers, Market Intel, and Sources"` | HC |

### `ReportMetadataFooter.tsx`
| String | Status |
|--------|--------|
| Report metadata template, `"Verify this report"` | HC |
| Full legal disclaimer | HC |

### `ReportSourcesBlock.tsx`
| String | Status |
|--------|--------|
| `"Sources"`, category labels, `"Captured {date}"` | HC |

### `SourcesBlock.tsx`
| String | Status |
|--------|--------|
| `"Sources & Methodology"`, all cost category headers | HC |
| Methodology disclaimer | HC |

### Other primitives
| File | Strings | Status |
|------|---------|--------|
| `MarketDeltaPill.tsx` | `"at median"` | HC |
| `CollapsibleList.tsx` | `"Show less"` | HC |
| `ConfidenceDot.tsx` | `"{level} confidence"` | HC |

---

## 5. Shared / Layout

### Header (`src/components/Header.tsx` or similar)
| String | Status |
|--------|--------|
| `"MONZA"` | HC (brand, likely intentional) |
| `"Monza"` / `"Classic"` tabs | HC |
| `"USD"`, `"Pistons"` | HC |
| `"Toggle theme"`, `"Menu"` | HC |
| `"Search"` placeholder | HC |
| `"Locked to vehicle market on detail pages"` | HC |

### Footer
| String | Status |
|--------|--------|
| `"© 2025 Monza Lab"` | HC |
| `"Privacy"`, `"Terms"` | HC |

### Mobile nav
| String | Status |
|--------|--------|
| `"Home"`, `"Explore"`, `"Search"`, `"Account"` | HC |

### Paywall banner
| String | Status |
|--------|--------|
| `"Free Reports left this month ·"` | HC |
| `"Go Unlimited — $59/mo →"` | HC |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Dashboard components | ~50 strings |
| Car Detail page | ~100 strings |
| Report V1 (PDF/Excel) | ~200 strings |
| Report V2 (UI blocks) | ~150 strings |
| Shared/Layout | ~15 strings |
| **TOTAL** | **~515 strings** |

## Priority for i18n

1. **P0 (visible to all users)**: Dashboard, Car Detail, Header, Footer, Mobile nav
2. **P1 (visible to report users)**: Report V2 blocks, Report V1 UI sections
3. **P2 (downloads only)**: PDF generation, Excel export (could stay English-only)
4. **P3 (edge cases)**: Registration gate, welcome/paywall modals, tooltips
