# Strict Report Comparables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all report comparables strict same make plus same model/variant identity, and omit comparable-dependent report UI/export sections when strict data is absent.

**Architecture:** Add one vanilla strict peer-identity helper and route every report comparable path through it. Keep broad `findSimilarCars` behavior available for non-report surfaces, but add a strict report-only live peer selector for the report page and summary rail.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest 4, React Testing Library, existing PDF/Excel renderers. No new dependency.

**Locality Budget:** `{files: 19 touched, LOC/file: target <150 changed LOC per file and no touched file near 1000 LOC because of this change, deps: 0}`

---

## Phase-Zero Context

- OS: Windows 11 Home 10.0.26200
- Shell: PowerShell 5.1
- Runtime: Node v24.5.0, npm 11.5.2
- App: Next.js 16.1.6, React 19.2.3, Vitest 4.0.18
- Worktree: `.worktrees/report-comparables-logic`
- Baseline: `npm install` completed. Full `npm test` currently has unrelated pre-existing failures called out in the spec.
- Non-functional requirements: zero new dependencies, strict data honesty, no fabricated comparable fallback, no visible empty comparable placeholders where strict data is absent.

## File Map

- Create `src/lib/reportPeerIdentity.ts`: strict normalization and comparison helper for make plus model/variant identity.
- Create `src/lib/reportPeerIdentity.test.ts`: pure unit coverage for normalization and strict identity matching.
- Modify `src/lib/db/queries.ts`: add `getStrictComparablesForModel()` and keep existing broad `getComparablesForModel()` for non-report callers.
- Create `src/lib/db/queries.comparables.test.ts`: verify strict query parameters and DB failure fallback.
- Modify `src/lib/similarCars.ts`: add `findStrictReportPeers()` while preserving `findSimilarCars()`.
- Create `src/lib/similarCars.test.ts`: verify strict live peers exclude base/family/price-only candidates.
- Modify `src/lib/reports/agents/marketDataBundle.ts`: fetch strict sold comparables and set strict count only.
- Modify `src/lib/reports/agents/fairValueEngine.ts`: avoid claiming a comparable-backed layer when strict count is zero.
- Modify `src/app/[locale]/cars/[make]/[id]/report/page.tsx`: use strict sold comparables and strict live peers.
- Modify `src/app/[locale]/cars/[make]/[id]/report/page.test.tsx`: assert strict functions are called and strict arrays reach `ReportClient`.
- Modify `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`: render `ComparablesAndPositioningBlock` only when strict historical comparables exist.
- Modify `src/components/report/ReportSummaryRail.tsx`: hide peer list area when no strict peers, and label populated peers `Live same-model listings`.
- Create `src/components/report/ReportSummaryRail.test.tsx`: verify empty peers hide the list area while keeping the summary.
- Modify `src/app/api/reports/[id]/pdf/route.ts`: fetch strict comparables.
- Modify `src/app/api/reports/[id]/excel/route.ts`: fetch strict comparables.
- Modify `src/lib/exports/pdf/renderReport.tsx`: omit `ComparablesPage` when comparables are empty and adjust page numbering.
- Modify `src/lib/exports/pdf/templates/ComparablesPage.tsx`: remove empty comparable placeholder branch because the page is no longer mounted empty.
- Modify `src/lib/exports/pdf/renderReport.test.ts`: assert the PDF renderer gate omits comparable pages for empty strict comparables.
- Modify `src/lib/exports/excel/renderReport.test.ts`: assert empty comparables render no `Comparable Sales` sheet/table text.

## Task 1: Strict Peer Identity Helper

**Files:**
- Create: `src/lib/reportPeerIdentity.ts`
- Create: `src/lib/reportPeerIdentity.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/lib/reportPeerIdentity.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  buildReportPeerIdentity,
  matchesReportPeerIdentity,
  normalizeReportPeerText,
} from "./reportPeerIdentity"

describe("report peer identity", () => {
  it("normalizes case, whitespace, and harmless punctuation", () => {
    expect(normalizeReportPeerText("  911   GT3. ")).toBe("911 gt3")
    expect(normalizeReportPeerText("Carrera-S")).toBe("carrera s")
    expect(normalizeReportPeerText("  Porsche  ")).toBe("porsche")
  })

  it("builds no identity when make or model identity is missing", () => {
    expect(buildReportPeerIdentity({ make: "Porsche", model: "" })).toBeNull()
    expect(buildReportPeerIdentity({ make: "", model: "911 GT3" })).toBeNull()
  })

  it("matches exact same make and model variant identity", () => {
    const target = buildReportPeerIdentity({ make: "Porsche", model: "911 GT3" })
    expect(target).not.toBeNull()
    expect(matchesReportPeerIdentity(target, { make: " porsche ", model: "911 gt3" })).toBe(true)
  })

  it("does not match base model to variant", () => {
    const target = buildReportPeerIdentity({ make: "Porsche", model: "911 GT3" })
    expect(matchesReportPeerIdentity(target, { make: "Porsche", model: "911" })).toBe(false)
  })

  it("does not match adjacent variants", () => {
    const target = buildReportPeerIdentity({ make: "Porsche", model: "911 GT3" })
    expect(matchesReportPeerIdentity(target, { make: "Porsche", model: "911 GT3 RS" })).toBe(false)
    expect(matchesReportPeerIdentity(target, { make: "Porsche", model: "911 Turbo" })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `.worktrees/report-comparables-logic`:

```powershell
npm test -- src/lib/reportPeerIdentity.test.ts
```

Expected: FAIL with module resolution errors for `./reportPeerIdentity`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/reportPeerIdentity.ts`:

