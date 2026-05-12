# Pistons Wallet Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing 6-tier card-grid pricing page with a wallet-recharge model (3 unnamed top-up presets + 1 visible subscription) and a frictionless mini-buy quick path that replaces the current "out of reports" modal. Front-end only.

**Architecture:** All new logic lives in 4 client components under `src/components/payments/`. The `PRICING_PLANS` registry in `src/lib/payments/plans.ts` gains 3 new top-up entries (`topup_entry`, `topup_active`, `topup_heavy`) and a `visibleInPricing` boolean on the existing `PricingPlan` interface so legacy plans (zuffenhausen, weissach, jerrycan, fuel_cell, boxenstopp) stay in the source of truth but disappear from new UI. `/pricing/page.tsx` is rewritten to compose the new components. `OutOfReportsModal` is renamed to `OutOfPistonsModal` with a new layout. Cero Stripe webhook changes, cero backend changes, cero schema changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, framer-motion, lucide-react, next-intl for i18n (en/es/de/ja), Stripe SDK (client-side checkout link only), Radix UI primitives via shadcn/ui (Dialog).

**Spec:** `docs/superpowers/specs/2026-05-11-pistons-wallet-pricing-design.md`

**Branch:** `otros-cambios-front`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/components/payments/PistonsEconomyTable.tsx` | Reusable 4-row table: chat / marketplace / deep research / report. Two variants: `full` (large, in `/pricing`) and `compact` (in `PistonsWalletModal`). |
| Create | `src/components/payments/TopUpPresets.tsx` | 3 preset buttons (1K / 2.5K / 10K Pistons). Selected state. Custom amount collapsible. Triggers `onSelect(planId)` callback. |
| Create | `src/components/payments/SubRecommendationCard.tsx` | Single card promoting Rennsport. Click → triggers `onSubscribe()`. |
| Create | `src/components/payments/OutOfPistonsModal.tsx` | Mini-buy modal that replaces `OutOfReportsModal`. 1-click top-up Entry + secondary "see plans" link. Embeds `CheckoutModal` when user clicks Buy. |
| Modify | `src/lib/payments/plans.ts` | Add 3 new plan entries. Add `visibleInPricing?: boolean` to `PricingPlan` interface. Mark legacy plans with `visibleInPricing: false`. New helpers `getVisibleTopUps()` and `getVisibleSubs()`. |
| Modify | `src/app/[locale]/pricing/page.tsx` | Rewrite layout: hero → economy table → top-up presets → sub recommendation → anchor narrative → FAQ. Remove `PricingCards` import. |
| Modify | `src/components/advisor/PistonsWalletModal.tsx` | Add `PistonsEconomyTable variant="compact"` between balance and recent debits. Wire `onTopUp` to open the new `OutOfPistonsModal` (or navigate to `/pricing`). |
| Modify | `src/components/payments/CheckoutModal.tsx` | Already routes by `PlanId` via `getPricingPlan(planId)`. Since the 3 new plans share the same interface, NO code changes needed — verify only. |
| Modify | `messages/en.json`, `messages/es.json`, `messages/de.json`, `messages/ja.json` | Add `pricing.*` and `outOfPistons.*` keys (15 new keys × 4 locales). |
| Delete | `src/components/payments/PricingCards.tsx` | Soft-delete after migrating its only consumer (`/pricing/page.tsx`). |
| Delete | `src/components/payments/OutOfReportsModal.tsx` | Replaced by `OutOfPistonsModal.tsx`. |

---

## Task 1: Extend PricingPlan + add 3 new top-ups

**Files:**
- Modify: `src/lib/payments/plans.ts`
- Test: `src/lib/payments/plans.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/payments/plans.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { PRICING_PLANS, getPricingPlan, getVisibleTopUps, getVisibleSubs } from "./plans"

