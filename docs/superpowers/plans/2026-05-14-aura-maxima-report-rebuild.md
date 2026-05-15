# Aura Maxima — Report Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the paid Haus Report and free preview behind a single `ReportClient` component, gate piston spend behind a pedagogical confirmation modal, and apply Heritage Lavender branding consistently across desktop and mobile — all frontend-only.

**Architecture:** Delete `ReportClientV2`. Have `ReportClient` (V1) accept a `v3Report` prop and render the existing V3 section components (`src/components/report/v3/*`) inside V1's sidebar-TOC + editorial-hero shell when the user has access. Introduce `ConfirmGenerateModal` to intercept piston-spend CTAs; route to existing `OutOfPistonsModal` when balance is insufficient. `GenerationStepper`, `OutOfPistonsModal`, and the AI pipeline are untouched.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS, Radix UI Dialog, Heritage Lavender token system (`globals.css`), Vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-05-14-aura-maxima-report-rebuild-design.md`

---

## File Structure

**Create:**
- `src/lib/reports/canAffordReport.ts` — pure helper: `canAffordReport(balance: number, cost: number): boolean`
- `src/lib/reports/canAffordReport.test.ts` — Vitest unit test for the helper
- `src/components/report/ConfirmGenerateModal.tsx` — Radix Dialog confirmation modal

**Modify:**
- `src/app/[locale]/cars/[make]/[id]/report/page.tsx:257-279` — collapse V1/V2 branch, always render `ReportClient`, pass `v3Report` prop
- `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx` — accept `v3Report` + `userHasAccess` props; intercept `handleUnlock` with new modal; render V3 section components inside existing layout when `hasAccess && v3Report`
- `tests/e2e/haus-report.spec.ts` — extend with a confirmation-modal scenario

**Delete:**
- `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx`

**Untouched (do not modify under any circumstance):**
- `src/components/report/GenerationStepper.tsx`
- `src/components/payments/OutOfPistonsModal.tsx`
- `src/components/report/HausReportTeaser.tsx`
- `src/components/report/SeeSampleModal.tsx`
- `src/components/report/v3/*` (the 8 V3 section components — only consumed, never edited)
- `src/app/api/**` (entirely off-limits)
- `src/lib/reports/queries.ts`, `src/lib/reports/types.ts`, `src/lib/reports/types-v3.ts` (read-only)

---

## Pre-Flight (read-only — do before any edit)

- [ ] **Step 0: Confirm clean working tree on branch `Aura-Maxima-Front`**

Run:
```bash
git status
git rev-parse --abbrev-ref HEAD
```
Expected: `On branch Aura-Maxima-Front`, no staged/unstaged changes, no untracked files except those you create as part of this plan.

- [ ] **Step 0.1: Confirm dev server still works**

Run:
```bash
curl -sI http://localhost:3000/ | head -1
```
Expected: `HTTP/1.1 200 OK`. If the dev server is not running, start it with `npm run dev > /tmp/aura-dev.log 2>&1 &` and wait until `tail -1 /tmp/aura-dev.log` says `✓ Ready in …`.

---

### Task 1: Add `canAffordReport` helper with TDD

**Files:**
- Create: `src/lib/reports/canAffordReport.ts`
- Create: `src/lib/reports/canAffordReport.test.ts`

- [ ] **Step 1.1: Write the failing test**

Create `src/lib/reports/canAffordReport.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { canAffordReport } from "./canAffordReport"

describe("canAffordReport", () => {
  it("returns true when balance equals cost", () => {
    expect(canAffordReport(100, 100)).toBe(true)
  })

  it("returns true when balance exceeds cost", () => {
    expect(canAffordReport(287, 100)).toBe(true)
  })

  it("returns false when balance is below cost", () => {
    expect(canAffordReport(99, 100)).toBe(false)
  })

  it("returns false when balance is zero", () => {
    expect(canAffordReport(0, 100)).toBe(false)
  })

  it("returns false for negative balances (defensive)", () => {
    expect(canAffordReport(-5, 100)).toBe(false)
  })

  it("returns true when cost is zero (free reports)", () => {
    expect(canAffordReport(0, 0)).toBe(true)
  })
})
```

- [ ] **Step 1.2: Run the failing test**

Run:
```bash
npx vitest run src/lib/reports/canAffordReport.test.ts
```
Expected: fails with "Failed to resolve import 'canAffordReport.ts'" or similar.

- [ ] **Step 1.3: Implement the helper**

