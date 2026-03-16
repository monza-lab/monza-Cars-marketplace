# DashboardClient Refactoring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the ~2,600-line `DashboardClient.tsx` into focused modules following the existing `makePage/` pattern, eliminating dead code and deduplicating shared context panel sections.

**Architecture:** Bottom-up extraction — types and utils first, then shared UI sections, then full components, finally the orchestrator. Each step leaves the project in a compilable state. No functional changes — purely structural refactoring.

**Tech Stack:** React 19, TypeScript, Next.js 16 (App Router), next-intl, Tailwind CSS, Framer Motion

---

## File Structure

After refactoring, `src/components/dashboard/` will contain:

```
src/components/dashboard/
├── DashboardClient.tsx           # ~120 lines — orchestrator (only export)
├── types.ts                      # Auction, Brand, PorscheFamily, LiveRegionTotals, RegionalPricing, FairValueByRegion
├── constants.ts                  # platformShort, mockWhyBuy, REGION_FLAGS, REGION_LABEL_KEYS
├── platformMapping.ts            # (untouched)
├── DashboardClient.test.ts       # (untouched)
├── utils/
│   ├── aggregation.ts            # aggregateBrands, aggregateFamilies, getFamilyPrestigeOrder, getFamilyDisplayName
│   ├── valuation.ts              # computeMedian, auctionCurrency, computeRegionalValFromAuctions, formatRegionalVal, formatUsdEquiv, RegionalValuation type
│   └── timeLeft.ts               # timeLeft helper
├── cards/
│   ├── SafeImage.tsx             # Image with fallback chain
│   └── FamilyCard.tsx            # Column B full-screen scroll card
├── sidebar/
│   └── DiscoverySidebar.tsx      # Column A — brands list + families drill-down + live bids
├── context/
│   ├── FamilyContextPanel.tsx    # Column C — family view orchestrator
│   ├── BrandContextPanel.tsx     # Column C — brand view orchestrator
│   └── shared/
│       ├── RegionalValuation.tsx  # Valuation by market with bar chart
│       ├── OwnershipCost.tsx      # Annual ownership cost breakdown
│       ├── MarketDepth.tsx        # Liquidity, sell-through, demand score
│       └── RecentSales.tsx        # Recent comparable sales list
└── mobile/
    ├── MobileRegionPills.tsx      # Sticky region selector
    ├── MobileHeroBrand.tsx        # Hero card for first brand
    ├── MobileBrandRow.tsx         # Compact brand row
    └── MobileLiveAuctions.tsx     # Live auction feed section
```

**Dead code to delete** (not moved):
- `BrandCard` (L411-538) — replaced by FamilyCard
- `BrandNavigationPanel` (L939-1042) — replaced by DiscoverySidebar
- `AssetCard` (L1355-1522) — unused in render
- `ContextPanel` (L1524-1724) — replaced by FamilyContextPanel/BrandContextPanel

---

## Chunk 1: Types, Constants, and Utils

### Task 1: Extract shared types to `types.ts`

**Files:**
- Create: `src/components/dashboard/types.ts`
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `types.ts` with all type definitions**

Extract from DashboardClient.tsx lines 40-126:

```typescript
// src/components/dashboard/types.ts

export type RegionalPricing = {
  currency: "$" | "€" | "£" | "¥"
  low: number
  high: number
}

export type FairValueByRegion = {
  US: RegionalPricing
  EU: RegionalPricing
  UK: RegionalPricing
  JP: RegionalPricing
}

export type Brand = {
  name: string
  slug: string
  carCount: number
  priceMin: number
  priceMax: number
  avgTrend: string
  topGrade: string
  representativeImage: string
  representativeCar: string
  categories: string[]
}

export type Auction = {
  id: string
  title: string
  make: string
  model: string
  year: number
  trim: string | null
  currentBid: number
  bidCount: number
  viewCount: number
  watchCount: number
  status: string
  endTime: string
  platform: string
  engine: string | null
  transmission: string | null
  exteriorColor: string | null
  mileage: number | null
  mileageUnit: string | null
  location: string | null
  region?: string | null
  description: string | null
  images: string[]
  analysis: {
    bidTargetLow: number | null
    bidTargetHigh: number | null
    confidence: string | null
    investmentGrade: string | null
    appreciationPotential: string | null
    keyStrengths: string[]
    redFlags: string[]
  } | null
  priceHistory: { price: number; timestamp: string }[]
  fairValueByRegion?: FairValueByRegion
  category?: string
  originalCurrency?: string | null
}

export type PorscheFamily = {
  name: string
  slug: string
  carCount: number
  priceMin: number
  priceMax: number
  yearMin: number
  yearMax: number
  representativeImage: string
  fallbackImage: string
  representativeCar: string
  topGrade: string
}

export type LiveRegionTotals = {
  all: number
  US: number
  UK: number
  EU: number
  JP: number
}
```

- [ ] **Step 2: Replace type definitions in DashboardClient.tsx with import**

Remove the type blocks (lines 40-126) and add at the top of DashboardClient.tsx:

```typescript
import type { Brand, Auction, PorscheFamily, LiveRegionTotals } from "./types"
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx next build --no-lint 2>&1 | head -30` or `npm run dev` and check for errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/types.ts src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): extract shared types to types.ts"
```

---

### Task 2: Extract constants to `constants.ts`

**Files:**
- Create: `src/components/dashboard/constants.ts`
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `constants.ts`**

Extract `platformShort` (L127-138), `mockWhyBuy` (L142-162), `REGION_FLAGS` (L216), `REGION_LABEL_KEYS` (L218-223):

```typescript
// src/components/dashboard/constants.ts

