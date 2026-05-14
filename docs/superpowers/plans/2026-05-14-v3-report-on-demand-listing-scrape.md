# V3 Report Listing Analysis Data Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the V3 `listing_scrape` stub with source-aware report-time listing analysis that improves report inputs when safe, preserves generation reliability when sources are protected, and never exposes scraping terminology to users.

**Architecture:** Keep the work in the reports vertical slice. `listingScraper.ts` remains the Step 1 executor and owns fallback construction, source policy, safe adapter execution, merge logic, customer-safe completion notes, and run monitoring. Existing scraper parser modules are reused only when their runtime assumptions match the report request environment; protected sources fall back cleanly unless explicitly enabled by environment flags.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.9, Vitest 4, existing scraper parser utilities, existing `report_sections`, existing `scraper_runs` monitoring table. No new dependencies.

---

## Phase Zero Context

**Environment Matrix**

| Item | Observed |
|---|---|
| OS | Windows, PowerShell workspace |
| Node/npm | Existing repo toolchain |
| Runtime target | `POST /api/analyze/v3`, Vercel server request, `maxDuration = 300` |
| Persistence | `report_sections` stores V3 Step 1 output under existing section key `listing_scrape` |
| Monitoring | `scraper_runs` table accepts text scraper/runtime names |
| Current Step 1 | `src/lib/reports/agents/listingScraper.ts` DB fallback stub |

**Non-Functional Requirements**

| Requirement | Target |
|---|---|
| User experience | The user sees “Analyzing listing”, never “scraping”, “scraper”, “bot”, “blocked”, “Cloudflare”, or source-protection internals. |
| Reliability | Report generation must continue if source analysis fails. Fallback data is a valid `ScrapedListingFull`. |
| Latency | Step 1 target < 12s; hard adapter timeout 15s; protected source fallback < 100ms when policy skips live fetch. |
| Source safety | Respect current scraper infrastructure: Vercel-safe HTTP paths inline, Windows/GHA/Scrapling-only paths guarded. |
| Observability | Every Step 1 run writes one `scraper_runs` row named `report-listing-analysis`; no `scraper_active_runs` marker because report generation can be concurrent. |
| Security | Do not log source HTML, auth cookies, user email, Supabase keys, AI prompts, or personal data. Logs may include listing id, canonical source, strategy, success, duration, field counts, and sanitized fallback reason. |
| Dependency budget | 0 new dependencies. |
| File budget | Modify 4 production files, create 2 tests. |
| LOC/file budget | `listingScraper.ts` <= 700 LOC; `types-v3.ts` delta <= 35 LOC; `pipeline.ts` delta <= 20 LOC; monitoring type delta <= 10 LOC; tests <= 450 LOC/file. |

## Product Copy Rule

The implementation may use the existing internal section key `listing_scrape` because the V3 database contract already depends on it. Customer-facing text must use:

- “Analyzing listing”
- “Reading listing data”
- “Listing analysis complete”
- “Using verified marketplace data”
- “Using verified database data”

Customer-facing text must not use:

- “scrape”
- “scraper”
- “scraping”
- “bot”
- “blocked”
- “Cloudflare”
- “Akamai”
- “WAF”

## Source Policy

| Source | Default report-time policy | Reason |
|---|---|---|
| BaT | Attempt inline | Existing HTTP detail parser already used for detail enrichment; one request is acceptable. |
| CarsAndBids | Attempt inline | Existing HTTP/Scrapling fallback parser; still bounded by timeout. |
| CollectingCars | Attempt inline | Existing HTTP/Scrapling fallback parser; still bounded by timeout. |
| Elferspot | Attempt inline | Existing HTTP/Cheerio detail parser, no major anti-bot notes; respect 15s timeout. |
| BeForward | Attempt inline with rate limiter >= 2500ms | Existing cron uses careful pacing; one report-time request is acceptable but must not use zero delay. |
| AutoTrader | Protected by default on Vercel | Docs say Windows Task Scheduler path is preferred because network path matters. Attempt only when not Vercel or `REPORT_ANALYSIS_AT_DIRECT=1`. |
| AutoScout24 | Protected by default on Vercel | Docs say Akamai historically blocks direct/browser paths; attempt only when not Vercel with Scrapling available, or `REPORT_ANALYSIS_AS24_DIRECT=1`. |
| ClassicCom | Protected by default on Vercel | Scrapling is disabled on Vercel and GHA is the primary full-detail path. Attempt only when not Vercel with Scrapling available, or `REPORT_ANALYSIS_CLASSIC_DIRECT=1`. |

When policy skips a live fetch, return the DB fallback with customer-safe completion note: `Listing analysis used verified database data`.

## File Map And Budgets

| File | Action | Responsibility | Target LOC/file | Deps |
|---|---|---|---:|---|
| `src/lib/reports/types-v3.ts` | Modify | Add optional Step 1 analysis metadata fields to `ScrapedListingFull` | <= current + 35 | 0 |
| `src/features/scrapers/common/monitoring/types.ts` | Modify | Add `report-listing-analysis` and `server_request` monitoring literals | <= current + 10 | 0 |
| `src/lib/reports/pipeline.ts` | Modify | Carry executor `completionNote` into progress event and rename visible Step 1 label to “Analyzing Listing” | <= current + 20 | 0 |
| `src/lib/reports/agents/listingScraper.ts` | Modify | Source policy, fallback merge, adapters, monitoring, customer-safe notes | <= 700 | 0 |
| `src/lib/reports/agents/listingScraper.test.ts` | Create | Unit tests for policy, fallback, merge, safe notes, monitoring injection | <= 450 | 0 |
| `src/lib/reports/pipeline.test.ts` | Create | Progress label and completion-note regression tests | <= 220 | 0 |

---

## Task 1: Add Tests For Source Policy, Fallback, And User-Safe Notes

**Files:**
- Create: `src/lib/reports/agents/listingScraper.test.ts`

- [ ] **Step 1: Create the failing test file**

