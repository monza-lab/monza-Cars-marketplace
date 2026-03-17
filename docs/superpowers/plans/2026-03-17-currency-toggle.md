# Currency Toggle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a currency dropdown (USD/EUR/GBP/JPY) to the navbar that converts all prices using live exchange rates from frankfurter.app, independent of the region/market filter.

**Architecture:** New API route proxies frankfurter.app with 1h cache. New `CurrencyContext` holds selected currency + rates, persisted in localStorage. New `CurrencyDropdown` component in navbar. All ~40 price-formatting call sites migrated from `formatPriceForRegion()`/`formatCurrency()` to `useCurrency().formatPrice()`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-17-currency-toggle-design.md`

---

### Task 1: API Route — Exchange Rates Proxy

**Files:**
- Create: `src/app/api/exchange-rates/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
// src/app/api/exchange-rates/route.ts
import { NextResponse } from "next/server"

const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY"
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

const FALLBACK_RATES: Record<string, number> = {
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
}

let cachedData: { rates: Record<string, number>; updatedAt: string } | null = null
let cachedAt = 0

export async function GET() {
  const now = Date.now()

  if (cachedData && now - cachedAt < CACHE_TTL) {
    return NextResponse.json(
      { base: "USD", rates: cachedData.rates, updatedAt: cachedData.updatedAt },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    )
  }

  try {
    const res = await fetch(FRANKFURTER_URL, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`Frankfurter API returned ${res.status}`)
    const data = await res.json()

    cachedData = { rates: data.rates, updatedAt: new Date().toISOString() }
    cachedAt = now

    return NextResponse.json(
      { base: "USD", rates: cachedData.rates, updatedAt: cachedData.updatedAt },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    )
  } catch {
    const rates = cachedData?.rates || FALLBACK_RATES
    const updatedAt = cachedData?.updatedAt || new Date().toISOString()

    return NextResponse.json(
      { base: "USD", rates, updatedAt, fallback: true },
      { headers: { "Cache-Control": "public, max-age=300" } }
    )
  }
}
```

- [ ] **Step 2: Verify the route works**

Run: `npm run dev` and test `http://localhost:3000/api/exchange-rates` in browser or curl.
Expected: JSON with `{ base: "USD", rates: { EUR: ..., GBP: ..., JPY: ... }, updatedAt: "..." }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/exchange-rates/route.ts
git commit -m "feat(currency): add exchange rates API proxy route"
```

---

### Task 2: CurrencyContext Provider

**Files:**
- Create: `src/lib/CurrencyContext.tsx`
- Modify: `src/app/[locale]/layout.tsx` (line 70 — add CurrencyProvider to provider stack)

- [ ] **Step 1: Create CurrencyContext**

```typescript
// src/lib/CurrencyContext.tsx
"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { formatRegionalPrice } from "./regionPricing"

export type Currency = "USD" | "EUR" | "GBP" | "JPY"
type Rates = Record<string, number>

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
}

const FALLBACK_RATES: Rates = { EUR: 0.92, GBP: 0.79, JPY: 149.5 }
const STORAGE_KEY = "monza-currency"

type CurrencyContextType = {
  currency: Currency
  setCurrency: (c: Currency) => void
  rates: Rates
  isLoading: boolean
  convertFromUsd: (amount: number) => number
  formatPrice: (usdAmount: number) => string
  currencySymbol: string
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "USD",
  setCurrency: () => {},
  rates: FALLBACK_RATES,
  isLoading: true,
  convertFromUsd: (a) => a,
  formatPrice: (a) => `$${a}`,
  currencySymbol: "$",
})

function getInitialCurrency(): Currency {
  if (typeof window === "undefined") return "USD"
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && ["USD", "EUR", "GBP", "JPY"].includes(stored)) return stored as Currency
  return "USD"
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD")
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES)
  const [isLoading, setIsLoading] = useState(true)

  // Read from localStorage on mount
  useEffect(() => {
    setCurrencyState(getInitialCurrency())
  }, [])

  // Fetch rates on mount
  useEffect(() => {
    let cancelled = false
    async function fetchRates() {
      try {
        const res = await fetch("/api/exchange-rates")
        if (!res.ok) throw new Error("Failed to fetch rates")
        const data = await res.json()
        if (!cancelled && data.rates) {
          setRates(data.rates)
        }
      } catch {
        // Keep fallback rates
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    fetchRates()
    return () => { cancelled = true }
  }, [])

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, c)
    }
  }, [])

  const convertFromUsd = useCallback(
    (amount: number) => {
      if (currency === "USD") return amount
      return amount * (rates[currency] || 1)
    },
    [currency, rates]
  )

  const currencySymbol = CURRENCY_SYMBOLS[currency]

  const formatPrice = useCallback(
    (usdAmount: number) => {
      const converted = currency === "USD" ? usdAmount : usdAmount * (rates[currency] || 1)
      return formatRegionalPrice(converted, currencySymbol)
    },
    [currency, rates, currencySymbol]
  )

  const value = useMemo(
    () => ({ currency, setCurrency, rates, isLoading, convertFromUsd, formatPrice, currencySymbol }),
    [currency, setCurrency, rates, isLoading, convertFromUsd, formatPrice, currencySymbol]
  )

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}

export { CURRENCY_SYMBOLS }
```