export const platformShort: Record<string, string> = {
  BRING_A_TRAILER: "BaT",
  RM_SOTHEBYS: "RM",
  GOODING: "G&C",
  BONHAMS: "BON",
  CARS_AND_BIDS: "C&B",
  COLLECTING_CARS: "CC",
  AUTO_SCOUT_24: "AS24",
  AUTO_TRADER: "AT",
  BE_FORWARD: "BF",
  CLASSIC_COM: "Cls",
}

export const mockWhyBuy: Record<string, string> = {
  McLaren: "The McLaren F1 represents the pinnacle of analog supercar engineering. Extreme scarcity with only 64 road cars ensures lasting collector interest and consistent auction presence.",
  Porsche: "The 911 Carrera RS 2.7 is the foundation of Porsche's motorsport legacy. As the first homologation special, it carries historical significance that transcends typical collector car metrics. Strong club support and cross-generational appeal make this a cornerstone holding.",
  Ferrari: "Ferrari's timeless design combined with the legendary Colombo V12 creates an investment-grade asset. Classiche certification ensures authenticity. This model has demonstrated remarkable price stability even during market corrections.",
  Lamborghini: "Lamborghini's first true supercar remains the most desirable variant. Polo Storico certification adds provenance value. The mid-engine layout influenced every supercar that followed, cementing its historical importance.",
  Nissan: "The R34 GT-R represents the peak of Japanese engineering excellence. With 25-year import eligibility now active in the US, demand continues to grow as 25-year import eligibility expands the collector base. Low production numbers and strong enthusiast community support lasting value.",
  Toyota: "The A80 Supra has achieved icon status, bolstered by pop culture prominence and bulletproof 2JZ reliability. Clean, stock examples are increasingly rare as many were modified. Turbo 6-speed variants command significant premiums.",
  BMW: "The E30 M3 is widely regarded as the quintessential driver's car. Motorsport heritage and timeless design ensure lasting desirability. Sport Evolution and lightweight variants show strongest collector demand.",
  Mercedes: "Mercedes-Benz classics combine engineering excellence with timeless elegance. Strong parts availability and active restoration community support long-term ownership. Coupe and Cabriolet variants show strongest appreciation.",
  "Aston Martin": "The quintessential British grand tourer. James Bond association ensures global recognition. Strong club support and active restoration community. DB-series cars show consistent appreciation and strong auction presence.",
  Jaguar: "British elegance meets Le Mans-winning pedigree. The XJ220 was underappreciated for decades but collector interest is growing as the market recognizes its engineering significance.",
  Mazda: "The RX-7 FD represents the pinnacle of rotary engine development. Spirit R editions are especially collectible. As the final true rotary sports car, scarcity supports strong collector value.",
  Honda: "Honda's engineering excellence shines in the S2000. The F20C/F22C engines are legendary for their 9,000 RPM redline. CR variants command significant premiums for their track-focused specification.",
  Shelby: "Carroll Shelby's Cobra is the ultimate American sports car legend. 427 examples represent the pinnacle of analog performance. CSX-documented cars command top dollar at auction.",
  Chevrolet: "The C2 Corvette Stingray is America's sports car at its most beautiful. Big block variants with manual transmissions are the collector's choice. Strong club support ensures lasting value.",
  Bugatti: "The EB110 represents Bugatti's modern renaissance. Quad-turbo V12, carbon chassis, and AWD were revolutionary for 1991. With only 139 built, scarcity drives strong appreciation.",
  Lancia: "The Stratos is the most successful rally car ever, dominating World Rally Championship from 1974-1976. Ferrari Dino V6 power and Bertone design ensure eternal collector appeal.",
  "De Tomaso": "Italian design meets American V8 power. The Mangusta's Giugiaro styling and rare production numbers make it an undervalued blue chip. Recognition is growing among serious collectors.",
  Alpine: "The A110 is France's answer to the Porsche 911. Lightweight, agile, and proven in competition. The 1600S is the ultimate road specification. Values rising as recognition spreads globally.",
  default: "This vehicle represents a compelling opportunity in the collector car market. Strong fundamentals, limited production, and growing collector interest suggest strong collector market presence.",
}

export const REGION_FLAGS: Record<string, string> = { US: "\u{1F1FA}\u{1F1F8}", UK: "\u{1F1EC}\u{1F1E7}", EU: "\u{1F1EA}\u{1F1FA}", JP: "\u{1F1EF}\u{1F1F5}" }

export const REGION_LABEL_KEYS = {
  US: "brandContext.regionUS",
  UK: "brandContext.regionUK",
  EU: "brandContext.regionEU",
  JP: "brandContext.regionJP",
} as const
```

- [ ] **Step 2: Replace constants in DashboardClient.tsx with import**

Remove the constant blocks and add:

```typescript
import { platformShort, mockWhyBuy, REGION_FLAGS, REGION_LABEL_KEYS } from "./constants"
```

- [ ] **Step 3: Verify the app compiles**

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/constants.ts src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): extract constants to constants.ts"
```

---

### Task 3: Extract valuation utils to `utils/valuation.ts`

**Files:**
- Create: `src/components/dashboard/utils/valuation.ts`
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `utils/valuation.ts`**

Extract `computeMedian` (L167-172), `auctionCurrency` (L174-182), `computeRegionalValFromAuctions` (L184-214), `formatRegionalVal` (L225-233), `formatUsdEquiv` (L235-241), and the `RegionalValuation` type (L165):