```ts
export interface ReportPeerIdentity {
  make: string
  modelIdentity: string
}

interface ReportPeerIdentityInput {
  make?: string | null
  model?: string | null
}

export function normalizeReportPeerText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,;:()[\]{}'"`]/g, " ")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildReportPeerIdentity(input: ReportPeerIdentityInput): ReportPeerIdentity | null {
  const make = normalizeReportPeerText(input.make)
  const modelIdentity = normalizeReportPeerText(input.model)
  if (!make || !modelIdentity) return null
  return { make, modelIdentity }
}

export function matchesReportPeerIdentity(
  target: ReportPeerIdentity | null,
  candidate: ReportPeerIdentityInput,
): boolean {
  if (!target) return false
  const candidateIdentity = buildReportPeerIdentity(candidate)
  if (!candidateIdentity) return false
  return (
    candidateIdentity.make === target.make &&
    candidateIdentity.modelIdentity === target.modelIdentity
  )
}
```

- [ ] **Step 4: Run helper tests**

Run:

```powershell
npm test -- src/lib/reportPeerIdentity.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/reportPeerIdentity.ts src/lib/reportPeerIdentity.test.ts
git commit -m "feat(report): add strict peer identity helper"
```

## Task 2: Strict Historical Comparable Query

**Files:**
- Modify: `src/lib/db/queries.ts`
- Create: `src/lib/db/queries.comparables.test.ts`

- [ ] **Step 1: Write the failing DB query tests**

Create `src/lib/db/queries.comparables.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const dbQueryMock = vi.fn()

vi.mock("./sql", () => ({
  dbQuery: (...args: unknown[]) => dbQueryMock(...args),
}))