Create `src/lib/reports/agents/listingScraper.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildFallbackFromCar,
  buildListingAnalysisNote,
  executeListingScraper,
  mergeAnalysisOntoFallback,
  selectListingAnalysisSource,
  shouldAttemptListingAnalysis,
  type ListingAnalysisAdapter,
  type ListingAnalysisMonitor,
} from "./listingScraper"
import type { CollectorCar } from "@/lib/curatedCars"
import type { PipelineContext } from "../pipeline"

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

function makeCar(overrides: Partial<CollectorCar> = {}): CollectorCar {
  return {
    id: "live-test",
    title: "2024 Porsche 911 GT3 RS",
    year: 2024,
    make: "Porsche",
    model: "911 GT3 RS",
    trim: null,
    price: 285000,
    trend: "flat",
    trendValue: 0,
    thesis: "Test listing",
    image: "https://example.com/1.jpg",
    images: ["https://example.com/1.jpg"],
    engine: "4.0L flat-six",
    transmission: "PDK",
    mileage: 1200,
    mileageUnit: "mi",
    location: "Miami, FL",
    region: "US",
    fairValueByRegion: {
      US: { currency: "$", low: 250000, high: 300000 },
      EU: { currency: "€", low: 250000, high: 300000 },
      UK: { currency: "£", low: 250000, high: 300000 },
      JP: { currency: "¥", low: 250000, high: 300000 },
    },
    history: "Existing DB history",
    platform: "BRING_A_TRAILER",
    status: "ACTIVE",
    currentBid: 250000,
    bidCount: 12,
    endTime: new Date("2026-06-01T12:00:00Z"),
    category: "911",
    sourceUrl: "https://bringatrailer.com/listing/2024-porsche-911-gt3-rs/",
    vin: "WP0AF2A9XRS123456",
    exteriorColor: "White",
    interiorColor: "Black",
    description: "Existing DB description",
    sellerNotes: "Existing seller notes",
    originalCurrency: "USD",
    askingPriceUsd: null,
    soldPriceUsd: null,
    valuationBasis: "asking",
    canonicalMarket: "US",
    family: "992",
    ...overrides,
  }
}

function makeCtx(car: CollectorCar): PipelineContext {
  return {
    listingId: car.id,
    car,
    listingScrape: null,
    vehicleIdentity: null,
    marketData: null,
    fairValue: null,
    technicalAnalysis: null,
    investmentAnalysis: null,
    dueDiligence: null,
    marketResearch: null,
    buyerServices: null,
    finalSynthesis: null,
  }
}

describe("listingScraper source policy", () => {
  it("selects canonical source from platform aliases and URL fallback", () => {
    expect(selectListingAnalysisSource(makeCar())).toBe("BaT")
    expect(selectListingAnalysisSource(makeCar({
      platform: "AUTO_TRADER",
      sourceUrl: "https://www.autotrader.co.uk/car-details/2026051401",
    }))).toBe("AutoTrader")
    expect(selectListingAnalysisSource(makeCar({
      platform: "AUTO_SCOUT_24",
      sourceUrl: "https://www.autoscout24.com/offers/porsche-911-test",
    }))).toBe("AutoScout24")
    expect(selectListingAnalysisSource(makeCar({
      platform: "CLASSIC_COM",
      sourceUrl: "https://www.classic.com/veh/test/",
    }))).toBe("ClassicCom")
  })

  it("attempts safe inline sources by default", () => {
    for (const source of ["BaT", "CarsAndBids", "CollectingCars", "Elferspot", "BeForward"] as const) {
      expect(shouldAttemptListingAnalysis(source, { isVercel: true, env: {} }).attempt).toBe(true)
    }
  })

  it("skips protected sources on Vercel unless explicitly enabled", () => {
    expect(shouldAttemptListingAnalysis("AutoTrader", { isVercel: true, env: {} })).toMatchObject({
      attempt: false,
      customerSafeReason: "verified_database_data",
    })
    expect(shouldAttemptListingAnalysis("AutoScout24", { isVercel: true, env: {} }).attempt).toBe(false)
    expect(shouldAttemptListingAnalysis("ClassicCom", { isVercel: true, env: {} }).attempt).toBe(false)
  })

  it("allows protected source experiments behind explicit flags", () => {
    expect(shouldAttemptListingAnalysis("AutoTrader", {
      isVercel: true,
      env: { REPORT_ANALYSIS_AT_DIRECT: "1" },
    }).attempt).toBe(true)
    expect(shouldAttemptListingAnalysis("AutoScout24", {
      isVercel: true,
      env: { REPORT_ANALYSIS_AS24_DIRECT: "1" },
    }).attempt).toBe(true)
    expect(shouldAttemptListingAnalysis("ClassicCom", {
      isVercel: true,
      env: { REPORT_ANALYSIS_CLASSIC_DIRECT: "1" },
    }).attempt).toBe(true)
  })
})

describe("listingScraper fallback and notes", () => {
  it("builds fallback from DB fields without dropping engine or description", () => {
    const fallback = buildFallbackFromCar(makeCar())
    expect(fallback.engine).toBe("4.0L flat-six")
    expect(fallback.descriptionFull).toBe("Existing DB description")
    expect(fallback.scrapeSuccessful).toBe(false)
    expect(fallback.analysisStrategy).toBe("database_fallback")
  })

  it("merges live analysis over fallback without losing DB-only fields", () => {
    const fallback = buildFallbackFromCar(makeCar())
    const merged = mergeAnalysisOntoFallback(fallback, {
      title: "2024 Porsche 911 GT3 RS Weissach",
      descriptionFull: "Full source listing description",
      equipmentList: ["Weissach Package", "PCCB", "PCCB"],
      photoUrls: ["https://example.com/source-1.jpg", "https://example.com/source-1.jpg"],
      scrapeSuccessful: true,
      scrapePartial: false,
      analysisStrategy: "inline_live_source",
    })

    expect(merged.title).toBe("2024 Porsche 911 GT3 RS Weissach")
    expect(merged.engine).toBe("4.0L flat-six")
    expect(merged.equipmentList).toEqual(["Weissach Package", "PCCB"])
    expect(merged.photoCount).toBe(1)
    expect(merged.analysisFieldCounts?.equipment).toBe(2)
  })

  it("returns customer-safe completion notes without scrape terminology", () => {
    const successNote = buildListingAnalysisNote({
      ...buildFallbackFromCar(makeCar()),
      scrapeSuccessful: true,
      photoCount: 12,
      equipmentList: ["PCCB", "Front axle lift"],
      descriptionFull: "Full description",
    })
    const fallbackNote = buildListingAnalysisNote(buildFallbackFromCar(makeCar()))

    expect(successNote).toBe("Listing analysis complete: 12 photos, 2 equipment items, full description")
    expect(fallbackNote).toBe("Listing analysis used verified database data")
    expect(`${successNote} ${fallbackNote}`).not.toMatch(/scrap|bot|blocked|cloudflare|akamai|waf/i)
  })
})

describe("executeListingScraper", () => {
  it("uses injected adapter, returns safe note, and records monitoring", async () => {
    const adapter: ListingAnalysisAdapter = vi.fn().mockResolvedValue({
      descriptionFull: "Source description",
      photoUrls: ["https://example.com/source.jpg"],
      equipmentList: ["Front axle lift"],
      scrapeSuccessful: true,
      scrapePartial: false,
      analysisStrategy: "inline_live_source",
    })
    const monitor: ListingAnalysisMonitor = vi.fn().mockResolvedValue(undefined)

    const result = await executeListingScraper(makeCtx(makeCar()), {
      adapters: { BaT: adapter },
      monitor,
      now: () => new Date("2026-05-14T10:00:00Z"),
      runId: () => "run-test",
      environment: { isVercel: false, env: {} },
    })

    expect(adapter).toHaveBeenCalledTimes(1)
    expect(result.data.descriptionFull).toBe("Source description")
    expect(result.data.scrapedAt).toBe("2026-05-14T10:00:00.000Z")
    expect(result.completionNote).toBe("Listing analysis complete: 1 photos, 1 equipment items, full description")
    expect(result.completionNote).not.toMatch(/scrap/i)
    expect(monitor).toHaveBeenCalledWith(expect.objectContaining({
      scraper_name: "report-listing-analysis",
      runtime: "server_request",
      discovered: 1,
      written: 1,
      errors_count: 0,
    }))
  })

  it("does not call protected adapters on Vercel by default", async () => {
    const adapter: ListingAnalysisAdapter = vi.fn()
    const monitor: ListingAnalysisMonitor = vi.fn().mockResolvedValue(undefined)
    const car = makeCar({
      platform: "AUTO_TRADER",
      sourceUrl: "https://www.autotrader.co.uk/car-details/2026051401",
    })

    const result = await executeListingScraper(makeCtx(car), {
      adapters: { AutoTrader: adapter },
      monitor,
      now: () => new Date("2026-05-14T10:00:00Z"),
      runId: () => "run-protected",
      environment: { isVercel: true, env: {} },
    })

    expect(adapter).not.toHaveBeenCalled()
    expect(result.data.scrapeSuccessful).toBe(false)
    expect(result.data.fallbackReason).toBe("verified_database_data")
    expect(result.completionNote).toBe("Listing analysis used verified database data")
    expect(monitor).toHaveBeenCalledWith(expect.objectContaining({
      written: 0,
      errors_count: 0,
      source_counts: {
        AutoTrader: { discovered: 1, written: 0 },
      },
    }))
  })

  it("falls back safely when adapter throws", async () => {
    const adapter: ListingAnalysisAdapter = vi.fn().mockRejectedValue(new Error("HTTP 403"))
    const monitor: ListingAnalysisMonitor = vi.fn().mockResolvedValue(undefined)

    const result = await executeListingScraper(makeCtx(makeCar()), {
      adapters: { BaT: adapter },
      monitor,
      now: () => new Date("2026-05-14T10:00:00Z"),
      runId: () => "run-fallback",
      environment: { isVercel: false, env: {} },
    })

    expect(result.data.scrapeSuccessful).toBe(false)
    expect(result.data.scrapePartial).toBe(true)
    expect(result.data.descriptionFull).toBe("Existing DB description")
    expect(result.data.fallbackReason).toBe("source_unavailable")
    expect(result.completionNote).not.toMatch(/403|scrap|blocked/i)
    expect(monitor).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      errors_count: 1,
      error_messages: ["source_unavailable"],
    }))
  })
})
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npx vitest run src/lib/reports/agents/listingScraper.test.ts
```