```typescript
// src/components/dashboard/utils/valuation.ts
import { REGION_CURRENCY } from "@/lib/regionPricing"
import { toUsd } from "@/lib/regionPricing"
import type { Auction } from "../types"

export type RegionalValuation = { symbol: string; usdCurrent: number }

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function auctionCurrency(a: Auction, regionFallback: string): string {
  const oc = a.originalCurrency?.toUpperCase()
  if (oc === "USD") return "$"
  if (oc === "GBP") return "£"
  if (oc === "EUR") return "€"
  if (oc === "JPY") return "¥"
  return regionFallback
}

export function computeRegionalValFromAuctions(
  auctionList: Auction[],
): Record<string, RegionalValuation> {
  const regions = ["US", "UK", "EU", "JP"] as const
  const symbolMap: Record<string, string> = { US: "$", UK: "£", EU: "€", JP: "¥" }
  const result: Record<string, RegionalValuation> = {}

  for (const region of regions) {
    const regionCurrency = REGION_CURRENCY[region] || "$"
    const regionAuctions = auctionList.filter(a => a.region === region)

    const soldPricesUsd = regionAuctions
      .filter(a => a.currentBid > 0 && a.status === "ENDED")
      .map(a => toUsd(a.currentBid, auctionCurrency(a, regionCurrency)))
    const activeBidsUsd = regionAuctions
      .filter(a => a.currentBid > 0 && (a.status === "ACTIVE" || a.status === "ENDING_SOON"))
      .map(a => toUsd(a.currentBid, auctionCurrency(a, regionCurrency)))

    const medianUsd = soldPricesUsd.length > 0
      ? computeMedian(soldPricesUsd)
      : computeMedian(activeBidsUsd)

    result[region] = {
      symbol: symbolMap[region],
      usdCurrent: medianUsd / 1_000_000,
    }
  }
  return result
}

export function formatRegionalVal(v: number, symbol: string) {
  if (symbol === "¥") return `¥${Math.round(v)}M`
  if (v >= 1) {
    const s = v.toFixed(1)
    return s.endsWith(".0") ? `${symbol}${v.toFixed(0)}M` : `${symbol}${s}M`
  }
  const k = Math.round(v * 1000)
  return `${symbol}${k.toLocaleString()}K`
}

export function formatUsdEquiv(v: number) {
  if (v >= 1) {
    const s = v.toFixed(1)
    return s.endsWith(".0") ? `$${v.toFixed(0)}M` : `$${s}M`
  }
  return `$${Math.round(v * 1000).toLocaleString()}K`
}
```

- [ ] **Step 2: Replace in DashboardClient.tsx with import**

Remove the function blocks and add:

```typescript
import { computeRegionalValFromAuctions, formatRegionalVal, formatUsdEquiv } from "./utils/valuation"
import type { RegionalValuation } from "./utils/valuation"
```

- [ ] **Step 3: Verify the app compiles**

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/utils/valuation.ts src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): extract valuation utils"
```

---

### Task 4: Extract aggregation utils to `utils/aggregation.ts`

**Files:**
- Create: `src/components/dashboard/utils/aggregation.ts`
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `utils/aggregation.ts`**

Extract `aggregateBrands` (L243-300), `getFamilyPrestigeOrder` (L303-306), `getFamilyDisplayName` (L308-311), `aggregateFamilies` (L313-365):

```typescript
// src/components/dashboard/utils/aggregation.ts
import { getBrandImage, getModelImage } from "@/lib/modelImages"
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig"
import type { Auction, Brand, PorscheFamily } from "../types"

export function aggregateBrands(auctions: Auction[], dbTotalOverride?: number): Brand[] {
  const brandMap = new Map<string, Auction[]>()

  auctions
    .filter(a => a.status === "ACTIVE" || a.status === "ENDING_SOON")
    .forEach(auction => {
      const existing = brandMap.get(auction.make) || []
      existing.push(auction)
      brandMap.set(auction.make, existing)
    })

  const brands: Brand[] = []
  brandMap.forEach((cars, name) => {
    const prices = cars.map(c => c.currentBid)
    const grades = cars.map(c => c.analysis?.investmentGrade || "B+")
    const categories = [...new Set(cars.map(c => c.category).filter(Boolean))]

    const gradeOrder = ["AAA", "AA", "A", "B+", "B", "C"]
    const topGrade = grades.sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b))[0]

    const mostExpensiveCar = cars.reduce((max, car) =>
      car.currentBid > max.currentBid ? car : max
    , cars[0])

    const carImage = mostExpensiveCar.images?.[0]
    const verifiedBrandImage = getBrandImage(name)
    const representativeImage = carImage || verifiedBrandImage || "/cars/placeholder.svg"

    const count = (dbTotalOverride && brandMap.size === 1) ? dbTotalOverride : cars.length

    brands.push({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      carCount: count,
      priceMin: Math.min(...prices),
      priceMax: Math.max(...prices),
      avgTrend: topGrade === "AAA" ? "Premium Demand" : topGrade === "AA" ? "Strong Demand" : topGrade === "A" ? "High Demand" : "Growing Demand",
      topGrade,
      representativeImage,
      representativeCar: `${mostExpensiveCar.year} ${mostExpensiveCar.make} ${mostExpensiveCar.model}`,
      categories: categories as string[],
    })
  })

  return brands.sort((a, b) => {
    if (a.name === "Ferrari" && b.name !== "Ferrari") return -1
    if (b.name === "Ferrari" && a.name !== "Ferrari") return 1
    return b.priceMax - a.priceMax
  })
}

function getFamilyPrestigeOrder(familyKey: string): number {
  const config = getSeriesConfig(familyKey.toLowerCase(), "Porsche")
  return config?.order ?? 99
}