describe("strict comparable queries", () => {
  beforeEach(() => {
    vi.resetModules()
    dbQueryMock.mockReset()
  })

  it("queries exact normalized make and model identity without wildcard broadening", async () => {
    dbQueryMock.mockResolvedValueOnce({
      rows: [
        {
          title: "2022 Porsche 911 GT3",
          platform: "BRING_A_TRAILER",
          soldDate: "2026-01-01T00:00:00.000Z",
          soldPrice: 225000,
          mileage: 1200,
          condition: "excellent",
        },
      ],
    })

    const { getStrictComparablesForModel } = await import("./queries")
    const rows = await getStrictComparablesForModel(" Porsche ", "911 GT3", 6)

    expect(rows).toHaveLength(1)
    expect(rows[0].soldDate).toBe("2026-01-01T00:00:00.000Z")
    expect(dbQueryMock).toHaveBeenCalledTimes(1)
    const [sql, values] = dbQueryMock.mock.calls[0]
    expect(String(sql)).toContain("regexp_replace")
    expect(String(sql)).toContain("lower")
    expect(values).toEqual(["porsche", "911 gt3", 6])
    expect(values).not.toContain("%911 GT3%")
  })

  it("returns empty when strict identity cannot be built", async () => {
    const { getStrictComparablesForModel } = await import("./queries")
    const rows = await getStrictComparablesForModel("Porsche", "", 6)

    expect(rows).toEqual([])
    expect(dbQueryMock).not.toHaveBeenCalled()
  })

  it("returns empty on DB failure", async () => {
    dbQueryMock.mockRejectedValueOnce(new Error("db down"))

    const { getStrictComparablesForModel } = await import("./queries")
    const rows = await getStrictComparablesForModel("Porsche", "911 GT3", 6)

    expect(rows).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/lib/db/queries.comparables.test.ts
```

Expected: FAIL because `getStrictComparablesForModel` is not exported.

- [ ] **Step 3: Add the strict query**

Modify `src/lib/db/queries.ts`:

```ts
import { buildReportPeerIdentity } from "@/lib/reportPeerIdentity"
```

Add after `getComparablesForModel()`:

```ts
export async function getStrictComparablesForModel(
  make: string,
  model: string,
  limit = 10,
): Promise<DbComparableRow[]> {
  const identity = buildReportPeerIdentity({ make, model })
  if (!identity) return []

  try {
    const rows = await withDbTimeout(
      () => dbQuery<DbComparableRow>(
        `
          SELECT c.title, c.platform::text AS platform, c."soldDate", c."soldPrice", c.mileage, c.condition
          FROM "Comparable" c
          JOIN "Auction" a ON a.id = c."auctionId"
          WHERE lower(regexp_replace(regexp_replace(a.make, '[.,;:()[\\]{}''"\`]', ' ', 'g'), '[-_/]+', ' ', 'g')) = $1
            AND lower(regexp_replace(regexp_replace(a.model, '[.,;:()[\\]{}''"\`]', ' ', 'g'), '[-_/]+', ' ', 'g')) = $2
          ORDER BY c."soldDate" DESC NULLS LAST
          LIMIT $3
        `,
        [identity.make, identity.modelIdentity, limit],
      ),
      "getStrictComparablesForModel",
    )
    return rows.rows.map((c) => ({ ...c, soldDate: c.soldDate ? new Date(c.soldDate).toISOString() : null }))
  } catch (e) {
    logDbQueryError("getStrictComparablesForModel", e)
    return []
  }
}
```

- [ ] **Step 4: Run DB query tests**

Run:

```powershell
npm test -- src/lib/db/queries.comparables.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/db/queries.ts src/lib/db/queries.comparables.test.ts
git commit -m "feat(report): query strict sold comparables"
```

## Task 3: Strict Live Report Peers

**Files:**
- Modify: `src/lib/similarCars.ts`
- Create: `src/lib/similarCars.test.ts`

- [ ] **Step 1: Write the failing strict live peer tests**

Create `src/lib/similarCars.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { findStrictReportPeers } from "./similarCars"
import type { CollectorCar } from "./curatedCars"

function car(input: Partial<CollectorCar> & { id: string; make: string; model: string; currentBid?: number }): CollectorCar {
  return {
    id: input.id,
    make: input.make,
    model: input.model,
    title: input.title ?? `${input.make} ${input.model}`,
    year: input.year ?? 2022,
    currentBid: input.currentBid ?? 100000,
    price: input.currentBid ?? 100000,
    image: "",
    images: [],
    mileage: input.mileage ?? 10000,
    mileageUnit: "mi",
    transmission: input.transmission ?? "manual",
  } as CollectorCar
}

describe("findStrictReportPeers", () => {
  it("returns only same make and same model variant identity", () => {
    const target = car({ id: "target", make: "Porsche", model: "911 GT3", currentBid: 200000 })
    const peers = findStrictReportPeers(target, [
      car({ id: "gt3", make: "Porsche", model: "911 GT3", currentBid: 210000 }),
      car({ id: "base", make: "Porsche", model: "911", currentBid: 200000 }),
      car({ id: "rs", make: "Porsche", model: "911 GT3 RS", currentBid: 220000 }),
      car({ id: "turbo", make: "Porsche", model: "911 Turbo", currentBid: 205000 }),
    ])

    expect(peers.map((p) => p.car.id)).toEqual(["gt3"])
    expect(peers[0].matchReasons).toEqual(["Same model variant"])
  })

  it("returns empty when target identity is missing", () => {
    const target = car({ id: "target", make: "Porsche", model: "" })
    const peers = findStrictReportPeers(target, [
      car({ id: "candidate", make: "Porsche", model: "911 GT3" }),
    ])

    expect(peers).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/lib/similarCars.test.ts
```

Expected: FAIL because `findStrictReportPeers` is not exported.

- [ ] **Step 3: Implement strict live peer selector**

Modify `src/lib/similarCars.ts`:

```ts
import { buildReportPeerIdentity, matchesReportPeerIdentity } from "./reportPeerIdentity"
```

Add after `findSimilarCars()`:

```ts
export function findStrictReportPeers(
  target: CollectorCar,
  candidates: CollectorCar[],
  limit = 6,
): SimilarCarResult[] {
  const targetIdentity = buildReportPeerIdentity({
    make: target.make,
    model: target.model,
  })
  if (!targetIdentity) return []

  return candidates
    .filter((candidate) => candidate.id !== target.id)
    .filter((candidate) =>
      matchesReportPeerIdentity(targetIdentity, {
        make: candidate.make,
        model: candidate.model,
      }),
    )
    .map((candidate) => ({
      car: candidate,
      score: 100,
      matchReasons: ["Same model variant"],
    }))
    .sort((a, b) => {
      const photoDiff = Number(hasPhoto(b.car)) - Number(hasPhoto(a.car))
      if (photoDiff !== 0) return photoDiff
      const aPrice = a.car.currentBid || a.car.price || 0
      const bPrice = b.car.currentBid || b.car.price || 0
      const targetPrice = target.currentBid || target.price || 0
      if (targetPrice <= 0) return bPrice - aPrice
      return Math.abs(aPrice - targetPrice) - Math.abs(bPrice - targetPrice)
    })
    .slice(0, limit)
}
```

- [ ] **Step 4: Run strict live peer tests**

Run:

```powershell
npm test -- src/lib/similarCars.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/similarCars.ts src/lib/similarCars.test.ts
git commit -m "feat(report): add strict live peer selector"
```

## Task 4: Wire Strict Comparables Into Report Generation Agents

**Files:**
- Modify: `src/lib/reports/agents/marketDataBundle.ts`
- Modify: `src/lib/reports/agents/fairValueEngine.ts`

- [ ] **Step 1: Update market data bundle to fetch strict sold comparables**

Modify imports in `src/lib/reports/agents/marketDataBundle.ts`:

```ts
import { getStrictComparablesForModel } from "@/lib/db/queries"
```

Replace the comparable fetch block:

```ts
  let dbComparables: any[] = []
  try {
    dbComparables = await getStrictComparablesForModel(make, car.model ?? "")
  } catch (err) {
    console.warn(
      "[market_data_bundle] getStrictComparablesForModel failed, continuing without DB comparables:",
      err instanceof Error ? err.message : err,
    )
    dbComparables = []
  }
```

Keep:

```ts
    dbComparables,
    comparablesCount: dbComparables.length,
```

- [ ] **Step 2: Update fair value layer honesty**

Modify the `report` object in `src/lib/reports/agents/fairValueEngine.ts`:

```ts
  const strictComparablesCount = marketData?.comparablesCount ?? 0
```

Set:

```ts
    comparable_layer_used: strictComparablesCount > 0 ? "strict" : null,
    comparables_count: strictComparablesCount,
```

- [ ] **Step 3: Run targeted report-agent checks**

Run:

```powershell
npm test -- src/lib/reports/agents
```

Expected: PASS for existing agent tests, or no matching tests. No new broad query import remains in these agent files.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/reports/agents/marketDataBundle.ts src/lib/reports/agents/fairValueEngine.ts
git commit -m "feat(report): use strict comparables in report agents"
```

## Task 5: Wire Strict Comparables Into Online Report SSR

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/page.tsx`
- Modify: `src/app/[locale]/cars/[make]/[id]/report/page.test.tsx`

- [ ] **Step 1: Update tests to mock and assert strict report inputs**

Modify mocks in `page.test.tsx`:

```ts
vi.mock("@/lib/similarCars", () => ({
  findStrictReportPeers: vi.fn().mockReturnValue([
    { car: { ...mockCar, id: "live-peer", model: "911" }, score: 100, matchReasons: ["Same model variant"] },
  ]),
}))

vi.mock("@/lib/db/queries", () => ({
  getStrictComparablesForModel: vi.fn().mockResolvedValue([
    {
      title: "2020 Porsche 911",
      platform: "BRING_A_TRAILER",
      soldDate: "2026-01-01T00:00:00.000Z",
      soldPrice: 100000,
      mileage: 5000,
      condition: "excellent",
    },
  ]),
}))
```

Add this test:

```ts
  it("passes strict historical comparables and strict live peers to ReportClient", async () => {
    const { default: ReportPage } = await import("./page")
    const { getStrictComparablesForModel } = await import("@/lib/db/queries")
    const { findStrictReportPeers } = await import("@/lib/similarCars")

    await ReportPage({
      params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
      searchParams: Promise.resolve({}),
    })

    expect(getStrictComparablesForModel).toHaveBeenCalledWith("Porsche", "911")
    expect(findStrictReportPeers).toHaveBeenCalled()
    expect(ReportClientMock.mock.calls[0]?.[0]).toMatchObject({
      dbComparables: [
        expect.objectContaining({ title: "2020 Porsche 911", soldPrice: 100000 }),
      ],
      similarCars: [
        expect.objectContaining({ score: 100, matchReasons: ["Same model variant"] }),
      ],
    })
  })
```

- [ ] **Step 2: Run report page test to verify it fails**

Run:

```powershell
npm test -- "src/app/[locale]/cars/[make]/[id]/report/page.test.tsx"
```

Expected: FAIL because `page.tsx` still imports `findSimilarCars` and `getComparablesForModel`.

- [ ] **Step 3: Update report page imports and calls**

Modify `src/app/[locale]/cars/[make]/[id]/report/page.tsx`:

```ts
import { findStrictReportPeers } from "@/lib/similarCars"
import { getStrictComparablesForModel } from "@/lib/db/queries"
```

Replace:

```ts
  const similarCars = findSimilarCars(car, allCandidates, 6)
```

with:

```ts
  const similarCars = findStrictReportPeers(car, allCandidates, 6)
```

Replace:

```ts
    getComparablesForModel(car.make, car.model).catch((err) => {
      console.warn(
        "[report] getComparablesForModel failed, continuing without DB comparables:",
        err instanceof Error ? err.message : err,
      )
      return []
    }),
```

with:

```ts
    getStrictComparablesForModel(car.make, car.model).catch((err) => {
      console.warn(
        "[report] getStrictComparablesForModel failed, continuing without DB comparables:",
        err instanceof Error ? err.message : err,
      )
      return []
    }),
```

- [ ] **Step 4: Run report page test**

Run:

```powershell
npm test -- "src/app/[locale]/cars/[make]/[id]/report/page.test.tsx"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add "src/app/[locale]/cars/[make]/[id]/report/page.tsx" "src/app/[locale]/cars/[make]/[id]/report/page.test.tsx"
git commit -m "feat(report): pass strict peers to report client"
```

## Task 6: Hide Empty Online Comparables Section

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx`

- [ ] **Step 1: Add a boolean gate near D3 setup**

Add after `const v1D3 = computeD3PeerPositioning(...)`:

```ts
  const hasStrictHistoricalComparables = dbComparables.length > 0
```

- [ ] **Step 2: Gate full-report comparable section**

Replace the paid V3 comparable block:

```tsx
                {hasAccess && visibleV3Report ? (
                  <>
                    <SectionHeader id="similar" title={t("sections.similar")} />
                    <ComparablesAndPositioningBlock
                      d3={v1D3}
                      thisVinPriceUsd={thisVinPriceUsd}
                      comparables={dbComparables}
                      captureDateRange={comparablesCaptureDateRange}
                    />
                  </>
                ) : (
```

with:

```tsx
                {hasAccess && visibleV3Report && hasStrictHistoricalComparables ? (
                  <>
                    <SectionHeader id="similar" title={t("sections.similar")} />
                    <ComparablesAndPositioningBlock
                      d3={v1D3}
                      thisVinPriceUsd={thisVinPriceUsd}
                      comparables={dbComparables}
                      captureDateRange={comparablesCaptureDateRange}
                    />
                  </>
                ) : !hasAccess || !visibleV3Report ? (
```

Close the existing fallback unchanged. After that fallback fragment, add:

```tsx
                ) : null}
```

The resulting behavior: paid V3 reports with zero strict historical comparables render no `ComparablesAndPositioningBlock` and no empty comparable card.

- [ ] **Step 3: Run TypeScript/build-adjacent validation**

Run:

```powershell
npm test -- "src/app/[locale]/cars/[make]/[id]/report/page.test.tsx"
npm run build
```

Expected: targeted page test PASS. Build should not introduce new report client type or JSX errors. If build reaches unrelated baseline failures, record exact unrelated failures and continue only if no error originates in `ReportClient.tsx`.

- [ ] **Step 4: Commit**

```powershell
git add "src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx"
git commit -m "feat(report): omit empty comparables section"
```

## Task 7: Hide Empty Right-Rail Peer List

**Files:**
- Modify: `src/components/report/ReportSummaryRail.tsx`
- Create: `src/components/report/ReportSummaryRail.test.tsx`

- [ ] **Step 1: Write failing right-rail tests**

Create `src/components/report/ReportSummaryRail.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ReportSummaryRail } from "./ReportSummaryRail"
import type { CollectorCar } from "@/lib/curatedCars"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("@/components/dashboard/cards/SafeImage", () => ({
  SafeImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

const car = {
  id: "target",
  make: "Porsche",
  model: "911 GT3",
  title: "2022 Porsche 911 GT3",
  year: 2022,
  currentBid: 200000,
  price: 200000,
  fairValueByRegion: { US: { low: 190000, high: 210000 } },
} as CollectorCar

describe("ReportSummaryRail", () => {
  it("keeps valuation summary but hides peer list copy when no strict peers exist", () => {
    render(
      <ReportSummaryRail
        car={car}
        verdict="buy"
        fairValueLow={190000}
        fairValueHigh={210000}
        fairValueMid={200000}
        askingPrice={200000}
        formatPrice={(n) => `$${n.toLocaleString()}`}
        similarCars={[]}
        makeSlug="porsche"
      />,
    )

    expect(screen.getAllByText("Verdict").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Fair Value").length).toBeGreaterThan(0)
    expect(screen.queryByText("Peer comparables surface during the full analysis.")).toBeNull()
    expect(screen.queryByText("Similar at this price")).toBeNull()
    expect(screen.queryByText("Live same-model listings")).toBeNull()
  })

  it("labels populated peers as live same-model listings", () => {
    render(
      <ReportSummaryRail
        car={car}
        verdict="buy"
        fairValueLow={190000}
        fairValueHigh={210000}
        fairValueMid={200000}
        askingPrice={200000}
        formatPrice={(n) => `$${n.toLocaleString()}`}
        similarCars={[
          { car: { ...car, id: "peer", title: "2021 Porsche 911 GT3" }, score: 100, matchReasons: ["Same model variant"] },
        ]}
        makeSlug="porsche"
      />,
    )

    expect(screen.getByText("Live same-model listings")).toBeTruthy()
    expect(screen.getByText("2021 911 GT3")).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/components/report/ReportSummaryRail.test.tsx
```

Expected: FAIL because empty peer copy and old label still render.

- [ ] **Step 3: Gate peer list rendering and update copy**

In `src/components/report/ReportSummaryRail.tsx`, replace the peer section inside desktop rail with:

```tsx
        {peers.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-4 pb-2">
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Live same-model listings
              </span>
            </div>

            <div className="px-2 pb-3 space-y-1">
              {peers.map((peer) => {
                const peerCar = peer.car
                const peerAsking =
                  peerCar.currentBid > 0
                    ? peerCar.currentBid
                    : (peerCar.price ?? 0)
                const peerDelta =
                  peerAsking > 0 && askingPrice > 0
                    ? Math.round(((peerAsking - askingPrice) / askingPrice) * 100)
                    : null
                return (
                  <Link
                    key={peerCar.id}
                    href={`/cars/${makeSlug}/${peerCar.id}/report`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-foreground/[0.03] transition-colors"
                  >
                    <div className="shrink-0 size-12 rounded-md overflow-hidden bg-card border border-border">
                      <SafeImage
                        src={peerCar.image || "/cars/placeholder.svg"}
                        alt={peerCar.title}
                        width={48}
                        height={48}
                        className="size-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        fallback={
                          <div className="size-full flex items-center justify-center text-[8px] text-muted-foreground">
                            {peerCar.year}
                          </div>
                        }
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                        {peerCar.year} {peerCar.model}
                      </p>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-[11px] tabular-nums font-semibold text-foreground">
                          {formatPrice(peerAsking)}
                        </span>
                        {peerDelta !== null && (
                          <span
                            className={`text-[9px] font-semibold ${
                              peerDelta > 5
                                ? "text-destructive"
                                : peerDelta < -5
                                  ? "text-positive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {peerDelta > 0 ? "+" : ""}
                            {peerDelta}%
                          </span>
                        )}
                      </div>
                      {peerCar.mileage > 0 && (
                        <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                          {peerCar.mileage.toLocaleString()} {peerCar.mileageUnit}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="shrink-0 size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </Link>
                )
              })}
              {similarCars.length > peers.length && (
                <Link
                  href={browseAllHref}
                  className="mt-2 mx-2 flex items-center justify-center gap-1 rounded-lg border border-border bg-card hover:border-primary/30 px-3 py-2 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  View all same-model listings
                  <ChevronRight className="size-3" />
                </Link>
              )}
            </div>
          </div>
        )}
```

Change the mobile button so empty peers do not offer an expandable peer control:

```tsx
          {peers.length > 0 && (
            <button
              onClick={() => setMobileExpanded((v) => !v)}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-medium text-foreground"
              aria-label={mobileExpanded ? "Hide peers" : "Show peers"}
            >
              <span>{peers.length} peers</span>
              <motion.span
                animate={{ rotate: mobileExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: "inline-block" }}
              >
                <ChevronUp className="size-3.5" />
              </motion.span>
            </button>
          )}
```

- [ ] **Step 4: Run right-rail tests**

Run:

```powershell
npm test -- src/components/report/ReportSummaryRail.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/report/ReportSummaryRail.tsx src/components/report/ReportSummaryRail.test.tsx
git commit -m "feat(report): hide empty strict peer rail"
```

## Task 8: Strict Comparables In Export Routes

**Files:**
- Modify: `src/app/api/reports/[id]/pdf/route.ts`
- Modify: `src/app/api/reports/[id]/excel/route.ts`

- [ ] **Step 1: Update PDF route imports and calls**

In `src/app/api/reports/[id]/pdf/route.ts`, replace:

```ts
import { getComparablesForModel } from "@/lib/db/queries"
```

with:

```ts
import { getStrictComparablesForModel } from "@/lib/db/queries"
```

Replace:

```ts
    getComparablesForModel(car.make, car.model),
```

with:

```ts
    getStrictComparablesForModel(car.make, car.model),
```

- [ ] **Step 2: Update Excel route imports and calls**

In `src/app/api/reports/[id]/excel/route.ts`, replace:

```ts
import { getComparablesForModel } from "@/lib/db/queries"
```

with:

```ts
import { getStrictComparablesForModel } from "@/lib/db/queries"
```

Replace:

```ts
    getComparablesForModel(car.make, car.model),
```

with:

```ts
    getStrictComparablesForModel(car.make, car.model),
```

- [ ] **Step 3: Scan for broad query usage in report/export paths**

Run:

```powershell
rg -n "getComparablesForModel|findSimilarCars" src/app/[locale]/cars/[make]/[id]/report src/app/api/reports src/lib/reports/agents
```

Expected: no matches in report/export/generation paths.

- [ ] **Step 4: Commit**

```powershell
git add "src/app/api/reports/[id]/pdf/route.ts" "src/app/api/reports/[id]/excel/route.ts"
git commit -m "feat(report): use strict comparables in exports"
```

## Task 9: Omit Empty PDF Comparables Page

**Files:**
- Modify: `src/lib/exports/pdf/renderReport.tsx`
- Modify: `src/lib/exports/pdf/templates/ComparablesPage.tsx`
- Modify: `src/lib/exports/pdf/renderReport.test.ts`

- [ ] **Step 1: Add failing PDF omission assertion**

Modify `src/lib/exports/pdf/renderReport.test.ts`:

```ts
import { renderReportToPdfBuffer, shouldRenderComparablesPage } from "./renderReport"
```

Add:

```ts
it("does not render the Comparables page when strict comparables are empty", () => {
  expect(shouldRenderComparablesPage([])).toBe(false)
})

it("renders the Comparables page when strict comparables exist", () => {
  expect(shouldRenderComparablesPage([
    {
      title: "2022 Porsche 911 GT3",
      platform: "BRING_A_TRAILER",
      soldDate: "2026-01-01T00:00:00.000Z",
      soldPrice: 225000,
      mileage: 1200,
      condition: "excellent",
    },
  ])).toBe(true)
})

it("still produces a valid PDF buffer when strict comparables are empty", async () => {
  const buf = await renderReportToPdfBuffer({
    report: { ...sampleReport, comparables_count: 0 },
    car: sampleCar,
    regions: [],
    comparables: [],
    askingUsd: 225000,
  })

  expect(buf.byteLength).toBeGreaterThan(1000)
  const header = buf.subarray(0, 5).toString("ascii")
  expect(header).toBe("%PDF-")
})
```

- [ ] **Step 2: Add the renderer gate and conditionally include comparables page**

In `src/lib/exports/pdf/renderReport.tsx`, replace the fixed page constants around V2 rendering with:

```ts
export function shouldRenderComparablesPage(comparables: DbComparableRow[]): boolean {
  return comparables.length > 0
}
```

Inside `renderReportToPdfBuffer`, add:

```ts
  const hasComparablesPage = shouldRenderComparablesPage(input.comparables)
  const totalPages = hasComparablesPage ? TOTAL_PAGES_V2 : TOTAL_PAGES_V2 - 1
  const dueDiligencePageNumber = hasComparablesPage ? 5 : 4
  const closingPageNumber = hasComparablesPage ? 6 : 5
```

Replace the fixed `ComparablesPage` and page numbers:

```tsx
      {hasComparablesPage && (
        <ComparablesPage
          report={input.report}
          comparables={input.comparables}
          regions={input.regions}
          pageNumber={4}
          totalPages={totalPages}
        />
      )}
      <DueDiligencePage report={input.report} pageNumber={dueDiligencePageNumber} totalPages={totalPages} />
      <ClosingPage
        report={input.report}
        regions={input.regions}
        pageNumber={closingPageNumber}
        totalPages={totalPages}
      />
```

Update earlier page components in that document to pass `totalPages={totalPages}` instead of `TOTAL_PAGES_V2`.

- [ ] **Step 3: Remove empty placeholder branch from ComparablesPage**

In `src/lib/exports/pdf/templates/ComparablesPage.tsx`, replace:

```tsx
      {comparables.length === 0 ? (
        <View style={pdfStyles.cardDashed}>
          <Text style={pdfStyles.bodyMuted}>
            Comparable data is being collected for this model. As sold listings are
            captured across platforms, comparables will populate here automatically.
          </Text>
        </View>
      ) : (
        <>
```

with:

```tsx
      <>
```

Replace the matching closing:

```tsx
        </>
      )}
```

with:

```tsx
      </>
```

- [ ] **Step 4: Run PDF tests and source scan**

Run:

```powershell
npm test -- src/lib/exports/pdf/renderReport.test.ts
rg -n "Comparable data is being collected for this model" src/lib/exports/pdf
```

Expected: PDF test PASS. `rg` returns no PDF empty comparable placeholder text.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/exports/pdf/renderReport.tsx src/lib/exports/pdf/templates/ComparablesPage.tsx src/lib/exports/pdf/renderReport.test.ts
git commit -m "feat(report): omit empty PDF comparables page"
```

## Task 10: Verify Excel Comparable Table Omission

**Files:**
- Modify: `src/lib/exports/excel/renderReport.test.ts`

- [ ] **Step 1: Add Excel regression test**

Modify `src/lib/exports/excel/renderReport.test.ts` to import ExcelJS:

```ts
import ExcelJS from "exceljs"
```

Add:

```ts
  it("omits the Comparable Sales table when strict comparables are empty", async () => {
    const buf = await renderReportToExcelBuffer({
      report: { ...sampleReport, comparables_count: 0 },
      car: sampleCar,
      regions: [],
      comparables: [],
      askingUsd: 225000,
      verdict: "WATCH",
    })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const allText = wb.worksheets
      .flatMap((ws) => ws.getSheetValues())
      .flatMap((row) => Array.isArray(row) ? row : [])
      .map((cell) => typeof cell === "object" && cell && "text" in cell ? String(cell.text) : String(cell ?? ""))
      .join("\n")

    expect(allText).not.toContain("Comparable Sales")
    expect(allText).not.toContain("sold transactions used to anchor fair value")
  })
```

- [ ] **Step 2: Run Excel tests**

Run:

```powershell
npm test -- src/lib/exports/excel/renderReport.test.ts
```

Expected: PASS. The existing sheet already gates comparables with `if (comparables.length > 0)`, so this should be a regression lock.

- [ ] **Step 3: Commit**

```powershell
git add src/lib/exports/excel/renderReport.test.ts
git commit -m "test(report): lock excel comparables omission"
```

## Task 11: Final Regression Pass

**Files:**
- No new files unless a failure requires a local fix.

- [ ] **Step 1: Run all targeted tests**

Run:

```powershell
npm test -- src/lib/reportPeerIdentity.test.ts src/lib/db/queries.comparables.test.ts src/lib/similarCars.test.ts src/components/report/ReportSummaryRail.test.tsx src/lib/exports/pdf/renderReport.test.ts src/lib/exports/excel/renderReport.test.ts "src/app/[locale]/cars/[make]/[id]/report/page.test.tsx"
```

Expected: PASS.

- [ ] **Step 2: Scan report comparable paths for forbidden broad fallbacks**

Run:

```powershell
rg -n "getComparablesForModel|findSimilarCars|Same lineage|Similar price range|price band|%\\$\\{model\\}%" src/app/[locale]/cars/[make]/[id]/report src/app/api/reports src/lib/reports/agents src/lib/exports
```

Expected: no forbidden broad comparable usage in report generation, online report, or export paths. Matches inside `src/lib/similarCars.ts` are acceptable only for the preserved non-report `findSimilarCars()` implementation.

- [ ] **Step 3: Run build**

Run:

```powershell
npm run build
```

Expected: no new type/build failure from touched files. If unrelated baseline failures appear, document exact file and message in the implementation summary.

- [ ] **Step 4: Confirm dependency and changed-file budget**

Run:

```powershell
git diff -- package.json package-lock.json
git diff --stat
```

Expected: no dependency file changes. Changed files align with the File Map; each touched file has less than 150 changed LOC unless the implementation notes justify a localized exception.

- [ ] **Step 5: Commit final test/doc adjustments if needed**

```powershell
git status --short
git add docs/superpowers/plans/2026-06-04-strict-report-comparables.md
git commit -m "docs(report): plan strict comparables implementation"
```

## Self-Review

- Spec coverage: strict identity normalization is Task 1; historical strict DB fetch is Task 2; market data and fair value generation are Task 4; SSR strict peer and comparable wiring is Task 5; online empty section omission is Task 6; right rail empty hiding and copy are Task 7; PDF/Excel strict fetch and omission are Tasks 8-10; failure logging and non-fatal empty arrays are preserved in Tasks 2, 4, and 5.
- Placeholder scan: no task uses deferred implementation wording. Every code-changing step provides exact code or exact replacement text.
- Type consistency: the new exported functions are `buildReportPeerIdentity`, `matchesReportPeerIdentity`, `normalizeReportPeerText`, `getStrictComparablesForModel`, and `findStrictReportPeers`; the same names are used across tests and wiring steps.
- Dependency check: no new dependency is required. PDF omission is verified through the exported render gate, existing buffer smoke tests, and source scan.

Plan complete and saved to `docs/superpowers/plans/2026-06-04-strict-report-comparables.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.