- [ ] **Step 2: Add CurrencyProvider to layout**

In `src/app/[locale]/layout.tsx`, add import and wrap inside `RegionProvider`:

```tsx
// Add import at top:
import { CurrencyProvider } from "@/lib/CurrencyContext";

// Wrap children inside RegionProvider (line ~70):
<RegionProvider>
  <CurrencyProvider>
    <ClientHeader />
    <main>{children}</main>
    <MobileBottomNav />
    <OnboardingModal />
    <AppFooter />
  </CurrencyProvider>
</RegionProvider>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/CurrencyContext.tsx src/app/[locale]/layout.tsx
git commit -m "feat(currency): add CurrencyContext with live rates and localStorage persistence"
```

---

### Task 3: CurrencyDropdown Component

**Files:**
- Create: `src/components/layout/CurrencyDropdown.tsx`
- Modify: `src/components/layout/Header.tsx` (line ~1152 — add dropdown after region pills)

- [ ] **Step 1: Create CurrencyDropdown**

```typescript
// src/components/layout/CurrencyDropdown.tsx
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Check } from "lucide-react"
import { useCurrency, CURRENCY_SYMBOLS, type Currency } from "@/lib/CurrencyContext"

const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "GBP", label: "GBP", symbol: "£" },
  { value: "JPY", label: "JPY", symbol: "¥" },
]

export function CurrencyDropdown() {
  const { currency, setCurrency } = useCurrency()
  const [open, setOpen] = useState(false)
  const currentOption = CURRENCY_OPTIONS.find(o => o.value === currency)!

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground hover:bg-foreground/5 transition-colors border border-transparent hover:border-border"
      >
        <span className="text-primary">{currentOption.symbol}</span>
        <span>{currentOption.label}</span>
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-2 w-32 rounded-xl bg-card border border-border shadow-xl z-50 overflow-hidden"
            >
              {CURRENCY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setCurrency(option.value)
                    setOpen(false)
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-medium transition-colors
                    ${option.value === currency
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-foreground/5"
                    }
                  `}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-center">{option.symbol}</span>
                    <span>{option.label}</span>
                  </span>
                  {option.value === currency && <Check className="size-3.5" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Add CurrencyDropdown to Header**

In `src/components/layout/Header.tsx`:

Add import at top:
```tsx
import { CurrencyDropdown } from "./CurrencyDropdown"
```

After the region pills `</div>` (line ~1152), add:
```tsx
{/* Currency Dropdown */}
<div className="hidden md:flex items-center ml-2">
  <div className="w-px h-3.5 bg-primary/20 mx-1" />
  <CurrencyDropdown />
</div>
```

- [ ] **Step 3: Verify visually**

Run dev server, confirm dropdown appears in navbar next to region pills, opens/closes, persists selection.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/CurrencyDropdown.tsx src/components/layout/Header.tsx
git commit -m "feat(currency): add CurrencyDropdown to navbar"
```

---

### Task 4: Simplify regionPricing.ts

**Files:**
- Modify: `src/lib/regionPricing.ts`
- Modify: `src/lib/RegionContext.tsx`

- [ ] **Step 1: Clean up regionPricing.ts**

Remove: `TO_USD_RATE`, `FROM_USD_RATE`, `REGIONAL_MARKET_PREMIUM`, `REGION_CURRENCY`, `getCurrency()`, `convertFromUsd()`, `toUsd()`, `formatPriceForRegion()`, `getFairValueForRegion()`.

Keep: `formatRegionalPrice()`, `formatUsd()`, `resolveRegion()`, `buildRegionalFairValue()`.

The cleaned file should be:

```typescript
// src/lib/regionPricing.ts
import type { Region, FairValueByRegion } from "./curatedCars"

/** Resolve null/"all" to "US" default */
export function resolveRegion(selected: string | null): Region {
  if (!selected || selected === "all" || selected === "All") return "US"
  return selected as Region
}

const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
})