Expected: FAIL because the new policy helpers, metadata fields, options, and monitoring injection do not exist yet.

---

## Task 2: Extend Report And Monitoring Types

**Files:**
- Modify: `src/lib/reports/types-v3.ts`
- Modify: `src/features/scrapers/common/monitoring/types.ts`

- [ ] **Step 1: Add optional analysis metadata fields to `ScrapedListingFull`**

In `src/lib/reports/types-v3.ts`, extend `ScrapedListingFull` after `platform: string`:

```typescript
  /**
   * Internal Step 1 metadata. Keep customer-facing UI copy separate from these
   * fields; users should see "listing analysis", not scraper internals.
   */
  analysisStrategy?: "inline_live_source" | "database_fallback" | "policy_skipped"
  fallbackReason?:
    | "missing_source_url"
    | "unknown_source"
    | "verified_database_data"
    | "source_unavailable"
    | "empty_source_response"
  analysisSource?: string | null
  analysisFieldCounts?: {
    photos: number
    equipment: number
    modifications: number
    descriptionCharacters: number
  }
```

- [ ] **Step 2: Add monitoring literals**

In `src/features/scrapers/common/monitoring/types.ts`, update the unions:

```typescript
export type ScraperName = 'porsche' | 'ferrari' | 'autotrader' | 'beforward' | 'classic' | 'autoscout24' | 'elferspot' | 'backfill-images' | 'enrich-vin' | 'enrich-titles' | 'enrich-details' | 'enrich-autotrader' | 'enrich-beforward' | 'enrich-elferspot' | 'backfill-photos-elferspot' | 'enrich-details-bulk' | 'as24-enrich' | 'classic-enrich' | 'bat-detail' | 'validate' | 'cleanup' | 'liveness-check' | 'report-listing-analysis';
export type RuntimeEnv = 'vercel_cron' | 'github_actions' | 'cli' | 'windows_task' | 'server_request';
```

- [ ] **Step 3: Run type-focused tests**

Run:

```bash
npx vitest run src/lib/reports/agents/listingScraper.test.ts
```

Expected: still FAIL because implementation is not done, but type errors for the fixture currency and metadata fields should be gone.

---

## Task 3: Implement Fallback, Source Policy, Merge, And Monitoring Shell

**Files:**
- Modify: `src/lib/reports/agents/listingScraper.ts`

- [ ] **Step 1: Replace the stub with policy helpers and injectable execution**

Replace `src/lib/reports/agents/listingScraper.ts` with this structure:

```typescript
import type { CollectorCar } from "@/lib/curatedCars"
import { getListingType } from "@/lib/listingMode"
import { recordScraperRun } from "@/features/scrapers/common/monitoring"
import type { ScraperRunRecord } from "@/features/scrapers/common/monitoring"
import { resolveCanonicalSource } from "@/lib/supabaseLiveListings"
import type { PipelineContext } from "../pipeline"
import type { ScrapedListingFull } from "../types-v3"

export type ListingAnalysisSource =
  | "BaT"
  | "CarsAndBids"
  | "CollectingCars"
  | "AutoTrader"
  | "AutoScout24"
  | "Elferspot"
  | "BeForward"
  | "ClassicCom"

export type ListingAnalysisPatch = Partial<ScrapedListingFull> & {
  scrapeSuccessful: boolean
  scrapePartial: boolean
  analysisStrategy: NonNullable<ScrapedListingFull["analysisStrategy"]>
}

export type ListingAnalysisAdapter = (
  car: CollectorCar,
  fallback: ScrapedListingFull,
) => Promise<ListingAnalysisPatch>

export type ListingAnalysisMonitor = (record: ScraperRunRecord) => Promise<void>

export interface ListingAnalysisEnvironment {
  isVercel: boolean
  env: Record<string, string | undefined>
}

export interface ListingScraperOptions {
  adapters?: Partial<Record<ListingAnalysisSource, ListingAnalysisAdapter>>
  monitor?: ListingAnalysisMonitor
  now?: () => Date
  runId?: () => string
  environment?: ListingAnalysisEnvironment
}

export interface ListingAnalysisPolicy {
  attempt: boolean
  customerSafeReason?: NonNullable<ScrapedListingFull["fallbackReason"]>
}

function getDefaultEnvironment(): ListingAnalysisEnvironment {
  return {
    isVercel: process.env.VERCEL === "1" || process.env.VERCEL === "true",
    env: process.env,
  }
}

function createRunId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `report-listing-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isKnownSource(value: string | null): value is ListingAnalysisSource {
  return value === "BaT"
    || value === "CarsAndBids"
    || value === "CollectingCars"
    || value === "AutoTrader"
    || value === "AutoScout24"
    || value === "Elferspot"
    || value === "BeForward"
    || value === "ClassicCom"
}

export function selectListingAnalysisSource(car: CollectorCar): ListingAnalysisSource | null {
  const canonical = resolveCanonicalSource(null, car.platform) ?? resolveCanonicalSource(car.platform, null)
  if (isKnownSource(canonical)) return canonical

  const url = car.sourceUrl ?? ""
  if (/bringatrailer\.com/i.test(url)) return "BaT"
  if (/carsandbids\.com/i.test(url)) return "CarsAndBids"
  if (/collectingcars\.com/i.test(url)) return "CollectingCars"
  if (/autotrader\.co\.uk/i.test(url)) return "AutoTrader"
  if (/autoscout24\./i.test(url)) return "AutoScout24"
  if (/elferspot\.com/i.test(url)) return "Elferspot"
  if (/beforward\.jp/i.test(url)) return "BeForward"
  if (/classic\.com/i.test(url)) return "ClassicCom"
  return null
}