describe("PRICING_PLANS — wallet recharge model", () => {
  it("has 3 new top-up entries with correct Pistons and prices", () => {
    expect(PRICING_PLANS.topup_entry).toMatchObject({
      id: "topup_entry",
      price: 13,
      priceCents: 1300,
      pistons: 1000,
      period: "one-time",
      billingMode: "payment",
      visibleInPricing: true,
    })
    expect(PRICING_PLANS.topup_active).toMatchObject({
      id: "topup_active",
      price: 30,
      priceCents: 3000,
      pistons: 2500,
      visibleInPricing: true,
    })
    expect(PRICING_PLANS.topup_heavy).toMatchObject({
      id: "topup_heavy",
      price: 99,
      priceCents: 9900,
      pistons: 10000,
      visibleInPricing: true,
    })
  })

  it("marks legacy plans as not visible in pricing", () => {
    expect(PRICING_PLANS.jerrycan.visibleInPricing).toBe(false)
    expect(PRICING_PLANS.fuel_cell.visibleInPricing).toBe(false)
    expect(PRICING_PLANS.boxenstopp.visibleInPricing).toBe(false)
    expect(PRICING_PLANS.zuffenhausen.visibleInPricing).toBe(false)
    expect(PRICING_PLANS.weissach.visibleInPricing).toBe(false)
  })

  it("rennsport is the only visible subscription", () => {
    const visibleSubs = getVisibleSubs()
    expect(visibleSubs).toHaveLength(1)
    expect(visibleSubs[0].id).toBe("rennsport")
    expect(PRICING_PLANS.rennsport.visibleInPricing).toBe(true)
  })

  it("getVisibleTopUps returns 3 top-ups in ascending price order", () => {
    const topUps = getVisibleTopUps()
    expect(topUps).toHaveLength(3)
    expect(topUps.map(p => p.id)).toEqual(["topup_entry", "topup_active", "topup_heavy"])
    expect(topUps[0].price).toBeLessThan(topUps[1].price)
    expect(topUps[1].price).toBeLessThan(topUps[2].price)
  })

  it("getPricingPlan returns the correct plan for new IDs", () => {
    expect(getPricingPlan("topup_entry")?.pistons).toBe(1000)
    expect(getPricingPlan("topup_heavy")?.pistons).toBe(10000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/payments/plans.test.ts`
Expected: FAIL — `topup_entry`, `getVisibleTopUps`, `getVisibleSubs`, `visibleInPricing` not found.

- [ ] **Step 3: Modify the PlanKey union and PricingPlan interface**

In `src/lib/payments/plans.ts`, update the `PlanKey` union (top of file) and add `visibleInPricing` to the interface:

```ts
export type PlanKey =
  | "zuffenhausen"
  | "weissach"
  | "rennsport"
  | "jerrycan"
  | "fuel_cell"
  | "boxenstopp"
  | "topup_entry"
  | "topup_active"
  | "topup_heavy"

export type LegacyPlanKey = "single" | "pack" | "monthly"
export type CheckoutPlanKey = PlanKey | LegacyPlanKey
export type PlanId = CheckoutPlanKey

export interface PricingPlan {
  id: PlanKey
  name: string
  price: number
  priceCents: number
  period: "one-time" | "monthly"
  pistons: number
  reports: number | "unlimited"
  perReport: string
  badge?: string
  features: string[]
  cta: string
  billingMode: "payment" | "subscription"
  unlimitedReports: boolean
  stripeProductId: string | null
  tagline: string
  /** Whether this plan is shown in the public /pricing page and
   *  related UI. Legacy plans stay in the registry so historical
   *  customers keep their plans, but they aren't offered to new
   *  customers. Defaults to false when omitted. */
  visibleInPricing?: boolean
}
```

- [ ] **Step 4: Mark every existing plan with visibleInPricing**

In each existing plan entry inside `PRICING_PLANS`, add the field:

- `zuffenhausen`: `visibleInPricing: false,`
- `weissach`: `visibleInPricing: false,`
- `rennsport`: `visibleInPricing: true,`
- `jerrycan`: `visibleInPricing: false,`
- `fuel_cell`: `visibleInPricing: false,`
- `boxenstopp`: `visibleInPricing: false,`

(Place the field right after `tagline` in each entry.)

- [ ] **Step 5: Add the 3 new top-up entries**

Append these inside `PRICING_PLANS` after `boxenstopp` (still inside the object literal):

```ts
  topup_entry: {
    id: "topup_entry",
    name: "1,000 Pistons",
    price: 13,
    priceCents: 1300,
    period: "one-time",
    pistons: 1000,
    reports: 10,
    perReport: "$1.30/report",
    features: [
      "1,000 Pistons",
      "Never expires",
      "Stacks with any plan",
    ],
    cta: "Recargar →",
    billingMode: "payment",
    unlimitedReports: false,
    stripeProductId: process.env.STRIPE_PRODUCT_TOPUP_ENTRY ?? null,
    tagline: "Quick refill",
    visibleInPricing: true,
  },
  topup_active: {
    id: "topup_active",
    name: "2,500 Pistons",
    price: 30,
    priceCents: 3000,
    period: "one-time",
    pistons: 2500,
    reports: 25,
    perReport: "$1.20/report",
    features: [
      "2,500 Pistons",
      "Never expires",
      "Stacks with any plan",
    ],
    cta: "Recargar →",
    billingMode: "payment",
    unlimitedReports: false,
    stripeProductId: process.env.STRIPE_PRODUCT_TOPUP_ACTIVE ?? null,
    tagline: "Active hunter",
    visibleInPricing: true,
  },
  topup_heavy: {
    id: "topup_heavy",
    name: "10,000 Pistons",
    price: 99,
    priceCents: 9900,
    period: "one-time",
    pistons: 10000,
    reports: 100,
    perReport: "$0.99/report",
    badge: "Best value",
    features: [
      "10,000 Pistons",
      "Never expires",
      "Stacks with any plan",
    ],
    cta: "Recargar →",
    billingMode: "payment",
    unlimitedReports: false,
    stripeProductId: process.env.STRIPE_PRODUCT_TOPUP_HEAVY ?? null,
    tagline: "Heavy research",
    visibleInPricing: true,
  },
```

- [ ] **Step 6: Add the two new helper functions**

At the bottom of `src/lib/payments/plans.ts`, add:

```ts
/** Returns top-up (one-time payment) plans that should appear in the
 *  public pricing UI, sorted by ascending price. Used by /pricing and
 *  the OutOfPistonsModal preset list. */
export function getVisibleTopUps(): PricingPlan[] {
  return Object.values(PRICING_PLANS)
    .filter(p => p.visibleInPricing === true && p.billingMode === "payment")
    .sort((a, b) => a.price - b.price)
}

/** Returns subscription plans that should appear in the public
 *  pricing UI, sorted by ascending price. Today returns only Rennsport;
 *  Zuffenhausen and Weissach stay hidden but remain in the registry for
 *  historical customers. */
export function getVisibleSubs(): PricingPlan[] {
  return Object.values(PRICING_PLANS)
    .filter(p => p.visibleInPricing === true && p.billingMode === "subscription")
    .sort((a, b) => a.price - b.price)
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/lib/payments/plans.test.ts`
Expected: PASS (5 tests green).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "plans\." | head -5`
Expected: no errors mentioning `plans.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/payments/plans.ts src/lib/payments/plans.test.ts
git commit -m "feat(plans): add 3 wallet-recharge top-ups + visibleInPricing flag

Adds topup_entry (\$13/1K), topup_active (\$30/2.5K),
topup_heavy (\$99/10K). Tags legacy plans (Zuff, Weissach,
Jerrycan, Fuel Cell, Boxenstopp) with visibleInPricing:false
so they stay in the registry for existing customers but don't
appear in the new UI. New helpers getVisibleTopUps() and
getVisibleSubs() are the source of truth for the redesigned
pricing screen."
```

---

## Task 2: PistonsEconomyTable component

**Files:**
- Create: `src/components/payments/PistonsEconomyTable.tsx`
- Test: `src/components/payments/PistonsEconomyTable.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/payments/PistonsEconomyTable.test.tsx`:

```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import enMessages from "../../../messages/en.json"
import { PistonsEconomyTable } from "./PistonsEconomyTable"

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe("PistonsEconomyTable", () => {
  it("renders all 4 economy rows in full variant", () => {
    renderWithIntl(<PistonsEconomyTable variant="full" />)
    expect(screen.getByText(/1 Piston/)).toBeInTheDocument()
    expect(screen.getByText(/~5 Pistons/)).toBeInTheDocument()
    expect(screen.getByText(/~25 Pistons/)).toBeInTheDocument()
    expect(screen.getByText(/100 Pistons/)).toBeInTheDocument()
  })

  it("renders compact variant with the same 4 rows", () => {
    renderWithIntl(<PistonsEconomyTable variant="compact" />)
    expect(screen.getByText(/1 Piston/)).toBeInTheDocument()
    expect(screen.getByText(/100 Pistons/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/payments/PistonsEconomyTable.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `src/components/payments/PistonsEconomyTable.tsx`:

```tsx
"use client"

import { useTranslations } from "next-intl"
import { MessageCircle, Search, Layers, FileText } from "lucide-react"

interface PistonsEconomyTableProps {
  /**
   * `full` is used inside /pricing — larger type, more breathing room.
   * `compact` is used inside the PistonsWalletModal — denser, single
   * line per row. Both render the same 4 rows so the user sees the
   * same mental model anywhere they look.
   */
  variant: "full" | "compact"
  className?: string
}

interface Row {
  icon: typeof MessageCircle
  labelKey: string
  cost: string
}

const ROWS: Row[] = [
  { icon: MessageCircle, labelKey: "pricing.economyChat",         cost: "1 Piston" },
  { icon: Search,        labelKey: "pricing.economyMarketplace",  cost: "~5 Pistons" },
  { icon: Layers,        labelKey: "pricing.economyDeepResearch", cost: "~25 Pistons" },
  { icon: FileText,      labelKey: "pricing.economyReport",       cost: "100 Pistons" },
]

export function PistonsEconomyTable({ variant, className = "" }: PistonsEconomyTableProps) {
  const t = useTranslations()
  const isFull = variant === "full"

  return (
    <section
      aria-labelledby="pistons-economy-title"
      className={`${className} ${
        isFull
          ? "rounded-2xl border border-border bg-foreground/[0.02] p-5 md:p-6"
          : "rounded-xl border border-border bg-foreground/[0.02] p-3"
      }`}
    >
      <p
        id="pistons-economy-title"
        className={`font-semibold tracking-[0.22em] uppercase text-muted-foreground ${
          isFull ? "text-[11px] mb-4" : "text-[9px] mb-2"
        }`}
      >
        {t("pricing.economyTitle")}
      </p>
      <ul className={isFull ? "space-y-3" : "space-y-1.5"}>
        {ROWS.map((row, i) => {
          const Icon = row.icon
          return (
            <li
              key={i}
              className={`flex items-center justify-between gap-3 ${
                isFull ? "text-[14px]" : "text-[11px]"
              }`}
            >
              <span className="flex items-center gap-2.5 text-foreground/85">
                <Icon
                  className={`${isFull ? "size-4" : "size-3"} text-primary shrink-0`}
                  aria-hidden="true"
                />
                {t(row.labelKey)}
              </span>
              <span
                className={`tabular-nums font-medium text-foreground ${
                  isFull ? "text-[13px]" : "text-[11px]"
                }`}
              >
                {row.cost}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Add the i18n keys for this component**

The test depends on these keys existing in `messages/en.json`. Add them in Task 3 (i18n) which runs immediately after this task — for now the test will pass once Task 3 adds them. Run with Task 3 keys in place to verify.

- [ ] **Step 5: Commit (deferred until after Task 3)**

Do NOT commit yet — the test fails until the i18n keys land. Hold this code as a working tree change and commit alongside Task 3 i18n additions.

---

## Task 3: i18n keys for pricing + outOfPistons

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`
- Modify: `messages/de.json`
- Modify: `messages/ja.json`

- [ ] **Step 1: Read current `pricing` namespace in `messages/en.json`**

Run: `grep -n '"pricing":' messages/en.json | head -2`
Expected: a line number for the `pricing` namespace opening.

- [ ] **Step 2: Add new keys inside `pricing` namespace — EN**

In `messages/en.json`, find the `pricing` namespace and add these keys (preserve existing keys):

```json
    "heroTitle": "Recharge your wallet",
    "heroSubtitle": "Pistons are your currency. Top up once or subscribe. Your research wallet.",
    "economyTitle": "How you spend Pistons",
    "economyChat": "Quick chat with the advisor",
    "economyMarketplace": "Marketplace query",
    "economyDeepResearch": "Deep research",
    "economyReport": "Full investment report",
    "topupSectionTitle": "How many Pistons?",
    "topupSelected": "Selected",
    "topupEquivalence": "≈ {reports} reports · {marketplace} marketplace · {deep} deep research",
    "topupNeverExpire": "never expire",
    "topupCta": "Recargar",
    "topupCustomToggle": "Or enter a custom amount",
    "topupCustomLabel": "Custom amount of Pistons",
    "topupCustomPriceHint": "${price} · never expires",
    "subSectionTitle": "Going to use a lot?",
    "subBadgeMostPopular": "Most popular",
    "subFeatures": "Unlimited research · Watchlist · Alerts",
    "subCancelAnytime": "Cancel anytime",
    "subCta": "Subscribe",
    "anchorNarrative": "A PPI costs $400. A Porsche PPS, $250. Paying $59/mo to know if the deal is worth it is due diligence, not expense.",
```

Add a new top-level namespace `outOfPistons` (sibling to `pricing`, not nested):

```json
  "outOfPistons": {
    "title": "You need {needed} Pistons. You have {have}.",
    "topupTitle": "{pistons} Pistons",
    "topupHint": "${price} · never expires",
    "topupCta": "Buy",
    "tipPrefix": "Tip:",
    "tipBody": "Rennsport gives you unlimited research for $59/mo.",
    "seePlans": "See plans"
  },
```

- [ ] **Step 3: Validate JSON**

Run: `python3 -c "import json; json.load(open('messages/en.json'))"`
Expected: no output (no errors).

- [ ] **Step 4: Add the same keys in `messages/es.json`**

Find the `pricing` namespace and append the new keys with Spanish translations:

```json
    "heroTitle": "Recarga tu wallet",
    "heroSubtitle": "Los Pistons son tu moneda. Recarga una vez o suscríbete. Tu wallet de research.",
    "economyTitle": "Cómo gastas Pistons",
    "economyChat": "Chat rápido con el advisor",
    "economyMarketplace": "Consulta de marketplace",
    "economyDeepResearch": "Deep research",
    "economyReport": "Reporte de inversión completo",
    "topupSectionTitle": "¿Cuántos Pistons?",
    "topupSelected": "Seleccionado",
    "topupEquivalence": "≈ {reports} reportes · {marketplace} marketplace · {deep} deep research",
    "topupNeverExpire": "nunca expiran",
    "topupCta": "Recargar",
    "topupCustomToggle": "O ingresa un monto custom",
    "topupCustomLabel": "Monto custom de Pistons",
    "topupCustomPriceHint": "${price} · nunca expira",
    "subSectionTitle": "¿Vas a usar mucho?",
    "subBadgeMostPopular": "Más popular",
    "subFeatures": "Research ilimitado · Watchlist · Alerts",
    "subCancelAnytime": "Cancela cuando quieras",
    "subCta": "Suscribirme",
    "anchorNarrative": "Una PPI cuesta $400. Un Porsche PPS, $250. Pagar $59/mes para saber si el deal vale la pena es due diligence, no gasto.",
```

And the sibling namespace:

```json
  "outOfPistons": {
    "title": "Necesitas {needed} Pistons. Tienes {have}.",
    "topupTitle": "{pistons} Pistons",
    "topupHint": "${price} · nunca expira",
    "topupCta": "Comprar",
    "tipPrefix": "Tip:",
    "tipBody": "Rennsport te da research ilimitado por $59/mes.",
    "seePlans": "Ver planes"
  },
```

Validate: `python3 -c "import json; json.load(open('messages/es.json'))"`

- [ ] **Step 5: Add the same keys in `messages/de.json`**

```json
    "heroTitle": "Lade dein Wallet auf",
    "heroSubtitle": "Pistons sind deine Währung. Einmal aufladen oder abonnieren. Dein Research-Wallet.",
    "economyTitle": "Wie du Pistons ausgibst",
    "economyChat": "Schneller Chat mit dem Advisor",
    "economyMarketplace": "Marketplace-Suche",
    "economyDeepResearch": "Deep Research",
    "economyReport": "Vollständiger Investment-Bericht",
    "topupSectionTitle": "Wie viele Pistons?",
    "topupSelected": "Ausgewählt",
    "topupEquivalence": "≈ {reports} Berichte · {marketplace} Marketplace · {deep} Deep Research",
    "topupNeverExpire": "verfallen nie",
    "topupCta": "Aufladen",
    "topupCustomToggle": "Oder gib einen individuellen Betrag ein",
    "topupCustomLabel": "Individueller Pistons-Betrag",
    "topupCustomPriceHint": "${price} · verfällt nie",
    "subSectionTitle": "Du nutzt es viel?",
    "subBadgeMostPopular": "Am beliebtesten",
    "subFeatures": "Unbegrenzte Recherche · Watchlist · Alerts",
    "subCancelAnytime": "Jederzeit kündbar",
    "subCta": "Abonnieren",
    "anchorNarrative": "Eine PPI kostet $400. Ein Porsche PPS, $250. $59/Monat zu zahlen, um zu wissen, ob der Deal sich lohnt, ist Due Diligence, kein Kostenfaktor.",
```

Sibling namespace:

```json
  "outOfPistons": {
    "title": "Du brauchst {needed} Pistons. Du hast {have}.",
    "topupTitle": "{pistons} Pistons",
    "topupHint": "${price} · verfällt nie",
    "topupCta": "Kaufen",
    "tipPrefix": "Tipp:",
    "tipBody": "Rennsport gibt dir unbegrenzte Recherche für $59/Monat.",
    "seePlans": "Pläne ansehen"
  },
```

Validate: `python3 -c "import json; json.load(open('messages/de.json'))"`

- [ ] **Step 6: Add the same keys in `messages/ja.json`**

```json
    "heroTitle": "ウォレットをチャージ",
    "heroSubtitle": "Pistonsはあなたの通貨です。一度チャージするか、サブスクリプションへ。あなたのリサーチウォレット。",
    "economyTitle": "Pistonsの使い方",
    "economyChat": "Advisorとのクイックチャット",
    "economyMarketplace": "マーケットプレイス検索",
    "economyDeepResearch": "Deep research",
    "economyReport": "完全な投資レポート",
    "topupSectionTitle": "Pistons何個?",
    "topupSelected": "選択中",
    "topupEquivalence": "≈ レポート{reports}件 · マーケットプレイス{marketplace}件 · Deep research {deep}件",
    "topupNeverExpire": "無期限",
    "topupCta": "チャージ",
    "topupCustomToggle": "またはカスタム金額を入力",
    "topupCustomLabel": "Pistonsのカスタム金額",
    "topupCustomPriceHint": "${price} · 無期限",
    "subSectionTitle": "たくさん使う予定?",
    "subBadgeMostPopular": "人気No.1",
    "subFeatures": "無制限リサーチ · ウォッチリスト · アラート",
    "subCancelAnytime": "いつでもキャンセル可",
    "subCta": "登録",
    "anchorNarrative": "PPIは$400、Porsche PPSは$250。月$59を支払って取引が見合うか知ることはデューデリジェンスであり、出費ではありません。",
```

Sibling namespace:

```json
  "outOfPistons": {
    "title": "{needed} Pistons必要です。残り{have} Pistons。",
    "topupTitle": "{pistons} Pistons",
    "topupHint": "${price} · 無期限",
    "topupCta": "購入",
    "tipPrefix": "ヒント:",
    "tipBody": "Rennsportなら$59/月で無制限リサーチ。",
    "seePlans": "プランを見る"
  },
```

Validate: `python3 -c "import json; json.load(open('messages/ja.json'))"`

- [ ] **Step 7: Run the deferred Task 2 test**

Run: `npx vitest run src/components/payments/PistonsEconomyTable.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit both Task 2 + Task 3**

```bash
git add src/components/payments/PistonsEconomyTable.tsx \
        src/components/payments/PistonsEconomyTable.test.tsx \
        messages/en.json messages/es.json messages/de.json messages/ja.json
git commit -m "feat(pricing): PistonsEconomyTable component + i18n keys

Reusable 4-row table (chat 1 / marketplace ~5 / deep research ~25
/ report 100). Two variants: full (used inside /pricing) and
compact (used inside PistonsWalletModal). All four labels
translated to EN/ES/DE/JA via new pricing.* and outOfPistons.*
namespaces."
```

---

## Task 4: TopUpPresets component

**Files:**
- Create: `src/components/payments/TopUpPresets.tsx`
- Test: `src/components/payments/TopUpPresets.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/payments/TopUpPresets.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import enMessages from "../../../messages/en.json"
import { TopUpPresets } from "./TopUpPresets"
import type { PlanId } from "@/lib/payments/plans"

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe("TopUpPresets", () => {
  it("renders the 3 visible top-ups with correct Pistons and prices", () => {
    renderWithIntl(<TopUpPresets onSelect={vi.fn()} />)
    expect(screen.getByText("1,000")).toBeInTheDocument()
    expect(screen.getByText("2,500")).toBeInTheDocument()
    expect(screen.getByText("10,000")).toBeInTheDocument()
    expect(screen.getByText("$13")).toBeInTheDocument()
    expect(screen.getByText("$30")).toBeInTheDocument()
    expect(screen.getByText("$99")).toBeInTheDocument()
  })

  it("defaults to the first preset selected", () => {
    renderWithIntl(<TopUpPresets onSelect={vi.fn()} />)
    const firstButton = screen.getByRole("button", { name: /1,000 Pistons/i })
    expect(firstButton.getAttribute("aria-pressed")).toBe("true")
  })

  it("invokes onSelect when a preset is clicked", () => {
    const onSelect = vi.fn<(id: PlanId) => void>()
    renderWithIntl(<TopUpPresets onSelect={onSelect} />)
    fireEvent.click(screen.getByRole("button", { name: /10,000 Pistons/i }))
    expect(onSelect).toHaveBeenCalledWith("topup_heavy")
  })

  it("shows the equivalence summary for the selected preset", () => {
    renderWithIntl(<TopUpPresets onSelect={vi.fn()} />)
    // First preset (1,000 Pistons) → 10 reports / 200 marketplace / 40 deep research
    expect(screen.getByText(/10 reports/)).toBeInTheDocument()
    expect(screen.getByText(/200 marketplace/)).toBeInTheDocument()
    expect(screen.getByText(/40 deep research/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/payments/TopUpPresets.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `src/components/payments/TopUpPresets.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { getVisibleTopUps, type PlanId } from "@/lib/payments/plans"

interface TopUpPresetsProps {
  /**
   * Called when the user clicks the primary CTA. The selected plan
   * id is one of the visible top-ups. Parent component is
   * responsible for opening CheckoutModal with this id.
   */
  onSelect: (planId: PlanId) => void
  className?: string
}

// Pistons-cost-per-action — must mirror the Pistons Economy Table.
// If you change one, change the other.
const PISTONS_PER_REPORT = 100
const PISTONS_PER_MARKETPLACE = 5
const PISTONS_PER_DEEP_RESEARCH = 25

function formatPistons(n: number): string {
  return n.toLocaleString("en-US")
}

export function TopUpPresets({ onSelect, className = "" }: TopUpPresetsProps) {
  const t = useTranslations()
  const presets = getVisibleTopUps()
  const [selectedId, setSelectedId] = useState<PlanId>(presets[0]?.id ?? "topup_entry")

  const selected = presets.find(p => p.id === selectedId) ?? presets[0]
  if (!selected) return null

  const reports = Math.floor(selected.pistons / PISTONS_PER_REPORT)
  const marketplace = Math.floor(selected.pistons / PISTONS_PER_MARKETPLACE)
  const deepResearch = Math.floor(selected.pistons / PISTONS_PER_DEEP_RESEARCH)

  return (
    <section className={`space-y-4 ${className}`} aria-labelledby="topup-section-title">
      <h2
        id="topup-section-title"
        className="font-display text-[22px] md:text-[28px] font-medium text-foreground"
      >
        {t("pricing.topupSectionTitle")}
      </h2>

      {/* Preset buttons — 1 col mobile, 3 cols desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {presets.map(preset => {
          const isActive = preset.id === selectedId
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={isActive}
              aria-label={`${formatPistons(preset.pistons)} Pistons for $${preset.price}`}
              onClick={() => setSelectedId(preset.id)}
              className={`rounded-2xl border p-4 md:p-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isActive
                  ? "border-primary/60 bg-primary/[0.06] shadow-md shadow-primary/5"
                  : "border-border bg-foreground/[0.02] hover:border-border/80"
              }`}
            >
              {preset.badge && (
                <span className="inline-block text-[9px] font-semibold tracking-[0.18em] uppercase text-primary/85 mb-2">
                  {preset.badge}
                </span>
              )}
              <p className="font-display text-[28px] md:text-[32px] font-medium text-foreground tabular-nums leading-none">
                {formatPistons(preset.pistons)}
              </p>
              <p className="text-[11px] tracking-wide text-muted-foreground mt-1">
                Pistons
              </p>
              <p className="mt-3 font-display text-[20px] font-medium text-primary tabular-nums">
                ${preset.price}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t("pricing.topupNeverExpire")}
              </p>
            </button>
          )
        })}
      </div>

      {/* Equivalence + CTA */}
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-3">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
          {t("pricing.topupSelected")}
        </p>
        <p className="font-display text-[20px] md:text-[24px] font-medium text-foreground">
          {formatPistons(selected.pistons)} Pistons · ${selected.price}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {t("pricing.topupEquivalence", {
            reports: reports,
            marketplace: marketplace,
            deep: deepResearch,
          })}
        </p>
        <button
          type="button"
          onClick={() => onSelect(selected.id)}
          className="w-full h-11 rounded-full bg-primary text-primary-foreground text-[14px] font-semibold hover:bg-primary/85 active:bg-primary/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
        >
          {t("pricing.topupCta")} →
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/payments/TopUpPresets.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/payments/TopUpPresets.tsx \
        src/components/payments/TopUpPresets.test.tsx
git commit -m "feat(pricing): TopUpPresets component (3 presets + equivalence)

Single-column on mobile (1×3), three-column on desktop (3×1).
Defaults to the first (cheapest) preset selected. Click on any
preset updates the equivalence summary (X reports / Y marketplace
queries / Z deep research). Primary CTA invokes onSelect with the
selected PlanId — parent component is responsible for opening
CheckoutModal."
```

---

## Task 5: SubRecommendationCard component

**Files:**
- Create: `src/components/payments/SubRecommendationCard.tsx`
- Test: `src/components/payments/SubRecommendationCard.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/payments/SubRecommendationCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import enMessages from "../../../messages/en.json"
import { SubRecommendationCard } from "./SubRecommendationCard"

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe("SubRecommendationCard", () => {
  it("renders Rennsport name, price, and badge", () => {
    renderWithIntl(<SubRecommendationCard onSubscribe={vi.fn()} />)
    expect(screen.getByText("Rennsport")).toBeInTheDocument()
    expect(screen.getByText(/\$59/)).toBeInTheDocument()
    expect(screen.getByText(/Most popular/i)).toBeInTheDocument()
  })

  it("invokes onSubscribe when CTA is clicked", () => {
    const onSubscribe = vi.fn()
    renderWithIntl(<SubRecommendationCard onSubscribe={onSubscribe} />)
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }))
    expect(onSubscribe).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/payments/SubRecommendationCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `src/components/payments/SubRecommendationCard.tsx`:

```tsx
"use client"

import { useTranslations } from "next-intl"
import { Sparkles } from "lucide-react"
import { getVisibleSubs } from "@/lib/payments/plans"

interface SubRecommendationCardProps {
  onSubscribe: () => void
  className?: string
}

// We intentionally show only the cheapest visible sub. Today that's
// Rennsport; if Edgar later flips Weissach back on, the math still
// surfaces the right card (cheapest first) — but the badge/copy
// assumes Rennsport's value prop (unlimited research + bundle), so
// flipping more subs visible will need a follow-up.
export function SubRecommendationCard({ onSubscribe, className = "" }: SubRecommendationCardProps) {
  const t = useTranslations()
  const subs = getVisibleSubs()
  const sub = subs[0]
  if (!sub) return null

  return (
    <section className={`space-y-4 ${className}`} aria-labelledby="sub-section-title">
      <h2
        id="sub-section-title"
        className="font-display text-[20px] md:text-[24px] font-medium text-foreground"
      >
        {t("pricing.subSectionTitle")}
      </h2>

      <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/[0.06] to-transparent p-5 md:p-6 shadow-lg shadow-primary/5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <p className="font-display text-[22px] md:text-[26px] font-medium text-foreground">
                {sub.name}
              </p>
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.18em] uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                <Sparkles className="size-2.5" aria-hidden="true" />
                {t("pricing.subBadgeMostPopular")}
              </span>
            </div>
            <p className="font-display text-[28px] md:text-[32px] font-medium text-primary tabular-nums leading-none">
              ${sub.price}
              <span className="text-[14px] text-muted-foreground ml-1">/mo</span>
            </p>
            <p className="text-[13px] text-foreground/85 mt-3">
              {t("pricing.subFeatures")}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("pricing.subCancelAnytime")}
            </p>
          </div>
          <button
            type="button"
            onClick={onSubscribe}
            className="shrink-0 h-11 px-6 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/85 active:bg-primary/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
          >
            {t("pricing.subCta")} →
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/payments/SubRecommendationCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/payments/SubRecommendationCard.tsx \
        src/components/payments/SubRecommendationCard.test.tsx
git commit -m "feat(pricing): SubRecommendationCard for Rennsport upsell

Single card below the top-up presets. Reads from getVisibleSubs()
so when Edgar flips more subs visible later, the cheapest still
surfaces. Click → onSubscribe callback; parent opens CheckoutModal."
```

---

## Task 6: Rewrite /pricing page

**Files:**
- Modify: `src/app/[locale]/pricing/page.tsx` (full rewrite — single source of truth changes substantially)

- [ ] **Step 1: Read existing file to capture the parts we keep**

Run: `cat src/app/[locale]/pricing/page.tsx | head -80`
Expected: see existing imports, `REPORT_FEATURES` (kept), `FAQ_ITEMS` (kept), Auth hook usage (kept), CheckoutModal usage (kept).

- [ ] **Step 2: Replace the file contents**

Replace `src/app/[locale]/pricing/page.tsx` with:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { CheckoutModal } from "@/components/payments/CheckoutModal"
import { PistonsEconomyTable } from "@/components/payments/PistonsEconomyTable"
import { TopUpPresets } from "@/components/payments/TopUpPresets"
import { SubRecommendationCard } from "@/components/payments/SubRecommendationCard"
import { useAuth } from "@/lib/auth/AuthProvider"
import type { PlanId } from "@/lib/payments/plans"
import { ChevronDown } from "lucide-react"
import { track } from "@/lib/analytics/events"

// FAQ stays — content is independent from the pricing model.
// Re-translated to the new wallet vocabulary where helpful.
const FAQ_ITEMS = [
  {
    q: "Do Pistons expire?",
    a: "Top-up Pistons never expire. Subscription Pistons reset each billing cycle; Rennsport keeps research unlimited while active.",
  },
  {
    q: "What can I do with Pistons?",
    a: "Pistons are your in-app currency: chat with the advisor (1 Piston), run marketplace queries (~5), deep research (~25), or generate a full investment report (100).",
  },
  {
    q: "What's the difference between top-up and subscription?",
    a: "Top-ups are one-time purchases that never expire — great if you research occasionally. Rennsport ($59/mo) gives unlimited research plus a bundle of pro features and is the most cost-effective if you use the platform regularly.",
  },
  {
    q: "How does cancellation work?",
    a: "Cancel anytime from your account. You keep access through the end of your billing period, and any top-up Pistons stay in your wallet forever.",
  },
  {
    q: "Can I get a refund?",
    a: "30-day money-back guarantee on first-time subscriptions and top-ups. Email legal@monzalab.com within 30 days of purchase.",
  },
]

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full py-3 flex items-center justify-between text-left gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
        aria-expanded={open}
      >
        <span className="text-[13px] font-medium text-foreground">{q}</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <p className="pb-4 text-[12px] text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export default function PricingPage() {
  const t = useTranslations("pricing")
  const { profile } = useAuth()
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)

  useEffect(() => {
    track({ event: "pricing_page_viewed", payload: { source: "direct" } })
  }, [])

  const handleSelectTopUp = (planId: PlanId) => {
    track({ event: "plan_clicked", payload: { planId } })
    setCheckoutPlan(planId)
  }

  const handleSubscribe = () => {
    track({ event: "plan_clicked", payload: { planId: "rennsport" } })
    setCheckoutPlan("rennsport")
  }

  const balance = profile?.pistonsBalance ?? profile?.creditsBalance ?? 0

  return (
    <div className="min-h-screen bg-background pt-[var(--app-header-h,3.5rem)] md:pt-24 pb-32 md:pb-16">
      {/* Hero */}
      <section className="px-4 pt-6 md:pt-4 pb-8 md:pb-12 text-center max-w-2xl mx-auto">
        <p className="text-[11px] font-medium tracking-wide text-primary/80">
          {t("heroEyebrow")}
        </p>
        <h1 className="mt-3 font-display text-[28px] md:text-[40px] leading-tight font-medium text-foreground">
          {t("heroTitle")}
        </h1>
        <p className="mt-3 text-[13px] md:text-[15px] text-muted-foreground leading-relaxed">
          {t("heroSubtitle")}
        </p>
      </section>

      {/* Pistons Economy Table */}
      <section className="px-4 max-w-2xl mx-auto mb-10 md:mb-12">
        <PistonsEconomyTable variant="full" />
      </section>

      {/* Top-up presets */}
      <section className="px-4 max-w-3xl mx-auto mb-10 md:mb-14">
        <TopUpPresets onSelect={handleSelectTopUp} />
      </section>

      {/* Balance pill (auth users only) */}
      {profile && (
        <section className="px-4 mb-10 md:mb-12 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/[0.04] border border-border">
            <span className="text-[11px] text-muted-foreground">
              {t("currentBalance")}
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-foreground">
              {balance.toLocaleString()} {t("pistonsLabel")}
            </span>
          </div>
        </section>
      )}

      {/* Subscription recommendation */}
      <section className="px-4 max-w-3xl mx-auto mb-12 md:mb-16">
        <SubRecommendationCard onSubscribe={handleSubscribe} />
      </section>

      {/* Anchor narrative — italic, small, muted */}
      <section className="px-4 max-w-xl mx-auto mb-12 md:mb-16 text-center">
        <p className="text-[11px] md:text-[12px] text-muted-foreground/80 italic leading-relaxed">
          {t("anchorNarrative")}
        </p>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-4 mb-10">
        <h2 className="font-display text-[20px] md:text-[24px] font-medium text-foreground text-center mb-4 md:mb-6">
          {t("faqTitle")}
        </h2>
        <div className="rounded-2xl border border-border bg-foreground/[0.02] px-5">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={item.q} q={item.q} a={item.a} defaultOpen={i === 0} />
          ))}
        </div>
      </section>

      {/* Checkout Modal */}
      <CheckoutModal
        open={checkoutPlan !== null}
        onOpenChange={(open) => !open && setCheckoutPlan(null)}
        planId={checkoutPlan}
        onSwitchPlan={(newPlan) => setCheckoutPlan(newPlan)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "pricing/page" | head -5`
Expected: no errors.

- [ ] **Step 4: Smoke test the page renders**

Start dev server in background if not already running:

```bash
npm run dev > /tmp/dev.log 2>&1 &
sleep 8
```

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/pricing`
Expected: `200`

- [ ] **Step 5: Visual check via browser**

Open `http://localhost:3000/en/pricing` in the dev browser tab. Confirm visible:
- Hero "Recharge your wallet"
- Pistons Economy Table (4 rows)
- Top-up presets: 1,000 ($13) selected by default, 2,500 ($30), 10,000 ($99)
- "Selected: 1,000 Pistons · $13" + equivalence line
- "Recargar →" button
- Rennsport sub card with "Most popular" badge
- Anchor narrative
- FAQ collapsed (first item open)

If any block is missing or visually broken, fix before committing.

- [ ] **Step 6: Test in `/es/pricing` to confirm Spanish renders**

Open `http://localhost:3000/es/pricing`. Confirm "Recarga tu wallet", "¿Cuántos Pistons?", etc.

- [ ] **Step 7: Commit**

```bash
git add src/app/[locale]/pricing/page.tsx
git commit -m "feat(pricing): rewrite /pricing as wallet-recharge

Hero → Pistons Economy Table → 3 top-up presets → sub
recommendation → anchor narrative → FAQ. No more card-grid
tier comparison. PricingCards is no longer imported here;
soft-delete happens in a follow-up task."
```

---

## Task 7: OutOfPistonsModal (rename + rewrite)

**Files:**
- Create: `src/components/payments/OutOfPistonsModal.tsx`
- Delete: `src/components/payments/OutOfReportsModal.tsx`
- Test: `src/components/payments/OutOfPistonsModal.test.tsx` (create)

- [ ] **Step 1: Audit current imports of OutOfReportsModal**

Run: `grep -rn "OutOfReportsModal" src/ --include="*.tsx" --include="*.ts" 2>/dev/null`
Expected: list of files importing or referencing this component. Save the list — every import needs to be updated to `OutOfPistonsModal`.

- [ ] **Step 2: Write the failing test**

Create `src/components/payments/OutOfPistonsModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import enMessages from "../../../messages/en.json"
import { OutOfPistonsModal } from "./OutOfPistonsModal"

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe("OutOfPistonsModal", () => {
  it("renders nothing when open is false", () => {
    renderWithIntl(
      <OutOfPistonsModal
        open={false}
        onOpenChange={vi.fn()}
        neededPistons={100}
        currentBalance={47}
      />
    )
    expect(screen.queryByText(/You need/i)).not.toBeInTheDocument()
  })

  it("renders needed and have amounts when open", () => {
    renderWithIntl(
      <OutOfPistonsModal
        open={true}
        onOpenChange={vi.fn()}
        neededPistons={100}
        currentBalance={47}
      />
    )
    expect(screen.getByText(/You need 100 Pistons/i)).toBeInTheDocument()
    expect(screen.getByText(/You have 47/i)).toBeInTheDocument()
  })

  it("shows the topup_entry preset (1,000 Pistons / $13) as the primary CTA", () => {
    renderWithIntl(
      <OutOfPistonsModal
        open={true}
        onOpenChange={vi.fn()}
        neededPistons={100}
        currentBalance={47}
      />
    )
    expect(screen.getByText(/1,000 Pistons/)).toBeInTheDocument()
    expect(screen.getByText(/\$13/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/payments/OutOfPistonsModal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Create the component**

Create `src/components/payments/OutOfPistonsModal.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Piston } from "@/components/icons/Piston"
import { CheckoutModal } from "./CheckoutModal"
import { Link } from "@/i18n/navigation"
import { PRICING_PLANS, type PlanId } from "@/lib/payments/plans"

interface OutOfPistonsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** How many Pistons the action requires (e.g. 100 for a report). */
  neededPistons: number
  /** Current Pistons balance of the user. */
  currentBalance: number
}

function formatPistons(n: number): string {
  return n.toLocaleString("en-US")
}

export function OutOfPistonsModal({
  open,
  onOpenChange,
  neededPistons,
  currentBalance,
}: OutOfPistonsModalProps) {
  const t = useTranslations("outOfPistons")
  // Pre-select the smallest top-up as the "buy now" path.
  const defaultTopUp = PRICING_PLANS.topup_entry
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border text-foreground max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3">
            <div className="inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 mb-3">
              <Piston className="size-5 text-primary" />
            </div>
            <DialogTitle className="text-[17px] font-bold text-foreground leading-snug">
              {t("title", { needed: neededPistons, have: currentBalance })}
            </DialogTitle>
            <DialogDescription className="sr-only">
              You need more Pistons to continue. Quick top-up below or see all plans.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-3">
            <button
              type="button"
              onClick={() => setCheckoutPlan(defaultTopUp.id)}
              className="w-full text-left rounded-2xl border border-primary/40 bg-primary/[0.04] p-4 hover:bg-primary/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[18px] font-medium text-foreground">
                    {t("topupTitle", { pistons: formatPistons(defaultTopUp.pistons) })}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t("topupHint", { price: defaultTopUp.price })}
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center justify-center h-9 px-4 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold">
                  {t("topupCta")} →
                </span>
              </div>
            </button>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/80">{t("tipPrefix")}</span>{" "}
              {t("tipBody")}{" "}
              <Link
                href="/pricing"
                onClick={() => onOpenChange(false)}
                className="text-primary underline underline-offset-2"
              >
                {t("seePlans")} →
              </Link>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Checkout — opens inside the same flow so the user
          isn't redirected to /pricing. After payment success the
          dialog auto-closes and the parent re-checks balance. */}
      <CheckoutModal
        open={checkoutPlan !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCheckoutPlan(null)
            onOpenChange(false)
          }
        }}
        planId={checkoutPlan}
        onSwitchPlan={(p) => setCheckoutPlan(p)}
      />
    </>
  )
}
```

- [ ] **Step 5: Update every import that referenced OutOfReportsModal**

For each file from Step 1's `grep` output, replace:

```ts
import { OutOfReportsModal } from "@/components/payments/OutOfReportsModal"
```

with:

```ts
import { OutOfPistonsModal } from "@/components/payments/OutOfPistonsModal"
```

Then replace JSX usage `<OutOfReportsModal ... />` with `<OutOfPistonsModal ... />`. Note: the new component requires `neededPistons` and `currentBalance` props instead of `nextResetDate`. If a caller currently passes only `open` + `onOpenChange`, audit the call site: they probably need to compute `neededPistons` (e.g., from the action being attempted) and `currentBalance` (from `useAuth().profile.pistonsBalance`).

If a caller is unclear how to compute `neededPistons`, default to `100` (one report) which is the most common action. Add a TODO comment so we revisit:

```ts
{/* TODO: compute exact neededPistons from the failed action */}
<OutOfPistonsModal
  open={isOutOfPistons}
  onOpenChange={setIsOutOfPistons}
  neededPistons={100}
  currentBalance={profile?.pistonsBalance ?? 0}
/>
```

- [ ] **Step 6: Delete the old file**

Run: `git rm src/components/payments/OutOfReportsModal.tsx`

- [ ] **Step 7: Run the new test**

Run: `npx vitest run src/components/payments/OutOfPistonsModal.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "test\.|features/scrapers|dashboardCache\.|browse/BrowseClient\.|gemini-stream\.|classic-view|MockAuction" | head -10`
Expected: no errors mentioning `OutOfReportsModal` or `OutOfPistonsModal`.

- [ ] **Step 9: Commit**

```bash
git add -u
git add src/components/payments/OutOfPistonsModal.tsx \
        src/components/payments/OutOfPistonsModal.test.tsx
git commit -m "feat(pricing): rename OutOfReportsModal → OutOfPistonsModal

New mini-buy modal pre-selects the smallest top-up (1,000 Pistons
/ \$13) and embeds CheckoutModal so the user doesn't bounce out
to /pricing. Every consumer of the old component has been updated
to the new prop shape (neededPistons + currentBalance)."
```

---

## Task 8: PistonsWalletModal — add compact economy table

**Files:**
- Modify: `src/components/advisor/PistonsWalletModal.tsx`

- [ ] **Step 1: Read current file structure**

Run: `grep -n "balance\|recentDebits\|TopUp\|onTopUp\|return (" src/components/advisor/PistonsWalletModal.tsx | head -15`
Expected: identify where the balance section ends and where to insert the new compact table (between balance and recent debits).

- [ ] **Step 2: Add the import**

At the top of `src/components/advisor/PistonsWalletModal.tsx`, add:

```ts
import { PistonsEconomyTable } from "@/components/payments/PistonsEconomyTable"
```

- [ ] **Step 3: Insert the compact table in the JSX**

Find the rendered JSX section right after the balance display and before the recent debits. Add:

```tsx
<PistonsEconomyTable variant="compact" className="mt-4" />
```

The exact line depends on the current JSX structure — look for the `<div>` that wraps the balance number and insert the table after that closing `</div>`, before the recent-debits section.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "PistonsWalletModal" | head -5`
Expected: no errors.

- [ ] **Step 5: Smoke test**

Visual: open the dev browser, click the Pistons pill in the header (must be signed in). The wallet modal opens and shows the balance, then the compact economy table (4 short rows), then recent debits.

- [ ] **Step 6: Commit**

```bash
git add src/components/advisor/PistonsWalletModal.tsx
git commit -m "feat(wallet): show compact Pistons economy table in wallet modal

So the user sees their balance + immediate context (\"my 437 Pistons
= ~4 reports\") in the same surface, without going to /pricing."
```

---

## Task 9: Soft-delete PricingCards

**Files:**
- Delete: `src/components/payments/PricingCards.tsx`

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "PricingCards" src/ 2>/dev/null`
Expected: only the file itself (no imports anywhere else). Task 6 removed the only consumer.

- [ ] **Step 2: Delete the file**

Run: `git rm src/components/payments/PricingCards.tsx`

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "PricingCards" | head -5`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(pricing): soft-delete PricingCards (replaced by wallet recharge)

PricingCards rendered the 3-card subscription grid. The /pricing
rewrite (Task 6) uses TopUpPresets + SubRecommendationCard so
PricingCards has no consumer left. Removed cleanly."
```

---

## Task 10: Final verification + push

**Files:** none — verification only.

- [ ] **Step 1: Run the full test suite for payments**

Run: `npx vitest run src/components/payments/ src/lib/payments/ 2>&1 | tail -20`
Expected: all green. If any test fails, fix the failing component and re-run.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "test\.|features/scrapers|dashboardCache\.|browse/BrowseClient\.|gemini-stream\.|classic-view|MockAuction" | head -10`
Expected: no errors specific to this branch's changes.

- [ ] **Step 3: Validate all 4 JSON locale files**

```bash
for loc in en es de ja; do
  python3 -c "import json; json.load(open('messages/$loc.json'))" && echo "$loc OK"
done
```

Expected: 4 OKs.

- [ ] **Step 4: Verify no backend files were touched in this branch**

Run: `git diff main..HEAD --name-only | grep -E "src/app/api/|supabase/migrations|prisma/|src/features/scrapers"`
Expected: no output. (Front-only commitment honored.)

- [ ] **Step 5: Visual smoke test — 4 routes × 2 viewports**

Manual: resize browser to 390×844 and 1280×800. Visit each:
- `/en/pricing`
- `/es/pricing`
- `/de/pricing`
- `/ja/pricing`

Verify on each: hero renders, economy table renders, presets render correctly (1×3 mobile / 3×1 desktop), sub card renders, FAQ collapses, anchor narrative visible.

Trigger the OutOfPistonsModal (use the dev console: from any route, dispatch the modal state to open). Verify the dialog renders, the "1,000 Pistons / $13" primary CTA is visible, and the "See plans" link is present.

- [ ] **Step 6: Push the branch**

```bash
git push -u origin otros-cambios-front 2>&1 | tail -5
```

Expected: branch pushed; GitHub returns a PR URL.

- [ ] **Step 7: Final task close**

Mark this implementation plan complete. Edgar coordinates with backend to create the 3 Stripe products (`STRIPE_PRODUCT_TOPUP_ENTRY`, `STRIPE_PRODUCT_TOPUP_ACTIVE`, `STRIPE_PRODUCT_TOPUP_HEAVY`) and add the env vars to Vercel before merging to `main`. Front-end is ready to consume them as soon as they exist.

---

## Self-Review Checklist (done before saving)

**1. Spec coverage** — every section of the spec maps to a task:

| Spec section | Task |
|---|---|
| §2 Mental Model | Task 6 (hero copy) |
| §3 Productos finales | Task 1 (PRICING_PLANS) |
| §4.1 `/pricing` rewrite | Task 6 |
| §4.2 Mini-buy quick path | Task 7 |
| §4.3 PistonsWalletModal | Task 8 |
| §4.4 AccountSheet entry points | No change needed; `goTo("/pricing")` still resolves correctly |
| §5 Componentes a crear / tocar | Tasks 1–9 |
| §6 Stripe flow | Task 1 (env vars), Task 10 (handoff note) |
| §7 i18n keys | Task 3 |
| §8 Mobile-first | Task 6 (grid breakpoints), Task 7 (modal) |
| §9 Out of scope | Honored (no backend, no Stripe products, no auto-renewal email) |
| §10 Success criteria | Task 10 verifies all |

**2. Placeholder scan** — searched for "TBD", "TODO", "fill in", "add appropriate", "similar to". Found one TODO in Task 7 Step 5 for `neededPistons` — intentionally left because individual callers must compute it; the default fallback (100) is explicit.

**3. Type consistency** — `PlanId`, `PricingPlan`, `getVisibleTopUps`, `getVisibleSubs`, `OutOfPistonsModal` props match across all tasks. `PistonsEconomyTable` variant prop is consistently `"full" | "compact"`. `TopUpPresets.onSelect` returns `PlanId`. ✓

---

## Notes for the implementing engineer

- **Tests use Vitest + React Testing Library + NextIntlClientProvider wrapper.** If `import enMessages from "../../../messages/en.json"` fails, the path is from the test file relative to `messages/en.json` — adjust if your test ends up at a different depth.
- **Branch is `otros-cambios-front`** — confirm you are on it before starting (`git branch --show-current`).
- **No `--no-verify` on commits.** If a pre-commit hook fails, fix the underlying issue.
- **Stripe products don't exist yet for the 3 new top-ups.** Until they do, clicking "Recargar" will fail at Stripe. That's expected — Edgar coordinates backend separately.
- **`Piston` icon** is a custom component at `src/components/icons/Piston.tsx`. Already imported across the codebase.
- **Pre-commit hooks (Husky):** none configured at the time of this plan; if added later, respect them.