/** Format a price in any currency with appropriate abbreviations */
export function formatRegionalPrice(value: number, currency: string): string {
  const normalized = Number.isFinite(value) ? value : Number(value)
  const safeValue = Number.isFinite(normalized) ? normalized : 0

  if (currency === "¥") {
    if (safeValue >= 100_000_000) return `¥${(safeValue / 100_000_000).toFixed(1)}億`
    if (safeValue >= 10_000_000) return `¥${(safeValue / 10_000_000).toFixed(1)}千万`
    return `¥${INTEGER_FORMATTER.format(Math.round(safeValue))}`
  }
  const sym = currency
  if (safeValue >= 1_000_000) return `${sym}${(safeValue / 1_000_000).toFixed(1)}M`
  if (safeValue >= 1_000) return `${sym}${(safeValue / 1_000).toFixed(0)}K`
  return `${sym}${INTEGER_FORMATTER.format(Math.round(safeValue))}`
}

/** Format a USD amount as USD string */
export function formatUsd(value: number): string {
  const normalized = Number.isFinite(value) ? value : Number(value)
  const safeValue = Number.isFinite(normalized) ? normalized : 0

  if (safeValue >= 1_000_000) return `$${(safeValue / 1_000_000).toFixed(1)}M`
  if (safeValue >= 1_000) return `$${(safeValue / 1_000).toFixed(0)}K`
  return `$${INTEGER_FORMATTER.format(Math.round(safeValue))}`
}

/** Build FairValueByRegion from a USD price (kept for data compatibility) */
export function buildRegionalFairValue(usdPrice: number): FairValueByRegion {
  if (usdPrice <= 0) {
    return {
      US: { currency: "$", low: 0, high: 0 },
      EU: { currency: "€", low: 0, high: 0 },
      UK: { currency: "£", low: 0, high: 0 },
      JP: { currency: "¥", low: 0, high: 0 },
    }
  }
  const low = usdPrice * 0.8
  const high = usdPrice * 1.2
  // Simple 1:1 for USD, approximate for others (display uses live rates from CurrencyContext)
  return {
    US: { currency: "$", low: Math.round(low), high: Math.round(high) },
    EU: { currency: "€", low: Math.round(low), high: Math.round(high) },
    UK: { currency: "£", low: Math.round(low), high: Math.round(high) },
    JP: { currency: "¥", low: Math.round(low), high: Math.round(high) },
  }
}
```

- [ ] **Step 2: Simplify RegionContext.tsx**

Remove `currency` from context and `REGION_CURRENCY` import:

```typescript
// src/lib/RegionContext.tsx
"use client"

import { createContext, useContext, useState, useMemo, type ReactNode } from "react"
import { resolveRegion } from "./regionPricing"
import type { Region } from "./curatedCars"

type RegionContextType = {
  selectedRegion: string | null
  setSelectedRegion: (region: string | null) => void
  effectiveRegion: Region
}

const RegionContext = createContext<RegionContextType>({
  selectedRegion: null,
  setSelectedRegion: () => {},
  effectiveRegion: "US",
})