function getFamilyDisplayName(familyKey: string): string {
  const config = getSeriesConfig(familyKey.toLowerCase(), "Porsche")
  return config?.label || familyKey
}

export function aggregateFamilies(auctions: Auction[], dbSeriesCounts?: Record<string, number>): PorscheFamily[] {
  const familyMap = new Map<string, Auction[]>()

  auctions
    .filter(a => a.status === "ACTIVE" || a.status === "ENDING_SOON")
    .forEach(auction => {
      const family = extractSeries(auction.model, auction.year, auction.make || "Porsche", auction.title)
      if (!getSeriesConfig(family, auction.make || "Porsche")) return
      const existing = familyMap.get(family) || []
      existing.push(auction)
      familyMap.set(family, existing)
    })

  const families: PorscheFamily[] = []
  familyMap.forEach((cars, familyKey) => {
    const prices = cars.map(c => c.currentBid).filter(p => p > 0)
    const years = cars.map(c => c.year)
    const grades = cars.map(c => c.analysis?.investmentGrade || "B+")
    const gradeOrder = ["AAA", "AA", "A", "B+", "B", "C"]
    const topGrade = grades.sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b))[0]

    const bestCar = cars.reduce((max, car) => car.currentBid > max.currentBid ? car : max, cars[0])
    const carImage = bestCar.images?.[0]
    const modelImage = getModelImage("Porsche", bestCar.model)
    const staticFallback = getModelImage("Porsche", familyKey) || getBrandImage("Porsche") || ""

    const carCount = dbSeriesCounts?.[familyKey] ?? cars.length

    families.push({
      name: getFamilyDisplayName(familyKey),
      slug: familyKey.toLowerCase(),
      carCount,
      priceMin: prices.length > 0 ? Math.min(...prices) : 0,
      priceMax: prices.length > 0 ? Math.max(...prices) : 0,
      yearMin: Math.min(...years),
      yearMax: Math.max(...years),
      representativeImage: carImage || modelImage || staticFallback,
      fallbackImage: staticFallback,
      representativeCar: `${bestCar.year} Porsche ${bestCar.model}`,
      topGrade,
    })
  })

  return families.sort((a, b) => {
    const orderA = getFamilyPrestigeOrder(a.slug)
    const orderB = getFamilyPrestigeOrder(b.slug)
    if (orderA !== orderB) return orderA - orderB
    return b.carCount - a.carCount
  })
}
```

- [ ] **Step 2: Replace in DashboardClient.tsx with import**

```typescript
import { aggregateBrands, aggregateFamilies } from "./utils/aggregation"
```

- [ ] **Step 3: Verify the app compiles**

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/utils/aggregation.ts src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): extract aggregation utils"
```

---

### Task 5: Extract `timeLeft` to `utils/timeLeft.ts`

**Files:**
- Create: `src/components/dashboard/utils/timeLeft.ts`
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `utils/timeLeft.ts`**

```typescript
// src/components/dashboard/utils/timeLeft.ts

export type TimeLabels = {
  ended: string
  day: string
  hour: string
  minute: string
}

export function timeLeft(endTime: string, labels: TimeLabels) {
  const diff = new Date(endTime).getTime() - Date.now()
  if (diff <= 0) return labels.ended
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}${labels.day} ${hrs}${labels.hour}`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hrs}${labels.hour} ${mins}${labels.minute}`
}
```

- [ ] **Step 2: Replace in DashboardClient.tsx with import**

```typescript
import { timeLeft } from "./utils/timeLeft"
import type { TimeLabels } from "./utils/timeLeft"
```

- [ ] **Step 3: Verify the app compiles**

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/utils/timeLeft.ts src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): extract timeLeft util"
```

---

## Chunk 2: Shared Context Sections

### Task 6: Create `context/shared/RegionalValuation.tsx`

**Files:**
- Create: `src/components/dashboard/context/shared/RegionalValuation.tsx`

This component unifies the "Valuation by Market" section used identically in both FamilyContextPanel and BrandContextPanel.

- [ ] **Step 1: Create the shared component**

```tsx
// src/components/dashboard/context/shared/RegionalValuation.tsx
"use client"

import { Globe } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { convertFromUsd, REGION_CURRENCY } from "@/lib/regionPricing"
import { REGION_FLAGS, REGION_LABEL_KEYS } from "../../constants"
import { formatRegionalVal, formatUsdEquiv } from "../../utils/valuation"
import type { RegionalValuation as RegionalValuationType } from "../../utils/valuation"

