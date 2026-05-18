import { afterEach, describe, expect, it, vi } from "vitest"
import type { CollectorCar } from "@/lib/curatedCars"
import type { PipelineContext } from "../pipeline"
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

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.useRealTimers()
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

  it("requires Scrapling availability for protected non-Vercel sources that need it", () => {
    expect(shouldAttemptListingAnalysis("AutoTrader", { isVercel: false, env: {} }).attempt).toBe(true)
    expect(shouldAttemptListingAnalysis("AutoScout24", {
      isVercel: false,
      env: {},
      hasScrapling: false,
    })).toMatchObject({ attempt: false, customerSafeReason: "verified_database_data" })
    expect(shouldAttemptListingAnalysis("ClassicCom", {
      isVercel: false,
      env: {},
      hasScrapling: false,
    }).attempt).toBe(false)
    expect(shouldAttemptListingAnalysis("AutoScout24", {
      isVercel: false,
      env: {},
      hasScrapling: true,
    }).attempt).toBe(true)
    expect(shouldAttemptListingAnalysis("ClassicCom", {
      isVercel: false,
      env: {},
      hasScrapling: true,
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

  it("does not let undefined patch values erase required fallback fields", () => {
    const fallback = buildFallbackFromCar(makeCar())
    const merged = mergeAnalysisOntoFallback(fallback, {
      year: undefined,
      mileageUnit: undefined,
      reserveStatus: undefined,
      auctionEndTime: undefined,
      sourceUrl: undefined,
      platform: undefined,
      descriptionFull: "Source description",
      scrapeSuccessful: true,
      scrapePartial: false,
      analysisStrategy: "inline_live_source",
    })

    expect(merged.year).toBe(2024)
    expect(merged.mileageUnit).toBe("mi")
    expect(merged.reserveStatus).toBe("unknown")
    expect(merged.auctionEndTime).toBe("2026-06-01T12:00:00.000Z")
    expect(merged.sourceUrl).toBe("https://bringatrailer.com/listing/2024-porsche-911-gt3-rs/")
    expect(merged.platform).toBe("BRING_A_TRAILER")
  })

  it("accepts source analysis with photos even when no full description is available", async () => {
    const adapter: ListingAnalysisAdapter = vi.fn().mockResolvedValue({
      photoUrls: ["https://example.com/source-1.jpg"],
      descriptionFull: "",
      scrapeSuccessful: true,
      scrapePartial: true,
      analysisStrategy: "inline_live_source",
    })
    const monitor: ListingAnalysisMonitor = vi.fn().mockResolvedValue(undefined)

    const result = await executeListingScraper(makeCtx(makeCar()), {
      adapters: { BaT: adapter },
      monitor,
      now: () => new Date("2026-05-14T10:00:00Z"),
      runId: () => "run-photos-only",
      environment: { isVercel: false, env: {} },
    })

    expect(result.data.scrapeSuccessful).toBe(true)
    expect(result.data.photoCount).toBe(1)
    expect(result.data.fallbackReason).toBeUndefined()
    expect(monitor).toHaveBeenCalledWith(expect.objectContaining({
      written: 1,
      errors_count: 0,
    }))
  })

  it("falls back when an adapter returns no useful source fields", async () => {
    const adapter: ListingAnalysisAdapter = vi.fn().mockResolvedValue({
      title: "2024 Porsche 911 GT3 RS",
      year: 2024,
      make: "Porsche",
      model: "911 GT3 RS",
      scrapeSuccessful: true,
      scrapePartial: true,
      analysisStrategy: "inline_live_source",
    })
    const monitor: ListingAnalysisMonitor = vi.fn().mockResolvedValue(undefined)

    const result = await executeListingScraper(makeCtx(makeCar()), {
      adapters: { BaT: adapter },
      monitor,
      now: () => new Date("2026-05-14T10:00:00Z"),
      runId: () => "run-empty",
      environment: { isVercel: false, env: {} },
    })

    expect(result.data.scrapeSuccessful).toBe(false)
    expect(result.data.fallbackReason).toBe("empty_source_response")
    expect(result.completionNote).toBe("Listing analysis used verified database data")
    expect(monitor).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      written: 0,
      errors_count: 1,
      error_messages: ["empty_source_response"],
    }))
  })

  it("returns customer-safe completion notes without disallowed terminology", () => {
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

  it("applies the report-level 15s timeout around adapter calls", async () => {
    vi.useFakeTimers()
    const adapter: ListingAnalysisAdapter = vi.fn(() => new Promise<never>(() => undefined))
    const monitor: ListingAnalysisMonitor = vi.fn().mockResolvedValue(undefined)

    const pending = executeListingScraper(makeCtx(makeCar()), {
      adapters: { BaT: adapter },
      monitor,
      now: () => new Date("2026-05-14T10:00:00Z"),
      runId: () => "run-timeout",
      environment: { isVercel: false, env: {} },
    })

    await vi.advanceTimersByTimeAsync(14_999)
    let settled = false
    pending.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    const result = await pending

    expect(adapter).toHaveBeenCalledTimes(1)
    expect(result.data.scrapeSuccessful).toBe(false)
    expect(result.data.fallbackReason).toBe("source_unavailable")
    expect(result.completionNote).toBe("Listing analysis used verified database data")
    expect(monitor).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      duration_ms: 15_000,
      errors_count: 1,
      error_messages: ["source_unavailable"],
    }))
  })
})