export function shouldAttemptListingAnalysis(
  source: ListingAnalysisSource,
  environment: ListingAnalysisEnvironment = getDefaultEnvironment(),
): ListingAnalysisPolicy {
  if (source === "AutoTrader") {
    return environment.isVercel && environment.env.REPORT_ANALYSIS_AT_DIRECT !== "1"
      ? { attempt: false, customerSafeReason: "verified_database_data" }
      : { attempt: true }
  }

  if (source === "AutoScout24") {
    return environment.isVercel && environment.env.REPORT_ANALYSIS_AS24_DIRECT !== "1"
      ? { attempt: false, customerSafeReason: "verified_database_data" }
      : { attempt: true }
  }

  if (source === "ClassicCom") {
    return environment.isVercel && environment.env.REPORT_ANALYSIS_CLASSIC_DIRECT !== "1"
      ? { attempt: false, customerSafeReason: "verified_database_data" }
      : { attempt: true }
  }

  return { attempt: true }
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const clean = value?.trim()
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    out.push(clean)
  }
  return out
}

function fieldCounts(data: Pick<ScrapedListingFull, "photoUrls" | "equipmentList" | "modifications" | "descriptionFull">) {
  return {
    photos: data.photoUrls.length,
    equipment: data.equipmentList.length,
    modifications: data.modifications.length,
    descriptionCharacters: data.descriptionFull.length,
  }
}

export function buildFallbackFromCar(car: CollectorCar): ScrapedListingFull {
  const listingType = getListingType(car.platform)
  const images = uniqueStrings(car.images ?? [])
  const description = car.description ?? car.history ?? ""

  const fallback: ScrapedListingFull = {
    title: car.title ?? `${car.year ?? ""} ${car.make ?? ""} ${car.model ?? ""}`.trim(),
    year: car.year ?? null,
    make: car.make ?? "Unknown",
    model: car.model ?? "",
    trim: car.trim ?? null,
    vin: car.vin ?? null,
    engine: car.engine && car.engine !== "-" ? car.engine : null,
    transmission: car.transmission && car.transmission !== "-" ? car.transmission : null,
    drivetrain: null,
    horsepower: null,
    torque: null,
    weight: null,
    bodyStyle: null,
    seats: null,
    mileage: car.mileage ?? null,
    mileageUnit: car.mileageUnit ?? "mi",
    exteriorColor: car.exteriorColor ?? null,
    interiorColor: car.interiorColor ?? null,
    location: car.location ?? null,
    descriptionFull: description,
    sellerNotes: car.sellerNotes ?? null,
    auctionComments: null,
    lotEssay: null,
    equipmentList: [],
    modifications: [],
    photoUrls: images,
    photoCount: images.length,
    currentBid: listingType === "auction" ? (car.currentBid ?? car.price ?? null) : null,
    bidCount: car.bidCount ?? null,
    reserveStatus: "unknown",
    auctionEndTime: car.endTime ? new Date(car.endTime).toISOString() : null,
    askingPrice: listingType === "classified" ? (car.askingPriceUsd ?? car.price ?? null) : null,
    daysOnMarket: null,
    priceDrops: null,
    sellerName: null,
    sellerType: null,
    sellerLocation: null,
    scrapedAt: new Date().toISOString(),
    scrapeSuccessful: false,
    scrapePartial: true,
    sourceUrl: car.sourceUrl ?? "",
    platform: car.platform ?? "UNKNOWN",
    analysisStrategy: "database_fallback",
    fallbackReason: car.sourceUrl ? "verified_database_data" : "missing_source_url",
    analysisSource: null,
    analysisFieldCounts: { photos: images.length, equipment: 0, modifications: 0, descriptionCharacters: description.length },
  }

  return fallback
}

export function mergeAnalysisOntoFallback(
  fallback: ScrapedListingFull,
  patch: ListingAnalysisPatch,
): ScrapedListingFull {
  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== null && value !== undefined && value !== ""),
  ) as Partial<ScrapedListingFull>

  const photoUrls = uniqueStrings(
    patch.photoUrls && patch.photoUrls.length > 0 ? patch.photoUrls : fallback.photoUrls,
  )
  const equipmentList = uniqueStrings(
    patch.equipmentList && patch.equipmentList.length > 0 ? patch.equipmentList : fallback.equipmentList,
  )
  const modifications = uniqueStrings(
    patch.modifications && patch.modifications.length > 0 ? patch.modifications : fallback.modifications,
  )
  const merged: ScrapedListingFull = {
    ...fallback,
    ...cleanPatch,
    title: patch.title?.trim() || fallback.title,
    descriptionFull: patch.descriptionFull?.trim() || fallback.descriptionFull,
    equipmentList,
    modifications,
    photoUrls,
    photoCount: photoUrls.length,
    sourceUrl: fallback.sourceUrl,
    platform: fallback.platform,
    analysisStrategy: patch.analysisStrategy,
    fallbackReason: undefined,
  }

  return {
    ...merged,
    analysisFieldCounts: fieldCounts(merged),
  }
}

export function buildListingAnalysisNote(data: ScrapedListingFull): string {
  if (!data.scrapeSuccessful) return "Listing analysis used verified database data"

  const parts = [
    `${data.photoCount} photos`,
    `${data.equipmentList.length} equipment items`,
    data.descriptionFull ? "full description" : null,
  ].filter(Boolean)

  return `Listing analysis complete: ${parts.join(", ")}`
}

function sanitizeFallbackReason(err: unknown): NonNullable<ScrapedListingFull["fallbackReason"]> {
  if (!(err instanceof Error)) return "source_unavailable"
  if (/empty|no content|no data/i.test(err.message)) return "empty_source_response"
  return "source_unavailable"
}

async function defaultMonitor(record: ScraperRunRecord): Promise<void> {
  await recordScraperRun(record)
}

function buildMonitorRecord(input: {
  runId: string
  startedAt: string
  finishedAt: string
  durationMs: number
  source: ListingAnalysisSource | null
  success: boolean
  wroteLiveData: boolean
  errorReason?: NonNullable<ScrapedListingFull["fallbackReason"]>
}): ScraperRunRecord {
  const sourceCounts = input.source
    ? { [input.source]: { discovered: 1, written: input.wroteLiveData ? 1 : 0 } }
    : {}

  return {
    scraper_name: "report-listing-analysis",
    run_id: input.runId,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    success: input.success,
    runtime: "server_request",
    duration_ms: input.durationMs,
    discovered: input.source ? 1 : 0,
    written: input.wroteLiveData ? 1 : 0,
    errors_count: input.errorReason && input.errorReason !== "verified_database_data" ? 1 : 0,
    details_fetched: input.wroteLiveData ? 1 : 0,
    source_counts: sourceCounts,
    error_messages: input.errorReason && input.errorReason !== "verified_database_data"
      ? [input.errorReason]
      : undefined,
  }
}

const DEFAULT_ADAPTERS: Partial<Record<ListingAnalysisSource, ListingAnalysisAdapter>> = {}