export function RegionalValuationSection({
  regionalVal,
}: {
  regionalVal: Record<string, RegionalValuationType>
}) {
  const t = useTranslations("dashboard")
  const { effectiveRegion } = useRegion()

  return (
    <div className="px-5 py-4 border-b border-border">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-primary" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            {t("brandContext.valuationByMarket")}
          </span>
        </div>
        <p className="text-[8px] text-muted-foreground mt-1 ml-6">Fair Value by Market</p>
      </div>
      <div className="space-y-1">
        {(["US", "UK", "EU", "JP"] as const).map((region) => {
          const val = regionalVal[region]
          if (!val || val.usdCurrent <= 0) return null
          const userCurrency = REGION_CURRENCY[effectiveRegion] || "$"
          const localCurrent = convertFromUsd(val.usdCurrent * 1_000_000, userCurrency) / 1_000_000
          const maxUsdCurrent = Math.max(...Object.values(regionalVal).map(v => v.usdCurrent))
          const barWidth = maxUsdCurrent > 0 ? (val.usdCurrent / maxUsdCurrent) * 100 : 0
          const isSelected = region === effectiveRegion
          return (
            <div key={region} className={`rounded-xl py-2.5 px-3 transition-all ${isSelected ? "bg-primary/6 border border-primary/10" : "border border-transparent"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px]">{REGION_FLAGS[region]}</span>
                <span className={`text-[11px] font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{t(REGION_LABEL_KEYS[region])}</span>
                {isSelected && (
                  <span className="text-[7px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full tracking-wider uppercase">
                    {t("brandContext.yourMarket")}
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className={`text-[13px] font-mono font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                  {formatRegionalVal(localCurrent, userCurrency)}
                </span>
              </div>
              <div className="h-[4px] rounded-full bg-foreground/4 overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all ${isSelected ? "bg-gradient-to-r from-primary/50 to-primary/80" : "bg-gradient-to-r from-primary/20 to-primary/45"}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="flex justify-end">
                <span className="text-[8px] font-mono text-muted-foreground">
                  {formatUsdEquiv(val.usdCurrent)} USD
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/context/shared/RegionalValuation.tsx
git commit -m "refactor(dashboard): create shared RegionalValuation section"
```

---

### Task 7: Create `context/shared/OwnershipCost.tsx`

**Files:**
- Create: `src/components/dashboard/context/shared/OwnershipCost.tsx`

Unifies the ownership cost section from FamilyContextPanel and BrandContextPanel.

- [ ] **Step 1: Create the shared component**

```tsx
// src/components/dashboard/context/shared/OwnershipCost.tsx
"use client"

import { Wrench } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"

export function OwnershipCostSection({
  ownershipCost,
}: {
  ownershipCost: { insurance: number; storage: number; maintenance: number }
}) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  const totalAnnualCost = ownershipCost.insurance + ownershipCost.storage + ownershipCost.maintenance

  return (
    <div className="px-5 py-4 border-b border-border">
      <div className="flex items-center gap-2 mb-3">
        <Wrench className="size-4 text-primary" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {t("brandContext.annualOwnership")}
        </span>
      </div>
      <div className="space-y-2">
        {[
          { label: t("brandContext.insurance"), value: ownershipCost.insurance },
          { label: t("brandContext.storage"), value: ownershipCost.storage },
          { label: t("brandContext.maintenance"), value: ownershipCost.maintenance },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{item.label}</span>
            <span className="text-[11px] font-mono text-muted-foreground">{formatPriceForRegion(item.value, selectedRegion)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
          <span className="text-[11px] font-medium text-foreground">{t("brandContext.total")}</span>
          <span className="text-[12px] font-display font-medium text-primary">{formatPriceForRegion(totalAnnualCost, selectedRegion)}{t("brandContext.perYear")}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/context/shared/OwnershipCost.tsx
git commit -m "refactor(dashboard): create shared OwnershipCost section"
```

---

### Task 8: Create `context/shared/MarketDepth.tsx`

**Files:**
- Create: `src/components/dashboard/context/shared/MarketDepth.tsx`

Unifies the liquidity & market depth section from both context panels.

- [ ] **Step 1: Create the shared component**

```tsx
// src/components/dashboard/context/shared/MarketDepth.tsx
"use client"

import { Gauge } from "lucide-react"
import { useTranslations } from "next-intl"

export type MarketDepthData = {
  auctionsPerYear: number
  avgDaysToSell: number
  sellThroughRate: number
  demandScore: number
}

export function MarketDepthSection({ depth }: { depth: MarketDepthData }) {
  const t = useTranslations("dashboard")

  return (
    <div className="px-5 py-4 border-b border-border bg-primary/3">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="size-4 text-primary" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {t("brandContext.liquidityDepth")}
        </span>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{t("brandContext.auctionsPerYear")}</span>
          <span className="text-[12px] font-mono font-semibold text-foreground">{depth.auctionsPerYear}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{t("brandContext.avgDaysToSell")}</span>
          <span className="text-[12px] font-mono font-semibold text-foreground">{depth.avgDaysToSell}d</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{t("brandContext.sellThroughRate")}</span>
          <span className="text-[12px] font-mono font-semibold text-positive">{depth.sellThroughRate}%</span>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground">{t("brandContext.demandScore")}</span>
            <span className="text-[12px] font-display font-medium text-primary">{depth.demandScore}/10</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`h-[6px] flex-1 rounded-sm ${
                  i < depth.demandScore ? "bg-primary/50" : "bg-foreground/4"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/context/shared/MarketDepth.tsx
git commit -m "refactor(dashboard): create shared MarketDepth section"
```

---

### Task 9: Create `context/shared/RecentSales.tsx`

**Files:**
- Create: `src/components/dashboard/context/shared/RecentSales.tsx`

- [ ] **Step 1: Create the shared component**

```tsx
// src/components/dashboard/context/shared/RecentSales.tsx
"use client"

import { DollarSign } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"

export type SaleEntry = {
  title: string
  price: number
  platform: string
  date: string
}

export function RecentSalesSection({ sales }: { sales: SaleEntry[] }) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  if (sales.length === 0) return null

  return (
    <div className="px-5 py-4 border-b border-border">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="size-4 text-primary" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {t("brandContext.recentSales")}
        </span>
      </div>
      <div className="space-y-2">
        {sales.map((sale, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground truncate">{sale.title}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{sale.platform} · {sale.date}</p>
            </div>
            <span className="text-[12px] font-mono font-semibold text-foreground shrink-0">
              {formatPriceForRegion(sale.price, selectedRegion)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/context/shared/RecentSales.tsx
git commit -m "refactor(dashboard): create shared RecentSales section"
```

---

## Chunk 3: Extract Components

### Task 10: Extract `cards/SafeImage.tsx`

**Files:**
- Create: `src/components/dashboard/cards/SafeImage.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `cards/SafeImage.tsx`**

Extract SafeImage (L381-408) — note this uses `useState` and `Image` from next/image:

```tsx
// src/components/dashboard/cards/SafeImage.tsx
"use client"

import { useState } from "react"
import Image from "next/image"

export function SafeImage({
  src,
  alt,
  fallback,
  fallbackSrc,
  ...props
}: React.ComponentProps<typeof Image> & { fallback: React.ReactNode; fallbackSrc?: string }) {
  const [useFallback, setUseFallback] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const activeSrc = !useFallback ? src : fallbackSrc
  if (!activeSrc || (useFallback && fallbackFailed)) return <>{fallback}</>
  return (
    <Image
      key={String(activeSrc)}
      src={activeSrc}
      alt={alt}
      onError={() => {
        if (!useFallback && fallbackSrc) {
          setUseFallback(true)
        } else {
          setFallbackFailed(true)
        }
      }}
      {...props}
    />
  )
}
```

- [ ] **Step 2: Replace in DashboardClient.tsx with import**

Remove SafeImage function and add:

```typescript
import { SafeImage } from "./cards/SafeImage"
```

- [ ] **Step 3: Verify the app compiles**

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/cards/SafeImage.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): extract SafeImage component"
```

---

### Task 11: Extract `cards/FamilyCard.tsx`

**Files:**
- Create: `src/components/dashboard/cards/FamilyCard.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `cards/FamilyCard.tsx`**

Extract FamilyCard (L541-653). It depends on: SafeImage, types, Link, useTranslations, useRegion, formatPriceForRegion, lucide icons.

```tsx
// src/components/dashboard/cards/FamilyCard.tsx
"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { DollarSign, Calendar, Car, ChevronRight } from "lucide-react"
import { SafeImage } from "./SafeImage"
import type { PorscheFamily } from "../types"

export function FamilyCard({ family, index = 0 }: { family: PorscheFamily; index?: number }) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  const yearLabel = family.yearMin === family.yearMax
    ? `${family.yearMin}`
    : `${family.yearMin}–${family.yearMax}`

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <Link
        href={`/cars/porsche?family=${encodeURIComponent(family.slug)}`}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-card border border-border group cursor-pointer hover:border-primary/20 transition-all duration-300"
      >
        {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          <SafeImage
            src={family.representativeImage}
            alt={family.name}
            fill
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            sizes="50vw"
            priority={index === 0}
            loading={index === 0 ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            unoptimized
            fallbackSrc={family.fallbackImage}
            fallback={
              <div className="absolute inset-0 bg-card flex items-center justify-center">
                <span className="text-muted-foreground text-lg">{family.name}</span>
              </div>
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent dark:from-card pointer-events-none" />
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-foreground">
              {family.carCount} {family.carCount === 1 ? "car" : "cars"}
            </span>
          </div>
          <div className="absolute top-4 left-4">
            <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
              family.topGrade === "AAA"
                ? "bg-emerald-500/30 text-emerald-300"
                : family.topGrade === "AA"
                ? "bg-primary/30 text-primary"
                : "bg-foreground/20 text-white"
            }`}>
              {family.topGrade}
            </span>
          </div>
        </div>

        {/* BOTTOM: FAMILY INFO */}
        <div className="flex-1 w-full bg-card p-6 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-primary mb-1">
              Porsche
            </p>
            <h2 className="text-3xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              {family.name}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              {family.representativeCar}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.priceRange")}</span>
              </div>
              <p className="text-[13px] font-mono text-foreground">
                {formatPriceForRegion(family.priceMin, selectedRegion)}–{formatPriceForRegion(family.priceMax, selectedRegion)}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Years</span>
              </div>
              <p className="text-[13px] font-mono text-foreground">{yearLabel}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.collection")}</span>
              </div>
              <p className="text-[13px] text-foreground">{family.carCount} listings</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-[0.1em] uppercase text-muted-foreground group-hover:text-primary transition-colors">
              Explore {family.name}
            </span>
            <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Replace in DashboardClient.tsx with import**

Remove FamilyCard function and add:

```typescript
import { FamilyCard } from "./cards/FamilyCard"
```

- [ ] **Step 3: Verify the app compiles**

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/cards/FamilyCard.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): extract FamilyCard component"
```

---

### Task 12: Extract mobile components to `mobile/`

**Files:**
- Create: `src/components/dashboard/mobile/MobileRegionPills.tsx`
- Create: `src/components/dashboard/mobile/MobileHeroBrand.tsx`
- Create: `src/components/dashboard/mobile/MobileBrandRow.tsx`
- Create: `src/components/dashboard/mobile/MobileLiveAuctions.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `mobile/MobileRegionPills.tsx`**

Extract MobileRegionPills (L656-689):

```tsx
// src/components/dashboard/mobile/MobileRegionPills.tsx
"use client"

import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"

export function MobileRegionPills() {
  const { selectedRegion, setSelectedRegion } = useRegion()
  const t = useTranslations("dashboard")
  const REGIONS = [
    { id: "all", label: t("sidebar.allRegions"), flag: "\u{1F30D}" },
    { id: "US", label: "US", flag: "\u{1F1FA}\u{1F1F8}" },
    { id: "UK", label: "UK", flag: "\u{1F1EC}\u{1F1E7}" },
    { id: "EU", label: "EU", flag: "\u{1F1EA}\u{1F1FA}" },
    { id: "JP", label: "JP", flag: "\u{1F1EF}\u{1F1F5}" },
  ]
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-1">
        {REGIONS.map((region) => {
          const isActive = (region.id === "all" && !selectedRegion) || selectedRegion === region.id
          return (
            <button
              key={region.id}
              onClick={() => setSelectedRegion(region.id === "all" ? null : region.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                isActive
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-muted-foreground bg-foreground/3 border border-transparent"
              }`}
            >
              <span className="text-[12px]">{region.flag}</span>
              <span>{region.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `mobile/MobileHeroBrand.tsx`**

Extract MobileHeroBrand from DashboardClient.tsx. Copy the full function body verbatim.

**Required imports:**

```tsx
// src/components/dashboard/mobile/MobileHeroBrand.tsx
"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { ChevronRight } from "lucide-react"
import { SafeImage } from "../cards/SafeImage"
import type { Brand } from "../types"

export function MobileHeroBrand({ brand }: { brand: Brand }) {
  // Copy full function body verbatim from DashboardClient.tsx MobileHeroBrand
}
```

- [ ] **Step 3: Create `mobile/MobileBrandRow.tsx`**

Extract MobileBrandRow from DashboardClient.tsx. Copy the full function body verbatim.

**Required imports:**

```tsx
// src/components/dashboard/mobile/MobileBrandRow.tsx
"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { Car, ChevronRight } from "lucide-react"
import { SafeImage } from "../cards/SafeImage"
import type { Brand } from "../types"

export function MobileBrandRow({ brand }: { brand: Brand }) {
  // Copy full function body verbatim from DashboardClient.tsx MobileBrandRow
}
```

- [ ] **Step 4: Create `mobile/MobileLiveAuctions.tsx`**

Extract MobileLiveAuctions from DashboardClient.tsx. Copy the full function body verbatim.

**Required imports:**

```tsx
// src/components/dashboard/mobile/MobileLiveAuctions.tsx
"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { Clock, Car } from "lucide-react"
import { SafeImage } from "../cards/SafeImage"
import { timeLeft } from "../utils/timeLeft"
import type { Auction } from "../types"

export function MobileLiveAuctions({ auctions, totalLiveCount }: { auctions: Auction[]; totalLiveCount: number }) {
  // Copy full function body verbatim from DashboardClient.tsx MobileLiveAuctions
  // Note: uses tAuction = useTranslations("auctionDetail") in addition to t = useTranslations("dashboard")
}
```

- [ ] **Step 5: Replace in DashboardClient.tsx with imports**

Remove all 4 mobile component functions and add:

```typescript
import { MobileRegionPills } from "./mobile/MobileRegionPills"
import { MobileHeroBrand } from "./mobile/MobileHeroBrand"
import { MobileBrandRow } from "./mobile/MobileBrandRow"
import { MobileLiveAuctions } from "./mobile/MobileLiveAuctions"
```

- [ ] **Step 6: Verify the app compiles**

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/mobile/ src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): extract mobile components"
```

---

### Task 13: Extract `sidebar/DiscoverySidebar.tsx`

**Files:**
- Create: `src/components/dashboard/sidebar/DiscoverySidebar.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `sidebar/DiscoverySidebar.tsx`**

Extract DiscoverySidebar (~308 lines) from DashboardClient.tsx. Copy the full function body verbatim.

**Required imports:**

```tsx
// src/components/dashboard/sidebar/DiscoverySidebar.tsx
"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig"
import { Clock, Car, ChevronRight } from "lucide-react"
import { SafeImage } from "../cards/SafeImage"
import { timeLeft } from "../utils/timeLeft"
import { platformShort } from "../constants"
import type { Auction, Brand, LiveRegionTotals } from "../types"

export function DiscoverySidebar({
  auctions,
  brands,
  onSelectBrand,
  onSelectFamily,
  activeBrandSlug,
  activeFamilyName,
  seriesCounts,
  liveRegionTotals,
}: {
  auctions: Auction[]
  brands: Brand[]
  onSelectBrand: (brandSlug: string) => void
  onSelectFamily?: (familyName: string) => void
  activeBrandSlug?: string
  activeFamilyName?: string
  seriesCounts?: Record<string, number>
  liveRegionTotals?: LiveRegionTotals
}) {
  // Copy full function body verbatim from DashboardClient.tsx DiscoverySidebar
  // Internal helpers: gradeColor (local), timeLabels, activeBrandFamilies (useMemo), liveAuctions (useMemo)
}
```

- [ ] **Step 2: Replace in DashboardClient.tsx with import**

```typescript
import { DiscoverySidebar } from "./sidebar/DiscoverySidebar"
```

- [ ] **Step 3: Verify the app compiles**

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/sidebar/DiscoverySidebar.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): extract DiscoverySidebar component"
```

---

### Task 14: Extract context panels using shared sections

**Files:**
- Create: `src/components/dashboard/context/FamilyContextPanel.tsx`
- Create: `src/components/dashboard/context/BrandContextPanel.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `context/FamilyContextPanel.tsx`**

Refactor FamilyContextPanel to use shared sections. The component keeps its unique sections (family overview, key metrics, top variants, other families, CTA) but delegates shared sections to the components created in Tasks 6-9.

**Required imports:**

```tsx
// src/components/dashboard/context/FamilyContextPanel.tsx
"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { extractSeries, getSeriesThesis } from "@/lib/brandConfig"
import { Shield, Car, Award, ChevronRight } from "lucide-react"
import { computeRegionalValFromAuctions } from "../utils/valuation"
import { RegionalValuationSection } from "./shared/RegionalValuation"
import { OwnershipCostSection } from "./shared/OwnershipCost"
import { MarketDepthSection } from "./shared/MarketDepth"
import { RecentSalesSection } from "./shared/RecentSales"
import type { Auction, PorscheFamily } from "../types"
import type { MarketDepthData } from "./shared/MarketDepth"
import type { SaleEntry } from "./shared/RecentSales"
```

Key refactoring changes:
- The `useMemo` hooks for `regionalVal`, `depth`, `ownershipCost`, `recentSales`, `familyAuctions`, `topVariants` remain in this file (they compute the data)
- The JSX for shared sections is replaced with:
  - `<RegionalValuationSection regionalVal={regionalVal} />`
  - `<RecentSalesSection sales={recentSales} />`
  - `<MarketDepthSection depth={depth} />`
  - `<OwnershipCostSection ownershipCost={ownershipCost} />`
- Unique sections remain inline: family overview, key metrics, top variants, other families, CTA
- `gradeColor` helper stays local (used only by top variants)

- [ ] **Step 2: Create `context/BrandContextPanel.tsx`**

Same shared-section approach for BrandContextPanel. Keeps unique: brand overview, price summary, similar brands, CTA.

**Required imports:**

```tsx
// src/components/dashboard/context/BrandContextPanel.tsx
"use client"

import { useMemo } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion } from "@/lib/regionPricing"
import { getBrandConfig } from "@/lib/brandConfig"
import { Shield, Award, ChevronRight } from "lucide-react"
import { computeRegionalValFromAuctions } from "../utils/valuation"
import { mockWhyBuy } from "../constants"
import { RegionalValuationSection } from "./shared/RegionalValuation"
import { OwnershipCostSection } from "./shared/OwnershipCost"
import { MarketDepthSection } from "./shared/MarketDepth"
import { RecentSalesSection } from "./shared/RecentSales"
import type { Auction, Brand } from "../types"
import type { MarketDepthData } from "./shared/MarketDepth"
import type { SaleEntry } from "./shared/RecentSales"
```

Same refactoring pattern — `useMemo` hooks stay, shared JSX sections replaced with shared components.

- [ ] **Step 3: Replace in DashboardClient.tsx with imports**

```typescript
import { FamilyContextPanel } from "./context/FamilyContextPanel"
import { BrandContextPanel } from "./context/BrandContextPanel"
```

- [ ] **Step 4: Verify the app compiles**

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/context/ src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): extract context panels with shared sections"
```

---

## Chunk 4: Delete Dead Code and Finalize

### Task 15: Delete dead components from DashboardClient.tsx

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Remove BrandCard function**

Delete the entire `BrandCard` component (was L411-538). It was replaced by FamilyCard and is not referenced anywhere.

- [ ] **Step 2: Remove BrandNavigationPanel function**

Delete the entire `BrandNavigationPanel` component (was L939-1042). It was replaced by DiscoverySidebar.

- [ ] **Step 3: Remove AssetCard function**

Delete the entire `AssetCard` component (was L1355-1522). It is not used in the render tree.

- [ ] **Step 4: Remove ContextPanel function**

Delete the entire `ContextPanel` component (was L1524-1724). It was replaced by FamilyContextPanel/BrandContextPanel.

- [ ] **Step 5: Clean up unused imports**

After removing dead components, remove any imports that are no longer used. The remaining DashboardClient.tsx should only import what the orchestrator function needs:
- React hooks: `useState, useRef, useEffect, useMemo`
- `useRegion`, `useTranslations`
- `Globe` (only icon used directly in the orchestrator for empty state)
- Types from `./types`
- `aggregateBrands`, `aggregateFamilies` from `./utils/aggregation`
- `filterAuctionsForRegion` from `./platformMapping`
- All extracted components

Remove unused lucide imports, `motion`, `getBrandImage`, `getModelImage`, `extractSeries`, `getSeriesConfig`, `getSeriesThesis`, `getBrandConfig`, and all formatting/pricing imports no longer used directly by the orchestrator.

**Pre-existing dead imports to also remove** (never used even before refactoring):
- Lucide: `Cog`, `Gavel`, `Minus`, `BarChart3`, `Search`, `SlidersHorizontal`, `Flame`, `ChevronDown`
- `@/lib/regionPricing`: `formatUsd`, `resolveRegion`
- `next-intl`: `useLocale`
- `@/lib/regionPricing`: `fmtRegional` alias (only consumer was dead `ContextPanel`)

- [ ] **Step 6: Verify the app compiles**

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "refactor(dashboard): remove dead components (BrandCard, BrandNavigationPanel, AssetCard, ContextPanel)"
```

---

### Task 16: Final verification

- [ ] **Step 1: Verify final line count**

The remaining `DashboardClient.tsx` should be approximately 120-150 lines containing only:
- Imports
- The `DashboardClient` export function with its hooks, scroll logic, and layout JSX

Run: `wc -l src/components/dashboard/DashboardClient.tsx`
Expected: ~120-150 lines

- [ ] **Step 2: Run existing tests**

Run: `npx vitest run src/components/dashboard/DashboardClient.test.ts`
Expected: All tests pass (these test platformMapping.ts which is untouched)

- [ ] **Step 3: Run full dev server smoke test**

Run: `npm run dev` and verify:
1. Homepage loads with Porsche family cards
2. Family scroll works (Column B)
3. Context panel updates when scrolling (Column C)
4. Sidebar navigation works (Column A)
5. Region switching works
6. Mobile layout renders correctly

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "refactor(dashboard): finalize DashboardClient decomposition"
```