export function RegionProvider({ children }: { children: ReactNode }) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const effectiveRegion = useMemo(() => resolveRegion(selectedRegion), [selectedRegion])

  return (
    <RegionContext.Provider value={{ selectedRegion, setSelectedRegion, effectiveRegion }}>
      {children}
    </RegionContext.Provider>
  )
}

export function useRegion() {
  return useContext(RegionContext)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/regionPricing.ts src/lib/RegionContext.tsx
git commit -m "refactor(currency): remove hardcoded rates and premiums from regionPricing"
```

---

### Task 5: Migrate Consumer Files — Dashboard Components

**Files to modify (replace `formatPriceForRegion` with `formatPrice` from `useCurrency()`):**
- `src/components/dashboard/DashboardClient.tsx`
- `src/components/dashboard/cards/FamilyCard.tsx`
- `src/components/dashboard/context/FamilyContextPanel.tsx`
- `src/components/dashboard/context/BrandContextPanel.tsx`
- `src/components/dashboard/context/shared/RegionalValuation.tsx`
- `src/components/dashboard/context/shared/RecentSales.tsx`
- `src/components/dashboard/context/shared/OwnershipCost.tsx`
- `src/components/dashboard/sidebar/DiscoverySidebar.tsx`
- `src/components/dashboard/mobile/MobileLiveAuctions.tsx`
- `src/components/dashboard/mobile/MobileBrandRow.tsx`
- `src/components/dashboard/mobile/MobileHeroBrand.tsx`
- `src/components/dashboard/mobile/MobileRegionPills.tsx`

**Pattern for each file:**

- [ ] **Step 1: In each file, replace imports**

Remove:
```tsx
import { formatPriceForRegion } from "@/lib/regionPricing"
```
Add:
```tsx
import { useCurrency } from "@/lib/CurrencyContext"
```

If the file ONLY used `selectedRegion` from `useRegion()` for pricing (not for filtering), also remove the `useRegion` import and call.

- [ ] **Step 2: In each component function, replace usage**

Remove:
```tsx
const { selectedRegion } = useRegion()
// ... later ...
formatPriceForRegion(amount, selectedRegion)
```
Add:
```tsx
const { formatPrice } = useCurrency()
// ... later ...
formatPrice(amount)
```

If the component still uses `selectedRegion` for filtering, keep `useRegion()` but remove only the pricing usage.

- [ ] **Step 3: Handle `RegionalValuation.tsx` specially**

This component shows a 4-region comparison table. Simplify it to show the fair value range in the user's selected currency only (instead of 4 region rows).

- [ ] **Step 4: Handle `RecentSales.tsx` and `OwnershipCost.tsx` specially**

These may use `toUsd()` — replace with direct USD values (prices are already in USD in the data).

- [ ] **Step 5: Verify dev server compiles without errors**

Run: `npm run dev` — check for TypeScript/import errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/
git commit -m "refactor(currency): migrate dashboard components to useCurrency()"
```

---

### Task 6: Migrate Consumer Files — Make Page Components

**Files to modify:**
- `src/app/[locale]/cars/[make]/MakePageClient.tsx`
- `src/components/makePage/CarFeedCard.tsx`
- `src/components/makePage/ModelFeedCard.tsx`
- `src/components/makePage/GenerationFeedCard.tsx`
- `src/components/makePage/CarCard.tsx`
- `src/components/makePage/ModelNavSidebar.tsx`
- `src/components/makePage/context/CarContextPanel.tsx`
- `src/components/makePage/context/GenerationContextPanel.tsx`
- `src/components/makePage/context/ModelContextPanel.tsx`
- `src/components/makePage/mobile/MobileMakeLiveAuctions.tsx`
- `src/components/makePage/mobile/MobileModelContext.tsx`
- `src/components/makePage/mobile/MobileModelRow.tsx`
- `src/components/makePage/mobile/MobileHeroModel.tsx`
- `src/components/makePage/mobile/MakePageRegionPills.tsx`

- [ ] **Step 1: Apply the same pattern as Task 5**

Replace `formatPriceForRegion` → `useCurrency().formatPrice()` in each file.

- [ ] **Step 2: Verify dev server compiles**

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/cars/[make]/ src/components/makePage/
git commit -m "refactor(currency): migrate make page components to useCurrency()"
```

---

### Task 7: Migrate Remaining Files

**Files to modify:**
- `src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx`
- `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`
- `src/components/advisor/AdvisorChat.tsx`
- `src/components/advisor/advisorEngine.ts`
- `src/components/onboarding/OnboardingModal.tsx`
- `src/components/layout/Header.tsx` (remove its local `formatPrice` function and `formatPriceForRegion` usage if any)

- [ ] **Step 1: Apply the same import/usage pattern**

- [ ] **Step 2: For `advisorEngine.ts` (non-component file)**

This is a utility, not a React component, so it can't use hooks. Either:
- Pass `formatPrice` as a parameter from the component that calls it, OR
- Import `formatRegionalPrice` + accept currency/rates as params.

- [ ] **Step 3: Verify dev server compiles**

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/cars/ src/components/advisor/ src/components/onboarding/ src/components/layout/Header.tsx
git commit -m "refactor(currency): migrate remaining files to useCurrency()"
```

---

### Task 8: Migrate Hardcoded `formatCurrency()` Callers

**Files using the hardcoded USD `formatCurrency()` from `src/lib/utils/formatters.ts`:**
- `src/components/auction/AuctionCard.tsx` (local `formatCurrency`)
- Other files importing from `src/lib/utils/formatters.ts`

- [ ] **Step 1: Fix AuctionCard.tsx**

Remove the local `formatCurrency` function (lines 78-81). Add `useCurrency` import and use `formatPrice`:

```tsx
import { useCurrency } from "@/lib/CurrencyContext"

export function AuctionCard({ auction, className }: AuctionCardProps) {
  const { formatPrice } = useCurrency()
  // ... replace formatCurrency(currentBid) with formatPrice(currentBid ?? 0)
```

- [ ] **Step 2: Find and fix other `formatCurrency` callers**

Search for all imports of `formatCurrency` from `@/lib/utils/formatters` and replace with `useCurrency().formatPrice()` where they're in components, or pass `formatPrice` as a param where they're in utilities.

- [ ] **Step 3: Verify dev server compiles**

- [ ] **Step 4: Commit**

```bash
git add src/components/auction/ src/lib/utils/formatters.ts
git commit -m "refactor(currency): migrate hardcoded formatCurrency callers to useCurrency()"
```

---

### Task 9: Remove Dead Code & Final Cleanup

- [ ] **Step 1: Remove unused exports from `regionPricing.ts`**

Verify no file still imports removed functions (`formatPriceForRegion`, `getCurrency`, `convertFromUsd`, `toUsd`, `REGION_CURRENCY`, etc.). If any do, fix them.

- [ ] **Step 2: Clean up `formatters.ts`**

If `formatCurrency` in `formatters.ts` is no longer used anywhere, remove it.

- [ ] **Step 3: Remove `currency` references from `useRegion()` callers**

Search for `.currency` or `currency` destructured from `useRegion()`. These should all be removed or switched to `useCurrency()`.

- [ ] **Step 4: Full build check**

Run: `npm run build` — verify zero TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(currency): remove dead code after currency toggle migration"
```

---

### Task 10: Manual Smoke Test

- [ ] **Step 1: Test currency dropdown**
- Open app, verify dropdown shows `$ USD` by default
- Switch to `€ EUR`, verify all prices change to euros
- Switch to `£ GBP`, then `¥ JPY`, verify formatting (K/M for western, 億/千万 for JPY)

- [ ] **Step 2: Test persistence**
- Select `€ EUR`, refresh page — should still be EUR

- [ ] **Step 3: Test region independence**
- Select region "EU" and currency "USD" — should see EU listings with USD prices
- Select region "US" and currency "EUR" — should see US listings with EUR prices

- [ ] **Step 4: Test fallback**
- Temporarily break the API route URL, reload — should still show prices with fallback rates

- [ ] **Step 5: Test all pages**
- Dashboard, Make page (992), Car detail, Auctions — all prices should respect currency selection