export async function executeListingScraper(
  ctx: PipelineContext,
  options: ListingScraperOptions = {},
): Promise<{
  data: ScrapedListingFull
  durationMs: number
  agentModel: string | null
  completionNote?: string
}> {
  const t0 = Date.now()
  const now = options.now ?? (() => new Date())
  const runId = (options.runId ?? createRunId)()
  const startedAt = now().toISOString()
  const monitor = options.monitor ?? defaultMonitor
  const environment = options.environment ?? getDefaultEnvironment()
  const fallback = {
    ...buildFallbackFromCar(ctx.car),
    scrapedAt: startedAt,
  }
  const source = selectListingAnalysisSource(ctx.car)

  async function finish(data: ScrapedListingFull, success: boolean, errorReason?: NonNullable<ScrapedListingFull["fallbackReason"]>) {
    const durationMs = Date.now() - t0
    await monitor(buildMonitorRecord({
      runId,
      startedAt,
      finishedAt: now().toISOString(),
      durationMs,
      source,
      success,
      wroteLiveData: data.scrapeSuccessful,
      errorReason,
    }))
    return {
      data,
      durationMs,
      agentModel: null,
      completionNote: buildListingAnalysisNote(data),
    }
  }

  if (!source) {
    return finish(
      { ...fallback, fallbackReason: "unknown_source", analysisStrategy: "database_fallback" },
      true,
      "unknown_source",
    )
  }

  if (!ctx.car.sourceUrl) {
    return finish(
      { ...fallback, fallbackReason: "missing_source_url", analysisStrategy: "database_fallback" },
      true,
      "missing_source_url",
    )
  }

  const policy = shouldAttemptListingAnalysis(source, environment)
  if (!policy.attempt) {
    return finish(
      { ...fallback, fallbackReason: policy.customerSafeReason, analysisStrategy: "policy_skipped", analysisSource: source },
      true,
      policy.customerSafeReason,
    )
  }

  const adapters = { ...DEFAULT_ADAPTERS, ...options.adapters }
  const adapter = adapters[source]
  if (!adapter) {
    return finish(
      { ...fallback, fallbackReason: "verified_database_data", analysisStrategy: "database_fallback", analysisSource: source },
      true,
      "verified_database_data",
    )
  }

  try {
    const patch = await adapter(ctx.car, fallback)
    const data = mergeAnalysisOntoFallback(fallback, {
      ...patch,
      scrapedAt: now().toISOString(),
      analysisSource: source,
    })
    console.log(JSON.stringify({
      level: "info",
      event: "v3_listing_analysis.completed",
      listingId: ctx.listingId,
      source,
      durationMs: Date.now() - t0,
      strategy: data.analysisStrategy,
      photoCount: data.photoCount,
      equipmentCount: data.equipmentList.length,
    }))
    return finish(data, true)
  } catch (err) {
    const fallbackReason = sanitizeFallbackReason(err)
    console.warn(JSON.stringify({
      level: "warn",
      event: "v3_listing_analysis.fallback",
      listingId: ctx.listingId,
      source,
      durationMs: Date.now() - t0,
      reason: fallbackReason,
    }))
    return finish(
      { ...fallback, fallbackReason, analysisStrategy: "database_fallback", analysisSource: source },
      false,
      fallbackReason,
    )
  }
}
```

- [ ] **Step 2: Run tests**

Run:

```bash
npx vitest run src/lib/reports/agents/listingScraper.test.ts
```

Expected: PASS for policy/fallback tests and FAIL for injected adapter test only if `DEFAULT_ADAPTERS` typing or metadata merge needs adjustment.

- [ ] **Step 3: Commit the policy shell**

```bash
git add src/lib/reports/types-v3.ts src/features/scrapers/common/monitoring/types.ts src/lib/reports/agents/listingScraper.ts src/lib/reports/agents/listingScraper.test.ts
git commit -m "feat(reports): add source-aware listing analysis policy"
```

---

## Task 4: Add Safe Inline Source Adapters

**Files:**
- Modify: `src/lib/reports/agents/listingScraper.ts`

- [ ] **Step 1: Add auction adapter helper**

Above `DEFAULT_ADAPTERS`, add:

```typescript
async function scrapeAuctionSource(
  source: "BaT" | "CarsAndBids" | "CollectingCars",
  car: CollectorCar,
): Promise<ListingAnalysisPatch> {
  if (!car.sourceUrl) throw new Error("Missing sourceUrl")

  const base = {
    externalId: `${source.toLowerCase()}-${car.id}`,
    title: car.title,
    make: car.make,
    model: car.model,
    year: car.year,
    mileage: car.mileage ?? null,
    mileageUnit: car.mileageUnit === "km" ? "km" : "miles",
    transmission: car.transmission ?? null,
    engine: car.engine ?? null,
    exteriorColor: car.exteriorColor ?? null,
    interiorColor: car.interiorColor ?? null,
    location: car.location ?? null,
    currentBid: car.currentBid ?? null,
    bidCount: car.bidCount ?? 0,
    endTime: car.endTime ?? null,
    url: car.sourceUrl,
    imageUrl: car.image ?? null,
    description: car.description ?? null,
    sellerNotes: car.sellerNotes ?? null,
    status: car.status ?? "unknown",
    vin: car.vin ?? null,
    images: car.images ?? [],
  }

  const detailed =
    source === "BaT"
      ? await (await import("@/features/scrapers/auctions/bringATrailer")).scrapeDetail({
          ...base,
          platform: "BRING_A_TRAILER",
          reserveStatus: null,
          bodyStyle: null,
        })
      : source === "CarsAndBids"
        ? await (await import("@/features/scrapers/auctions/carsAndBids")).scrapeDetail({
            ...base,
            platform: "CARS_AND_BIDS",
          })
        : await (await import("@/features/scrapers/auctions/collectingCars")).scrapeDetail({
            ...base,
            platform: "COLLECTING_CARS",
          })

  return {
    title: detailed.title,
    year: detailed.year ?? null,
    make: detailed.make ?? car.make,
    model: detailed.model ?? car.model,
    vin: detailed.vin ?? null,
    engine: detailed.engine ?? null,
    transmission: detailed.transmission ?? null,
    mileage: detailed.mileage ?? null,
    mileageUnit: detailed.mileageUnit === "km" ? "km" : "mi",
    exteriorColor: detailed.exteriorColor ?? null,
    interiorColor: detailed.interiorColor ?? null,
    location: detailed.location ?? null,
    descriptionFull: detailed.description ?? "",
    sellerNotes: detailed.sellerNotes ?? null,
    photoUrls: detailed.images ?? [],
    currentBid: detailed.currentBid ?? null,
    bidCount: detailed.bidCount ?? null,
    reserveStatus:
      detailed.reserveStatus === "NO_RESERVE"
        ? "no_reserve"
        : detailed.reserveStatus === "RESERVE_MET"
          ? "met"
          : detailed.reserveStatus === "RESERVE_NOT_MET"
            ? "not_met"
            : "unknown",
    auctionEndTime: detailed.endTime ? new Date(detailed.endTime).toISOString() : null,
    scrapeSuccessful: true,
    scrapePartial: false,
    analysisStrategy: "inline_live_source",
  }
}
```

- [ ] **Step 2: Add Elferspot and BeForward adapters**

Add:

```typescript
async function analyzeElferspot(car: CollectorCar): Promise<ListingAnalysisPatch> {
  if (!car.sourceUrl) throw new Error("Missing sourceUrl")
  const { fetchDetailPage } = await import("@/features/scrapers/elferspot_collector/detail")
  const detail = await fetchDetailPage(car.sourceUrl)

  return {
    year: detail.year,
    model: detail.model ?? car.model,
    vin: detail.vin,
    engine: detail.engine,
    transmission: detail.transmission,
    drivetrain: detail.driveType,
    bodyStyle: detail.bodyType,
    mileage: detail.mileageKm,
    mileageUnit: "km",
    exteriorColor: detail.colorExterior,
    interiorColor: detail.colorInterior,
    location: detail.location ?? detail.locationCountry,
    descriptionFull: detail.descriptionText ?? "",
    sellerName: detail.sellerName,
    sellerType: detail.sellerType === "dealer" ? "dealer" : detail.sellerType === "private" ? "private" : null,
    photoUrls: detail.images,
    askingPrice: detail.price,
    scrapeSuccessful: Boolean(detail.descriptionText) || detail.images.length > 0,
    scrapePartial: !detail.descriptionText || detail.images.length === 0,
    analysisStrategy: "inline_live_source",
  }
}