Create `src/lib/reports/canAffordReport.ts`:
```ts
export function canAffordReport(balance: number, cost: number): boolean {
  if (cost <= 0) return true
  if (balance < 0) return false
  return balance >= cost
}
```

- [ ] **Step 1.4: Re-run the test to confirm green**

Run:
```bash
npx vitest run src/lib/reports/canAffordReport.test.ts
```
Expected: `6 passed`.

- [ ] **Step 1.5: Commit**

Run:
```bash
git add src/lib/reports/canAffordReport.ts src/lib/reports/canAffordReport.test.ts
git commit -m "$(cat <<'EOF'
feat(reports): add canAffordReport helper with unit tests

Pure helper for the upcoming ConfirmGenerateModal flow. Determines
whether a user's piston balance covers the report cost. Six cases
covered including edge: zero balance, zero cost, negative balance.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
Expected: commit lands on `Aura-Maxima-Front`.

---

### Task 2: Create `ConfirmGenerateModal` component

**Files:**
- Create: `src/components/report/ConfirmGenerateModal.tsx`

- [ ] **Step 2.1: Create the component file**

Create `src/components/report/ConfirmGenerateModal.tsx`:
```tsx
"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X, Check, Coins } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"

interface ConfirmGenerateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  car: CollectorCar
  cost: number
  balance: number
  onConfirm: () => void
}

const INCLUDED_SECTIONS = [
  "Executive summary",
  "Identity & spec",
  "Fair value & comparables",
  "Performance benchmark",
  "Risk score & due diligence",
  "Market context & timing",
  "Similar listings nearby",
  "Final verdict",
  "PDF + Excel downloadables",
]