async function analyzeBeForward(car: CollectorCar): Promise<ListingAnalysisPatch> {
  if (!car.sourceUrl) throw new Error("Missing sourceUrl")
  const [{ fetchAndParseDetail }, { PerDomainRateLimiter }] = await Promise.all([
    import("@/features/scrapers/beforward_porsche_collector/detail"),
    import("@/features/scrapers/beforward_porsche_collector/net"),
  ])
  const detail = await fetchAndParseDetail({
    url: car.sourceUrl,
    timeoutMs: 15_000,
    limiter: new PerDomainRateLimiter(2500),
  })

  return {
    title: detail.title,
    year: detail.year,
    make: detail.make ?? car.make,
    model: detail.model ?? car.model,
    trim: detail.trim,
    vin: detail.vin ?? detail.chassisNo,
    engine: detail.engine,
    transmission: detail.transmission,
    drivetrain: detail.drive,
    seats: detail.seats,
    mileage: detail.mileageKm,
    mileageUnit: "km",
    exteriorColor: detail.exteriorColor,
    interiorColor: detail.interiorColor,
    location: detail.location,
    equipmentList: detail.features,
    modifications: detail.sellingPoints,
    photoUrls: detail.images,
    askingPrice: detail.schemaPriceUsd,
    scrapeSuccessful: detail.images.length > 0 || detail.features.length > 0,
    scrapePartial: detail.images.length === 0,
    analysisStrategy: "inline_live_source",
  }
}
```

- [ ] **Step 3: Wire safe adapters into `DEFAULT_ADAPTERS`**

Replace the empty default adapter object:

```typescript
const DEFAULT_ADAPTERS: Partial<Record<ListingAnalysisSource, ListingAnalysisAdapter>> = {
  BaT: (car) => scrapeAuctionSource("BaT", car),
  CarsAndBids: (car) => scrapeAuctionSource("CarsAndBids", car),
  CollectingCars: (car) => scrapeAuctionSource("CollectingCars", car),
  Elferspot: analyzeElferspot,
  BeForward: analyzeBeForward,
}
```

- [ ] **Step 4: Run focused tests and type check**

Run:

```bash
npx vitest run src/lib/reports/agents/listingScraper.test.ts
npx tsc --noEmit
```

Expected: Vitest PASS. Type check should pass for `src/lib/reports/agents/listingScraper.ts`; if unrelated repo errors appear, capture them in the implementation report.

- [ ] **Step 5: Commit safe adapters**

```bash
git add src/lib/reports/agents/listingScraper.ts src/lib/reports/agents/listingScraper.test.ts
git commit -m "feat(reports): analyze safe listing sources during report generation"
```

---

## Task 5: Add Protected Source Adapters Behind Policy Gates

**Files:**
- Modify: `src/lib/reports/agents/listingScraper.ts`
- Modify: `src/lib/reports/agents/listingScraper.test.ts`

- [ ] **Step 1: Add tests for protected adapters not leaking internal reasons**

Append to `listingScraper.test.ts`:

```typescript
it("uses protected adapter when explicit flag allows it and keeps notes customer-safe", async () => {
  const adapter: ListingAnalysisAdapter = vi.fn().mockResolvedValue({
    descriptionFull: "Protected source description",
    photoUrls: [],
    equipmentList: [],
    scrapeSuccessful: true,
    scrapePartial: true,
    analysisStrategy: "inline_live_source",
  })
  const monitor: ListingAnalysisMonitor = vi.fn().mockResolvedValue(undefined)
  const car = makeCar({
    platform: "AUTO_SCOUT_24",
    sourceUrl: "https://www.autoscout24.com/offers/porsche-test",
  })

  const result = await executeListingScraper(makeCtx(car), {
    adapters: { AutoScout24: adapter },
    monitor,
    now: () => new Date("2026-05-14T10:00:00Z"),
    runId: () => "run-as24",
    environment: { isVercel: true, env: { REPORT_ANALYSIS_AS24_DIRECT: "1" } },
  })

  expect(adapter).toHaveBeenCalledTimes(1)
  expect(result.data.scrapeSuccessful).toBe(true)
  expect(result.completionNote).not.toMatch(/scrap|blocked|cloudflare|akamai|waf/i)
})
```

- [ ] **Step 2: Add protected adapter implementations**

Add above `DEFAULT_ADAPTERS`:

```typescript
async function analyzeAutoTrader(car: CollectorCar): Promise<ListingAnalysisPatch> {
  if (!car.sourceUrl) throw new Error("Missing sourceUrl")
  const { fetchAutoTraderDetail } = await import("@/features/scrapers/autotrader_collector/detail")
  const detail = await fetchAutoTraderDetail(car.sourceUrl, 15_000)

  return {
    title: detail.title ?? undefined,
    vin: detail.vin,
    engine: detail.engine,
    transmission: detail.transmission,
    mileage: detail.mileage,
    mileageUnit: detail.mileageUnit === "km" ? "km" : "mi",
    exteriorColor: detail.exteriorColor,
    interiorColor: detail.interiorColor,
    location: detail.location,
    descriptionFull: detail.description ?? "",
    photoUrls: detail.images,
    askingPrice: detail.price,
    bodyStyle: detail.bodyStyle,
    scrapeSuccessful: Boolean(detail.description) || detail.images.length > 0,
    scrapePartial: !detail.description || detail.images.length === 0,
    analysisStrategy: "inline_live_source",
  }
}

async function analyzeAutoScout24(car: CollectorCar): Promise<ListingAnalysisPatch> {
  if (!car.sourceUrl) throw new Error("Missing sourceUrl")
  const [{ fetchAS24DetailWithScrapling }, { proxyFetch }, { parseDetailHtml }] = await Promise.all([
    import("@/features/scrapers/autoscout24_collector/scrapling"),
    import("@/features/scrapers/common/proxy-fetch"),
    import("@/features/scrapers/autoscout24_collector/detail"),
  ])

  const scrapling = await fetchAS24DetailWithScrapling(car.sourceUrl)
  if (scrapling) {
    return {
      trim: scrapling.trim,
      vin: scrapling.vin,
      engine: scrapling.engine,
      transmission: scrapling.transmission,
      bodyStyle: scrapling.bodyStyle,
      exteriorColor: scrapling.colorExterior,
      interiorColor: scrapling.colorInterior,
      descriptionFull: scrapling.description ?? "",
      equipmentList: scrapling.features,
      photoUrls: scrapling.images,
      scrapeSuccessful: Boolean(scrapling.description) || scrapling.images.length > 0,
      scrapePartial: !scrapling.description || scrapling.images.length === 0,
      analysisStrategy: "inline_live_source",
    }
  }

  const response = await proxyFetch(car.sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const html = await response.text()
  if (html.includes("/_sec/cp_challenge") || html.includes("akam") || html.length < 5000) {
    throw new Error("Protected source response")
  }
  const detail = parseDetailHtml(html)
  return {
    title: detail.title || undefined,
    year: detail.year,
    make: detail.make ?? car.make,
    model: detail.model ?? car.model,
    trim: detail.trim,
    vin: detail.vin,
    engine: detail.engine ?? detail.power,
    transmission: detail.transmission,
    bodyStyle: detail.bodyStyle,
    mileage: detail.mileageKm,
    mileageUnit: "km",
    exteriorColor: detail.exteriorColor,
    interiorColor: detail.interiorColor,
    location: detail.location,
    descriptionFull: detail.description ?? "",
    equipmentList: detail.features,
    photoUrls: detail.images,
    askingPrice: detail.price,
    sellerName: detail.sellerName,
    sellerType: detail.sellerType ? "dealer" : null,
    scrapeSuccessful: Boolean(detail.description) || detail.images.length > 0,
    scrapePartial: !detail.description || detail.images.length === 0,
    analysisStrategy: "inline_live_source",
  }
}

async function analyzeClassicCom(car: CollectorCar): Promise<ListingAnalysisPatch> {
  if (!car.sourceUrl) throw new Error("Missing sourceUrl")
  const [{ fetchClassicDetailWithScrapling }, { parseClassicDetailContent }] = await Promise.all([
    import("@/features/scrapers/classic_collector/scrapling"),
    import("@/features/scrapers/classic_collector/detail"),
  ])
  const content = await fetchClassicDetailWithScrapling(car.sourceUrl)
  if (!content) throw new Error("Protected source response")
  const { raw } = parseClassicDetailContent(content, car.sourceUrl)
  return {
    title: raw.title,
    year: raw.year,
    make: raw.make ?? car.make,
    model: raw.model ?? car.model,
    trim: raw.trim,
    vin: raw.vin,
    engine: raw.engine,
    transmission: raw.transmission,
    drivetrain: raw.driveType,
    bodyStyle: raw.bodyStyle,
    mileage: raw.mileage,
    mileageUnit: raw.mileageUnit === "km" ? "km" : "mi",
    exteriorColor: raw.exteriorColor,
    interiorColor: raw.interiorColor,
    location: raw.location,
    descriptionFull: raw.description ?? "",
    photoUrls: raw.images,
    askingPrice: raw.price,
    currentBid: raw.hammerPrice,
    bidCount: raw.bidCount,
    reserveStatus: "unknown",
    auctionEndTime: raw.endTime ? new Date(raw.endTime).toISOString() : null,
    scrapeSuccessful: Boolean(raw.description) || raw.images.length > 0,
    scrapePartial: !raw.description || raw.images.length === 0,
    analysisStrategy: "inline_live_source",
  }
}
```

- [ ] **Step 3: Add protected adapters to defaults**

Update `DEFAULT_ADAPTERS`:

```typescript
const DEFAULT_ADAPTERS: Partial<Record<ListingAnalysisSource, ListingAnalysisAdapter>> = {
  BaT: (car) => scrapeAuctionSource("BaT", car),
  CarsAndBids: (car) => scrapeAuctionSource("CarsAndBids", car),
  CollectingCars: (car) => scrapeAuctionSource("CollectingCars", car),
  Elferspot: analyzeElferspot,
  BeForward: analyzeBeForward,
  AutoTrader: analyzeAutoTrader,
  AutoScout24: analyzeAutoScout24,
  ClassicCom: analyzeClassicCom,
}
```

- [ ] **Step 4: Run tests and type check**

Run:

```bash
npx vitest run src/lib/reports/agents/listingScraper.test.ts
npx tsc --noEmit
```

Expected: PASS for listing scraper tests. Type check should pass in touched files.

- [ ] **Step 5: Commit protected source policy**

```bash
git add src/lib/reports/agents/listingScraper.ts src/lib/reports/agents/listingScraper.test.ts
git commit -m "feat(reports): gate protected listing analysis sources"
```

---

## Task 6: Surface Customer-Safe Progress Notes

**Files:**
- Modify: `src/lib/reports/pipeline.ts`
- Create: `src/lib/reports/pipeline.test.ts`

- [ ] **Step 1: Add progress regression tests**

Create `src/lib/reports/pipeline.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { runV3Pipeline, STEP_DEFS, type StepExecutor } from "./pipeline"
import type { CollectorCar } from "@/lib/curatedCars"

const car = {
  id: "live-test",
  title: "2024 Porsche 911 GT3 RS",
  year: 2024,
  make: "Porsche",
  model: "911 GT3 RS",
  trim: null,
  price: 285000,
  trend: "flat",
  trendValue: 0,
  thesis: "",
  image: "",
  images: [],
  engine: "",
  transmission: "",
  mileage: 0,
  mileageUnit: "mi",
  location: "",
  region: "US",
  fairValueByRegion: {
    US: { currency: "$", low: 0, high: 0 },
    EU: { currency: "€", low: 0, high: 0 },
    UK: { currency: "£", low: 0, high: 0 },
    JP: { currency: "¥", low: 0, high: 0 },
  },
  history: "",
  platform: "BRING_A_TRAILER",
  status: "ACTIVE",
  currentBid: 0,
  bidCount: 0,
  endTime: new Date("2026-06-01T12:00:00Z"),
  category: "911",
} satisfies CollectorCar

describe("runV3Pipeline progress", () => {
  it("uses customer-safe Step 1 label", () => {
    expect(STEP_DEFS[0]).toMatchObject({
      sectionKey: "listing_scrape",
      label: "Analyzing Listing",
    })
  })

  it("emits executor completion notes on completed progress events", async () => {
    const events: Array<{ sectionKey: string; status: string; completionNote?: string }> = []
    const executor: StepExecutor = async () => ({
      data: {},
      durationMs: 1,
      agentModel: null,
      completionNote: "Listing analysis complete: 12 photos, 3 equipment items, full description",
    })

    await runV3Pipeline({
      listingId: "live-test",
      car,
      executors: {
        listing_scrape: executor,
        vehicle_identity: executor,
        market_data_bundle: executor,
        fair_value: executor,
        technical_analysis: executor,
        investment_analysis: executor,
        due_diligence: executor,
        market_research: executor,
        buyer_services: executor,
        final_synthesis: executor,
      },
      onProgress: (event) => events.push(event),
    })

    const listingEvent = events.find((event) =>
      event.sectionKey === "listing_scrape" && event.status === "completed"
    )
    expect(listingEvent?.completionNote).toBe("Listing analysis complete: 12 photos, 3 equipment items, full description")
    expect(listingEvent?.completionNote).not.toMatch(/scrap|blocked|cloudflare|akamai|waf/i)
  })
})
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npx vitest run src/lib/reports/pipeline.test.ts
```

Expected: FAIL because `StepExecutor` does not expose `completionNote` and Step 1 label is currently `Reading Listing`.

- [ ] **Step 3: Update `StepExecutor` return type**

In `src/lib/reports/pipeline.ts`, change:

```typescript
export type StepExecutor = (
  ctx: PipelineContext
) => Promise<{ data: unknown; durationMs: number; agentModel: string | null }>
```

to:

```typescript
export type StepExecutor = (
  ctx: PipelineContext
) => Promise<{
  data: unknown
  durationMs: number
  agentModel: string | null
  completionNote?: string
}>
```

- [ ] **Step 4: Rename the visible Step 1 label**

In `STEP_DEFS`, change:

```typescript
{ stepId: 1, sectionKey: "listing_scrape", label: "Reading Listing" },
```

to:

```typescript
{ stepId: 1, sectionKey: "listing_scrape", label: "Analyzing Listing" },
```

- [ ] **Step 5: Pass completion note through progress**

Inside `runStep`, change:

```typescript
emitProgress(onProgress, step, "completed", undefined, duration)
```

to:

```typescript
emitProgress(onProgress, step, "completed", result.completionNote, duration)
```

- [ ] **Step 6: Run tests**

Run:

```bash
npx vitest run src/lib/reports/pipeline.test.ts src/lib/reports/agents/listingScraper.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit progress note support**

```bash
git add src/lib/reports/pipeline.ts src/lib/reports/pipeline.test.ts
git commit -m "feat(reports): show safe listing analysis progress notes"
```

---

## Task 7: Route Regression And Runtime Verification

**Files:**
- No production files.
- Existing test: `src/app/api/analyze/v3/route.test.ts`

- [ ] **Step 1: Run V3 route regression**

Run:

```bash
npx vitest run src/app/api/analyze/v3/route.test.ts
```

Expected: PASS. This confirms SSE streaming and section persistence still work.

- [ ] **Step 2: Run focused report suite**

Run:

```bash
npx vitest run src/lib/reports/pipeline.test.ts src/lib/reports/agents/listingScraper.test.ts src/app/api/analyze/v3/route.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run type check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS in all touched files. If unrelated existing type errors appear, capture exact file paths and errors in the implementation report.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS. If build fails because of unrelated environment-gated behavior, capture the exact failure and still provide the focused Vitest/type-check results.

---

## Testscript: TS-V3-LISTING-ANALYSIS-DATA-ACQUISITION

**Identifier:** `TS-V3-LISTING-ANALYSIS-DATA-ACQUISITION`

**Objective:** Prove that a paid V3 report generation enriches Step 1 with safe source data when available, persists `listing_scrape`, emits customer-safe progress, records monitoring, and falls back cleanly for protected sources.

**Prerequisites:**
- `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and report generation AI keys.
- Optional experiment flags are unset for default safety:
  - `REPORT_ANALYSIS_AT_DIRECT`
  - `REPORT_ANALYSIS_AS24_DIRECT`
  - `REPORT_ANALYSIS_CLASSIC_DIRECT`
- Test user is signed in and has enough Pistons or unlimited report access.
- At least one live BaT or Elferspot listing exists.
- Optional: one AutoTrader, AutoScout24, or ClassicCom listing exists to verify protected fallback.

**Setup Steps:**
1. Run `npm run dev`.
2. Open the app in a browser and sign in as the test user.
3. Pick one safe-source listing id and one protected-source listing id.

**Run Commands:**

```bash
npx vitest run src/lib/reports/pipeline.test.ts src/lib/reports/agents/listingScraper.test.ts src/app/api/analyze/v3/route.test.ts
npx tsc --noEmit
```

**Manual Runtime Steps:**
1. Navigate to `/en/cars/porsche/<safe-source-listing-id>/report`.
2. Click `Unlock full report`.
3. Confirm the generation UI says `Analyzing Listing` and does not mention scraping.
4. Wait for report completion.
5. Query Supabase `report_sections` for the listing id and `section_key = 'listing_scrape'`.
6. Query Supabase `scraper_runs` for `scraper_name = 'report-listing-analysis'`.
7. Repeat with the protected-source listing id.

**Expected Observations:**
- SSE progress includes `sectionKey: "listing_scrape"` and label `Analyzing Listing`.
- Completion note is either:
  - `Listing analysis complete: ...`
  - `Listing analysis used verified database data`
- No customer-visible text contains `scrape`, `scraper`, `scraping`, `blocked`, `Cloudflare`, `Akamai`, `WAF`, or `bot`.
- Safe-source listing stores richer `section_data` when the source page responds.
- Protected source defaults to `analysisStrategy: "policy_skipped"` or `database_fallback` on Vercel unless explicit experiment flag is set.
- Report generation completes in both cases.
- `scraper_runs` has one `report-listing-analysis` row per generation attempt with source-level counts.

**Artifact Capture:**
- Terminal output for focused Vitest run.
- Terminal output for `npx tsc --noEmit`.
- Redacted `report_sections.section_data` row for safe-source listing.
- Redacted `report_sections.section_data` row for protected-source listing.
- Redacted `scraper_runs` row for each attempt.
- Browser screenshot of generation modal showing `Analyzing Listing`.

**Cleanup:**
- Remove test `report_sections` rows only for manually generated test listings if regeneration noise matters.
- Do not delete user credit ledger rows unless the test user is disposable.

## Pass/Fail Criteria

**Pass**
- Focused Vitest suite passes.
- Type check passes in touched files.
- Safe sources can enrich Step 1 without breaking report generation.
- Protected sources fall back quickly by default on Vercel.
- `listing_scrape` persists for success and fallback paths.
- Monitoring writes `report-listing-analysis` rows.
- No customer-facing copy mentions scraping or blocking internals.
- No new dependencies added.

**Fail**
- V3 generation fails because Step 1 cannot reach a source.
- Protected sources are attempted by default on Vercel.
- Completion notes or progress labels mention scraping/blocking internals.
- Tests require external network access.
- `listingScraper.ts` exceeds 700 LOC.

## Implementation Order

1. Add failing `listingScraper` tests.
2. Extend V3 and monitoring types.
3. Implement source policy, fallback, merge, monitoring shell.
4. Add safe inline adapters.
5. Add protected adapters behind policy gates.
6. Add safe progress completion notes.
7. Run focused tests, type check, build, and manual testscript.

## Self-Review

**Spec coverage:** Covers source-aware Step 1, safe inline sources, protected source fallback, user interaction language, report section persistence, and monitoring.

**Placeholder scan:** No unfinished placeholder language. Protected source behavior is explicit and flag names are defined.

**Type consistency:** Uses existing `listing_scrape` section key; new helper names are consistent across tests and implementation; monitoring names are added before use.

**Locality envelope:** Files: 6 total. LOC/file: listed in File Map. Deps: 0 new. Changes remain in the reports vertical slice plus one monitoring type union.