export function ConfirmGenerateModal({
  open,
  onOpenChange,
  car,
  cost,
  balance,
  onConfirm,
}: ConfirmGenerateModalProps) {
  const balanceAfter = balance - cost

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-2xl border border-border bg-background p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 md:p-7"
        >
          <Dialog.Close
            aria-label="Close"
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </Dialog.Close>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              Haus Report
            </p>
            <Dialog.Title className="mt-2 font-serif text-[26px] leading-tight tracking-tight text-foreground">
              {car.title}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-[13px] text-muted-foreground">
              {car.year} · {car.make} · acquisition analysis
            </Dialog.Description>
          </div>

          <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Includes {INCLUDED_SECTIONS.length} sections
            </p>
            <ul className="mt-3 space-y-1.5">
              {INCLUDED_SECTIONS.map(section => (
                <li
                  key={section}
                  className="flex items-center gap-2 text-[13px] text-foreground"
                >
                  <Check className="size-3.5 shrink-0 text-primary" />
                  <span>{section}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-foreground/[0.02] p-4 font-mono text-[13px] tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cost</span>
              <span className="flex items-center gap-1.5 text-foreground">
                <Coins className="size-3.5 text-primary" />
                {cost} pistons
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Balance</span>
              <span className="text-foreground">
                {balance} → {balanceAfter} pistons
              </span>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-5 py-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-xl bg-primary px-6 py-3 text-[12px] font-semibold uppercase tracking-wider text-background transition-transform hover:bg-primary/85 active:scale-[0.97]"
            >
              Generate report
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2.2: Type-check the new component**

Run:
```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | rg -i "ConfirmGenerateModal|canAffordReport" | head -20
```
Expected: no output (no errors). If errors appear, fix them by reviewing the imports above.

- [ ] **Step 2.3: Commit**

Run:
```bash
git add src/components/report/ConfirmGenerateModal.tsx
git commit -m "$(cat <<'EOF'
feat(report): add ConfirmGenerateModal component

Pedagogical confirmation step before piston spend. Shows car summary,
9 included report sections, cost (100 pistons), and balance preview
(287 → 187). Heritage Lavender styling with Cormorant title, Karla
labels, Geist Mono numbers. Radix Dialog with fade-in + slide-up.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire `ConfirmGenerateModal` into `ReportClient.handleUnlock`

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`

- [ ] **Step 3.1: Read the current handleUnlock implementation**

Run:
```bash
rg -n "handleUnlock|setShowPricing|consumeForAnalysis|hasAnalyzed" src/app/\[locale\]/cars/\[make\]/\[id\]/report/ReportClient.tsx | head -20
```
Expected: shows `handleUnlock` around line 333 and `setShowPricing` around line 344.

- [ ] **Step 3.2: Add imports + new state for the confirmation modal**

In `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`, find the import block (around lines 1-50) and add:
```tsx
import { ConfirmGenerateModal } from "@/components/report/ConfirmGenerateModal"
import { canAffordReport } from "@/lib/reports/canAffordReport"
import { REPORT_PISTON_COST } from "@/lib/reports/queries"
```

In the component body, near the other `useState` calls (around line 201), add:
```tsx
const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false)
```

- [ ] **Step 3.3: Refactor `handleUnlock` to gate through the modal**

Replace the existing `handleUnlock` (around lines 333-346) with this two-stage flow. First, rename the existing function to `executeUnlock` (the actual spend action), then introduce a new `handleUnlock` that opens the confirmation modal when affordable.

Replace:
```tsx
  const handleUnlock = () => {
    if (hasAnalyzed(car.id)) {
      setHasAccess(true)
      if (!existingReport) void handleGenerateV3()
      return
    }
    const success = consumeForAnalysis(car.id)
    if (success) {
      setHasAccess(true)
      if (!existingReport) void handleGenerateV3()
    } else {
      setShowPricing(true)
    }
  }
```

With:
```tsx
  // Confirms the spend after the user reviewed the modal.
  const executeUnlock = () => {
    setConfirmGenerateOpen(false)
    if (hasAnalyzed(car.id)) {
      setHasAccess(true)
      if (!existingReport) void handleGenerateV3()
      return
    }
    const success = consumeForAnalysis(car.id)
    if (success) {
      setHasAccess(true)
      if (!existingReport) void handleGenerateV3()
    } else {
      setShowPricing(true)
    }
  }

  // Entry point used by every Unlock CTA in the layout.
  // 1. If we already analyzed this car (cached), skip confirm and reuse.
  // 2. If balance can't cover the cost, route directly to the top-up flow.
  // 3. Otherwise open the pedagogical confirmation modal.
  const handleUnlock = () => {
    if (hasAnalyzed(car.id)) {
      executeUnlock()
      return
    }
    if (!canAffordReport(tokens, REPORT_PISTON_COST)) {
      setShowPricing(true)
      return
    }
    setConfirmGenerateOpen(true)
  }
```

> **Note:** The `tokens` variable should already exist in the component (it's how the existing pricing flow reads the balance). If it's named something else (`creditsRemaining`, `userTokens`, etc.), substitute the correct identifier. Verify by grepping `rg -n "tokens|creditsRemaining" src/app/\[locale\]/cars/\[make\]/\[id\]/report/ReportClient.tsx | head -10` and using whichever holds the user's piston balance as a number.

- [ ] **Step 3.4: Mount `<ConfirmGenerateModal>` inside the return tree**

Find the end of the return tree (around lines 2700+, just before the closing `</div>` of the root). It's where the existing modals/dialogs are mounted (`OutOfPistonsModal`, etc.). Add:
```tsx
      <ConfirmGenerateModal
        open={confirmGenerateOpen}
        onOpenChange={setConfirmGenerateOpen}
        car={car}
        cost={REPORT_PISTON_COST}
        balance={tokens}
        onConfirm={executeUnlock}
      />
```

If you cannot locate the existing modal mounting block, search for `<OutOfPistonsModal` first; if that component is used here, mount `ConfirmGenerateModal` immediately after it. Otherwise mount it as a sibling of the root `<div className="min-h-screen bg-background">`.

- [ ] **Step 3.5: Type-check and smoke-test**

Run:
```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | rg -i "ReportClient|ConfirmGenerate|canAffordReport" | head -10
```
Expected: no errors.

Then open in browser (mock fixture, no real account needed):
```bash
curl -sI "http://localhost:3000/en/cars/porsche/$(rg '^const TEST_LISTING_ID' tests/e2e/haus-report.spec.ts -or '$1' | tr -d '"' || echo "any-id")/report?mock=992gt3"
```
This is a smoke check that the route compiles. The real visual smoke comes in Task 8.

- [ ] **Step 3.6: Commit**

Run:
```bash
git add src/app/\[locale\]/cars/\[make\]/\[id\]/report/ReportClient.tsx
git commit -m "$(cat <<'EOF'
feat(report): gate piston spend behind ConfirmGenerateModal

Refactor handleUnlock into a two-stage flow. Step 1 routes the click:
- already-analyzed cars skip straight to the unlock path
- balances below 100 pistons go directly to OutOfPistons/pricing
- everyone else sees the pedagogical confirmation modal
Step 2 (executeUnlock) runs after the user confirms in the modal and
performs the existing consume+generate behavior unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add `v3Report` and `userHasAccess` props to `ReportClient`

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`

- [ ] **Step 4.1: Locate and widen the props interface**

Find the component signature (around line 155):
```tsx
export function ReportClient({ car, similarCars, existingReport, marketStats, dbComparables = [] }: {
  car: CollectorCar
  similarCars: SimilarCarResult[]
  existingReport: HausReport | null
  marketStats: ModelMarketStats | null
  dbComparables?: DbComparableRow[]
}) {
```

Replace with:
```tsx
export function ReportClient({
  car,
  similarCars,
  existingReport,
  marketStats,
  dbComparables = [],
  v3Report = null,
  userHasAccess = false,
}: {
  car: CollectorCar
  similarCars: SimilarCarResult[]
  existingReport: HausReport | null
  marketStats: ModelMarketStats | null
  dbComparables?: DbComparableRow[]
  v3Report?: HausReportV3 | null
  userHasAccess?: boolean
}) {
```

- [ ] **Step 4.2: Import the V3 type**

Add to the top of the file (near the other type imports around lines 1-40):
```tsx
import type { HausReportV3 } from "@/lib/reports/types-v3"
```

- [ ] **Step 4.3: Seed `hasAccess` from the new prop**

Find the existing `useState` for `hasAccess` (around line 201):
```tsx
  const [hasAccess, setHasAccess] = useState(false)
```

Replace with:
```tsx
  const [hasAccess, setHasAccess] = useState(userHasAccess)
```

This way, server-side detection of paid access (already computed in `page.tsx`) immediately unlocks the UI without waiting for a client-side state transition.

- [ ] **Step 4.4: Type-check**

Run:
```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | rg -i "ReportClient|HausReportV3" | head -10
```
Expected: no errors related to these props.

- [ ] **Step 4.5: Commit**

Run:
```bash
git add src/app/\[locale\]/cars/\[make\]/\[id\]/report/ReportClient.tsx
git commit -m "$(cat <<'EOF'
feat(report): add v3Report + userHasAccess props to ReportClient

Prepares the unified component to receive server-side access checks
and the V3 AI output. Seeds hasAccess from userHasAccess so paid users
don't see a flash of the paywall on initial render.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Render V3 section components inside V1 layout when `hasAccess && v3Report`

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`

This is the biggest change. Strategy: keep the existing 9 section wrappers (with their `SectionHeader`, scroll target, and `PaywallSection`), but swap each section's inner content for the corresponding V3 component when V3 data is available.

- [ ] **Step 5.1: Import the V3 section components**

Add to the top of `ReportClient.tsx`, alongside the existing imports:
```tsx
import { ExecutiveSummarySection } from "@/components/report/v3/ExecutiveSummarySection"
import { TechnicalAnalysisSection } from "@/components/report/v3/TechnicalAnalysisSection"
import { InvestmentStrategySection } from "@/components/report/v3/InvestmentStrategySection"
import { DueDiligenceSection as V3DueDiligenceSection } from "@/components/report/v3/DueDiligenceSection"
import { MarketResearchSection } from "@/components/report/v3/MarketResearchSection"
import { BuyerServicesSection } from "@/components/report/v3/BuyerServicesSection"
import { OwnershipCostSection } from "@/components/report/v3/OwnershipCostSection"
import { ResaleTimelineSection } from "@/components/report/v3/ResaleTimelineSection"
```

> **Note on aliasing:** V1 may already have a `DueDiligenceSection` symbol from V1's own imports or local references — aliasing the V3 import to `V3DueDiligenceSection` avoids the name clash. If no clash exists, drop the `as V3DueDiligenceSection` alias.

- [ ] **Step 5.2: Open `ReportClientV2.tsx` side-by-side to see how each V3 section is rendered**

Read `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx` from line ~250 to the end. Note exactly which props each V3 component receives. The pattern is `<ExecutiveSummarySection report={v3Report} />` for most of them, but some take additional props (`car`, `comparables`). Mirror those calls verbatim — do not invent prop names.

- [ ] **Step 5.3: Replace V1 teaser content with V3 content per section**

Find each of the 9 sections in V1 (search for `<PaywallSection sectionId="…"` — they start around line 1880 and run to ~2430). For each section, wrap the existing teaser body in a conditional:

```tsx
              <PaywallSection sectionId="summary">
                {hasAccess && v3Report ? (
                  <>
                    <SectionHeader id="summary" title={t("sections.summary")} />
                    <ExecutiveSummarySection report={v3Report} />
                  </>
                ) : (
                  /* existing V1 teaser content for summary — leave untouched */
                  <>...existing JSX here...</>
                )}
              </PaywallSection>
```

Section-to-component mapping (use exactly this mapping; if a V2 call site uses different props, copy V2's exact JSX):

| V1 sectionId | V3 component to render |
|--------------|------------------------|
| `summary` | `<ExecutiveSummarySection report={v3Report} />` |
| `identity` | Render from `v3Report.vehicle_identity` inline using the existing `VinIntelBlock` and `ColorIntelBlock` patterns from V2 |
| `valuation` | `<InvestmentStrategySection report={v3Report} />` plus `<SpecificCarFairValueBlock report={v3Report} />` |
| `performance` | `<TechnicalAnalysisSection report={v3Report} />` |
| `risk` | Render the risk subset of `v3Report.due_diligence` (V2 has a `<SignalsDetectedBlock>` for this — copy its call site) |
| `dueDiligence` | `<V3DueDiligenceSection report={v3Report} />` |
| `marketContext` | `<MarketResearchSection report={v3Report} />` plus `<MarketContextBlock report={v3Report} />` |
| `similar` | `<ComparablesAndPositioningBlock report={v3Report} comps={comps} />` |
| `verdict` | `<VerdictBlock report={v3Report} />` |

> **Important:** The existing V1 teaser content under `else` MUST stay intact. Only ADD the `hasAccess && v3Report` branch — do not delete V1's preview content. This guarantees the preview experience is unchanged for non-paid users.

> **Practical procedure:** Make the change ONE section at a time. After each section:
> 1. Save the file.
> 2. Open `http://localhost:3000/en/cars/porsche/<any-id>/report?mock=v3` in the browser.
> 3. Confirm the section renders the V3 content and the page does not crash.
> 4. Commit with a granular message like `feat(report): render V3 ExecutiveSummary inside V1 layout`.
> 5. Move to the next section.

Doing all 9 in one commit is acceptable if you prefer fewer commits, but the per-section approach is safer and recommended.

- [ ] **Step 5.4: Verify TypeScript and runtime**

After all 9 sections are wired:
```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | rg -i "ReportClient|v3Report" | head -20
```
Expected: no errors.

```bash
curl -s "http://localhost:3000/en/cars/porsche/anything/report?mock=v3" -o /dev/null -w "%{http_code}\n"
```
Expected: `200`.

- [ ] **Step 5.5: Final commit for Task 5 (if you batched sections)**

If you committed per-section (recommended), this step is a no-op. Otherwise:
```bash
git add src/app/\[locale\]/cars/\[make\]/\[id\]/report/ReportClient.tsx
git commit -m "$(cat <<'EOF'
feat(report): render V3 section components inside V1 layout

For paid users with a V3 report available, each of the 9 V1 sections
now renders the corresponding V3 dedicated component. The V1 teaser
content remains as the fallback for preview users. The sidebar TOC,
hero, and PaywallSection wrappers are unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Simplify `page.tsx` to always render `ReportClient`

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/page.tsx`

- [ ] **Step 6.1: Locate the V1/V2 branch**

Find the JSX around line 257 of `page.tsx`:
```tsx
      {userHasAccess && (existingReport || v3Report) ? (
        <ReportClientV2
          car={car}
          similarCars={similarCars}
          existingReport={existingReport}
          marketStats={marketStats}
          dbComparables={dbComparables}
          d2Precomputed={d2Precomputed}
          reportTier={reportTier}
          reportHash={reportHash}
          reportVersion={reportVersion}
          v3Report={v3Report}
          userHasAccess={userHasAccess}
        />
      ) : (
        <ReportClient
          car={car}
          similarCars={similarCars}
          existingReport={existingReport}
          marketStats={marketStats}
          dbComparables={dbComparables}
        />
      )}
```

- [ ] **Step 6.2: Replace with a single render**

Replace the entire ternary above with:
```tsx
      <ReportClient
        car={car}
        similarCars={similarCars}
        existingReport={existingReport}
        marketStats={marketStats}
        dbComparables={dbComparables}
        v3Report={v3Report}
        userHasAccess={userHasAccess}
      />
```

Also remove the surrounding comment block (lines 250-256 — the one that explains the V1/V2 split) since it is no longer accurate. Replace it with:
```tsx
      {/* Single unified report client. Renders the paywall preview for
          users without access, and the full V3 report content inside
          the same layout shell for paid users. */}
```

- [ ] **Step 6.3: Remove the now-unused import of `ReportClientV2`**

In `page.tsx`, find the import:
```tsx
import ReportClientV2 from "./ReportClientV2"
```
(Or whatever exact path/syntax it uses. Search with `rg -n "ReportClientV2" src/app/\[locale\]/cars/\[make\]/\[id\]/report/page.tsx`.)

Delete that line.

- [ ] **Step 6.4: Type-check**

Run:
```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | rg -i "page\.tsx|ReportClient" | head -10
```
Expected: no errors.

- [ ] **Step 6.5: Smoke-test both paths**

Preview (no access):
```bash
curl -s "http://localhost:3000/en/cars/porsche/anything/report" -o /dev/null -w "preview: %{http_code}\n"
```
Expected: `200` (or 307 → follow), and the rendered HTML contains the word "Unlock" or the section TOC.

Paid (mock):
```bash
curl -s "http://localhost:3000/en/cars/porsche/anything/report?mock=v3" -o /dev/null -w "paid: %{http_code}\n"
```
Expected: `200`.

- [ ] **Step 6.6: Commit**

Run:
```bash
git add src/app/\[locale\]/cars/\[make\]/\[id\]/report/page.tsx
git commit -m "$(cat <<'EOF'
refactor(report): always render unified ReportClient

Removes the V1/V2 branch from page.tsx. ReportClient now handles both
the preview (no access) and paid (V3 content) experiences inside one
shell. ReportClientV2 import is removed; the file itself is deleted in
the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Delete `ReportClientV2.tsx`

**Files:**
- Delete: `src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx`

- [ ] **Step 7.1: Confirm no other code references V2**

Run:
```bash
rg -n "ReportClientV2" src 2>/dev/null
```
Expected: no results (other than possibly the file itself).

If any references remain outside the file, stop and fix them before deleting.

- [ ] **Step 7.2: Delete the file**

Run:
```bash
git rm "src/app/[locale]/cars/[make]/[id]/report/ReportClientV2.tsx"
```

- [ ] **Step 7.3: Type-check + lint**

Run:
```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | rg "error" | head -10
npx eslint src/app/\[locale\]/cars/\[make\]/\[id\]/report/ 2>&1 | rg -i "error|warning" | head -10
```
Expected: zero errors. Warnings are acceptable if they pre-existed.

- [ ] **Step 7.4: Commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
refactor(report): remove ReportClientV2

Deletes the legacy V2 component. All of its responsibilities are now
handled by the unified ReportClient: V3 section rendering, paid layout,
and access gating. 681 LOC removed; no behavior change for users.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Visual smoke test — desktop and mobile, paid and preview

**Files (read-only validation):**
- Use: `http://localhost:3000` (running dev server)

- [ ] **Step 8.1: Desktop preview (no access)**

Open in a desktop-sized browser tab (≥1024px wide):
```
http://localhost:3000/en/cars/porsche/anything/report
```
Verify visually:
- ✅ Fixed 240px sidebar on the left with 9 TOC items (Summary visible, others with Lock icons)
- ✅ Hero 21:9 aspect ratio with car photo, Cormorant H1 title, "FREE PREVIEW" chip
- ✅ Summary section unlocked; sections 02–09 blurred with "Unlock 100 pistons" CTA
- ✅ Sidebar footer shows balance + "Unlock 100 pistons" button
- ✅ Heritage Lavender CTAs (no blue, no red)

- [ ] **Step 8.2: Desktop paid (mock)**

Open:
```
http://localhost:3000/en/cars/porsche/anything/report?mock=v3
```
Verify visually:
- ✅ Same sidebar layout as preview
- ✅ All 9 sections rendered with V3 content (no blur, no Lock icons)
- ✅ Sidebar footer shows balance + "Download" button (not "Unlock")
- ✅ Hero "FREE PREVIEW" chip is absent; "HAUS REPORT" chip remains

- [ ] **Step 8.3: Desktop confirmation modal flow**

On the preview page (Step 8.1), click any "Unlock 100 pistons" button. Verify:
- ✅ `ConfirmGenerateModal` opens centered, max-w-[480px]
- ✅ Modal shows car title in Cormorant, 9 included sections list, cost + balance in Geist Mono
- ✅ Cancel button closes the modal cleanly
- ✅ ESC key closes the modal
- ✅ If the test account has <100 pistons, clicking Unlock does NOT show this modal — it goes directly to the pricing/OutOfPistons modal

- [ ] **Step 8.4: Mobile preview**

Resize browser to ~390px wide (iPhone 14 size) and open:
```
http://localhost:3000/en/cars/porsche/anything/report
```
Verify visually:
- ✅ Sticky top bar with horizontal scroll pills (9 sections)
- ✅ No fixed sidebar
- ✅ Hero 16:9 (not 21:9), Cormorant H1 sized smaller (~24px)
- ✅ Pills active-state moves as you scroll through sections
- ✅ The "Unlock" CTA inside blurred sections is full-width and tap-friendly (≥44px high)

- [ ] **Step 8.5: Mobile paid (mock)**

Open on the same narrow viewport:
```
http://localhost:3000/en/cars/porsche/anything/report?mock=v3
```
Verify visually:
- ✅ Same sticky pill nav as preview
- ✅ All 9 sections fully rendered
- ✅ Footer card with balance + "Download report" full-width button
- ✅ No sticky bottom bar

- [ ] **Step 8.6: Dark mode**

Toggle the theme switcher (existing global UI). Verify on both desktop and mobile:
- ✅ Sidebar background switches to `#161114` (Noir Card)
- ✅ Main background to `#0E0E0D` (Noir)
- ✅ Heritage Lavender (`#E1CCE5`) is used as primary accent (not Lavender Deep)
- ✅ Hero gradient still uses noir-toned overlay (no blue tint)
- ✅ ConfirmGenerateModal also respects dark mode

- [ ] **Step 8.7: Salon test**

For each viewport tested above, ask: *"Would this feel at home in a contemporary art gallery?"* If any element feels loud, corporate, or over-decorated, file a follow-up task with a screenshot.

- [ ] **Step 8.8: No backend changes**

Verify the diff against main contains zero changes to backend code:
```bash
git diff main -- "src/app/api/**" "src/lib/reports/queries.ts" "src/lib/reports/types.ts" "src/lib/reports/types-v3.ts" "supabase/**"
```
Expected: empty diff.

- [ ] **Step 8.9: No commit needed for visual validation** unless you discovered issues that require fixes. Any fix is its own commit with a message describing the issue and resolution.

---

### Task 9: Extend Playwright e2e for the modal flow

**Files:**
- Modify: `tests/e2e/haus-report.spec.ts`

- [ ] **Step 9.1: Add a new scenario at the bottom of the existing `test.describe` block**

Open `tests/e2e/haus-report.spec.ts` and append inside the existing `test.describe("Haus Report — free view + paid view", ...)`:
```ts
  test("clicking Unlock opens the ConfirmGenerateModal", async ({ page }) => {
    await page.goto(`/en/cars/porsche/${TEST_LISTING_ID}/report`)

    // The first Unlock CTA in the sidebar footer
    await page.getByRole("button", { name: /Unlock\s+\d+\s+pistons/i }).first().click()

    // The modal opens and shows the included-sections list
    await expect(page.getByText(/Includes\s+9\s+sections/i)).toBeVisible()
    await expect(page.getByText(/Executive summary/i)).toBeVisible()
    await expect(page.getByText(/Final verdict/i)).toBeVisible()

    // Both action buttons are present
    await expect(page.getByRole("button", { name: /Cancel/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /Generate report/i })).toBeVisible()

    // ESC closes the modal
    await page.keyboard.press("Escape")
    await expect(page.getByText(/Includes\s+9\s+sections/i)).not.toBeVisible()
  })
```

- [ ] **Step 9.2: Run the e2e suite locally (optional if you have TEST_LISTING_ID)**

If you have a valid listing UUID:
```bash
TEST_LISTING_ID=<uuid> npx playwright test tests/e2e/haus-report.spec.ts
```
Expected: all three tests pass. The new one and the two pre-existing ones.

If you do NOT have a valid `TEST_LISTING_ID`, the test is `test.skip`ed at the suite level — confirm with `npx playwright test --list` that the test is registered.

- [ ] **Step 9.3: Commit**

Run:
```bash
git add tests/e2e/haus-report.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): cover ConfirmGenerateModal open/close + content

Adds a Playwright scenario that verifies the new confirmation modal
appears with the expected 9-section list when an Unlock CTA is
clicked, and that ESC dismisses it. Pre-existing tests untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Final acceptance review + summary commit

- [ ] **Step 10.1: Walk through all 20 acceptance criteria from the spec**

Open `docs/superpowers/specs/2026-05-14-aura-maxima-report-rebuild-design.md` and read section 8 (acceptance criteria). For each numbered item, verify against the current code/UI and record pass/fail.

If any criterion fails, file a follow-up task (or fix inline if it's small). Do NOT mark the plan complete with failing criteria.

- [ ] **Step 10.2: Run the full quick-check suite**

Run:
```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | rg -i "error" | head -20
npx eslint "src/app/[locale]/cars/[make]/[id]/report/" "src/components/report/" 2>&1 | rg -i "error|warning" | head -20
npx vitest run src/lib/reports/canAffordReport.test.ts
```
Expected: 0 TypeScript errors, 0 new ESLint errors, 6 passing Vitest cases.

- [ ] **Step 10.3: Verify the diff scope is frontend-only**

Run:
```bash
git diff main --stat
```
Expected: the changed files are limited to:
- `src/app/[locale]/cars/[make]/[id]/report/*`
- `src/components/report/ConfirmGenerateModal.tsx`
- `src/lib/reports/canAffordReport.ts(.test.ts)`
- `tests/e2e/haus-report.spec.ts`
- `docs/superpowers/{specs,plans}/*` (spec + this plan)

There must be no changes to `src/app/api/**`, `supabase/**`, `src/lib/reports/queries.ts`, `src/lib/reports/types*.ts`, or `brandConfig.ts`.

- [ ] **Step 10.4: Push the branch**

Run:
```bash
git push -u origin Aura-Maxima-Front
```

- [ ] **Step 10.5: Open a draft PR (optional — only if user requests)**

If Edgar asks for a PR, use the gh CLI. Otherwise stop here and report completion.

---

## Self-Review

**Spec coverage:** Every numbered acceptance criterion in the spec maps to a task above:
- AC 1 (single component) → Task 6 + Task 7
- AC 2 (preview view) → Task 5 (V1 teaser content kept untouched in `else` branch)
- AC 3 (paid view) → Task 5 (V3 content rendered in 9 sections)
- AC 4 (Unlock ≥100 → modal) → Task 3
- AC 5 (Unlock <100 → OutOfPistons) → Task 3
- AC 6 (Confirm → GenerationStepper, no flicker) → Task 3 (executeUnlock keeps the existing handleGenerateV3 path which mounts the GenerationStepper)
- AC 7 (Cancel returns to view) → Task 2 (Dialog.Close + onOpenChange)
- AC 8 (TOC scroll-spy) → unchanged from V1 (validated in Task 8)
- AC 9 (mobile pills) → Task 8.4 verifies
- AC 10 (desktop sidebar) → Task 8.1 verifies
- AC 11 (theme switch) → Task 8.6 verifies
- AC 12 (typography) → Task 2 component + Task 8 visual check
- AC 13 (no red indicators) → Task 8.6
- AC 14 (V2 deleted) → Task 7
- AC 15 (page.tsx simplified) → Task 6
- AC 16 (mocks still work) → Tasks 5.4 + 8.1–8.5
- AC 17 (untouched components) → enforced by file-structure section and Task 10.3
- AC 18 (build/lint clean) → Task 10.2
- AC 19 (Salon test) → Task 8.7
- AC 20 (no backend changes) → Task 10.3

**Placeholder scan:** None. Each step has either exact code, an exact command, or a documented read-only action.

**Type consistency:** `v3Report?: HausReportV3 | null` is used consistently across Tasks 4, 5, and 6. `REPORT_PISTON_COST` is imported the same way in Task 3. The `canAffordReport` signature in Task 1 matches the call site in Task 3.

**Open risks recorded in the spec are addressed:**
- LOC bloat on `ReportClient` → mitigated by *not* extracting sections (V3 components already exist; we only import them).
- `handleUnlock` legacy path → preserved in `executeUnlock` (Task 3.3 keeps every existing state mutation).
- Section ID reconciliation → explicit mapping table in Task 5.3.
- Modal-to-stepper flicker → both controlled by the same component tree; closing the modal and starting generation happen on the same tick inside `executeUnlock`.
- LCP on hero → no change from V1 baseline; `priority` flag stays on `SafeImage`.

The plan is complete.
